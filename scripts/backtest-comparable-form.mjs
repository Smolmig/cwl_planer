// Experimental read-only historical evaluation. No Cloud, solver or database writes.
// Predictions for a war only use other wars that started strictly before it.
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {computeComparableForm} from "../cwl-comparable-form.mjs";
import {cleanTag} from "../cwl-stats-core.mjs";

const validStar=n=>Number.isInteger(n)&&n>=0&&n<=3;
const validTh=n=>Number.isInteger(n)&&n>=3&&n<=30;
const validWar=w=>w && (w.war_type==="normal"||w.war_type==="cwl") &&
 (w.source!=="api"||w.finalized===true) &&
 typeof w.war_key==="string" && Number.isFinite(Date.parse(w.started_at));
const prior=(share,n,priorWeight=4)=>Number.isFinite(share)&&n>0?
 (share*n+priorWeight*0.5)/(n+priorWeight):null;
const probabilitySummary=values=>{
 const n=values.length;
 if(!n)return {n:0,brier:null,logLoss:null,observedTriples:null,meanPredicted:null};
 let brier=0,logLoss=0,triples=0,predicted=0;
 for(const {p,y} of values){
  const q=Math.max(1e-9,Math.min(1-1e-9,p));
  brier+=(q-y)**2;
  logLoss-=y*Math.log(q)+(1-y)*Math.log(1-q);
  triples+=y;predicted+=q;
 }
 const round=(x)=>Math.round(x*10000)/10000;
 return {n,brier:round(brier/n),logLoss:round(logLoss/n),
  observedTriples:round(triples/n),meanPredicted:round(predicted/n)};
};

/**
 * Offline research only. Estimates three explicitly smoothed forecasting
 * baselines on later equal-Town-Hall attacks. The production performanceIndex
 * is deliberately NOT evaluated as a probability (it is a Wilson rank score).
 * No within-war future knowledge: a later attack in the same war is never training.
 */
export function backtestComparableForm(wars,attacks,{priorWeight=4}={}){
 if(!Number.isFinite(priorWeight)||priorWeight<=0)
  throw new RangeError("priorWeight must be positive.");
 const sourceWars=(Array.isArray(wars)?wars:[]).filter(validWar);
 const sorted=[...sourceWars].sort((a,b)=>Date.parse(a.started_at)-Date.parse(b.started_at));
 const sourceByKey=new Map(sorted.map(w=>[w.war_key,w]));
 if(sourceByKey.size!==sorted.length)
  throw new Error("Duplicate war_key entries must be resolved before testing.");
 const attackRows=(Array.isArray(attacks)?attacks:[]).filter(a=>
  sourceByKey.has(a?.war_key) && validStar(a.stars) &&
  /^#[0289PYLQGRJCUV]{3,15}$/.test(cleanTag(a.attacker_tag)));
 const evaluated={last7:[],recent30:[],weighted90:[],cwl90:[]};
 const common={last7:[],recent30:[],weighted90:[]};
 let eligible=0,warsWithEligibleAttacks=0,untrained=0;
 // Equal start timestamps are processed as one block to prevent leakage.
 for(let i=0;i<sorted.length;){
  const timestamp=Date.parse(sorted[i].started_at);
  let j=i+1;
  while(j<sorted.length&&Date.parse(sorted[j].started_at)===timestamp)j++;
  const testKeys=new Set(sorted.slice(i,j).map(w=>w.war_key));
  const test=attackRows.filter(a=>testKeys.has(a.war_key)&&
   validTh(a.attacker_th)&&a.attacker_th===a.defender_th);
  warsWithEligibleAttacks+=new Set(test.map(a=>a.war_key)).size;
  eligible+=test.length;
  if(test.length){
   const historyWars=sorted.slice(0,i),historyKeys=new Set(historyWars.map(w=>w.war_key));
   const history=attackRows.filter(a=>historyKeys.has(a.war_key));
   const form=computeComparableForm(historyWars,history,{asOf:timestamp});
   const historyByPlayer=new Map();
   for(const a of history){
    const tag=cleanTag(a.attacker_tag),war=sourceByKey.get(a.war_key);
    if(!historyByPlayer.has(tag))historyByPlayer.set(tag,[]);
    historyByPlayer.get(tag).push({stars:a.stars,started:Date.parse(war.started_at)});
   }
   for(const hits of historyByPlayer.values())hits.sort((a,b)=>b.started-a.started);
   for(const a of test){
    const tag=cleanTag(a.attacker_tag),y=Number(a.stars===3);
    const all=(historyByPlayer.get(tag)||[]).slice(0,7);
    const f=form.profiles.get(tag);
    const predictions={
     last7:all.length?prior(all.filter(x=>x.stars===3).length/all.length,all.length,priorWeight):null,
     recent30:f?.last30.attacks?prior(f.last30.triples/f.last30.attacks,f.last30.attacks,priorWeight):null,
     weighted90:f?.weighted90.effectiveAttacksExact?prior(
      f.weighted90.tripleShare,f.weighted90.effectiveAttacksExact,priorWeight):null,
     cwl90:f?.cwl90.attacks?prior(f.cwl90.triples/f.cwl90.attacks,f.cwl90.attacks,priorWeight):null
    };
    let count=0;
    for(const [key,p] of Object.entries(predictions))if(p!==null){
     evaluated[key].push({p,y});count++;
    }
    if(!count)untrained++;
    if(["last7","recent30","weighted90"].every(key=>predictions[key]!==null))
     for(const key of ["last7","recent30","weighted90"])
      common[key].push({p:predictions[key],y});
   }
  }
  i=j;
 }
 return {
  note:"Experimentelle chronologische Vorhersage-Baselines; keine Freigabe oder Spieler-Rangliste.",
  eligibleEqualThAttacks:eligible,
  warsWithEligibleAttacks,
  untrainedAttacks:untrained,
  totalAcceptedWars:sorted.length,
  // Independent coverage is not a fair head-to-head comparison.
  independent:Object.fromEntries(Object.entries(evaluated).map(([k,v])=>[k,probabilitySummary(v)])),
  // Compare these three on EXACTLY the same later attacks.
  commonSample:Object.fromEntries(Object.entries(common).map(([k,v])=>[k,probabilitySummary(v)])),
  commonSampleSize:common.last7.length,
  limitations:[
   "Only equal-Town-Hall test attacks, not known equal-strength bases.",
   "No historical mirror, first-hit, cleanup or map-position evidence.",
   "Missing or duplicated history and player/clan selection bias can distort results.",
   "The 0.5 prior with configurable weight is a baseline, not calibrated for this clan.",
   "Chronological test wars share time/meta and are not independent observations."
  ]
 };
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw new Error(
   "Usage: node scripts/backtest-comparable-form.mjs <private-export.json> (expects {wars, attacks})");
  const input=JSON.parse(readFileSync(process.argv[2],"utf8"));
  if(!Array.isArray(input.wars)||!Array.isArray(input.attacks))
   throw new Error("Expected JSON arrays: wars and attacks.");
  process.stdout.write(JSON.stringify(backtestComparableForm(input.wars,input.attacks),null,2)+"\n");
 }catch(error){console.error(error.message);process.exitCode=1;}
}
