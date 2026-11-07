"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const core=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live-core.mjs")).href);
const liveModule=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live.mjs")).href);
const tag={A:"#2PYL",B:"#2PYQ",C:"#2PYV"};
const person=k=>({tag:tag[k],name:"Spieler "+k,townHallLevel:18,attacks:[]});
const round=(day,state,ids)=>({
 day,available:true,warTag:day===1?"#2PYR":"#2PYJ",state,teamSize:2,
 clan:{tag:"#2PYG",name:"United Fighters",members:ids.map(person)},
 opponent:{tag:"#2PYY",name:"Gegner",members:[person("A"),person("B")]}
});
test("Completed changes are derived from consecutive confirmed Clash rosters, not pending planner deltas",async()=>{
 const {compareConsecutiveCwlLineups,formatClashSwapText}=await core();
 const yesterday=round(1,"inWar",["A","B"]);
 const today=round(2,"preparation",["B","C"]);
 const before=JSON.stringify([yesterday,today]);
 const changes=compareConsecutiveCwlLineups(yesterday,today);
 assert.equal(changes.status,"changes");
 assert.deepEqual(changes.toRemove.map(p=>p.name),["Spieler A"]);
 assert.deepEqual(changes.toAdd.map(p=>p.name),["Spieler C"]);
 assert.equal(formatClashSwapText(2,changes),"CWL Tag 2\n🔴 Raus: Spieler A\n🟢 Rein: @Spieler C");
 assert.equal(JSON.stringify([yesterday,today]),before,"comparison must be read-only");
 assert.equal(formatClashSwapText(2,{
   status:"changes",toRemove:[{name:"Ausstieg"}],
   toAdd:[{name:"@Raphtor"},{name:"Luki"}]
 }),null,"unpaired changes must not produce misleading text");
 assert.equal(formatClashSwapText(2,{
   status:"changes",toRemove:[{name:"Ausstieg"},{name:"Aus zwei"}],
   toAdd:[{name:"@Raphtor"},{name:"Luki"}]
 }),"CWL Tag 2\n🔴 Raus: Ausstieg, Aus zwei\n🟢 Rein: @Raphtor, @Luki");

 const same=round(2,"preparation",["A","B"]);
 assert.equal(compareConsecutiveCwlLineups(yesterday,same).status,"match");
 assert.equal(compareConsecutiveCwlLineups(yesterday,{...today,day:3}),null);
 assert.equal(compareConsecutiveCwlLineups({...yesterday,available:false},today),null);
 assert.equal(compareConsecutiveCwlLineups({...yesterday,teamSize:3},today),null);
 assert.equal(compareConsecutiveCwlLineups({...yesterday,state:"preparation"},today),null);
 assert.equal(compareConsecutiveCwlLineups({...yesterday,clan:{...yesterday.clan,members:[person("A"),person("A")]}},today),null);
 assert.equal(compareConsecutiveCwlLineups({...yesterday,clan:{...yesterday.clan,members:[{...person("A"),name:""},person("B")]}},today),null);
});

test("Matching Clash preparation still provides yesterday's copyable swaps in the same review",async()=>{
 const markup='<main id="view-plan"><div class="plan-actions"></div><div class="plan-overview"></div>'+
  '<div id="day-card-0"><div class="day-head">Tag 1</div><div class="lineup">'+
  '<div class="player-chip" data-player-tag="#2PYL">A</div><div class="player-chip" data-player-tag="#2PYQ">B</div></div></div>'+
  '<div id="day-card-1"><div class="day-head">Tag 2</div><div class="lineup">'+
  '<div class="player-chip" data-player-tag="#2PYQ">B</div><div class="player-chip" data-player-tag="#2PYV">C</div></div></div></main>';
 const dom=new JSDOM(markup);
 const prevDocument=global.document;
 const prevNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 global.document=dom.window.document;
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 try{
  const yesterday=round(1,"inWar",["A","B"]);
  const today=round(2,"preparation",["B","C"]);
  const season=new Date().toISOString().slice(0,7);
  const members=["A","B","C"].map(id=>({
   id,name:"Spieler "+id,playerTag:tag[id],townHall:18,participating:true,
   statuses:["auto","auto"]
  }));
  const profile={id:"test",config:{slots:2,days:2},members,archivedMembers:[],
   cwlLive:{season,clanTag:"#2PYG",rounds:[yesterday,today]}};
  const plans=[{day:1,lineup:["A","B"],locked:true},
   {day:2,lineup:["B","C"],locked:false,warnings:[]}];
  let copied="",changed=0;
  const {createCwlLive}=await liveModule();
  const live=createCwlLive({
   sb:{functions:{invoke:async()=>({data:{ok:true,active:true,clanTag:"#2PYG",season,
    detailsStatus:"complete",rounds:[yesterday,today]}})}},
   context:()=>({active:true,clanId:"some-clan",hasClanTag:true,role:"viewer",profile}),
   storage:{getPlannedLineups:()=>plans,getPlanningState:()=>({ok:true}),
    getProfile:()=>profile,copyText:(s)=>{copied=s},rerender:()=>changed++,
    newMember:()=>{changed++;throw Error("viewer write")}},
   notify:()=>{}
  });
  await live.refresh();
  const box=dom.window.document.querySelector("#day-card-1 .cwl-prep-review");
  assert.match(box.textContent,/Aufstellung stimmt mit Clash überein/);
  assert.match(box.textContent,/Seit Tag 1: 1 raus · 1 rein/);
  const button=box.querySelector(".cwl-copy-live-swaps");
  assert.ok(button,"copy button must survive after switches already match");
  assert.match(button.textContent,/Wechseltext kopieren/);
  button.click();
  assert.equal(copied,"CWL Tag 2\n🔴 Raus: Spieler A\n🟢 Rein: @Spieler C");
  live.render();
  assert.ok(dom.window.document.querySelector("#day-card-1 .cwl-copy-live-swaps"));
  assert.equal(changed,0);
  live.stop();
 }finally{
  if(prevDocument===undefined)delete global.document;else global.document=prevDocument;
  if(prevNavigator)Object.defineProperty(globalThis,"navigator",prevNavigator);
  else delete globalThis.navigator;
  dom.window.close();
 }
});
