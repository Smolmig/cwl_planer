"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("cloud-app.html");

test("More, account and separate Clash-group and planner archives explain their real scope",()=>{
 assert.match(html,/<h2 id="moreTitle">Mehr<\/h2>/);
 assert.match(html,/Gruppenergebnisse aus Clash/);
 assert.match(html,/Archivierte CWL-Pläne/);
 assert.match(html,/Die App-Rolle bestimmt deine Rechte/);
 assert.match(html,/Das ändert keine Clash-Ränge/);
 assert.match(html,/Nur der Besitzer kann einen alten Planstand wiederherstellen/);
 assert.match(html,/Kriegsstatistiken, Benutzerkonten und Zugriffsrechte sind nicht enthalten/);
 assert.match(html,/Gemeinsamen Stand prüfen/);
 assert.match(html,/Vom Cloud-Konto abmelden/);
 assert.match(html,/Mehr: Clan &amp; Konto, Archiv und Sicherungen/);
 assert.match(html,/Neu in v1\.16\.71/);
 assert.equal(JSON.parse(read("cloud-version.json")).version,"v1.16.71");
 assert.match(read("cloud-release-history.mjs"),/"version": "v1\.16\.71"/);
 assert.match(read("cwl-group-archive.mjs"),/Noch keine Gruppenergebnisse archiviert/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
});

test("viewer sees read-only hint in moved CWL rules; backups remain a separate destination",()=>{
 const dom=new JSDOM('<main><section id="view-settings"><div id="home">'+
   '<section id="settingsRulesSection"><select id="slotsPreset"><option value="15">15</option></select></section>'+
   '<section id="settingsAutoRosterBox"><button id="settingsRosterRefresh">Prüfen</button></section>'+
   '<section id="settingsAppearanceSection"></section>'+
   '<section id="settingsBackupSection"><button id="exportAllBtn">Export</button></section>'+
   '<section id="localProfileCard"></section></div></section>'+
   '<section id="view-more-settings"><h2 id="moreSettingsTitle"></h2>'+
   '<p id="moreSettingsDescription"></p><p id="moreSettingsNotice" hidden></p>'+
   '<button id="moreSettingsCloudBackup" hidden>Cloud-Sicherungen</button>'+
   '<div id="moreSettingsContent"></div></section></main>',{url:"https://example.test"});
 try{
  const start=html.indexOf("const moreSettingsMeta=");
  const end=html.indexOf("function showPlannerView(view){",start);
  assert.ok(start>0&&end>start);
  const nav=new Function("document","window","showPlannerView",
    html.slice(start,end)+"\nreturn {openMoreSettings,restoreMoreSettings};")(
    dom.window.document,dom.window,()=>{});
  const d=dom.window.document,note=d.getElementById("moreSettingsNotice");
  dom.window.CWLCloud={active:true,isViewer:()=>true};
  nav.openMoreSettings("rules");
  assert.equal(note.hidden,false);
  assert.match(note.textContent,/Als Beobachter.*nicht bearbeiten/);
  assert.equal(d.getElementById("moreSettingsCloudBackup").hidden,true);
  assert.equal(d.getElementById("moreSettingsContent").children.length,2);
  nav.openMoreSettings("backup");
  assert.equal(note.hidden,false);
  assert.match(note.textContent,/Cloud-Sicherungen|Plan-Sicherungen/);
  assert.equal(d.getElementById("moreSettingsCloudBackup").hidden,false);
  dom.window.CWLCloud.isViewer=()=>false;
  nav.openMoreSettings("rules");
  assert.equal(note.hidden,true,"Owner/Vize do not get misleading viewer note");
  assert.equal(d.getElementById("moreSettingsCloudBackup").hidden,true);
  nav.restoreMoreSettings();
  assert.equal(d.querySelectorAll("#slotsPreset").length,1);
  assert.equal(d.getElementById("home").querySelectorAll("#settingsRulesSection").length,1);
  dom.window.CWLCloud.active=false;
  nav.openMoreSettings("backup");
  assert.equal(note.hidden,true,"Local guest has no Cloud notice");
 }finally{dom.window.close()}
});

test("plan archive exposes view but not deletion to Cloud observers",()=>{
 const dom=new JSDOM('<div id="archiveCountBadge"></div><div id="archiveList"></div>',{url:"https://example.test"});
 try{
  const start=html.indexOf("function renderArchives(){"),end=html.indexOf("function openArchiveModal(id)",start);
  assert.ok(start>0&&end>start);
  const state={archives:[{id:"s1",label:"Oktober 2026",createdAt:1,playedCount:6,days:7,slots:15,complete:false}]};
  const render=new Function("document","window","state","esc","confirmInline","renderAll","openArchiveModal",
    html.slice(start,end)+"\nreturn renderArchives;")(
    dom.window.document,dom.window,state,x=>String(x),
    async()=>false,()=>{},()=>{});
  const d=dom.window.document;
  dom.window.CWLCloud={active:true,isViewer:()=>true};
  render();
  assert.equal(d.getElementById("archiveCountBadge").textContent,"1 Plan");
  assert.equal(d.querySelectorAll(".view-archive").length,1);
  assert.equal(d.querySelectorAll(".delete-archive").length,0);
  assert.match(d.getElementById("archiveList").textContent,/6\/7 gespielt/);
  dom.window.CWLCloud.isViewer=()=>false;render();
  assert.equal(d.querySelectorAll(".delete-archive").length,1);
  state.archives.push({...state.archives[0],id:"s2",createdAt:2});
  render();
  assert.equal(d.getElementById("archiveCountBadge").textContent,"2 Pläne");
  state.archives=[];render();
  assert.match(d.getElementById("archiveList").textContent,/Noch keine CWL-Pläne archiviert/);
  assert.equal(d.getElementById("archiveCountBadge").textContent,"0 Pläne");
 }finally{dom.window.close()}
});

test("More, CWL archive and Cloud account remain readable at phone and desktop widths",{timeout:120000},async()=>{
 const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:860}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    for(const view of ["view-more","view-archive","view-account"]){
     const result=await page.evaluate(name=>{
      document.documentElement.dataset.theme="arena";
      document.querySelectorAll(".view.active").forEach(v=>v.classList.remove("active"));
      document.getElementById(name).classList.add("active");
      if(name==="view-account")document.getElementById("cloudAccount").hidden=false;
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
       heading:document.getElementById(name).querySelector("h2")?.textContent,
       role:document.getElementById("cloudRoleExplanation")?.textContent};
     },view);
     assert.ok(result.scroll<=width+3,JSON.stringify({width,view,result}));
     assert.ok(result.heading?.length>1,JSON.stringify({width,view,result}));
     if(view==="view-account")assert.match(result.role,/Beobachter/);
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
