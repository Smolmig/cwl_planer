"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const {planCwl}=require("../cwl-planning-core.js");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const load=()=>import(pathToFileURL(path.join(__dirname,"..","cwl-live.mjs")).href);
const when=ms=>new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,".000Z");

test("Owner sees and confirms a single Clash-preparation pause only after audited review_pause",async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div><div class="plan-overview"></div>'+
  Array.from({length:3},(_,i)=>'<div class="day-card" id="day-card-'+i+
   '"><div class="day-head"></div><div class="lineup"></div></div>').join("")+'</main>',{
   url:"https://example.test",pretendToBeVisual:true
  });
 const prior=Object.fromEntries(["window","document","navigator"].map(key=>
  [key,Object.getOwnPropertyDescriptor(globalThis,key)]));
 for(const [key,value] of [["window",dom.window],["document",dom.window.document],
  ["navigator",dom.window.navigator]])
  Object.defineProperty(globalThis,key,{configurable:true,value});
 let live=null;
 try{
  const now=Date.now(),season=new Date(now).toISOString().slice(0,7);
  const members=[
   {id:"a",name:"Alpha",playerTag:"#2PYL",fixed:true,participating:true,
    statuses:Array(7).fill("auto"),targetDays:null},
   {id:"b",name:"Bravo",playerTag:"#JRC",fixed:false,participating:true,
    statuses:Array(7).fill("auto"),targetDays:null,rotationWeight:"preferred"},
   {id:"c",name:"Charlie",playerTag:"#CPR",fixed:false,participating:true,
    statuses:Array(7).fill("auto"),targetDays:null,rotationWeight:"less"}
  ];
  const roster=tags=>tags.map(tag=>({
   tag,name:tag,townHallLevel:18,
   attacks:tag==="#2PYL"||tag==="#CPR"?
    [{attackerTag:tag,defenderTag:"#Q2V",stars:3,destructionPercentage:100}]:[]
  }));
  const round=(day,state,warTag,team,start)=>({
   day,available:true,state,warTag,teamSize:2,
   startTime:when(start),endTime:when(start+86400000),
   clan:{tag:"#2PQ",members:roster(team)},
   opponent:{tag:"#JQV",members:roster(["#Q2V","#8PY"])}
  });
  const rounds=[
   round(1,"warEnded","#PLQ",["#2PYL","#JRC"],now-2*86400000),
   round(2,"inWar","#PPQ",["#2PYL","#CPR"],now-23*3600000-30*60000),
   round(3,"preparation","#PYL",["#2PYL","#JRC"],now+4*3600000)
  ];
  // A fresh last-hour warning on day 2 must not conceal day 1's confirmed miss.
  rounds[1].clan.members[1].attacks=[];
  const profile={id:"p",config:{days:3,slots:2},
   locks:[{locked:true,lineup:["a","b"]},{locked:false,lineup:[]},{locked:false,lineup:[]}],
   members,archivedMembers:[],cwlLive:{season,clanTag:"#2PQ",rounds}};
  const snapshot={ok:true,active:true,detailsStatus:"complete",season,
   clanTag:"#2PQ",rounds};
  const liveLocks=()=>[profile.locks[0],
   {locked:true,lineup:["a","c"],source:"coc-roster-fixed-readonly"},
   profile.locks[2]];
  const planned=()=>planCwl({...profile.config,members:profile.members,
   archivedMembers:[],locks:liveLocks()}).dayPlans;
  dom.window.CWLPlanningCore={planCwl};
  const state={active:true,clanId:"clan-one",role:"owner",
   hasClanTag:true,profile,canApply:false};
  const decisions=[{id:1,season,war_key:"cwl:#PLQ",
   day:1,target_day:null,player_tag:"#JRC",decision:"review_pause",
   note:"Wiederholt versäumt",created_at:new Date(now).toISOString()}];
  let approval=true,writeCount=0,confirmationCount=0,confirmationText="";
  const written=[];
  const sb={functions:{invoke:async()=>({data:snapshot,error:null})},
   from(name){
    assert.equal(name,"cwl_missed_owner_decisions");
    const q={select:()=>q,eq:()=>q,order:()=>q,
     limit:async()=>({data:approval?decisions:[],error:null})};
    return q;
   }};
  const old=JSON.stringify(profile);
  const {createCwlLive}=await load();
  live=createCwlLive({sb,context:()=>state,
   storage:{
    getProfile:()=>profile,getPlannedLineups:planned,
    getPlanningState:()=>({ok:true}),
    rerender:()=>{writeCount++},refreshSummary:()=>{},
    askAction:async args=>{confirmationCount++;confirmationText=args.message;return {value:"confirm",input:"Test"}},
    newMember:()=>{throw Error("unexpected member mutation")}
   },
   notify:()=>{},ensureCloudSaved:async()=>{},
   applyVerifiedPause:async value=>{
    written.push(value);return {saved:true,revision:2};
   }});
  await live.refresh();
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll(".cwl-attack-attention[data-kind='open']").length,1,
   "last-hour warning remains visible");
  assert.equal(doc.querySelectorAll(".cwl-miss-apply").length,1,
   "older confirmed miss remains actionable while a newer warning is active");
  assert.match(doc.querySelector(".cwl-miss-apply").textContent,/Tag 3/);
  doc.querySelector(".cwl-miss-apply").click();
  for(let i=0;i<12;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(confirmationCount,1);
  assert.match(confirmationText,/Einsätze gesamt im Solver/);
  assert.match(confirmationText,/Bravo: 2 → 1/);
  assert.match(confirmationText,/Charlie: 1 → 2/);
  assert.match(confirmationText,/Rotationsspanne: 1 → 1/);
  assert.equal(written.length,1);
  assert.equal(written[0].preview.day,3);
  assert.equal(written[0].preview.draft.members[1].statuses[2],"out");
  assert.deepEqual(written[0].preview.changed[0].out,["Bravo"]);
  assert.equal(written[0].note,"Test");
  assert.equal(writeCount,0);
  assert.equal(JSON.stringify(profile),old,"UI must not mutate profile");
  state.role="editor";live.render();
  assert.equal(doc.querySelectorAll(".cwl-miss-apply").length,0);
  state.role="viewer";live.render();
  assert.equal(doc.querySelectorAll(".cwl-miss-apply").length,0);
  state.role="owner";approval=false;await live.refresh();
  assert.equal(doc.querySelectorAll(".cwl-miss-apply").length,0,
   "without an existing review_pause audit, no apply action");
  // When the day-2 attack also becomes a verified missed attack, both days
  // must remain browsable without a second list of cards or mutation.
  rounds[1].state="warEnded";
  rounds[1].endTime=when(now-120000);
  approval=true;await live.refresh();
  const days=[...doc.querySelectorAll(".cwl-miss-day-select")];
  assert.deepEqual(days.map(b=>b.textContent),["Tag 2","Tag 1"]);
  assert.match(doc.querySelector(".cwl-miss-review summary").textContent,/Tag 2/);
  days.find(b=>b.dataset.day==="1").click();
  assert.match(doc.querySelector(".cwl-miss-review summary").textContent,/Tag 1/);
  assert.equal(doc.querySelector(".cwl-miss-day-select[data-day='1']").getAttribute("aria-pressed"),"true");
  assert.equal(doc.querySelectorAll(".cwl-miss-apply").length,1);
 }finally{
  live?.stop();
  for(const [key,desc] of Object.entries(prior)){
   if(desc)Object.defineProperty(globalThis,key,desc);
   else delete globalThis[key];
  }
  dom.window.close();
 }
});
