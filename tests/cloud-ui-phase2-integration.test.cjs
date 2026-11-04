"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const html=read("cloud-app.html"),sync=read("cloud-sync.mjs"),stats=read("cwl-stats.mjs");

test("merged UI retains Cloud account/help navigation together with fast members and Arena Rathaus styling",()=>{
 for(const id of ["view-account","view-help","cloudAccount","cloudAccountBack","cloudOverlay","cloudAuth","memberList","statsRows"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,"unique UI target "+id);
 }
 assert.ok(html.indexOf('id="cloudAccount"')<html.indexOf('id="cloudOverlay"'),"account page is not inside auth dialog");
 assert.match(html,/window\.CWLShowAccountPage=\(\)=>showPlannerView\("account"\)/);
 assert.match(html,/const navView=visible==="cwl-season"\?"plan"/);
 assert.match(sync,/!document\.getElementById\("view-account"\)\?\.classList\.contains\("active"\)/);
 assert.match(html,/function syncMemberExpandedRow\(el\)/);
 assert.match(html,/function toggleMemberCardDetails\(el\)/);
 assert.match(html,/memberSearchRenderTimer=setTimeout\(/);
 assert.match(html,/const idx=orderIndex\.get\(m\.id\)/);
 assert.match(html,/html\[data-theme="arena"\] \.stats-player-row\{background:transparent!important/);
 assert.match(html,/html\[data-theme="arena"\] #view-members \.member-snapshot/);
 assert.match(stats,/class='stats-th-icon'/);
 assert.ok(stats.includes("https://assets.clashk.ing/buildings/home-village/town_hall/level_"));
 assert.ok(html.includes("https://assets.clashk.ing/buildings/home-village/town_hall/level_"));
});

test("v1.13.0 preserves Cloud data format and independent offline PWA",()=>{
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(html,/const APP_VERSION="v1\.13\.0"/);
 assert.equal(JSON.parse(read("cloud-version.json")).version,"v1.13.0");
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
 assert.match(read("service-worker.js"),/cwl-planer-v1-0-2/);
 assert.match(read("docs/UI_PHASE2_INTEGRATION.md"),/Versions-\/Cachekennungen/);
});
