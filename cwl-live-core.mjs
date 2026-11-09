// CWL live helpers: defensive normalization and idempotent post-war reconciliation.
// No API key, network or browser dependency in this module.
export const tagOf = value => {
  const tag = String(value || "").trim().toUpperCase().replace(/\s/g, "");
  return tag.startsWith("#") ? tag : tag ? "#"+tag : "";
};
export function clashTime(value) {
  const m = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)(?:\.\d+)?Z$/.exec(String(value||""));
  if (!m) return NaN;
  return Date.parse(m[1]+"-"+m[2]+"-"+m[3]+"T"+m[4]+":"+m[5]+":"+m[6]+"Z");
}
const validTag = tag => /^#[0289PYLQGRJCUV]{3,15}$/.test(tag);
const num = (n,min,max) => n!==null && n!==undefined && n!=="" &&
  Number.isInteger(Number(n)) && Number(n)>=min && Number(n)<=max ? Number(n) : null;
const safeDestruction=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100?Math.round(n*100)/100:null;
export function safeBadgeUrl(value) {
  if(typeof value!=="string")return null;
  try{
    const url=new URL(value);
    return url.protocol==="https:"&&url.hostname==="api-assets.clashofclans.com"&&
      url.pathname.startsWith("/badges/")&&url.username===""&&url.password===""?url.href:null;
  }catch{return null}
}
function sanitizeMember(m) {
  const tag=tagOf(m?.tag);
  if (!validTag(tag)) return null;
  const raw=Array.isArray(m?.attacks)?m.attacks:null;
  const parsed=raw?raw.slice(0,4).map(a=>({
    attackerTag:tagOf(a?.attackerTag)||tag,
    defenderTag:tagOf(a?.defenderTag),
    stars:num(a?.stars,0,3),
    destructionPercentage:safeDestruction(a?.destructionPercentage)
  })).filter(a=>a.attackerTag===tag && validTag(a.defenderTag) && a.stars!==null && a.destructionPercentage!==null):null;
  // Missing or malformed attack records are unknown, never inferred as a miss.
  const attacks=raw&&parsed.length===Math.min(raw.length,4)?parsed:null;
  return {tag,name:String(m?.name||"Unbekannt").slice(0,80),
    townHallLevel:num(m?.townHallLevel,3,30),attacks};
}
export function sanitizeSnapshot(payload) {
  if (!payload || payload.ok!==true || payload.active!==true) return null;
  const clanTag=tagOf(payload.clanTag);
  const season=String(payload.season||"").slice(0,20);
  if (!validTag(clanTag) || !/^\d{4}-\d{2}$/.test(season)) return null;
  const rounds=(Array.isArray(payload.rounds)?payload.rounds:[]).slice(0,7).map((r,i)=>{
    if (!r || Number(r.day)!==i+1) return {day:i+1,available:false};
    const warTag=tagOf(r.warTag);
    const state=["preparation","inWar","warEnded"].includes(r.state)?r.state:null;
    if (!r.available || !validTag(warTag) || !state) return {day:i+1,available:false};
    const clanMembers=(Array.isArray(r.clan?.members)?r.clan.members:[]).map(sanitizeMember).filter(Boolean);
    const opponentMembers=(Array.isArray(r.opponent?.members)?r.opponent.members:[]).map(sanitizeMember).filter(Boolean);
    const tag=tagOf(r.clan?.tag),opponentTag=tagOf(r.opponent?.tag);
    if (tag!==clanTag || !validTag(opponentTag)) return {day:i+1,available:false};
    return {day:i+1,available:true,warTag,state,
      startTime:String(r.startTime||""),endTime:String(r.endTime||""),
      teamSize:num(r.teamSize,1,50),
      clan:{tag,name:String(r.clan?.name||"").slice(0,80),members:clanMembers,
        stars:num(r.clan?.stars,0,150),destructionPercentage:safeDestruction(r.clan?.destructionPercentage),
        badgeUrl:safeBadgeUrl(r.clan?.badgeUrl)},
      opponent:{tag:opponentTag,name:String(r.opponent?.name||"Unbekannt").slice(0,80),members:opponentMembers,
        stars:num(r.opponent?.stars,0,150),destructionPercentage:safeDestruction(r.opponent?.destructionPercentage),
        badgeUrl:safeBadgeUrl(r.opponent?.badgeUrl)}};
  });
  return {season,clanTag,rounds};
}
export function canFinalize(round,expectedSlots,now=Date.now()) {
  if (!round?.available || round.state!=="warEnded" || !validTag(tagOf(round.warTag))) return false;
  if (round.teamSize!==expectedSlots || round.clan?.members?.length!==expectedSlots ||
      round.opponent?.members?.length!==expectedSlots) return false;
  const end=clashTime(round.endTime);
  if (!Number.isFinite(end) || end > now-60_000 || end < now-45*86400000) return false;
  for (const side of ["clan","opponent"]) {
    const tags=round[side].members.map(m=>tagOf(m.tag));
    if (tags.some(t=>!validTag(t)) || new Set(tags).size!==expectedSlots) return false;
  }
  return true;
}
// Factual, read-only attacks from this clan/season. A confirmed in-war
// attack is already executed even though the day is not finalized. Missing
// attacks during battle stay unknown; "missed" is only observed post-war.
export function recordedCwlAttackResults(snapshot){
 const result={};
 if(!/^\d{4}-\d{2}$/.test(String(snapshot?.season||""))||
    !validTag(tagOf(snapshot?.clanTag)))return result;
 for(const round of snapshot.rounds||[]){
  if(!round?.available||!["inWar","warEnded"].includes(round.state)||
     !validTag(tagOf(round.warTag))||
     !Number.isInteger(round.day)||round.day<1||round.day>7||
     tagOf(round.clan?.tag)!==tagOf(snapshot.clanTag))continue;
  const teamSize=round.teamSize,members=round.clan?.members;
  if(!Number.isInteger(teamSize)||teamSize<1||teamSize>50||
     !Array.isArray(members)||members.length!==teamSize)continue;
  const tags=members.map(m=>tagOf(m?.tag));
  if(tags.some(t=>!validTag(t))||new Set(tags).size!==teamSize)continue;
  const day={};
  for(const member of members){
   const tag=tagOf(member.tag);
   const attack=Array.isArray(member.attacks)?member.attacks[0]:null;
   const stars=attack?.stars;
   const percent=attack?.destructionPercentage;
   if(attack&&tagOf(attack.attackerTag)===tag&&
      Number.isInteger(stars)&&stars>=0&&stars<=3&&
      typeof percent==="number"&&Number.isFinite(percent)&&percent>=0&&percent<=100){
    day[tag]={stars,percent,missed:false,warTag:round.warTag,state:round.state};
   }else if(round.state==="warEnded"&&Array.isArray(member.attacks)&&member.attacks.length===0){
    day[tag]={missed:true,warTag:round.warTag,state:round.state};
   }
  }
  // In battle include only known attacks; post-war additionally report
  // truly absent ones, but never invent an in-battle zero or absence.
  if(Object.keys(day).length)result[round.day]=day;
 }
 return result;
}

