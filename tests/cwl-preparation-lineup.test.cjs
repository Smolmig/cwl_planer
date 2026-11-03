"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const core=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live-core.mjs")).href);
const make=(id,tag,townHall=19)=>({id,name:"Spieler "+id,playerTag:tag,townHall,
 participating:true,statuses:Array(7).fill("auto")});
function fixture(){
 const members=[
  make("A","#2PYL"),make("B","#2PYQ"),
  make("C","#2PYV"),make("D","#2PYG"),
  make("E","#2PYR"),make("F","#2PYJ")
 ];
 const side=names=>names.map(id=>{
  const m=members.find(p=>p.id===id);return {name:m.name,tag:m.playerTag,townHallLevel:m.townHall}
 });
 const profile={config:{slots:4,days:7},members,archivedMembers:[]};
 const plan={day:1,lineup:["A","B","E","F"],warnings:[],locked:false};
 const round={day:1,available:true,warTag:"#2PQV",state:"preparation",teamSize:4,
  clan:{members:side(["A","B","C","D"])},
  opponent:{members:side(["C","D","E","F"])}};
 return {profile,plan,round};
}
test("two initial changes identify removals in Clash and additions from planner",async()=>{
 const {reviewPreparationLineup}=await core();
 const {profile,plan,round}=fixture(),original=JSON.stringify({profile,plan,round});
 const out=reviewPreparationLineup(profile,plan,round);
 assert.equal(out.status,"changes");
 assert.equal(out.teamSize,4);
 assert.equal(out.matched,2);
 assert.deepEqual(out.toRemove.map(m=>m.name),["Spieler C","Spieler D"]);
 assert.deepEqual(out.toAdd.map(m=>m.name),["Spieler E","Spieler F"]);
 assert.equal(JSON.stringify({profile,plan,round}),original,"preview must never edit the plan or API snapshot");
});
test("matching temporary lineup shows no unnecessary changes",async()=>{
 const {reviewPreparationLineup}=await core();
 const {profile,plan,round}=fixture();
 plan.lineup=["A","B","C","D"];
 const out=reviewPreparationLineup(profile,plan,round);
 assert.equal(out.status,"match");
 assert.deepEqual(out.toRemove,[]);
 assert.deepEqual(out.toAdd,[]);
});
test("missing data, wrong team size, old locked day and impossible plan are not treated as matching",async()=>{
 const {reviewPreparationLineup}=await core();
 for(const invalid of [
  x=>{x.round.clan.members.pop()},
  x=>{x.round.clan.members[0].tag="#INVALID"},
  x=>{x.round.clan.members[0].tag=x.round.clan.members[1].tag},
  x=>{x.profile.config.slots=15},
  x=>{x.plan.lineup.pop()},
  x=>{x.plan.warnings=["MUSS-Konflikt"]},
  x=>{x.plan.locked=true},
  x=>{x.profile.members[4].playerTag=""},
  x=>{x.profile.members[4].playerTag=x.profile.members[5].playerTag}
 ]) {
  const x=fixture();invalid(x);
  const out=reviewPreparationLineup(x.profile,x.plan,x.round);
  assert.equal(out.status,"unavailable",JSON.stringify(x).slice(0,130));
  assert.equal(out.toRemove.length,0);
  assert.equal(out.toAdd.length,0);
 }
 const x=fixture();
 assert.equal(reviewPreparationLineup(x.profile,x.plan,x.round,{planningOk:false}).status,"unavailable");
 assert.equal(reviewPreparationLineup(x.profile,null,x.round).status,"unavailable");
});
test("non-preparation rounds and missing wars do not create swap advice",async()=>{
 const {reviewPreparationLineup}=await core();
 const x=fixture();
 x.round.state="inWar";
 assert.equal(reviewPreparationLineup(x.profile,x.plan,x.round),null);
 x.round.state="preparation";x.round.available=false;
 assert.equal(reviewPreparationLineup(x.profile,x.plan,x.round),null);
});
