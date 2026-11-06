// Secure scheduled collection for every explicitly linked Clash clan.
// Runs without any browser sessions; writes only clan-scoped stat tables.
import {verifyCollectorIdentity} from "./collector-auth.mjs";
import {tag,validTag,buildWarSnapshot,hasCapturedCwlRound} from "./collector-core.mjs";

const GAME="https://cocproxy.royaleapi.dev/v1";
const MAX_TAGS=32,MAX_CLANS_PER_RUN=5,PER_RUN_BUDGET_MS=105000;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ERROR={api: "clash_api_unavailable",save:"stats_storage_unavailable",
  invalid:"war_data_incomplete",config:"server_not_configured"};
function response(body,status=200){
  return Response.json(body,{status,headers:{"Cache-Control":"no-store"}});
}
async function game(path,apiKey) {
  for(let attempt=0;attempt<2;attempt++){
    let r;
    try{
      r=await fetch(GAME+path,{
        headers:{"Authorization":"Bearer "+apiKey,"Accept":"application/json"},
        signal:AbortSignal.timeout(8000)
      });
    }catch{
      if(attempt===0){await delay(400);continue}
      throw Error(ERROR.api);
    }
    if(r.status===404)return null;
    if(!r.ok){
      if(attempt===0&&(r.status===429||r.status>=500)){
        await delay(r.status===429?1000:400);continue;
      }
      throw Error(ERROR.api);
    }
    try{return await r.json()}catch{throw Error(ERROR.invalid)}
  }
  throw Error(ERROR.api);
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
  // /currentwar is ephemeral; capture live snapshots to retain an incomplete
  // record if the endpoint later disappears. Only warEnded is final/statistical.
  try{
    const current=await game("/clans/"+encodeURIComponent(gameTag)+"/currentwar",key);
    if(current&&current.type!=="cwl"&&current.type!=="league"){
      const snapshot=buildWarSnapshot(current,gameTag,{warType:"normal"});
      if(snapshot){snaps.push(snapshot);seen.add(snapshot.war.war_key)}
    }
  }catch{notes.push(ERROR.api)}
  // League war tags can remain available after each day. Poll every own
  // round while the league group endpoint still provides its WarTags.
  let group;
  try{group=await game("/clans/"+encodeURIComponent(gameTag)+
    "/currentwar/leaguegroup",key);
  }catch{notes.push(ERROR.api)}
  if(group?.rounds&&Array.isArray(group.rounds)){
    const requested=new Set();
    for(const round of group.rounds.slice(0,7)){
      if(Date.now()>deadline-10000){notes.push("time_budget_exceeded");break}
      if(hasCapturedCwlRound(round.warTags,completedLeagueKeys))continue;
      const candidates=(Array.isArray(round.warTags)?round.warTags:[])
        .map(tag).filter(validTag).filter(t=>!requested.has(t)).slice(0,4);
      if(requested.size+candidates.length>MAX_TAGS)break;
      candidates.forEach(t=>requested.add(t));
      const found=await Promise.all(candidates.map(async warTag=>{
        try{
          const raw=await game("/clanwarleagues/wars/"+encodeURIComponent(warTag),key);
          return buildWarSnapshot(raw,gameTag,{warType:"cwl",warTag});
        }catch{notes.push(ERROR.api);return null}
      }));
      const ours=found.find(Boolean);
      if(ours&&!seen.has(ours.war.war_key)){
        snaps.push(ours);seen.add(ours.war.war_key);
      }
    }
  }
  // Some CoC endpoints expose a league war via /currentwar as well.
  // The same game must never appear under both 'normal' and 'cwl' keys.
  const leagueStarts=new Set(snaps.filter(x=>x.war.war_type==="cwl")
    .map(x=>x.war.started_at));
  return {snaps:snaps.filter(x=>x.war.war_type==="cwl"||
    !leagueStarts.has(x.war.started_at)),notes};
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
      await upsert(settings,"cwl_stat_wars",[
        {...snapshot.war,clan_id:clanId,finalized:true}
      ],"clan_id,war_key");
    }
    warCount++;attacksCount+=attacks.length;
    if(snapshot.war.finalized)finalCount++;
  }
  await upsert(settings,"cwl_stat_collector_status",[{
    clan_id:clanId,last_checked_at:checkedAt,
    ...(partialError?{}:{last_success_at:new Date().toISOString()}),
    last_error:partialError,observed_wars:warCount,observed_attacks:attacksCount,
    observed_final_wars:finalCount
  }],"clan_id");
  return {warCount,attacksCount,finalCount};
}
async function markFailure(settings,clanId,checkedAt,code){
  // Preserve last_success_at and prior totals on failures; do not claim data freshness.
  try{
    await upsert(settings,"cwl_stat_collector_status",[
      {clan_id:clanId,last_checked_at:checkedAt,last_error:String(code).slice(0,80)}
    ],"clan_id");
  }catch{/* Best-effort monitoring cannot leak tenant data or block others. */}
}
export default {
  fetch:async request=>{
    if(request.method!=="POST")return response({ok:false,error:"method_not_allowed"},405);
    // The GitHub token is verified against its real issuer's JWKS, *not*
    // merely base64-decoded. Workflow, repo ID, branch, event and audience
    // must ALL match. Never log or forward this short-lived credential.
    const match=/^Bearer ([-_a-zA-Z0-9.]+)$/.exec(request.headers.get("authorization")||"");
    if(!match||!await verifyCollectorIdentity(match[1]))
      return response({ok:false,error:"unauthorized"},401);
    let settings;
    try{settings=adminSettings()}catch{return response({ok:false,error:ERROR.config},503)}
    const started=Date.now(),deadline=started+PER_RUN_BUDGET_MS;
    let groups;
    try{groups=await loadLinkedClans(settings)}
    catch{return response({ok:false,error:ERROR.save},503)}
    const count=Math.max(1,Math.ceil(groups.length/MAX_CLANS_PER_RUN));
    const part=Math.floor(started/7200000)%count;
    const selected=groups.slice(part*MAX_CLANS_PER_RUN,(part+1)*MAX_CLANS_PER_RUN);
    let processed=0,errors=0,observedWars=0,observedAttacks=0,completed=0;
    for(const [gameTag,clanIds] of selected){
      if(Date.now()>deadline-15000){errors++;break}
      const checkedAt=new Date().toISOString();
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
          if(scan.notes.length)errors++;
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
      ok:errors===0,tenantProfiles:processed,failedProfiles:errors,
      observedWars,observedAttacks,observedEndedWars:completed,
      moreBatches:count>1,scheduledBatch:part+1,batches:count
    },errors?503:200);
  }
};
