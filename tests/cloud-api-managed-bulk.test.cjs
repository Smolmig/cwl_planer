"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const run=(start,end,context)=>vm.runInNewContext(html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)))+"\n"+start.slice("function ".length,start.indexOf("(")),context);
const player=(id,api=false)=>({id,name:id,playerTag:api?"#"+id:"",
 cocOrder:api?0:undefined,cocSyncState:undefined,townHall:18,participating:true,statuses:Array(7).fill("auto")});
test("API-managed players cannot be removed through hidden single or bulk delete paths",()=>{
 const api=player("api",true),manual=player("manual");
 const state={members:[api,manual],archivedMembers:[]};
 const ctx={state,apiManagedRosterMember:m=>!!m?.cocOrder||m?.id==="api",
  isReadOnlyApiMember:m=>m?.id==="api",
  memberById:id=>state.members.find(m=>m.id===id),
  reviewLockedForVize:()=>false,showToast:()=>{},
  usedInLockedDay:()=>false,openRulePanels:new Set(),selectedMembers:new Set()};
 const remove=run("function removeMembers(ids){","async function deleteMember(",ctx);
 const original=JSON.stringify(state.members);
 const x=remove(new Set(["manual","api"]));
 assert.equal(x.blocked,true);
 assert.equal(JSON.stringify(state.members),original);
 const y=remove(new Set(["manual"]));
 assert.equal(y.blocked,undefined);
 assert.equal(state.members.length,1);
 assert.equal(state.members[0].id,"api");
});
test("bulk Rathaus cannot partially mutate API members even if manual members are selected first",()=>{
 const api=player("api",true),manual=player("manual");
 const state={members:[manual,api]};
 const selectedMembers=new Set(["manual","api"]);
 let renders=0;
 const ctx={state,selectedMembers,
   memberById:id=>state.members.find(m=>m.id===id),
   apiManagedRosterMember:m=>m?.id==="api",
   isReadOnlyApiMember:m=>m?.id==="api",
   showToast:()=>{},renderAll:()=>{renders++},
   markRosterAbsenceEdit:()=>{}};
 const bulk=run("function applyBulkValue(field,value){","async function createProfilePrompt(",ctx);
 bulk("townHall",20);
 assert.equal(manual.townHall,18);
 assert.equal(api.townHall,18);
 assert.equal(renders,0);
 bulk("participating",false);
 assert.equal(manual.participating,false);
 assert.equal(api.participating,false);
 assert.equal(renders,1);
});
test("blocked remove actions never announce success or clear selected rows",()=>{
 assert.match(html,/if\(r\.blocked\)return;renderAll\(r\.archived/);
 assert.match(html,/if\(r\.blocked\)return;selectedMembers\.clear\(\);renderAll\(r\.archived/);
 assert.match(html,/field==="townHall"&&\[\.\.\.selectedMembers\]\.some/);
});
