"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","supabase/functions/coc-cwl-status/index.ts"),"utf8");
const start=source.indexOf("async function recoverFinalRound(");
const end=source.indexOf("// Archive only sanitized group",start);
assert.ok(start>=0&&end>start,"Official archived-day recovery must exist");
const recoverySource=source.slice(start,end);
const day=new Date(Date.now()-86400000).toISOString().replaceAll("-","").replaceAll(":","");
const tags=["#2PYL","#G9QL","#8PYL","#P9QL","#J9QL"];
const enemyTags=["#2P8L","#G98L","#8P8L","#P98L","#J98L"];
const member=(tag)=>({tag,name:tag,townHallLevel:18,attacks:[]});
const currentMonth=new Date().toISOString().slice(0,7);
const row={season:currentMonth,day:7,war_tag:"#P9Q0",team_size:5,state:"inWar"};
const war={state:"warEnded",teamSize:5,endTime:day,
 startTime:day,
 clan:{tag:"#2PYL",name:"Our Clan",members:tags.map(member)},
 opponent:{tag:"#G88L",name:"Opposition",members:enemyTags.map(member)}};
const group={season:currentMonth,clanTag:"#2PYL",clans:[],rounds:[]};
const valid=tag=>/^#[0289PYLQGRJCUV]{3,15}$/.test(tag);
const tag=x=>String(x||"").trim().toUpperCase();
const build=(snapshot=war,archive=row)=> {
 const calls=[];
 const from=table=>{
  const query={
   select(x){calls.push([table,"select",x]);return query},
   eq(k,v){calls.push([table,k,v]);return query},
   order(k,v){calls.push([table,"order",k]);return query},
   limit:async()=>({data:archive?[archive]:[],error:null}),
   maybeSingle:async()=>({data:{group_json:group},error:null})
  };
  return query;
 };
 const sandbox={tag,valid,
  getWar:async x=>{calls.push(["official_war",x]);return snapshot},
  safeSide:s=>({...s,badgeUrl:null}),
  Date,console};
 vm.runInNewContext(recoverySource+"; this.recover=recoverFinalRound;",sandbox);
 return {recover:sandbox.recover,calls,ctx:{supabase:{from}}};
};
test("Official warEnded and exact persisted clan tag recover only archived day seven",async()=>{
 const {recover,calls,ctx}=build();
 const out=await recover("tenant-a","#2PYL","secret",ctx);
 assert.equal(out?.active,true);
 assert.equal(out.groupState,"ended");
 assert.equal(out.recoveredFinalRound,true);
 assert.equal(out.rounds.length,7);
 assert.ok(out.rounds.slice(0,6).every(x=>x.available===false));
 assert.equal(out.rounds[6].state,"warEnded");
 assert.equal(out.rounds[6].warTag,"#P9Q0");
 assert.ok(calls.some(x=>x[0]==="cwl_own_lineup_archives"&&x[1]==="clan_id"&&x[2]==="tenant-a"));
 assert.ok(calls.some(x=>x[0]==="cwl_own_lineup_archives"&&x[1]==="day"&&x[2]===7));
 assert.ok(calls.some(x=>x[0]==="official_war"&&x[1]==="#P9Q0"));
});
test("No archived day7, unfinished official war, fake clan, roster gaps or old season: never infer finale",async()=>{
 const wrongTag={...war,clan:{...war.clan,tag:"#G8LL"}};
 const duplicate={...war,clan:{...war.clan,
  members:Array.from({length:5},()=>member("#2PYL"))}};
 const incomplete={...war,opponent:{...war.opponent,members:enemyTags.slice(1).map(member)}};
 const wrongSize={...war,teamSize:15};
 const futureEnd={...war,endTime:new Date(Date.now()+3600000)
  .toISOString().replaceAll("-","").replaceAll(":")};
 const tooOld={...row,season:"2020-01"};
 for(const [current,arch] of [
  [war,null],[{...war,state:"inWar"},row],[wrongTag,row],
  [duplicate,row],[incomplete,row],[wrongSize,row],
  [futureEnd,row],[war,tooOld]
 ]){
  const {recover,ctx}=build(current,arch);
  assert.equal(await recover("tenant-a","#2PYL","secret",ctx),null);
 }
});
test("Recovery never reads other tenants, does not edit plans, does not produce invented attack counts",()=>{
 assert.match(recoverySource,/\.eq\("clan_id",clanId\)\.eq\("day",7\)/);
 assert.match(recoverySource,/war\?\.state!=="warEnded"/);
 assert.match(recoverySource,/!rosterOkay\(own\)\|\|!rosterOkay\(enemy\)/);
 assert.match(recoverySource,/ended>Date\.now\(\)-60000/);
 assert.match(recoverySource,/detailsStatus:"partial"/);
 assert.doesNotMatch(recoverySource,/service_role|\.update\(|\.delete\(/i);
});
