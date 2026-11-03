"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const vm=require("node:vm");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sw=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
const {planCwl}=require(path.join(root,"cwl-planning-core.js"));
const start=html.indexOf("function calculatePlan(){");
const stop=html.indexOf("\nfunction renderProfileUI",start);
assert.ok(start>=0&&stop>start,"Cloud planner entry point found");
const calculate=html.slice(start,stop);
const member=(id,extra={})=>({id,name:id,participating:true,fixed:false,priority:0,statuses:Array(7).fill("auto"),targetDays:null,...extra});
const roster=[...Array.from({length:14},(_,i)=>member("fix"+i,{fixed:true})),member("A",{targetDays:5}),member("B")];
const state={config:{slots:15,days:7},members:roster,archivedMembers:[],locks:[]};

test("Cloud loads exact-target browser engine synchronously before inline app",()=>{
 const script=html.indexOf('<script src="./cwl-planning-core.js?v=');
 const inline=html.indexOf("<script>",script);
 assert.ok(script>0&&inline>script);
 assert.match(html,/Math\.max\(0,state\.config\.days-1\)/);
 assert.match(html,/Genau \$\{i\+1\}/);
 assert.match(html,/Altes Ziel: \$\{m\.targetDays\}/);
 assert.match(sw,/cwl-planning-core\\\.js/);
 const inlineStart=html.indexOf("<script>",script)+"<script>".length;
 const inlineEnd=html.indexOf("</script>",inlineStart);
 assert.doesNotThrow(()=>new Function(html.slice(inlineStart,inlineEnd)));
});
test("Browser calculatePlan delegates to global exact-target engine",()=>{
 const ctx={state,window:{CWLPlanningCore:{planCwl}}};
 const plan=vm.runInNewContext(calculate+"\ncalculatePlan",ctx)();
 assert.equal(plan.ok,true,JSON.stringify(plan.conflicts));
 assert.equal(plan.counts.A,5);
 assert.equal(plan.counts.B,2);
 assert.ok(plan.dayPlans.every(d=>d.lineup.length===15));
});
test("Missing browser engine fails closed rather than treating soft targets as exact",()=>{
 const ctx={
  state,window:{},allKnownMembers:()=>roster,memberById:id=>roster.find(m=>m.id===id),
  effectiveStatus:(m,d)=>m.statuses[d],fairnessCandidateScore:(m,d,counts)=>({
   used:counts[m.id]||0,remaining:7-d-1,priority:m.priority
  })
 };
 const plan=vm.runInNewContext(calculate+"\ncalculatePlan",ctx)();
 assert.equal(plan.ok,false);
 assert.ok(plan.conflicts.some(x=>/nicht geladen/.test(x)));
 assert.ok(plan.dayPlans.every(x=>x.warnings.some(w=>/nicht geladen/.test(w))));
 assert.match(html,/if\(lastPlan\.ok===false\)/);
});
