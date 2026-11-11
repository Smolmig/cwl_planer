// Authenticated, read-only CWL status proxy. Supercell key never reaches the browser.
import { withSupabase } from "npm:@supabase/server@1";

const CORS = {
  "Access-Control-Allow-Origin":"https://smolmig.github.io",
  "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Cache-Control":"no-store", "Vary":"Origin"
};
const CACHE = new Map();
const WAR_CACHE = new Map();
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const fail=(error,status=502)=>Response.json({ok:false,error},{status,headers:CORS});
const tag=v=>{const t=String(v||"").trim().toUpperCase();return t.startsWith("#")?t:t?"#"+t:""};
const valid=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const safeMember=m=>({
  tag:tag(m?.tag),name:String(m?.name||"").slice(0,80),
  townHallLevel:Number.isInteger(m?.townhallLevel)?m.townhallLevel:
    Number.isInteger(m?.townHallLevel)?m.townHallLevel:null,
  mapPosition:Number.isInteger(m?.mapPosition)&&m.mapPosition>=1&&
    m.mapPosition<=50?m.mapPosition:null,
  attacks:(Array.isArray(m?.attacks)?m.attacks:[]).slice(0,4).map(a=>({
    attackerTag:tag(a?.attackerTag),defenderTag:tag(a?.defenderTag),
    stars:Number.isInteger(a?.stars)&&a.stars>=0&&a.stars<=3?a.stars:null,
    destructionPercentage:typeof a?.destructionPercentage==="number"&&
      Number.isFinite(a.destructionPercentage)&&a.destructionPercentage>=0&&
      a.destructionPercentage<=100?a.destructionPercentage:null,
    order:Number.isInteger(a?.order)&&a.order>=1&&a.order<=500?a.order:null
  }))
});
// Official CWL war fields: war stars are *not* the sum of all attacks.
const safeStars=value=>Number.isInteger(value)&&value>=0&&value<=150?value:null;
const safeDestruction=value=>typeof value==="number"&&Number.isFinite(value)&&value>=0&&value<=100
  ?Math.round(value*100)/100:null;
