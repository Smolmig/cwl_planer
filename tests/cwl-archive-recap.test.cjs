"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const {pathToFileURL}=require("node:url");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const moduleUrl=name=>pathToFileURL(path.join(ROOT,name)).href;
const TAGS=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const archived=()=>({id:"old-a",label:"November 2026",sourceSeason:"2026-11",days:7,
 cwlLive:{season:"2026-11",clanTag:TAGS[0],warCount:7,rounds:[{
  day:1,available:true,warTag:"#2PYY",state:"warEnded",teamSize:15,
  clan:{tag:TAGS[0],name:"United Fighters",stars:35,members:[{
    tag:TAGS[2],name:"Testspieler",townHallLevel:18,attacks:[{stars:3}]
  }]},
  opponent:{tag:TAGS[1],name:"Gegner",stars:31,members:[]}
 }]},lineups:[],players:[]});
const group=()=>({season:"2026-11",clanTag:TAGS[0],
 clans:TAGS.map((tag,i)=>({tag,name:i===0?"United Fighters":"Gegner "+i})),
 rounds:[{day:1,matches:[{available:true,state:"warEnded",warTag:"#2PYY",teamSize:15,
  clan:{tag:TAGS[0],name:"United Fighters",stars:35,destructionPercentage:95},
  opponent:{tag:TAGS[1],name:"Gegner",stars:31,destructionPercentage:80}}]}]
});
test("historical CWL recap reuses read-only Kriegs-/Gruppen-/Spieler views and keeps own completed score",async()=>{
 const dom=new JSDOM('<div id="archiveRecap"></div>',{url:"https://example.test"});
 const before=global.document;global.document=dom.window.document;
 try{
  const {createArchivedCwlRecapView}=await import(moduleUrl("cwl-archive-recap.mjs"));
  let requests=0;
  const sb={from(t){assert.equal(t,"cwl_group_archives");requests++;return{
   select(){return this},eq(){return this},
   async maybeSingle(){return {data:{season:"2026-11",group_json:group()},error:null}}
  }}};
  const view=createArchivedCwlRecapView({sb,getClanId:()=>"clan-a"});
  await view.open(archived());
  const host=dom.window.document.getElementById("archiveRecap");
  assert.equal(requests,1);
  assert.match(host.textContent,/Saisonrückblick/);
  assert.match(host.textContent,/Kriegstag 1/);
  assert.match(host.textContent,/35 : 31/);
  assert.match(host.textContent,/1\/7 eigene Kriege mit Endstand/);
  host.querySelector('[data-archive-recap-tab="group"]').click();
  assert.match(host.textContent,/Gruppenstand/);
  assert.match(host.textContent,/Platz/);
  host.querySelector('[data-archive-recap-tab="players"]').click();
  assert.match(host.textContent,/Testspieler/);
  assert.match(host.textContent,/3/);
  view.close();assert.equal(host.innerHTML,"");
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
test("archived manual plan remains usable without historical league API data",async()=>{
 const dom=new JSDOM('<div id="archiveRecap"></div>',{url:"https://example.test"});
 const before=global.document;global.document=dom.window.document;
 try{
  const {createArchivedCwlRecapView}=await import(moduleUrl("cwl-archive-recap.mjs"));
  let requests=0;
  const sb={from(){requests++;throw Error("must not access DB")}};
  const view=createArchivedCwlRecapView({sb,getClanId:()=>null});
  await view.open({id:"manual",label:"August 2025",days:5,lineups:[]});
  const host=dom.window.document.getElementById("archiveRecap");
  assert.match(host.textContent,/Aufstellungen/);
  assert.equal(requests,0);
  host.querySelector('[data-archive-recap-tab="players"]').click();
  assert.match(host.textContent,/keine bestätigten einzelnen Spielerangriffe/);
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
