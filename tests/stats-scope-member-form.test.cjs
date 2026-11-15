"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const core=()=>import(pathToFileURL(path.join(__dirname,"..","cwl-stats-core.mjs")).href);
const asOf="2026-11-15T12:00:00Z";
const mkWar=(key,kind,date,extra={})=>({
 war_key:key,war_type:kind,started_at:date,source:"import",
 team_size:2,finalized:true,missed_log_complete:true,roster_tags:[],...extra
});
const attack=(war_key,tag,stars,order=1)=>({
 war_key,attacker_tag:tag,attacker_name:tag,
 defender_tag:"#8QPY",attacker_th:18,defender_th:18,
 stars,destruction:stars===3?100:65,attack_order:order
});
const player=(rows,tag)=>rows.players.find(p=>p.tag===tag);

test("CWL-Form never inherits CW attacks or raw player-statistic filters",async()=>{
 const {computePlayerFormWindows}=await core();
 const wars=[mkWar("cw1","normal","2026-11-11T12:00:00Z"),
   mkWar("l1","cwl","2026-11-12T12:00:00Z")];
 const events=[attack("cw1","#PYYY",3),attack("l1","#PYYY",0)];
 const all=computePlayerFormWindows(wars,events,{asOf,windows:[30],warType:"all"});
 const cwl=computePlayerFormWindows(wars,events,{asOf,windows:[30],warType:"cwl"});
 assert.equal(player(all,"#PYYY").windows[30].attacks,2);
 assert.equal(player(cwl,"#PYYY").windows[30].attacks,1);
 assert.equal(player(cwl,"#PYYY").windows[30].hitRate,0);
 assert.equal(player(cwl,"#PYYY").windows[30].normal,0);
 assert.equal(player(cwl,"#PYYY").windows[30].cwl,1);
});

test("Member display uses latest CWL, and CW fallback if that player did not participate",async()=>{
 const {computeMemberFormSummary}=await core();
 const wars=[
  ...[5,6,7,8,9,10].map((day,i)=>
    mkWar("cw"+i,"normal",`2026-11-${String(day).padStart(2,"0")}T12:00:00Z`)),
  mkWar("old-cwl","cwl","2026-10-05T12:00:00Z",{league_run_id:"old"}),
  mkWar("latest1","cwl","2026-11-01T12:00:00Z",{league_run_id:"new"}),
  mkWar("latest2","cwl","2026-11-02T12:00:00Z",{league_run_id:"new"})
 ];
 const events=[
  ...[0,1,2,3,4,5].map(i=>attack("cw"+i,"#PYYY",3)),
  ...[0,1,2,3,4,5].map(i=>attack("cw"+i,"#PQLV",3)),
  attack("old-cwl","#PQLV",3),
  attack("latest1","#PYYY",3),attack("latest2","#PYYY",2)
 ];
 const result=computeMemberFormSummary(wars,events,{
  asOf,memberTags:["#PYYY","#PQLV","#8PYL"],recentCwCount:5
 });
 assert.equal(result.latestCwl.days,2);
 assert.equal(result.cwCount,5);
 const active=player(result,"#PYYY"),absent=player(result,"#PQLV");
 assert.equal(active.source,"cwl");
 assert.equal(active.cwl.attacks,2);
 assert.equal(active.cw.attacks,5);
 assert.equal(active.combined.attacks,7);
 assert.equal(absent.source,"cw-fallback");
 assert.equal(absent.cwl.attacks,0);
 assert.equal(absent.cw.attacks,5);
 assert.equal(absent.preferred.hitRate,100);
 const unknown=player(result,"#8PYL");
 assert.equal(unknown.source,"none");
 assert.equal(unknown.preferred,null);
 assert.equal(unknown.cwl.hitRate,null);
 assert.equal(unknown.cw.reliability,null);
});

test("Incomplete missed evidence makes composite unknown without creating false bad performance",async()=>{
 const {computeMemberFormSummary}=await core();
 const wars=[
  mkWar("cw","normal","2026-11-08T12:00:00Z",{missed_log_complete:false}),
  mkWar("last-cwl","cwl","2026-11-10T12:00:00Z",{missed_log_complete:false})
 ];
 const result=computeMemberFormSummary(wars,[attack("last-cwl","#PYYY",3),
   attack("cw","#PQLV",3)],{
  asOf,memberTags:["#PYYY","#PQLV"]
 });
 const league=player(result,"#PYYY");
 assert.equal(league.source,"cwl");
 assert.equal(league.preferred.hitRate,100);
 assert.equal(league.preferred.reliability,null);
 assert.equal(league.preferred.formIndex,null);
 assert.ok(league.preferred.performanceIndex>0);
 const fallback=player(result,"#PQLV");
 assert.equal(fallback.source,"cw-fallback");
 assert.equal(fallback.cwl.attacks,0);
 assert.equal(fallback.preferred.reliability,null);
});

test("Member form does not blend unfinished API CWL or a foreign player's identity",async()=>{
 const {computeMemberFormSummary}=await core();
 const wars=[mkWar("ended","cwl","2026-10-01T12:00:00Z"),
   mkWar("running","cwl","2026-11-13T12:00:00Z",{source:"api",finalized:false})];
 const result=computeMemberFormSummary(wars,[attack("running","#PYYY",3),
   attack("ended","#PQLV",3)],{asOf,memberTags:["#PYYY","#PQLV"]});
 assert.equal(result.latestCwl.days,1);
 assert.equal(result.players.find(x=>x.tag==="#PYYY").source,"none");
 assert.equal(result.players.find(x=>x.tag==="#PQLV").source,"cwl");
});
