"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const core=require("../clan-management-core.js");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const start=html.indexOf('let clanManagementFilter="open";');
const end=html.indexOf("const clanRuleFields={",start);
assert.ok(start>0&&end>start,"isolated management view is present");
const source=html.slice(start,end);
const now=Date.now();
const ownerRules=core.normalizeRules({});
const members=[
 {tag:"#2PYL",name:"Lina",role:"member"},
 {tag:"#2PYQ",name:"Max",role:"member"},
 {tag:"#2PYR",name:"Tina",role:"elder"},
 {tag:"#2PYJ",name:"Vize",role:"coLeader"}
];
const tenure=[{player_tag:"#2PYL",is_present:true,confirmed_seconds:30*86400,
 observed_visits:1,last_observed_at:new Date(now-60000).toISOString()}];
const evidence=[{player_tag:"#2PYL",attack_count:14,three_star_count:13,relevant_wars:7}];
function freshPreview(){
 return core.buildPreview(members,tenure,evidence,ownerRules);
}
function fixture(preview,readable=true){
 const dom=new JSDOM('<!doctype html><html><body>'+
  '<div id="clanManagementFilters"><button id="clanManagementFilterOpen" data-management-filter="open"></button>'+
  '<span id="clanManagementOpenCount"></span><button id="clanManagementFilterAll" data-management-filter="all"></button></div>'+
  '<div id="clanManagementList" role="list"></div></body></html>',
  {url:"https://example.test/"});
 const d=dom.window.document,renderAction=(group,person,item)=>{
  const action=d.createElement("button");action.textContent=item.label;group.appendChild(action);
 };
 const api=new Function("document","window","clanManagementLastPreview",
   "clanManagementReviewsReadable","renderClanManagementReviewAction",
   source+"\nreturn {renderClanManagementRows,managementRowSummary,managementOpenCases,"+
   "setFilter: v=>{clanManagementFilter=v},expanded:clanManagementExpandedTags};")(
     d,dom.window,preview,readable,renderAction);
 return {d,dom,api,close:()=>dom.window.close()};
}
test("owner sees actionable promotions first, with clear summary and no fake kick",()=>{
 const p=core.applyReviewDecisions(freshPreview(),[]);
 const f=fixture(p);
 try{
  f.api.renderClanManagementRows(false);
  const rows=[...f.d.querySelectorAll(".clan-management-person")];
  assert.equal(rows.length,1);
  assert.equal(rows[0].dataset.playerTag,"#2PYL");
  assert.equal(rows[0].querySelector(".clan-management-person-status").textContent,"Beförderung prüfen");
  assert.match(rows[0].textContent,/30\/14 Clantage/);
  assert.match(rows[0].textContent,/14\/10 Angriffe/);
  assert.equal(f.d.getElementById("clanManagementOpenCount").textContent,"1");
  assert.equal(rows[0].querySelector("summary span").textContent,"Details anzeigen");
  assert.equal(rows[0].querySelectorAll(".clan-management-review-actions button").length,1);
  assert.equal(rows[0].querySelectorAll(".clan-management-person-head button").length,0);
  assert.doesNotMatch(rows[0].textContent,/Kick empfohlen|Degradieren/);
 }finally{f.close()}
});
test("all-player view distinguishes not enough evidence from no active recommendation",()=>{
 const f=fixture(core.applyReviewDecisions(freshPreview(),[]));
 try{
  f.api.setFilter("all");f.api.renderClanManagementRows(false);
  const rows=[...f.d.querySelectorAll(".clan-management-person")];
  assert.equal(rows.length,3,"co-leaders must not enter the recommendation list");
  assert.equal(rows[0].dataset.playerTag,"#2PYL");
  const max=rows.find(x=>x.dataset.playerTag==="#2PYQ");
  const elder=rows.find(x=>x.dataset.playerTag==="#2PYR");
  assert.equal(max.querySelector(".clan-management-person-status").textContent,"Nachweise offen");
  assert.equal(elder.querySelector(".clan-management-person-status").textContent,"Keine Empfehlung");
  assert.match(elder.textContent,/Clash: Ältester/);
  assert.equal(f.d.getElementById("clanManagementFilterAll").getAttribute("aria-pressed"),"true");
  assert.equal(f.d.getElementById("clanManagementFilterOpen").getAttribute("aria-pressed"),"false");
 }finally{f.close()}
});
test("acknowledged and excepted cases disappear from action filter but stay inspectable",()=>{
 for(const disposition of ["acknowledged","exception"]){
  const p=freshPreview();
  const item=p.rows.find(x=>x.tag==="#2PYL").reviewCases[0];
  core.applyReviewDecisions(p,[{player_tag:"#2PYL",review_kind:item.kind,
   disposition,evidence_fingerprint:item.fingerprint,revision:4}]);
  const f=fixture(p);
  try{
   f.api.renderClanManagementRows(false);
   assert.equal(f.d.querySelectorAll(".clan-management-person").length,0);
   assert.match(f.d.getElementById("clanManagementList").textContent,/Keine offenen Vorschläge/);
   f.api.setFilter("all");f.api.renderClanManagementRows(false);
   const member=[...f.d.querySelectorAll(".clan-management-person")].find(x=>x.dataset.playerTag==="#2PYL");
   assert.equal(member.querySelector(".clan-management-person-status").textContent,
    disposition==="exception"?"Ausgeblendet":"Bereits geprüft");
   assert.ok(member.querySelector("details"));
  }finally{f.close()}
 }
});
test("details state and safe text survive same-clan refresh without writing a plan",()=>{
 const p=core.applyReviewDecisions(freshPreview(),[]);
 const f=fixture(p);
 try{
  f.api.setFilter("all");f.api.renderClanManagementRows(false);
  f.api.expanded.add("#2PYL");
  f.api.renderClanManagementRows(false);
  const details=[...f.d.querySelectorAll(".clan-management-person")].find(
   x=>x.dataset.playerTag==="#2PYL").querySelector("details");
  assert.equal(details.open,true);
  assert.equal(details.querySelector("summary span").textContent,"Details schließen");
  assert.match(details.textContent,/Clanzeit|Angriffsleistung/);
  assert.match(html,/clanManagementExpandedTags\.clear\(\);clanManagementFilter="open"/,
   "switching tenant resets only UI state");
  assert.doesNotMatch(source,/ensureSaved|storage\.switchToCloud|writeCloud\(/);
 }finally{f.close()}
});
test("unavailable review decisions never enable write controls and do not conceal verified checks",()=>{
 const p=freshPreview(),f=fixture(p,false);
 try{
  f.api.renderClanManagementRows(false);
  assert.equal(f.d.querySelectorAll(".clan-management-person").length,1);
  assert.match(f.d.getElementById("clanManagementList").textContent,/nicht abrufbar/);
  assert.equal(f.d.querySelectorAll(".clan-management-review-actions button").length,0);
 }finally{f.close()}
});
