"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const core=()=>import(pathToFileURL(path.join(__dirname,"..","cwl-stats-core.mjs")).href);
const asOf="2026-11-14T12:00:00.000Z";
const war=(i,date,kind="cwl",opts={})=>({
 war_key:"war:"+i,started_at:date,war_type:kind,team_size:5,
 source:"import",finalized:true,missed_log_complete:true,
 roster_tags:[],...opts
});
const attack=(war_key,tag,stars,order=1,thA=18,thD=18)=>({
 war_key,attacker_tag:tag,attacker_name:tag,
 defender_tag:"#GPQ"+order,attack_order:order,
 attacker_th:thA,defender_th:thD,stars,destruction:stars===3?100:68
});
const missed=(war_key,tag,n=1)=>({
 war_key,player_tag:tag,player_name:tag,missed_count:n
});
test("4/4 3-star attacks outrank 0/12 at the same TH, regardless of raw attack volume",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const w=war(1,"2026-11-10T12:00:00Z");
 const four=Array.from({length:4},(_,i)=>attack(w.war_key,"#PYYY",3,i+1));
 const twelve=Array.from({length:12},(_,i)=>attack(w.war_key,"#PQLV",0,i+1));
 const result=computePlayerFormWindows([w],[...twelve,...four],{asOf,missedEvents:[]});
 const ordered=sortPlayerFormRows(result.players,90);
 assert.deepEqual(ordered.map(x=>x.tag),["#PYYY","#PQLV"]);
 const a=ordered[0].windows[90],b=ordered[1].windows[90];
 assert.equal(a.hitRate,100);
 assert.equal(b.hitRate,0);
 assert.ok(a.formIndex>b.formIndex);
 assert.equal(a.reliability,100);
 assert.equal(b.reliability,100);
});
test("Missed attacks strongly reduce reliability but NEVER change actual triple-attack ratio",async()=>{
 const {computePlayerFormWindows,sortPlayerFormRows}=await core();
 const w=war(2,"2026-11-11T12:00:00Z");
 const a=Array.from({length:4},(_,i)=>attack(w.war_key,"#PYYY",3,i+1));
 const b=Array.from({length:4},(_,i)=>attack(w.war_key,"#PQLV",3,i+1));
 const result=computePlayerFormWindows([w],[...a,...b],{
  asOf,missedEvents:[missed(w.war_key,"#PYYY",1)]
 });
 const p=new Map(result.players.map(x=>[x.tag,x.windows[30]]));
 assert.equal(p.get("#PYYY").hitRate,100);
 assert.equal(p.get("#PYYY").missedKnown,1);
 assert.equal(p.get("#PYYY").performed,4);
 assert.equal(p.get("#PYYY").reliability,80);
 assert.equal(p.get("#PQLV").reliability,100);
 assert.ok(p.get("#PYYY").formIndex<p.get("#PQLV").formIndex);
 assert.equal(sortPlayerFormRows(result.players,30)[0].tag,"#PQLV");
});
test("Proven missed attacks give provisional reliability, never false confirmed score",async()=>{
 const {computePlayerFormWindows}=await core();
 const w=war(3,"2026-11-12T12:00:00Z","normal",{
  missed_log_complete:false,roster_tags:[]
 });
 const player=computePlayerFormWindows([w],[attack(w.war_key,"#PYYY",3)],{
  asOf,missedEvents:[missed(w.war_key,"#PYYY",1)]
 }).players[0].windows[30];
 assert.equal(player.hitRate,100);
 assert.equal(player.performed,1);
 assert.equal(player.missedKnown,1);
 assert.equal(player.reliabilityComplete,false);
 assert.equal(player.reliabilityProvisional,true);
 assert.equal(player.reliability,50);
 assert.equal(player.formProvisional,true);
 assert.ok(player.formIndex>0);
 assert.ok(player.performanceIndex>0);
});
test("16 executed and 4 proven missed show ≈80% provisional reliability without synthetic 0-star hits",async()=>{
 const {computePlayerFormWindows}=await core();
 const wars=Array.from({length:10},(_,i)=>war("subset"+i,
   "2026-11-"+String(i+1).padStart(2,"0")+"T12:00:00Z","normal",{
     missed_log_complete:false,roster_tags:[]
   }));
 const real=wars.slice(0,8).flatMap(w=>[
   attack(w.war_key,"#PYYY",3,1),attack(w.war_key,"#PYYY",2,2)
 ]);
 const missedEvents=wars.slice(8).map(w=>missed(w.war_key,"#PYYY",2));
 const b=computePlayerFormWindows(wars,real,{asOf,missedEvents}).players
   .find(p=>p.tag==="#PYYY").windows[30];
 assert.equal(b.performed,16);
 assert.equal(b.missedKnown,4);
 assert.equal(b.attacks,16);
 assert.equal(b.triples,8);
 assert.equal(b.hitRate,50);
 assert.equal(b.reliability,80);
 assert.equal(b.reliabilityComplete,false);
 assert.equal(b.reliabilityProvisional,true);
 assert.equal(b.formProvisional,true);
 assert.equal(b.formIndex,Math.round(.65*b.performanceIndex+.35*80));
});
test("Incomplete log without any confirmed missed attacks does not fabricate 100% reliability",async()=>{
 const {computePlayerFormWindows}=await core();
 const w=war("no-proof","2026-11-10T12:00:00Z","normal",{
   missed_log_complete:false,roster_tags:[]
 });
 const b=computePlayerFormWindows([w],[attack(w.war_key,"#PYYY",3)],{asOf})
   .players[0].windows[30];
 assert.equal(b.missedKnown,0);
 assert.equal(b.reliability,null);
 assert.equal(b.reliabilityProvisional,false);
 assert.equal(b.formIndex,null);
 assert.ok(b.performanceIndex>0);
});
test("Missed-only players are visible without a fabricated 0-percent attack score",async()=>{
 const {computePlayerFormWindows}=await core();
 const w=war(4,"2026-11-10T12:00:00Z");
 const result=computePlayerFormWindows([w],[],{
  asOf,missedEvents:[missed(w.war_key,"#PYYY")]
 });
 const p=result.players[0].windows[90];
 assert.equal(result.players.length,1);
 assert.equal(p.attacks,0);
 assert.equal(p.hitRate,null);
 assert.equal(p.reliability,0);
 assert.equal(p.missedKnown,1);
 assert.equal(p.formIndex,null);
});
test("Unchanged normal-war roster fallback is evidence for missed slots, not extra 0-star attacks",async()=>{
 const {computePlayerFormWindows}=await core();
 const w=war(5,"2026-11-11T12:00:00Z","normal",{
  missed_log_complete:false,team_size:2,roster_tags:["#PYYY","#PQLV"]
 });
 const rows=[attack(w.war_key,"#PYYY",3),attack(w.war_key,"#PYYY",3,2),
   attack(w.war_key,"#PQLV",3)];
 const result=computePlayerFormWindows([w],rows,{asOf,missedEvents:[]});
 const p=new Map(result.players.map(x=>[x.tag,x.windows[30]]));
 assert.equal(p.get("#PYYY").missedKnown,0);
 assert.equal(p.get("#PQLV").missedKnown,1);
 assert.equal(p.get("#PQLV").reliability,50);
 assert.equal(p.get("#PQLV").hitRate,100);
 assert.equal(p.get("#PQLV").reliabilityComplete,true);
});
test("Player date filter respects 30, 90, 180 and all without changing overview",async()=>{
 const {computeWarStats,describeWarSelection}=await core();
 const wars=[
 war(6,"2026-11-10T12:00:00Z","normal"),
 war(7,"2026-09-10T12:00:00Z","normal"),
 war(8,"2026-06-10T12:00:00Z","normal"),
 war(9,"2025-10-10T12:00:00Z","normal")
 ];
 const attacks=wars.map(w=>attack(w.war_key,"#PYYY",3));
 const count=(days,last="all")=>computeWarStats(wars,attacks,{
  type:"normal",days,last,cwlSeasons:"all",asOf,missedEvents:[]
 }).attacks;
 assert.equal(count("30"),1);
 assert.equal(count("90"),2);
 assert.equal(count("180"),3);
 assert.equal(count("365"),3);
 assert.equal(count("all"),4);
 assert.equal(count("all",2),2);
 assert.equal(count("365",2),2);
 assert.equal(describeWarSelection(wars,{type:"normal",last:"all",days:"30",asOf}).selectedWars,1);
 const overview=computeWarStats(wars,attacks,{
  type:"all",last:"all",cwlSeasons:"all",asOf,missedEvents:[]
 });
 assert.equal(overview.wars,4);
});
