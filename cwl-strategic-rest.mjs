// Global strategic assignment using the existing hard-constraint min-cost
// solver. Unknown future pairings are provisional, not actual attack targets.
const MODES={performance:{rotation:24,medal:8,development:0},balanced:{rotation:90,medal:110,development:12},development:{rotation:100,medal:135,development:65}};
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
const same=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&new Set(b).size===b.length&&a.every(x=>b.includes(x));
const th=x=>Number.isInteger(x)&&x>=3&&x<=30;
const exact=m=>m.targetDays!=null&&m.targetDays!=="";
function matching(p,a,b){
 const cells=(p?.contexts||[]).filter(c=>c.attackerTh===a&&c.defenderTh===b&&Number.isInteger(c.n)&&c.n>0&&Number.isFinite(c.smoothedStars)&&c.smoothedStars>=0&&c.smoothedStars<=3);
 const n=cells.reduce((s,c)=>s+c.n,0),w=cells.reduce((s,c)=>s+c.n*(c.kind==="cwl"?2:1),0);
 return n>=4&&w?{n,index:cells.reduce((s,c)=>s+c.smoothedStars*c.n*(c.kind==="cwl"?2:1),0)/w}:null;
}
export function planStrategicRest({group,evidence,registered,members,currentPlan,manualLocks,mode,slots,days,planStandard}){
 const fail=reason=>({ok:false,reason,changes:[],warnings:[]});
 if(!Object.hasOwn(MODES,mode)||!registered?.verified||registered.season!==group?.season||tag(registered.clanTag)!==group.selectedClanTag||registered.observedAt!==group.observedAt||
 !Array.isArray(registered.tags)||!Array.isArray(members)||!Array.isArray(currentPlan)||currentPlan.length!==days||typeof planStandard!=="function"||![15,30].includes(slots)||![5,7].includes(days))return fail("scope");
 const byTag=new Map(members.map(m=>[tag(m.playerTag),m.id])),ids=new Map(members.map(m=>[m.id,m])),reg=new Set(registered.tags);
 if(byTag.size!==members.length||ids.size!==members.length||reg.size!==registered.tags.length)return fail("identity");
 const locks=Array.from({length:days},()=>({locked:false,lineup:[]})),known=new Map(),provisional=[],held=[];
 const base=currentPlan.map(p=>({day:p.day,lineup:[...p.lineup]}));
 if(base.some((p,i)=>p.day!==i+1||p.lineup.length!==slots||new Set(p.lineup).size!==slots||p.lineup.some(id=>!ids.has(id))))return fail("current_plan");
 for(const l of manualLocks||[]){
  if(!Number.isInteger(l.day)||l.day<1||l.day>days||locks[l.day-1].locked||!same(l.lineup,base[l.day-1].lineup))return fail("lock");
  locks[l.day-1]={locked:true,lineup:[...l.lineup]};
 }
 const actualDays=new Set();let lastStarted=0;
 for(const w of group.wars||[]){
  if(!w.ownRoster)continue;
  if(!Number.isInteger(w.day)||w.day<1||w.day>days||actualDays.has(w.day)||w.teamSize!==slots||!["inWar","warEnded"].includes(w.state))return fail("actual_day");
  actualDays.add(w.day);lastStarted=Math.max(lastStarted,w.day);
  const actual=w.ownRoster.map(m=>byTag.get(tag(m.tag)));
  if(!same(actual,base[w.day-1].lineup))return fail("actual_lineup");
  locks[w.day-1]={locked:true,lineup:[...base[w.day-1].lineup]};
 }
 for(const w of group.upcoming||[]){
  if(!Number.isInteger(w.day)||w.day<=lastStarted||w.day>days||actualDays.has(w.day)||known.has(w.day)||w.teamSize!==slots||
    w.status!=="confirmed_preparation_roster"||w.roster?.length!==slots||w.roster.some(m=>!th(m.townHall)))return fail("preparation");
  // The Clash preparation roster can differ from the desired app plan.
  // Do not pretend either has been applied in-game. Future day assignment
  // is a proposal even if the current in-game lineup differs.
  known.set(w.day,w);
 }
 // A missing earlier day could already have started. Keep it frozen; only
 // plan unknown rounds AFTER the latest verified own war/preparation.
 const horizon=Math.max(lastStarted,...known.keys(),0);
 if(!horizon)return fail("unknown_phase");
 for(let d=1;d<=days;d++){
  if(locks[d-1].locked)continue;
  if(!known.has(d)&&d<=horizon){locks[d-1]={locked:true,lineup:[...base[d-1].lineup]};held.push(d)}
  else if(!known.has(d))provisional.push(d);
 }
 const roster=members.map(m=>({...m,participating:m.participating===true&&reg.has(tag(m.playerTag))&&m.cocSyncState!=="former"&&m.participationIntent!=="no"}));
 const active=roster.filter(m=>m.participating);
 const profiles=new Map(evidence.profiles.map(p=>[p.id,p])),strength=new Map((group.clanStrength||[]).map(x=>[x.clanTag,x]));
 const maxRh=Math.max(...active.map(m=>m.townHall)),rules=MODES[mode],match=new Map(),warnings=[];
 const stars=new Map((group.ownMedals?.stars||[]).map(x=>[x.playerTag,x.stars]));
 const complete=group.ownMedals?.complete===true;
 for(const m of active)for(let d=1;d<=days;d++){
  const w=known.get(d),p=profiles.get(m.id),dist=new Map();
  if(w)for(const o of w.roster)dist.set(o.townHall,(dist.get(o.townHall)||0)+1);
  const ref=w?[...dist].sort((a,b)=>Math.abs(a[0]-m.townHall)-Math.abs(b[0]-m.townHall)||b[1]-a[1]||b[0]-a[0])[0][0]:m.townHall;
  const cell=matching(p,m.townHall,ref),op=strength.get(w?.opponentTag),pressure=op?.attack?.adjusted==null?1:Math.max(.85,Math.min(1.2,1+(op.attack.adjusted-2.5)*.2));
  // Missing evidence receives neutral form, not a zero. RH mismatch is a
  // modest heuristic, not an expected star forecast. Actual target capacity
  // and primary target matching remain a separate step.
  const index=(cell?.index??2.5)-Math.max(0,ref-m.townHall)*.35;
  match.set(m.id+"|"+d,{cell,ref,index,pressure});
 }
 const dayCosts=active.map(m=>({id:m.id,costs:Array.from({length:days},(_,i)=>{
  const d=i+1,x=match.get(m.id+"|"+d),existing=base[i].lineup.includes(m.id);
  const value=(3-x.index)*180*x.pressure+Math.max(0,maxRh-m.townHall)*(known.has(d)?24:12);
  return Math.max(0,Math.round(value)+(existing?0:8));
 })}));
 const countCosts=active.map(m=>({id:m.id,costs:Array.from({length:days},(_,i)=>{
  const n=i+1,lower=stars.get(m.playerTag)||0,need=complete?Math.ceil(Math.max(0,8-lower)/3):3;
  const observed=profiles.get(m.id),development=observed?.n>=4&&Number.isFinite(observed.score)?Math.max(0,2.6-observed.score):0;
  const played=locks.filter(l=>l.locked&&l.lineup.includes(m.id)).length;
  // Protect an ordinary first appearance whenever feasible; increasing
  // marginal costs preserve the solver's ordered nth-assignment invariant.
  return n===1?0:Math.round(1600+rules.rotation*(2*n-1)+(n>played+need?rules.medal:0)+(n>3?rules.development*development:0));
 })}));
 // Warn only on a clear comparable disadvantage; respect FIX/MUSS regardless.
 if(mode==="performance")for(const m of active)for(const [day] of known){
  if(locks[day-1].locked||m.statuses[day-1]==="out"||!m.fixed&&m.statuses[day-1]!=="must")continue;
  const a=match.get(m.id+"|"+day);
  if(!a.cell||a.cell.n<8)continue;
  const b=active.filter(x=>x.id!==m.id&&x.townHall===m.townHall&&!x.fixed&&!exact(x)&&!["must","out"].includes(x.statuses[day-1]))
    .find(x=>{const c=match.get(x.id+"|"+day);return c.cell?.n>=8&&c.ref===a.ref&&c.cell.index-a.cell.index>=.25});
  if(b)warnings.push({day,id:m.id,alternative:b.id});
 }
 const standard=planStandard({members:roster,locks,slots,days});
 if(!standard.ok)return fail("hard_rules");
 const result=planStandard({members:roster,locks,slots,days,strategicObjective:{mode,dayCosts,countCosts}});
 if(!result.ok)return fail("hard_rules");
 // No statistical zero-appearance exclusion, even if an expensive long
 // augmenting path would defeat the first-seat preference.
 const chosen=active.some(m=>standard.counts[m.id]>0&&result.counts[m.id]===0)?standard:result;
 const changes=chosen.dayPlans.flatMap((p,i)=>{
  const added=p.lineup.filter(id=>!base[i].lineup.includes(id)),removed=base[i].lineup.filter(id=>!p.lineup.includes(id));
  return added.length||removed.length?[{day:p.day,added,removed}]:[];
 });
 return {ok:true,plan:chosen.dayPlans.map(p=>({day:p.day,lineup:[...p.lineup]})),changes,warnings,provisionalDays:provisional,heldDays:held,
  confirmedDays:[...known.keys()].filter(d=>!locks[d-1].locked),fallback:chosen===standard?"minimum_appearance":null,calibrated:false};
}
