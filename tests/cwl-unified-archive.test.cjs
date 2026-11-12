"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const path=require("node:path"),{pathToFileURL}=require("node:url"),{JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const load=async filename=>import(pathToFileURL(path.join(root,filename)).href);
const TAGS=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const group=(season="2026-11",size=15)=>({
 season,clanTag:TAGS[0],
 clans:TAGS.map((tag,i)=>({tag,name:i===0?"United Fighters":"Clan "+i})),
 rounds:Array.from({length:7},(_,d)=>({day:d+1,matches:Array.from({length:4},(_,i)=>({
  available:true,warTag:"#2PY"+(["L","Q","R","G"][i]),state:"warEnded",teamSize:size,
  clan:{tag:TAGS[2*i],stars:25,destructionPercentage:80,attacks:size},
  opponent:{tag:TAGS[2*i+1],stars:20,destructionPercentage:70,attacks:size}
 }))}))
});
const plan=(id="plan-a",season="2026-11",clanTag=TAGS[0])=>({
 id,label:"November 2026",sourceSeason:season,createdAt:1794410000000,days:7,
 playedCount:7,slots:15,complete:true,players:[{id:"p",name:"Testspieler",playerTag:"#2PYL"}],
 lineups:[{day:1,lineup:["p"],snapshots:{p:{name:"Testspieler"}}}],
 cwlLive:{season,clanTag,warCount:7,rounds:[{
  day:1,available:true,warTag:"#2PYL",state:"warEnded",teamSize:15,
  clan:{tag:clanTag,name:"United Fighters",stars:25,members:[{
   tag:"#2PYL",name:"Testspieler",townHallLevel:18,attacks:[{stars:3}]
  }]},
  opponent:{tag:TAGS[1],name:"Gegner",stars:20,members:[]}
 }]}
});
const dom=()=>new JSDOM('<section id="view-archive" class="active">'+
 '<button id="cwlGroupArchiveRefresh"></button><div id="cwlGroupArchiveContent"></div>'+
 '</section>',{url:"https://example.test"});
