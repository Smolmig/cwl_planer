// Secure scheduled collection for every explicitly linked Clash clan.
// Runs without any browser sessions; writes only clan-scoped stat tables.
import {verifyCollectorIdentity} from "./collector-auth.mjs";
import {hasCronHeaders,validCronHeaderShape,verifyIndependentCron} from "./collector-cron-auth.mjs";
import {tag,validTag,buildWarSnapshot,hasCapturedCwlRound} from "./collector-core.mjs";
import {rosterEvidence} from "./collector-roster.mjs";
import {verifiedLeagueObservation} from "./collector-season-evidence.mjs";
import {ownerlessRolloverPolicy,attemptOwnerlessRollover} from "./collector-ownerless-rollover.mjs";

const GAME="https://cocproxy.royaleapi.dev/v1";
const MAX_TAGS=32,MAX_CLANS_PER_RUN=5,PER_RUN_BUDGET_MS=105000;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ERROR={api: "clash_api_unavailable",save:"stats_storage_unavailable",
  invalid:"war_data_incomplete",config:"server_not_configured"};
function response(body,status=200){
  return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
}
// Keep upstream failure classes without logging URLs, clan/player tags or keys.
async function game(path,apiKey) {
  for(let attempt=0;attempt<2;attempt++){
    let r;
    try{
      r=await fetch(GAME+path,{
        headers:{"Authorization":"Bearer "+apiKey,"Accept":"application/json"},
        signal:AbortSignal.timeout(8000)
      });
    }catch(e){
      if(attempt===0){await delay(400);continue}
      throw Error(ERROR.api+":"+(e?.name==="TimeoutError"?"timeout":"network"));
    }
    if(r.status===404)return null;
    if(!r.ok){
      if(attempt===0&&(r.status===429||r.status>=500)){
        await delay(r.status===429?1000:400);continue;
      }
      throw Error(ERROR.api+":http_"+r.status);
    }
    try{return await r.json()}catch{throw Error(ERROR.invalid)}
  }
  throw Error(ERROR.api+":network");
}
function apiDiagnostic(err,stage){
  // Strictly whitelist public status classes. Error messages might contain
  // upstream/tenant data, so never persist or return their original text.
  const raw=String(err?.message||"");
  const suffix=raw.startsWith(ERROR.api+":")?raw.slice(ERROR.api.length+1):"";
  const kind=/^(?:http_[1-5][0-9]{2}|network|timeout)$/.test(suffix)?suffix:
    raw===ERROR.invalid?"invalid_json":"invalid_war_data";
  return (raw===ERROR.invalid?ERROR.invalid:ERROR.api)+":"+stage+":"+kind;
}
function rosterDiagnostic(err){
  // Never persist/log raw upstream errors, clan tags or player data.
  const msg=String(err?.message||"");
  if(["roster_incomplete","roster_unverified","roster_duplicates"].includes(msg))
    return msg;
  if(msg.startsWith(ERROR.api+":"))return apiDiagnostic(err,"roster");
  return "roster_unavailable";
}
function adminSettings(){
  const url=String(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
  const gameKey=Deno.env.get("COC_API_KEY")||"";
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)||
     !key||!gameKey)throw Error(ERROR.config);
  return {url,key,gameKey};
}
async function rest(settings,path,{method="GET",rows=null,conflict=""}={}){
  const params=conflict?"?on_conflict="+encodeURIComponent(conflict):"";
  const headers={
    apikey:settings.key,Authorization:"Bearer "+settings.key,
    Accept:"application/json"
  };
  if(rows!==null){
    headers["Content-Type"]="application/json";
    headers.Prefer="resolution=merge-duplicates,return=minimal";
  }
  let r;
  try{
    r=await fetch(settings.url+"/rest/v1/"+path+params,{
      method,headers,body:rows!==null?JSON.stringify(rows):undefined,
      signal:AbortSignal.timeout(10000)
    });
  }catch{throw Error(ERROR.save)}
  if(!r.ok)throw Error(ERROR.save);
  if(method!=="GET")return null;
  try{return await r.json()}catch{throw Error(ERROR.save)}
}
const upsert=(settings,table,rows,conflict)=>{
  if(!rows.length)return Promise.resolve();
  return rest(settings,table,{method:"POST",rows,conflict});
};
async function saveCollectorHealth(settings,clanId,changes){
  // Preserve the last known successful collection on partial/failed runs.
  // Explicitly merge prior values: PostgREST's missing-columns upsert
  // behavior differs with 'Prefer: missing=default' and schema defaults.
  const rows=await rest(settings,
    "cwl_stat_collector_status?select=*&clan_id=eq."+
    encodeURIComponent(clanId)+"&limit=1");
  await upsert(settings,"cwl_stat_collector_status",[{
    ...(rows[0]||{}),...changes,clan_id:clanId
  }],"clan_id");
}
async function loadLinkedClans(settings){
  // All app tenants are eligible, not just United Fighters. A duplicate
  // Clash tag can belong to multiple independently permissioned app clans.
  const all=[];
  for(let offset=0;offset<5000;offset+=500){
    const rows=await rest(settings,
      "cwl_clans?select=id,clash_tag&order=created_at.asc&offset="+offset+"&limit=500");
    all.push(...rows);
    if(rows.length<500)break;
  }
  const groups=new Map();
  for(const row of all){
    const gameTag=tag(row.clash_tag);
    if(!validTag(gameTag)||!/^[a-f0-9-]{36}$/.test(String(row.id)))continue;
    if(!groups.has(gameTag))groups.set(gameTag,[]);
    groups.get(gameTag).push(row.id);
  }
  return [...groups.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
}
async function loadFullyCapturedLeagueKeys(settings,clanIds){
  let common=null;
  try{
    for(const id of clanIds){
      const rows=await rest(settings,
        "cwl_stat_wars?select=war_key&clan_id=eq."+encodeURIComponent(id)+
        "&war_type=eq.cwl&finalized=eq.true&order=started_at.desc&limit=200");
      const keys=new Set(rows.map(row=>row.war_key));
      common=common===null?keys:new Set([...common].filter(key=>keys.has(key)));
    }
  }catch{
    // Optimisation failure only: re-read from Clash. Never assume a shared
    // completed war or leak another tenant's private stored records.
    return new Set();
  }
  return common||new Set();
}
async function retrieveGames(gameTag,key,deadline,completedLeagueKeys=new Set()){
  const snaps=[],seen=new Set(),notes=[];
  // /currentwar is ephemeral. Keep non-final snapshots until the API
  // actually confirms the war ended; do not invent a completed war.
  try{
    const current=await game("/clans/"+encodeURIComponent(gameTag)+"/currentwar",key);
    if(current&&current.type!=="cwl"&&current.type!=="league"){
      const snapshot=buildWarSnapshot(current,gameTag,{warType:"normal"});
      if(snapshot){snaps.push(snapshot);seen.add(snapshot.war.war_key)}
    }
  }catch(e){notes.push(apiDiagnostic(e,"currentwar"))}
  let group;
  try{group=await game("/clans/"+encodeURIComponent(gameTag)+
    "/currentwar/leaguegroup",key)}
  catch(e){notes.push(apiDiagnostic(e,"leaguegroup"))}
  const seasonObservation=verifiedLeagueObservation(group,gameTag);
  if(group?.rounds&&Array.isArray(group.rounds)){
    const requested=new Set();
    let calls=0;
    for(const round of group.rounds.slice(0,7)){
      if(Date.now()>deadline-10000){notes.push("time_budget_exceeded");break}
      if(hasCapturedCwlRound(round.warTags,completedLeagueKeys))continue;
      const candidates=(Array.isArray(round.warTags)?round.warTags:[])
        .map(tag).filter(validTag).filter(t=>!requested.has(t)).slice(0,4);
      let ours=null,identified=false;
      const roundErrors=[];
      // A league group lists all four match tags, but only one involves
      // this clan. Do not fire four parallel requests after finding ours.
      for(const warTag of candidates){
        if(calls>=MAX_TAGS||Date.now()>deadline-10000){
          roundErrors.push("time_budget_exceeded");break;
        }
        requested.add(warTag);calls++;
        let raw;
        try{raw=await game("/clanwarleagues/wars/"+encodeURIComponent(warTag),key)}
        catch(e){roundErrors.push(apiDiagnostic(e,"leaguewar"));continue}
        if(!raw)continue;
        // Most tags belong to the other six clans; absence of our clan
        // is not a malformed record or an error for the current tenant.
        if(tag(raw.clan?.tag)!==gameTag&&tag(raw.opponent?.tag)!==gameTag)continue;
        identified=true;
        try{ours=buildWarSnapshot(raw,gameTag,{warType:"cwl",warTag})}
        catch(e){roundErrors.push(apiDiagnostic(e,"leaguewar"))}
        break;
      }
      if(ours&&!seen.has(ours.war.war_key)){
        snaps.push(ours);seen.add(ours.war.war_key);
      }
      // If the own match is verified, an earlier inaccessible unrelated
      // match tag does not mean our archive is incomplete.
      if(!identified&&roundErrors.length)notes.push(roundErrors[0]);
      else if(identified&&!ours&&roundErrors.length)
        notes.push(roundErrors[roundErrors.length-1]);
    }
  }
  const leagueStarts=new Set(snaps.filter(x=>x.war.war_type==="cwl")
    .map(x=>x.war.started_at));
  return {snaps:snaps.filter(x=>x.war.war_type==="cwl"||
    !leagueStarts.has(x.war.started_at)),notes,seasonObservation};
}
async function archiveForAppClan(settings,clanId,snapshots,checkedAt,partialError=null){
  const unique=new Map(snapshots.map(s=>[s.war.war_key,s]));
  let warCount=0,attacksCount=0,finalCount=0;
  for(const snapshot of unique.values()){
    const key=snapshot.war.war_key;
    // Never replace a finalized record with a later cached "inWar" snapshot.
    const prior=await rest(settings,"cwl_stat_wars?select=finalized&clan_id=eq."+
      encodeURIComponent(clanId)+"&war_key=eq."+encodeURIComponent(key)+"&limit=1");
    const alreadyFinal=prior.some(row=>row.finalized===true);
    if(!alreadyFinal){
      await upsert(settings,"cwl_stat_wars",[
        {...snapshot.war,clan_id:clanId,finalized:false}
      ],"clan_id,war_key");
    }
    const attacks=snapshot.attacks.map(a=>({...a,clan_id:clanId}));
    for(let i=0;i<attacks.length;i+=80)
      await upsert(settings,"cwl_stat_attacks",attacks.slice(i,i+80),
        "clan_id,war_key,attacker_tag,attack_order");
    if(snapshot.war.finalized&&!alreadyFinal){
      // Persist confirmed misses BEFORE marking a war finalized/complete.
      // An interrupted write leaves a staged war for a safe retry.
      const completeMissed= snapshot.war.missed_log_complete===true&&
        Array.isArray(snapshot.missed);
      if(completeMissed&&snapshot.missed.length){
        for(let i=0;i<snapshot.missed.length;i+=80)
          await upsert(settings,"cwl_stat_missed",
            snapshot.missed.slice(i,i+80).map(m=>({...m,clan_id:clanId})),
            "clan_id,war_key,player_tag");
      }
      await upsert(settings,"cwl_stat_wars",[
        {...snapshot.war,clan_id:clanId,finalized:true,
          missed_log_complete:completeMissed}
      ],"clan_id,war_key");
    }
    warCount++;attacksCount+=attacks.length;
    if(snapshot.war.finalized)finalCount++;
  }
  await saveCollectorHealth(settings,clanId,{
    last_checked_at:checkedAt,
    ...(partialError?{}:{last_success_at:new Date().toISOString()}),
    last_error:partialError,observed_wars:warCount,observed_attacks:attacksCount,
    observed_final_wars:finalCount
  });
  return {warCount,attacksCount,finalCount};
}
async function markFailure(settings,clanId,checkedAt,code){
  // Preserve last_success_at and prior totals on failures; do not claim data freshness.
  try{
    await saveCollectorHealth(settings,clanId,{
      last_checked_at:checkedAt,last_error:String(code).slice(0,80)
    });
  }catch{/* Best-effort monitoring cannot leak tenant data or block others. */}
}
export default {
  fetch:async request=>{
    if(request.method!=="POST")return response({ok:false,error:"method_not_allowed"},405);
    // Two independent fail-closed identities. A request carrying Cron headers
    // can NEVER downgrade to GitHub OIDC, or combine credentials.
    let settings;
    if(hasCronHeaders(request)){
      // Reject malformed, stale, future, or mixed-header calls before
      // consulting privileged environment variables or database RPC.
      if(!validCronHeaderShape(request))
        return response({ok:false,error:"unauthorized"},401);
      try{settings=adminSettings()}catch{return response({ok:false,error:ERROR.config},503)}
      if(!await verifyIndependentCron(request,settings))
        return response({ok:false,error:"unauthorized"},401);
      console.info("collector_verified_trigger=internal_cron");
    }else{
      // GitHub's short-lived JWT is verified against its real issuer's JWKS
      // and exact immutable workflow/repository identity (unchanged).
      const match=/^Bearer ([-_a-zA-Z0-9.]+)$/.exec(request.headers.get("authorization")||"");
      if(!match||!await verifyCollectorIdentity(match[1]))
        return response({ok:false,error:"unauthorized"},401);
      try{settings=adminSettings()}catch{return response({ok:false,error:ERROR.config},503)}
    }
    // Code stays dormant by default. Only an operator-configured per-clan
    // allowlist AND explicit mode='apply' can ever call the mutation RPC.
    // This value comes from server-side secrets, never request JSON/headers.
    const policy=ownerlessRolloverPolicy(
      Deno.env.get("CWL_OWNERLESS_ROLLOVER_MODE"),
      Deno.env.get("CWL_OWNERLESS_ROLLOVER_CLAN_IDS"));
    const started=Date.now(),deadline=started+PER_RUN_BUDGET_MS;
    let groups;
    try{groups=await loadLinkedClans(settings)}
    catch{return response({ok:false,error:ERROR.save},503)}
    const count=Math.max(1,Math.ceil(groups.length/MAX_CLANS_PER_RUN));
    const part=Math.floor(started/7200000)%count;
    const selected=groups.slice(part*MAX_CLANS_PER_RUN,(part+1)*MAX_CLANS_PER_RUN);
    let processed=0,errors=0,observedWars=0,observedAttacks=0,completed=0;
    let tenureObservedProfiles=0,tenureSkippedProfiles=0,tenureWriteErrors=0;
    let seasonObservationsSaved=0,seasonObservationWriteErrors=0;
    let rolloverChecked=0,rolloverCandidates=0,rolloverApplied=0;
    let rolloverAlreadyApplied=0,rolloverSkipped=0,rolloverErrors=0;
    const rosterFailureClasses={};
    for(const [gameTag,clanIds] of selected){
      if(Date.now()>deadline-15000){errors++;break}
      const checkedAt=new Date().toISOString();
      // A full roster is independent of wars. A missed / partial API response
      // never becomes an absence observation or retroactive membership credit.
      let observedDetails=null,rosterError="time_budget_exceeded";
      if(Date.now()<deadline-15000){
        try{
          observedDetails=rosterEvidence(await game(
            "/clans/"+encodeURIComponent(gameTag)+"/members?limit=50",
            settings.gameKey));
        }catch(e){rosterError=rosterDiagnostic(e)}
      }
      if(!observedDetails){
        tenureSkippedProfiles+=clanIds.length;
        rosterFailureClasses[rosterError]=(rosterFailureClasses[rosterError]||0)+clanIds.length;
      }
      let scan;
      const capturedKeys=await loadFullyCapturedLeagueKeys(settings,clanIds);
      try{scan=await retrieveGames(gameTag,settings.gameKey,deadline,capturedKeys)}
      catch{scan={snaps:[],notes:[ERROR.api]}}
      for(const id of clanIds){
        try{
          const result=await archiveForAppClan(settings,id,scan.snaps,checkedAt,
            scan.notes[0]||null);
          observedWars+=result.warCount;observedAttacks+=result.attacksCount;
          completed+=result.finalCount;processed++;
          // Only service-verified linked tenants receive an official group
          // observation. Nothing here advances/replaces any saved plan.
          if(scan.seasonObservation){
            let evidenceSaved=false;
            try{
              await upsert(settings,"cwl_verified_league_observations",[
                {clan_id:id,...scan.seasonObservation}
              ],"clan_id,season");
              seasonObservationsSaved++;
              evidenceSaved=true;
            }catch{seasonObservationWriteErrors++}
            // Never call preflight or mutation unless THIS app clan's
            // official observation was saved by THIS verified run.
            // A leaguegroup-only response is not permission to advance.
            if(policy.mode!=="off"&&evidenceSaved){
              try{
                const outcome=await attemptOwnerlessRollover({
                  policy,settings,clanId:id,linkedTag:gameTag,
                  observation:scan.seasonObservation,evidenceSaved,
                  deadline
                });
                if(outcome.status==="candidate")rolloverCandidates++;
                else if(outcome.status==="applied")rolloverApplied++;
                else if(outcome.status==="already_applied")rolloverAlreadyApplied++;
                else rolloverSkipped++;
                if(!["off","not_allowed","no_evidence","time_budget"].includes(outcome.status))
                  rolloverChecked++;
              }catch{rolloverErrors++}
            }
          }
          if(scan.notes.length)errors++;
          if(observedDetails){
            try{
              await rest(settings,"rpc/cwl_observe_clan_roster_evidence",{
                method:"POST",rows:{p_clan:id,p_clash_tag:gameTag,p_members:observedDetails}
              });
              tenureObservedProfiles++;
            }catch{tenureWriteErrors++}
          }
        }catch(e){
          errors++;
          await markFailure(settings,id,checkedAt,
            e?.message==="time_budget_exceeded"?"time_budget_exceeded":
              e?.message===ERROR.save?ERROR.save:ERROR.api);
        }
      }
    }
    // No tags, player identities, API keys or raw war data in logs/response.
    return response({
      ok:errors===0&&tenureWriteErrors===0&&tenureSkippedProfiles===0&&
        seasonObservationWriteErrors===0&&rolloverErrors===0,
      tenantProfiles:processed,failedProfiles:errors,
      observedWars,observedAttacks,observedEndedWars:completed,
      tenureObservedProfiles,tenureSkippedProfiles,tenureWriteErrors,
      rosterFailureClasses,seasonObservationsSaved,seasonObservationWriteErrors,
      rolloverMode:policy.mode,
      rolloverChecked,rolloverCandidates,rolloverApplied,
      rolloverAlreadyApplied,rolloverSkipped,rolloverErrors,
      moreBatches:count>1,scheduledBatch:part+1,batches:count
    },errors||tenureWriteErrors||tenureSkippedProfiles||
      seasonObservationWriteErrors||rolloverErrors?503:200);
  }
};
