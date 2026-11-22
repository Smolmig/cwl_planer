"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("cloud-app.html"),sync=read("cloud-sync.mjs");
const SOURCE="11111111-1111-4111-8111-111111111111";
const TARGET="88888888-8888-4888-8888-888888888888";
const OTHER="99999999-9999-4999-8999-999999999999";
const OWNER="33333333-3333-4333-8333-333333333333";
const RECEIPT="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CREATED="2026-11-22T12:35:00Z";
const FINGERPRINT="a".repeat(64);
function domSetup(){
 const page=new JSDOM(app,{url:"https://example.test/cloud-app.html",
  runScripts:"outside-only"});
 const before={document:global.document,Option:global.Option};
 global.document=page.window.document;
 global.Option=page.window.Option;
 return {page,restore:()=>{
  global.document=before.document;global.Option=before.Option;page.window.close();
 }};
}
async function createFixture(){
 const core=await import("../cloud-portable-backup-core.mjs");
 const spec=core.PORTABLE_CLOUD_TABLES.find(x=>x.name==="cwl_cloud_profiles");
 const profile=(id,revision)=>Object.assign(
  Object.fromEntries(spec.columns.map(k=>[k,null])),
  {clan_id:id,revision,data_version:9,profile_json:{
    name:"United Fighters",members:[],archives:[],
    archivedMembers:[],locks:[],cwlLive:{rounds:[],warCount:0}
  }}
 );
 const tables=Object.fromEntries(core.PORTABLE_CLOUD_TABLES.map(s=>[s.name,[]]));
 const source={source_clan_id:SOURCE,name:"United Fighters",
  clash_tag:"#P8Y2",tables:{...tables,cwl_cloud_profiles:[profile(SOURCE,4)]}};
 const file=await core.createPortableCloudBackup({
  clans:[source],createdAt:CREATED,consistency:"server-stable-statement",
  serverReceipt:{
   id:RECEIPT,owner_user_id:OWNER,
   snapshot_at:CREATED,payload_sha256:"f".repeat(64)
  }
 });
 return {core,file,tables,profile};
}
function mockUI(f,options={}){
 const calls=[],messages=[],loads=[];
 let role=options.role||"owner",active=options.active??true;
 let current=options.current||SOURCE,epoch=0,allow=true;
 const context=()=>({
  active,role,clanId:current,epoch,
  userId:OWNER,revision:4,clans:[
   {id:SOURCE,name:"United Fighters",clash_tag:"#P8Y2"},
   {id:TARGET,name:"Fresh replacement",clash_tag:"#P8Y2"},
   {id:OTHER,name:"Other Clash clan",clash_tag:"#QL8P"}],
  ownerClanIds:options.noOwner?[]:[SOURCE,TARGET,OTHER]
 });
 const sb={
  auth:{getUser:async()=>({data:{user:{id:OWNER}},error:null})},
  rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==="cwl_export_owned_backup"){
    return {error:null,data:{
     kind:"cwl-cloud-app-backup",format_version:1,
     consistency:"server-stable-statement",created_at:CREATED,
     clans:[{
      source_clan_id:TARGET,name:"Fresh replacement",
      clash_tag:"#P8Y2",
      tables:{...f.tables,cwl_cloud_profiles:[f.profile(TARGET,1)]}
     }]
    }};
   }
   if(name==="cwl_verify_owned_backup_witness"){
    return {error:null,data:{verified:true,scope:"server-origin-17-table-snapshot",
     receipt_id:RECEIPT,payload_sha256:"f".repeat(64),
     source_clan_count:1,target_clan_ids:[TARGET]}};
   }
   if(name==="cwl_restore_witnessed_pristine_clan"){
    return {error:null,data:{
     scope:"verified-pristine-new-clan-17-datasets",
     source_clan_id:SOURCE,target_clan_id:TARGET,
     restored_table_count:17,public_full_restore_available:false,
     mutation_permitted:false,source_rows:1,source_locked_days:0,
     source_archive_rows:0,expected_revision:1,
     target_fingerprint:FINGERPRINT,applied:!!args.p_apply,
     ...(args.p_apply?{checkpoint_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
       applied_revision:2}:{})
    }};
   }
   throw Error("Unexpected RPC "+name);
  }
 };
 let confirmation=options.confirmation??false,typed=options.typed??"";
 const obj={sb,context,ensureSaved:async()=>{},loadProfile:async()=>loads.push(1),
  toast:msg=>messages.push(msg),
  confirmAction:async()=>confirmation,
  askAction:async()=>({value:"confirm",input:typed})};
 const update={setConfirmation:x=>confirmation=x,setTyped:x=>typed=x,
  switchClan:id=>current=id,revoke:()=>{role="viewer";epoch++},
  get calls(){return calls},get messages(){return messages}};
 return {obj,update};
}
test("new Cloud owner file view has exactly two primary actions under Mehr, bilingual help, no unsafe client keys",()=>{
 assert.match(app,/id="cloudPortableDownload"/);
 assert.match(app,/id="cloudPortableRestore"/);
 assert.match(app,/id="cloudPortableFile"/);
 assert.match(app,/id="cloudPortableTargets"/);
 assert.match(app,/id="cloudPortablePreviewResult"/);
 assert.match(app,/id="cloudPortableHelp"/);
 assert.match(app,/<p lang="en">/);
 assert.match(app,/id="localBackupActions"/);
 assert.match(app,/\.cloud-mode #localBackupActions/);
 assert.match(app,/if\(isCloud&&action==="backup"\)window\.CWLPortableBackupUI\?\.render\?\.\(\)/);
 assert.match(sync,/createCloudPortableBackupUI/);
 assert.match(sync,/window\.CWLPortableBackupUI\?\.reset\?\.\(\)/);
 assert.match(sync,/ownerClanIds:clans\.filter\(c=>clanRoles\.get\(c\.id\)==="owner"\)/);
 assert.doesNotMatch(read("cloud-portable-backup-ui.mjs"),/service_role|localStorage|sessionStorage/);
});
test("source-to-replacement mapping enforces owner, exact Clash tag, distinct targets and never overwrites original UUID",async()=>{
 const f=await createFixture();
 const m=await import("../cloud-portable-backup-ui.mjs");
 assert.equal(m.portableBackupText().download,"Backup herunterladen");
 assert.equal(m.portableBackupText("en").download,"Download backup");
 assert.equal(m.portableFileSummary(f.file).groups[0].rows,1);
 const own=[
  {id:SOURCE,clash_tag:"#P8Y2"},
  {id:TARGET,clash_tag:"#P8Y2"},
  {id:OTHER,clash_tag:"#QL8P"}];
 assert.deepEqual({...m.portableRestoreMapping(f.file,{[SOURCE]:TARGET},own)},{[SOURCE]:TARGET});
 for(const wrong of [SOURCE,OTHER,"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",""]){
  assert.throws(()=>m.portableRestoreMapping(f.file,{[SOURCE]:wrong},own));
 }
 assert.throws(()=>m.portableRestoreMapping(f.file,{[SOURCE]:TARGET},[]));
});
test("viewers have no main Cloud file actions; no network and DE/EN choice stays in the same page",async()=>{
 const {restore}=domSetup();
 try{
  const f=await createFixture(),m=await import("../cloud-portable-backup-ui.mjs");
  const {obj,update}=mockUI(f,{noOwner:true,role:"viewer"});
  const ui=m.createCloudPortableBackupUI(obj);ui.init();
  assert.equal(document.getElementById("cloudPortableDownload").disabled,true);
  assert.equal(document.getElementById("cloudPortableRestore").disabled,true);
  assert.equal(document.getElementById("cloudPortableStatus").dataset.state,"error");
  document.getElementById("cloudPortableLanguage").value="en";
  document.getElementById("cloudPortableLanguage")
   .dispatchEvent(new document.defaultView.Event("change",{bubbles:true}));
  assert.equal(document.getElementById("cloudPortableDownload").textContent,"Download backup");
  assert.equal(update.calls.length,0);
 }finally{restore();}
});
test("file checks, freshly mapped target preview, typed consent and single SQL apply guard",async()=>{
 const {restore}=domSetup();
 try{
  const f=await createFixture(),m=await import("../cloud-portable-backup-ui.mjs");
  const {obj,update}=mockUI(f);
  const ui=m.createCloudPortableBackupUI(obj);ui.init();
  await ui.readFile({size:100,name:"legit-backup.json",text:async()=>JSON.stringify(f.file)});
  assert.equal(ui.inspect().hasFile,true);
  assert.equal(update.calls.length,0,"file parsing must never touch cloud");
  assert.equal(document.getElementById("cloudPortableTargets").querySelectorAll("select").length,1);
  await ui.preview();
  assert.equal(ui.inspect().previewReady,false,"cannot preview without explicit destination");
  assert.equal(update.calls.length,0);
  const select=document.querySelector("#cloudPortableTargets select[data-source-clan-id]");
  select.value=TARGET;ui.targetChanged(select);
  await ui.preview();
  assert.equal(ui.inspect().previewReady,true);
  assert.equal(document.getElementById("cloudPortableApply").hidden,false);
  assert.equal(update.calls.filter(c=>c.name==="cwl_restore_witnessed_pristine_clan"&&c.args.p_apply).length,0);
  await ui.apply();
  assert.equal(ui.inspect().previewReady,true,"cancel does not mutate");
  update.setConfirmation(true);update.setTyped("incorrect");
  await ui.apply();
  assert.equal(update.calls.filter(c=>c.name==="cwl_restore_witnessed_pristine_clan"&&c.args.p_apply).length,0);
  update.setTyped("WIEDERHERSTELLEN");
  await ui.apply();
  const writes=update.calls.filter(c=>c.name==="cwl_restore_witnessed_pristine_clan"&&c.args.p_apply);
  assert.equal(writes.length,1);
  assert.equal(writes[0].args.p_expected_revision,1);
  assert.equal(writes[0].args.p_expected_target_fingerprint,FINGERPRINT);
  assert.equal(writes[0].args.p_confirmation,"RESTORE_ORIGINAL_TO_EMPTY_CLAN");
  assert.equal(ui.inspect().hasFile,false);
  assert.match(document.getElementById("cloudPortableStatus").textContent,/abgeschlossen/);
 }finally{restore();}
});
test("tampered JSON or context switch aborts before any mutating RPC",async()=>{
 const {restore}=domSetup();
 try{
  const f=await createFixture(),m=await import("../cloud-portable-backup-ui.mjs");
  const {obj,update}=mockUI(f);
  const ui=m.createCloudPortableBackupUI(obj);ui.init();
  const bad={...f.file,sha256:"0".repeat(64)};
  await ui.readFile({size:100,name:"fake.json",text:async()=>JSON.stringify(bad)});
  assert.equal(ui.inspect().hasFile,false);
  assert.equal(update.calls.length,0);
  await ui.readFile({size:100,name:"legit.json",text:async()=>JSON.stringify(f.file)});
  const select=document.querySelector("#cloudPortableTargets select");
  select.value=TARGET;ui.targetChanged(select);
  await ui.preview();assert.equal(ui.inspect().previewReady,true);
  update.switchClan(TARGET);
  await ui.apply();
  assert.equal(ui.inspect().previewReady,false);
  assert.equal(update.calls.filter(c=>c.name==="cwl_restore_witnessed_pristine_clan"&&c.args.p_apply).length,0);
 }finally{restore();}
});
test("real responsive Cloud backup wizard stays inside 320px/iPhone and desktop bounds in gold/dark/light themes",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const staticHtml=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,1366]){
    const page=await browser.newPage({viewport:{width,height:850}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     const metrics=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
      document.getElementById("view-more-settings").classList.add("active");
      const root=document.getElementById("cloudPortableBackupSection");
      root.hidden=false;
      document.getElementById("moreSettingsContent").append(
       document.getElementById("settingsBackupSection"));
      document.getElementById("cloudPortableFileInfo").hidden=false;
      document.getElementById("cloudPortableFileInfo").textContent=
       "United Fighters #P8Y2 | 6543 recorded attacks and all CWL archives. ".repeat(5);
      const t=document.getElementById("cloudPortableTargets");
      t.hidden=false;t.innerHTML="<div class='cloud-portable-target-row'><label>United Fighters · Clan-Übersicht</label><select><option>Neuer Zielclan #P8Y2</option></select><p>Alte Daten sind geschützt.</p></div>";
      const buttons=[...root.querySelectorAll(".cloud-portable-main-actions button")]
       .map(x=>x.getBoundingClientRect().height);
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
       buttons,rootWidth:root.getBoundingClientRect().width};
     },theme);
     assert.ok(metrics.scroll<=width+3,JSON.stringify({theme,width,metrics}));
     assert.ok(metrics.rootWidth>190,JSON.stringify({theme,width,metrics}));
     assert.ok(metrics.buttons.every(h=>h>=43),JSON.stringify({theme,width,metrics}));
    }finally{await page.close();}
   }
  }
 }finally{await browser.close();}
});
