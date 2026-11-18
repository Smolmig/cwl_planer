"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const core=require("../clan-management-cw-core.js");
const root=path.resolve(__dirname,"..");
const one="2026-11-12T18:00:00Z",two="2026-11-14T18:00:00Z";
const roster=["#2PYL","#2PYQ"];
const members=[
 {tag:"#2PYL",name:"Elder",role:"admin"},
 {tag:"#2PYQ",name:"Member",role:"member"},
 {tag:"#2PYR",name:"Vice",role:"coLeader"}
];
const war=(date,i,complete=true)=>({
 war_key:"normal:202611"+i+"T180000.000Z:#QPYL",
 started_at:date,source_clash_tag:"#2PYL",war_type:"normal",
 source:"api",finalized:true,missed_log_complete:complete,
 team_size:2,roster_tags:roster
});
const w1=war(one,"12"),w2=war(two,"14");
const miss=(key,count,player="#2PYL")=>({war_key:key,player_tag:player,missed_count:count});
const incident=(id,war,action,note="")=>({
 id,war_key:war.war_key,player_tag:"#2PYL",decision:action,note,
 created_at:"2026-11-16T12:00:00Z"
});
const sample=()=>({wars:[w1,w2],missed:[miss(w1.war_key,1),miss(w2.war_key,1)],
 decisions:[]});
const evaluate=(p=sample(),ms=members)=>core.evaluate(ms,p,"#2PYL",Date.parse("2026-11-18T12:00:00Z"));

