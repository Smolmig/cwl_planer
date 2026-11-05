// Read-only research. Input is a PRIVATE normalized ClashPerk attack-log JSON.
// Neither this script nor its tests touch Cloud profiles, the planner or Supabase.
// Training data must be strictly older than each held-out calendar day.
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";

const MS_DAY=86400000;
const MODELS=["last7","same30","weighted90","sameTH90","mirror90",
 "freshStars90","posWeight90","cwlWeight90","empiricalPrior90"];
const validDate=s=>typeof s==="string"&&/^\d{4}-\d\d-\d\d$/.test(s)&&
 Number.isFinite(Date.parse(s+"T00:00:00Z"));
const dateMs=s=>Date.parse(s+"T00:00:00Z");
const cleanTag=s=>String(s??"").trim().toUpperCase();
const brier=(p,y)=>(p-y)**2;
const rnd=(v,n=4)=>v===null?null:Math.round(v*10**n)/10**n;
function meanStats(rows,name){
 const v=rows.filter(r=>r.pred[name]!==null).map(r=>({p:r.pred[name],y:r.y}));
 if(!v.length)return {n:0,brier:null,logLoss:null,predicted:null,observed:null};
 return {
  n:v.length,
  brier:rnd(v.reduce((s,x)=>s+brier(x.p,x.y),0)/v.length),
  logLoss:rnd(-v.reduce((s,x)=>s+x.y*Math.log(Math.max(1e-9,x.p))+
   (1-x.y)*Math.log(Math.max(1e-9,1-x.p)),0)/v.length),
  predicted:rnd(v.reduce((s,x)=>s+x.p,0)/v.length),
  observed:rnd(v.reduce((s,x)=>s+x.y,0)/v.length)
 };
}
function randomGenerator(seed){
 let state=seed>>>0;
 return ()=>{state^=state<<13;state^=state>>>17;state^=state<<5;
  return (state>>>0)/4294967296;};
}
function paired(rows,baseline,candidate,{bootstrap=1200}={}){
 const sample=rows.filter(r=>r.pred[baseline]!==null&&r.pred[candidate]!==null);
 const before=meanStats(sample,baseline),after=meanStats(sample,candidate);
 if(!sample.length)return {n:0,wars:0,baseline:before,candidate:after,gain:null,ci95:null};
 const byWar=new Map();
 for(const r of sample){
  if(!byWar.has(r.wid))byWar.set(r.wid,[]);
  byWar.get(r.wid).push(brier(r.pred[baseline],r.y)-brier(r.pred[candidate],r.y));
 }
 const ids=[...byWar.keys()],dif=sample.reduce((sum,r)=>sum+
  brier(r.pred[baseline],r.y)-brier(r.pred[candidate],r.y),0)/sample.length;
 let ci95=null;
 if(ids.length>2&&bootstrap){
  const random=randomGenerator(9137),values=[];
  for(let i=0;i<bootstrap;i++){
   let sum=0,n=0;
   for(let j=0;j<ids.length;j++){
    const deltas=byWar.get(ids[Math.floor(random()*ids.length)]);
    for(const d of deltas){sum+=d;n++;}
   }
   values.push(sum/n);
  }
  values.sort((a,b)=>a-b);
  ci95=[rnd(values[Math.floor(values.length*.025)],5),
   rnd(values[Math.floor(values.length*.975)-1],5)];
 }
 return {n:sample.length,wars:ids.length,baseline:before,candidate:after,
  gain:rnd(dif,5),ci95};
}
function keyOf(r){return [r.wid,r.home,r.tag,r.order,r.defendertag].join("|");}
const comparableFields=["wid","date","type","home","size","tag","order","defendertag",
 "stars","new","th","targetth","pos","targetpos"];
