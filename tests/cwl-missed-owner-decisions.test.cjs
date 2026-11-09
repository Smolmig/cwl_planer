"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const load=()=>import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261109181000_cwl_missed_owner_decisions.sql"),"utf8");
const tagTime=ms=>new Date(ms).toISOString().replace(/[-:]/g,"").replace(/\.\d{3}Z$/,".000Z");

test("Owner decision SQL is append-only, tenant-scoped and verified by collector evidence",()=>{
 assert.match(sql,/enable row level security/);
 assert.match(sql,/private\.cwl_is_member\(clan_id\)/);
 assert.match(sql,/private\.cwl_is_owner\(clan_id\)/);
 assert.match(sql,/actor_id = \(select auth\.uid\(\)\)/);
 assert.match(sql,/w\.finalized is true/);
 assert.match(sql,/w\.missed_log_complete is true/);
 assert.match(sql,/w\.source='api'/);
 assert.match(sql,/m\.player_tag=cwl_missed_owner_decisions\.player_tag/);
 assert.match(sql,/cp\.profile_json->'cwlLive'->>'season'/);
 assert.match(sql,/r\.value->>'state'='warEnded'/);
 assert.match(sql,/r\.value->>'day'=cwl_missed_owner_decisions\.day::text/);
 assert.match(sql,/grant insert \(clan_id,season,war_key,day,player_tag,decision,note\)/);
 assert.doesNotMatch(sql,/grant (?:all|update|delete) on public\.cwl_missed_owner_decisions to authenticated/i);
 assert.doesNotMatch(sql,/security definer/i);
});
test("Owner-only CWL decision is persisted separately; viewer/editor cannot decide or change plan",async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div>'+
  '<div class="plan-overview"></div>'+
  Array.from({length:7},(_,i)=>'<div class="day-card" id="day-card-'+i+
  '"><div class="day-head"></div><div class="lineup"></div></div>').join("")+'</main>',{
   url:"https://example.test",pretendToBeVisual:true
  });
 const prev={document:Object.getOwnPropertyDescriptor(globalThis,"document"),
  navigator:Object.getOwnPropertyDescriptor(globalThis,"navigator"),
  window:Object.getOwnPropertyDescriptor(globalThis,"window")};
 for(const [key,value] of [["document",dom.window.document],
  ["navigator",dom.window.navigator],["window",dom.window]])
  Object.defineProperty(globalThis,key,{value,configurable:true});
 let live=null;
 try{
  const now=Date.now(),season=new Date(now).toISOString().slice(0,7);
  const ourMembers=[
   {tag:"#2PYL",name:"Alpha",townHallLevel:18,
    attacks:[{attackerTag:"#2PYL",defenderTag:"#Q2V",stars:3,destructionPercentage:100}]},
   {tag:"#JRC",name:"Bravo",townHallLevel:18,attacks:[]}
  ];
  const opponentMembers=[
   {tag:"#Q2V",name:"Enemy one",townHallLevel:18,attacks:[]},
   {tag:"#8PY",name:"Enemy two",townHallLevel:18,attacks:[]}
  ];
  const round=(day,state,warTag)=>({
   day,available:true,state,warTag,teamSize:2,
   startTime:tagTime(now+(day-3)*86400000),
   endTime:tagTime(now+(day-2)*86400000),
   clan:{tag:"#2PQ",name:"Our clan",members:ourMembers},
   opponent:{tag:"#JQV",name:"Enemy",members:opponentMembers}
  });
  const payload={ok:true,active:true,season,clanTag:"#2PQ",
   detailsStatus:"complete",rounds:[
    round(1,"warEnded","#PLQ"),
    round(2,"inWar","#PPQ"),
    ...Array.from({length:5},(_,i)=>({day:i+3,available:false}))
   ]};
  const profile={id:"p",config:{days:7,slots:2},
   cwlLive:{season,clanTag:"#2PQ",rounds:[]},
   locks:Array.from({length:7},()=>({locked:false,lineup:[]})),
   members:[
    {id:"a",name:"Alpha",playerTag:"#2PYL",statuses:Array(7).fill("auto")},
    {id:"b",name:"Bravo",playerTag:"#JRC",statuses:Array(7).fill("auto")}
   ],archivedMembers:[]};
  const plan=[{day:2,lineup:["a","b"],locked:false},
    {day:3,lineup:["a","b"],locked:false}];
  const state={active:true,clanId:"clan-A",hasClanTag:true,
   role:"owner",profile,canApply:false};
  const original=JSON.stringify({profile,plan});
  const log=[],writes=[];
  let confirmed=0,ensured=0,rerendered=0;
  const sb={functions:{invoke:async()=>({data:payload,error:null})},
   from(table){
    assert.equal(table,"cwl_missed_owner_decisions");
    const builder={
     select:()=>builder,eq:()=>builder,order:()=>builder,
     limit:async()=>({data:log.slice().reverse(),error:null}),
     insert:async values=>{
      writes.push(values);
      log.push({id:log.length+1,actor_id:"auth-owner",created_at:new Date().toISOString(),
       ...values});
      return {error:null};
     }
    };
    return builder;
   }};
  const {createCwlLive}=await load();
  live=createCwlLive({
   sb,context:()=>state,ensureCloudSaved:async()=>{ensured++;},
   storage:{
    getProfile:()=>profile,getPlannedLineups:()=>plan,
    getPlanningState:()=>({ok:true}),refreshSummary:()=>{},
    rerender:()=>{rerendered++;},
    askAction:async()=>{confirmed++;return {value:"confirm",input:"Arbeitsreise"}},
    newMember:()=>{throw Error("must not mutate members")}
   },notify:()=>{}
  });
  await live.refresh();
  const doc=dom.window.document;
  assert.equal(doc.querySelectorAll(".cwl-miss-owner-action").length,3);
  assert.equal(writes.length,0);
  doc.querySelector(".cwl-miss-owner-action[data-action='excused']").click();
  for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(confirmed,1);
  assert.equal(ensured,1);
  assert.equal(writes.length,1);
  assert.deepEqual(writes[0],{
    clan_id:"clan-A",season,war_key:"cwl:#PLQ",day:1,
    player_tag:"#JRC",decision:"excused",note:"Arbeitsreise"
  });
  assert.equal(rerendered,0);
  assert.equal(JSON.stringify({profile,plan}),original,
   "Decision cannot change plan, locks, stars or member fields");
  assert.match(doc.querySelector(".cwl-miss-review").textContent,/Entschuldigung akzeptiert/);
  assert.match(doc.querySelector(".cwl-miss-review").textContent,/Arbeitsreise/);
  state.role="editor";live.render();
  assert.equal(doc.querySelectorAll(".cwl-miss-owner-action").length,0);
  assert.match(doc.querySelector(".cwl-miss-review").textContent,/Entschuldigung akzeptiert/);
  state.role="viewer";live.render();
  assert.equal(doc.querySelectorAll(".cwl-miss-owner-action").length,0);
  state.clanId="clan-B";live.render();
  assert.equal(doc.querySelector(".cwl-miss-review"),null,
   "another tenant must not see another clan's decision");
 }finally{
  live?.stop();
  for(const [key,desc] of Object.entries(prev)){
   if(desc)Object.defineProperty(globalThis,key,desc);
   else delete globalThis[key];
  }
  dom.window.close();
 }
});
