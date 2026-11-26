// Temporal, observation-time validation harness, not model calibration.
import {buildStrategicEvidence} from "./cwl-strategic-experiment.mjs";
const finite=x=>typeof x==="number"&&Number.isFinite(x);
export function evaluateStrategicHoldout({members=[],observations=[],cutoffs=[],provenance}={}){
 if(provenance!=="immutable_observation")return {ok:false,reason:"historical_provenance_required",predictions:0};
 if(!Array.isArray(members)||!Array.isArray(observations)||!Array.isArray(cutoffs)||cutoffs.length<2||cutoffs.length>60||
 cutoffs.some((t,i)=>!finite(t)||i&&t<=cutoffs[i-1]))throw Error("invalid_holdout");
 const unique=new Map(),conflicts=new Set();
 for(const f of observations){
 if(!f||!finite(f.eventAt)||!finite(f.observedAt)||f.observedAt<f.eventAt||typeof f.warKey!=="string"||
 !Number.isInteger(f.attackOrder)||!Number.isInteger(f.stars)||f.stars<0||f.stars>3)continue;
 const k=JSON.stringify([f.warKey,f.playerTag,f.attackOrder]),old=unique.get(k);
 if(old&&JSON.stringify(old)!==JSON.stringify(f))conflicts.add(k);else unique.set(k,f);
 }
 const rows=[...unique].filter(([k])=>!conflicts.has(k)).map(([,v])=>v);
 const totals={smoothed:0,raw:0,neutral:0,st:0,rt:0,nt:0};let predictions=0,eligible=0;const folds=[];
 for(let i=0;i<cutoffs.length-1;i++){
 const at=cutoffs[i],end=cutoffs[i+1],test=rows.filter(f=>f.eventAt>at&&f.eventAt<=end&&f.observedAt<=end);
 const wars=new Set(test.map(f=>f.warKey)),train=rows.filter(f=>!wars.has(f.warKey)&&f.eventAt<=at&&f.observedAt<=at);
 const e=buildStrategicEvidence({members,facts:train,asOf:at}),byTag=new Map(e.profiles.map(p=>[p.playerTag,p]));let n=0;
 for(const f of test){
 const p=byTag.get(f.playerTag);
 if(!p||p.townHall!==f.attackerTh||!["normal","cwl"].includes(f.kind)||!Number.isInteger(f.defenderTh))continue;
 eligible++;
 const c=p.contexts.find(c=>c.kind===f.kind&&c.attackerTh===f.attackerTh&&c.defenderTh===f.defenderTh);
 if(!c||!c.n)continue;
 const triple=Number(f.stars===3);
 totals.smoothed+=Math.abs(c.smoothedStars-f.stars);totals.raw+=Math.abs(c.averageStars-f.stars);totals.neutral+=Math.abs(2-f.stars);
 totals.st+=(c.smoothedTripleShare-triple)**2;totals.rt+=(c.threeStarRate-triple)**2;totals.nt+=(.5-triple)**2;n++;predictions++;
 }
 folds.push({cutoff:at,end,trainingRows:train.length,testRows:test.length,comparablePredictions:n});
 }
 return {ok:true,calibrated:false,predictions,eligible,conflictingKeys:conflicts.size,folds,coverage:eligible?predictions/eligible:null,
 mae:predictions?{smoothed:totals.smoothed/predictions,raw:totals.raw/predictions,neutral:totals.neutral/predictions}:null,
 brier:predictions?{smoothed:totals.st/predictions,raw:totals.rt/predictions,neutral:totals.nt/predictions}:null,
 limitations:["caller_attested_immutable_provenance","fixed_roster_current_th","no_causal_lineup_counterfactual","not_model_calibration"]};
}