function fakeDb(groups,rosters=[]){
 return {from(table){return {
  select(){return this},eq(){return this},order(){return this},
  async limit(){return {data:table==="cwl_group_archives"?groups:rosters,error:null}}
 }}};
}
test("official Clash group and archived plan are one entry only for an exact season and clan",async()=>{
 const {unifyCwlArchiveSeasons,archivedPlanIdentity}=await load("cwl-unified-archive-core.mjs");
 const rows=[{season:"2026-11",group_json:group(),updated_at:"2026-11-11T22:00:00Z"}];
 const p=plan();
 assert.deepEqual(archivedPlanIdentity(p),{season:"2026-11",clanTag:TAGS[0]});
 const entries=unifyCwlArchiveSeasons(rows,[p],TAGS[0]);
 assert.equal(entries.length,1);
 assert.equal(entries[0].plans[0],p);
 assert.equal(entries[0].group.complete,true);
 assert.equal(entries[0].group.ended,28);
 const other=plan("other","2026-11",TAGS[2]);
 assert.equal(unifyCwlArchiveSeasons(rows,[p,other],TAGS[0]).length,2,
  "never attach another Clash tag to our group");
 const manual={...plan("manual"),sourceSeason:null,cwlLive:null,label:"November 2026"};
 assert.equal(archivedPlanIdentity(manual),null);
 assert.equal(unifyCwlArchiveSeasons(rows,[p,manual],TAGS[0]).length,2,
  "matching the month label is not identity");
 const importWithoutSnapshot={...plan("imported"),cwlLive:null};
 assert.equal(unifyCwlArchiveSeasons(rows,[p,importWithoutSnapshot],TAGS[0]).length,2);
});
test("historic six-clan five-war groups remain distinct from old manual five-day plans",async()=>{
 const {unifyCwlArchiveSeasons}=await load("cwl-unified-archive-core.mjs");
 const g=group("2026-10");
 g.clans=g.clans.slice(0,6);
 g.rounds=g.rounds.slice(0,5).map(r=>({...r,matches:r.matches.slice(0,3)}));
 const official=unifyCwlArchiveSeasons([{season:"2026-10",group_json:g}],[],TAGS[0]);
 assert.equal(official.length,1);
 assert.equal(official[0].group.expected,15);
 const manual={id:"manual-5",label:"Oktober 2026",days:5,playedCount:5,lineups:[]};
 assert.equal(unifyCwlArchiveSeasons([{season:"2026-10",group_json:g}],
  [manual],TAGS[0]).length,2);
});
test("one unified 28/28 season card exposes all four views and its stored deployments",async()=>{
 const original=global.document,windowBefore=global.window,d=dom();
 global.document=d.window.document;global.window=d.window;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const archive=plan();
  const rows=[{season:"2026-11",group_json:group(),updated_at:"2026-11-11T22:00:00Z"}];
  const view=createCwlGroupArchiveView({
   sb:fakeDb(rows),getClanId:()=>"c",getClanTag:()=>TAGS[0],
   isConnected:()=>true,getProfile:()=>({archives:[archive]}),
   isViewer:()=>false,onDeletePlan:async()=>false
  });
  await view.open();
  const host=d.window.document.querySelector("#cwlGroupArchiveContent");
  assert.equal(host.querySelectorAll(".season-archive-item").length,1);
  assert.match(host.textContent,/28\/28 Gruppenspiele/);
  assert.match(host.textContent,/7\/7 eigene Tage/);
  const season=host.querySelector(".season-archive-item");season.open=true;
  assert.match(host.textContent,/Kriegstag 1/);
  const select=key=>host.querySelector('[data-unified-archive-tab="'+key+'"]').click();
  select("group");assert.match(host.textContent,/Platz/);
  assert.match(host.textContent,/Alle Begegnungen ansehen/);
  select("players");assert.match(host.textContent,/Testspieler/);
  select("deployments");
  assert.match(host.textContent,/Einsatzhäufigkeit/);
  assert.match(host.textContent,/Testspieler/);
  assert.equal(host.querySelectorAll('[data-unified-delete-id]').length,1);
  await view.open(true);
  assert.equal(host.querySelectorAll(".season-archive-item").length,1);
  assert.equal(host.querySelector('[data-unified-archive-tab="deployments"]').getAttribute("aria-selected"),"true");
  assert.equal(host.querySelector(".season-archive-item").open,true,"expanded season survives reload");
 }finally{global.document=original;global.window=windowBefore;d.window.close()}
});
test("manual standalone plan is available while logged out, with no network call",async()=>{
 const original=global.document,d=dom();global.document=d.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  const manual={id:"m1",label:"Sommerliga",createdAt:200,days:5,playedCount:5,slots:5,
    complete:true,players:[{id:"p",name:"Manuell"}],
    lineups:[{day:1,lineup:["p"],snapshots:{p:{name:"Manuell"}}}]};
  const sb={from(){throw Error("should never hit Supabase offline")}};
  const view=createCwlGroupArchiveView({
   sb,getClanId:()=>null,isConnected:()=>false,
   getProfile:()=>({archives:[manual]})
  });
  await view.open();
  const host=d.window.document.querySelector("#cwlGroupArchiveContent");
  assert.equal(host.querySelectorAll(".season-archive-item").length,1);
  assert.match(host.textContent,/Sommerliga/);
  assert.equal(d.window.document.querySelector("#cwlGroupArchiveRefresh").hidden,true);
  host.querySelector('[data-unified-archive-tab="deployments"]').click();
  assert.match(host.textContent,/Manuell/);
 }finally{global.document=original;d.window.close()}
});
test("viewer cannot delete a stored plan, owner must use the supplied confirmation workflow",async()=>{
 const original=global.document,d=dom();global.document=d.window.document;
 try{
  const {createCwlGroupArchiveView}=await load("cwl-group-archive.mjs");
  let viewer=true,deleted=0;
  const view=createCwlGroupArchiveView({
   sb:fakeDb([]),getClanId:()=>null,isConnected:()=>false,
   isViewer:()=>viewer,getProfile:()=>({archives:[plan()]}),
   onDeletePlan:async id=>{assert.equal(id,"plan-a");deleted++;return false}
  });
  await view.open();
  const host=d.window.document.querySelector("#cwlGroupArchiveContent");
  host.querySelector('[data-unified-archive-tab="deployments"]').click();
  assert.equal(host.querySelectorAll('[data-unified-delete-id]').length,0);
  viewer=false;view.render();
  host.querySelector('[data-unified-delete-id]').click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(deleted,1);
 }finally{global.document=original;d.window.close()}
});
