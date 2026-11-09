"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const load=()=>import(pathToFileURL(path.resolve(__dirname,"..","cwl-live.mjs")).href);
const tagTime=ms=>new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,".000Z");

test("Verified postwar CWL miss shows future review without writes or illegal Clash swaps",async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div>'+
  '<div class="plan-overview"></div>'+
  Array.from({length:7},(_,i)=>'<div class="day-card" id="day-card-'+i+
   '"><div class="day-head"></div><div class="lineup"></div></div>').join("")+'</main>',{
    url:"https://example.test",pretendToBeVisual:true
   });
 const previous={document:Object.getOwnPropertyDescriptor(globalThis,"document"),
  navigator:Object.getOwnPropertyDescriptor(globalThis,"navigator"),
  window:Object.getOwnPropertyDescriptor(globalThis,"window")};
 for(const [key,value] of [["document",dom.window.document],
  ["navigator",dom.window.navigator],["window",dom.window]])
  Object.defineProperty(globalThis,key,{value,configurable:true});
 let live=null;
 try{
  const {createCwlLive}=await load();
  const now=Date.now(),season=new Date(now).toISOString().slice(0,7);
  const own=[
   {tag:"#2PYL",name:"Alpha",townHallLevel:18,attacks:[{
    attackerTag:"#2PYL",defenderTag:"#Q2V",stars:3,destructionPercentage:100
   }]},
   {tag:"#JRC",name:"Bravo",townHallLevel:18,attacks:[]}
  ];
  const enemy=[
   {tag:"#Q2V",name:"Opponent One",townHallLevel:18,attacks:[]},
   {tag:"#8PY",name:"Opponent Two",townHallLevel:18,attacks:[]}
  ];
  const round=(day,state,warTag)=>({
   day,available:true,warTag,state,
   startTime:tagTime(now+(day-3)*86400000),
   endTime:tagTime(now+(day-2)*86400000),
   teamSize:2,
   clan:{tag:"#2PQ",name:"United Fighters",members:own},
   opponent:{tag:"#JQV",name:"Opponents",members:enemy}
  });
  const payload={ok:true,active:true,detailsStatus:"complete",
   clanTag:"#2PQ",season,rounds:[
    round(1,"warEnded","#PLQ"),
    round(2,"inWar","#PPQ"),
    ...Array.from({length:5},(_,i)=>({day:i+3,available:false}))
   ]};
  const profile={config:{days:7,slots:2},
   cwlLive:{season,clanTag:"#2PQ",rounds:[]},
   locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
   members:[
    {id:"a",name:"Alpha",playerTag:"#2PYL",statuses:Array(7).fill("auto")},
    {id:"b",name:"Bravo",playerTag:"#JRC",fixed:true,targetDays:4,
     statuses:["auto","auto","must","auto","auto","auto","auto"]}
   ],archivedMembers:[]};
  const plans=[{day:2,lineup:["a","b"],locked:false},
   {day:3,lineup:["a","b"],locked:false}];
  const state={active:true,clanId:"club-one",hasClanTag:true,
   role:"viewer",profile,canApply:false};
  let writeCount=0;
  const original=JSON.stringify({profile,plans});
  live=createCwlLive({
   sb:{functions:{invoke:async()=>({data:payload,error:null})}},
   context:()=>state,notify:()=>{},
   storage:{
    getProfile:()=>profile,getPlannedLineups:()=>plans,
    getPlanningState:()=>({ok:true}),
    rerender:()=>{writeCount++},
    refreshSummary:()=>{},
    newMember:()=>{throw Error("unexpected profile mutation")}
   }
  });
  await live.refresh();
  const review=dom.window.document.querySelector(".cwl-miss-review");
  assert.ok(review,"verified miss should show a per-player review disclosure");
  assert.match(review.textContent,/Bravo/);
  assert.match(review.textContent,/#JRC/);
  assert.match(review.textContent,/Tag 3/);
  assert.match(review.textContent,/MUSS an Tag 3/);
  assert.match(review.textContent,/Geschützt: Tag 2.*Krieg läuft/s);
  assert.match(review.textContent,/Die Vorschau verändert keine Einsätze/);
  assert.equal(review.querySelector("button"),null,"the review must not offer plan-write actions");
  assert.equal(writeCount,0);
  assert.equal(JSON.stringify({profile,plans}),original);
  review.open=true;
  await new Promise(resolve=>setImmediate(resolve));
  live.render();
  assert.equal(dom.window.document.querySelector(".cwl-miss-review")?.open,true,
   "refresh must preserve the review disclosure");
  state.clanId="club-two";
  live.render();
  assert.equal(dom.window.document.querySelector(".cwl-miss-review"),null,
   "another clan cannot inherit the fresh review");
 }finally{
  live?.stop();
  for(const [key,desc] of Object.entries(previous)){
   if(desc)Object.defineProperty(globalThis,key,desc);
   else delete globalThis[key];
  }
  dom.window.close();
 }
});
