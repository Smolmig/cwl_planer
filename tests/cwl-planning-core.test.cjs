"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {planCwl}=require(path.join(__dirname,"..","cwl-planning-core.js"));
const solve=async props=>planCwl(props);
const member=(id,rest={})=>({id,name:id,playerTag:"#"+id,participating:true,fixed:false,priority:0,targetDays:null,statuses:Array(7).fill("auto"),...rest});
const rotation=(a={},b={},slots=15)=>({slots,days:7,members:[...Array.from({length:slots-1},(_,i)=>member("fix"+i,{fixed:true})),member("A",a),member("B",b)]});

test("global 7-day rotation divides one free place 4:3, including locked days",async()=>{
 const x=rotation(),p=await solve(x);
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.deepEqual([p.counts.A,p.counts.B].sort(),[3,4]);
 assert.equal(p.dayPlans.length,7);
 assert.ok(p.dayPlans.every(d=>d.lineup.length===15&&d.warnings.length===0));
 const locked=structuredClone(x);locked.locks=[{locked:true,lineup:p.dayPlans[0].lineup,snapshots:{A:{name:"historischer Name"}}}];
 const resumed=await solve(locked);
 assert.equal(resumed.ok,true,JSON.stringify(resumed.conflicts));
 assert.deepEqual([resumed.counts.A,resumed.counts.B].sort(),[3,4]);
 assert.deepEqual(resumed.dayPlans[0].lineup,p.dayPlans[0].lineup);
 assert.deepEqual(locked.locks[0].snapshots.A,{name:"historischer Name"});
});
test("exact N is hard: 4:3, 5:2, 6:1; unfair 6:1 is valid with soft notice",async()=>{
 for(const [target,other] of [[4,3],[5,2],[6,1]]){
  const p=await solve(rotation({targetDays:target}));
  assert.equal(p.ok,true,JSON.stringify(p.conflicts));
  assert.equal(p.counts.A,target);
  assert.equal(p.counts.B,other);
  assert.ok(p.dayPlans.every(day=>day.lineup.length===15));
  assert.deepEqual(p.conflicts,[]);
  if(target===6)assert.ok(p.notices.some(x=>/ungleich/.test(x)));
 }
});
test("unsatisfiable 5+5 cannot be silently rounded down or approved",async()=>{
 const p=await solve(rotation({targetDays:5},{targetDays:5}));
 assert.equal(p.ok,false);
 assert.ok(p.conflicts.some(x=>/10 weitere Plätze/.test(x)));
 assert.ok(p.dayPlans.filter(d=>!d.locked).every(d=>d.warnings.length>0));
});
test("MUSS 3 conflicts with exact 2; already played 3 conflicts with 2",async()=>{
 const x=rotation({targetDays:2,statuses:["must","must","must","auto","auto","auto","auto"]});
 const p=await solve(x);
 assert.equal(p.ok,false);
 assert.ok(p.conflicts.some(x=>/MUSS-Einsätze/.test(x)));
 const locked=rotation({targetDays:2});
 locked.locks=Array.from({length:3},()=>({locked:true,lineup:[...locked.members.filter(m=>m.fixed).map(m=>m.id),"A"]}));
 const resumed=await solve(locked);
 assert.equal(resumed.ok,false);
 assert.ok(resumed.conflicts.some(x=>/Bereits 3 Einsätze gespielt/.test(x)));
 assert.ok(resumed.dayPlans.slice(0,3).every(x=>x.locked&&x.lineup.includes("A")));
 assert.equal(resumed.playedCounts.A,3);
});
test("fixed, RAUS, MUST and rare availability hold in both 15 and 30 formats",async()=>{
 for(const slots of [15,30]){
  const ms=Array.from({length:slots+10},(_,i)=>member("p"+i));
  ms[0].fixed=true;
  ms[1].statuses[2]="must";
  ms[2].statuses[1]="out";
  ms[3].statuses=Array(7).fill("out");ms[3].statuses[0]="auto";
  const p=await solve({members:ms,days:7,slots});
  assert.equal(p.ok,true,JSON.stringify(p.conflicts));
  for(const [d,day] of p.dayPlans.entries()){
   assert.equal(day.lineup.length,slots);
   assert.equal(new Set(day.lineup).size,slots);
   assert.ok(day.lineup.includes("p0"));
   if(d===2)assert.ok(day.lineup.includes("p1"));
   if(d===1)assert.ok(!day.lineup.includes("p2"));
  }
  assert.equal(p.counts.p3,1,"rare player should receive the only available day");
 }
});
test("short plan caps target at days minus one and keeps pause/former excluded",async()=>{
 const m=[member("a",{targetDays:2}),member("b"),member("c"),member("paused",{participating:false,targetDays:1}),member("former",{participating:true,cocSyncState:"former"})];
 const good=await solve({members:m,days:3,slots:2});
 assert.equal(good.ok,true,JSON.stringify(good.conflicts));
 assert.equal(good.counts.a,2);
 assert.equal(good.counts.paused,0);
 assert.equal(good.counts.former,0);
 const bad=await solve({members:[member("a",{targetDays:3}),member("b")],days:3,slots:1});
 assert.equal(bad.ok,false);
 assert.ok(bad.conflicts.some(x=>/maximal 2/.test(x)));
});
test("rotation preference changes only soft assignments, never a hard exact target",async()=>{
 const x=rotation({rotationWeight:"preferred"},{rotationWeight:"less"});
 const p=await solve(x);
 assert.equal(p.ok,true);
 assert.equal(p.counts.A,4);
 assert.equal(p.counts.B,3);
 x.members.find(m=>m.id==="A").targetDays=3;
 const hard=await solve(x);
 assert.equal(hard.ok,true);
 assert.equal(hard.counts.A,3);
 assert.equal(hard.counts.B,4);
});
test("does not change source profiles, played-day snapshots or recorded statuses",async()=>{
 const x=rotation({targetDays:4});
 x.locks=[{locked:true,lineup:x.members.slice(0,15).map(m=>m.id),snapshots:{A:{name:"Alt"}}}];
 const before=JSON.stringify(x);
 await solve(x);
 assert.equal(JSON.stringify(x),before);
});
test("constrained day capacities detect hard conflicts across all days",async()=>{
 const m=[member("A",{targetDays:2,statuses:["auto","auto","out"]}),member("B",{targetDays:2,statuses:["auto","auto","out"]}),member("C",{statuses:["out","out","auto"]}),member("D",{statuses:["out","out","auto"]})];
 const p=await solve({members:m,days:3,slots:1});
 assert.equal(p.ok,false);
 assert.ok(p.conflicts.length);
});
