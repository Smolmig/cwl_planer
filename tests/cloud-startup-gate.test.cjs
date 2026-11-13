"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("cloud-app.html");
const sync=read("cloud-sync.mjs");
const live=read("cwl-live.mjs");
const match=html.match(/<script>\s*\/\/ One visual gate on a cold start:[\s\S]*?<\/script>/);
assert.ok(match,"Startup script must be in the document head before any planner render");
const startupScript=match[0].replace(/^<script>/,"").replace(/<\/script>$/,"");
function boot(withStoredCloudSession){
 const dom=new JSDOM('<!doctype html><html lang="de"><head></head><body>'+
  '<div id="cloudStartupSplash" role="status"><span>Dein Clan wird geladen</span></div></body></html>',{
   url:"https://example.test/cloud-app.html",runScripts:"outside-only"
  });
 if(withStoredCloudSession)dom.window.localStorage.setItem(
  "sb-yjldnvfwposfwmzmcsow-auth-token",JSON.stringify({access_token:"test"})
 );
 dom.window.eval(startupScript);
 return dom;
}
test("Returning Cloud member gets one stable startup screen until ready",()=>{
 const dom=boot(true);
 try{
  assert.equal(dom.window.document.documentElement.classList.contains("cloud-startup-pending"),true);
  assert.equal(dom.window.document.querySelector("#cloudStartupSplash").hidden,false);
  dom.window.CWLStartup.finish();
  assert.equal(dom.window.document.documentElement.classList.contains("cloud-startup-pending"),false);
  assert.equal(dom.window.document.querySelector("#cloudStartupSplash").hidden,true);
  dom.window.CWLStartup.finish(); // idempotent even after a second status callback
  assert.equal(dom.window.document.querySelector("#cloudStartupSplash").hidden,true);
 }finally{dom.window.CWLStartup?.finish();dom.window.close()}
});
test("No stored session: guest/offline view stays immediately available",()=>{
 const dom=boot(false);
 try{
  assert.equal(dom.window.document.documentElement.classList.contains("cloud-startup-pending"),false);
  dom.window.CWLStartup.finish();
  assert.equal(dom.window.document.documentElement.classList.contains("cloud-startup-pending"),false);
 }finally{dom.window.CWLStartup?.finish();dom.window.close()}
});
test("Switching Cloud clans reuses the shield and discards stale completion tokens",()=>{
 const dom=boot(false);
 try{
  const {CWLStartup,document}=dom.window;
  const a=CWLStartup.begin("Erster Clan wird geladen …");
  assert.equal(document.documentElement.classList.contains("cloud-startup-pending"),true);
  assert.equal(document.querySelector("#cloudStartupSplash").hidden,false);
  assert.equal(document.querySelector("#cloudStartupSplash span").textContent,"Erster Clan wird geladen …");
  const b=CWLStartup.begin("Zweiter Clan wird geladen …");
  assert.notEqual(a,b);
  CWLStartup.finish(a);
  assert.equal(document.documentElement.classList.contains("cloud-startup-pending"),true,
   "a previous clan must not reveal the next clan's half-finished view");
  CWLStartup.finish(b);
  assert.equal(document.documentElement.classList.contains("cloud-startup-pending"),false);
  assert.equal(document.querySelector("#cloudStartupSplash").hidden,true);
 }finally{dom.window.CWLStartup?.finish();dom.window.close()}
});
test("Cloud select change raises a splash only for actual tenant changes",()=>{
 assert.match(sync,/if\(cloud\.active&&clanId&&nextClan&&clanId!==nextClan\)/);
 assert.match(sync,/CWLStartup\?\.begin\?\.\("Der gewählte Clan wird geladen/);
 assert.match(sync,/onInitialSettled:expectedClan=>\{if\(cloud\.active&&clanId===expectedClan\)finishStartup\(\)\}/);
});

test("Startup gate only waits on first live status and always has a bounded fallback",()=>{
 assert.match(startupScript,/setTimeout\(\(\)=>finish\(ticket\),12000\)/);
 assert.match(html,/class="cloud-startup-splash"/);
 assert.match(html,/cloud-startup-splash\[hidden\]/);
 assert.match(sync,/onInitialSettled:expectedClan=>\{if\(cloud\.active&&clanId===expectedClan\)finishStartup\(\)\}/);
 assert.match(sync,/if\(!clans\.find\(c=>c\.id===clanId\)\?\.clash_tag\|\|!navigator\.onLine\)finishStartup\(\)/);
 assert.match(sync,/else if\(session\)try\{await useSession\(session\)\}catch\(e\)\{error\(e\);finishStartup\(\)\}/);
 assert.match(live,/onInitialSettled\?\.\(id\)/);
 assert.match(live,/fetching=false;render\(\);storage\.refreshSummary\?\.\(\)/);
 assert.doesNotMatch(read("index.html"),/cloudStartupSplash/,"Offline-PWA must remain independent");
});
