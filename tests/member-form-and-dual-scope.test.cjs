"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.join(__dirname,"..");
const core=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")).href);
const member=()=>import(pathToFileURL(path.join(root,"cwl-member-form.mjs")).href);
const war=(id,date,type="normal",extra={})=>({
 war_key:id,started_at:date,war_type:type,team_size:3,finalized:true,source:"api",
 missed_log_complete:true,roster_tags:[],...extra
});
const attack=(w,tag,stars,order=1,th=18,enemyTH=18)=>({
 war_key:w,attacker_tag:tag,attacker_name:tag,attacker_th:th,defender_th:enemyTH,
 defender_tag:"#2QPG",attack_order:order,stars,destruction:stars===3?100:65
});
const missed=(w,tag,n=1)=>({war_key:w,player_tag:tag,missed_count:n,player_name:tag});
const asOf="2026-11-15T12:00:00Z";
test("overall player form and CWL-only form are independent evidence sets",async()=>{
 const {computePlayerFormWindows}=await core();
 const wars=[war("regular","2026-11-08T10:00:00Z"),war("league","2026-11-09T10:00:00Z","cwl")];
 const attacks=[attack("regular","#2PYL",3),attack("regular","#2PYL",3,2),
  attack("league","#2PYL",0)];
 const opts={asOf,windows:[30],missedEvents:[missed("regular","#2PYL",1)]};
 const all=computePlayerFormWindows(wars,attacks,opts).players[0].windows[30];
 const cwl=computePlayerFormWindows(wars,attacks,{...opts,warTypes:["cwl"]})
   .players[0].windows[30];
 assert.equal(all.performed,3);
 assert.equal(all.missedKnown,1);
 assert.equal(all.attacks,3);
 assert.equal(cwl.attacks,1);
 assert.equal(cwl.hitRate,0);
 assert.equal(cwl.missedKnown,0);
 assert.equal(cwl.reliability,100);
 assert.ok(all.hitRate>cwl.hitRate);
 assert.throws(()=>computePlayerFormWindows(wars,attacks,{...opts,warTypes:["fake"]}),
  /Ungültige Kriegstypen/);
});
test("member evidence uses newest separate CWL run and last five normal CWs",async()=>{
 const {computeMemberFormEvidence}=await member();
 const wars=[
  war("jun1","2026-06-09T10:00:00Z","cwl"),
  war("jun2","2026-06-12T10:00:00Z","cwl"),
  war("jun3","2026-06-25T10:00:00Z","cwl"),
  war("jun4","2026-06-27T10:00:00Z","cwl"),
  war("nov1","2026-11-06T10:00:00Z","cwl"),
  war("nov2","2026-11-07T10:00:00Z","cwl"),
  ...Array.from({length:7},(_,i)=>war("cw"+i,
    "2026-"+(i<6?"10":"09")+"-"+String(26-i).padStart(2,"0")+"T10:00:00Z"))
 ];
 const attacks=[
  attack("nov1","#2PYL",3),attack("nov2","#2PYL",2),
  attack("jun3","#PQLV",3),
  ...Array.from({length:7},(_,i)=>attack("cw"+i,"#PQLV",3))
 ];
 const result=computeMemberFormEvidence(wars,attacks,{
   asOf,memberTags:["#2PYL","#PQLV","#8PYL"]
 });
 assert.equal(result.lastCwlRun.from,"2026-11-06");
 assert.equal(result.lastCwlRun.days,2);
 assert.equal(result.cwWarCount,5);
 const cwl=result.byTag.get("#2PYL"),cw=result.byTag.get("#PQLV"),absent=result.byTag.get("#8PYL");
 assert.equal(cwl.source,"cwl");
 assert.equal(cwl.comparable,2);
 assert.equal(cwl.cw?.performed||0,0);
 assert.equal(cw.source,"cw");
 assert.equal(cw.performed,5);
 assert.equal(cw.hasCwlEvidence,false);
 assert.equal(absent.source,null);
 assert.equal(absent.score,null);
 assert.equal(absent.reliability,null);
});
test("member form never treats incomplete missed logs as known reliability",async()=>{
 const {computeMemberFormEvidence}=await member();
 const wars=[war("cwl0","2026-11-09T10:00:00Z","cwl",{
   missed_log_complete:false
 })];
 const result=computeMemberFormEvidence(wars,[attack("cwl0","#2PYL",3)],{
  asOf,memberTags:["#2PYL"],missedEvents:[missed("cwl0","#2PYL")]
 });
 const p=result.byTag.get("#2PYL");
 assert.equal(p.source,"cwl");
 assert.equal(p.performance!==null,true);
 assert.equal(p.reliability,null);
 assert.equal(p.score,null);
 assert.equal(p.missedKnown,1);
});
test("statistics and members present separate sources without changing plan strength",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/id="statsScopeTypes"/);
 assert.match(html,/id="statsScopeDays"/);
 assert.match(html,/data-stats-days="365"/);
 assert.match(html,/id="statsPeriodConfig"/);
 assert.match(html,/data-form-kind="cwl"/);
 assert.match(html,/getMemberFormSummary/);
 assert.match(html,/Formwert/);
 assert.doesNotMatch(html,/strengthOption\.textContent=window\.CWLCloud\?\.active\?"3★-Quote · letzte 7 Angriffe"/);
 assert.match(stats,/scopeMode="days"/);
 assert.match(stats,/warTypes:formKind==="cwl"/);
 assert.match(stats,/getMemberFormSummary/);
 assert.match(stats,/last="all";cwlSeasons="all"/);
});