// Read-only supervision of CWL attack deadlines. This never modifies
// player participation, future day rules, targets, locks or lineups. A player
// who is still attacking 5 minutes before the end is NOT a missed attacker.
export function cwlAttackReminder(round,now=Date.now(),windowMinutes=60){
  if(!round?.available||!["inWar","warEnded"].includes(round.state)||
     !validTag(tagOf(round.warTag))||!Number.isInteger(round.day)||round.day<1||round.day>7||
     !Number.isFinite(now)||!Number.isFinite(windowMinutes)||windowMinutes<=0)return null;
  const limit=round.teamSize,roster=round.clan?.members;
  if(!Number.isInteger(limit)||limit<1||limit>50||!Array.isArray(roster)||
     roster.length!==limit)return null;
  const tags=roster.map(m=>tagOf(m?.tag));
  if(tags.some(t=>!validTag(t))||new Set(tags).size!==limit)return null;
  const players=roster.filter(m=>Array.isArray(m.attacks)&&m.attacks.length===0);
  // Missing attacks arrays are incomplete data, not confirmed misses.
  if(roster.some(m=>!Array.isArray(m.attacks))||!players.length)return null;
  const end=clashTime(round.endTime);
  if(!Number.isFinite(end))return null;
  if(round.state==="inWar"){
    const start=clashTime(round.startTime),remaining=end-now;
    if(!Number.isFinite(start)||start>now||remaining<=0||
       remaining>windowMinutes*60000)return null;
    return {day:round.day,warTag:tagOf(round.warTag),kind:"open",players:players.map(m=>({tag:tagOf(m.tag),
      name:String(m.name||tagOf(m.tag)).slice(0,80)})),
      minutesLeft:Math.ceil(remaining/60000),endTime:round.endTime};
  }
  if(!canFinalize(round,limit,now))return null;
  return {day:round.day,warTag:tagOf(round.warTag),kind:"confirmed",players:players.map(m=>({
    tag:tagOf(m.tag),name:String(m.name||tagOf(m.tag)).slice(0,80)})),
    minutesLeft:0,endTime:round.endTime};
}

