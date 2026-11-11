"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const start=html.indexOf("archivePriorCwlForRollover:(");
const end=html.indexOf("getPlanningState:()=>",start);
assert.ok(start>0&&end>start,"owner-only automatic lifecycle methods must exist");
const methods="({"+html.slice(start,end)+"})";
const oldSeason="2026-11",newSeason="2026-12";

function context({played=6,owner=true,clan="main",failCloud=false,existing=false}={}){
 const original={clan,season:oldSeason,
  rounds:Array.from({length:7},(_,i)=>({day:i+1,
   warTag:"#P9Q"+i,state:i<played?"warEnded":"inWar"}))};
 const state={
  config:{days:7},cwlLive:{season:oldSeason,clanTag:"#2PYL",rounds:original.rounds},
  locks:Array.from({length:7},(_,i)=>i<played?
   {locked:true,source:"coc-api",season:oldSeason,warTag:"#P9Q"+i}:
   {locked:false}),
  archives:existing?[{sourceSeason:oldSeason,complete:false,playedCount:played}]:[]
 };
 const actions={archive:0,save:0,renderArchives:0,reset:0,open:0};
 const cloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,
  getActiveClanId:()=>clan,openNewCycle:async()=>{actions.open++;
   if(failCloud)throw Error("Cloud collision")}};
 const sandbox={
  state,window:{CWLCloud:cloud},
  navigator:{onLine:true},
  archiveCurrentCwl:()=>{
   actions.archive++;
   return {sourceSeason:oldSeason,playedCount:played,complete:played===7,
    lineups:Array.from({length:played},(_,i)=>({day:i+1}))};
  },
  saveApp:()=>actions.save++,
  renderArchives:()=>actions.renderArchives++,
  resetPlanningData:()=>{actions.reset++;state.locks=Array(7).fill({locked:false});},
  renderAll:()=>{},
  console
 };
 const funcs=vm.runInNewContext(methods,sandbox);
 return {state,actions,funcs,cloud};
}
test("Automatic new Cloud CWL archives 6/7 AS incomplete and starts clean Plan",async()=>{
 const a=context();
 assert.equal(a.funcs.archivePriorCwlForRollover(oldSeason),true);
 assert.equal(a.state.archives.length,1);
 assert.equal(a.state.archives[0].complete,false);
 assert.equal(a.state.archives[0].playedCount,6);
 assert.equal(a.state.locks.filter(l=>l.locked).length,6);
 const result=await a.funcs.autoAdvanceCwl(oldSeason,newSeason);
 assert.equal(result,true);
 assert.equal(a.actions.open,1);
 assert.equal(a.actions.reset,1);
 assert.equal(a.state.archives.length,1);
 assert.equal(a.state.archives[0].playedCount,6,"Day seven must remain missing");
});
test("7/7 auto-archived earlier never creates a duplicate on newly detected league",async()=>{
 const a=context({played:7,existing:true});
 assert.equal(a.funcs.archivePriorCwlForRollover(oldSeason),true);
 assert.equal(a.actions.archive,0);
 assert.equal(await a.funcs.autoAdvanceCwl(oldSeason,newSeason),true);
 assert.equal(a.state.archives.length,1);
});
test("Wrong season, denied owner, old season in API, failed Cloud RPC cannot reset",async()=>{
 for(const cfg of [{owner:false},{failCloud:true}]){
  const a=context(cfg);
  if(!cfg.failCloud){
   assert.equal(a.funcs.archivePriorCwlForRollover(oldSeason),false);
   assert.equal(await a.funcs.autoAdvanceCwl(oldSeason,newSeason),false);
   assert.equal(a.actions.reset,0);
  }else{
   assert.equal(a.funcs.archivePriorCwlForRollover(oldSeason),true);
   await assert.rejects(()=>a.funcs.autoAdvanceCwl(oldSeason,newSeason),/Cloud collision/);
   assert.equal(a.actions.reset,0);
   assert.equal(a.state.locks.filter(l=>l.locked).length,6);
  }
 }
 const a=context();
 assert.equal(a.funcs.archivePriorCwlForRollover("2026-10"),false);
 assert.equal(await a.funcs.autoAdvanceCwl(oldSeason,"2026-10"),false);
 assert.equal(a.actions.reset,0);
});
test("In linked Cloud no manual new-CWL button; offline guest still uses manual control",()=>{
 assert.match(html,/manage\.hidden=!!window\.CWLCloud\?\.active&&!!window\.CWLCloud\?\.hasApiClan\?\.\(\)/);
 assert.match(html,/#manageCwlBtn\[hidden\]/);
 assert.match(html,/async function handleCwlManage\(\)/);
 assert.match(live,/archivePriorCwlForRollover\?\.\(previous\.season\)/);
 assert.match(live,/await ensureCloudSaved\(\)/);
 assert.match(live,/await storage\.autoAdvanceCwl\?\.\(previous\.season,data\.season\)/);
 assert.match(live,/data\.season>previous\.season/);
 const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 assert.match(live,/onStatus\?\.\(data\)/);
 assert.match(cloud,/onStatus:data=>\{/);
 assert.match(cloud,/onSnapshot:data=>stats\.captureCwl\(data\)/);
});
