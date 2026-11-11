"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const fs=require("node:fs");
const root=path.resolve(__dirname,"..");
const source=fs.readFileSync(path.join(root,"scripts/backtest-war-context.mjs"),"utf8");
const load=()=>import(pathToFileURL(path.join(root,"scripts/backtest-war-context.mjs")).href);
const attack=(wid,date,tag,stars,extra={})=>({
 wid,date,home:1,size:15,type:"cwl",tag,defendertag:"#8PYL",
 order:1,stars,new:stars,th:18,targetth:18,pos:2,targetpos:2,...extra
});
test("Context research can never modify Cloud version, history or CWL solver",()=>{
 assert.doesNotMatch(source,/createClient|fetch\(|\.upsert\(|\.update\(/i);
 assert.match(source,/No same-day leakage/);
 assert.match(source,/backtestWarContext/);
 assert.match(source,/Conflicting duplicate attack event/);
 const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(app,/const DATA_VERSION=9/);
 assert.match(app,/const APP_VERSION="v1\.15\.5"/);
});
test("Identical ClashPerk duplicate rows count once; disagreeing duplicates are rejected",async()=>{
 const {backtestWarContext}=await load();
 const row=attack(1,"2026-09-01","#2PYL",3);
 const result=backtestWarContext([row,{...row}],{bootstrap:0});
 assert.equal(result.coverage.ownUniqueAttacks,1);
 assert.equal(result.coverage.removedExactDuplicates,1);
 assert.throws(()=>backtestWarContext([row,{...row,stars:2,new:2}],{bootstrap:0}),
  /Conflicting duplicate attack event/);
});
test("Opponent attacks and unfinished future rounds are excluded",async()=>{
 const {backtestWarContext}=await load();
 const r=attack(1,"2026-09-01","#2PYL",3);
 const result=backtestWarContext([r,{...r,home:0},{...r,wid:2,date:"2026-11-06"}],
  {asOf:"2026-11-04",bootstrap:0});
 assert.equal(result.coverage.ownUniqueAttacks,1);
 assert.equal(result.coverage.excludedFutureRows,1);
});
test("Within-war and within-day future knowledge is never training history",async()=>{
 const {backtestWarContext}=await load();
 const rows=[
  attack(1,"2026-08-01","#2PYL",3),
  attack(2,"2026-08-01","#2PYL",0,{defendertag:"#8QPY"}),
  attack(3,"2026-08-02","#2PYL",3)
 ];
 const r=backtestWarContext(rows,{bootstrap:0});
 assert.equal(r.coverage.eligibleSameThAttacks,3);
 assert.equal(r.independent.last7.n,1,
  "Only second-day attack can see first-day history; two same-day attacks cannot train each other");
 assert.equal(r.independent.weighted90.n,1);
 assert.equal(r.pairedVsWeighted90.last7.n,1);
});
test("Equal RH is required for evaluation; dips never counted as equal-TH outcomes",async()=>{
 const {backtestWarContext}=await load();
 const r=backtestWarContext([
  attack(1,"2026-09-01","#2PYL",3,{targetth:17}),
  attack(2,"2026-09-02","#2PYL",3)
 ],{bootstrap:0});
 assert.equal(r.coverage.eligibleSameThAttacks,1);
 assert.equal(r.independent.weighted90.n,0);
 assert.equal(r.independent.last7.n,1);
});
test("Map mirror and fresh-star filters only use PRIOR historical context",async()=>{
 const {backtestWarContext}=await load();
 const rows=[
  attack(1,"2026-09-01","#2PYL",3,{pos:2,targetpos:2}),
  attack(2,"2026-09-02","#2PYL",0,{pos:2,targetpos:4,new:0}),
  attack(3,"2026-09-03","#2PYL",3,{pos:2,targetpos:2})
 ];
 const r=backtestWarContext(rows,{bootstrap:0});
 assert.equal(r.independent.weighted90.n,2);
 assert.equal(r.independent.mirror90.n,2);
 assert.equal(r.independent.freshStars90.n,2);
 assert.ok(r.independent.mirror90.predicted>r.independent.weighted90.predicted);
});
test("Same-TH attacker history is separated from older Town Hall records",async()=>{
 const {backtestWarContext}=await load();
 const rows=[
  attack(1,"2026-08-01","#2PYL",0,{th:17,targetth:17}),
  attack(2,"2026-08-02","#2PYL",3,{th:18,targetth:18}),
  attack(3,"2026-08-03","#2PYL",3,{th:18,targetth:18})
 ];
 const r=backtestWarContext(rows,{bootstrap:0});
 assert.equal(r.independent.sameTH90.n,1);
 assert.ok(r.independent.sameTH90.predicted>r.independent.weighted90.predicted);
});
test("Pairwise comparison uses exactly the same future samples with deterministic grouped CIs",async()=>{
 const {backtestWarContext}=await load();
 const rows=[];
 for(let i=0;i<16;i++){
  const day="2026-09-"+String(i+1).padStart(2,"0");
  rows.push(attack(100+i,day,"#2PYL",i%3?3:2));
 }
 const a=backtestWarContext(rows,{bootstrap:50});
 const b=backtestWarContext(rows,{bootstrap:50});
 assert.deepEqual(a,b,"Seeded bootstrap must be reproducible");
 assert.equal(a.pairedVsWeighted90.last7.n,a.pairedVsWeighted90.last7.baseline.n);
 assert.equal(a.pairedVsWeighted90.last7.n,a.pairedVsWeighted90.last7.candidate.n);
 assert.equal(a.pairedVsWeighted90.last7.ci95.length,2);
 assert.equal(a.independent.weighted90.n,15);
});
test("Bad dates, negative bootstrap and unrealistic star gains are handled safely",async()=>{
 const {backtestWarContext}=await load();
 assert.throws(()=>backtestWarContext([],{asOf:"nope"}),/Invalid research asOf/);
 assert.throws(()=>backtestWarContext([],{bootstrap:-1}),/Invalid research asOf/);
 assert.throws(()=>backtestWarContext([attack(1,"invalid","#2PYL",3)]),/Invalid attack date/);
 const result=backtestWarContext([attack(1,"2026-09-01","#2PYL",3,{new:5})],{bootstrap:0});
 assert.equal(result.coverage.filteredInvalidRows,1);
});
