"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const core=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live.mjs")).href);
const player=(id,tag)=>({id,name:"Spieler "+id,playerTag:tag,townHall:19,participating:true,
 statuses:Array(7).fill("auto")});
test("preparation UI: swaps, expandable opponent names, safe HTML, and read-only preview",{timeout:30000},async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div><div class="plan-overview"></div>'+
  '<article id="day-card-0"><div class="day-head">Tag 1</div></article></main>');
 const oldDocument=global.document;global.document=dom.window.document;
 const priorNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 let edits=0,oldOpponentOpen=false;
 try{
  const a=player("A","#2PYL"),b=player("B","#2PYQ"),c=player("C","#2PYV");
  const season=new Date().toISOString().slice(0,7);
  const round={day:1,available:true,warTag:"#2PYR",state:"preparation",teamSize:2,
   clan:{tag:"#2PYG",name:"Eigener Clan",members:[
    {tag:a.playerTag,name:a.name,townHallLevel:19,attacks:[]},
    {tag:b.playerTag,name:b.name,townHallLevel:18,attacks:[]}
   ]},
   opponent:{tag:"#2PYJ",name:"Gegner",members:[
    {tag:"#2PYU",name:"<img src=x onerror=alert(1)>",townHallLevel:20},
    {tag:"#2PYY",name:"Enemy Two",townHallLevel:19}
   ]}};
  const profile={id:"sample",config:{slots:2,days:1},members:[a,b,c],
   archivedMembers:[],cwlLive:{season,clanTag:"#2PYG",rounds:[round]}};
  const plan={day:1,lineup:["A","C"],warnings:[],locked:false};
  let activeProfile=profile;
  const {createCwlLive}=await core();
  let apiData={ok:true,active:true,clanTag:"#2PYG",season,rounds:[round]};
  const live=createCwlLive({
    sb:{functions:{invoke:async()=>({data:apiData})}},
    context:()=>({active:true,clanId:"sample-id",hasClanTag:true,role:"viewer",profile:activeProfile}),
    storage:{getPlannedLineups:()=>[plan],getPlanningState:()=>({ok:true}),
      getProfile:()=>activeProfile,rerender:()=>{edits++},newMember:()=>{edits++;throw Error("write")}},
    notify:()=>{edits++}
  });
  live.render();
  const doc=dom.window.document;
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/Gespeicherter Stand/);
  assert.doesNotMatch(doc.querySelector(".cwl-prep-review").textContent,/Wechsel nötig|stimmt überein/);
  await live.refresh(); // fresh API response, no Cloud mutation (viewer role)
  const review=doc.querySelector(".cwl-prep-review");
  assert.ok(review,"comparison must appear inside the war card");
  assert.match(review.textContent,/1 Wechsel nötig/);
  assert.match(review.querySelector(".cwl-prep-group.remove").textContent,/Spieler B/);
  assert.match(review.querySelector(".cwl-prep-group.add").textContent,/Spieler C/);
  assert.equal(review.querySelector(".cwl-prep-group.remove .cwl-roster-tag").textContent,"#2PYQ");
  assert.equal(review.querySelector(".cwl-prep-group.add .cwl-roster-tag").textContent,"#2PYV");
  assert.match(doc.querySelector(".cwl-live-day > .statusline").textContent,/Aufstellung vorläufig/);
  assert.doesNotMatch(doc.querySelector(".cwl-live-day > .statusline").textContent,/Angriffe erfasst/);
  assert.equal(doc.querySelectorAll(".cwl-opponent-details .cwl-roster-member").length,2);
  assert.ok(doc.querySelector(".cwl-opponent-details").textContent.includes("<img src=x onerror=alert(1)>"),
    "hostile API name must display as text");
  assert.equal(doc.querySelectorAll("img[src=x]").length,0,"API name must not inject an image");
  const opponents=doc.querySelector(".cwl-opponent-details");
  opponents.open=true;opponents.dispatchEvent(new dom.window.Event("toggle"));
  live.render();
  assert.equal(doc.querySelector(".cwl-opponent-details").open,true,
    "opponent list should stay open after plan re-render");
  plan.lineup=["A","B"];
  live.render();
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/Aufstellung stimmt überein/);
  assert.equal(doc.querySelectorAll(".cwl-prep-group").length,0);
  assert.equal(edits,0,"preview must not save or change Cloud data");

  // A successful *partial* refresh must not make older, saved war data look fresh.
  apiData={ok:true,active:true,clanTag:"#2PYG",season,detailsStatus:"partial",
    rounds:[{day:1,available:false}]};
  await live.refresh();
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/Gespeicherter Stand/);
  assert.doesNotMatch(doc.querySelector(".cwl-prep-review").textContent,/stimmt überein/);
  apiData={ok:true,active:true,clanTag:"#2PYG",season,detailsStatus:"complete",rounds:[round]};
  await live.refresh();
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/stimmt überein/);

  round.clan.members.pop();
  live.render();
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/noch nicht vollständig/);
  assert.doesNotMatch(doc.querySelector(".cwl-prep-review").textContent,/stimmt überein/);
  assert.equal(edits,0);
  round.clan.members.push({tag:b.playerTag,name:b.name,townHallLevel:18});
  round.opponent.members[0].tag="#INVALID";
  live.render();
  assert.equal(doc.querySelectorAll(".cwl-opponent-details .cwl-roster-member").length,0);
  assert.match(doc.querySelector(".cwl-opponent-details").textContent,/noch nicht vollständig verfügbar/);
  assert.equal(edits,0);
  // Cloud Realtime installs a new profile object: it needs its own live read.
  round.clan.members.push({tag:b.playerTag,name:b.name,townHallLevel:18});
  activeProfile={...profile};
  live.render();
  assert.match(doc.querySelector(".cwl-prep-review").textContent,/Gespeicherter Stand/);
  assert.equal(edits,0);
  live.stop();
 }finally{
  if(oldDocument===undefined)delete global.document;else global.document=oldDocument;
  if(priorNavigator)Object.defineProperty(globalThis,"navigator",priorNavigator);
  else delete globalThis.navigator;
  dom.window.close();
 }
});
