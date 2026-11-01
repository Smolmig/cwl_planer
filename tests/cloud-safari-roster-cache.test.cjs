"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const worker=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");

test("Cloud version and entrypoint cache token must always match",()=>{
  const displayed=html.match(/const APP_VERSION="(v\d+\.\d+\.\d+)"/)?.[1];
  const entry=html.match(/src="\.\/cloud-sync\.mjs\?v=(\d+\.\d+\.\d+)"/)?.[1];
  const release=JSON.parse(fs.readFileSync(path.join(root,"cloud-version.json"),"utf8")).version;
  assert.ok(displayed&&entry);
  assert.equal(displayed,release);
  assert.equal(entry,displayed.slice(1),"Safari cannot reuse an older Cloud module from cache");
  for(const name of ["cloud-backups","cwl-live","cwl-stats","cwl-current-war"]){
    assert.ok(cloud.includes("./"+name+".mjs?v="+entry),name+" version mismatch");
  }
});
test("Offline service worker never serves stale Cloud JavaScript",()=>{
  assert.match(worker,/cwl-planer-v1-0-2/);
  assert.ok(worker.includes("cloud-sync\\.mjs"));
  assert.match(worker,/cwl-stats/);
  assert.match(worker,/cloudModule/);
  assert.match(worker,/if\(url.origin===self.location.origin && cloudModule\)/);
  assert.match(worker,/fetch\(e.request,\{cache:"no-store"\}\)/);
  assert.match(worker,/const ASSETS=/);
  assert.match(worker,/".\/index.html"/);
});

function makeHarness({invokeError=false,malformed=false,crashAtPlanning=false}={}){
 const dom=new JSDOM('<div id="cloudRosterBox" hidden></div>'+
  '<div id="cloudRosterStatus"></div>'+
  '<div id="cloudRosterDiff"></div>'+
  '<div id="cloudDepartedWarnings"></div>'+
  '<div id="cloudApplyRoster" hidden></div>'+
  '<div id="cloudRosterDiff" hidden></div>');
 // Duplicate ID would mask a preview. Remove the duplicate before evaluation.
 dom.window.document.querySelectorAll("#cloudRosterDiff")[1].remove();
 const doc=dom.window.document;
 doc.getElementById("cloudRosterBox").scrollIntoView=()=>{};
 const existing=[{id:"old",name:"Alt",playerTag:"#2PYL",townHall:18}];
 const members=[{name:"Neu",tag:"#8PY",townHallLevel:19}];
 const state={requests:0,fallbacks:0,auth:0,clanId:"clan-id",role:"editor",
   roster:null,rosterDiff:null};
 const rootEnv={
  console:{warn(){},log(){}},
  document:doc,Option:dom.window.Option,
  clanId:state.clanId,role:"editor",
  ensureSaved:async()=>{},
  resetRoster:()=>{},
  toggle:(id,value)=>{doc.getElementById(id).hidden=!value},
  $:id=>doc.getElementById(id),
  text:(id,value)=>{doc.getElementById(id).textContent=value},
  normalizeTag:s=>String(s||"").toUpperCase(),
  storage:{
   getProfile:()=>({members:existing}),
   getPlannedLineups:()=>crashAtPlanning?(()=>{throw new TypeError("Type error")})():[{day:1,lineup:null},{day:2,lineup:[]}]
  },
  sb:{
   functions:{
    invoke:async()=>{state.requests++;return invokeError?
      {data:null,error:{name:"FunctionsFetchError",message:"Type error"}}:
      {data:malformed?{ok:true,members:null}:{ok:true,members},error:null}}
   },
   auth:{getSession:async()=>{state.auth++;return {data:{session:{access_token:"synthetic-token"}},error:null}}}
  },
  SUPABASE_URL:"https://test.supabase.co",SUPABASE_PUBLISHABLE_KEY:"sb_publishable_test",
  fetch:async(url,options)=>{
   state.fallbacks++;
   assert.match(url,/\/functions\/v1\/coc-clan-members$/);
   assert.equal(options.headers.Authorization,"Bearer synthetic-token");
   assert.equal(options.cache,"no-store");
   return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,members})};
  },
  Error,TypeError,Map,Set,Array,JSON,String,Number,RegExp
 };
 const source=cloud.slice(cloud.indexOf("async function getRoster({automatic=false}={}){"),cloud.indexOf("async function applyRoster()"));
 assert.ok(source.startsWith("async function getRoster({automatic=false}={}){"));
 vm.createContext(rootEnv);
 vm.runInContext(source+"; globalThis.getRosterTest=getRoster;",rootEnv);
 return {state,doc,run:()=>rootEnv.getRosterTest()};
}
test("Successful Safari fetch from SDK loads members and does not invoke fallback",async()=>{
 const h=makeHarness();
 await h.run();
 assert.equal(h.state.requests,1);
 assert.equal(h.state.fallbacks,0);
 assert.match(h.doc.getElementById("cloudRosterStatus").textContent,/1 Mitglieder geprüft/);
 assert.match(h.doc.getElementById("cloudRosterDiff").textContent,/NEU IM CLAN/);
});
test("Safari Type error after HTTP 200 is retried through authenticated read-only fetch",async()=>{
 const h=makeHarness({invokeError:true});
 await h.run();
 assert.equal(h.state.requests,1);
 assert.equal(h.state.auth,1);
 assert.equal(h.state.fallbacks,1);
 assert.match(h.doc.getElementById("cloudRosterStatus").textContent,/1 Mitglieder geprüft/);
});
test("Missing members array is rejected with a useful error",async()=>{
 const h=makeHarness({malformed:true});
 await assert.rejects(h.run(),/nicht vollständig übertragen/);
 assert.equal(h.state.fallbacks,0);
});
test("Safari TypeError in local roster comparison identifies the failed step",async()=>{
 const h=makeHarness({crashAtPlanning:true});
 await assert.rejects(h.run(),/Mitglieder vergleichen/);
});
