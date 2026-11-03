"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
function pick(start,end,name,ctx){
 const a=html.indexOf(start),b=html.indexOf(end,a);
 assert.ok(a>0&&b>a,start+" missing");
 return vm.runInNewContext(html.slice(a,b)+"\n"+name,ctx);
}
test("hidden bulk import and single-member submit cannot add to a linked API clan",()=>{
 const state={members:[],config:{}};
 let protectedMode=true,notifications=0;
 const ctx={
  state,manualRosterRestricted:()=>protectedMode,
  showToast:()=>{notifications++},
  freshMember:name=>({id:name,name}),document:{getElementById:()=>({value:"Neue Person"})},
  closeInlineMemberAdd:()=>{},renderAll:()=>{}
 };
 const addMany=pick("function addMany(text){","function openInlineMemberAdd(","addMany",ctx);
 const commit=pick("function commitInlineMemberAdd(){","function addSingleMember(","commitInlineMemberAdd",ctx);
 assert.equal(addMany("A\nB"),0);
 commit();
 assert.equal(state.members.length,0);
 assert.equal(notifications,2);
 protectedMode=false;
 assert.equal(addMany("A\nB"),2);
 assert.equal(state.members.length,2);
});
test("CSV import cannot bypass API source-of-truth restriction",()=>{
 let protectedMode=true;
 const state={members:[]};
 const ctx={state,manualRosterRestricted:()=>protectedMode,freshMember:name=>({name,participating:false}),
   duplicateNameKeys:()=>new Set()};
 const importText=pick("function importMemberText(text,participating=false){",
  "function buildBugUrl(){","importMemberText",ctx);
 assert.throws(()=>importText("Alice"),/nur über API/);
 assert.equal(state.members.length,0);
 protectedMode=false;
 assert.equal(importText("Alice").added,1);
 assert.equal(state.members[0].name,"Alice");
});
test("linked API controls are editable only in explicitly enabled emergency mode",()=>{
 const ctx={window:{CWLCloud:{active:true,hasApiClan:()=>true,isEmergencyEditing:()=>false}}};
 const restrict=pick("function manualRosterRestricted(){",
  "function apiManagedRosterMember(","manualRosterRestricted",ctx);
 assert.equal(restrict(),true);
 ctx.window.CWLCloud.isEmergencyEditing=()=>true;
 assert.equal(restrict(),false);
 ctx.window.CWLCloud.active=false;
 assert.equal(restrict(),false);
});