// Restrict external artwork to the official Clash asset host.
const safeBadge=raw=>{
  for(const size of ["medium","small","large"]){
    const value=raw?.[size];
    if(typeof value!=="string")continue;
    try{
      const url=new URL(value);
      if(url.protocol==="https:"&&url.hostname==="api-assets.clashofclans.com"&&
         url.pathname.startsWith("/badges/")&&url.username===""&&url.password==="")
        return url.href;
    }catch{/* Malformed URLs are ignored. */}
  }
  return null;
};
const safeSide=(s,fromGroup)=>({
  tag:tag(s?.tag),name:String(s?.name||"").slice(0,80),
  stars:safeStars(s?.stars),
  destructionPercentage:safeDestruction(s?.destructionPercentage),
  badgeUrl:safeBadge(s?.badgeUrls)||safeBadge(fromGroup?.badgeUrls),
  members:(Array.isArray(s?.members)?s.members:[]).slice(0,50).map(safeMember)
});
async function getGame(path,key) {
  // Retry transient gateway/rate-limit errors once, without retrying authorization errors.
  for(let attempt=0;attempt<2;attempt++){
    let response;
    try{
      response=await fetch("https://cocproxy.royaleapi.dev/v1"+path,{
        headers:{Authorization:"Bearer "+key,Accept:"application/json"},
        signal:AbortSignal.timeout(12000)
      });
    }catch(error){
      if(attempt===0){await pause(350);continue}
      throw error;
    }
    if(response.status===404)return null;
    if(!response.ok){
      if(attempt===0 && (response.status===429||response.status>=500)){
        await pause(response.status===429?900:350);
        continue;
      }
      throw Error("supercell_status_"+response.status);
    }
    return response.json();
  }
  throw Error("upstream_unreachable");
}
async function getWar(tagValue,key){
  const cached=WAR_CACHE.get(tagValue);
  if(cached&&Date.now()<cached.expires)return cached.war;
  const war=await getGame("/clanwarleagues/wars/"+encodeURIComponent(tagValue),key);
  const ttl=war?.state==="warEnded"?12*3600000:war?.state==="preparation"?120000:war?60000:30000;
  WAR_CACHE.set(tagValue,{war,expires:Date.now()+ttl});
  if(WAR_CACHE.size>100)for(const [t,v] of WAR_CACHE)if(v.expires<Date.now())WAR_CACHE.delete(t);
  return war;
}
async function currentNormalWar(clanTag,key) {
  try{
    const war=await getGame("/clans/"+encodeURIComponent(clanTag)+"/currentwar",key);
    if(!war || !["preparation","inWar","warEnded"].includes(war.state) ||
       !Number.isInteger(war.teamSize) || war.teamSize<1 || war.teamSize>50)return null;
    const our=tag(war.clan?.tag)===clanTag?war.clan:
      tag(war.opponent?.tag)===clanTag?war.opponent:null;
    const enemy=our===war.clan?war.opponent:war.clan;
    if(!our || !enemy)return null;
    return {state:war.state,teamSize:war.teamSize,
      attacksPerMember:Number.isInteger(war.attacksPerMember)?war.attacksPerMember:2,
      preparationStartTime:String(war.preparationStartTime||""),
      startTime:String(war.startTime||""),endTime:String(war.endTime||""),
      clan:safeSide(our),opponent:safeSide(enemy)};
  }catch{return null} // Optional statistics endpoint: never prevent CWL planning.
}
async function loadStatus(clanTag,key) {
  const group=await getGame("/clans/"+encodeURIComponent(clanTag)+"/currentwar/leaguegroup",key);
  if(!group || group.state==="notInWar")return {
    ok:true,active:false,groupState:"notInWar",clanTag,rounds:[],
    currentWar:await currentNormalWar(clanTag,key)
  };
  // Supercell currently returns a full date (e.g. 2026-11-02) for the
  // CWL season. The frontend and saved snapshots use the YYYY-MM month.
  const rawSeason=String(group.season||"").trim();
  const seasonMatch=/^(\d{4}-(?:0[1-9]|1[0-2]))(?:-(?:0[1-9]|[12]\d|3[01]))?$/.exec(rawSeason);
  const season=seasonMatch?.[1]||"";
  const groupState=String(group.state||"");
  const validSeason=!!seasonMatch;
  const validState=["preparation","inWar","ended"].includes(groupState);
  if(!validSeason||!Array.isArray(group.rounds)){
    // The official API can expose a league-group shell before the draw is
    // complete. A recognized group without rounds is not a network failure.
    console.warn("coc-cwl-status: incomplete league group",{
      state:groupState.slice(0,30),season:rawSeason.slice(0,20),
      roundsType:Array.isArray(group.rounds)?"array":typeof group.rounds,
      fields:Object.keys(group).slice(0,12)
    });
    if(validState&&validSeason&&group.rounds==null)
      group.rounds=[]; // Matchups have not yet been assigned.
    else if(validState&&!validSeason)
      return {ok:true,active:false,pending:true,clanTag,rounds:[]};
    else throw Error("unexpected_group_response");
  }
  // CWL wars contain both clans; the requested clan is not always in the "clan" field.
  const groupClans=new Map((Array.isArray(group.clans)?group.clans:[])
    .filter(clan=>valid(tag(clan?.tag)))
    .map(clan=>[tag(clan.tag),clan]));
  const rawRounds=group.rounds.slice(0,7);
  const tags=[...new Set(rawRounds.flatMap(r=>Array.isArray(r?.warTags)?r.warTags:[])
    .map(tag).filter(t=>valid(t)))].slice(0,32);
  const results=new Map();
  let success=0,failures=0;
  const failedByCode={};
  // Preserve the accessible league group even if individual war detail requests fail.
  // No missing round may ever be treated as a finished war by the planner.
  for(let i=0;i<tags.length;i+=4) {
    const batch=await Promise.all(tags.slice(i,i+4).map(async t=>{
      try{return {tag:t,war:await getWar(t,key)}}
      catch(error){return {tag:t,war:null,error:String(error?.message||"upstream_unreachable")}}
    }));
    for(const b of batch){
      results.set(b.tag,b.war);
      if(b.war)success++;
      if(b.error){failures++;failedByCode[b.error]=(failedByCode[b.error]||0)+1}
    }
  }
  if(failures)console.warn("coc-cwl-status: war details incomplete",{
    requested:tags.length,available:success,failed:failures,codes:failedByCode
  });
  // Every group's war was already fetched above for our own-war discovery.
  // Return only compact team summaries for other pairings: never player rosters,
  // raw API objects, or extra requests from the client.
  const groupSummary={
    season,clanTag,
    clans:[...groupClans.entries()].slice(0,8).map(([t,clan])=>({
      tag:t,name:String(clan?.name||"Unbekannt").slice(0,80),
      badgeUrl:safeBadge(clan?.badgeUrls)
    })),
    rounds:rawRounds.map((round,index)=>({
      day:index+1,
      matches:(Array.isArray(round?.warTags)?round.warTags:[]).slice(0,4).map(value=>{
        const warTag=tag(value),war=valid(warTag)?results.get(warTag):null;
        const state=String(war?.state||"");
        const aTag=tag(war?.clan?.tag),bTag=tag(war?.opponent?.tag);
        if(!war||!["preparation","inWar","warEnded"].includes(state)||
           !groupClans.has(aTag)||!groupClans.has(bTag)||aTag===bTag)
          return {available:false};
        const showScore=state!=="preparation";
        const side=side=>{
          const info=groupClans.get(tag(side?.tag));
          const members=Array.isArray(side?.members)?side.members:[];
          return {tag:tag(side.tag),name:String(side?.name||info?.name||"Unbekannt").slice(0,80),
            badgeUrl:safeBadge(side?.badgeUrls)||safeBadge(info?.badgeUrls),
            stars:showScore?safeStars(side?.stars):null,
            destructionPercentage:showScore?safeDestruction(side?.destructionPercentage):null,
            attacks:showScore?members.reduce((n,m)=>n+(Array.isArray(m?.attacks)?m.attacks.length:0),0):null};
        };
        return {available:true,warTag,state,
          teamSize:Number.isInteger(war.teamSize)?war.teamSize:null,
          clan:side(war.clan),opponent:side(war.opponent)};
      })
    }))
  };
  const rounds=rawRounds.map((r,index)=>{
    const t=(Array.isArray(r?.warTags)?r.warTags:[]).map(tag).filter(valid);
    let match=null,warTag="";
    for(const item of t) {
      const war=results.get(item);
      if(war && (tag(war.clan?.tag)===clanTag || tag(war.opponent?.tag)===clanTag)) {
        match=war;warTag=item;break;
      }
    }
    if(!match)return {day:index+1,available:false};
    const our=tag(match.clan?.tag)===clanTag?match.clan:match.opponent;
    const enemy=tag(match.clan?.tag)===clanTag?match.opponent:match.clan;
    return {day:index+1,available:true,warTag,
      state:String(match.state||""),teamSize:match.teamSize,
      startTime:String(match.startTime||""),endTime:String(match.endTime||""),
      clan:safeSide(our,groupClans.get(tag(our?.tag))),
      opponent:safeSide(enemy,groupClans.get(tag(enemy?.tag)))};
  });
  while(rounds.length<7)rounds.push({day:rounds.length+1,available:false});
  return {ok:true,active:true,season,clanTag,rounds,group:groupSummary,
    groupState, // league lifecycle is distinct from each war's warEnded state
    currentWar:groupState==="ended"?await currentNormalWar(clanTag,key):null,
    detailsStatus:failures?(success?"partial":"unavailable"):tags.length?"complete":"not_released"};
}
// After the official CWL leaguegroup drops to notInWar, safely revisit the
// last *previously observed* day-seven official war tag for this app clan.
// This can repair 6/7 only if Supercell STILL exposes a final real war.
// No backfilling from import, guessed day, a different app clan or old months.
async function recoverFinalRound(clanId,clanTag,key,ctx) {
  try{
    const {data:record,error}=await ctx.supabase.from("cwl_own_lineup_archives")
      .select("season,day,war_tag,team_size,state")
      .eq("clan_id",clanId).eq("day",7)
      .order("season",{ascending:false}).limit(1);
    if(error||!Array.isArray(record)||!record.length)return null;
    const prior=record[0],warTag=tag(prior.war_tag);
    const date=/^(20[0-9]{2})-(0[1-9]|1[0-2])$/.exec(String(prior.season||""));
    if(!date||!valid(warTag)||prior.day!==7||
      !["inWar","warEnded"].includes(prior.state)||
      !Number.isInteger(prior.team_size)||
      prior.team_size<5||prior.team_size>50)return null;
    const utc=new Date(),distance=
      (utc.getUTCFullYear()-Number(date[1]))*12+
      utc.getUTCMonth()+1-Number(date[2]);
    if(distance<0||distance>1)return null;
    const war=await getWar(warTag,key);
    if(war?.state!=="warEnded"||war.teamSize!==prior.team_size)return null;
    const own=tag(war.clan?.tag)===clanTag?war.clan:
      tag(war.opponent?.tag)===clanTag?war.opponent:null;
    const enemy=own===war.clan?war.opponent:war.clan;
    if(!own||!enemy||!valid(tag(enemy.tag)))return null;
    const rosterOkay=side=>{
      const players=side?.members;
      if(!Array.isArray(players)||players.length!==prior.team_size)return false;
      const tags=players.map(m=>tag(m?.tag));
      return tags.every(valid)&&new Set(tags).size===prior.team_size;
    };
    if(!rosterOkay(own)||!rosterOkay(enemy))return null;
    const match=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(?:\.\d+)?Z$/
      .exec(String(war.endTime||""));
    if(!match)return null;
    const ended=Date.UTC(Number(match[1]),Number(match[2])-1,Number(match[3]),
      Number(match[4]),Number(match[5]),Number(match[6]));
    if(!Number.isFinite(ended)||ended>Date.now()-60000||
       ended<Date.now()-45*86400000)return null;
    const round={day:7,available:true,warTag,state:"warEnded",
      startTime:String(war.startTime||""),endTime:String(war.endTime||""),
      teamSize:prior.team_size,clan:safeSide(own),opponent:safeSide(enemy)};
    // The group archive is an existing RLS-checked same-tenant read.
    let group=null;
    const {data:savedGroup,error:groupError}=await ctx.supabase
      .from("cwl_group_archives").select("group_json")
      .eq("clan_id",clanId).eq("season",prior.season).maybeSingle();
    if(!groupError&&savedGroup?.group_json?.season===prior.season&&
       tag(savedGroup.group_json.clanTag)===clanTag&&
       Array.isArray(savedGroup.group_json.rounds)&&
       Array.isArray(savedGroup.group_json.clans))
      group=savedGroup.group_json;
    return {ok:true,active:true,recoveredFinalRound:true,
      groupState:"ended",season:prior.season,clanTag,
      detailsStatus:"partial",group,
      rounds:Array.from({length:7},(_,i)=>
       i===6?round:{day:i+1,available:false})};
  }catch(e){
    console.warn("coc-cwl-status: final-round recovery unavailable",{
      code:String(e?.message||"unavailable").slice(0,80)
    });
    return null;
  }
}

