// Service collector only. Pure deterministic draft from one saved profile.
// No time-only rollover, imported history, or inferred final war.
import {tag,validTag} from "./collector-core.mjs";
const seasonPattern=/^20\d{2}-(0[1-9]|1[0-2])$/;
const clone=x=>JSON.parse(JSON.stringify(x));
const array=x=>Array.isArray(x)?x:null;
export function officialNewLeague(group,clanTag,now=Date.now()){
 const own=tag(clanTag);
 const match=/^(20\d{2}-(?:0[1-9]|1[0-2]))(?:-(?:0[1-9]|[12]\d|3[01]))?$/.exec(String(group?.season||""));
 if(!validTag(own)||!match||!["preparation","inWar"].includes(group?.state)||
    match[1]!==new Date(now).toISOString().slice(0,7))return null;
 const tags=array(group.clans)?.map(c=>tag(c?.tag));
 if(!tags||![6,8].includes(tags.length)||tags.some(t=>!validTag(t))||
    new Set(tags).size!==tags.length||!tags.includes(own))return null;
 const rounds=array(group.rounds);
 if(!rounds||![0,tags.length-1].includes(rounds.length))return null;
 return {season:match[1],clanTag:own,state:group.state,warCount:tags.length-1,clanTags:tags};
}
const snapshot=m=>({id:m.id,name:m.name,playerTag:m.playerTag||"",townHall:m.townHall,
 threeStar:m.threeStar,fixed:!!m.fixed});
const fail=reason=>({ok:false,reason});
export function buildSeasonRollover(profile,league,now=Date.now()){
 const old=profile?.cwlLive,oldSeason=old?.season;
 if(!league||!seasonPattern.test(league.season)||![5,7].includes(league.warCount)||
    !seasonPattern.test(oldSeason||"")||oldSeason>=league.season||
    old.clanTag!==league.clanTag||profile.cwlLiveIgnoredSeason===oldSeason)
  return fail("no_prior_matching_season");
 const days=profile.config?.days,slots=profile.config?.slots;
 if(days!==(old.warCount===5?5:7)||!Number.isInteger(slots)||slots<1||slots>50||
    !array(profile.members)||!array(profile.archivedMembers)||!array(profile.archives)||
    !array(profile.locks)||profile.locks.length!==7||!array(old.rounds))
  return fail("invalid_profile");
 const all=[...profile.members,...profile.archivedMembers];
 if(all.some(m=>typeof m?.id!=="string"||!m.id)||new Set(all.map(m=>m.id)).size!==all.length)
  return fail("invalid_member_identity");
 const byId=new Map(all.map(m=>[m.id,m])),lineups=[];
 for(let i=0;i<profile.locks.length;i++){
  const l=profile.locks[i];if(!l?.locked)continue;
  if(i>=days||!array(l.lineup)||l.lineup.length!==slots||new Set(l.lineup).size!==slots)
   return fail("invalid_locked_lineup");
  if(l.source==="coc-api"&&(l.season!==oldSeason||l.warTag!==old.rounds[i]?.warTag||
      old.rounds[i]?.state!=="warEnded"))return fail("inconsistent_api_lock");
  const snapshots=Object.create(null);
  for(const id of l.lineup){
   const m=Object.hasOwn(l.snapshots||{},id)?l.snapshots[id]:byId.get(id);
   if(!m||m.id!==id)return fail("missing_locked_member");
   snapshots[id]=snapshot(m);
  }
  lineups.push({day:i+1,lineup:[...l.lineup],snapshots});
 }
 const existing=profile.archives.filter(a=>a?.sourceSeason===oldSeason);
 if(existing.length>1)return fail("duplicate_prior_archive");
 const next=clone(profile);
 if(!existing.length){
  const used=new Set(lineups.flatMap(l=>l.lineup));
  for(const m of all)if(m.participating)used.add(m.id);
  const players=[...used].map(id=>snapshot(lineups.find(l=>Object.hasOwn(l.snapshots,id))?.snapshots[id]||byId.get(id)));
  const counts=Object.fromEntries(players.map(p=>[p.id,lineups.filter(l=>l.lineup.includes(p.id)).length]));
  const label=new Date(oldSeason+"-01T00:00:00Z").toLocaleDateString("de-AT",{month:"long",year:"numeric",timeZone:"UTC"});
  next.archives.push({id:"auto-cwl-"+oldSeason,label,createdAt:now,slots,days,playedCount:lineups.length,
   complete:lineups.length===days,players,lineups,counts,sourceSeason:oldSeason,cwlLive:clone(old),
   deploymentSnapshot:{version:1,capturedAt:now,players:players.flatMap(p=>{
    const m=byId.get(p.id);return m?[{id:m.id,participating:!!m.participating,fixed:!!m.fixed,
     targetDays:Number.isInteger(m.targetDays)&&m.targetDays>=1&&m.targetDays<=7?m.targetDays:null}]:[];
   })}});
 }else{
  // Existing immutable archive must still match today's saved locked days.
  // Never silently discard a later correction to the old plan.
  const a=existing[0];
  if(a.days!==days||a.slots!==slots||a.playedCount!==lineups.length||
     a.complete!==(lineups.length===days)||!array(a.lineups)||
     a.lineups.length!==lineups.length||lineups.some((l,i)=>a.lineups[i]?.day!==l.day||
       JSON.stringify(a.lineups[i]?.lineup)!==JSON.stringify(l.lineup)))
   return fail("prior_archive_conflict");
 }
 next.config.days=league.warCount;
 next.dayGoals=Array.from({length:7},()=>({townHall:{},strength:{high:0,medium:0,low:0,verylow:0}}));
 next.locks=Array.from({length:7},()=>({locked:false,lineup:[]}));
 for(const m of next.members){
  m.statuses=Array(7).fill("auto");m.firstDay=null;m.outFromDay=null;m.targetDays=null;
  const d=m.cocBeforeDeparture;
  if(d){
   for(const k of ["before","automatic"])if(d[k]){d[k].targetDays=null;d[k].statuses=Array(7).fill("auto")}
   if(d.edited){delete d.edited.targetDays;for(let i=0;i<7;i++)delete d.edited["statuses."+i]}
  }
 }
 next.archivedMembers=[];
 next.cwlLiveIgnoredSeason=oldSeason;
 next.cwlLive={season:league.season,clanTag:league.clanTag,rounds:[],warCount:league.warCount};
 return {ok:true,oldSeason,newSeason:league.season,profile:next};
}