function normalize(raw,asOf){
 if(!Array.isArray(raw))throw new TypeError("Expected private normalized attack array");
 const unique=new Map();let duplicates=0,filtered=0,future=0;
 for(const input of raw){
  const r={...input,tag:cleanTag(input.tag),defendertag:cleanTag(input.defendertag)};
  if(!validDate(r.date))throw new Error("Invalid attack date");
  if(dateMs(r.date)>dateMs(asOf)){future++;continue;}
  if(!["normal","cwl"].includes(r.type) || ![0,1].includes(r.home) ||
    !Number.isInteger(r.wid)||!Number.isInteger(r.order)||
    !Number.isInteger(r.size)||r.size<=0 ||
    !Number.isInteger(r.stars)||r.stars<0||r.stars>3||
    !Number.isInteger(r.new)||r.new<0||r.new>r.stars||
    !Number.isInteger(r.th)||!Number.isInteger(r.targetth)||
    !Number.isInteger(r.pos)||!Number.isInteger(r.targetpos)||
    !r.tag||!r.defendertag){filtered++;continue;}
  const id=keyOf(r);
  if(unique.has(id)){
   const old=unique.get(id);
   if(comparableFields.some(k=>old[k]!==r[k]))
    throw new Error("Conflicting duplicate attack event: "+id);
   duplicates++;continue;
  }
  unique.set(id,r);
 }
 return {records:[...unique.values()].filter(r=>r.home===1),
  duplicates,filtered,future,uniqueAll:unique.size};
}
function predict(history,day,name,attackerTh,priorByTh){
 if(name==="last7"){
  const rows=[...history].sort((a,b)=>dateMs(b.date)-dateMs(a.date)||
    b.order-a.order||b.wid-a.wid).slice(0,7);
  if(!rows.length)return null;
  return (rows.filter(x=>x.stars===3).length+2)/(rows.length+4);
 }
 const thirty=name==="same30";
 const period=thirty?30:90;
 const rows=[];
 for(const a of history){
  const age=(dateMs(day)-dateMs(a.date))/MS_DAY;
  if(age<0||age>period||a.th!==a.targetth)continue;
  if(name==="sameTH90"&&a.th!==attackerTh)continue;
  if(name==="mirror90"&&a.pos!==a.targetpos)continue;
  if(name==="freshStars90"&&a.new!==a.stars)continue;
  let w=thirty?1:2**(-age/30);
  if(name==="posWeight90"){
   if(a.targetpos>a.pos+1)w*=.75;
   if(a.targetpos<a.pos-1)w*=1.15;
   if(a.new<a.stars)w*=.6;
  }
  if(name==="cwlWeight90")w*=a.type==="cwl"?1.5:.75;
  rows.push({w,y:Number(a.stars===3)});
 }
 if(!rows.length)return null;
 const sum=rows.reduce((s,r)=>s+r.w,0);
 const effective=sum**2/rows.reduce((s,r)=>s+r.w*r.w,0);
 const rate=rows.reduce((s,r)=>s+r.w*r.y,0)/sum;
 let prior=.5;
 if(name==="empiricalPrior90"){
  const group=priorByTh.get(attackerTh)||[];
  if(group.length>=20)prior=(group.reduce((a,b)=>a+b,0)+2)/(group.length+4);
 }
 return (rate*effective+4*prior)/(effective+4);
}
/**
 * Exploratory chronological player-context comparison.
 * Data shape: [{wid,date:"YYYY-MM-DD",home:1,type:"normal"|"cwl",
 *   tag,defendertag,order,size,stars,new,th,targetth,pos,targetpos}, ...].
 * Scores are NOT production probability forecasts, evaluations are NOT causal.
 */
