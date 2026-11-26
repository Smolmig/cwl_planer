// #44 shadow-only CWL group analysis. Caller must supply an already authorized,
// season-scoped group snapshot, captured server-side. No network or persistence.
// Do not feed results into the live solver before calibration/review.
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const th=v=>Number.isInteger(v)&&v>=3&&v<=30;
const int=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const states=["preparation","inWar","warEnded"];
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const finite=v=>typeof v==="number"&&Number.isFinite(v);
const context=(a,b)=>a===b?"same":a>b?"higherAttacker":"lowerAttacker";
function summary(rows){
 const n=rows.length;
 return {n,triples:rows.filter(a=>a.stars===3).length,averageStars:n?rows.reduce((s,a)=>s+a.stars,0)/n:null,
  averageDestruction:n?rows.reduce((s,a)=>s+a.destruction,0)/n:null,
  byTownHall: ["same","higherAttacker","lowerAttacker"].map(relation=>{
   const r=rows.filter(a=>context(a.attackerTh,a.defenderTh)===relation);
   return {relation,n:r.length,triples:r.filter(a=>a.stars===3).length,
    averageStars:r.length?r.reduce((s,a)=>s+a.stars,0)/r.length:null};
  })};
}
function side(raw,teamSize){
 const t=tag(raw?.tag),arr=raw?.members;
 if(!TAG.test(t)||!Array.isArray(arr)||arr.length!==teamSize)return null;
 const seen=new Set(),positions=new Set(),members=[];
 for(const m of arr){
  const p=tag(m?.tag),level=m?.townhallLevel??m?.townHallLevel;
  if(!TAG.test(p)||seen.has(p)||!th(level))return null;
  seen.add(p);
  const position=int(m.mapPosition,1,teamSize)?m.mapPosition:null;
  if(position!==null&&positions.has(position))return null;
  if(position!==null)positions.add(position);
  members.push({tag:p,townHall:level,mapPosition:position,rawAttacks:Array.isArray(m.attacks)?m.attacks:null});
 }
 return {tag:t,members};
}
// Only observations from snapshots captured before cutoff. No invented exact
// attack times: observedAt is the snapshot time, order is official battle order.
// Current war snapshot itself has no proof of historical base layout equality.
export function analyzeCwlGroup({snapshot,selectedClanTag,season,asOf}={}){
 const own=tag(selectedClanTag);
 if(!TAG.test(own)||!/^\d{4}-(0[1-9]|1[0-2])$/.test(season||"")||
   !finite(asOf)||!snapshot||snapshot.season!==season||tag(snapshot.clanTag)!==own||
   !finite(snapshot.observedAt)||snapshot.observedAt>asOf||!Array.isArray(snapshot.clans)||!Array.isArray(snapshot.rounds))
  throw Error("invalid_group_scope_or_cutoff");
 const clans=snapshot.clans.map(c=>tag(c?.tag));
 if(![6,8].includes(clans.length)||new Set(clans).size!==clans.length||!clans.includes(own)||clans.some(t=>!TAG.test(t)))throw Error("invalid_group_clans");
 const days=clans.length-1;
 if(snapshot.rounds.length>days)throw Error("invalid_group_rounds");
 const audit={missing:0,invalid:0,duplicateWar:0,incompleteAttackLogs:0,unknownAttackOrder:0,excludedSpecialFormat:0,availableWars:0};
 const candidates=[],warCounts=new Map(),roundDays=new Set();
 for(const round of snapshot.rounds){
  if(!int(round?.day,1,days)||roundDays.has(round.day)||!Array.isArray(round.matches)||round.matches.length>clans.length/2)throw Error("invalid_group_rounds");
  roundDays.add(round.day);
  for(const w of round.matches){
   if(!w?.available){audit.missing++;continue}
   const key=tag(w.warTag);
   if(!TAG.test(key)){audit.invalid++;continue}
   warCounts.set(key,(warCounts.get(key)||0)+1);
   candidates.push({day:round.day,w,key});
  }
 }
 const players=new Map(),upcoming=[],wars=[],ownStars=new Map();
 // Reject ambiguous repeated team/pair identity, not first-wins.
 const pairCounts=new Map(),dayClanCounts=new Map();
 for(const {day,w} of candidates){
  const a=tag(w.clan?.tag),b=tag(w.opponent?.tag);
  if(!clans.includes(a)||!clans.includes(b)||a===b)continue;
  const pair=[a,b].sort().join("|");pairCounts.set(pair,(pairCounts.get(pair)||0)+1);
  for(const t of [a,b]){const k=day+"|"+t;dayClanCounts.set(k,(dayClanCounts.get(k)||0)+1)}
 }
 for(const {day,w,key} of candidates){
  if(warCounts.get(key)!==1){audit.duplicateWar++;continue}
  const aTag=tag(w.clan?.tag),bTag=tag(w.opponent?.tag),pair=[aTag,bTag].sort().join("|");
  if(!clans.includes(aTag)||!clans.includes(bTag)||aTag===bTag||pairCounts.get(pair)!==1||
     dayClanCounts.get(day+"|"+aTag)!==1||dayClanCounts.get(day+"|"+bTag)!==1||
     !states.includes(w.state)||![15,30].includes(w.teamSize)){audit.invalid++;continue}
  if(w.attacksPerMember!==undefined&&w.attacksPerMember!==1){audit.excludedSpecialFormat++;continue}
  const a=side(w.clan,w.teamSize),b=side(w.opponent,w.teamSize);
  if(!a||!b||a.members.some(m=>b.members.some(n=>n.tag===m.tag))){audit.invalid++;continue}
  audit.availableWars++;
  const our=a.tag===own?a:b.tag===own?b:null;
  const enemy=our===a?b:our===b?a:null;
  if(w.state==="preparation"){
   if(enemy)upcoming.push({day,warTag:key,opponentTag:enemy.tag,teamSize:w.teamSize,
    roster:enemy.members.map(({tag,townHall,mapPosition})=>({tag,townHall,mapPosition})),ownRoster:our.members.map(({tag,townHall,mapPosition})=>({tag,townHall,mapPosition})),
    status:"confirmed_preparation_roster"});
   continue; // never interpret preparation attacks/score
  }
  const entries=[],orders=new Set(),badOrders=new Set(),badAttackers=new Set();
  let complete=true,orderComplete=true;
  for(const [s,o] of [[a,b],[b,a]]){
   const lookup=new Map(o.members.map(m=>[m.tag,m]));
   for(const m of s.members){
    if(m.rawAttacks===null||m.rawAttacks.length>1){complete=false;badAttackers.add(m.tag);continue}
    for(const raw of m.rawAttacks){
     const target=lookup.get(tag(raw?.defenderTag)),stars=raw?.stars,d=raw?.destructionPercentage;
     if(tag(raw?.attackerTag)!==m.tag||!target||!int(stars,0,3)||!finite(d)||d<0||d>100||
       (stars===3&&d!==100)||(d===100&&stars!==3)){
      complete=false;badAttackers.add(m.tag);continue;
     }
     const order=int(raw.order,1,2*w.teamSize)?raw.order:null;
     if(order===null)orderComplete=false;
     else if(orders.has(order)){badOrders.add(order);orderComplete=false;complete=false}
     else orders.add(order);
     entries.push({warTag:key,day,observedAt:snapshot.observedAt,attackerClan:s.tag,defenderClan:o.tag,
      attackerTag:m.tag,defenderTag:target.tag,attackerTh:m.townHall,defenderTh:target.townHall,
      attackerPosition:m.mapPosition,defenderPosition:target.mapPosition,stars,destruction:d,order});
    }
   }
  }
  const observed=entries.filter(e=>!badAttackers.has(e.attackerTag)&&!badOrders.has(e.order));
  if(!complete)audit.incompleteAttackLogs++;
  // If not all global orders are continuous, some attacks may be hidden.
  if(orders.size&&Math.max(...orders)!==orders.size)orderComplete=false;
  if(!orderComplete)audit.unknownAttackOrder++;
  const first=new Map();
  if(complete&&orderComplete)for(const e of [...observed].sort((a,b)=>a.order-b.order)){
   if(!first.has(e.defenderTag))first.set(e.defenderTag,e.order);
  }
  for(const e of observed){
   if(e.attackerClan===own)ownStars.set(e.attackerTag,(ownStars.get(e.attackerTag)||0)+e.stars);
   e.firstHit=complete&&orderComplete?first.get(e.defenderTag)===e.order:null;
   for(const [clan,p,t,kind] of [[e.attackerClan,e.attackerTag,e.attackerTh,"attack"],[e.defenderClan,e.defenderTag,e.defenderTh,"defense"]]){
    const k=JSON.stringify([clan,p,t]);
    if(!players.has(k))players.set(k,{clanTag:clan,playerTag:p,townHall:t,attack:[],defense:[]});
    players.get(k)[kind].push(e);
   }
  }
  wars.push({day,warTag:key,state:w.state,teamSize:w.teamSize,clans:[a.tag,b.tag],
    observedAttacks:observed.length,completeAttackLists:complete,firstHitKnown:complete&&orderComplete,
    ...(our?{ownRoster:our.members.map(({tag,townHall,mapPosition})=>({tag,townHall,mapPosition})),opponentTag:enemy.tag}:{})});
 }
 const profiles=[...players.values()].map(p=>{
  const defense=p.defense,byWar=new Map();
  for(const e of defense){if(!byWar.has(e.warTag))byWar.set(e.warTag,[]);byWar.get(e.warTag).push(e)}
  const first=defense.filter(e=>e.firstHit===true);
  return {clanTag:p.clanTag,playerTag:p.playerTag,townHall:p.townHall,
   attack:summary(p.attack),defense:{...summary(defense),observedWars:byWar.size,
    tripledWars:[...byWar.values()].filter(es=>es.some(e=>e.stars===3)).length,
    firstHits:summary(first),firstHitUnknown:defense.filter(e=>e.firstHit===null).length,
    distinctAttackers:new Set(defense.map(e=>e.attackerTag)).size},
   layoutUnverified:true};
 }).sort((a,b)=>cmp(a.clanTag,b.clanTag)||cmp(a.playerTag,b.playerTag)||a.townHall-b.townHall);
 return {season,selectedClanTag:own,asOf,observedAt:snapshot.observedAt,calibrated:false,
  profiles,upcoming:upcoming.sort((a,b)=>a.day-b.day),wars,audit,
  ownMedals:{stars:[...ownStars].map(([playerTag,stars])=>({playerTag,stars})).sort((a,b)=>cmp(a.playerTag,b.playerTag)),
   complete:upcoming.length+wars.filter(w=>w.ownRoster).length===days&&wars.filter(w=>w.ownRoster).every(w=>w.completeAttackLists)},
  limitations:["observed_attacks_only","no_exact_attack_timestamp","no_layout_identity","no_win_probability","no_automatic_assignment"]};
}
