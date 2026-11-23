// Read-only CWL deployment history. Sources are ONLY the saved plan at
// archive time and authenticated, server-archived Clash rosters of the exact
// season / clan / war. No current members, solver goals or guessed attacks.
const validTag=value=>/^#[0289PYLQGRJCUV]{3,15}$/.test(String(value||"").trim().toUpperCase());
const tag=value=>String(value||"").trim().toUpperCase();
const seasonValid=value=>/^20\d{2}-(0[1-9]|1[0-2])$/.test(String(value||""));
const safeCount=(value,max=7)=>Number.isInteger(value)&&value>=0&&value<=max?value:null;
const validAttack=value=>Number.isInteger(value?.stars)&&value.stars>=0&&value.stars<=3;
const planList=value=>Array.isArray(value)?value:[];
const rosterValid=(members,size)=>Number.isInteger(size)&&size>=1&&size<=50&&
 Array.isArray(members)&&members.length===size&&members.every(m=>validTag(m?.tag))&&
 new Set(members.map(m=>tag(m.tag))).size===size;
const emptyDays=count=>Array.from({length:count},()=>({planned:false,actual:false,ended:false,attacks:null,stars:null}));
function officialWarForDay(group,day){
 if(!group||!seasonValid(group.season)||!validTag(group.clanTag))return null;
 const round=planList(group.rounds).find(r=>r?.day===day);
 if(!round)return null;
 const matches=planList(round.matches).filter(m=>m?.available&&validTag(m.warTag)&&
  (tag(m.clan?.tag)===tag(group.clanTag)||tag(m.opponent?.tag)===tag(group.clanTag)));
 return matches.length===1?matches[0]:null;
}
function expectedWar(plan,group,day){
 const official=officialWarForDay(group,day);
 if(official)return {season:group.season,clanTag:tag(group.clanTag),
  warTag:tag(official.warTag),size:official.teamSize};
 // Never attach server roster merely because a month label happens to match.
 const s=plan?.cwlLive;
 if(!seasonValid(plan?.sourceSeason)||s?.season!==plan.sourceSeason||
  !validTag(s?.clanTag))return null;
 const round=planList(s.rounds).find(x=>x?.day===day&&x.available&&validTag(x.warTag)&&
  tag(x.clan?.tag)===tag(s.clanTag));
 if(!round)return null;
 return {season:s.season,clanTag:tag(s.clanTag),warTag:tag(round.warTag),size:round.teamSize};
}
function savedWar(plan,day,identity){
 const s=plan?.cwlLive;
 if(!s||s.season!==identity.season||tag(s.clanTag)!==identity.clanTag)return null;
 const rounds=planList(s.rounds).filter(r=>r?.day===day&&r?.available&&
  ["inWar","warEnded"].includes(r?.state)&&tag(r.warTag)===identity.warTag&&
  r.teamSize===identity.size&&tag(r.clan?.tag)===identity.clanTag&&
  rosterValid(r.clan?.members,identity.size));
 if(rounds.length!==1)return null;
 return {state:rounds[0].state,members:rounds[0].clan.members,source:"saved"};
}
function confirmedWar(ownRows,day,identity){
 const rows=planList(ownRows).filter(r=>r?.season===identity.season&&r.day===day&&
  tag(r.war_tag)===identity.warTag&&r.team_size===identity.size&&
  ["inWar","warEnded"].includes(r.state)&&rosterValid(r.lineup_json?.members,identity.size));
 if(rows.length!==1)return null;
 return {state:rows[0].state,members:rows[0].lineup_json.members,source:"server"};
}
function betterRoster(a,b){
 if(!a)return b;if(!b)return a;
 const score=x=>Number(x.state==="warEnded")*1000+
  x.members.reduce((n,m)=>n+planList(m.attacks).filter(validAttack).length,0);
 return score(b)>score(a)?b:a;
}
function archiveMetadata(plan,id){
 const meta=plan?.deploymentSnapshot;
 if(meta?.version!==1||!Number.isFinite(meta.capturedAt)||!Array.isArray(meta.players))return null;
 const row=meta.players.find(m=>String(m?.id)===String(id));
 if(!row)return null;
 return {role:row.participating===false?"Nicht markiert":row.fixed===true?"Fix":row.fixed===false?"Rotation":null,
  goal:Object.hasOwn(row,"targetDays")?
   row.targetDays===null?"Automatisch":safeCount(row.targetDays)??null:null,
  knownGoal:Object.hasOwn(row,"targetDays")&&(row.targetDays===null||safeCount(row.targetDays)!==null)};
}
export function summarizeArchivedDeployments({plan=null,group=null,ownRows=[]}={}){
 const warCount=group?.warCount===5||plan?.days===5&&group?.warCount!==7?5:7;
 const people=new Map(),tags=new Map(),ambiguousTags=new Set();
 function newPerson(key,name,playerTag,id=null){
  const p={key,id,name:String(name||playerTag||"Unbekannt"),tag:validTag(playerTag)?tag(playerTag):"",
   role:null,goal:null,knownGoal:false,days:emptyDays(warCount),
   planned:0,actual:0,completed:0,attacks:0,stars:0,goal8:"unknown"};
  people.set(key,p);return p;
 }
 const plannedPlayers=planList(plan?.players);
 for(const record of plannedPlayers){
  if(record?.id==null)continue;
  const id=String(record.id),key="id:"+id;
  if(people.has(key))continue;
  const p=newPerson(key,record.name,record.playerTag,id),meta=archiveMetadata(plan,id);
  if(meta){p.role=meta.role;p.goal=meta.goal;p.knownGoal=meta.knownGoal;}
  if(p.tag){
   if(tags.has(p.tag)){ambiguousTags.add(p.tag);tags.delete(p.tag)}
   else if(!ambiguousTags.has(p.tag))tags.set(p.tag,p);
  }
 }
 const seenPlanDays=new Set();
 for(const lineup of planList(plan?.lineups)){
  const day=lineup?.day;
  if(!Number.isInteger(day)||day<1||day>warCount||seenPlanDays.has(day))continue;
  seenPlanDays.add(day);
  const playersInDay=new Set();
  for(const rawId of planList(lineup.lineup)){
   const id=String(rawId);
   if(playersInDay.has(id))continue;playersInDay.add(id);
   let p=people.get("id:"+id);
   if(!p){
    const saved=lineup.snapshots?.[id];
    p=newPerson("id:"+id,saved?.name||"Unbekannt",saved?.playerTag,id);
    const meta=archiveMetadata(plan,id);
    if(meta){p.role=meta.role;p.goal=meta.goal;p.knownGoal=meta.knownGoal}
    if(p.tag&&!ambiguousTags.has(p.tag)){
     if(tags.has(p.tag)){tags.delete(p.tag);ambiguousTags.add(p.tag)}
     else tags.set(p.tag,p);
    }
   }
   p.days[day-1].planned=true;p.planned++;
  }
 }
 let actualDays=0,endedDays=0;
 const verifiedDays=new Set(),endedVerifiedDays=new Set();
 for(let day=1;day<=warCount;day++){
  const identity=expectedWar(plan,group,day);
  if(!identity)continue;
  const server=confirmedWar(ownRows,day,identity);
  const local=savedWar(plan,day,identity);
  const verified=betterRoster(local,server);
  if(!verified)continue;
  actualDays++;verifiedDays.add(day);
  const fullFinal=verified.state==="warEnded"&&verified.members.every(m=>
   Array.isArray(m.attacks)&&m.attacks.every(validAttack));
  if(fullFinal){endedDays++;endedVerifiedDays.add(day)}
  for(const member of verified.members){
   const memberTag=tag(member.tag);
   let p=!ambiguousTags.has(memberTag)?tags.get(memberTag):null;
   if(!p){
    const k="tag:"+memberTag;
    p=people.get(k)||newPerson(k,member.name,memberTag);
    people.set(k,p);if(!ambiguousTags.has(memberTag))tags.set(memberTag,p);
   }
   const cell=p.days[day-1];
   cell.actual=true;cell.ended=fullFinal;
   const attacks=planList(member.attacks).filter(validAttack);
   cell.attacks=attacks.length;cell.stars=attacks.reduce((n,a)=>n+a.stars,0);
   p.actual++;
   if(cell.ended)p.completed++;
   if(cell.ended){p.attacks+=cell.attacks;p.stars+=cell.stars;}
  }
 }
 const completeHistory=endedDays===warCount;
 const players=[...people.values()];
 for(const p of players)p.goal8=p.stars>=8?"reached":completeHistory?"below":"unknown";
 players.sort((a,b)=>b.actual-a.actual||b.planned-a.planned||
  a.name.localeCompare(b.name,"de")||a.key.localeCompare(b.key));
 return {players,warCount,plannedDays:seenPlanDays.size,actualDays,endedDays,
  completeHistory,verifiedDays:[...verifiedDays],endedVerifiedDays:[...endedVerifiedDays],
  hasHistoricalGoals:players.some(p=>p.knownGoal)};
}
