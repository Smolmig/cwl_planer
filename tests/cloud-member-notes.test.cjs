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
 assert.match(sync,/cloud\.hasApiClan\(\)&&member\?\.playerTag&&Number\.isInteger\(member\.cocOrder\)/);
});
test("offline index remains separate, and cloud note does not require a new SQL table",()=>{
 const offline=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(offline,/const APP_VERSION="v1\.0\.2"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(html,/function exportActiveProfile\(\)/);
 assert.match(html,/JSON\.stringify\(\{kind:"cwl-profile"/);
});
