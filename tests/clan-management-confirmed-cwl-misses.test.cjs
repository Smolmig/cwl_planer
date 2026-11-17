"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const {evaluate}=require("../clan-management-missed-core.js");
const one="2026-11-15T20:00:00Z",two="2026-11-16T20:00:00Z";
const player={tag:"#2PYL",name:"Clasher",role:"admin"};
const roster=["#2PYL","#2PYQ"];
const war=(key,start,extra={})=>({
 war_key:"cwl:"+key,war_type:"cwl",source:"api",started_at:start,
 finalized:true,missed_log_complete:true,team_size:2,roster_tags:roster,...extra
});
const missed=key=>({war_key:"cwl:"+key,player_tag:"#2PYL",missed_count:1});
const payload=()=>({wars:[war("#2PYR",one),war("#2PYJ",two)],
 missed:[missed("#2PYR"),missed("#2PYJ")],decisions:[]});
const now=Date.parse("2026-11-17T12:00:00Z");

test("an elder with two adjacent, confirmed missed CWL days gets only a manual review",()=>{
 const x=evaluate([player],payload(),now);
 assert.equal(x.length,1);assert.equal(x[0].severe,true);
 assert.equal(x[0].missedCount,2);
 assert.equal(x[0].status,"Degradierung prüfen");
 assert.match(x[0].note,/Zwei aufeinanderfolgende/);
 assert.match(x[0].note,/nur manuell/);
 assert.ok(!("write" in x[0]));
});
test("one documented CWL miss is a review, not an automatic degradation",()=>{
 const p=payload();p.missed.pop();
 const x=evaluate([player],p,now);
 assert.equal(x[0].status,"Fehlangriff prüfen");assert.equal(x[0].severe,false);
 assert.equal(x[0].missedCount,1);
 assert.equal(evaluate([{...player,role:"member"}],payload(),now)[0].severe,false);
 assert.deepEqual(evaluate([{...player,role:"coLeader"}],payload(),now),[]);
 assert.deepEqual(evaluate([{...player,role:"leader"}],payload(),now),[]);
});
test("latest explicit owner excusal suppresses the affected miss even after later prior decisions",()=>{
 const p=payload();
 p.decisions=[
  {id:4,war_key:"cwl:#2PYR",player_tag:"#2PYL",decision:"excused"},
  {id:8,war_key:"cwl:#2PYJ",player_tag:"#2PYL",decision:"later"},
  {id:11,war_key:"cwl:#2PYJ",player_tag:"#2PYL",decision:"excused"}
 ];
 assert.deepEqual(evaluate([player],p,now),[],"both events forgiven in owner log");
 p.decisions.push({id:12,war_key:"cwl:#2PYJ",player_tag:"#2PYL",decision:"review_pause"});
 const x=evaluate([player],p,now);
 assert.equal(x[0].missedCount,1);
 assert.equal(x[0].excusedCount,1);
 assert.equal(x[0].severe,false,"one still open event is not a streak");
});
test("a gap or other captured war between misses cannot become a consecutive streak",()=>{
 const p=payload();
 p.wars[1].started_at="2026-11-18T20:00:00Z";
 assert.equal(evaluate([player],p,Date.parse("2026-11-19T12:00:00Z"))[0].severe,false);
 const q=payload();
 q.wars.push(war("#2PY9","2026-11-16T08:00:00Z"));
 assert.equal(evaluate([player],q,now)[0].severe,false);
});
test("incomplete, imported, non-API or inconsistent sources fail closed",()=>{
 for(const mutation of [
  p=>p.wars[0].source="import",
  p=>p.wars[0].finalized=false,
  p=>p.wars[0].missed_log_complete=false,
  p=>p.wars[0].roster_tags=["#2PYQ"],
  p=>p.wars[0].roster_tags=["#2PYQ","#2PYQ"],
  p=>p.missed[0].missed_count=2,
  p=>p.missed[0].player_tag="#2PYU",
  p=>p.decisions.push({id:1,war_key:"cwl:#2PYR",player_tag:"#2PYL",decision:"unknown"})
 ]){
  const p=payload();mutation(p);
  assert.equal(evaluate([player],p,now),null,"no guessed discipline from bad evidence");
 }
 assert.equal(evaluate([player],null,now),null,"failed RLS/HTTP read is not an empty log");
 assert.deepEqual(evaluate([player],{wars:[],missed:[],decisions:[]},now),[]);
});
test("feature only reads tenant-local owner data; no login/offline inference and no new mutation",()=>{
 const sync=read("cloud-sync.mjs"),app=read("cloud-app.html"),core=read("clan-management-missed-core.js");
 assert.match(sync,/role!=="owner"/);
 assert.match(sync,/\.from\("cwl_stat_wars"\)/);
 assert.match(sync,/\.eq\("clan_id",expectedClan\)\.eq\("war_type","cwl"\)\.eq\("source","api"\)/);
 assert.match(sync,/\.eq\("finalized",true\)\.eq\("missed_log_complete",true\)/);
 assert.match(sync,/\.from\("cwl_stat_missed"\)/);
 assert.match(sync,/\.from\("cwl_missed_owner_decisions"\)/);
 assert.match(sync,/\.in\("war_key",keys\)/);
 assert.match(core,/decision==="excused"/);
 assert.doesNotMatch(core,/last.login|lastLogin|onlineTime|kickPlayer/i);
 assert.match(app,/clan-management-missed-core\.js/);
 assert.match(app,/clanManagementMissedPanel/);
 assert.match(app,/keinen letzten Login/);
 const start=app.indexOf("function renderClanManagementMisses("),
  end=app.indexOf("function renderClanManagementReviewSummary()",start);
 assert.ok(start>0&&end>start);
 const dom=new JSDOM('<details id="clanManagementMissedPanel"><summary id="clanManagementMissedHeading"></summary><div id="clanManagementMissedList"></div></details>');
 const render=new Function("document","window",app.slice(start,end)+"\nreturn renderClanManagementMisses;")(
  dom.window.document,{CWLClanMissedReview:{evaluate}});
 render([player],payload());
 assert.match(dom.window.document.getElementById("clanManagementMissedHeading").textContent,/1 Ranghinweis/);
 assert.match(dom.window.document.getElementById("clanManagementMissedList").textContent,/Degradierung prüfen/);
 render([player],null);
 assert.match(dom.window.document.getElementById("clanManagementMissedList").textContent,/keine Degradierungsempfehlung/);
 dom.window.close();
});
