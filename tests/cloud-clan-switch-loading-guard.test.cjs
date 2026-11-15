"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const start=html.indexOf("// One visual gate on a cold start");
const begin=html.lastIndexOf("<script>",start);
const end=html.indexOf("</script>",start);
assert.ok(start>0&&begin>=0&&end>begin,"startup gate script available");
const startupCode=html.slice(begin+8,end);
function fixture(auth=false){
 const classes=new Set();
 const makeClasses=()=>({add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)});
 const rootClasses=makeClasses();
 const overlayClasses=new Set();
 const overlay={
  attrs:new Set(["hidden"]),
  classList:{add:x=>overlayClasses.add(x),remove:x=>overlayClasses.delete(x),contains:x=>overlayClasses.has(x)},
  setAttribute(k){this.attrs.add(k)},removeAttribute(k){this.attrs.delete(k)},
  querySelector:selector=>selector==="span"?caption:selector==="#cloudStartupRetry"?retry:null
 };
 const caption={textContent:"Dein Clan wird geladen …"},retry={hidden:true};
 const listeners=new Map(),timers=new Map();
 let nextTimer=1,reloads=0;
 const context={
  localStorage:{getItem:()=>auth?"session":null},
  document:{documentElement:{classList:rootClasses},
   getElementById:id=>id==="cloudStartupSplash"?overlay:null,
   addEventListener:(event,fn)=>listeners.set(event,fn)},
  window:{},location:{reload:()=>{reloads++}},
  setTimeout:(fn)=>{const id=nextTimer++;timers.set(id,fn);return id},
  clearTimeout:id=>timers.delete(id)
 };
 vm.runInNewContext(startupCode,context);
 const runLastTimeout=()=>{const fn=[...timers.values()].at(-1);assert.ok(fn);fn()};
 return {api:context.window.CWLStartup,rootClasses,overlay,caption,retry,timers,runLastTimeout,
  clickRetry:()=>listeners.get("click")({target:{id:"cloudStartupRetry"}}),reloads:()=>reloads};
}
test("switch timeout never exposes an unverified clan and offers retry",()=>{
 const f=fixture();
 const t=f.api.begin("Clan B wird geladen",{strict:true});
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),true);
 assert.equal(f.caption.textContent,"Clan B wird geladen");
 f.runLastTimeout();
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),true);
 assert.equal(f.overlay.classList.contains("cloud-startup-error"),true);
 assert.equal(f.retry.hidden,false);
 f.api.finish(t); // late API callback must not hide an already failed switch
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),true);
 f.clickRetry();
 assert.equal(f.reloads(),1);
 const t2=f.api.begin("Clan C wird geladen",{strict:true});
 assert.equal(f.retry.hidden,true);
 f.api.finish(t2);
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),false);
 assert.equal(f.overlay.attrs.has("hidden"),true);
});
test("first login retains bounded guest fallback and stale tickets cannot hide newer switch",()=>{
 const first=fixture(true);
 assert.equal(first.rootClasses.contains("cloud-startup-pending"),true);
 first.runLastTimeout();
 assert.equal(first.rootClasses.contains("cloud-startup-pending"),false);
 const f=fixture();
 const old=f.api.begin("A",{strict:true});
 const fresh=f.api.begin("B",{strict:true});
 f.api.finish(old);
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),true);
 f.api.finish(fresh);
 assert.equal(f.rootClasses.contains("cloud-startup-pending"),false);
});
test("manual clan change is serialized and has fail-closed recovery",()=>{
 assert.match(sync,/let clanSelectionBusy=false/);
 assert.match(sync,/if\(clanSelectionBusy\)\{select\.value=clanId\|\|"";return\}/);
 assert.match(sync,/clanSelectionBusy=true;select\.disabled=true/);
 assert.match(sync,/finally\{\s*clanSelectionBusy=false;select\.disabled=false/);
 assert.match(sync,/CWLStartup\?\.fail\?\.\("Clanwechsel nicht abgeschlossen/);
 assert.match(sync,/CWLStartup\?\.begin\?\.\("Der gewählte Clan wird geladen …",\{strict:true\}\)/);
 assert.match(sync,/const previousChannel=channel;channel=null/);
 const fn=sync.slice(sync.indexOf("async function chooseClan("),sync.indexOf("function stopRemoteChecks("));
 assert.ok(fn.indexOf("rememberClan(clanId)")>fn.indexOf("await loadCloudProfile(false)"),
  "the last-used clan is only saved after a successful profile load");
 assert.match(fn,/if\(!loaded\)throw Error\("Das gewählte Clanprofil konnte nicht geladen werden\."\)/);
});
test("a failed membership lookup does not remember an unverified clan",async()=>{
 const src=sync.slice(sync.indexOf("async function chooseClan("),sync.indexOf("function stopRemoteChecks("));
 const events=[],oldChannel={id:"old"};
 const fail=new Error("network denied");
 const select={value:"clan-B"};
 const client={
   removeChannel:async ch=>{events.push(["unsubscribed",ch.id])},
   from:()=>({select:()=>({eq:()=>({eq:()=>({single:async()=>({error:fail})})})})})
 };
 const ctx={
  accountEpoch:3,clanId:"clan-A",role:"owner",cloud:{active:true},channel:oldChannel,
  revision:null,lastSerial:null,changedSerial:null,blocked:false,remotePending:false,lastNotifiedRevision:0,
  window:{CWLStartup:{begin:(...args)=>events.push(["begin",...args])},CWLGroupArchive:{invalidate(){}}},
  $:()=>select,sb:client,user:{id:"user-1"},
  clearTimeout(){},debounce:null,
  live:{stop(){}},currentWarOverview:{reset(){}},stats:{reset(){}},
  stopPresence(){},stopRemoteChecks(){},hideChangeToast(){},resetRoster(){},
  rememberClan:()=>events.push(["remember"]),navigator:{onLine:true}
 };
 vm.createContext(ctx);
 vm.runInContext(src,ctx);
 await assert.rejects(()=>vm.runInContext("chooseClan()",ctx),/network denied/);
 assert.deepEqual(events.map(x=>x[0]),["begin","unsubscribed"]);
 assert.equal(events[0][2].strict,true);
 assert.equal(ctx.clanId,"clan-B");
 assert.equal(ctx.channel,null);
});
test("patch does not touch offline PWA or data format",()=>{
 assert.match(html,/const APP_VERSION="v1\.23\.3"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(html,/Clan wechseln &amp; Laden/);
 assert.match(html,/id="cloudStartupRetry"/);
 const offline=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(offline,/const APP_VERSION="v1\.1\.0"/);
});
