// Read-only, evidence-only normal Clan War view model.
// Never infer missing attacks as a disciplinary violation or claim Supercell's
// "most heroic" rankings, which are not fields of currentwar.
const validStars=n=>Number.isInteger(n)&&n>=0&&n<=3;
const validPercent=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0&&n<=100;
const validTH=n=>Number.isInteger(n)&&n>=1&&n<=18;
const numberOrNull=n=>Number.isInteger(n)&&n>=0?n:null;
const extract=side=>{
 const members=Array.isArray(side?.members)?side.members:[];
 return members.flatMap(member=>(Array.isArray(member.attacks)?member.attacks:[])
 .filter(a=>validStars(a.stars)&&validPercent(a.destructionPercentage))
 .map(a=>({
   attackerTag:member.tag,attackerName:String(member.name||member.tag||"Unbekannt"),
   attackerTH:validTH(member.townHallLevel)?member.townHallLevel:null,
   defenderTag:a.defenderTag,stars:a.stars,
   destruction:a.destructionPercentage,
   order:numberOrNull(a.order),duration:numberOrNull(a.duration),
   mapPosition:numberOrNull(member.mapPosition)
 })));
};
const total=attacks=>attacks.length;
const average=attacks=>attacks.length?
 attacks.reduce((a,b)=>a+b.destruction,0)/attacks.length:null;
const sortByPerformance=(a,b)=>
 b.stars-a.stars||b.destruction-a.destruction||
 // Clearly a local comparison: a higher TH difference only breaks exact ties.
 ((b.defenderTH??0)-(b.attackerTH??0))-
 ((a.defenderTH??0)-(a.attackerTH??0))||
 a.attackerName.localeCompare(b.attackerName);
export function summarizeNormalWar(war,now=Date.now()){
 if(!war||!["preparation","inWar","warEnded"].includes(war.state)||
  !Number.isInteger(war.teamSize)||war.teamSize<1||war.teamSize>50)return null;
 const per=war.attacksPerMember===1?1:2,capacity=war.teamSize*per;
 const own=war.clan||{},enemy=war.opponent||{};
 const ourMembers=Array.isArray(own.members)?own.members:[],
  enemyMembers=Array.isArray(enemy.members)?enemy.members:[];
 const targets=new Map(enemyMembers.map(m=>[m.tag,m]));
 const ours=extract(own).map(a=>({
  ...a,defenderName:targets.get(a.defenderTag)?.name||"Unbekanntes Ziel",
  defenderTH:validTH(targets.get(a.defenderTag)?.townHallLevel)?
   targets.get(a.defenderTag).townHallLevel:null
 }));
 const ourLookup=new Map(ourMembers.map(m=>[m.tag,m]));
 const theirs=extract(enemy).map(a=>({
  ...a,defenderName:ourLookup.get(a.defenderTag)?.name||"Unbekanntes Ziel",
  defenderTH:validTH(ourLookup.get(a.defenderTag)?.townHallLevel)?
   ourLookup.get(a.defenderTag).townHallLevel:null
 }));
 const isBattle=war.state==="inWar",isPreparation=war.state==="preparation";
 const officialCount=(side,attacks)=>{
  const n=numberOrNull(side?.attacks);
  return n!==null&&n>=attacks.length&&n<=capacity?n:attacks.length;
 };
 const ownUsed=officialCount(own,ours),enemyUsed=officialCount(enemy,theirs);
 const top=[...ours].sort(sortByPerformance)[0]||null;
 const strongest=top?{...top,
  comparison:"Sterne · Zerstörung (keine offizielle Heldentat-Wertung)"}:null;
 const sortRecent=(a,b)=>{
  if(a.order!==null&&b.order!==null)return b.order-a.order;
  if(a.order!==null)return -1;
  if(b.order!==null)return 1;
  return a.attackerName.localeCompare(b.attackerName);
 };
 const end=Date.parse(war.endTime||"");
 const start=Date.parse(war.startTime||"");
 const at=isPreparation?start:end;
 const validDate=Number.isFinite(at)?at:null;
 const remaining=validDate!==null&&validDate>now?validDate-now:null;
 const groups=[
  {key:"ours",name:String(own.name||"Unser Clan"),members:ourMembers,
   attacks:ours,used:ownUsed,stars:numberOrNull(own.stars),
   destruction:validPercent(own.destructionPercentage)?own.destructionPercentage:null},
  {key:"theirs",name:String(enemy.name||"Gegner"),members:enemyMembers,
   attacks:theirs,used:enemyUsed,stars:numberOrNull(enemy.stars),
   destruction:validPercent(enemy.destructionPercentage)?enemy.destructionPercentage:null}
 ];
 return {state:war.state,capacity,per,teamSize:war.teamSize,
  isBattle,isPreparation,isFinished:war.state==="warEnded",
  groups,
  ownUsed,enemyUsed,ownOpen:Math.max(0,capacity-ownUsed),
  enemyOpen:Math.max(0,capacity-enemyUsed),
  ownThreeStars:ours.filter(a=>a.stars===3).length,
  enemyThreeStars:theirs.filter(a=>a.stars===3).length,
  ownAverage:average(ours),enemyAverage:average(theirs),
  strongest,ourAttacks:ours.sort(sortRecent),enemyAttacks:theirs.sort(sortRecent),
  remaining,at:validDate,hasOfficialTotals:
   numberOrNull(own.attacks)!==null&&numberOrNull(enemy.attacks)!==null,
  // These are counts of available API attack records, not proof of missed hits.
  note:"Nicht erfasste Angriffe können noch ausstehen oder in Clash fehlen."
 };
}
