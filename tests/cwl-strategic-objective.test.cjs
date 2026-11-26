"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{planCwl}=require("../cwl-planning-core.js");
const m=(id,props={})=>({id,name:id,participating:true,statuses:Array(5).fill("auto"),...props});
const costs=(id,arr)=>({id,costs:arr});
const obj=(dayCosts,countCosts=[],mode="balanced")=>({mode,dayCosts,countCosts});
test("global objective retains exact count, FIX/MUSS/RAUS and locked days",()=>{
 const members=[m("fixed",{fixed:true,statuses:["auto","out","auto","auto","auto"]}),m("A",{targetDays:2}),m("B",{statuses:["auto","must","out","auto","auto"]}),m("C"),m("D")];
 const locks=[{locked:true,lineup:["fixed","A"]}];
 const strategicObjective=obj([costs("A",[0,0,0,900,900]),costs("B",[0,0,900,900,900]),costs("C",[900,900,900,0,900]),costs("D",[900,900,900,900,0])]);
 const input={members,locks,slots:2,days:5,strategicObjective},before=JSON.stringify(input),p=planCwl(input);
 assert.equal(p.ok,true,p.conflicts.join(";"));assert.deepEqual(p.dayPlans[0].lineup,["fixed","A"]);assert.equal(p.counts.A,2);
 assert.ok(p.dayPlans[1].lineup.includes("B")&&!p.dayPlans[1].lineup.includes("fixed"));assert.ok(!p.dayPlans[2].lineup.includes("B"));
 assert.ok(p.dayPlans[3].lineup.includes("C"));assert.ok(p.dayPlans[4].lineup.includes("D"));assert.equal(JSON.stringify(input),before);
});
test("day costs optimize jointly while preserving exact counts and baseline",()=>{
 const members=[m("A",{targetDays:2}),m("B",{targetDays:3})],input={members,slots:1,days:5};
 const p=planCwl({...input,strategicObjective:obj([costs("A",[0,500,0,500,500]),costs("B",[500,0,500,0,0])])});
 assert.equal(p.ok,true);assert.deepEqual(p.dayPlans.map(d=>d.lineup[0]),["A","B","A","B","B"]);
 assert.deepEqual(planCwl(input),planCwl({...input,strategicObjective:null}));
});
test("invalid weights rejected, conflicting hard rules never relaxed",()=>{
 const members=[m("A",{fixed:true}),m("B",{fixed:true})],input={members,slots:1,days:5};
 assert.equal(planCwl({...input,strategicObjective:obj([])}).ok,false);
 for(const x of [obj([costs("foreign",[0,0,0,0,0])]),obj([costs("A",[-1,0,0,0,0])]),obj([],[costs("A",[100,0,0,0,0])])])
  assert.throws(()=>planCwl({...input,strategicObjective:x}),RangeError);
});
