"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{JSDOM}=require("jsdom");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("All backup and legacy recovery actions have one settings home; no destructive duplicate in account",()=>{
 const dom=new JSDOM(read("cloud-app.html"));
 try{
  const d=dom.window.document;
  for(const id of ["cloudPortableDownload","cloudPortableRestore","cloudAccountImportSection","cloudImportFile","cloudImportProfile","cloudBackupPanel","cloudRestoreSnapshot"]){
   assert.equal(d.querySelectorAll("#"+id).length,1,id);
   assert.ok(d.getElementById(id).closest("#settingsBackupSection"),id);
   assert.equal(d.getElementById(id).closest("#view-account"),null);
  }
  assert.equal(d.getElementById("cloudAccountImportSection").open,false);
  assert.match(d.getElementById("cloudAccountImportSection").textContent,/ersetzt den aktuellen gemeinsamen Plan/);
 }finally{dom.window.close()}
});
test("Legacy snapshot restore refuses a context change during confirmation",async()=>{
 const dom=new JSDOM(read("cloud-app.html"));
 const prior={document:global.document,Option:global.Option};global.document=dom.window.document;global.Option=dom.window.Option;
 try{
  const {createCloudBackups}=await import("../cloud-backups.mjs");
  let ctx={clanId:"a",role:"owner",userId:"u",epoch:1,revision:4,clans:[{id:"a",name:"Clan A"}]},writes=0;
  const row={id:1,revision:3,created_at:"2026-11-28T09:00:00Z",profile_json:{members:[],locks:[],archives:[]}};
  const sb={from:()=>({select:()=>({eq:()=>({order:()=>({order:()=>({limit:async()=>({data:[row]})})}),eq:()=>({single:async()=>({data:row})})})})}),rpc:async()=>{writes++;return {}}};
  const api=createCloudBackups({sb,context:()=>ctx,ensureSaved:async()=>{},loadProfile:async()=>{},audit:async()=>{},toast:()=>{},confirmAction:async()=>true,askAction:async()=>{ctx={...ctx,epoch:2};return {value:"confirm",input:"Clan A"}}});
  await api.list();document.getElementById("cloudSnapshotSelect").value="1";
  await assert.rejects(api.restore(),/Clan, Berechtigung oder Planstand geändert/);assert.equal(writes,0);
 }finally{global.document=prior.document;global.Option=prior.Option;dom.window.close()}
});
