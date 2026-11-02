"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const root=path.resolve(__dirname,"..");
const fn=fs.readFileSync(path.join(root,"supabase/functions/coc-cwl-status/index.ts"),"utf8");
const ui=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const start=fn.indexOf("const CORS =");
const end=fn.indexOf("const handler=withSupabase",start);
assert.ok(start>0&&end>start);
const code=fn.slice(start,end);
const ownTag="#QJCP", warTag="#2PQL";
const group={state:"inWar",season:"2026-11",clans:[{tag:ownTag,name:"Own"}],
 rounds:[{warTags:[warTag,"#8PQL"]},...Array.from({length:6},()=>({warTags:["#0"]}))]};
function makeContext(){
 const warnings=[];
 const context=vm.createContext({
   console:{warn:(...args)=>warnings.push(args),log(){}},
   AbortSignal,setTimeout:callback=>callback(),fetch:async()=>{throw Error("mock fetch unconfigured");}
 });
 vm.runInContext(code,context);
 return {context,warnings,loadStatus:vm.runInContext("loadStatus",context),
  getGame:vm.runInContext("getGame",context)};
}
test("Successful CWL league group is not discarded when every war detail fails",async()=>{
 const {context,loadStatus,warnings}=makeContext();
 context.getGame=async path=>{
   if(path.endsWith("/leaguegroup"))return group;
   throw Error("supercell_status_403");
 };
 const result=await loadStatus(ownTag,"mock");
 assert.equal(result.ok,true);
 assert.equal(result.active,true);
 assert.equal(result.season,"2026-11");
 assert.equal(result.detailsStatus,"unavailable");
 assert.equal(result.rounds.length,7);
 assert.equal(result.rounds.every(r=>r.available===false),true);
 assert.equal(warnings.length,1);
 assert.equal(warnings[0][1].codes.supercell_status_403,2);
});
test("CWL partial war result preserves available round and identifies partial status",async()=>{
 const {context,loadStatus}=makeContext();
 context.getGame=async path=>{
   if(path.endsWith("/leaguegroup"))return group;
   if(path.endsWith(encodeURIComponent(warTag)))return {
     state:"inWar",teamSize:15,startTime:"20261103T000000Z",endTime:"20261104T000000Z",
     clan:{tag:ownTag,name:"Own",members:[]},
     opponent:{tag:"#8PQL",name:"Other",members:[]}
   };
   throw Error("supercell_status_429");
 };
 const result=await loadStatus(ownTag,"mock");
 assert.equal(result.detailsStatus,"partial");
 assert.equal(result.rounds[0].available,true);
 assert.equal(result.rounds[0].clan.tag,ownTag);
 assert.equal(result.rounds[1].available,false);
});
test("A failure of the league-group endpoint is not misreported as an active CWL",async()=>{
 const {context,loadStatus}=makeContext();
 context.getGame=async()=>{throw Error("supercell_status_403")};
 await assert.rejects(()=>loadStatus(ownTag,"mock"),/supercell_status_403/);
});
test("Upstream 5xx requests are retried but permission errors are not",async()=>{
 const {context,getGame}=makeContext();
 let calls=0;
 context.fetch=async()=>{calls++;return calls===1?{status:502,ok:false}:{status:200,ok:true,json:async()=>({state:"ok"})}};
 assert.equal((await getGame("/test","mock")).state,"ok");
 assert.equal(calls,2);
 calls=0;
 context.fetch=async()=>{calls++;return {status:403,ok:false}};
 await assert.rejects(()=>getGame("/test","mock"),/supercell_status_403/);
 assert.equal(calls,1);
});
test("Frontend preserves previous same-season war details during partial responses",()=>{
 assert.match(ui,/previous\?\.season===data\.season/);
 assert.match(ui,/previous\.rounds\[i\]\?\.available/);
 assert.match(ui,/Kriegsdetails derzeit nicht abrufbar/);
 assert.match(ui,/data\.detailsStatus==="partial"/);
});