// Read-only phase-2 preview: an ended, fully observed CWL missed attack can
// justify REVIEWING future assignments, but never changing them automatically.
// Plan locks, Clash inWar/warEnded rosters and player rules remain immutable.
export function cwlMissedRotationReview(snapshot,profile,dayPlans=[],{
 now=Date.now(),staleDays=[],planningOk=true
}={}){
 const season=String(snapshot?.season||""),clanTag=tagOf(snapshot?.clanTag);
 if(!/^\d{4}-\d{2}$/.test(season)||!validTag(clanTag)||
    profile?.cwlLive?.season!==season||
    tagOf(profile?.cwlLive?.clanTag)!==clanTag||
    profile?.cwlLiveIgnoredSeason===season||
    !Array.isArray(snapshot?.rounds)||!Array.isArray(dayPlans)||
    !Number.isFinite(now))return [];
 const days=Number(profile?.config?.days);
 if(!Number.isInteger(days)||days<1||days>7)return [];
 const stale=new Set(Array.isArray(staleDays)?staleDays:[]);
 const owners=new Map(),duplicates=new Set();
 for(const member of [...(profile.members||[]),...(profile.archivedMembers||[])]){
  const tag=tagOf(member?.playerTag);
  if(!validTag(tag))continue;
  if(owners.has(tag))duplicates.add(tag);
  else owners.set(tag,member);
 }
 const roundByDay=new Map(snapshot.rounds.map(r=>[r.day,r]));
 const planByDay=new Map(dayPlans.map(p=>[p.day,p]));
 const rows=[];
 for(const round of snapshot.rounds){
  if(stale.has(round?.day)||round?.day>=days||
     tagOf(round?.clan?.tag)!==clanTag)continue;
  const note=cwlAttackReminder(round,now);
  if(note?.kind!=="confirmed")continue;
  for(const entry of note.players){
   const tag=tagOf(entry.tag),member=duplicates.has(tag)?null:owners.get(tag);
   const planned=[],reviewable=[],protectedDays=[];
   for(let day=round.day+1;day<=days;day++){
    const dp=planByDay.get(day);
    if(!member?.id||!dp?.lineup?.includes(member.id))continue;
    planned.push(day);
    const upcoming=roundByDay.get(day);
    const reason=stale.has(day)?"Clash-Daten für diesen Tag veraltet":
      profile.locks?.[day-1]?.locked||dp.locked?"Plan bereits gesperrt":
      upcoming?.state==="inWar"?"Krieg läuft – Clash-Aufstellung fix":
      upcoming?.state==="warEnded"?"Krieg beendet – keine Änderung möglich":
      !planningOk?"Plan nicht eindeutig berechenbar":null;
    if(reason)protectedDays.push({day,reason});
    else reviewable.push({day,stage:upcoming?.state==="preparation"?
      "Vorbereitung – Wechsel in Clash prüfen":"künftiger Tag – Planung prüfen"});
   }
   const mustDays=planned.filter(day=>member?.statuses?.[day-1]==="must");
   rows.push({
    day:round.day,warTag:note.warTag,tag,
    name:entry.name,memberId:member?.id||null,
    plannedDays:planned,reviewable,protectedDays,
    isFixed:member?.fixed===true,targetDays:Number.isInteger(member?.targetDays)?
      member.targetDays:null,mustDays,unknownMember:!member,
    // Caller must never turn these read-only suggestions into direct plan writes.
    advisoryOnly:true
   });
  }
 }
 return rows.sort((a,b)=>b.day-a.day||a.name.localeCompare(b.name,"de")||
  a.tag.localeCompare(b.tag));
}

