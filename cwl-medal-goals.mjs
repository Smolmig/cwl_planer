// Read-only CWL medal-goal hints. No writes, no solver/lineup mutation and
// no made-up success probabilities. Official full regular medal share: 8 stars.
export const MEDAL_GOAL_STARS = 8;

const tag = value => {
 const valueString=String(value||"").trim().toUpperCase();
 return valueString.startsWith("#")?valueString:(valueString?"#"+valueString:"");
};
const validStar = value => Number.isInteger(value)&&value>=0&&value<=3;
const hasExactGoal = member => member?.targetDays!==null && member?.targetDays!==undefined && member?.targetDays!=="";

// Snapshot attacks lack a stable full ordering. A target attacked by two
// members cannot safely produce a per-player medal total: count uncertain
// stars as possible (never confirmed), rather than treating them as two fresh hits.
export function evaluateEightStarGoals({snapshot,profile,dayPlans=[]}={}){
 if(!snapshot?.season||!profile||!Array.isArray(profile.members))return null;
 const days=Number.isInteger(profile.config?.days)?Math.max(1,Math.min(7,profile.config.days)):7;
 const members=profile.members.filter(m=>m?.id&&m?.participating&&tag(m.playerTag));
 const rounds=new Map((snapshot.rounds||[]).filter(r=>r?.day).map(r=>[r.day,r]));
 const plans=new Map((Array.isArray(dayPlans)?dayPlans:[]).filter(p=>p?.day).map(p=>[p.day,p]));
 const rows=[];
 const auditComplete=(r)=>r?.available&&
  ["inWar","warEnded"].includes(r.state)&&
  Array.isArray(r.clan?.members)&&Number.isInteger(r.teamSize)&&r.teamSize>0&&
  r.clan.members.length===r.teamSize;
 const hasResults=[...rounds.values()].some(r=>
  auditComplete(r)&&r.clan.members.some(m=>Array.isArray(m.attacks)&&m.attacks.length));
 for(const member of members){
  const playerTag=tag(member.playerTag);
  let stars=0,uncertainStars=0,futureAttacks=0,attackCount=0,unknownDays=0;
  let planUnknown=false;
  for(let day=1;day<=days;day++){
   const round=rounds.get(day),plan=plans.get(day);
   if(auditComplete(round)){
    const players=round.clan.members;
    const actual=players.find(p=>tag(p.tag)===playerTag);
    const attacks=Array.isArray(actual?.attacks)?actual.attacks:[];
    const opponentTargets=new Map();
    for(const p of players)for(const a of p.attacks||[]){
     const target=tag(a?.defenderTag);
     if(target)opponentTargets.set(target,(opponentTargets.get(target)||0)+1);
    }
    for(const attack of attacks){
     if(!validStar(attack?.stars)){uncertainStars+=3;continue}
     attackCount++;
     if(opponentTargets.get(tag(attack.defenderTag))>1)uncertainStars+=attack.stars;
     else stars+=attack.stars;
    }
    if(round.state==="inWar"&&actual&&attacks.length===0)futureAttacks++;
    continue;
   }
   if(round?.available&&["inWar","warEnded"].includes(round.state)){
    // Roster incomplete: a partial Clash result cannot mean 0 stars.
    if(plan?.lineup?.includes(member.id)){uncertainStars+=3;unknownDays++}
    else planUnknown=true;
    continue;
   }
   if(plan?.locked){
    if(plan.lineup?.includes(member.id)){uncertainStars+=3;unknownDays++}
   }else if(Array.isArray(plan?.lineup)){
    if(plan.lineup.includes(member.id))futureAttacks++;
   }else{
    planUnknown=true;
   }
  }
  const guaranteedShare=Math.min(100,20+10*Math.min(MEDAL_GOAL_STARS,stars));
  const potentialMax=stars+uncertainStars+futureAttacks*3;
  const reached=stars>=MEDAL_GOAL_STARS;
  const unknown=uncertainStars>0||planUnknown;
  const status=reached?"reached":unknown?"uncertain":
   potentialMax<MEDAL_GOAL_STARS?"not-reachable":"possible";
  rows.push({id:member.id,name:String(member.name||playerTag),playerTag,
   stars,uncertainStars,unknownDays,attackCount,futureAttacks,
   potentialMax,guaranteedShare,unknown,status,
   remainingStars:Math.max(0,MEDAL_GOAL_STARS-stars),
   fixed:!!member.fixed,hasExactGoal:hasExactGoal(member)});
 }
 rows.sort((a,b)=>{
  const rank={ "not-reachable":0,uncertain:1,possible:2,reached:3 };
  return rank[a.status]-rank[b.status]||a.stars-b.stars||a.name.localeCompare(b.name,"de");
 });
 return {season:snapshot.season,rows,hasResults,goal:MEDAL_GOAL_STARS,
  reached:rows.filter(r=>r.status==="reached").length,
  notReachable:rows.filter(r=>r.status==="not-reachable").length,
  uncertain:rows.filter(r=>r.status==="uncertain").length};
}

// Only a nonbinding *example* for a verified preparation day, never an instruction to
// update Clash. Exact targets, fixed status, MUST/RAUS rules and started wars
// are non-negotiable. A further solver-level validation is required to apply.
export function findReadOnlyMedalSwap({assessment,profile,snapshot,dayPlans=[]}={}){
 if(!assessment||!profile||!snapshot)return null;
 const members=new Map((profile.members||[]).map(m=>[m.id,m]));
 const plans=Array.isArray(dayPlans)?dayPlans:[];
 const recipients=assessment.rows.filter(r=>r.status==="not-reachable"&&!r.fixed&&!r.hasExactGoal);
 const donors=assessment.rows.filter(r=>r.status==="reached"&&!r.fixed&&!r.hasExactGoal);
 for(const recipient of recipients){
  if(recipient.stars+(recipient.futureAttacks+1)*3<MEDAL_GOAL_STARS)continue;
  const receiver=members.get(recipient.id);
  if(!receiver)continue;
  for(const plan of plans){
   const day=plan?.day,round=snapshot.rounds?.find(r=>r.day===day);
   if(!Number.isInteger(day)||plan.locked||!round?.available||round.state!=="preparation"||
      !Array.isArray(plan.lineup)||plan.lineup.length!==profile.config?.slots||plan.warnings?.length||
      plan.lineup.includes(recipient.id)||receiver.statuses?.[day-1]!=="auto"&&receiver.statuses?.[day-1]!==undefined)continue;
   for(const donor of donors){
    const player=members.get(donor.id);
    if(!player||!plan.lineup.includes(donor.id)||player.statuses?.[day-1]==="must")continue;
    return {day,outId:donor.id,outName:donor.name,inId:recipient.id,inName:recipient.name,
     recipientStars:recipient.stars,recipientFuture:recipient.futureAttacks,
     reason:"Zusätzliche Einsatzchance kann das 8-Sterne-Ziel rechnerisch erreichbar machen."};
   }
  }
 }
 return null;
}
