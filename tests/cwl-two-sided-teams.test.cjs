"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const moduleSource=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const coreSource=fs.readFileSync(path.join(root,"cwl-live-core.mjs"),"utf8");
const synthetic=()=>({
 day:1,available:true,warTag:"#2PYR",state:"inWar",teamSize:2,
 clan:{tag:"#2PYG",name:"United Fighters",stars:3,destructionPercentage:80,
  members:[
   {tag:"#2PYL",name:"Our One",townHallLevel:18,
    attacks:[{stars:3,destructionPercentage:100,defenderTag:"#2PYU"}]},
   {tag:"#2PYQ",name:"Our Two",townHallLevel:18,attacks:[]}
  ]},
 opponent:{tag:"#2PYJ",name:"Enemy Clan",stars:3,destructionPercentage:70,
  members:[
   {tag:"#2PYU",name:"Enemy One",townHallLevel:19,
    attacks:[{stars:2,destructionPercentage:70,defenderTag:"#2PYL"}]},
   {tag:"#2PYY",name:"Enemy Two",townHallLevel:18,
    attacks:[{stars:1,destructionPercentage:70,defenderTag:"#2PYQ"}]}
  ]}
});
test("both CWL teams display attack counts, individual stars and target side without any plan writes",{timeout:30000},async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div>'+
  '<div class="plan-overview"></div><article id="day-card-0"><div class="day-head"></div></article></main>');
 const priorDocument=Object.getOwnPropertyDescriptor(globalThis,"document");
 const priorNavigator=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 Object.defineProperty(globalThis,"document",{value:dom.window.document,configurable:true});
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 try{
  const season=new Date().toISOString().slice(0,7),round=synthetic();
  const profile={id:"fixture",config:{slots:2,days:1},members:[],archivedMembers:[]};
  let saves=0;
  const {createCwlLive}=await import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
  const live=createCwlLive({
   sb:{functions:{invoke:async()=>({data:{ok:true,active:true,season,clanTag:"#2PYG",rounds:[round]}})}},
   context:()=>({active:true,clanId:"fixture",hasClanTag:true,role:"viewer",profile}),
   storage:{getProfile:()=>profile,getPlanningState:()=>({ok:true}),
    getPlannedLineups:()=>[],rerender:()=>{saves++}},
   notify:()=>{saves++}
  });
  await live.refresh();
  const doc=dom.window.document;
  const own=doc.querySelector(".cwl-live-team-panel.own");
  const enemy=doc.querySelector(".cwl-live-team-panel.opponent");
  assert.ok(own&&enemy);
  assert.match(own.querySelector(".cwl-live-team-head").textContent,/1\/2 Angriffe/);
  assert.match(enemy.querySelector(".cwl-live-team-head").textContent,/2\/2 Angriffe/);
  assert.match(doc.querySelector(".cwl-live-day > .statusline").textContent,/Unsere Angriffe: 1\/2 Angriffe · Gegner: 2\/2 Angriffe/);
  const ownRows=own.querySelectorAll(".cwl-live-attack");
  const enemyRows=enemy.querySelectorAll(".cwl-live-attack");
  assert.equal(ownRows.length,2);
  assert.equal(enemyRows.length,2);
  assert.match(ownRows[0].textContent,/★★★/);
  assert.match(ownRows[0].textContent,/Enemy One/);
  assert.match(enemyRows[0].textContent,/★★☆/);
  assert.match(enemyRows[0].textContent,/Our One/);
  assert.match(enemyRows[1].textContent,/★☆☆/);
  assert.match(enemyRows[1].textContent,/Our Two/);
  assert.match(enemy.querySelector("summary").textContent,/Gegnerische Spieler und Angriffe anzeigen/);
  assert.equal(enemy.querySelector(".cwl-live-ths").textContent.includes("RH 19"),true);
  const opponentDetails=enemy.querySelector(".cwl-opponent-details");
  opponentDetails.open=true;opponentDetails.dispatchEvent(new dom.window.Event("toggle"));
  live.render();
  assert.equal(doc.querySelector(".cwl-opponent-details").open,true,"enemy list stays open on refresh");
  assert.equal(saves,0,"live war display cannot write to a viewer Cloud profile");
  live.stop();
 }finally{
  if(priorDocument)Object.defineProperty(globalThis,"document",priorDocument);
  else delete globalThis.document;
  if(priorNavigator)Object.defineProperty(globalThis,"navigator",priorNavigator);
  else delete globalThis.navigator;
  dom.window.close();
 }
});
test("incomplete enemy war roster never fabricates opponent attack counts or stars",{timeout:30000},async()=>{
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div>'+
  '<div class="plan-overview"></div><div id="day-card-0"><div class="day-head"></div></div></main>');
 const old=Object.getOwnPropertyDescriptor(globalThis,"document");
 const oldNav=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 Object.defineProperty(globalThis,"document",{value:dom.window.document,configurable:true});
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 try{
  const season=new Date().toISOString().slice(0,7),round=synthetic();
  round.opponent.members.pop();
  const profile={id:"profile",config:{slots:2,days:1},members:[]};
  const {createCwlLive}=await import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
  const live=createCwlLive({
   sb:{functions:{invoke:async()=>({data:{ok:true,active:true,season,clanTag:"#2PYG",rounds:[round]}})}},
   context:()=>({active:true,clanId:"fixture",hasClanTag:true,role:"viewer",profile}),
   storage:{getProfile:()=>profile,getPlanningState:()=>({ok:true}),getPlannedLineups:()=>[]},
   notify:()=>{throw Error("Viewer write") }
  });
  await live.refresh();
  const opponent=dom.window.document.querySelector(".cwl-live-team-panel.opponent");
  assert.match(opponent.querySelector(".cwl-live-team-head").textContent,/Angriffsstand nicht verfügbar/);
  assert.equal(opponent.querySelectorAll(".cwl-live-attack").length,0);
  assert.match(opponent.textContent,/noch nicht vollständig verfügbar/);
  live.stop();
 }finally{
  if(old)Object.defineProperty(globalThis,"document",old);else delete globalThis.document;
  if(oldNav)Object.defineProperty(globalThis,"navigator",oldNav);else delete globalThis.navigator;
  dom.window.close();
 }
});
test("mobile panels stack and desktop panels are side by side with explicit tappable roster controls",{timeout:90000},async()=>{
 const body=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,1366]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(body,{waitUntil:"domcontentloaded"});
    const res=await page.evaluate(()=>{
     const area=document.createElement("div");
     area.className="cwl-live-team-grid";
     area.innerHTML='<div class="cwl-live-team-panel own"><div class="cwl-live-team-head"><b>Unser Team</b></div><details class="cwl-live-details"><summary>Unsere Spieler ansehen</summary></details></div>'+
       '<div class="cwl-live-team-panel opponent"><div class="cwl-live-team-head"><b>Gegnerteam</b></div><details class="cwl-opponent-details"><summary>Gegnerische Spieler ansehen</summary></details></div>';
     document.getElementById("view-plan").appendChild(area);
     document.getElementById("view-plan").style.display="block";
     const own=area.children[0].getBoundingClientRect();
     const other=area.children[1].getBoundingClientRect();
     const a=area.querySelector(".cwl-live-details summary").getBoundingClientRect();
     const b=area.querySelector(".cwl-opponent-details summary").getBoundingClientRect();
     return {own:{top:own.top,left:own.left,right:own.right},
       other:{top:other.top,left:other.left,right:other.right},
       buttons:[a.height,b.height],overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.ok(res.overflow<=2,"no horizontal overflow at "+width+": "+JSON.stringify(res));
    assert.ok(res.buttons.every(x=>x>=44),"both roster controls must be obvious tap targets");
    if(width<=800)assert.ok(res.other.top>res.own.top,"mobile stacks the teams");
    else assert.ok(res.other.left>res.own.right-2,"desktop own left and opponent right");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