export function backtestWarContext(input,{asOf="2026-11-04",bootstrap=1200}={}){
 if(!validDate(asOf)||!Number.isInteger(bootstrap)||bootstrap<0||bootstrap>10000)
  throw new RangeError("Invalid research asOf or bootstrap size");
 const raw=Array.isArray(input)?input:input?.attacks;
 const {records,duplicates,filtered,future,uniqueAll}=normalize(raw,asOf);
 const byDay=new Map(),wars=new Set();
 for(const a of records){
  if(!byDay.has(a.date))byDay.set(a.date,[]);
  byDay.get(a.date).push(a);wars.add(a.wid);
 }
 const past=[],scored=[];
 for(const day of [...byDay.keys()].sort()){
  const historyByTag=new Map(),priorByTh=new Map();
  for(const a of past){
   if(!historyByTag.has(a.tag))historyByTag.set(a.tag,[]);
   historyByTag.get(a.tag).push(a);
   if((dateMs(day)-dateMs(a.date))/MS_DAY<=90&&a.th===a.targetth){
    if(!priorByTh.has(a.th))priorByTh.set(a.th,[]);
    priorByTh.get(a.th).push(Number(a.stars===3));
   }
  }
  for(const a of byDay.get(day)){
   if(a.th!==a.targetth)continue;
   const history=historyByTag.get(a.tag)||[];
   const pred=Object.fromEntries(MODELS.map(name=>[
    name,predict(history,day,name,a.th,priorByTh)
   ]));
   scored.push({wid:a.wid,type:a.type,date:day,y:Number(a.stars===3),pred});
  }
  // No use of an attack from a same-day test war to train another same-day test war.
  past.push(...byDay.get(day));
 }
 const base="weighted90",pairedAll={},pairedCwl={};
 for(const candidate of MODELS.filter(n=>n!==base)){
  pairedAll[candidate]=paired(scored,base,candidate,{bootstrap});
  pairedCwl[candidate]=paired(scored.filter(r=>r.type==="cwl"),
   base,candidate,{bootstrap});
 }
 const diagnostics={normal:{},cwl:{}};
 for(const type of ["normal","cwl"]){
  const rows=records.filter(r=>r.type===type&&r.th===r.targetth);
  for(const [name,select] of [
   ["mirror",r=>r.pos===r.targetpos],
   ["dipOnMap",r=>r.targetpos>r.pos],
   ["reachOnMap",r=>r.targetpos<r.pos],
   ["previousStarsAlreadyWon",r=>r.new<r.stars]
  ]){
   const r=rows.filter(select);
   diagnostics[type][name]={n:r.length,tripleRate:r.length?
    rnd(r.filter(x=>x.stars===3).length/r.length):null};
  }
 }
 return {
  provenance:"Private ClashPerk attack log; aggregated only. Read-only exploratory research.",
  coverage:{ownUniqueAttacks:records.length,allUniqueAttacks:uniqueAll,
   removedExactDuplicates:duplicates,filteredInvalidRows:filtered,
   excludedFutureRows:future,wars:wars.size,
   eligibleSameThAttacks:scored.length,
   normalEligible:scored.filter(x=>x.type==="normal").length,
   cwlEligible:scored.filter(x=>x.type==="cwl").length},
  independent:Object.fromEntries(MODELS.map(name=>[name,meanStats(scored,name)])),
  pairedVsWeighted90:pairedAll,pairedCwlVsWeighted90:pairedCwl,
  diagnostics,
  limitations:[
   "Ranks and map distances are contextual signals; equal position or equal Town Hall is not equal base difficulty.",
   "Fresh-star contribution does NOT prove first attack. Neither attacking army nor actual base upgrade state is known.",
   "No same-day leakage. Previous wars only; but attackers, opponents and wars remain statistically dependent.",
   "Brier scores are comparable only on identical held-out attack samples; cluster bootstrap is exploratory.",
   "One clan's tracking history, missing attacks and incomplete export coverage can bias outcomes.",
   "Weights are exploratory variants, chosen retrospectively; no production model approval."
  ]
 };
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  if(process.argv.length!==3)throw new Error(
   "Usage: node scripts/backtest-war-context.mjs <PRIVATE-normalized-clashperk.json>");
  const input=JSON.parse(readFileSync(process.argv[2],"utf8"));
  process.stdout.write(JSON.stringify(backtestWarContext(input),null,2)+"\n");
 }catch(error){console.error(error.message);process.exitCode=1;}
}
