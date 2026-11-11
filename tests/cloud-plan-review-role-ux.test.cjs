"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

function makeUi(role,locked,pending=[],draft=null){
 const sync=read("cloud-sync.mjs");
 const source=sync.slice(sync.indexOf("function renderMembersReview(){"),sync.indexOf("async function loadPlanReview("));
 const doc=new JSDOM('<section id="planReviewPanel"><details id="planReviewDisclosure"><summary>'+
   '<strong id="planReviewSummaryTitle"></strong><span id="planReviewSummaryDetail"></span>'+
   '<span id="planReviewPendingCount" hidden></span></summary>'+
   '<span id="planReviewStatus"></span><span id="planReviewHint"></span>'+
   '<button id="planReviewToggle"></button><button id="planSubmitSuggestion"></button>'+
   '<div id="planReviewSuggestions"></div></details></section>'+
   '<div id="membersReviewContext"><strong id="membersReviewTitle"></strong>'+
   '<span id="membersReviewHint"></span><button id="membersSubmitSuggestion"></button>'+
   '<button id="membersReviewOpenPlan"></button></div>');
 const ctx={
   $:id=>doc.window.document.getElementById(id),
   document:doc.window.document,cloud:{active:true},clanId:"clan",role,
   planReview:{season:"2026-11",cycle_id:"one",locked},planSuggestions:pending,
   planReviewPeople:new Map([["vize","Test-Vize"]]),user:{id:"owner"},
   changedSerial:draft,planIsLocked:()=>locked,currentSeason:()=> "2026-11",
   isConfirmedReviewPause:()=>false,
   storage:{getPlanningState:()=>({ok:true})},
   suggestionChanges:()=>["Testspieler · Einsatzziel: 3 → 4"],
   JSON,Date,
 };
 const run=vm.runInNewContext(source+";renderPlanReview",ctx);
 run();
 return {doc,ctx,run};
}
test("owner gets subtle approval disclosure, highlighted pending count and proposal actions",()=>{
 const suggested_profile={members:[{id:"one",name:"Testspieler",targetDays:4}]};
 const p=[{id:"p1",cycle_id:"one",author_id:"vize",status:"pending",base_revision:1,
   submitted_at:"2026-11-06T12:00:00Z",suggested_profile}];
 const {doc,run}=makeUi("owner",true,p);
 const q=id=>doc.window.document.getElementById(id);
 assert.equal(q("planReviewPanel").hidden,false);
 assert.equal(q("planReviewDisclosure").open,false,"no automatic expansion of heavy review details");
 assert.equal(q("planReviewSummaryTitle").textContent,"Plan freigegeben");
 assert.match(q("planReviewPendingCount").textContent,/1 Vorschlag offen/);
 assert.match(q("planReviewSuggestions").textContent,/Vorschlag von Test-Vize/);
 assert.equal(q("planReviewPanel").classList.contains("has-pending"),true);
 assert.equal(q("membersReviewOpenPlan").hidden,false);
 assert.match(q("membersReviewOpenPlan").textContent,/1 offene Vorschläge prüfen/);
 q("planReviewDisclosure").open=true;
 const first=q("planReviewSuggestions").firstElementChild;
 run();
 assert.equal(q("planReviewSuggestions").firstElementChild,first,"polling preserves focus and list nodes");
 assert.equal(q("planReviewDisclosure").open,true);
});
test("locked editor sees draft action in Members, open editor can edit directly",()=>{
 const locked=makeUi("editor",true,[],JSON.stringify({members:[]}));
 const el=id=>locked.doc.window.document.getElementById(id);
 assert.equal(el("planSubmitSuggestion").hidden,false);
 assert.equal(el("planSubmitSuggestion").disabled,false);
 assert.equal(el("membersSubmitSuggestion").hidden,false);
 assert.equal(el("membersSubmitSuggestion").disabled,false);
 assert.match(el("membersReviewHint").textContent,/noch nicht eingereicht/);
 const open=makeUi("editor",false,[],null);
 assert.equal(open.doc.window.document.getElementById("membersSubmitSuggestion").hidden,true);
 assert.match(open.doc.window.document.getElementById("membersReviewHint").textContent,/direkt/);
});
test("observer sees clear read-only context and no proposal controls",()=>{
 const {doc}=makeUi("viewer",true,[{id:"p1",status:"pending"}]);
 const el=id=>doc.window.document.getElementById(id);
 assert.equal(el("planReviewPanel").hidden,true);
 assert.equal(el("membersReviewContext").hidden,false);
 assert.match(el("membersReviewTitle").textContent,/Lesemodus/);
 assert.equal(el("membersSubmitSuggestion").hidden,true);
 assert.equal(el("membersReviewOpenPlan").hidden,true);
});
test("member roster remains visible but edit controls are hidden, with read-only filters enabled",()=>{
 const html=read("cloud-app.html"),sync=read("cloud-sync.mjs");
 assert.match(html,/\.cloud-role-viewer #view-members \.member-tools,/);
 assert.match(html,/\.cloud-role-viewer #view-members \.member-order,/);
 assert.match(html,/member-readonly-summary/);
 assert.match(html,/window\.CWLCloud\?\.isViewer\?\.\(\)\?"Details ▾"/);
 assert.match(sync,/memberReadOnlyControl=el\.closest\("#view-members"\)/);
 assert.match(sync,/#memberSearch,#memberFilter,#memberSortSelect,\.member-edit-toggle/);
 assert.match(sync,/bind\("membersSubmitSuggestion","click",submitPlanSuggestion\)/);
 assert.match(sync,/cwl_resolve_plan_suggestion/);
 assert.match(sync,/role==="viewer" && !keep\.has\(el\.id\)/);
});
