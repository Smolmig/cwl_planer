"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const sync=read("cloud-sync.mjs"),html=read("cloud-app.html");
const start=sync.indexOf("function isConfirmedReviewPause(){");
const end=sync.indexOf("async function loadPlanReview(",start);
assert.ok(start>=0&&end>start,"review lifecycle and rendering should be defined");
const source=sync.slice(start,end);

function setup(role="owner"){
 const dom=new JSDOM(`<section id="view-plan">
 <section id="planReviewPanel"><details id="planReviewDisclosure"><summary>
 <strong id="planReviewSummaryTitle"></strong><small id="planReviewSummaryDetail"></small>
 <span id="planReviewPendingCount"></span></summary>
 <span id="planReviewStatus"></span><span id="planReviewHint"></span>
 <button id="planReviewToggle"></button><button id="planSubmitSuggestion"></button>
 <button id="planRefreshSuggestions"></button><div id="planReviewSuggestions"></div>
 </details></section><div id="mobileDaySwitcher"></div></section>
 <section id="view-members"><div id="membersReviewContext">
 <strong id="membersReviewTitle"></strong><span id="membersReviewHint"></span>
 <button id="membersSubmitSuggestion"></button>
 <button id="membersReviewOpenPlan" aria-expanded="false"></button></div>
 <section id="membersReviewManageHost" hidden></section></section>`);
 const $=id=>dom.window.document.getElementById(id);
 const context={
  $,document:dom.window.document,cloud:{active:true},clanId:"clan-one",
  clans:[{id:"clan-one",clash_tag:"#CWL"}],role,
  planReview:{season:"2026-11",cycle_id:"cycle-one",locked:false},
  planSuggestions:[],planReviewPeople:new Map(),user:{id:"owner"},changedSerial:null,
  currentSeason:()=>"2026-11",planIsLocked:()=>false,
  storage:{getPlanningState:()=>({ok:true})},
  suggestionChanges:()=>[],JSON,Date,
  restorePlanReviewToPlan:()=>{}
 };
 const render=vm.runInNewContext(source+";renderPlanReview",context);
 return {dom,context,render,$,plan:$("view-plan")};
}
test("verified off-season hides old approval and new preparation reveals it again",()=>{
 const ui=setup();
 ui.render();assert.equal(ui.$("membersReviewOpenPlan").hidden,false);
 assert.equal(ui.$("planReviewToggle").hidden,false);
 for(const flag of ["plan-postseason-mode","plan-between-cwl-mode"]){
  ui.plan.classList.add(flag);ui.render();
  assert.equal(ui.$("planReviewPanel").hidden,true,flag);
  assert.equal(ui.$("membersReviewOpenPlan").hidden,true,flag);
  assert.equal(ui.$("membersSubmitSuggestion").hidden,true,flag);
  assert.match(ui.$("membersReviewTitle").textContent,/Derzeit keine CWL-Planung/);
  assert.match(ui.$("membersReviewHint").textContent,/nächsten CWL-Vorbereitung/);
  ui.plan.classList.remove(flag);ui.render();
  assert.equal(ui.$("planReviewPanel").hidden,false);
  assert.equal(ui.$("membersReviewOpenPlan").hidden,false);
 }
 ui.dom.window.close();
});
test("stale classes do not suppress a different clan or manual/guest mode",()=>{
 const ui=setup();ui.plan.classList.add("plan-between-cwl-mode");
 ui.context.clanId="clan-two";ui.render();
 assert.equal(ui.$("planReviewPanel").hidden,false);
 ui.context.clanId="clan-one";ui.context.clans=[{id:"clan-one",clash_tag:""}];ui.render();
 assert.equal(ui.$("planReviewPanel").hidden,false);
 ui.context.cloud.active=false;ui.render();
 assert.equal(ui.$("membersReviewContext").hidden,true);
 ui.dom.window.close();
});
test("viewer and editor see the quiet off-season status with no proposal action",()=>{
 for(const role of ["viewer","editor"]){
  const ui=setup(role);ui.plan.classList.add("plan-postseason-mode");ui.render();
  assert.equal(ui.$("membersReviewContext").hidden,false);
  assert.match(ui.$("membersReviewTitle").textContent,/Derzeit keine CWL-Planung/);
  assert.equal(ui.$("membersSubmitSuggestion").hidden,true);
  assert.equal(ui.$("membersReviewOpenPlan").hidden,true);
  ui.dom.window.close();
 }
});
test("approval RPC entry points and latest Help are guarded without mutating archives",()=>{
 assert.match(sync,/function assertReviewSeasonAvailable\(\)/);
 assert.match(sync,/async function togglePlanLock\(\)[\s\S]*?assertReviewSeasonAvailable\(\)/);
 assert.match(sync,/async function submitPlanSuggestion\(\)[\s\S]*?assertReviewSeasonAvailable\(\)/);
 assert.match(sync,/async function decidePlanSuggestion\(id,action\)[\s\S]*?assertReviewSeasonAvailable\(\)/);
 assert.match(sync,/queueMicrotask\(\(\)=>\{if\(cloud\.active\)renderPlanReview\(\)\}\)/);
 assert.match(html,/Planfreigabe zwischen den CWLs/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
});
