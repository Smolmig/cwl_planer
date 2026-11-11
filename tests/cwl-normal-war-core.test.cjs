"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const load=()=>import("../cwl-normal-war-core.mjs");
const source=fs.readFileSync(path.join(__dirname,"..","cwl-normal-war-core.mjs"),"utf8");
const now=Date.parse("2026-11-11T12:00:00Z");
const war={
 state:"inWar",teamSize:2,attacksPerMember:2,
 startTime:"2026-11-11T10:00:00Z",endTime:"2026-11-12T10:00:00Z",
 clan:{name:"United",stars:5,destructionPercentage:75,attacks:1,
  members:[
   {tag:"#2PYL",name:"Luki",townHallLevel:18,mapPosition:1,attacks:[
    {defenderTag:"#8PYL",stars:3,destructionPercentage:100,order:2,duration:150}]},
   {tag:"#G9QL",name:"Second",townHallLevel:17,attacks:[]}
  ]},
 opponent:{name:"Other",stars:4,destructionPercentage:50,attacks:1,
  members:[
   {tag:"#8PYL",name:"Enemy",townHallLevel:18,attacks:[
    {defenderTag:"#2PYL",stars:2,destructionPercentage:85,order:1,duration:170}]},
   {tag:"#P9QL",name:"Enemy 2",townHallLevel:17,attacks:[]}
  ]}
};
test("Only real currentwar data makes attack progress and highlights",async()=>{
 const {summarizeNormalWar}=await load();
 const m=summarizeNormalWar(war,now);
 assert.equal(m.state,"inWar");assert.equal(m.capacity,4);
 assert.equal(m.ownUsed,1);assert.equal(m.enemyUsed,1);
 assert.equal(m.ownOpen,3);assert.equal(m.enemyOpen,3);
 assert.equal(m.ownThreeStars,1);assert.equal(m.enemyThreeStars,0);
 assert.equal(m.strongest.attackerName,"Luki");assert.equal(m.strongest.stars,3);
 assert.equal(m.strongest.defenderName,"Enemy");
 assert.equal(m.strongest.attackerTH,18);
 assert.equal(m.strongest.defenderTH,18);
 assert.equal(m.ownAverage,100);
 assert.equal(m.enemyAverage,85);
 assert.equal(m.groups[0].stars,5);
 assert.equal(m.groups[1].stars,4);
 assert.equal(m.remaining,22*60*60*1000);
});
test("Preparation and finished wars change headings and never fabricate a missed count",async()=>{
 const {summarizeNormalWar}=await load();
 const prep=summarizeNormalWar({...war,state:"preparation"},now);
 assert.equal(prep.isPreparation,true);
 assert.equal(prep.isBattle,false);
 assert.equal(prep.isFinished,false);
 const ended=summarizeNormalWar({...war,state:"warEnded"},now);
 assert.equal(ended.isFinished,true);
 assert.doesNotMatch(source,/mostHeroic|heroicRanking|missed_count/i);
 assert.match(source,/Never infer missing attacks/);
 assert.equal(summarizeNormalWar({...war,teamSize:0}),null);
 assert.equal(summarizeNormalWar({...war,state:"notInWar"}),null);
});
test("Inconsistent or missing attack fields never become fictional hits, stars or official rankings",async()=>{
 const {summarizeNormalWar}=await load();
 const copy=structuredClone(war);
 copy.clan.members[0].attacks=[
  {stars:3,destructionPercentage:Infinity},
  {stars:-1,destructionPercentage:90},
  {stars:2,destructionPercentage:62}
 ];
 copy.clan.attacks=null;
 const m=summarizeNormalWar(copy,now);
 assert.equal(m.ownUsed,1);
 assert.equal(m.ownThreeStars,0);
 assert.equal(m.ownAverage,62);
 assert.equal(m.strongest.stars,2);
 assert.match(m.strongest.comparison,/keine offizielle Heldentat-Wertung/);
});
