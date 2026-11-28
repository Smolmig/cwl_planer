"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../cwl-live.mjs"),"utf8");
const begin=source.indexOf("getStrategicPhase:()=>{"),end=source.indexOf("   getPostseasonSnapshot:",begin);
assert.ok(begin>=0&&end>begin);
const fnSource="({"+source.slice(begin,end)+"}).getStrategicPhase";
test("strategic phase needs fresh clan-scoped observation; routine polling preserves valid disclosure",()=>{
 const now=Date.UTC(2026,10,26),profile={locks:[{locked:true}]},clanTag="#P02";
 const ctx={active:true,clanId:"A",hasClanTag:true,clanTag,profile};
 let model={mode:"postseason",season:"2026-11",snapshot:{clanTag}};
 const env={context:()=>ctx,getLifecycle:()=>model,Date:{now:()=>now},activeClan:"A",lastSuccessfulProfile:profile,
  current:{ok:true,active:false,pending:false},lastSuccessfulAt:now-1000,FRESH_WINDOW_MS:300000,offlineReason:"",confirmedNoCwl:true,fetching:true};
 const read=vm.runInNewContext(fnSource,env);
 assert.equal(read().previousSeason,"2026-11");assert.equal(read().phase,"roster");assert.equal(read().season,null);
 env.current.pending=true;assert.equal(read(),null);env.current.pending=false;
 env.offlineReason="unavailable";assert.equal(read(),null);env.offlineReason="";
 env.lastSuccessfulAt=now-300001;assert.equal(read(),null);env.lastSuccessfulAt=now-1000;
 env.activeClan="B";assert.equal(read(),null);env.activeClan="A";
 model={mode:"transition",oldSeason:"2026-11",newSeason:"2026-12"};assert.equal(read(),null);
 model={mode:"idle"};assert.equal(read(),null);profile.locks=[];assert.equal(read().phase,"roster");
 env.confirmedNoCwl=false;assert.equal(read(),null);
 env.current={ok:true,active:true,season:"2026-12",clanTag};model={mode:"planning",reason:"league_active",season:"2026-12"};
 assert.equal(read().phase,"daily");env.current.clanTag="#P08";assert.equal(read(),null);
});
