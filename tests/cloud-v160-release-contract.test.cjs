"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("cloud release version, banner, module cache-busting and metadata remain synchronized",()=>{
 const html=read("cloud-app.html");
 const sync=read("cloud-sync.mjs");
 const live=read("cwl-live.mjs");
 const json=JSON.parse(read("cloud-version.json"));
 assert.equal(json.version,"v1.16.21");
 assert.match(json.summary,/Mitglieder|Statistik|Vergleich|CWL|Form|Einsatz|Freigabe|Vorschlag/);
 assert.equal(json.released,"2026-11-08");
 assert.match(html,/const APP_VERSION="v1\.16\.21"/);
 assert.match(html,/Neu in v1\.16\.21/);
 assert.match(html,/cloud-sync\.mjs\?v=1\.16\.21/);
 assert.match(html,/cwl-planning-core\.js\?v=1\.16\.21/);
 for(const mod of ["cloud-backups","cwl-live","cwl-stats","cwl-current-war"])
  assert.ok(sync.includes('"./'+mod+'.mjs?v=1.16.21"'),mod+" must be cache-busted");
 assert.match(live,/cwl-live-core\.mjs\?v=1\.16\.21/);
 assert.doesNotMatch(html,/v1\.5\.2(?=["<])/,"old live version not visible");
});
test("offline planner format, file cache and existing profiles are not migrated",()=>{
 const offline=read("index.html");
 const sw=read("service-worker.js");
 assert.match(offline,/const APP_VERSION="v1\.0\.2"/);
 assert.match(offline,/const DATA_VERSION=9/);
 assert.match(sw,/cwl-planer-v1-0-2/);
 assert.match(sw,/cloudModule=.*cloud-app/);
 const cloud=read("cloud-app.html");
 assert.match(cloud,/const DATA_VERSION=9/);
 assert.match(cloud,/const STORAGE_KEY="cwl_planer_mobile_v9"/);
 assert.match(cloud,/getPlanningState:\(\)=>\(\{ok:lastPlan\?\.ok===true/);
});
test("preparation advice remains strictly read-only and cached lineups cannot impersonate current API",()=>{
 const live=read("cwl-live.mjs");
 assert.match(live,/let staleRoundDays=new Set\(\),lastSuccessfulProfile=null/);
 assert.match(live,/lastSuccessfulProfile===ctx\.profile/);
 assert.match(live,/Clash-Abgleich derzeit nicht aktuell/);
 assert.match(live,/lastSuccessfulAt>0/);
 assert.match(live,/const stillCurrent=\(\)=>/);
 assert.match(live,/!stillCurrent\(\)/);
});
