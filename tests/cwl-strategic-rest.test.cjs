"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),{planCwl}=require("../cwl-planning-core.js");
const {pathToFileURL}=require("node:url"),path=require("node:path"),load=p=>import(pathToFileURL(path.resolve(__dirname,"..",p)).href);
const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13],now=Date.UTC(2026,10,26);
function fixture(){
 const members=Array.from({length:18},(_,i)=>({id:"p"+i,name:"P"+i,playerTag:tag(i+10),townHall:19,participating:true,statuses:Array(5).fill("auto")}));
 members[0].fixed=true;members[1].statuses[2]="out";members[2].targetDays=3;
 const currentPlan=planCwl({members,slots:15,days:5}).dayPlans,registered={verified:true,season:"2026-11",clanTag:tag(0),observedAt:now,tags:members.map(m=>m.playerTag)};
 const group={season:registered.season,selectedClanTag:tag(0),observedAt:now,wars:[],upcoming:[{day:1,teamSize:15,status:"confirmed_preparation_roster",opponentTag:tag(1),roster:Array.from({length:15},(_,i)=>({tag:tag(50+i),townHall:19})),ownRoster:[]}],ownMedals:{complete:false,stars:[]}};
 const evidence={profiles:members.map((m,i)=>({id:m.id,n:15,score:i===0?1.6:2.8,contexts:[{kind:"cwl",attackerTh:19,defenderTh:19,n:15,smoothedStars:i===0?1.6:2.8}]}))};
 return {members,currentPlan,registered,group,evidence,manualLocks:[],slots:15,days:5,planStandard:planCwl};
}
test("global rest plan supports all three modes and future unknown pairings without mutating hard rules",async()=>{
 const {planStrategicRest}=await load("cwl-strategic-rest.mjs"),s=fixture(),before=JSON.stringify(s);
 for(const mode of ["performance","balanced","development"]){
  const p=planStrategicRest({...s,mode});assert.ok(p.ok,p.reason);assert.deepEqual(p.provisionalDays,[2,3,4,5]);assert.deepEqual(p.confirmedDays,[1]);
  assert.ok(p.plan.every(d=>d.lineup.length===15&&new Set(d.lineup).size===15&&d.lineup.includes("p0")));assert.ok(!p.plan[2].lineup.includes("p1"));
  assert.equal(p.plan.filter(d=>d.lineup.includes("p2")).length,3);
  assert.ok(s.members.every(m=>p.plan.some(d=>d.lineup.includes(m.id))));
  if(mode==="performance")assert.ok(p.warnings.some(w=>w.id==="p0"));
 }
 assert.equal(JSON.stringify(s),before);
});
test("started and locked days unchanged, missing earlier round frozen, unregistered player excluded from future",async()=>{
 const {planStrategicRest}=await load("cwl-strategic-rest.mjs"),s=fixture();
 s.group.wars=[{day:1,state:"inWar",teamSize:15,ownRoster:s.currentPlan[0].lineup.map(id=>({tag:s.members.find(m=>m.id===id).playerTag}))}];
 s.group.upcoming[0].day=3;s.manualLocks=[{day:4,lineup:s.currentPlan[3].lineup}];s.registered.tags=s.registered.tags.filter(t=>t!==s.members[17].playerTag);
 const p=planStrategicRest({...s,mode:"balanced"});assert.ok(p.ok,p.reason);
 assert.deepEqual(p.heldDays,[2]);assert.deepEqual(p.provisionalDays,[5]);
 for(const d of [1,2,4])assert.deepEqual(p.plan[d-1].lineup,s.currentPlan[d-1].lineup);
 for(const d of [3,5])assert.ok(!p.plan[d-1].lineup.includes("p17"));
});
test("group strength uses registered RH distribution and shrunk rates, not total stars; no member identities exposed",async()=>{
 const {summarizeGroupStrength}=await load("supabase/functions/coc-cwl-status/strategic-group-strength.mjs");
 const clans=[0,1,2].map(i=>({tag:tag(i),name:"Clan "+i,members:Array.from({length:15},(_,j)=>({tag:tag(10+i*15+j),townhallLevel:i===2?18:19,name:"PRIVATE"}))}));
 const profiles=[{clanTag:tag(0),playerTag:tag(10),attack:{byTownHall:[{relation:"same",n:3,averageStars:3}]}},{clanTag:tag(1),playerTag:tag(25),attack:{byTownHall:[{relation:"same",n:15,averageStars:2}]}}];
 const rows=summarizeGroupStrength({clans,analyzed:{profiles},teamSize:15,own:tag(0)});
 assert.equal(rows[0].clanTag,tag(0));assert.equal(rows[1].attack.n,15);assert.equal(rows[2].meanTopRh,18);assert.equal(rows[0].topRhs[19],15);
 assert.ok(!JSON.stringify(rows).includes("PRIVATE")&&!JSON.stringify(rows).includes("playerTag"));
 assert.ok(rows[0].attack.adjusted<3);
});
