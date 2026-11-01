"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Cloud user-facing text is consistent with the statistics and actual features",()=>{
 const html=read("cloud-app.html");
 assert.match(html,/<option value="hitRate">3★-Quote ↓<\/option>/);
 assert.match(html,/<span>3★-Quote<\/span>/);
 assert.match(html,/<span>Nicht genutzt<\/span>/);
 assert.doesNotMatch(html,/>Hit Rate</);
 assert.match(html,/auf bis zu sieben CWL-Kriegstage/);
 assert.match(html,/Neu in v1\.3\.8/);
});

test("Every Cloud user decision uses the planner's app-native modal",()=>{
 const html=read("cloud-app.html");
 const sync=read("cloud-sync.mjs");
 const backups=read("cloud-backups.mjs");
 const stats=read("cwl-stats.mjs");
 for(const [name,code] of [["cloud-sync",sync],["cloud-backups",backups],["cwl-stats",stats]]){
  assert.doesNotMatch(code,/(?:^|[^\w.])(?:confirm|prompt|alert)\s*\(/m,name+" must not use browser popups");
 }
 assert.match(html,/confirmAction:\(message,options\)=>confirmInline/);
 assert.match(html,/askAction:\(options\)=>askInlineAction/);
 assert.match(sync,/confirmAction:\(message,options\)=>storage\.confirmAction/);
 assert.match(sync,/askAction:options=>storage\.askAction/);
 assert.match(sync,/!await storage\.confirmAction/);
 assert.match(backups,/!await confirmAction/);
 assert.match(stats,/!await confirmAction/);
 assert.match(html,/body:has\(#cloudOverlay\.open\) \.inline-action-backdrop\{z-index:510\}/);
 assert.match(html,/body:has\(#cloudOverlay\.open\) \.inline-action-panel\{z-index:515\}/);
});

test("UX release metadata and cloud app references agree without changing offline PWA",()=>{
 const html=read("cloud-app.html"),sync=read("cloud-sync.mjs");
 const version=JSON.parse(read("cloud-version.json"));
 assert.equal(version.version,"v1.3.8");
 assert.match(html,/const APP_VERSION="v1\.3\.8";/);
 assert.match(html,/cloud-sync\.mjs\?v=1\.3\.8/);
 assert.match(sync,/cloud-backups\.mjs\?v=1\.3\.8/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2";/);
 assert.match(read("CHANGELOG.md"),/\[1\.3\.8\]/);
});