// Read-only preview: the solver's recommended lineup is the source of truth.
// Clash's preparation roster is provisional and must never silently change it.
export function reviewPreparationLineup(profile,dayPlan,round,{planningOk=true}={}){
 if(!round?.available||round.state!=="preparation")return null;
 const unavailable=reason=>({status:"unavailable",reason,toRemove:[],toAdd:[]});
 const slots=Number(profile?.config?.slots),teamSize=Number(round.teamSize);
 const actual=Array.isArray(round.clan?.members)?round.clan.members:[];
 if(!Number.isInteger(teamSize)||teamSize<1||teamSize>50||
    slots!==teamSize||actual.length!==teamSize)
   return unavailable("Clash-Aufstellung noch nicht vollständig verfügbar oder Kriegsgröße unterschiedlich.");
 const actualTags=actual.map(m=>tagOf(m?.tag));
 if(actualTags.some(t=>!validTag(t))||new Set(actualTags).size!==teamSize)
   return unavailable("Die Clash-Aufstellung ist noch unvollständig. Bitte erneut aktualisieren.");
 if(!planningOk||!dayPlan||dayPlan.locked||
    !Array.isArray(dayPlan.lineup)||dayPlan.lineup.length!==teamSize||
    (Array.isArray(dayPlan.warnings)&&dayPlan.warnings.length))
   return unavailable("Bitte zuerst die empfohlene Aufstellung im Planer vollständig prüfen.");
 const members=new Map([...(profile?.members||[]),...(profile?.archivedMembers||[])].map(m=>[m.id,m]));
 const planned=dayPlan.lineup.map(id=>members.get(id));
 if(planned.some(m=>!m?.playerTag))
   return unavailable("Für den Abgleich fehlen Player-Tags in der Planung.");
 const plannedTags=planned.map(m=>tagOf(m.playerTag));
 if(plannedTags.some(t=>!validTag(t))||new Set(plannedTags).size!==teamSize)
   return unavailable("Für den Abgleich sind eindeutige Player-Tags im Planer erforderlich.");
 const chosen=new Set(plannedTags),existing=new Set(actualTags);
 const toRemove=actual.filter(m=>!chosen.has(tagOf(m.tag)))
   .map(m=>({tag:tagOf(m.tag),name:m.name,townHallLevel:m.townHallLevel}));
 const toAdd=planned.filter(m=>!existing.has(tagOf(m.playerTag)))
   .map(m=>({tag:tagOf(m.playerTag),name:m.name,townHallLevel:m.townHall}));
 if(toRemove.length!==toAdd.length)
   return unavailable("Die Listen sind nicht eindeutig vergleichbar. Bitte erneut aktualisieren.");
 return {status:toRemove.length?"changes":"match",
  matched:teamSize-toRemove.length,teamSize,toRemove,toAdd};
}

// Completed changes are a comparison of the ACTUAL rosters of two consecutive
// CWL days, not a pending swap between the planner and Clash.
// Never reconstruct them from incomplete historical rosters or another season.
export function compareConsecutiveCwlLineups(previousRound,currentRound){
 if(!Number.isInteger(currentRound?.day)||currentRound.day<=1||currentRound.day>7||
    previousRound?.day!==currentRound.day-1||
    !previousRound?.available||!currentRound.available||
    !["inWar","warEnded"].includes(previousRound.state)||
    currentRound.state!=="preparation")return null;
 const size=currentRound.teamSize;
 if(!Number.isInteger(size)||size<1||size>50||previousRound.teamSize!==size)return null;
 const before=previousRound.clan?.members,after=currentRound.clan?.members;
 const validRoster=roster=>Array.isArray(roster)&&roster.length===size&&
    roster.every(m=>validTag(tagOf(m?.tag))&&String(m?.name||"").trim())&&
    new Set(roster.map(m=>tagOf(m.tag))).size===size;
 if(!validRoster(before)||!validRoster(after))return null;
 const beforeTags=new Set(before.map(m=>tagOf(m.tag))),afterTags=new Set(after.map(m=>tagOf(m.tag)));
 const toRemove=before.filter(m=>!afterTags.has(tagOf(m.tag)))
   .map(m=>({tag:tagOf(m.tag),name:m.name,townHallLevel:m.townHallLevel}));
 const toAdd=after.filter(m=>!beforeTags.has(tagOf(m.tag)))
   .map(m=>({tag:tagOf(m.tag),name:m.name,townHallLevel:m.townHallLevel}));
 if(toRemove.length!==toAdd.length)return null;
 return {status:toRemove.length?"changes":"match",teamSize:size,
   matched:size-toRemove.length,toRemove,toAdd};
}

