"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("index.html"),cloud=read("cloud-app.html");
const sw=read("service-worker.js"),manifest=JSON.parse(read("manifest.webmanifest"));
const prepaint=html.match(/<title>CWL Planer<\/title>\s*<script>([\s\S]*?)<\/script>\s*<style>/)?.[1];
assert.ok(prepaint,"prepaint script must precede CSS");
function startup(saved,{dark=false,throwStorage=false}={}){
 let writes=0;
 const meta={content:"#151a20"};
 const ctx={localStorage:{
   getItem(){if(throwStorage)throw Error("storage blocked");return saved===undefined?null:JSON.stringify(saved)},
   setItem(){writes++;throw Error("theme must not be saved during startup")}
 },matchMedia:()=>({matches:dark}),
 document:{documentElement:{dataset:{theme:"arena"}},querySelector:()=>meta}};
 vm.runInNewContext(prepaint,ctx);
 return {theme:ctx.document.documentElement.dataset.theme,meta:meta.content,writes};
}
test("fresh offline PWA starts gold before first paint",()=>{
 assert.match(html,/<html lang="de" data-theme="arena">/);
 assert.equal(startup().theme,"arena");
 assert.equal(startup().meta,"#151a20");
 assert.match(html,/option value="arena">🏅 Arena · Anthrazit & Gold \(Standard\)/);
 assert.match(html,/html\[data-theme="arena"\]\{[\s\S]*?--primary:#dfbd7a/);
 assert.match(html,/html\[data-theme="arena"\] \.btn\.primary:not\(:disabled\)/);
});
test("saved user themes persist across offline/cloud",()=>{
 for(const theme of ["arena","dark","light","cyber","cyberlight"]){
  const r=startup({theme});assert.equal(r.theme,theme);assert.equal(r.writes,0);
 }
 assert.equal(startup({theme:"system"},{dark:true}).theme,"dark");
 assert.equal(startup({theme:"system"},{dark:false}).theme,"light");
 assert.equal(startup({theme:"dark"}).meta,"#0f172a");
 assert.match(cloud,/localStorage\.getItem\("cwl_planer_ui_v1"\)/);
 assert.match(html,/const UI_SETTINGS_KEY="cwl_planer_ui_v1"/);
});
test("invalid/corrupt/blocked settings fall back to Gold without writing",()=>{
 assert.equal(startup({theme:"unsupported"}).theme,"arena");
 assert.equal(startup(null).theme,"arena");
 assert.equal(startup(undefined,{throwStorage:true}).theme,"arena");
 const loader=html.slice(html.indexOf("function loadUiSettings(){"),html.indexOf("let uiSettings=loadUiSettings();"));
 const run=new Function("localStorage","UI_SETTINGS_KEY",loader+"\nreturn loadUiSettings();");
 assert.equal(run({getItem:()=>null},"cwl_planer_ui_v1").theme,"arena");
 assert.equal(run({getItem:()=>JSON.stringify({theme:"dark"})},"cwl_planer_ui_v1").theme,"dark");
 assert.equal(run({getItem:()=>"{broken"},"cwl_planer_ui_v1").theme,"arena");
});
test("offline-only MINOR release keeps Cloud and profile compatibility",()=>{
 assert.match(html,/const APP_VERSION="v1\.1\.0"/);
 assert.match(cloud,/const APP_VERSION="v1\.25\.0"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(html,/const STORAGE_KEY="cwl_planer_mobile_v9"/);
 assert.match(sw,/const CACHE="cwl-planer-v1-1-0"/);
 assert.equal(manifest.background_color,"#151a20");
 assert.equal(manifest.theme_color,"#151a20");
 assert.match(html,/Farbschema &amp; Goldstandard/);
 assert.match(sw,/Cloud app is online-only/);
});
