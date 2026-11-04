"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
const style=app.match(/<style>([\\s\\S]*?)<\\/style>/)?.[1];
const loadCore=()=>import(pathToFileURL(path.join(root,"cwl-live-core.mjs")).href);
test("Clash swap copy uses one line and preserves only player names, no UI emojis or column gaps",async()=>{
 const {formatClashSwapText}=await loadCore();
 const text=formatClashSwapText(2,{status:"changes",
   toRemove:[{name:"Suminizer"},{name:"Raphtor"}],
   toAdd:[{name:"Luki"},{name:"Tommy"}]});
 assert.equal(text,"Tag 2 - Raus: Suminizer, Raphtor - Rein: Luki, Tommy");
 assert.doesNotMatch(text,/[\\n\\r\\t]|[🔴🟢📋]/u);
 assert.equal(formatClashSwapText(2,{status:"match"}),"Tag 2: Aufstellung passt. Keine Wechsel noetig.");
 assert.equal(formatClashSwapText(3,{status:"unavailable"}),null);
 assert.equal(formatClashSwapText(2,{status:"changes",toAdd:[],toRemove:[]}),null);
 const clean=formatClashSwapText(3,{status:"changes",toRemove:[{name:"  LF\\nKen  "}],toAdd:[{name:"Kai\\tZen"}]});
 assert.equal(clean,"Tag 3 - Raus: LF Ken - Rein: Kai Zen");
 assert.match(live,/formatClashSwapText\\(round\\.day,latest\\)/);
 assert.match(live,/Rein\\/Raus-Text kopieren/);
 assert.doesNotMatch(live,/🔴 Aus Clash raus/);
});
test("Former members keep settings for rejoin but become only deletable archived rows in the UI",()=>{
 assert.match(app,/const former=!!\\(window\\.CWLCloud\\?\\.active&&m\\.cocSyncState==="former"\\)/);
 assert.match(app,/delete-member former-trash/);
 assert.match(app,/member-former \\:is\\(\\.member-part,\\.member-fixed/);
 assert.match(app,/apiManaged\\|\\|former\\?"":/);
 assert.match(app,/m\\.cocSyncState==="former"\\|\\|apiManagedRosterMember/);
 assert.match(app,/if\\(window\\.CWLCloud\\?\\.active&&\\(document\\.body\\.classList\\.contains/);
 assert.match(app,/cocBeforeDeparture/);
 assert.match(app,/el\\.querySelector\\("\\.delete-member"\\)\\?\\.addEventListener/);
});
test("Member note label, viewer read-only styling, individual average stars and clarifying CWL copy exist",()=>{
 assert.match(app,/member-note-caption">Notiz<\\/span>/);
 assert.match(app,/cloud-role-viewer #memberList \\.member\\{/);
 assert.match(app,/Übersicht &amp; Aktionen/);
 assert.match(app,/Diese Ansicht vergleicht die geplanten Teams/);
 assert.match(app,/CWL läuft: Team bereits gestarteter Kriege steht fest/);
 assert.match(stats,/p\\.averageStars\\.toLocaleString\\("de-AT"/);
 assert.match(stats,/stats-rate-avg/);
});
test("Mobile plan always shows participants and fixed players, expanded overview adds secondary KPIs",{
 timeout:90000
},async()=>{
 const {chromium}=require("playwright");
 assert.ok(style);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430]){
   const page=await browser.newPage({viewport:{width,height:800}});
   try{
    await page.setContent('<!doctype html><html lang="de" data-theme="arena"><head>'+
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+style+'</style></head>'+
      '<body class="cloud-mode"><section id="view-plan" class="view active">'+
      '<div class="plan-overview card"><div class="kpis">'+
      '<div class="kpi"><b>19</b><span>Teilnehmer</span></div>'+
      '<div class="kpi"><b>10</b><span>Fixspieler</span></div>'+
      '<div class="kpi"><b>15</b><span>pro Krieg</span></div>'+
      '<div class="kpi"><b>3–4</b><span>Rotation</span></div></div></div>'+
      '<div id="mobileDaySwitcher" class="mobile-day-switcher"><div class="mobile-day-tabs">'+
      Array.from({length:7},(_,i)=>'<button class="mobile-day-tab">Tag '+(i+1)+'</button>').join('')+
      '</div></div></section></body></html>');
    const collapsed=await page.evaluate(()=>({
     visible:[...document.querySelectorAll(".kpi")].map(e=>getComputedStyle(e).display!=="none"),
     overflow:document.documentElement.scrollWidth-innerWidth,
     tabBg:getComputedStyle(document.getElementById("mobileDaySwitcher")).backgroundColor
    }));
    assert.deepEqual(collapsed.visible,[true,true,false,false],"collapsed mobile KPIs "+width);
    assert.ok(collapsed.overflow<=2,"no horizontal overflow "+width);
    await page.locator(".plan-overview").evaluate(e=>e.classList.add("overview-open"));
    const expanded=await page.evaluate(()=>[...document.querySelectorAll(".kpi")].map(e=>getComputedStyle(e).display!=="none"));
    assert.deepEqual(expanded,[true,true,true,true],"expanded mobile KPIs "+width);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
