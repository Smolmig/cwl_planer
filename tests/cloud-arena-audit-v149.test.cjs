"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261103004500_audit_meaningful_sections.sql"),"utf8");

const begin=sync.indexOf("function describeRemoteEvent(event){");
const end=sync.indexOf("async function showRemoteChangeDetails(){",begin);
assert.ok(begin>=0&&end>begin);
const describe=vm.runInNewContext(sync.slice(begin,end)+"\ndescribeRemoteEvent",{});

test("Arena theme overrides interactive surfaces and visibly enabled clan synchronization",()=>{
  const css=html.slice(html.indexOf("/* Arena, full-system presentation."),html.indexOf("/* Audit trail:"));
  for(const selector of [
    'html[data-theme="arena"] body',
    'html[data-theme="arena"] .modalbox',
    'html[data-theme="arena"] .member',
    'html[data-theme="arena"] .stats-player',
    'html[data-theme="arena"] .btn.primary:not(:disabled)',
    'html[data-theme="arena"] #cloudMembersSyncBtn:not(:disabled)',
    'html[data-theme="arena"] .btn:disabled',
    'html[data-theme="arena"] :is(input,select,textarea)'
  ])assert.ok(css.includes(selector),selector);
  assert.match(css,/color-scheme:dark/);
  assert.match(css,/border-color:#f0d395;color:#221b11;opacity:1/);
});

test("Pencil attaches to intrinsic name label, editing uses a different input",()=>{
  assert.match(html,/class="member-name-label" title="\$\{esc\(m\.name\)\}"/);
  assert.match(html,/class="name-input member-name"[^>]*readonly hidden/);
  assert.match(html,/member-details-footer/);
  const source=sync.slice(sync.indexOf("function installNameEditors(){"),sync.indexOf("function status(",sync.indexOf("function installNameEditors(){")));
  const dom=new JSDOM('<div id="memberList"><div class="member"><div class="name-wrap"><span class="member-name-label">Alpha</span><input class="member-name" value="Alpha" readonly hidden><button class="member-name-edit">✎</button></div></div></div>',{runScripts:"outside-only"});
  try{
    const make=dom.window.Function("$","cloud","role","storage",source+"return installNameEditors");
    make(id=>dom.window.document.getElementById(id),{active:true},"owner",
       {getProfile:()=>({members:[{id:"p1",name:"Alpha"}]})})();
    const input=dom.window.document.querySelector(".member-name");
    const label=dom.window.document.querySelector(".member-name-label");
    dom.window.document.querySelector(".member-name-edit").click();
    assert.equal(input.readOnly,false);
    assert.equal(input.hidden,false);
    assert.equal(label.hidden,true);
    input.blur();
    assert.equal(input.readOnly,true);
    assert.equal(input.hidden,true);
    assert.equal(label.hidden,false);
  }finally{dom.window.close()}
});

test("Player info is placed in the bottom-right member detail footer",()=>{
  const memberMarkup=html.slice(html.indexOf('function renderMembers(){'),html.indexOf('root.querySelectorAll(".member").forEach(',html.indexOf('function renderMembers(){')));
  const helpIndex=memberMarkup.indexOf('class="member-config-help"');
  const footerIndex=memberMarkup.indexOf('class="member-details-footer"');
  const toolsEnd=memberMarkup.indexOf('class="rule-panel');
  assert.ok(helpIndex>footerIndex);
  assert.ok(footerIndex>toolsEnd);
  assert.match(html,/#view-members \.member-details-footer\{[^}]*justify-content:flex-end/);
});

test("Audit renderer describes concrete before and after plus changed CWL days",()=>{
  const result=describe({event_type:"profile_updated",details:{
    spieleraenderungen:[{name:"Alpha",felder:{fixed:[false,true],statuses:[["auto","auto","auto"],["auto","must","auto"]],targetDays:[null,3]}}],
    config_differenzen:{slots:[15,30]},day_goals_geaendert:true,tagesziele_tage:[3],
    plan_geaendert:true,gespielte_tage:[1],bereiche:["members","config","dayGoals","locks","updatedAt"]
  }});
  assert.ok(result.some(x=>x.includes("Alpha · Fix: Nein → Ja")));
  assert.ok(result.some(x=>x.includes("Tag 2: AUTO → MUST")));
  assert.ok(result.some(x=>x.includes("Einsatzziel: – → 3")));
  assert.ok(result.some(x=>x.includes("CWL-Einstellung slots: 15 → 30")));
  assert.ok(result.some(x=>x.includes("Tagesziele verändert (Tag 3)")));
  assert.ok(result.some(x=>x.includes("Gespielte Aufstellung verändert (Tag 1)")));
});

test("Missing old audit differences are not fabricated and technical writes can be hidden",()=>{
  const legacy=describe({event_type:"profile_updated",details:{spieleraenderungen:[]}});
  assert.match(legacy[0],/damals nicht aufgezeichnet/);
  const heartbeat=describe({event_type:"profile_updated",details:{bereiche:["updatedAt"]}});
  assert.match(heartbeat[0],/Nur Speicherzeitpunkt/);
  const syncChange=describe({event_type:"profile_updated",details:{bereiche:["cwlLive","updatedAt"]}});
  assert.match(syncChange.join(" "),/CWL-Kriegs- und Gegnerdaten synchronisiert/);
  assert.match(sync,/cloud-audit-item/);
  assert.match(sync,/item\.append\(details\)/);
});

test("Database audit migration tracks previously unnamed sections and dates",()=>{
  for(const fragment of ["'bereiche',v_sections","'tagesziele_tage',v_goal_days",
    "'gespielte_tage',v_played_days","'archivedMembers'","'cwlLive'","'playerTag'"]){
    assert.ok(migration.includes(fragment),fragment);
  }
});
