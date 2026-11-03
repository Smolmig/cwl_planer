"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const load=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live.mjs")).href);
const roundData=()=>({ok:true,active:true,season:"2026-11",clanTag:"#2PYG",
 detailsStatus:"complete",rounds:[{day:1,available:false}]});
const profile=()=>({id:"same-profile-id",config:{slots:15,days:1},members:[],
 archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]}))});

async function scenario(modify){
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div>'+
  '<div class="plan-overview"></div><div id="day-card-0"><div class="day-head"></div></div></main>');
 const prevDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
 const prevNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 Object.defineProperty(globalThis,"document",{value:dom.window.document,configurable:true});
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 let response,changes=0,stats=0;
 const initial=profile(),replacement=profile();
 const state={active:true,hasClanTag:true,clanId:"clan-A",role:"owner",profile:initial,canApply:true};
 try{
  const {createCwlLive}=await load();
  const live=createCwlLive({
   sb:{functions:{invoke:async()=>new Promise(resolve=>{response=resolve})}},
   context:()=>state,
   storage:{getProfile:()=>state.profile,
    getPlannedLineups:()=>[],getPlanningState:()=>({ok:true}),
    newMember:()=>{throw Error("Unexpected member creation")},
    rerender:()=>{changes++}},
   onSnapshot:()=>{stats++},notify:()=>{}
  });
  const operation=live.refresh();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(typeof response,"function","a CWL read is pending");
  modify(state,replacement);
  response({data:roundData(),error:null});
  await operation;
  await Promise.resolve();await Promise.resolve();
  const result={initial,replacement,current:state.profile,changes,stats};
  live.stop();
  return result;
 }finally{
  if(prevDocument)Object.defineProperty(globalThis,"document",prevDocument);
  else delete globalThis.document;
  if(prevNavigator)Object.defineProperty(globalThis,"navigator",prevNavigator);
  else delete globalThis.navigator;
  dom.window.close();
 }
}

test("CWL response from a replaced Cloud profile is discarded even if clan ID and profile ID are unchanged",async()=>{
 const v=await scenario((context,replacement)=>{context.profile=replacement});
 assert.equal(v.changes,0);
 assert.equal(v.stats,0);
 assert.equal(v.current.cwlLive,undefined);
 assert.equal(v.initial.cwlLive,undefined);
});
test("Viewer downgrade during request also suppresses stats and automatic closure",async()=>{
 const v=await scenario(context=>{context.role="viewer";context.canApply=false});
 assert.equal(v.changes,0);
 assert.equal(v.stats,0);
 assert.equal(v.initial.cwlLive,undefined);
});
test("A stable owner context can still synchronize a current CWL snapshot",async()=>{
 const v=await scenario(()=>{});
 assert.equal(v.changes,1);
 assert.equal(v.stats,1);
 assert.equal(v.initial.cwlLive.season,"2026-11");
});
