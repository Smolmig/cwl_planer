"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
function extract(start,end){const i=html.indexOf(start),j=html.indexOf(end,i);assert.ok(i>=0&&j>i);return html.slice(i,j)}
const planner=extract("function calculatePlan(){","function renderProfileUI");
function solve(members,locked=[]){
 const state={members,archivedMembers:[],config:{slots:15,days:7},
   locks:Array.from({length:7},(_,d)=>locked[d]||{locked:false,lineup:[]})};
 const ctx={
  state,allKnownMembers:()=>members,memberById:id=>members.find(m=>m.id===id),
  effectiveStatus:(m,d)=>m.statuses[d],
  fairnessCandidateScore:(m,d,counts)=>({used:counts[m.id]||0,
    remaining:Array.from({length:6-d},(_,i)=>d+1+i)
      .filter(x=>m.statuses[x]!=="out").length,priority:m.priority||0})
 };
 return vm.runInNewContext(planner+"\ncalculatePlan",ctx)();
}
function member(i,targetDays=null){
 return {id:"m"+i,name:"Player "+i,participating:true,fixed:false,
  targetDays,statuses:Array(7).fill("auto"),priority:0};
}
test("Target days constrain rotation and include already played days",()=>{
 const members=Array.from({length:21},(_,i)=>member(i));
 members[0].targetDays=2;members[1].targetDays=3;members[2].targetDays=4;
 const plan=solve(members);
 assert.equal(plan.dayPlans.length,7);
 assert.equal(plan.counts.m0,2);
 assert.equal(plan.counts.m1,3);
 assert.equal(plan.counts.m2,4);
 assert.ok(plan.dayPlans.every(p=>p.lineup.length===15));
 const fixed=[{locked:true,lineup:plan.dayPlans[0].lineup}];
 const continued=solve(members,fixed);
 assert.equal(continued.counts.m0,2);
 assert.equal(continued.counts.m1,3);
 assert.equal(continued.counts.m2,4);
});
test("A manual MUST day stays selected even if target was previously reached",()=>{
 const members=Array.from({length:21},(_,i)=>member(i));
 members[0].targetDays=1;members[0].statuses[6]="must";
 const plan=solve(members);
 assert.ok(plan.dayPlans[6].lineup.includes("m0"));
 assert.ok(plan.dayPlans[6].warnings.some(w=>/Einsätze|MUSS/.test(w))||
   plan.counts.m0===1);
});
test("Old first-day and out-from-day values migrate to direct RAUS rules",()=>{
 const code=extract("function normalizeMember(m){","function normalizeArchive");
 const ctx={uid:()=> "legacy",freshMember:()=>({}),normalizePlayerTag:v=>String(v||""),
   STRENGTH_LABELS:{unknown:"unknown"}};
 const normalize=vm.runInNewContext(code+"\nnormalizeMember",ctx);
 const m=normalize({id:"m",name:"Old",participating:true,firstDay:3,outFromDay:6,
   statuses:Array(7).fill("auto"),threeStar:"unknown"});
 assert.equal(m.statuses.join(","),"out,out,auto,auto,auto,out,out");
 assert.equal(m.firstDay,null);assert.equal(m.outFromDay,null);
});
test("Day target and manual buttons are visible, obsolete date windows removed",()=>{
 assert.match(html,/member-target-days/);
 assert.match(html,/Einsatzziel/);
 assert.match(html,/summary-snapshot-actions|member-snapshot-actions/);
 assert.match(html,/\$\{orderBtns\}<button class="btn small member-edit-toggle"/);
 assert.doesNotMatch(html,/class="first-day"/);
 assert.doesNotMatch(html,/class="out-from"/);
 assert.match(html,/Manuell als gespielt bestätigen/);
 assert.match(html,/Nach Kriegsende übernimmt Clash die tatsächliche Aufstellung automatisch/);
});
test("Cloud remembers the last clan selection and enemy TH is clearly labeled",()=>{
 assert.match(sync,/LAST_CLAN_PREFIX/);
 assert.match(sync,/const desired=selected\|\|clanId\|\|savedClan\(\)/);
 assert.match(sync,/rememberClan\(clanId\)/);
 assert.match(live,/Gegner-Aufstellung/);
});