test("single missed attack is review only; 0/2 prompts elder manual degradation review",()=>{
 const p=sample();p.missed.pop();
 let x=evaluate(p).rows[0];
 assert.equal(x.openCount,1);assert.equal(x.severe,false);
 assert.equal(x.status,"Fehlangriff prüfen");assert.match(x.reason,/1 von 2/);
 p.missed=[miss(w1.war_key,2)];
 x=evaluate(p).rows[0];
 assert.equal(x.severe,true);assert.equal(x.status,"Degradierung prüfen");
 assert.equal(x.events[0].missing,2);
 const member=evaluate({...p,missed:[miss(w1.war_key,2,"#2PYQ")]})
  .rows.find(r=>r.tag==="#2PYQ");
 assert.equal(member.status,"Verwarnung prüfen");
 assert.equal(member.severe,false);
});
test("two documented adjacent 1/2 normal wars require review; unknown interposed war blocks",()=>{
 const x=evaluate().rows[0];
 assert.equal(x.consecutive,true);assert.equal(x.severe,true);
 const extra=war("2026-11-13T18:00:00Z","13",false);
 const p=sample();p.wars.push(extra);
 assert.equal(evaluate(p).rows[0].consecutive,false);
 assert.equal(evaluate(p).rows[0].severe,false);
 const huge=sample();huge.wars[1]={...w2,started_at:"2026-11-25T18:00:00Z"};
 assert.equal(core.evaluate(members,huge,"#2PYL",Date.parse("2026-11-26T12:00:00Z")).rows[0].consecutive,false);
});
test("append-only latest decision governs each incident; history remains inspectable",()=>{
 const p=sample();p.decisions=[incident(1,w1,"acknowledged"),incident(2,w1,"excused","Krank")];
 let x=evaluate(p).rows[0];
 assert.equal(x.openCount,1);assert.equal(x.excusedCount,1);
 assert.equal(x.events.find(e=>e.war.war_key===w1.war_key).history.length,2);
 assert.equal(x.events.find(e=>e.war.war_key===w1.war_key).latest.decision,"excused");
 p.decisions.push(incident(3,w2,"acknowledged"));
 x=evaluate(p).rows[0];
 assert.equal(x.status,"Bereits entschieden");
 assert.equal(x.openCount,0);
 p.decisions.push(incident(4,w1,"reopened"));
 x=evaluate(p).rows[0];
 assert.equal(x.openCount,1);
 assert.equal(x.excusedCount,0);
});
test("wrong tenant, tag, sources, partial rows, duplicate wars and forged decisions fail closed",()=>{
 for(const mutate of [
  p=>p.wars[0].source="import",
  p=>p.wars[0].source_clash_tag="#QPYL",
  p=>p.wars[0].finalized=false,
  p=>p.wars[0].roster_tags=["#2PYL"],
  p=>p.wars[0].roster_tags=["#2PYL","#2PYL"],
  p=>p.wars.push({...p.wars[0]}),
  p=>p.missed[0].missed_count=3,
  p=>p.missed[0].player_tag="#QPYL",
  p=>p.decisions.push(incident(1,w1,"not_a_decision")),
  p=>p.decisions.push(incident(1,w1,"excused","x".repeat(281)))
 ]){
  const p=sample();mutate(p);
  assert.equal(evaluate(p),null);
 }
 assert.equal(evaluate(null),null);
 assert.equal(core.evaluate(members,sample(),"#QPYL"),null);
 assert.equal(evaluate(sample(),[{tag:"#2PYL",name:"x",role:"admin"},
  {tag:"#2PYL",name:"x",role:"admin"}]),null);
 assert.deepEqual(evaluate(sample(),[{tag:"#2PYL",name:"Vice",role:"coLeader"}]).rows,[]);
});
test("normal-CW browser renders transparent evidence and can append an owner decision without a full reload",async()=>{
 const source=fs.readFileSync(path.join(root,"clan-management-cw-view.js"),"utf8");
 const dom=new JSDOM('<details id="clanManagementNormalPanel"><summary id="clanManagementNormalHeading"></summary>'+
  '<div id="clanManagementNormalList"></div></details>',{url:"https://example.test"});
 const win=dom.window,document=win.document;let writes=0,clan="tenant-1";
 win.CWLClanNormalMissedReview=core;
 win.CWLCloud={
  active:true,isOwner:()=>true,getActiveClanId:()=>clan,
  async saveManagementNormalCwDecision(warKey,playerTag,choice,note){
   writes++;
   return {id:11,war_key:warKey,player_tag:playerTag,decision:choice,note,
    created_at:"2026-11-18T08:00:00Z"};
  }
 };
 (new Function("window","document",source))(win,document);
 try{
  win.CWLNormalCwUI.render(members,sample(),"#2PYL");
  const list=document.getElementById("clanManagementNormalList");
  assert.match(list.textContent,/Degradierung prüfen/);
  assert.equal(list.querySelectorAll(".clan-management-person").length,1);
  const details=list.querySelector(".clan-management-evidence");details.open=true;
  const button=list.querySelector('button[aria-label*="Als geprüft markieren"]');
  assert.ok(button);button.click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(writes,1);
  assert.match(list.textContent,/Als geprüft markiert/);
  assert.ok(document.querySelector(".clan-management-evidence").open);
  win.CWLNormalCwUI.clear();
  assert.equal(list.textContent,"");
  assert.equal(document.getElementById("clanManagementNormalPanel").open,false);
 }finally{win.close()}
});
test("cloud path is authenticated owner-only and never alters plans or other tenants",()=>{
 const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(sync,/\.eq\("source_clash_tag",normalizeTag\(expectedTag\)\)/);
 assert.match(sync,/\.from\("cwl_clan_cw_missed_decisions"\)/);
 assert.match(sync,/\.eq\("clan_id",expectedClan\)/);
 assert.match(sync,/\.eq\("war_type","normal"\)\.eq\("source","api"\)\.eq\("finalized",true\)/);
 assert.match(sync,/saveManagementNormalCwDecision/);
 assert.match(sync,/role!=="owner"/);
 assert.match(html,/clanManagementNormalPanel/);
 assert.match(html,/CWLNormalCwUI\?\.render/);
 assert.match(html,/CWLNormalCwUI\?\.clear/);
 assert.match(html,/clan-management-cw-view\.js/);
});
