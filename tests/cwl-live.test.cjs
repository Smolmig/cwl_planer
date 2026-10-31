const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,"cwl-live-core.mjs")).href);
const time=Date.parse("2026-11-05T10:00:00Z");
function snapshot() {
 const members=[
  {tag:"#2PYL",name:"Alpha",townHallLevel:19,attacks:[{attackerTag:"#2PYL",defenderTag:"#Q2V",stars:3,destructionPercentage:100}]},
  {tag:"#JRC",name:"Bravo",townHallLevel:18,attacks:[]}
 ];
 const enemy=[
  {tag:"#Q2V",name:"Gegner A",townHallLevel:20,attacks:[]},
  {tag:"#8PY",name:"Gegner B",townHallLevel:19,attacks:[]}
 ];
 return {ok:true,active:true,clanTag:"#2PQ",season:"2026-11",
  rounds:[{day:1,available:true,warTag:"#PLQ",state:"warEnded",teamSize:2,
    endTime:"20261104T020000.000Z",startTime:"20261103T020000.000Z",
    clan:{tag:"#2PQ",name:"Unsere",members},opponent:{tag:"#JQV",name:"Andere",members:enemy}},
   ...Array.from({length:6},(_,i)=>({day:i+2,available:false}))]};
}
function profile() {
 return {config:{slots:2,days:7},members:[
  {id:"member1",name:"Alpha",playerTag:"#2PYL",threeStar:"high"}],
  archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]}))};
}
test("CWL opponent, enemy TH and attack results are retained",async()=>{
 const {sanitizeSnapshot}=await load();
 const snap=sanitizeSnapshot(snapshot());
 assert.equal(snap.rounds[0].opponent.name,"Andere");
 assert.deepEqual(snap.rounds[0].opponent.members.map(m=>m.townHallLevel),[20,19]);
 assert.equal(snap.rounds[0].clan.members[0].attacks[0].stars,3);
 assert.equal(snap.rounds[0].clan.members[0].attacks[0].destructionPercentage,100);
 assert.equal(snap.rounds[1].available,false);
});
test("Only finished wars with complete actual lineups can be auto-confirmed",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 let uid=1;
 const apply=()=>reconcileCwl(p,snapshot(),name=>({id:"new_"+uid++,name,threeStar:"unknown"}),time);
 const first=apply();
 assert.deepEqual(first.lockedDays,[1]);
 assert.deepEqual(p.locks[0].lineup,["member1","new_1"]);
 assert.equal(p.locks[0].source,"coc-api");
 assert.equal(p.locks[0].warTag,"#PLQ");
 assert.equal(p.archivedMembers[0].name,"Bravo");
 assert.equal(p.members.length,1);
 const second=apply();
 assert.equal(second.changed,false);
 assert.deepEqual(second.lockedDays,[]);
 assert.equal(p.archivedMembers.length,1);
 assert.equal(p.locks.filter(l=>l.locked).length,1);
});
test("Unfinished wars, mismatched team sizes and placeholder wars cannot close days",async()=>{
 const {reconcileCwl}=await load();
 for(const mutate of [
  p=>p.rounds[0].state="inWar",
  p=>p.rounds[0].warTag="#0",
  p=>p.rounds[0].teamSize=15,
  p=>p.rounds[0].clan.members.pop(),
  p=>p.rounds[0].endTime="20261106T020000.000Z"
 ]) {
  const snap=snapshot();mutate(snap);
  const p=profile();
  const result=reconcileCwl(p,snap,name=>({id:name,name}),time);
  assert.deepEqual(result.lockedDays,[]);
  assert.equal(p.locks[0].locked,false);
 }
});
test("Manual played history and earlier seasons are never overwritten",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 p.locks[0]={locked:true,lineup:["manual1","manual2"]};
 const untouched=JSON.stringify(p.locks[0]);
 const result=reconcileCwl(p,snapshot(),name=>({id:name,name}),time);
 assert.equal(result.reason,"unlinked_manual_history");
 assert.equal(JSON.stringify(p.locks[0]),untouched);
 p.cwlLive={season:"2026-10",clanTag:"#2PQ",rounds:[]};
 assert.equal(reconcileCwl(p,snapshot(),name=>({id:name,name}),time).reason,"previous_season_locked");
 assert.equal(JSON.stringify(p.locks[0]),untouched);
});
test("Intentional CWL reset ignores the previous season rather than relocking it",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();p.cwlLiveIgnoredSeason="2026-11";
 assert.equal(reconcileCwl(p,snapshot(),name=>({id:name,name}),time).reason,"season_explicitly_reset");
 assert.equal(p.locks[0].locked,false);
});
test("Without a CWL the normal v9 plan stays untouched",async()=>{
 const {reconcileCwl}=await load();
 const p=profile();
 assert.equal(reconcileCwl(p,{ok:true,active:false},name=>({id:name,name}),time).changed,false);
 assert.equal(p.cwlLive,undefined);
});
test("Cloud only: server endpoint is authenticated and app retains local planner",()=>{
 const proxy=fs.readFileSync(path.join(root,"supabase/functions/coc-cwl-status/index.ts"),"utf8");
 const mod=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const cloud=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const guest=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(proxy,/withSupabase\(\{auth:"user"\}/);
 assert.match(proxy,/cwl_clan_memberships/);
 assert.match(proxy,/COC_API_KEY/);
 assert.match(proxy,/currentwar\/leaguegroup/);
 assert.match(proxy,/clanwarleagues\/wars/);
 assert.doesNotMatch(mod,/COC_API_KEY|Bearer .*COC_/);
 assert.match(mod,/createCwlLive/);
 assert.match(cloud,/const DATA_VERSION=9;/);
 assert.match(cloud,/const STORAGE_KEY="cwl_planer_mobile_v9";/);
 assert.match(guest,/const APP_VERSION="v1\.0\.2";/);
});
