// Rolling-origin validation only; no calibrated success probabilities.
// Strict immutable observations required. Current mutable imports cannot
// masquerade as a historical snapshot. Score identical test cases for all baselines.
import {buildStrategicEvidence} from "./cwl-strategic-experiment.mjs";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
const tag=x=>typeof x==="string"?x.trim().toUpperCase():"";
const th=x=>Number.isInteger(x)&&x>=3&&x<=30;
const TAG=/^#[0289PYLQGRJCUV]{3,15}$/;
function normalize(f){
 if(!f||!finite(f.eventAt)||!finite(f.observedAt)||f.observedAt<f.eventAt||
 typeof f.warKey!=="string"||!f.warKey||!TAG.test(tag(f.playerTag))||!Number.isInteger(f.attackOrder)||f.attackOrder<0||
 !["normal","cwl"].includes(f.kind)||!th(f.attackerTh)||!th(f.defenderTh)||
 !Number.isInteger(f.stars)||f.stars<0||f.stars>3||
 (f.destruction!=null&&(!finite(f.destruction)||f.destruction<0||f.destruction>100)))return null;
 return {warKey:f.warKey,playerTag:tag(f.playerTag),attackOrder:f.attackOrder,kind:f.kind,attackerTh:f.attackerTh,defenderTh:f.defenderTh,
 stars:f.stars,destruction:f.destruction??null,eventAt:f.eventAt,observedAt:f.observedAt};
}
function atTime(rows,cutoff){
 const unique=new Map(),bad=new Set();
 for(const f of rows){
  if(f.observedAt>cutoff)continue;
  const k=JSON.stringify([f.warKey,f.playerTag,f.attackOrder]),{observedAt,...value}=f,old=unique.get(k);
  if(old&&old.key!==JSON.stringify(value))bad.add(k);
  else if(!old||old.row.observedAt>observedAt)unique.set(k,{key:JSON.stringify(value),row:f});
 }
 return {rows:[...unique].filter(([k])=>!bad.has(k)).map(([,v])=>v.row),conflicts:bad.size};
}
const bucket=()=>({n:0,eligible:0,smoothed:0,raw:0,neutral:0,st:0,rt:0,nt:0,wars:new Set(),players:new Set()});
function score(b,f,c){
 const triple=Number(f.stars===3);b.n++;b.wars.add(f.warKey);b.players.add(f.playerTag);
 b.smoothed+=Math.abs(c.smoothedStars-f.stars);b.raw+=Math.abs(c.averageStars-f.stars);b.neutral+=Math.abs(2-f.stars);
 b.st+=(c.smoothedTripleShare-triple)**2;b.rt+=(c.threeStarRate-triple)**2;b.nt+=(.5-triple)**2;
}
function summarize(b){
 const n=b.n;
 return {predictions:n,eligible:b.eligible,coverage:b.eligible?n/b.eligible:null,distinctWars:b.wars.size,distinctPlayers:b.players.size,
 mae:n?{smoothed:b.smoothed/n,raw:b.raw/n,neutral:b.neutral/n}:null,
 brier:n?{smoothed:b.st/n,raw:b.rt/n,neutral:b.nt/n}:null};
}
export function evaluateStrategicHoldout({members=[],observations=[],cutoffs=[],provenance}={}){
 if(provenance!=="immutable_observation")return {ok:false,reason:"historical_provenance_required",predictions:0};
 if(!Array.isArray(members)||!Array.isArray(observations)||!Array.isArray(cutoffs)||cutoffs.length<2||cutoffs.length>60||
 cutoffs.some((t,i)=>!finite(t)||i&&t<=cutoffs[i-1]))throw Error("invalid_holdout");
 const rows=observations.map(normalize).filter(Boolean);
 const total=bucket(),byKind={normal:bucket(),cwl:bucket()},folds=[];
 for(let i=0;i<cutoffs.length-1;i++){
  const at=cutoffs[i],end=cutoffs[i+1],testKnown=atTime(rows,end),trainKnown=atTime(rows,at);
  const test=testKnown.rows.filter(f=>f.eventAt>at&&f.eventAt<=end);
  const wars=new Set(test.map(f=>f.warKey));
  const train=trainKnown.rows.filter(f=>!wars.has(f.warKey)&&f.eventAt<=at);
  const e=buildStrategicEvidence({members,facts:train,asOf:at}),byTag=new Map(e.profiles.map(p=>[p.playerTag,p])),fold=bucket();
  for(const f of test){
   const p=byTag.get(f.playerTag);
   if(!p||p.townHall!==f.attackerTh)continue;
   const buckets=[total,byKind[f.kind],fold];for(const b of buckets)b.eligible++;
   const c=p.contexts.find(c=>c.kind===f.kind&&c.attackerTh===f.attackerTh&&c.defenderTh===f.defenderTh);
   if(!c||!c.n)continue;
   for(const b of buckets)score(b,f,c);
  }
  folds.push({cutoff:at,end,trainingRows:train.length,testRows:test.length,comparablePredictions:fold.n,
   trainingConflicts:trainKnown.conflicts,testConflicts:testKnown.conflicts,...summarize(fold)});
 }
 return {ok:true,calibrated:false,...summarize(total),conflictingKeys:atTime(rows,cutoffs.at(-1)).conflicts,
 invalidRows:observations.length-rows.length,folds,byKind:Object.fromEntries(Object.entries(byKind).map(([k,b])=>[k,summarize(b)])),
 limitations:["caller_attested_immutable_provenance","fixed_roster_current_th","no_causal_lineup_counterfactual","not_model_calibration"]};
}
