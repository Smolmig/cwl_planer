"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {planCwl}=require("../cwl-planning-core.js");

const member=(id,rest={})=>({
 id,name:id,participating:true,fixed:false,priority:0,rotationWeight:null,
 targetDays:null,statuses:Array(7).fill("auto"),...rest
});

// Synthetic version of the real tactical situation: 10 fixed + 9 rotating,
// three already locked days, Jamie sat out for day 4, 15 slots over 7 days.
// Player IDs are deliberately fictional; no private clan data are committed.
function tacticalFixture(){
 const seed=25;
 const members=[
  ...Array.from({length:10},(_,i)=>member("fixed-"+i,{fixed:true})),
  member("jamie-synthetic-"+seed,{statuses:["auto","auto","auto","out","auto","auto","auto"]}),
  ...Array.from({length:8},(_,i)=>member("rot"+i+"-"+((seed*17+i*913)%9999)))
 ];
 const fix=members.slice(0,10).map(m=>m.id);
 const jamie=members[10].id;
 const other=members.slice(11).map(m=>m.id);
 const locks=[
  {locked:true,lineup:[...fix,jamie,other[0],other[2],other[4],other[6]]},
  {locked:true,lineup:[...fix,jamie,other[1],other[3],other[5],other[7]]},
  {locked:true,lineup:[...fix,other[0],other[1],other[2],other[3],other[4]]}
 ];
 return {members,locks,slots:15,days:7,jamie};
}
const solve=(f)=>planCwl({members:f.members,locks:f.locks,slots:f.slots,days:f.days});
const daysFor=(p,id)=>p.dayPlans.filter(d=>d.lineup.includes(id)).map(d=>d.day);

test("tactical RAUS day 4 is softly recovered on another day (Jamie regression)",()=>{
 const f=tacticalFixture();
 const before=JSON.stringify({members:f.members,locks:f.locks});
 const p=solve(f);
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.equal(p.counts[f.jamie],4,"a single tactical exclusion should not automatically reduce 4 eligible rotations to 3");
 assert.deepEqual(daysFor(p,f.jamie),[1,2,5,6]);
 assert.ok(!p.dayPlans[3].lineup.includes(f.jamie),"day-4 RAUS must never be relaxed");
 assert.ok(p.dayPlans.every(d=>d.lineup.length===15),"each day must remain fully staffed");
 for(let d=0;d<3;d++)
  assert.deepEqual(p.dayPlans[d].lineup,f.locks[d].lineup,"started/played day must remain exactly as recorded");
 assert.equal(JSON.stringify({members:f.members,locks:f.locks}),before,"solver must not rewrite any stored inputs");
 assert.equal(f.members.find(m=>m.id===f.jamie).targetDays,null,"no hidden hard target");
 // The nine rotating players still share exactly 35 total places.
 const rotation=f.members.filter(m=>!m.fixed).map(m=>p.counts[m.id]);
 assert.equal(rotation.reduce((a,b)=>a+b,0),35);
 assert.deepEqual([...rotation].sort((a,b)=>a-b),[3,4,4,4,4,4,4,4,4]);
});

test("explicit N-day target beats compensation; a MUST day remains mandatory",()=>{
 const f=tacticalFixture(),m=f.members.find(x=>x.id===f.jamie);
 m.targetDays=3;m.statuses[4]="must";
 const p=solve(f);
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.deepEqual(daysFor(p,f.jamie),[1,2,5]);
 assert.equal(p.counts[f.jamie],3,"exact target is not silently increased to 4");
 assert.ok(!p.dayPlans[3].lineup.includes(f.jamie));
});

test("compensation is soft: cannot create space or override RAUS availability",()=>{
 const f=tacticalFixture(),m=f.members.find(x=>x.id===f.jamie);
 m.statuses=["auto","auto","out","out","out","out","out"];
 const p=solve(f);
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.deepEqual(daysFor(p,f.jamie),[1,2],"a player with no eligible future days cannot be allocated a replacement");
 assert.ok(p.dayPlans.every(d=>d.lineup.length===15));
});

test("a status attached only to a locked day does not bias future rotation",()=>{
 const f=tacticalFixture(),m=f.members.find(x=>x.id===f.jamie);
 m.statuses=Array(7).fill("auto");
 const reference=solve(f);
 m.statuses[0]="out"; // day 1 is already a confirmed historical lineup
 const historical=solve(f);
 assert.deepEqual(historical.counts,reference.counts);
 assert.deepEqual(historical.dayPlans.map(x=>x.lineup),reference.dayPlans.map(x=>x.lineup));
});

test("manual preference and shortfall conflicts retain higher priority than day-out recovery",()=>{
 const ms=[...Array.from({length:14},(_,i)=>member("fix"+i,{fixed:true})),
 member("preferred",{rotationWeight:"preferred",statuses:["out","auto","auto","auto","auto","auto","auto"]}),
 member("less",{rotationWeight:"less"})];
 const p=planCwl({members:ms,slots:15,days:7});
 assert.equal(p.ok,true,JSON.stringify(p.conflicts));
 assert.equal(p.counts.preferred,4);
 assert.equal(p.counts.less,3);
 assert.ok(!p.dayPlans[0].lineup.includes("preferred"));
 const conflictFixture=tacticalFixture();
 const jamie=conflictFixture.members.find(m=>m.id===conflictFixture.jamie);
 jamie.targetDays=6;
 for(let d=3;d<7;d++)jamie.statuses[d]="out";
 const conflict=solve(conflictFixture);
 assert.equal(conflict.ok,false);
 assert.ok(conflict.conflicts.some(msg=>/nicht erreichbar/.test(msg)));
});
