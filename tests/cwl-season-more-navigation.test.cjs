"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const app=read("cloud-app.html"),sync=read("cloud-sync.mjs"),live=read("cwl-live.mjs");
const loadCore=()=>import(pathToFileURL(path.join(root,"cwl-season-core.mjs")).href);
const loadView=()=>import(pathToFileURL(path.join(root,"cwl-season-view.mjs")).href);
const a={tag:"#2PYL",name:"Alice",townHallLevel:18,attacks:[
 {stars:3,destructionPercentage:100},{stars:2,destructionPercentage:84}]};
const b={tag:"#JQ8P",name:"Bob",townHallLevel:18,attacks:[{stars:3,destructionPercentage:100}]};
const c={tag:"#QQLP",name:"Charly",townHallLevel:17,attacks:[]};
const team=(tag,name,stars,members,badgeUrl)=>({tag,name,stars,members,badgeUrl});
function fixture(){
 const rounds=[
  {day:1,available:true,state:"warEnded",teamSize:15,warTag:"#2PY8",
   clan:team("#CLAN","United Fighters",24,[a,b]),
   opponent:team("#ENEMY1","-21-9-town",18,[])},
  {day:2,available:true,state:"inWar",teamSize:15,warTag:"#2PY0",
   clan:team("#CLAN","United Fighters",2,[{...a,attacks:[{stars:2}]},c]),
   opponent:team("#ENEMY2","AMAZING",1,[])},
  {day:3,available:true,state:"preparation",teamSize:15,warTag:"#2PYQ",
   clan:team("#CLAN","United Fighters",0,[{tag:"#LQ9R",name:"Preparation only",attacks:[]}]),
   opponent:team("#ENEMY3",'<img src=x onerror=alert(1)>',0,[])}
 ];
 for(let day=4;day<=7;day++)rounds.push({day,available:false});
 return {id:"fixture",name:"United Fighters",members:[],archivedMembers:[],cwlLive:{
  season:"2026-11",clanTag:"#CLAN",rounds}};
}
test("season aggregates only verified own wars and never treats preparation as a result",async()=>{
 const {summarizeCwlSeason}=await loadCore(),p=fixture(),original=JSON.stringify(p);
 const s=summarizeCwlSeason(p);
 assert.equal(s.season,"2026-11");
 assert.equal(s.available,3);assert.equal(s.ended,1);assert.equal(s.started,1);
 assert.equal(s.rounds.length,7);
 assert.equal(s.rounds[0].own.stars,24);
 assert.equal(s.rounds[1].own.stars,2);
 assert.equal(s.rounds[2].own.stars,null,"preparation has no final score, even when API reports 0");
 assert.equal(s.rounds[3].available,false,"unknown round is unknown, not a loss");
 assert.equal(s.opponents.length,3);
 const alice=s.players.find(p=>p.name==="Alice");
 assert.equal(alice.days,2);assert.equal(alice.attacks,3);
 assert.equal(alice.stars,7);assert.equal(alice.completedDays,1);
 assert.ok(Math.abs(alice.averageStars-7/3)<0.001);
 assert.equal(s.players.some(p=>p.name==="Preparation only"),false);
 assert.equal(JSON.stringify(p),original,"renderer never mutates plan, attacks or roster");
});
test("missing season and partial API payloads degrade safely",async()=>{
 const {summarizeCwlSeason}=await loadCore();
 assert.equal(summarizeCwlSeason({}),null);
 assert.equal(summarizeCwlSeason({cwlLive:{season:"bad",rounds:[]}}),null);
 const p=fixture();p.cwlLive.rounds[1].available=false;
 const s=summarizeCwlSeason(p);
 assert.equal(s.available,2);assert.equal(s.started,0);assert.equal(s.players.find(p=>p.name==="Charly"),undefined);
});
function domFixture(){
 const dom=new JSDOM('<main><section id="view-cwl-season"><p id="cwlSeasonCaption"></p>'+
   '<button id="cwlSeasonRefresh"></button>'+
   '<div id="cwlSeasonTabs"><button data-season-tab="group">Gruppe</button>'+
   '<button data-season-tab="rounds">Runden</button><button data-season-tab="players">Clan</button></div>'+
   '<div id="cwlSeasonContent"></div></section></main>',{url:"https://example.test"});
 return dom;
}
test("season page navigates three functional read-only tabs and escapes opponent names",async()=>{
 const before=global.document;const dom=domFixture();global.document=dom.window.document;
 try{
  const {createCwlSeasonView}=await loadView();let refreshCount=0;
  const season=createCwlSeasonView({getProfile:fixture,getSnapshot:()=>fixture().cwlLive,
    isConnected:()=>true,refresh:()=>{refreshCount++}});
  season.render();
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Kriegstag 1/);
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/24 : 18/);
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/– : –/);
  dom.window.document.querySelector('[data-season-tab="group"]').click();
  const html=dom.window.document.querySelector("#cwlSeasonContent").innerHTML;
  assert.match(html,/Unsere Gegner/);
  assert.doesNotMatch(html,/<img src=x onerror=alert\(1\)>/);
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/nicht geschätzt/);
  dom.window.document.querySelector('[data-season-tab="players"]').click();
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Alice/);
  assert.doesNotMatch(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Preparation only/);
  dom.window.document.querySelector("#cwlSeasonRefresh").click();
  assert.equal(refreshCount,1);
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
test("unconnected profile shows honest empty state, not fake group standings",async()=>{
 const before=global.document,dom=domFixture();global.document=dom.window.document;
 try{
  const {createCwlSeasonView}=await loadView();
  const season=createCwlSeasonView({getProfile:fixture,getSnapshot:()=>null,isConnected:()=>false});
  season.render();
  assert.equal(dom.window.document.querySelector("#cwlSeasonRefresh").hidden,true);
  assert.match(dom.window.document.querySelector("#cwlSeasonContent").textContent,/Verbinde einen Clan/);
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
test("Mehr contains season and archive as independent views, but not a duplicate archive in Einsätze",()=>{
 assert.doesNotMatch(app,/data-more-action="season"/);
 assert.match(app,/data-more-action="archive"/);
 assert.match(app,/id="view-cwl-season"/);
 assert.match(app,/id="view-archive"/);
 assert.match(app,/const navView=visible==="cwl-season"\?"plan"/);
 assert.match(app,/if\(action==="archive"\)\{showPlannerView\("archive"\)/);
 const summary=app.slice(app.indexOf('<section id="view-summary"'),app.indexOf('<section id="view-more"'));
 assert.doesNotMatch(summary,/id="archiveSection"/);
 assert.equal((app.match(/id="archiveList"/g)||[]).length,1);
 assert.match(app,/CWLSeasonView\?\.render\?\.\(\)/);
 assert.match(sync,/createCwlSeasonView/);
 assert.match(sync,/isViewer:\(\)=>role==="viewer"/);
 assert.match(app,/viewer\?"":\x60<button class="btn small danger delete-archive"/);
 assert.match(live,/getSnapshot:/);
});
test("mobile and desktop season screens stay within width and retain visible tabs",{
 timeout:120000
},async()=>{
 const clean=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,820,1366])for(const theme of ["arena","dark"]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.setContent(clean,{waitUntil:"domcontentloaded"});
    const metrics=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(v=>v.classList.remove("active"));
      const el=document.querySelector("#view-cwl-season");el.classList.add("active");
      document.querySelector("#cwlSeasonContent").innerHTML='<div class="season-rounds">'+
       Array.from({length:7},(_,i)=>'<div class="season-round"><div class="season-round-heading">Runde '+(i+1)+'</div>'+
        '<div class="season-round-match"><span class="season-clan">United Fighters</span>'+
        '<b class="season-score">24 : 18</b><span class="season-clan right">AMAZING</span></div></div>').join('')+'</div>';
      const tabs=[...document.querySelectorAll(".season-segments button")].map(b=>({
       width:b.getBoundingClientRect().width,visible:getComputedStyle(b).display!=="none"}));
      return {scroll:document.documentElement.scrollWidth,viewport:innerWidth,
       tabs,sectionWidth:el.getBoundingClientRect().width};
    },theme);
    assert.ok(metrics.scroll<=width+3,"season overflows "+JSON.stringify({width,theme,metrics}));
    assert.equal(metrics.tabs.length,3);
    assert.ok(metrics.tabs.every(t=>t.visible&&t.width>35));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
