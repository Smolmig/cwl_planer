"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
function cloneHarness(){
 const a=html.indexOf("function cloneProfile(p,newName){");
 const b=html.indexOf("function resetProfileCompletely(){",a);
 assert.ok(a>0&&b>a);
 let n=0;
 return vm.runInNewContext(html.slice(a,b)+"\ncloneProfile",{
  uid:()=>String(++n),cloneGoal:g=>JSON.parse(JSON.stringify(g)),
  normalizeProfile:p=>p,structuredClone
 });
}
function sourceProfile(pending){
 return {
   id:"old",name:"From JSON",config:{days:7,slots:15},
   members:[{id:"a",name:"Captain",note:"Do not discard",playerTag:"#AAA",
     participating:true,statuses:Array(7).fill("auto")}],
   archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
   dayGoals:[],archives:[],
   ...(pending?{cocManualEmergency:{pending:true,since:123456}}:{})
 };
}
test("emergency pending flag survives a profile backup/copy path",()=>{
 const original=sourceProfile(true),cloned=cloneHarness()(original,"Imported");
 assert.notEqual(cloned.id,original.id);
 assert.notEqual(cloned.members[0].id,original.members[0].id);
 assert.equal(cloned.members[0].note,"Do not discard");
 assert.equal(cloned.cocManualEmergency.pending,true);
 assert.equal(cloned.cocManualEmergency.since,123456);
 assert.notStrictEqual(cloned.cocManualEmergency,original.cocManualEmergency);
 cloned.cocManualEmergency.pending=false;
 assert.equal(original.cocManualEmergency.pending,true);
});
test("ordinary profiles do not gain an emergency flag during a copy",()=>{
 const cloned=cloneHarness()(sourceProfile(false),"Regular");
 assert.equal(Object.hasOwn(cloned,"cocManualEmergency"),false);
});
test("both normalized cloud loading and manual auto-sync gate use the saved flag",()=>{
 assert.match(sync,/function manualRosterPending\(\)\{return !!storage\.getProfile\(\)\?\.cocManualEmergency\?\.pending/);
 assert.match(sync,/manualRosterPending\(\)\|\|!\["owner","editor"\]\.includes\(role\)/);
 assert.match(sync,/async function loadCloudProfile\(automatic=false\)/);
 assert.match(sync,/storage\.switchToCloud\(profile\)/);
 assert.match(html,/function normalizeProfile\(p\)/);
 assert.match(html,/return p\}/);
});