// Compact paste-ready text for Clash chat. Incoming players get an @ prefix;
// actual mention activation still depends on Clash's chat behaviour.
export function formatClashSwapText(day,review) {
  if(!Number.isInteger(day)||day<1||day>7)return null;
  if(!review||!["match","changes"].includes(review.status))return null;
  if(review.status==="match")return "Tag "+day+": Aufstellung passt. Keine Wechsel noetig.";
  if(!Array.isArray(review.toRemove)||!Array.isArray(review.toAdd)||
     !review.toRemove.length||review.toRemove.length!==review.toAdd.length)return null;
  const clean=entry=>String(entry?.name||"").replace(/[\r\n\t]+/g," ").replace(/ {2,}/g," ").trim();
  if([...review.toRemove,...review.toAdd].some(entry=>!clean(entry)))return null;
  return "Tag "+day+" - Raus: "+review.toRemove.map(clean).join(", ")+
    " - Rein: "+review.toAdd.map(entry=>"@"+clean(entry).replace(/^@+/,"")).join(" ");
}
// Mutable profile is the same object used by the existing v9 planner.
// Caller may save only when this returns changed=true.
export function reconcileCwl(profile,payload,createMember,now=Date.now()) {
  const snapshot=sanitizeSnapshot(payload);
  if (!snapshot || !profile || !Array.isArray(profile.locks)) return {changed:false,lockedDays:[],reason:"no_live_cwl"};
  if (profile.cwlLiveIgnoredSeason===snapshot.season) return {changed:false,lockedDays:[],reason:"season_explicitly_reset"};
  const previous=profile.cwlLive;
  const played=profile.locks.some(l=>l?.locked);
  if (previous?.season && previous.season!==snapshot.season && played)
    return {changed:false,lockedDays:[],reason:"previous_season_locked"};
  if (!previous?.season && played)
    return {changed:false,lockedDays:[],reason:"unlinked_manual_history"};
  let changed=false;
  const nextLive={season:snapshot.season,clanTag:snapshot.clanTag,rounds:snapshot.rounds};
  if (JSON.stringify({season:previous?.season,clanTag:previous?.clanTag,rounds:previous?.rounds}) !== JSON.stringify(nextLive)) {
    profile.cwlLive=nextLive;
    changed=true;
  }
  const lockedDays=[];
  const days=Math.min(7,Math.max(1,Number(profile.config?.days)||7));
  const slots=Number(profile.config?.slots)||15;
  for (let day=0;day<days;day++) {
    if (profile.locks[day]?.locked) continue;
    if (profile.locks.slice(0,day).some(l=>!l?.locked)) break;
    const round=snapshot.rounds[day];
    if (!canFinalize(round,slots,now)) break;
    const ids=[],snapshots={},used=new Set();
    const all=[...(profile.members||[]),...(profile.archivedMembers||[])];
    const lookup=new Map(all.filter(m=>m.playerTag).map(m=>[tagOf(m.playerTag),m]));
    const missing=[];
    for (const player of round.clan.members) {
      const tag=tagOf(player.tag);
      let member=lookup.get(tag);
      if (!member) {
        member=createMember(player.name||tag);
        member.playerTag=tag;
        member.townHall=player.townHallLevel;
        member.participating=false;
        missing.push(member);lookup.set(tag,member);
      }
      if (!member?.id || used.has(member.id)) break;
      used.add(member.id);ids.push(member.id);
      snapshots[member.id]={id:member.id,name:member.name,playerTag:tag,
        townHall:player.townHallLevel,threeStar:member.threeStar||"unknown",fixed:!!member.fixed};
    }
    if (ids.length!==slots || Object.keys(snapshots).length!==slots) break;
    profile.archivedMembers ||= [];
    profile.archivedMembers.push(...missing);
    profile.locks[day]={locked:true,lineup:ids,snapshots,source:"coc-api",
      warTag:round.warTag,season:snapshot.season,endTime:round.endTime};
    lockedDays.push(day+1);changed=true;
  }
  return {changed,lockedDays,reason:lockedDays.length?"finished_wars":changed?"updated_live_status":"unchanged"};
}

// Keep each CWL attack distinct. During the battle put players who have
// not attacked first; after the battle preserve the actual lineup order.
export function cwlAttackRows(round,side="clan") {
  // One read-only mapper for both clans. No assumptions about enemy attack order
  // or missing targets; each recorded attack stays attached to its attacker.
  const attackers=side==="opponent"?"opponent":"clan";
  const defenders=attackers==="clan"?"opponent":"clan";
  const targets=new Map((round?.[defenders]?.members||[]).map(m=>[tagOf(m.tag),m]));
  const rows=(round?.[attackers]?.members||[]).flatMap((player,playerIndex)=>{
    const attacks=Array.isArray(player?.attacks)?player.attacks:[];
    if(attacks.length===0)return [{player,target:null,attack:null,playerIndex,attackIndex:0}];
    return attacks.map((attack,attackIndex)=>({
      player,target:targets.get(tagOf(attack.defenderTag))||null,
      attack,playerIndex,attackIndex
    }));
  });
  if(round?.state==="inWar")rows.sort((a,b)=>
    Number(!!a.attack)-Number(!!b.attack)||
    a.playerIndex-b.playerIndex||a.attackIndex-b.attackIndex);
  return rows;
}
