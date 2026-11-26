// #44 isolated research prototype. No fetch, storage, UI, writes or production solver changes.
// Only caller-authorized normalized observations. Never use for live planning without gates.
const DAY=86400000;
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
const tag=v=>typeof v==="string"?v.trim().toUpperCase():"";
const th=v=>Number.isInteger(v)&&v>=3&&v<=30;
const validTime=v=>typeof v==="number"&&Number.isFinite(v);
const modeRules=Object.freeze({
 performance:Object.freeze({rotation:.035,medal:.01,development:0}),
 balanced:Object.freeze({rotation:.12,medal:.32,development:.03}),
 development:Object.freeze({rotation:.19,medal:.42,development:.16})
});
export const EXPERIMENT_MODEL_VERSION="shadow-1";
const cmp=(a,b)=>a<b?-1:a>b?1:0;
function rosterOf(members){
 if(!Array.isArray(members)||members.length>50)throw Error("invalid_roster");
 const ids=new Set(),tags=new Set();
 return members.map(m=>{
  const id=m?.id,t=tag(m?.playerTag);
  if(typeof id!=="string"||!id||ids.has(id)||!TAG.test(t)||tags.has(t)||!th(m.townHall))throw Error("invalid_member_identity");
  ids.add(id);tags.add(t);
  return {...m,playerTag:t,statuses:Array.isArray(m.statuses)?[...m.statuses]:[]};
 });
}
// eventAt: conservative completed-war timestamp OR actual attack timestamp.
// observedAt: first verifiable availability of that fact, not merely the war date.
// Unknown observation dates are deliberately excluded (avoid hindsight in backtests).
export function buildStrategicEvidence({members=[],facts=[],obligations=[],asOf}={}){
 if(!validTime(asOf)||!Array.isArray(facts)||!Array.isArray(obligations))throw Error("invalid_evidence");
 const roster=rosterOf(members),byTag=new Map(roster.map(m=>[m.playerTag,m]));
 const audit={outsideWindow:0,unavailableAtCutoff:0,invalid:0,duplicates:0,conflicting:0,olderTownHall:0};
 const unique=new Map(),conflicts=new Set();
 for(const f of facts){
  const p=byTag.get(tag(f?.playerTag));
  if(!p)continue; // never return observations for players outside selected roster
  if(!validTime(f.eventAt)||!validTime(f.observedAt)||f.observedAt<f.eventAt){audit.invalid++;continue}
  if(f.eventAt>asOf||f.observedAt>asOf){audit.unavailableAtCutoff++;continue}
  if(f.eventAt<asOf-30*DAY){audit.outsideWindow++;continue}
  if(typeof f.warKey!=="string"||!f.warKey||!Number.isInteger(f.attackOrder)||f.attackOrder<0||
    !["normal","cwl"].includes(f.kind)||!th(f.attackerTh)||!th(f.defenderTh)||
    !Number.isInteger(f.stars)||f.stars<0||f.stars>3||
    (f.destruction!=null&&(!Number.isFinite(f.destruction)||f.destruction<0||f.destruction>100))){audit.invalid++;continue}
  const key=JSON.stringify([f.warKey,p.playerTag,f.attackOrder]);
  const row={playerTag:p.playerTag,kind:f.kind,attackerTh:f.attackerTh,defenderTh:f.defenderTh,
    stars:f.stars,destruction:f.destruction??null,eventAt:f.eventAt};
  const previous=unique.get(key);
  if(previous){
   if(JSON.stringify(previous)!==JSON.stringify(row)){conflicts.add(key);audit.conflicting++}
   else audit.duplicates++;
  }else unique.set(key,row);
 }
 const rows=[...unique.entries()].filter(([k])=>!conflicts.has(k)).map(([,v])=>v).filter(f=>{
  if(f.attackerTh!==byTag.get(f.playerTag).townHall){audit.olderTownHall++;return false}
  return true;
 });
 const contexts=new Map();
 for(const f of rows){
  const key=JSON.stringify([f.kind,f.attackerTh,f.defenderTh]);
  if(!contexts.has(key))contexts.set(key,[]);
  contexts.get(key).push(f);
 }
 const summary=rs=>{
  const n=rs.length,triples=rs.filter(r=>r.stars===3).length,stars=rs.reduce((s,r)=>s+r.stars,0);
  const destruction=rs.filter(r=>r.destruction!==null);
  return {n,triples,stars,averageStars:n?stars/n:null,threeStarRate:n?triples/n:null,
   destructionN:destruction.length,averageDestruction:destruction.length?destruction.reduce((s,r)=>s+r.destruction,0)/destruction.length:null};
 };
 const slots=new Map(),badSlots=new Set();
 for(const o of obligations){
  if(!byTag.has(tag(o?.playerTag))||o.verified!==true||!validTime(o.eventAt)||!validTime(o.observedAt)||
     o.eventAt>asOf||o.eventAt<asOf-30*DAY||o.observedAt>asOf||o.observedAt<o.eventAt||
     typeof o.slotKey!=="string"||!o.slotKey||!["performed","missed"].includes(o.result))continue;
  const k=JSON.stringify([tag(o.playerTag),o.slotKey]);
  if(slots.has(k)&&slots.get(k).result!==o.result)badSlots.add(k);
  else slots.set(k,{playerTag:tag(o.playerTag),result:o.result});
 }
 const profiles=roster.map(m=>{
  const own=rows.filter(f=>f.playerTag===m.playerTag);
  const cells=[];
  for(const [key,rs] of contexts){
   const [kind,attackerTh,defenderTh]=JSON.parse(key);
   if(attackerTh!==m.townHall)continue;
   const local=summary(rs.filter(r=>r.playerTag===m.playerTag));
   if(!local.n)continue;
   const peers=rs.filter(r=>r.playerTag!==m.playerTag),peer=summary(peers);
   // Prior strength and fallback are explicitly uncalibrated shadow constants.
   // Peer prior only when >= 3 other players and >= 12 comparable observations.
   const usePeer=peer.n>=12&&new Set(peers.map(r=>r.playerTag)).size>=3;
   const priorStars=usePeer?peer.averageStars:2;
   const priorTriple=usePeer?peer.threeStarRate:.5;
   const priorN=8;
   cells.push({kind,attackerTh,defenderTh,...local,peerN:peer.n,prior:usePeer?"peer":"neutral",
    smoothedStars:(local.stars+priorN*priorStars)/(local.n+priorN),
    smoothedTripleShare:(local.triples+priorN*priorTriple)/(local.n+priorN)});
  }
  cells.sort((a,b)=>cmp(a.kind,b.kind)||a.defenderTh-b.defenderTh);
  const equal=cells.filter(c=>c.defenderTh===m.townHall);
  const n=equal.reduce((s,c)=>s+c.n,0);
  const weight=equal.reduce((s,c)=>s+c.n*(c.kind==="cwl"?2:1),0);
  const score=weight?equal.reduce((s,c)=>s+c.smoothedStars*c.n*(c.kind==="cwl"?2:1),0)/weight:null;
  const verified=[...slots.entries()].filter(([k,o])=>!badSlots.has(k)&&o.playerTag===m.playerTag).map(([,o])=>o);
  const performed=verified.filter(o=>o.result==="performed").length,missed=verified.length-performed;
  return {id:m.id,playerTag:m.playerTag,townHall:m.townHall,n,score,
   evidence:n===0?"unknown":n<4?"limited":n<8?"trend":"observed",
   contexts:cells,reliability:{performed,missed,verifiedSlots:verified.length,observedRate:verified.length?performed/verified.length:null}};
 });
 return {model:EXPERIMENT_MODEL_VERSION,asOf,windowDays:30,calibrated:false,profiles,audit};
}
function count(plans,ids){
 const result=Object.fromEntries(ids.map(id=>[id,0]));
 for(const p of plans)for(const id of p.lineup)result[id]=(result[id]||0)+1;
 return result;
}
// Preview only before registration, conditional on participation. Caller injects
// unchanged standard solver. No opponent data => compare SAME current TH only.
// This is a bounded local search, not globally optimal nor a real win prediction.
export function previewSeasonCandidates({members=[],facts=[],obligations=[],asOf,mode,slots=15,days=7,planStandard}={}){
 if(!Object.hasOwn(modeRules,mode)||![15,30].includes(slots)||![5,7].includes(days)||typeof planStandard!=="function")throw Error("invalid_scenario");
 const roster=rosterOf(members);
 const evidence=buildStrategicEvidence({members:roster,facts,obligations,asOf});
 return previewWithEvidence({roster,evidence,mode,slots,days,planStandard});
}
function previewWithEvidence({roster,evidence,mode,slots,days,planStandard}){
 const profiles=new Map(evidence.profiles.map(p=>[p.id,p]));
 const active=roster.filter(m=>m.cocSyncState!=="former"&&m.participationIntent!=="no"&&m.participating!==false);
 const activeIds=active.map(m=>m.id),byId=new Map(active.map(m=>[m.id,m]));
 const conditional=active.filter(m=>m.participationIntent!=="yes").map(m=>m.id);
 const baseline=planStandard({members:active.map(m=>({...m,participating:true,statuses:[...m.statuses]})),slots,days});
 if(!baseline?.ok)return {ok:false,mode,conditional,conflicts:[...(baseline?.conflicts||["standard_infeasible"])],evidence,rows:[],changes:[],calibrated:false};
 const base=baseline.dayPlans.map(p=>({day:p.day,lineup:[...p.lineup]}));
 const plans=base.map(p=>({day:p.day,lineup:[...p.lineup]}));
 const initial=count(base,activeIds),counts={...initial},rules=modeRules[mode];
 const exact=m=>m.targetDays!=null&&m.targetDays!=="";
 const legal=(m,d)=>!m.fixed&&!exact(m)&&m.statuses[d]!=="must"&&m.statuses[d]!=="out";
 const value=(id,n)=>{
  const p=profiles.get(id),m=byId.get(id);
  // Prospective 8-star opportunity only: 3 assignments permit at most 9 stars.
  // No probability, no assumed actual stars. No hardcoded rank-to-count bands.
  const score=p.n>=4?p.score:2;
  const prefer=m.rotationWeight==="preferred"?.04:m.rotationWeight==="less"?-.04:0;
  const dev=p.n>=4?Math.max(0,2.6-p.score):0;
  return score*n-rules.rotation*n*n+rules.medal*Math.min(3,n)+rules.development*dev*Math.min(3,n)+prefer*n;
 };
 // Every feasible player keeps at least one appearance; do not worsen a
 // standard 0 caused by real availability/capacity and never propose exclusion.
 let iterations=0;
 for(;iterations<days*slots;iterations++){
  let best=null;
  for(let d=0;d<plans.length;d++){
   const lineup=plans[d].lineup,set=new Set(lineup);
   for(const out of lineup){
    const donor=byId.get(out),pd=profiles.get(out);
    if(!donor||!legal(donor,d)||counts[out]<=1||pd.n<4)continue;
    for(const incoming of activeIds){
     const recipient=byId.get(incoming),pr=profiles.get(incoming);
     if(set.has(incoming)||!legal(recipient,d)||recipient.townHall!==donor.townHall||pr.n<4)continue;
     // A small/noisy difference is not worth reducing participation.
     // Fixed prototype deadband; calibrate using held-out CWL seasons.
     if(pr.score>pd.score&&pr.score-pd.score<.08&&counts[incoming]>=counts[out]-1)continue;
     const gain=value(out,counts[out]-1)+value(incoming,counts[incoming]+1)-value(out,counts[out])-value(incoming,counts[incoming]);
     if(gain>1e-9&&(!best||gain>best.gain+1e-9))best={d,out,incoming,gain};
    }
   }
  }
  if(!best)break;
  const lineup=plans[best.d].lineup;lineup[lineup.indexOf(best.out)]=best.incoming;
  counts[best.out]--;counts[best.incoming]++;
 }
 // Independent invariants; fail closed if supplied baseline is inconsistent.
 for(let d=0;d<days;d++){
  const ids=plans[d]?.lineup||[],set=new Set(ids);
  if(ids.length!==slots||set.size!==slots||ids.some(id=>!byId.has(id)||byId.get(id).statuses[d]==="out")||
    active.some(m=>(m.statuses[d]==="must"||m.fixed&&m.statuses[d]!=="out")&&!set.has(m.id)))throw Error("unsafe_preview");
 }
 for(const m of active)if(exact(m)&&!m.fixed&&counts[m.id]!==Number(m.targetDays)||initial[m.id]>0&&counts[m.id]===0)throw Error("unsafe_count");
 const changes=plans.flatMap((p,d)=>{
  const added=p.lineup.filter(id=>!base[d].lineup.includes(id)),removed=base[d].lineup.filter(id=>!p.lineup.includes(id));
  return added.length?[{day:p.day,added,removed}]:[];
 });
 const rows=roster.map(m=>{
  const p=profiles.get(m.id),available=activeIds.includes(m.id),n=counts[m.id]??0;
  return {id:m.id,playerTag:m.playerTag,participation:!available?"not_in_scenario":conditional.includes(m.id)?"unknown":"confirmed",
    evidence:p.evidence,standardAppearances:initial[m.id]??null,scenarioAppearances:available?n:null,
    recommendation:!available?"not_in_scenario":n===0?"capacity_or_availability_review":p.n<4?"manual_review":
      n<=2?"limited_opportunity_review":n>=days-1?"strong_candidate":"candidate",
    medalOpportunity:available?Math.min(3*n,8):null};
 });
 return {ok:true,mode,calibrated:false,conditional,evidence,rows,changes,standard:base,preview:plans,
  limitations:["pre_registration_only","no_opponent_data","conditional_participation","no_star_forecast","no_automatic_exclusion"]};
}

