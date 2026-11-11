"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const from=html.indexOf("async function handleCwlManage(){"),to=html.indexOf("\nfunction buildFullPlanText()",from);
assert.ok(from>0&&to>from);
const script=html.slice(from,to)+"\nthis.manage=handleCwlManage;";

function setup({alreadyArchived=false,failCycle=false,archiveDuringDialog=false,changingClan=false}={}){
 const archived={id:"a-old",sourceSeason:"2026-11",complete:true};
 const state={cwlLive:{season:"2026-11"},config:{days:7},
  archives:alreadyArchived?[archived]:[],
  locks:Array.from({length:7},()=>({locked:true}))};
 const calls={archive:0,cycles:0,resets:0,renders:0,toast:[],prompts:[]};
 const cloud={active:true,isPlanLocked:()=>false,isOwner:()=>true,
  getActiveClanId:()=>changingClan&&calls.cycles?"new-clan":"old-clan",
  openNewCycle:async()=>{calls.cycles++;if(failCycle)throw Error("stale revision")}};
 const sandbox={state,window:{CWLCloud:cloud},
  playedCount:()=>7,
  confirmInline:async(message,options)=>{
   calls.prompts.push({message,options});
   if(archiveDuringDialog)state.archives.push(archived);
   return true;
  },
  archiveCurrentCwl:()=>{
   calls.archive++;
   return {id:"a-new",sourceSeason:"2026-11",complete:true};
  },
  resetPlanningData:()=>calls.resets++,
  renderAll:()=>calls.renders++,
  showToast:msg=>calls.toast.push(msg)};
 vm.runInNewContext(script,sandbox);
 return {state,calls,manage:sandbox.manage};
}
test("Manual new CWL does not duplicate a previously auto-archived season",async()=>{
 const {state,calls,manage}=setup({alreadyArchived:true});
 await manage();
 assert.equal(calls.archive,0);
 assert.equal(state.archives.length,1);
 assert.equal(calls.cycles,1);
 assert.equal(calls.resets,1);
 assert.equal(calls.renders,1);
 assert.match(calls.prompts[0].message,/nicht erneut ins Archiv/);
});
test("Archive created while confirmation is open still dedupes at commit time",async()=>{
 const {state,calls,manage}=setup({archiveDuringDialog:true});
 await manage();
 assert.equal(calls.archive,0);
 assert.equal(state.archives.length,1);
 assert.equal(calls.resets,1);
});
test("First manual archive saves exactly one copy and resets only after Cloud RPC",async()=>{
 const {state,calls,manage}=setup();
 await manage();
 assert.equal(calls.archive,1);
 assert.equal(state.archives.length,1);
 assert.equal(state.archives[0].id,"a-new");
 assert.equal(calls.cycles,1);
 assert.equal(calls.resets,1);
});
test("Failed Cloud cycle RPC removes unsaved duplicate and never wipes played locks",async()=>{
 const {state,calls,manage}=setup({failCycle:true});
 await manage();
 assert.equal(calls.archive,1);
 assert.equal(state.archives.length,0);
 assert.equal(calls.resets,0);
 assert.equal(calls.renders,0);
 assert.match(calls.toast[0],/stale revision/);
 assert.equal(state.locks.every(l=>l.locked),true);
});
test("Clan switch during awaited RPC never resets another clan's planning state",async()=>{
 const {state,calls,manage}=setup({changingClan:true});
 await manage();
 assert.equal(calls.resets,0);
 assert.equal(calls.renders,0);
 assert.equal(state.locks.every(l=>l.locked),true);
});
