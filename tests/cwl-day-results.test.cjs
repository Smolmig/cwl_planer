"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const load=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live.mjs")).href);
test("finished and complete CWL war yields exact per-day star results without fabricating misses",async()=>{
 const dom=new JSDOM("<main id='view-plan'><div class='plan-actions'></div><div class='plan-overview'></div></main>");
 const old=global.document;global.document=dom.window.document;
 try{
  const round={day:1,available:true,warTag:"#2PYL",state:"warEnded",teamSize:2,
   clan:{tag:"#2PYG",name:"Test",members:[
    {tag:"#2PYQ",name:"A",attacks:[{attackerTag:"#2PYQ",defenderTag:"#2PYU",stars:3,destructionPercentage:100}]},
    {tag:"#2PYV",name:"B",attacks:[]}
   ]},
   opponent:{tag:"#2PYJ",members:[]}};
  const profile={id:"test",config:{days:7,slots:2},members:[],archivedMembers:[],
   cwlLive:{season:new Date().toISOString().slice(0,7),clanTag:"#2PYG",rounds:[round]}};
  const {createCwlLive}=await load();
  const live=createCwlLive({sb:{},context:()=>({active:true,clanId:"test",hasClanTag:true,profile}),
   storage:{getProfile:()=>profile,getPlannedLineups:()=>[]},notify:()=>{}});
  const got=live.getPlayedAttackResults();
  assert.deepEqual(got[1]["#2PYQ"],{stars:3,percent:100,missed:false});
  assert.deepEqual(got[1]["#2PYV"],{missed:true});
  round.clan.members.pop();
  assert.deepEqual(live.getPlayedAttackResults(),{},"incomplete roster cannot imply missed attacks");
  round.clan.members.push({tag:"#2PYV",name:"B",attacks:[]});
  round.state="inWar";
  assert.deepEqual(live.getPlayedAttackResults(),{},"current war cannot be marked as played");
 }finally{
  if(old===undefined)delete global.document;else global.document=old;
  dom.window.close();
 }
});