// Conditional candidate-size comparison, not a registration or exclusion decision.
// The full-roster evidence (including peer priors) stays fixed across scenarios.
// Search is deliberately bounded and never removes unknown/limited form,
// explicit participation rules, or changes the per-day TH composition.
export function compareSeasonRosterSizes({members=[],facts=[],obligations=[],asOf,mode,slots=15,days=7,planStandard}={}){
 const full=previewSeasonCandidates({members,facts,obligations,asOf,mode,slots,days,planStandard});
 if(!full.ok)return {ok:false,calibrated:false,conflicts:full.conflicts,scenarios:[],recommendation:null};
 const roster=rosterOf(members),profiles=new Map(full.evidence.profiles.map(p=>[p.id,p]));
 const byId=new Map(roster.map(m=>[m.id,m]));
 const active=roster.filter(m=>m.cocSyncState!=="former"&&m.participationIntent!=="no"&&m.participating!==false);
 const available=(m,d)=>m.statuses[d]!=="out";
 const composition=p=>p.preview.map(d=>d.lineup.map(id=>byId.get(id).townHall).sort((a,b)=>a-b).join(",")).join("|");
 const fullTH=composition(full);
 const metrics=(p,selected)=>{
  const actual=p.rows.filter(x=>x.scenarioAppearances!==null);
  const counts=actual.map(x=>x.scenarioAppearances);
  const known=actual.filter(x=>profiles.get(x.id).n>=4);
  return {size:selected.length,conditional:selected.filter(m=>m.participationIntent!=="yes").length,
   minimumAvailableReserve:Math.min(...Array.from({length:days},(_,d)=>selected.filter(m=>available(m,d)).length-slots)),
   minimumConfirmedReserve:Math.min(...Array.from({length:days},(_,d)=>selected.filter(m=>available(m,d)&&m.participationIntent==="yes").length-slots)),
   minAppearances:Math.min(...counts),maxAppearances:Math.max(...counts),
   theoreticalMedalOpportunities:counts.filter(n=>n>=3).length,
   knownSlots:known.reduce((s,x)=>s+x.scenarioAppearances,0),
   comparableStarIndex:known.reduce((s,x)=>s+profiles.get(x.id).score*x.scenarioAppearances,0),
   unknownOrLimited:actual.filter(x=>profiles.get(x.id).n<4).length};
 };
 const original=metrics(full,active);
 const scenarios=[{kind:"all_candidates",size:active.length,excluded:[],metrics:original,plan:full}];
 let current=active,previous=full,removed=[];
 const protectedMember=m=>m.fixed||m.targetDays!=null&&m.targetDays!==""||m.statuses.includes("must")||
  m.rotationWeight==="preferred"||m.participationIntent!=="yes"||profiles.get(m.id).n<8;
 // Keep at least one conditional reserve per day in a smaller scenario.
 // This is a shadow safety heuristic, not a guaranteed actual substitute.
 for(let step=0;step<3;step++){
  const rowById=new Map(previous.rows.map(x=>[x.id,x]));
  const options=current.filter(m=>{
   const p=profiles.get(m.id),n=rowById.get(m.id)?.scenarioAppearances;
   return !protectedMember(m)&&n>0&&n<=2&&current.some(other=>
    other.id!==m.id&&other.townHall===m.townHall&&profiles.get(other.id).n>=8&&profiles.get(other.id).score-p.score>=.25);
  }).sort((a,b)=>rowById.get(a.id).scenarioAppearances-rowById.get(b.id).scenarioAppearances||
    profiles.get(a.id).score-profiles.get(b.id).score||cmp(a.id,b.id)).slice(0,4);
  let best=null;
  for(const candidate of options){
   const selected=current.filter(m=>m.id!==candidate.id);
   if(Array.from({length:days},(_,d)=>selected.filter(m=>available(m,d)).length).some(n=>n<slots+1))continue;
   // A fresh standard solve can incidentally alter the protected unknown
   // player's count. Seed the candidate by replacing ONLY the removed
   // player's existing appearances; preserve every other day and hard rule.
   const standard=planStandard({members:selected.map(m=>({...m,participating:true,statuses:[...m.statuses]})),slots,days});
   if(!standard?.ok)continue;
   const seeded=previous.preview.map(d=>({day:d.day,lineup:[...d.lineup]}));
   const selectedIds=selected.map(m=>m.id),initialCounts=count(seeded,selectedIds);
   let feasible=true;
   for(let d=0;d<days;d++){
    const lineup=seeded[d].lineup,at=lineup.indexOf(candidate.id);
    if(at<0)continue;
    const replacements=selected.filter(m=>m.townHall===candidate.townHall&&!lineup.includes(m.id)&&available(m,d)&&
      !m.fixed&&!(m.targetDays!=null&&m.targetDays!=="")&&m.statuses[d]!=="must"&&profiles.get(m.id).n>=4)
      .sort((a,b)=>profiles.get(b.id).score-profiles.get(a.id).score||
        (initialCounts[a.id]||0)-(initialCounts[b.id]||0)||cmp(a.id,b.id));
    if(!replacements.length){feasible=false;break}
    const next=replacements[0].id;lineup[at]=next;initialCounts[next]=(initialCounts[next]||0)+1;
   }
   if(!feasible)continue;
   const p=previewWithEvidence({roster:selected,evidence:full.evidence,mode,slots,days,
    planStandard:()=>({ok:true,dayPlans:seeded})});
   if(!p.ok||composition(p)!==fullTH||p.rows.some(x=>x.scenarioAppearances===0))continue;
   // Keep the real standard reference distinct from the internal seed.
   p.standard=standard.dayPlans.map(d=>({day:d.day,lineup:[...d.lineup]}));
   const standardCounts=count(p.standard,selectedIds);
   for(const row of p.rows)row.standardAppearances=standardCounts[row.id]??null;
   p.changes=p.preview.flatMap((d,i)=>{
    const added=d.lineup.filter(id=>!p.standard[i].lineup.includes(id)),removed=p.standard[i].lineup.filter(id=>!d.lineup.includes(id));
    return added.length||removed.length?[{day:d.day,added,removed}]:[];
   });
   const m=metrics(p,selected);
   if(m.knownSlots!==original.knownSlots||m.unknownOrLimited!==original.unknownOrLimited)continue;
   if(mode!=="performance"&&m.theoreticalMedalOpportunities<original.theoreticalMedalOpportunities)continue;
   // Never prefer a weaker comparable performance index. This is an
   // internal additive comparison on the same TH composition, NOT a score forecast.
   if(m.comparableStarIndex+1e-9<original.comparableStarIndex)continue;
   const candidateResult={candidate,selected,p,m};
   if(!best||m.comparableStarIndex>best.m.comparableStarIndex+1e-9||
      Math.abs(m.comparableStarIndex-best.m.comparableStarIndex)<1e-9&&m.theoreticalMedalOpportunities>best.m.theoreticalMedalOpportunities)best=candidateResult;
  }
  if(!best)break;
  removed=[...removed,best.candidate.id];current=best.selected;previous=best.p;
  scenarios.push({kind:"smaller_roster_review",size:current.length,excluded:[...removed],metrics:best.m,plan:best.p,
   requiresIndividualReview:true,reason:"limited_opportunity_and_comparable_evidence"});
 }
 return {ok:true,calibrated:false,mode,scenarios,recommendation:null,
  limitations:["bounded_search","conditional_availability","fixed_th_composition","no_opponent_data","no_automatic_exclusion","manual_roster_choice"]};
}