// Archive only sanitized group data after the same authenticated clan membership
// check as the live status. Supabase service credentials never reach the browser.
async function saveGroupArchive(clanId,group) {
  if(!group||!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(String(group.season||""))||
     !valid(tag(group.clanTag))||!Array.isArray(group.clans)||group.clans.length<2||
     !Array.isArray(group.rounds)||group.rounds.length>7)return;
  const url=String(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key){console.warn("coc-cwl-status: group archive unavailable (missing server configuration)");return}
  const payload={clan_id:clanId,season:group.season,clan_tag:group.clanTag,group_json:group};
  const response=await fetch(url+"/rest/v1/cwl_group_archives?on_conflict=clan_id,season",{
    method:"POST",
    headers:{"apikey":key,"Authorization":"Bearer "+key,
      "Content-Type":"application/json","Prefer":"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(payload),
    signal:AbortSignal.timeout(2500)
  });
  if(!response.ok)console.warn("coc-cwl-status: group archive save unavailable",{status:response.status});
}

// Store *our own* actual CWL lineups once war has started. No preparation
// rosters or opponent members are archived. The table is browser read-only.
async function saveOwnLineups(clanId,status) {
  if(!status?.active||!/^20[0-9]{2}-(0[1-9]|1[0-2])$/.test(String(status.season||""))||
     !valid(tag(status.clanTag)))return;
  const rows=[];
  for(const round of (Array.isArray(status.rounds)?status.rounds:[]).slice(0,7)){
    if(!round?.available||!["inWar","warEnded"].includes(round.state)||
       !Number.isInteger(round.day)||round.day<1||round.day>7||
       !valid(tag(round.warTag))||!Number.isInteger(round.teamSize)||
       round.teamSize<1||round.teamSize>50||tag(round.clan?.tag)!==tag(status.clanTag))continue;
    const members=Array.isArray(round.clan?.members)?round.clan.members:[];
    if(members.length!==round.teamSize||members.some(m=>!valid(tag(m?.tag))))continue;
    rows.push({
      clan_id:clanId,season:status.season,day:round.day,
      war_tag:tag(round.warTag),state:round.state,team_size:round.teamSize,
      lineup_json:{members:members.map(m=>({
        tag:tag(m.tag),name:String(m.name||m.tag).slice(0,80),
        townHallLevel:Number.isInteger(m.townHallLevel)?m.townHallLevel:null,
        attacks:(Array.isArray(m.attacks)?m.attacks:[]).slice(0,4)
          .filter(a=>Number.isInteger(a?.stars)&&a.stars>=0&&a.stars<=3)
          .map(a=>({stars:a.stars,destructionPercentage:safeDestruction(a.destructionPercentage)}))
      }))}
    });
  }
  if(!rows.length)return;
  const url=String(Deno.env.get("SUPABASE_URL")||"").replace(/\/+$/,"");
  const key=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!key){console.warn("coc-cwl-status: lineup archive unavailable (missing server configuration)");return}
  const response=await fetch(url+"/rest/v1/cwl_own_lineup_archives?on_conflict=clan_id,season,day",{
    method:"POST",
    headers:{"apikey":key,"Authorization":"Bearer "+key,"Content-Type":"application/json",
      "Prefer":"resolution=merge-duplicates,return=minimal"},
    body:JSON.stringify(rows),
    signal:AbortSignal.timeout(2500)
  });
  if(!response.ok)console.warn("coc-cwl-status: own lineup archive save unavailable",{status:response.status});
}

