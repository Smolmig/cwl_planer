"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=fs.readFileSync(path.join(__dirname,"..","cloud-sync.mjs"),"utf8");
const getStart=src.indexOf("async function getRoster(");
const getEnd=src.indexOf("function rosterPlanningState(",getStart);
const applyStart=src.indexOf("function rosterPlanningState(",getEnd);
const applyEnd=src.indexOf("async function audit(){",applyStart);
assert.ok(getStart>0&&getEnd>getStart&&applyEnd>applyStart);
const getCode=src.slice(getStart,getEnd);
const rosterCode=src.slice(applyStart,applyEnd);
const member=(id)=>({id,name:id,playerTag:"#AAA",participating:true,
 fixed:false,priority:0,statuses:Array(7).fill("auto"),townHall:17});
function makeHarness(){
 const pA={id:"profile-a",members:[member("A")]},pB={id:"profile-b",members:[member("B")]};
 let active=pA,resolveRemote=null,apiCalls=[];
 const elements=new Map();
 const element=id=>{if(!elements.has(id))elements.set(id,{hidden:false,textContent:"",
  classList:{add(){},remove(){}},scrollIntoView(){},replaceChildren(){},append(){}});return elements.get(id)};
 const context={
  clanId:"clan-a",accountEpoch:1,revision:4,rosterRequestSerial:0,
  changedSerial:null,blocked:false,rosterAutoBusy:false,saving:false,role:"owner",
  roster:null,rosterDiff:null,
  storage:{getProfile:()=>active,getPlannedLineups:()=>[],toast:()=>{}},
  sb:{functions:{invoke:async(_,options)=>{apiCalls.push(options.body.clanId);
   return await new Promise(resolve=>{resolveRemote=resolve})}}},
  ensureSaved:async()=>{},resetRoster:()=>{
    context.rosterRequestSerial++;context.roster=null;context.rosterDiff=null;
  },
  $:element,text:(id,v)=>{element(id).textContent=v},toggle:()=>{},
  normalizeTag:x=>String(x||"").trim().toUpperCase(),
  document:{createElement:()=>({textContent:"",style:{},append(){}})},
  console:{warn(){}},Date
 };
 const get=vm.runInNewContext(getCode+"\ngetRoster",context);
 const nextTick=()=>new Promise(resolve=>setImmediate(resolve));
 return {context,pA,pB,get,nextTick,
  switchProfile(){active=pB;context.clanId="clan-b";context.revision=1;
   context.rosterRequestSerial++;context.roster=null;context.rosterDiff=null;},
  reply(data){assert.equal(typeof resolveRemote,"function","API request pending");resolveRemote({data,error:null});},
  apiCalls};
}
const valid=(name="API Name")=>({ok:true,members:[{tag:"#AAA",name,townHallLevel:19}]});
test("late Clan A API response is discarded after Clan B selected",async()=>{
 const x=makeHarness(),original=JSON.stringify(x.pB);
 const operation=x.get({automatic:false});
 await x.nextTick();
 assert.deepEqual(x.apiCalls,["clan-a"]);
 x.switchProfile();
 x.reply(valid("Old clan member"));
 await operation;
 assert.equal(x.context.rosterDiff,null);
 assert.equal(x.context.roster,null);
 assert.equal(JSON.stringify(x.pB),original);
});
test("late API response is discarded if shared profile revision changed",async()=>{
 const x=makeHarness(),operation=x.get({automatic:false});
 await x.nextTick();
 x.context.revision=5;
 x.reply(valid());
 await operation;
 assert.equal(x.context.rosterDiff,null);
 assert.equal(x.context.roster,null);
});
test("in a stable Clan the comparison carries immutable request context",async()=>{
 const x=makeHarness(),operation=x.get({automatic:false});
 await x.nextTick();
 x.reply(valid());
 await operation;
 assert.equal(x.context.rosterDiff.request.clanId,"clan-a");
 assert.equal(x.context.rosterDiff.request.revision,4);
 assert.equal(x.context.rosterDiff.request.profileId,"profile-a");
 assert.equal(x.context.rosterDiff.request.accountEpoch,1);
 assert.equal(x.context.rosterDiff.request.requestSerial,1);
 assert.equal(x.context.roster[0].name,"API Name");
});
test("stale manual comparison is rejected before mutating any player",async()=>{
 const a=member("A"),p={id:"profile-a",members:[a]};let rerenders=0;
 const ctx={
  clanId:"clan-a",accountEpoch:1,revision:5,rosterRequestSerial:2,
  blocked:false,changedSerial:null,role:"owner",
  roster:[{tag:"#AAA",name:"Replaced",townHallLevel:19}],
  rosterDiff:{critical:[],departed:[],initialImport:false,
   request:{clanId:"clan-a",accountEpoch:1,revision:4,profileId:"profile-a",requestSerial:2}},
  storage:{getProfile:()=>p,rerender:()=>{rerenders++}},
  ensureSaved:async()=>{},document:{querySelectorAll:()=>[]},
  normalizeTag:x=>String(x||"").toUpperCase()
 };
 const apply=vm.runInNewContext(rosterCode+"\napplyRoster",ctx);
 await assert.rejects(apply(),/seit dem Vergleich geändert/);
 assert.equal(a.name,"A");
 assert.equal(a.townHall,17);
 assert.equal(rerenders,0);
});
test("concurrent revision change while a confirmation dialog is open cannot overwrite",async()=>{
 const a=member("A"),p={id:"profile-a",members:[a]};
 let approve,rerenders=0;
 const ctx={
  clanId:"clan-a",accountEpoch:1,revision:4,rosterRequestSerial:2,
  blocked:false,changedSerial:null,role:"owner",
  roster:[{tag:"#AAA",name:"Replaced",townHallLevel:19}],
  rosterDiff:{critical:[],departed:[],initialImport:false,unusuallyManyDeparted:true,
   request:{clanId:"clan-a",accountEpoch:1,revision:4,profileId:"profile-a",requestSerial:2}},
  storage:{getProfile:()=>p,confirmAction:async()=>new Promise(resolve=>{approve=resolve}),
   rerender:()=>{rerenders++}},
  ensureSaved:async()=>{},document:{querySelectorAll:()=>[]},
  normalizeTag:x=>String(x||"").toUpperCase()
 };
 const apply=vm.runInNewContext(rosterCode+"\napplyRoster",ctx);
 const operation=apply();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(typeof approve,"function");
 ctx.revision=6;
 approve(true);
 await assert.rejects(operation,/seit dem Vergleich geändert/);
 assert.equal(a.name,"A");
 assert.equal(rerenders,0);
});
