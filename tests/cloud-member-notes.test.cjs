"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const normalizeSource=html.slice(html.indexOf("function normalizeMember("),html.indexOf("function normalizeArchive("));
const norm=vm.runInNewContext(normalizeSource+"\nnormalizeMember",{
  uid:()=> "new-id",freshMember:()=>({}),
  normalizePlayerTag:v=>String(v||"").trim().toUpperCase(),
  STRENGTH_LABELS:{unknown:"unknown"}
});
const escSource=html.slice(html.indexOf("function esc("),html.indexOf("function emptyDayGoal("));
const esc=vm.runInNewContext(escSource+"\nesc",{});
const sample=(note)=>({id:"m",name:"Test",playerTag:"#2PYL",participating:true,fixed:false,
  priority:0,threeStar:"unknown",statuses:Array(7).fill("auto"),note});
test("notes are optional and survive normalization, JSON backups and replay",()=>{
 const plain=norm(sample("Eine kleine Notiz"));
 assert.equal(plain.note,"Eine kleine Notiz");
 const restored=norm(JSON.parse(JSON.stringify(plain)));
 assert.equal(restored.note,"Eine kleine Notiz");
 assert.equal(norm(sample(undefined)).note,"");
 assert.equal(norm(sample("x".repeat(250))).note.length,200);
 assert.equal(norm(sample("")).note,"");
});
test("visible note text is escaped rather than injected as executable HTML",()=>{
 const payload='<img src=x onerror="alert(1)"> & \' quote';
 const n=norm(sample(payload));
 assert.equal(n.note,payload);
 const escaped=esc(n.note);
 assert.ok(escaped.includes("&lt;img"));
 assert.ok(escaped.includes("&quot;"));
 assert.ok(escaped.includes("&#39;"));
 assert.ok(!escaped.includes("<img"));
 assert.match(html,/member-note-preview/);
 assert.match(html,/\$\{esc\(m\.note\)\}/);
 assert.doesNotMatch(html,/\$\{m\.note\}<\/div>/);
});
test("member notes are visible in collapsed cards and edited with a bounded input",()=>{
 assert.match(html,/class="member-note-btn/);
 assert.match(html,/editMemberNote\(m\)/);
 assert.match(html,/promptInline\("Spielernotiz",m\.name\+" · bis 200 Zeichen",m\.note\|\|"",200\)/);
 assert.match(html,/input\.maxLength=maxLength==null\?524288:maxLength/);
 assert.match(html,/renderAll\(next\?"Notiz gespeichert/);
 assert.match(html,/m\.note=next/);
});
test("viewer can see notes but cannot edit via normal cloud controls",()=>{
 assert.match(html,/window\.CWLCloud\?\.active&&document\.body\.classList\.contains\("cloud-role-viewer"\)/);
 assert.match(sync,/document\.body\.classList\.toggle\("cloud-role-viewer"/);
 assert.match(sync,/#view-members button/);
 assert.match(sync,/role==="viewer"/);
});
test("API-linked clan names are read-only while local manual and unlinked profiles retain edits",()=>{
 assert.match(sync,/hasApiClan:\(\)=>!!clans\.find/);
 assert.match(html,/const apiManaged=!!\(window\.CWLCloud\?\.active&&window\.CWLCloud\?\.hasApiClan\?\.\(\)/);
 assert.match(html,/\$\{apiManaged\?"":\x60<button type="button" class="member-name-edit"/);
 assert.match(sync,/cloud\.hasApiClan\?\.\(\)&&!cloud\.isEmergencyEditing\?\.\(\)&&member\?\.playerTag&&Number\.isInteger\(member\.cocOrder\)/);
});
test("offline index remains separate, and cloud note does not require a new SQL table",()=>{
 const offline=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(offline,/const APP_VERSION="v1\.0\.2"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(html,/function exportActiveProfile\(\)/);
 assert.match(html,/JSON\.stringify\(\{kind:"cwl-profile"/);
});


test("linked API name editors are inert but an unlinked profile can edit",()=>{
 const {JSDOM}=require("jsdom");
 const begin=sync.indexOf("function installNameEditors(){");
 const end=sync.indexOf("function status(",begin);
 assert.ok(begin>0&&end>begin);
 const dom=new JSDOM('<div id="memberList"><div class="member" data-id="m"><div class="name-wrap"><span class="member-name-label">Test</span><input class="member-name" readonly hidden value="Test"><button class="member-name-edit">Edit</button></div></div></div>');
 try{
  let linked=true;
  const cloud={active:true,hasApiClan:()=>linked};
  const make=new dom.window.Function("$","cloud","role","storage",sync.slice(begin,end)+";return installNameEditors");
  const editor=make(id=>dom.window.document.getElementById(id),cloud,"owner",
    {getProfile:()=>({members:[{id:"m",name:"Test",playerTag:"#2PYL",cocOrder:0}]})});
  editor();
  const input=dom.window.document.querySelector(".member-name");
  dom.window.document.querySelector(".member-name-edit").click();
  assert.equal(input.readOnly,true);
  assert.equal(input.hidden,true);
  linked=false;
  dom.window.document.querySelector(".member-name-edit").click();
  assert.equal(input.readOnly,false);
  assert.equal(input.hidden,false);
 }finally{dom.window.close()}
});
test("note editor rejects viewer changes and supports clearing notes",async()=>{
 const begin=html.indexOf("async function editMemberNote(");
 const end=html.indexOf("function renderMembers(){",begin);
 assert.ok(begin>0&&end>begin);
 const source=html.slice(begin,end)+"\neditMemberNote";
 const m={name:"Test",note:"Vorher"};
 let prompts=0,renders=0,viewer=true;
 const context={
  window:{CWLCloud:{active:true}},
  document:{body:{classList:{contains:()=>viewer}}},
  promptInline:async()=>{prompts++;return "";},
  renderAll:()=>{renders++}
 };
 const edit=vm.runInNewContext(source,context);
 await edit(m);
 assert.equal(prompts,0);
 assert.equal(m.note,"Vorher");
 viewer=false;
 await edit(m);
 assert.equal(prompts,1);
 assert.equal(m.note,"");
 assert.equal(renders,1);
});
