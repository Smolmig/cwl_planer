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
const num = (n,min,max) => Number.isInteger(Number(n)) && Number(n)>=min && Number(n)<=max ? Number(n) : null;
function sanitizeMember(m) {
  const tag=tagOf(m?.tag);
  if (!validTag(tag)) return null;
  const attacks=Array.isArray(m?.attacks) ? m.attacks.slice(0,4).map(a=>({
    attackerTag:tagOf(a?.attackerTag)||tag,
    defenderTag:tagOf(a?.defenderTag),
    stars:num(a?.stars,0,3),
    destructionPercentage:num(a?.destructionPercentage,0,100)
  })).filter(a=>a.attackerTag===tag && validTag(a.defenderTag) && a.stars!==null && a.destructionPercentage!==null) : [];
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
      clan:{tag,name:String(r.clan?.name||"").slice(0,80),members:clanMembers},
      opponent:{tag:opponentTag,name:String(r.opponent?.name||"Unbekannt").slice(0,80),members:opponentMembers}};
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
