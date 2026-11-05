"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {pathToFileURL}=require("node:url");
const {resolve}=require("node:path");
const load=()=>import(pathToFileURL(resolve(__dirname,"../scripts/backtest-comparable-form.mjs")).href);
const w=(id,date,other={})=>({war_key:id,war_type:"normal",
 started_at:date,source:"import",...other});
const a=(id,stars,other={})=>({war_key:id,attacker_tag:"#2PYL",
 attacker_th:18,defender_th:18,stars,...other});
const d=n=>"2026-10-"+String(n).padStart(2,"0")+"T12:00:00Z";

test("later war is predicted using strictly earlier wars; production index is not a probability",async()=>{
 const {backtestComparableForm}=await load();
 const result=backtestComparableForm([w("first",d(1)),w("later",d(2))],
  [a("first",3),a("later",0)]);
 assert.equal(result.eligibleEqualThAttacks,2);
 assert.equal(result.untrainedAttacks,1);
 assert.equal(result.commonSampleSize,1);
 assert.equal(result.commonSample.last7.brier,0.36);
 assert.equal(result.commonSample.recent30.brier,0.36);
 assert.equal(result.commonSample.weighted90.n,1);
 assert.ok(result.independent.last7.meanPredicted>0);
 assert.equal("performanceIndex" in result,false);
});

test("wars sharing the same timestamp cannot train one another",async()=>{
 const {backtestComparableForm}=await load();
 const result=backtestComparableForm([w("a",d(1)),w("b",d(1))],
  [a("a",3),a("b",0)]);
 assert.equal(result.eligibleEqualThAttacks,2);
 assert.equal(result.commonSampleSize,0);
 assert.equal(result.untrainedAttacks,2);
 assert.equal(result.independent.last7.brier,null);
});

test("lower-TH previous hits count only in the legacy seven-hit baseline",async()=>{
 const {backtestComparableForm}=await load();
 const result=backtestComparableForm([w("easy",d(1)),w("equal",d(2))],
  [a("easy",3,{defender_th:17}),a("equal",3)]);
 assert.equal(result.eligibleEqualThAttacks,1);
 assert.equal(result.independent.last7.n,1);
 assert.equal(result.independent.recent30.n,0);
 assert.equal(result.independent.weighted90.n,0);
 assert.equal(result.commonSampleSize,0);
});

test("unfinished API wars and future results cannot be used as training",async()=>{
 const {backtestComparableForm}=await load();
 const result=backtestComparableForm([
  w("unfinished",d(1),{source:"api",finalized:false}),
  w("finished",d(2)),w("later",d(3))],
  [a("unfinished",3),a("finished",0),a("later",3)]);
 assert.equal(result.totalAcceptedWars,2);
 assert.equal(result.eligibleEqualThAttacks,2);
 assert.equal(result.commonSampleSize,1);
 assert.equal(result.commonSample.last7.meanPredicted,0.4);
});

test("input stays unchanged; missing samples do not fabricate a success chance",async()=>{
 const {backtestComparableForm}=await load();
 const wars=[w("single",d(1))],hits=[a("single",3)];
 const old=JSON.stringify({wars,hits});
 const result=backtestComparableForm(wars,hits);
 assert.equal(result.independent.last7.n,0);
 assert.equal(result.independent.cwl90.n,0);
 assert.equal(result.commonSampleSize,0);
 assert.equal(result.untrainedAttacks,1);
 assert.equal(JSON.stringify({wars,hits}),old);
});

test("CWL-only baseline and common-sample comparison are separately reported",async()=>{
 const {backtestComparableForm}=await load();
 const result=backtestComparableForm([
  w("old",d(1),{war_type:"cwl"}),w("current",d(2),{war_type:"normal"})],
  [a("old",2),a("current",3)]);
 assert.equal(result.independent.cwl90.n,1);
 assert.equal(result.commonSampleSize,1);
 assert.equal(result.independent.cwl90.meanPredicted,0.4);
 assert.ok(result.limitations.some(x=>x.includes("mirror")));
});

test("invalid prior is rejected instead of silently producing misleading scores",async()=>{
 const {backtestComparableForm}=await load();
 assert.throws(()=>backtestComparableForm([],[],{priorWeight:0}),/priorWeight/);
 assert.throws(()=>backtestComparableForm([],[],{priorWeight:NaN}),/priorWeight/);
});

test("duplicates are rejected; simultaneous-war coverage counts only evaluated wars",async()=>{
 const {backtestComparableForm}=await load();
 assert.throws(()=>backtestComparableForm([w("same",d(1)),w("same",d(2))],
  [a("same",3)]),/Duplicate war_key/);
 const result=backtestComparableForm([w("eligible",d(1)),w("other",d(1))],
  [a("eligible",3),a("other",3,{defender_th:17})]);
 assert.equal(result.warsWithEligibleAttacks,1);
 assert.equal(result.eligibleEqualThAttacks,1);
});
