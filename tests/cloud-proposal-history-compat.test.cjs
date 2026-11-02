"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");

test("Editor proposal reuses original server-side played histories despite normalisation",async()=>{
 const a=sync.indexOf("async function submitPlanSuggestion(){");
 const b=sync.indexOf("async function decidePlanSuggestion(",a);
 assert.ok(a>=0&&b>a,"Submit handler exists");
 const raw={locks:[{locked:true,lineup:["m1"]}],archives:[{id:"a1",complete:true}],
   archivedMembers:[{id:"x",firstDay:4}]};
 const normalized={...raw,locks:[{locked:true,lineup:["m1"],snapshots:{}}],
   archivedMembers:[{id:"x",firstDay:null,statuses:Array(7).fill("auto")}],
   members:[{id:"m1",name:"Alpha",targetDays:3}]};
 let submitted=null,reloaded=0,refreshed=0;
 const context={
   clanId:"clan-id",role:"editor",changedSerial:JSON.stringify(normalized),
   rawSavedProfile:raw,revision:4,planIsLocked:()=>true,
   suggestionChanges:()=>["Einsatzziel geändert"],
   storage:{confirmAction:async()=>true,toast:()=>{}},
   sb:{rpc:async(name,payload)=>{assert.equal(name,"cwl_submit_plan_suggestion");submitted=payload.p_profile;return {error:null}}},
   loadCloudProfile:async()=>{reloaded++},loadPlanReview:async()=>{refreshed++},
   clearTimeout:()=>{},debounce:null
 };
 const submit=vm.runInNewContext(sync.slice(a,b)+"\nsubmitPlanSuggestion",context);
 await submit();
 assert.deepEqual(JSON.parse(JSON.stringify(submitted.locks)),raw.locks);
 assert.deepEqual(JSON.parse(JSON.stringify(submitted.archives)),raw.archives);
 assert.deepEqual(JSON.parse(JSON.stringify(submitted.archivedMembers)),raw.archivedMembers);
 assert.equal(submitted.members[0].targetDays,3);
 assert.equal(reloaded,1);assert.equal(refreshed,1);
});
test("Vize cannot delete played members or manually edit played days during approval",()=>{
 assert.match(html,/function reviewLockedForVize\(\)/);
 assert.match(html,/async function deleteMember\(id\)\{if\(reviewLockedForVize\(\)\)/);
 assert.match(html,/function openLineupModal\(day\)\{if\(reviewLockedForVize\(\)\)/);
 assert.match(html,/async function unlockDay\(day\)\{if\(reviewLockedForVize\(\)\)/);
 assert.match(sync,/const restricted=role==="editor"&&planIsLocked\(\)/);
 assert.match(sync,/rawSavedProfile=original/);
});
