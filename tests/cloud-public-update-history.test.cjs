"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("public update timeline covers every official Cloud release and correctly distinguishes early development",async()=>{
 const {releaseHistory,earlyMilestones,groupReleasesByDate}=await import(pathToFileURL(path.join(root,"cloud-release-history.mjs")).href);
 const version=JSON.parse(read("cloud-version.json"));
 assert.equal(releaseHistory[0].version,version.version,"new release must always be the first history entry");
 assert.ok(releaseHistory.length>=124);
 assert.ok(earlyMilestones.length>=15);
 assert.ok(releaseHistory.some(r=>r.version==="v1.0.0"&&r.date==="2026-10-29"));
 assert.ok(releaseHistory.some(r=>r.version==="v1.2.0"&&r.date==="2026-10-31"));
 assert.equal(releaseHistory.find(r=>r.version==="v1.16.59").date,"2026-11-11","use official publication date, not a draft date");
 assert.equal(new Set(releaseHistory.map(r=>r.version)).size,releaseHistory.length);
 for(let i=0;i<releaseHistory.length;i++){
  const r=releaseHistory[i];
  assert.match(r.version,/^v\d+\.\d+\.\d+$/);
  assert.match(r.date,/^20\d{2}-\d\d-\d\d$/);
  assert.ok(r.title.length>9&&r.title.length<110,r.version+": readable short title");
  assert.doesNotMatch(r.title,/#\d+|\bPhase\b|\bOwner\b|\bHotfix\b|[`{}]/i);
  assert.ok(!r.description||r.description.length<=230,r.version+": one brief sentence");
  if(i)assert.ok(releaseHistory[i-1].date>=r.date,"latest first");
 }
 const groups=groupReleasesByDate();
 assert.equal(groups.flatMap(g=>g.items).length,releaseHistory.length);
 assert.equal(groups[0].date,"2026-11-14");
});

test("history is discoverable in More and alongside the existing newest-update note",()=>{
 const app=read("cloud-app.html");
 const sw=read("service-worker.js");
 assert.match(app,/data-more-action="updates"/);
 assert.match(app,/id="view-updates"/);
 assert.match(app,/id="updatesSearch"/);
 assert.match(app,/id="updatesBack"/);
 assert.match(app,/id="openReleaseHistory"/);
 assert.match(app,/id="latestChangelog"/);
 assert.match(app,/Neu in v1\.22\.1/);
 assert.match(app,/Mehr → Update-Verlauf/,"help explains the new page");
 assert.match(app,/\["help","account","archive","more-settings","updates","install","clan-management"\]/);
 assert.match(app,/if\(action==="updates"\)\{openReleaseHistory\(\);return\}/);
 assert.match(app,/import\("\.\/cloud-release-history\.mjs\?v=1\.22\.1"\)/);
 assert.match(sw,/cloud-release-history\\\.mjs/,"offline service worker must not cache Cloud history");
});

test("timeline search and grouped display are safe and preserve open day selection",async()=>{
 const app=read("cloud-app.html");
 const {releaseHistory,earlyMilestones,groupReleasesByDate}=await import(pathToFileURL(path.join(root,"cloud-release-history.mjs")).href);
 const dom=new JSDOM('<section id="view-updates" class="view active"><input id="updatesSearch"><p id="updatesCount"></p><div id="updatesHistory"></div></section>',{url:"https://example.test"});
 try{
  const start=app.indexOf("let releaseHistoryData=null;");
  const end=app.indexOf('document.querySelector(".more-menu").addEventListener',start);
  assert.ok(start>0&&end>start,"isolated history functions are present");
  const source=app.slice(start,end);
  const api=new Function("document","showPlannerView",source+
   "\nreturn {renderReleaseHistory,inject:mod=>{releaseHistoryData=mod}};")(dom.window.document,()=>{});
  api.inject({releaseHistory,earlyMilestones,groupReleasesByDate});
  api.renderReleaseHistory();
  const d=dom.window.document;
  assert.ok(d.querySelectorAll(".updates-day").length>=10);
  assert.equal(d.querySelectorAll(".updates-entry").length,releaseHistory.length+earlyMilestones.length);
  assert.equal(d.querySelector(".updates-day").open,true,"newest day first");
  assert.equal(d.querySelectorAll(".updates-day")[1].open,false,"old dates collapsed");
  d.getElementById("updatesSearch").value="8-Sterne";
  api.renderReleaseHistory();
  assert.ok(d.querySelectorAll(".updates-entry").length>=2);
  assert.ok(d.querySelectorAll(".updates-day:not([open])").length===0,"search results are open");
  d.getElementById("updatesSearch").value="<img src=x onerror=alert(1)>";
  api.renderReleaseHistory();
  assert.match(d.getElementById("updatesHistory").textContent,/Keine passenden Updates/);
  assert.equal(d.getElementById("updatesHistory").querySelector("img"),null,"search term never becomes HTML");
 }finally{dom.window.close()}
});

test("history layout uses mobile readable single-level lists, not nested cards",()=>{
 const app=read("cloud-app.html");
 assert.match(app,/\.updates-list\{list-style:none/);
 assert.match(app,/\.updates-day\{border-top:1px solid var\(--line\)/);
 assert.match(app,/\.updates-entry-title\{font-size:14px/);
 assert.match(app,/\.updates-controls input\{width:100%;min-width:0;min-height:44px/);
 assert.match(app,/#view-updates\{max-width:1000px/);
 assert.doesNotMatch(app,/<iframe[^>]*id="updates/);
});