const handler=withSupabase({auth:"user"},async(req,ctx)=>{
  if(req.method!=="POST")return fail("method_not_allowed",405);
  let body;
  try{body=await req.json()}catch{return fail("invalid_body",400)}
  const clanId=String(body?.clanId||"");
  if(!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/.test(clanId))return fail("invalid_clan",400);
  const {data:membership,error:memErr}=await ctx.supabase.from("cwl_clan_memberships")
    .select("role").eq("clan_id",clanId).eq("user_id",ctx.userClaims.id).maybeSingle();
  if(memErr||!membership||!["owner","editor","viewer"].includes(membership.role))
    return fail("not_a_member",403);
  const {data:clan,error:clanErr}=await ctx.supabase.from("cwl_clans")
    .select("clash_tag").eq("id",clanId).single();
  const clanTag=tag(clan?.clash_tag);
  if(clanErr||!valid(clanTag))return fail("missing_linked_clan_tag",400);
  const key=Deno.env.get("COC_API_KEY");
  if(!key)return fail("missing_server_configuration",503);
  const prior=CACHE.get(clanId);
  if(prior&&prior.tag===clanTag&&Date.now()-prior.time<120000)
    return Response.json(prior.body,{headers:CORS});
  try{
    const observed=await loadStatus(clanTag,key);
    // No inference from notInWar: the official final war endpoint must give
    // full-ended war details to recover a previously known day-seven tag.
    const recovered=!observed.active&&!observed.pending?
      await recoverFinalRound(clanId,clanTag,key,ctx):null;
    const response=recovered?
      {...recovered,currentWar:observed.currentWar||null}:observed;
    // Archiving is best-effort and never blocks CWL planning on storage errors.
    if(response.active){
      await Promise.allSettled([
        response.group?saveGroupArchive(clanId,response.group):Promise.resolve(),
        saveOwnLineups(clanId,response)
      ]); // Archive writes are optional; planning must never fail with them.
    }
    CACHE.set(clanId,{time:Date.now(),tag:clanTag,body:response});
    return Response.json(response,{headers:CORS});
  }catch(e){
    const reason=String(e?.message||"upstream_unreachable");
    console.warn("coc-cwl-status: group fetch failed",{reason,errorType:String(e?.name||"Error")});
    return fail(/^supercell_status_\d+$/.test(reason)?reason:
      reason==="war_details_unavailable"||reason==="unexpected_group_response"?reason:
      e?.name==="TimeoutError"?"upstream_timeout":"upstream_unreachable");
  }
});
export default {fetch:(req,...args)=>req.method==="OPTIONS"
  ?new Response("ok",{headers:CORS}):handler(req,...args)};
