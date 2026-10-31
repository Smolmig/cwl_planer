// Authenticated, read-only CWL status proxy. Supercell key never reaches the browser.
import { withSupabase } from "npm:@supabase/server@1";

const CORS = {
  "Access-Control-Allow-Origin":"https://smolmig.github.io",
  "Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
  "Cache-Control":"no-store", "Vary":"Origin"
};
const CACHE = new Map();
const fail=(error,status=502)=>Response.json({ok:false,error},{status,headers:CORS});
const tag=v=>{const t=String(v||"").trim().toUpperCase();return t.startsWith("#")?t:t?"#"+t:""};
const valid=t=>/^#[0289PYLQGRJCUV]{3,15}$/.test(t);
const safeMember=m=>({
  tag:tag(m?.tag),name:String(m?.name||"").slice(0,80),
  townHallLevel:Number.isInteger(m?.townhallLevel)?m.townhallLevel:
    Number.isInteger(m?.townHallLevel)?m.townHallLevel:null,
  attacks:(Array.isArray(m?.attacks)?m.attacks:[]).slice(0,4).map(a=>({
    attackerTag:tag(a?.attackerTag),defenderTag:tag(a?.defenderTag),
    stars:a?.stars,destructionPercentage:a?.destructionPercentage
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
  const r=await fetch("https://cocproxy.royaleapi.dev/v1"+path,{
    headers:{Authorization:"Bearer "+key,Accept:"application/json"},
    signal:AbortSignal.timeout(12000)
  });
  if(r.status===404) return null;
  if(!r.ok)throw Error("supercell_status_"+r.status);
  return r.json();
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
    ok:true,active:false,clanTag,rounds:[],currentWar:await currentNormalWar(clanTag,key)
  };
  const season=String(group.season||"");
  if(!/^\d{4}-\d{2}$/.test(season)||!Array.isArray(group.rounds))
    throw Error("unexpected_group_response");
  // CWL wars contain both clans; the requested clan is not always in the "clan" field.
  const groupClans=new Map((Array.isArray(group.clans)?group.clans:[])
    .filter(clan=>valid(tag(clan?.tag)))
    .map(clan=>[tag(clan.tag),clan]));
  const rawRounds=group.rounds.slice(0,7);
  const tags=[...new Set(rawRounds.flatMap(r=>Array.isArray(r?.warTags)?r.warTags:[])
    .map(tag).filter(t=>valid(t)))].slice(0,32);
  const results=new Map();
  let success=0,failures=0;
  // Bounded parallelism to avoid hammering the Supercell/RoyaleAPI endpoint.
  for(let i=0;i<tags.length;i+=6) {
    const batch=await Promise.all(tags.slice(i,i+6).map(async t=>{
      try{return {tag:t,war:await getGame("/clanwarleagues/wars/"+encodeURIComponent(t),key)}}
      catch{return {tag:t,war:null,error:true}}
    }));
    for(const b of batch){results.set(b.tag,b.war);if(b.war)success++;if(b.error)failures++}
  }
  if(tags.length && !success && failures)throw Error("war_details_unavailable");
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
  return {ok:true,active:true,season,clanTag,rounds};
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
    const response=await loadStatus(clanTag,key);
    CACHE.set(clanId,{time:Date.now(),tag:clanTag,body:response});
    return Response.json(response,{headers:CORS});
  }catch(e){
    const reason=String(e?.message||"upstream_unreachable");
    return fail(/^supercell_status_\d+$/.test(reason)?reason:
      reason==="war_details_unavailable"||reason==="unexpected_group_response"?reason:
      e?.name==="TimeoutError"?"upstream_timeout":"upstream_unreachable");
  }
});
export default {fetch:(req,...args)=>req.method==="OPTIONS"
  ?new Response("ok",{headers:CORS}):handler(req,...args)};
