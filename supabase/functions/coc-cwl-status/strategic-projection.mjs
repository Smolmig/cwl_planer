// Shadow-only projection. Caller has already verified RLS membership.
// No DB calls, arbitrary clan/war queries, writes or raw foreign attack output.
import {analyzeCwlGroup} from "./strategic-opponents.mjs";
import {assessStrategicStandings} from "./strategic-standings.mjs";
import {resolveReviewedLeagueRules} from "./strategic-league-rules.mjs";
import {summarizeGroupStrength} from "./strategic-group-strength.mjs";
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const int=(v,a,b)=>Number.isInteger(v)&&v>=a&&v<=b;
const pct=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100?v:null;
export function strategicAccess({role,clanId,enabled,allowlist}={}){
 return enabled==="true"&&["owner","editor"].includes(role)&&typeof clanId==="string"&&UUID.test(clanId)&&
 typeof allowlist==="string"&&allowlist.split(",").map(s=>s.trim()).filter(s=>UUID.test(s)).includes(clanId);
}
function side(raw,n,state){
 if(!TAG.test(tag(raw?.tag))||!Array.isArray(raw.members)||raw.members.length!==n)return null;
 const total=raw.members.reduce((s,m)=>s+(Array.isArray(m?.attacks)?m.attacks.length:0),0);
 const counter=int(raw.attacks,0,n)&&raw.attacks===total&&raw.members.every(m=>m?.attacks===undefined||Array.isArray(m.attacks));
 return {tag:tag(raw.tag),stars:state==="preparation"?null:int(raw.stars,0,3*n)?raw.stars:null,
 destructionPercentage:state==="preparation"?null:pct(raw.destructionPercentage),counter,
 members:raw.members.map(m=>({tag:tag(m?.tag),townHallLevel:m?.townhallLevel??m?.townHallLevel??null,mapPosition:m?.mapPosition??null,
 attacks:state==="preparation"?[]:Array.isArray(m?.attacks)&&m.attacks.length<=1?m.attacks.map(a=>({
 attackerTag:tag(a?.attackerTag),defenderTag:tag(a?.defenderTag),stars:a?.stars??null,
 destructionPercentage:pct(a?.destructionPercentage),order:a?.order??null
 })):m?.attacks===undefined&&counter?[]:null}))};
}
// Recheck actual membership/link after the potentially slow external read.
export async function readStrategicWithRecheck({read,verify}){
 const result=await read();
 return await verify()===true?result:null;
}
// Official compact UTC timestamp. Validate the round-trip: Date.parse alone
// can normalize impossible dates. A missing start time cannot justify a swap.
function preparationStart(value){
 if(typeof value!=="string"||!/^\d{8}T\d{6}(?:\.\d{3})?Z$/.test(value))return null;
 const iso=value.slice(0,4)+"-"+value.slice(4,6)+"-"+value.slice(6,8)+"T"+value.slice(9,11)+":"+value.slice(11,13)+":"+value.slice(13,15)+(value.length===20?value.slice(15,19):".000")+"Z";
 const ms=Date.parse(iso);
 return Number.isFinite(ms)&&new Date(ms).toISOString()===iso?ms:null;
}
export function projectStrategicGroup({group,results,clanTag,season,observedAt,readStartedAt=observedAt,ruleContext=null}={}){
 const own=tag(clanTag),n=group?.clans?.length;
 if(!TAG.test(own)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(season||"")||!Number.isFinite(observedAt)||!Number.isFinite(readStartedAt)||readStartedAt>observedAt||observedAt-readStartedAt>=300000||
 !["preparation","inWar","ended"].includes(group?.state)||!new RegExp("^"+season+"(?:-\\d{2})?$").test(String(group.season||""))||
 ![6,8].includes(n)||!Array.isArray(group.rounds)||group.rounds.length>n-1||!(results instanceof Map))throw Error("invalid_projection_scope");
 const clans=group.clans.map(c=>({tag:tag(c?.tag)})),allowed=new Set(clans.map(c=>c.tag));
 if(allowed.size!==n||!allowed.has(own)||clans.some(c=>!TAG.test(c.tag)))throw Error("invalid_projection_group");
 const ownGroup=group.clans.find(c=>tag(c.tag)===own);
 const tags=Array.isArray(ownGroup?.members)?ownGroup.members.map(m=>tag(m?.tag)):[];
 const registered=tags.length>=15&&tags.length<=50&&tags.every(t=>TAG.test(t))&&new Set(tags).size===tags.length?
 {verified:true,season,clanTag:own,observedAt,tags}:null;
 const sizes=new Set(),formats=new Set(),preparationEnds=new Map();let unverifiedCounters=0,unverifiedPreparation=0;
 const rounds=group.rounds.map((round,i)=>{
 if(!Array.isArray(round?.warTags)||round.warTags.length>n/2)throw Error("invalid_projection_round");
 return {day:i+1,matches:round.warTags.map(v=>{
 const key=tag(v),w=TAG.test(key)?results.get(key):null;
 if(!w||!["preparation","inWar","warEnded"].includes(w.state)||![15,30].includes(w.teamSize)||
 !allowed.has(tag(w.clan?.tag))||!allowed.has(tag(w.opponent?.tag))||tag(w.clan?.tag)===tag(w.opponent?.tag))return {available:false};
 sizes.add(w.teamSize);
 // The league-war endpoint may omit attacksPerMember. Standard CWL has
 // one attack. A contradictory explicit value or actual multi-attack
 // roster is not a supported standard format.
 formats.add(w.attacksPerMember===undefined?"not_reported":w.attacksPerMember);
 if([w.clan,w.opponent].some(s=>Array.isArray(s?.members)&&s.members.some(m=>Array.isArray(m?.attacks)&&m.attacks.length>1)))formats.add("multiple_attacks");
 if(w.state==="preparation"){
  const start=preparationStart(w.startTime);
  if(start===null||start<=observedAt){unverifiedPreparation++;return {available:false}}
  preparationEnds.set(key,start);
 }
 const a=side(w.clan,w.teamSize,w.state),b=side(w.opponent,w.teamSize,w.state);
 if(!a||!b)return {available:false};
 if(w.state!=="preparation"&&(!a.counter||!b.counter))unverifiedCounters++;
 return {available:true,warTag:key,state:w.state,teamSize:w.teamSize,
 attacksPerMember:1,clan:a,opponent:b};
 })};
 });
 if(sizes.size!==1||[...formats].some(x=>x!==1&&x!=="not_reported"))return {status:"unsupported_or_unknown_format",registered:null,group:null,standings:null};
 const teamSize=[...sizes][0],snapshot={season,clanTag:own,observedAt,clans,rounds};
 const analyzed=analyzeCwlGroup({snapshot,selectedClanTag:own,season,asOf:observedAt});
 const targets=new Set(analyzed.upcoming.flatMap(w=>w.roster.map(p=>JSON.stringify([w.opponentTag,p.tag,p.townHall]))));
 const relevant=analyzed.profiles.filter(p=>p.clanTag===own&&registered?.tags.includes(p.playerTag)||
 targets.has(JSON.stringify([p.clanTag,p.playerTag,p.townHall])));
 const ownWars=analyzed.wars.filter(w=>w.ownRoster);
 const counters=rounds.flatMap(r=>r.matches).filter(w=>w.available&&w.state!=="preparation"&&[w.clan.tag,w.opponent.tag].includes(own))
 .every(w=>w.clan.counter&&w.opponent.counter);
 // Only own active match, complete own attack counter and valid evidence.
 // No enemy names, tags, army or raw foreign attack logs in this projection.
 const liveTargets=[];
 for(const war of ownWars.filter(w=>w.state==="inWar")){
  const w=rounds.find(r=>r.day===war.day)?.matches.find(m=>m.available&&m.warTag===war.warTag);
  const raw=results.get(war.warTag),endAt=preparationStart(raw?.endTime),startAt=preparationStart(raw?.startTime);
  if(!w||w.attacksPerMember!==1||!war.completeAttackLists||!war.firstHitKnown||
    !Number.isFinite(endAt)||!Number.isFinite(startAt)||startAt>observedAt||endAt<=observedAt)continue;
  const a=w.clan.tag===own?w.clan:w.opponent,b=a===w.clan?w.opponent:w.clan;
  if(!a.counter||!b.counter||!a.members.every(m=>int(m.mapPosition,1,war.teamSize))||!b.members.every(m=>int(m.mapPosition,1,war.teamSize)))continue;
  const best=new Map(b.members.map(m=>[m.tag,{stars:0,destruction:0,hits:0}]));
  for(const m of a.members)for(const hit of m.attacks||[]){
   const t=best.get(hit.defenderTag);if(!t)continue;
   t.hits++;
   if(hit.stars>t.stars||hit.stars===t.stars&&hit.destructionPercentage>t.destruction){t.stars=hit.stars;t.destruction=hit.destructionPercentage}
  }
  if([...best.values()].reduce((s,t)=>s+t.stars,0)!==a.stars)continue;
  liveTargets.push({day:war.day,warTag:war.warTag,teamSize:war.teamSize,observedAt,endAt,
   attackers:a.members.filter(m=>m.attacks?.length===0).map(m=>({tag:m.tag,townHall:m.townHallLevel,mapPosition:m.mapPosition})),
   targets:b.members.map(m=>({townHall:m.townHallLevel,mapPosition:m.mapPosition,...best.get(m.tag)}))});
 }
 const groupView={...analyzed,liveTargets,clanStrength:summarizeGroupStrength({clans:group.clans,analyzed,teamSize,own}),profiles:relevant,wars:ownWars,ownMedals:{...analyzed.ownMedals,complete:analyzed.ownMedals.complete&&counters}};
 const consistent=registered&&registered.tags.length>=teamSize&&[...ownWars,...analyzed.upcoming].every(w=>w.ownRoster.every(p=>registered.tags.includes(p.tag)));
 const scores={...snapshot,rounds:rounds.map(r=>({day:r.day,matches:r.matches.map(w=>{
 if(!w.available)return {available:false};
 const trim=s=>({tag:s.tag,stars:s.stars,destructionPercentage:s.destructionPercentage});
 return {...w,clan:trim(w.clan),opponent:trim(w.opponent)};
 })}))};
 const ownWarTags=[...ownWars,...analyzed.upcoming].map(w=>w.warTag);
 const rules=resolveReviewedLeagueRules({records:ruleContext?.records,clanId:ruleContext?.clanId,clanTag:own,season,teamSize,observedAt,ownWarTags});
 const standings=assessStrategicStandings({snapshot:scores,selectedClanTag:own,season,asOf:observedAt,teamSize,league:rules?.league,rules});
 if(rules)standings.ruleEvidence={source:rules.source,verifiedAt:rules.verifiedAt,promotionPlaces:rules.promotionPlaces,demotionPlaces:rules.demotionPlaces};
 return {status:consistent?"preview_data":"unverified_registration",registered:consistent?registered:null,group:groupView,standings,scoreSnapshot:scores,
 format:{teamSize,attacksPerMember:1,attacksPerMemberReported:!formats.has("not_reported")},quality:{unverifiedCounters,unverifiedPreparation,observedAt,readStartedAt,
 validUntil:Math.min(readStartedAt+300000,...analyzed.upcoming.map(w=>preparationEnds.get(w.warTag))),serverReadTimeNotExactAttackTime:true},
 limitations:["shadow_only",...(rules?[]:["league_rules_not_verified"]),"not_a_historical_snapshot_store","no_automatic_apply"]};
}
