// #44 read-only daily scenario coordinator. Never apply a plan, mode or
// in-game attack automatically. Callers must independently enforce RLS,
// verify the season roster and authorize any later application with CAS.
import {previewStrategicTargets} from "./cwl-strategic-targets.mjs";
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const th=x=>Number.isInteger(x)&&x>=3&&x<=30;
const MODES=Object.freeze({
 performance:{rotation:.035,medal:.025,development:0},
 balanced:{rotation:.12,medal:.38,development:.04},
 development:{rotation:.18,medal:.48,development:.15}
});
const eqSet=(a,b)=>Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&new Set(a).size===a.length&&new Set(b).size===b.length&&a.every(x=>b.includes(x));
const cmp=(a,b)=>a<b?-1:a>b?1:0;
const exact=m=>m.targetDays!==null&&m.targetDays!==undefined&&m.targetDays!=="";
function counts(plan,ids,filter=()=>true){
 const result=new Map(ids.map(id=>[id,0]));
 for(const p of plan.filter(filter))for(const id of p.lineup)result.set(id,(result.get(id)||0)+1);
 return result;
}
function context(p,a,b){
 if(p?.townHall!==a||!Array.isArray(p.contexts))return null;
 const cells=p.contexts.filter(c=>c.attackerTh===a&&c.defenderTh===b&&["normal","cwl"].includes(c.kind)&&
   Number.isInteger(c.n)&&c.n>0&&finite(c.smoothedStars)&&c.smoothedStars>=0&&c.smoothedStars<=3);
 if(new Set(cells.map(c=>c.kind)).size!==cells.length)return null;
 const n=cells.reduce((s,c)=>s+c.n,0),w=cells.reduce((s,c)=>s+c.n*(c.kind==="cwl"?2:1),0);
 return n>=4&&w?{n,index:cells.reduce((s,c)=>s+c.smoothedStars*c.n*(c.kind==="cwl"?2:1),0)/w}:null;
}
export function previewDailyStrategy({group,standings,evidence,members=[],registered,currentPlan=[],manualLocks=[],mode,role,declined=[],asOf,season,selectedClanTag,slots=15,days=7}={}){
 const own=tag(selectedClanTag);
 if(!TAG.test(own)||!finite(asOf)||!Object.hasOwn(MODES,mode)||!["owner","vice","viewer"].includes(role)||
  ![5,7].includes(days)||![15,30].includes(slots)||!Array.isArray(members)||!Array.isArray(currentPlan)||!Array.isArray(manualLocks)||!Array.isArray(declined)||
  !group||!standings||!evidence||group.season!==season||standings.season!==season||
  group.selectedClanTag!==own||standings.selectedClanTag!==own||group.asOf!==asOf||standings.asOf!==asOf||evidence.asOf!==asOf||
  !finite(group.observedAt)||group.observedAt!==standings.observedAt||group.observedAt>asOf||standings.teamSize!==slots||
  !Array.isArray(group.upcoming)||!Array.isArray(group.wars)||!Array.isArray(group.profiles)||!Array.isArray(evidence.profiles))
  throw Error("invalid_daily_scope");
 const blocked=(reason,details=[])=>({ok:false,reason,details,mode,calibrated:false,changes:[],modeRecommendation:null,canApply:false});
 if(registered?.verified!==true||registered.season!==season||tag(registered.clanTag)!==own||
  registered.observedAt!==group.observedAt||!Array.isArray(registered.tags))return blocked("unverified_season_roster");
 const registeredTags=registered.tags.map(tag);
 if(registeredTags.length<slots||registeredTags.length>50||new Set(registeredTags).size!==registeredTags.length||registeredTags.some(t=>!TAG.test(t)))return blocked("invalid_season_roster");
 const ids=new Map(),tags=new Map(),profiles=new Map();
 for(const m of members){
  const t=tag(m?.playerTag);
  if(typeof m?.id!=="string"||!m.id||ids.has(m.id)||tags.has(t)||!TAG.test(t)||!th(m.townHall))return blocked("invalid_member_identity");
  ids.set(m.id,{...m,playerTag:t,statuses:Array.isArray(m.statuses)?[...m.statuses]:[]});tags.set(t,m.id);
 }
 for(const p of evidence.profiles){
  if(!TAG.test(tag(p?.playerTag))||profiles.has(tag(p.playerTag)))return blocked("invalid_evidence_identity");
  profiles.set(tag(p.playerTag),p);
 }
 const eligible=m=>registeredTags.includes(m.playerTag)&&m.participating===true&&m.participationIntent!=="no"&&m.cocSyncState!=="former";
 const base=currentPlan.map(p=>({day:p?.day,lineup:Array.isArray(p?.lineup)?[...p.lineup]:[]}));
 if(base.length!==days||base.some((p,i)=>p.day!==i+1||p.lineup.length!==slots||new Set(p.lineup).size!==slots||p.lineup.some(id=>!ids.has(id))))return blocked("invalid_current_plan");
 const lockMap=new Map();
 for(const l of manualLocks){
  if(!Number.isInteger(l?.day)||l.day<1||l.day>days||lockMap.has(l.day)||
    !eqSet(l.lineup,base[l.day-1].lineup))return blocked("manual_lock_mismatch");
  lockMap.set(l.day,true);
 }
 const dayStates=new Map();
 for(const w of group.wars.filter(w=>w.ownRoster)){
  if(!Number.isInteger(w.day)||w.day<1||w.day>days||dayStates.has(w.day)||!["inWar","warEnded"].includes(w.state)||w.teamSize!==slots)
    return blocked("ambiguous_actual_war");
  const actual=w.ownRoster.map(m=>tags.get(tag(m.tag)));
  if(!eqSet(actual,base[w.day-1].lineup))return blocked("actual_lineup_mismatch",[w.day]);
  dayStates.set(w.day,{state:w.state,warTag:w.warTag});
 }
 const preparation=new Map(),held=[];
 for(const w of group.upcoming){
  if(!Number.isInteger(w.day)||w.day<1||w.day>days||dayStates.has(w.day)||w.teamSize!==slots||w.status!=="confirmed_preparation_roster"||
    !Array.isArray(w.ownRoster)||!Array.isArray(w.roster))return blocked("ambiguous_preparation");
  dayStates.set(w.day,{state:"preparation",warTag:w.warTag});
  const actual=w.ownRoster.map(m=>tags.get(tag(m.tag)));
  if(!eqSet(actual,base[w.day-1].lineup)){held.push({day:w.day,reason:"preparation_lineup_mismatch"});continue}
  if(lockMap.has(w.day))continue;
  if(w.roster.length!==slots||new Set(w.roster.map(m=>tag(m.tag))).size!==slots||w.roster.some(m=>!TAG.test(tag(m.tag))||!th(m.townHall)))return blocked("invalid_opponent_roster");
  const d=w.day-1,lineup=new Set(base[d].lineup);
  for(const id of lineup){
   const m=ids.get(id);
   if(!eligible(m)||m.statuses[d]==="out")return blocked("current_plan_rule_conflict",[w.day,id]);
  }
  for(const m of ids.values())if(eligible(m)&&m.statuses[d]!=="out"&&(m.fixed||m.statuses[d]==="must")&&!lineup.has(m.id))return blocked("current_plan_rule_conflict",[w.day,m.id]);
  preparation.set(w.day,w);
 }
 const allIds=[...ids.keys()],original=counts(base,allIds);
 for(const m of ids.values())if(!m.fixed&&exact(m)&&(!Number.isInteger(Number(m.targetDays))||Number(m.targetDays)<0||Number(m.targetDays)>days||original.get(m.id)!==Number(m.targetDays)))return blocked("exact_target_conflict",[m.id]);
 const editable=new Set(preparation.keys()),futureDays=new Set(group.upcoming.map(w=>w.day));
 const medalStars=new Map(),medalComplete=group.ownMedals?.complete===true;
 if(Array.isArray(group.ownMedals?.stars))for(const e of group.ownMedals.stars){
  const t=tag(e.playerTag);
  if(!TAG.test(t)||medalStars.has(t)||!Number.isInteger(e.stars)||e.stars<0||e.stars>days*3)return blocked("invalid_medal_evidence");
  medalStars.set(t,e.stars);
 }
 const medal=(id,n)=>{
  const lower=medalStars.get(ids.get(id).playerTag)||0;
  // A known achieved 8 stars never needs another medal slot. An incomplete
  // log is not a known zero; suppress negative/opportunity judgments.
  if(lower>=8||!medalComplete)return 0;
  return Math.min(Math.ceil((8-lower)/3),n);
 };
 const contexts=new Map(),difficulty=[];
 for(const [day,w] of preparation){
  const distribution=new Map();
  for(const m of w.roster)distribution.set(m.townHall,(distribution.get(m.townHall)||0)+1);
  // A single identical reference target RH per own TH, nearest available
  // (tie: more numerous, then higher RH). NOT a real target allocation.
  // This prevents comparing different matchup mixes for two players.
  const levels=new Map();
  for(const m of ids.values())if(!levels.has(m.townHall)){
   const ref=[...distribution].sort((a,b)=>Math.abs(a[0]-m.townHall)-Math.abs(b[0]-m.townHall)||b[1]-a[1]||b[0]-a[0])[0][0];
   levels.set(m.townHall,ref);
  }
  const comparableOpp=w.roster.map(m=>group.profiles.find(p=>p.clanTag===w.opponentTag&&p.playerTag===m.tag&&p.townHall===m.townHall))
   .map(p=>p?.attack?.byTownHall?.find(c=>c.relation==="same")).filter(c=>c&&c.n>=2&&finite(c.averageStars)&&c.averageStars>=0&&c.averageStars<=3);
  const covered=comparableOpp.length>=Math.ceil(slots/2);
  const index=covered?comparableOpp.reduce((s,c)=>s+c.averageStars,0)/comparableOpp.length:null;
  // Day pressure uses observed same-TH opponent attack strength only as
  // an uncalibrated heuristic, no defense or winning probability inferred.
  const pressure=index===null?1:Math.max(.9,Math.min(1.15,1+(index-2.5)*.15));
  difficulty.push({day,observedPlayers:comparableOpp.length,opponentAttackIndex:index,pressure,calibrated:false});
  for(const m of ids.values()){
   const ref=levels.get(m.townHall),e=context(profiles.get(m.playerTag),m.townHall,ref);
   if(e)contexts.set(day+"|"+m.id,{...e,targetTh:ref,pressure});
  }
 }
 function optimize(start,which){
  const rules=MODES[which],plan=start.map(p=>({day:p.day,lineup:[...p.lineup]})),total=counts(plan,allIds),remaining=counts(plan,allIds,p=>futureDays.has(p.day));
  const legal=(m,d)=>eligible(m)&&!m.fixed&&!exact(m)&&!["must","out"].includes(m.statuses[d]);
  const value=(id,n,r)=>{
   const m=ids.get(id),p=profiles.get(m.playerTag),pref=m.rotationWeight==="preferred"?.04:m.rotationWeight==="less"?-.04:0;
   const development=finite(p?.score)&&p.n>=4?Math.max(0,2.6-p.score):0;
   return -rules.rotation*n*n+rules.medal*medal(id,r)+rules.development*development*Math.min(3,n)+pref*n;
  };
  for(let iter=0;iter<days*slots;iter++){
   let best=null;
   for(const p of plan){
    if(!editable.has(p.day))continue;
    const d=p.day-1,set=new Set(p.lineup);
    for(const out of p.lineup){
     const a=ids.get(out),ac=contexts.get(p.day+"|"+out);
     if(!legal(a,d)||!ac||total.get(out)<=1)continue;
     for(const b of ids.values()){
      const incoming=b.id,bc=contexts.get(p.day+"|"+incoming);
      if(set.has(incoming)||!legal(b,d)||!bc||a.townHall!==b.townHall||ac.targetTh!==bc.targetTh)continue;
      const x=total.get(out),y=total.get(incoming),rx=remaining.get(out),ry=remaining.get(incoming);
      const delta=(bc.index-ac.index)*ac.pressure;
      // No cliff for small performance differences; balanced/fostering
      // still may rotate toward underserved players.
      if(which==="performance"&&bc.index>ac.index&&bc.index-ac.index<.08&&y>=x-1)continue;
      const gain=delta+value(out,x-1,rx-1)+value(incoming,y+1,ry+1)-value(out,x,rx)-value(incoming,y,ry);
      if(gain>1e-9&&(!best||gain>best.gain+1e-9))best={day:p.day,out,incoming,gain};
     }
    }
   }
   if(!best)break;
   const lineup=plan[best.day-1].lineup;lineup[lineup.indexOf(best.out)]=best.incoming;
   total.set(best.out,total.get(best.out)-1);total.set(best.incoming,total.get(best.incoming)+1);
   remaining.set(best.out,remaining.get(best.out)-1);remaining.set(best.incoming,remaining.get(best.incoming)+1);
  }
  for(const p of plan){
   if(!editable.has(p.day)&&!p.lineup.every((id,i)=>id===base[p.day-1].lineup[i]))throw Error("unsafe_locked_day");
   if(p.lineup.length!==slots||new Set(p.lineup).size!==slots)throw Error("unsafe_daily_count");
   if(editable.has(p.day))for(const id of p.lineup){const m=ids.get(id);if(!eligible(m)||m.statuses[p.day-1]==="out")throw Error("unsafe_daily_member")}
  }
  for(const m of ids.values())if((!m.fixed&&exact(m)&&total.get(m.id)!==Number(m.targetDays))||(original.get(m.id)>0&&total.get(m.id)===0))throw Error("unsafe_season_count");
  return plan;
 }
 function metrics(plan){
  const total=counts(plan,allIds),remaining=counts(plan,allIds,p=>futureDays.has(p.day));
  let knownSlots=0,index=0,medalOpportunities=0;
  for(const p of plan.filter(p=>editable.has(p.day)))for(const id of p.lineup){
   const c=contexts.get(p.day+"|"+id);
   if(c){knownSlots++;index+=c.index*c.pressure}
  }
  const active=[...ids.values()].filter(eligible);
  if(medalComplete)for(const m of active){
   const stars=medalStars.get(m.playerTag)||0;
   if(stars<8&&stars+3*remaining.get(m.id)>=8)medalOpportunities++;
  }
  return {knownSlots,index,medalOpportunities:medalComplete?medalOpportunities:null,rotationCost:active.reduce((s,m)=>s+total.get(m.id)**2,0)};
 }
 function diff(plan,reference=base){
  return plan.flatMap((p,i)=>{
   const added=p.lineup.filter(id=>!reference[i].lineup.includes(id)),removed=reference[i].lineup.filter(id=>!p.lineup.includes(id));
   return added.length||removed.length?[{day:p.day,added,removed}]:[];
  });
 }
 const current=optimize(base,mode),currentMetrics=metrics(current);
 const sameRound=standings.quality==="schedule_known"&&standings.invalid===0&&standings.liveMatches===0&&
  Array.isArray(standings.teams)&&standings.teams.length===days+1&&standings.teams.every(t=>t.completed===standings.teams[0].completed)&&standings.teams[0].completed>=2;
 const risk=standings.demotion==="open"&&sameRound&&Number.isInteger(standings.demotionFirst)&&standings.currentLowerBoundRank>=standings.demotionFirst;
 const safe=["impossible","not_applicable"].includes(standings.demotion)&&["guaranteed","impossible","not_applicable"].includes(standings.promotion)&&standings.quality==="schedule_known"&&standings.invalid===0;
 let alternate=null,modeRecommendation=null;
 if(editable.size&&((mode!=="performance"&&risk)||(mode==="performance"&&safe))){
  const next=mode==="performance"?"balanced":"performance",plan=optimize(current,next),m=metrics(plan),changes=diff(plan,current);
  const gain=m.index-currentMetrics.index,comparable=m.knownSlots===currentMetrics.knownSlots&&m.knownSlots>0;
  const rotationImproved=(m.medalOpportunities!==null&&currentMetrics.medalOpportunities!==null&&m.medalOpportunities>currentMetrics.medalOpportunities)||m.rotationCost<currentMetrics.rotationCost;
  const useful=changes.length>0&&comparable&&(risk?gain>=.25:rotationImproved&&(gain>=-.08||standings.bounds?.best===standings.bounds?.worst));
  if(useful){
   const reason=risk?"observed_relegation_zone_and_better_comparable_plan":"table_goals_settled_and_rotation_opportunity";
   const key=JSON.stringify([season,mode,next,reason,changes.map(c=>[c.day,[...c.added].sort(cmp),[...c.removed].sort(cmp)])]);
   if(!declined.includes(key)){
    alternate={mode:next,plan,metrics:m,changes};
    modeRecommendation={from:mode,to:next,reason,key,requiresOwnerConfirmation:true,
     indexDelta:gain,affectedDays:changes.map(c=>c.day),medalOpportunitiesBefore:currentMetrics.medalOpportunities,medalOpportunitiesAfter:m.medalOpportunities};
   }
  }
 }
 // Target proposal only describes actual preparation roster, NOT hypothetical
 // changed lineup. If rotation changes it, require refresh after in-game update.
 const targetPreviews=group.upcoming.map(w=>{
  if(!preparation.has(w.day)||diff(current).some(d=>d.day===w.day)||alternate?.changes.some(d=>d.day===w.day))
   return {day:w.day,ok:false,reason:"refresh_actual_preparation_roster"};
  return previewStrategicTargets({group,evidence,selectedClanTag:own,season,day:w.day,asOf});
 });
 return {ok:true,season,mode,role,calibrated:false,canApply:false,action:role==="owner"?"owner_review":role==="vice"?"proposal_only":"read_only",
  current:{plan:current,metrics:currentMetrics,changes:diff(current)},standard:{plan:base,metrics:metrics(base)},alternate,modeRecommendation,
  difficulty,held,editableDays:[...editable],frozenDays:base.filter(p=>!editable.has(p.day)).map(p=>p.day),
  targetPreviews,medalCoverageComplete:medalComplete,
  players:[...ids.values()].filter(eligible).map(m=>{
   const remaining=counts(current,allIds,p=>futureDays.has(p.day)).get(m.id);
   const lower=medalStars.get(m.playerTag)||0;
   return {id:m.id,observedStarsLowerBound:lower,confirmedPreparationAppearances:remaining,
    theoreticalAdditionalStars:3*remaining,medalStatus:lower>=8?"achieved":medalComplete?"open":"unknown"};
  }),limitations:["shadow_only","confirmed_preparation_only","same_th_replacement","uncalibrated_context_index","no_win_probability","no_automatic_change"]};
}
