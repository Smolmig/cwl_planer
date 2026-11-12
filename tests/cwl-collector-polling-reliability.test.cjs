"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const src=fs.readFileSync(path.join(__dirname,"../supabase/functions/coc-stats-collector/index.ts"),"utf8");
const scope=src.slice(src.indexOf("async function retrieveGames("),src.indexOf("async function archiveForAppClan("));
const diagnostic=src.slice(src.indexOf("function apiDiagnostic("),src.indexOf("function adminSettings("));
const own="#PYL";
const tags=["#8PYL","#QPYL","#2PYL","#UPYL"];
const normalize=value=>String(value||"").toUpperCase();
const makeWar=(our=false,state="warEnded")=>({
 state,clan:{tag:our?own:"#2PYL"},opponent:{tag:"#QPYL"}
});
function harness(handler){
 const calls=[];
 const env={
  Date,Set,Map,encodeURIComponent,MAX_TAGS:32,ERROR:{
   api:"clash_api_unavailable",invalid:"war_data_incomplete"
  },
  tag:normalize,validTag:v=>/^#[0289PYLQGRJCUV]{3,15}$/.test(v),
  hasCapturedCwlRound:()=>false,
  // The polling fixture isolates old war-fetch logic; new season evidence is
  // exercised independently with official 6/8-clan groups in its own suite.
  verifiedLeagueObservation:()=>null,
  buildWarSnapshot:(raw,clanTag,{warTag})=>raw.state==="preparation"?null:{
   war:{war_key:"cwl:"+warTag,war_type:"cwl",started_at:"2026-11-06T10:00:00Z"},attacks:[]
  },
  game:async (url,key)=>{calls.push(url);return handler(url,key)}
 };
 const run=vm.runInNewContext(diagnostic+scope+";retrieveGames",env);
 return {run:()=>run(own,"test-key",Date.now()+100000,new Set()),calls};
}
test("CWL polling stops after own match; unrelated games are not persisted",async()=>{
 const h=harness(async url=>{
  if(url.includes("leaguegroup"))return {rounds:[{warTags:tags}]};
  if(url.includes("currentwar"))return null;
  if(url.endsWith(encodeURIComponent(tags[0])))return makeWar(false);
  if(url.endsWith(encodeURIComponent(tags[1])))return makeWar(true);
  throw Error("Unneeded requests must never happen");
 });
 const data=await h.run();
 assert.equal(data.snaps.length,1);
 assert.equal(data.snaps[0].war.war_key,"cwl:"+tags[1]);
 assert.equal(data.notes.length,0);
 assert.equal(h.calls.filter(x=>x.includes("/clanwarleagues/wars/")).length,2);
});
test("Unrelated inaccessible game does not cause collector failure after finding ours",async()=>{
 const h=harness(async url=>{
  if(url.includes("leaguegroup"))return {rounds:[{warTags:tags}]};
  if(url.includes("currentwar"))return null;
  if(url.endsWith(encodeURIComponent(tags[0])))
   throw Error("clash_api_unavailable:http_429");
  if(url.endsWith(encodeURIComponent(tags[1])))return makeWar(true);
  throw Error("Should not query further tags");
 });
 const data=await h.run();
 assert.equal(data.snaps.length,1);
 assert.equal(data.notes.length,0,"Foreign failure is not a failed own round");
});
test("Unresolved own CWL round reports sanitized stage and upstream response class",async()=>{
 const h=harness(async url=>{
  if(url.includes("leaguegroup"))return {rounds:[{warTags:tags}]};
  if(url.includes("currentwar"))return null;
  if(url.endsWith(encodeURIComponent(tags[0])))
    throw Error("clash_api_unavailable:http_429");
  return makeWar(false);
 });
 const data=await h.run();
 assert.equal(data.snaps.length,0);
 assert.equal(data.notes.length,1);
 assert.equal(data.notes[0],"clash_api_unavailable:leaguewar:http_429");
});
test("Inaccessible current-war endpoint reports failure without dropping a valid league snapshot",async()=>{
 const h=harness(async url=>{
  if(url.includes("leaguegroup"))return {rounds:[{warTags:[tags[0]]}]};
  if(url.includes("currentwar"))throw Error("clash_api_unavailable:timeout");
  return makeWar(true);
 });
 const data=await h.run();
 assert.equal(data.snaps.length,1);
 assert.equal(data.notes[0],"clash_api_unavailable:currentwar:timeout");
});
test("Untrusted exception messages never leak into the tenant-facing status",()=>{
 const code=vm.runInNewContext(diagnostic+";apiDiagnostic",{
  ERROR:{api:"clash_api_unavailable",invalid:"war_data_incomplete"}
 });
 assert.equal(code(Error("API token=secret #CLANTAG"),"leaguewar"),
   "clash_api_unavailable:leaguewar:invalid_war_data");
 assert.equal(code(Error("clash_api_unavailable:http_503"),"leaguegroup"),
   "clash_api_unavailable:leaguegroup:http_503");
});
test("Upstream 429 retries and produces classified failure without exposing response content",async()=>{
 const code=src.slice(src.indexOf("async function game(path,apiKey)"),src.indexOf("function adminSettings()"));
 let count=0;
 const env={GAME:"https://example.invalid/v1",ERROR:{
  api:"clash_api_unavailable",invalid:"war_data_incomplete"
 },delay:async()=>{},AbortSignal:{timeout:()=>null},
 fetch:async()=>{count++;return {status:429,ok:false,body:"should-never-leak"}}
 };
 const run=vm.runInNewContext(code+";game",env);
 await assert.rejects(run("/clans/hidden/currentwar","secret"),/clash_api_unavailable:http_429/);
 assert.equal(count,2);
});
