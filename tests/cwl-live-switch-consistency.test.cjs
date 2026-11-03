"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const {planCwl}=require("../cwl-planning-core.js");
const start=app.indexOf("function confirmedCwlPlanningLocks(){");
const end=app.indexOf("\nfunction calculatePlan()",start);
assert.ok(start>=0&&end>start,"Read-only live baseline must be part of the production planner");
const fromApp=Function("state","window","allKnownMembers","normalizePlayerTag",
 app.slice(start,end)+";return confirmedCwlPlanningLocks;");
const norm=s=>{const v=String(s||"").trim().toUpperCase();return v.startsWith("#")?v:"#"+v};
const season=new Date().toISOString().slice(0,7);
const player=(id,tag,rest={})=>({id,name:id,playerTag:tag,participating:true,
 fixed:false,targetDays:null,statuses:Array(7).fill("auto"),...rest});
const a=player("A","#2PYL",{fixed:true}),b=player("B","#2PYQ",{targetDays:1}),c=player("C","#2PYV",{targetDays:1});
const members=[a,b,c];
function fixture(state="inWar"){
 return {config:{slots:2,days:2},members,archivedMembers:[],
  locks:[{locked:false,lineup:[]},{locked:false,lineup:[]}],
  cwlLive:{season,clanTag:"#2PYG",rounds:[{day:1,available:true,state,teamSize:2,clan:{members:[a,c].map(m=>({tag:m.playerTag,name:m.name}))}}]}};
}
function effectiveLocks(profile,linked=true){
 return fromApp(profile,{CWLCloud:{active:true,hasApiClan:()=>linked}},()=>members,norm)();
}
test("A started war fixes the real lineup for planning without marking the saved day played",()=>{
 const p=fixture(),original=JSON.stringify(p);
 const locks=effectiveLocks(p);
 assert.equal(locks[0].locked,true);
 assert.equal(locks[0].source,"coc-roster-fixed-readonly");
 assert.deepEqual([...locks[0].lineup],["A","C"]);
 assert.equal(p.locks[0].locked,false,"No premature historical day closure");
 assert.equal(JSON.stringify(p),original,"No Cloud profile mutation");
 const result=planCwl({members,locks,slots:2,days:2});
 assert.equal(result.ok,true,JSON.stringify(result.conflicts));
 assert.deepEqual(result.dayPlans[0].lineup,["A","C"]);
 assert.deepEqual(result.dayPlans[1].rein,["B"]);
 assert.deepEqual(result.dayPlans[1].raus,["C"]);
 assert.equal(result.counts.B,1);
 assert.equal(result.counts.C,1);
});
test("Preparation is not immutable and missing/duplicate API player tags cannot create a fake lock",()=>{
 const p=fixture("preparation");assert.equal(effectiveLocks(p)[0].locked,false);
 p.cwlLive.rounds[0].state="inWar";p.cwlLive.rounds[0].clan.members[1].tag="#2JUV";
 assert.equal(effectiveLocks(p)[0].locked,false);
 p.cwlLive.rounds[0].clan.members[1].tag=p.cwlLive.rounds[0].clan.members[0].tag;
 assert.equal(effectiveLocks(p)[0].locked,false);
});
test("Existing historical locks, disconnected cloud mode and ignored seasons are protected",()=>{
 const p=fixture();
 assert.equal(effectiveLocks(p,false)[0].locked,false);
 p.cwlLiveIgnoredSeason=season;assert.equal(effectiveLocks(p)[0].locked,false);
 delete p.cwlLiveIgnoredSeason;
 p.locks[0]={locked:true,lineup:["A","B"],snapshots:{}};
 assert.deepEqual([...effectiveLocks(p)[0].lineup],["A","B"]);
});
test("Primary API comparison and theoretical plan rotation must not render as simultaneous equal instructions",()=>{
 assert.match(app,/plan-rotation-backup/);
 assert.match(app,/Geplante Rotation \(ohne Clash\) anzeigen/);
 assert.match(app,/dp.day>1&&!apiLinked/);
 assert.match(app,/confirmedCwlPlanningLocks\(\)/);
 const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
 assert.match(live,/cwl-copy-live-swaps/);
 assert.match(live,/reviewPreparationLineup\(ctx.profile,dp,currentRound/);
 assert.match(live,/FRESH_WINDOW_MS/);
});
test("Live comparison and read-only fixed planning lineup agree",async()=>{
 const {reviewPreparationLineup}=await import("../cwl-live-core.mjs");
 const p=fixture(),locks=effectiveLocks(p);
 const solved=planCwl({members,locks,slots:2,days:2});
 const round={day:2,available:true,state:"preparation",teamSize:2,
  clan:{members:[{tag:a.playerTag,name:a.name},{tag:c.playerTag,name:c.name}]}};
 const review=reviewPreparationLineup(p,solved.dayPlans[1],round,{planningOk:solved.ok});
 assert.equal(review.status,"changes");
 assert.deepEqual(review.toRemove.map(m=>m.name),["C"]);
 assert.deepEqual(review.toAdd.map(m=>m.name),["B"]);
});
