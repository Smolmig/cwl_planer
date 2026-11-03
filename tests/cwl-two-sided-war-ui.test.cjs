"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const loadCore=()=>import(pathToFileURL(path.join(root,"cwl-live-core.mjs")).href);
const loadLive=()=>import(pathToFileURL(path.join(root,"cwl-live.mjs")).href);
const srcTag=id=>"#"+id;
const mkMember=(tag,name,th,attacks=[])=>({tag,name,townHallLevel:th,attacks});
function example(state="inWar"){
 const own=[
  mkMember(srcTag("2PYL"),"Eigener 1",18,[{attackerTag:srcTag("2PYL"),defenderTag:srcTag("Q2V"),stars:3,destructionPercentage:100}]),
  mkMember(srcTag("JRC"),"Eigener 2",17,[])
 ];
 const enemy=[
  mkMember(srcTag("Q2V"),"<img src=x onerror=alert(1)>",19,[{attackerTag:srcTag("Q2V"),defenderTag:srcTag("JRC"),stars:2,destructionPercentage:77}]),
  mkMember(srcTag("8PY"),"Gegner 2",18,[])
 ];
 return {day:1,available:true,warTag:"#PLQ",teamSize:2,state,
  startTime:"20261103T202400.000Z",
  clan:{tag:"#2PQ",name:"Unsere",stars:4,destructionPercentage:78,members:own},
  opponent:{tag:"#JQV",name:"Gegner",stars:2,destructionPercentage:72,members:enemy}};
}
async function renderOne(state="inWar"){
 const dom=new JSDOM('<main id="view-plan"><div class="plan-actions"></div><div class="plan-overview"></div>'+
  '<article class="day-card" id="day-card-0"><div class="day-head">Tag 1</div></article></main>');
 const oldDocument=global.document,oldNav=Object.getOwnPropertyDescriptor(globalThis,"navigator");
 global.document=dom.window.document;
 Object.defineProperty(globalThis,"navigator",{value:dom.window.navigator,configurable:true});
 let edits=0;
 try{
  const {createCwlLive}=await loadLive(),round=example(state);
  const profile={id:"t",config:{slots:2,days:1},members:[],archivedMembers:[],
   cwlLive:{season:new Date().toISOString().slice(0,7),clanTag:"#2PQ",rounds:[round]}};
  const live=createCwlLive({
   sb:{functions:{invoke:async()=>({data:{ok:true,active:true,season:profile.cwlLive.season,
    clanTag:"#2PQ",rounds:[round]}})}},
   context:()=>({active:true,clanId:"t",hasClanTag:true,role:"viewer",profile}),
   storage:{getProfile:()=>profile,getPlannedLineups:()=>[],
    getPlanningState:()=>({ok:true}),rerender:()=>{edits++},
    newMember:()=>{throw Error("No Cloud writes allowed")}},
   notify:()=>{edits++}
  });
  live.render();
  const doc=dom.window.document,section=doc.querySelector(".cwl-live-day");
  assert.ok(section,"live war card must be rendered");
  const snapshot={
   html:section.outerHTML,
   ownSummary:section.querySelector(".cwl-live-details>summary").textContent,
   enemySummary:section.querySelector(".cwl-opponent-details>summary").textContent,
   ownResults:section.querySelector(".cwl-live-details").textContent,
   enemyResults:section.querySelector(".cwl-opponent-details").textContent,
   ownStars:[...section.querySelectorAll(".cwl-live-details .cwl-live-stars")].map(x=>x.textContent),
   enemyStars:[...section.querySelectorAll(".cwl-opponent-details .cwl-live-stars")].map(x=>x.textContent),
   score:section.querySelector(".cwl-live-score").textContent,
   edits,
   section,dom,live
  };
  return snapshot;
 }finally{
  if(oldDocument===undefined)delete global.document;else global.document=oldDocument;
  if(oldNav)Object.defineProperty(globalThis,"navigator",oldNav);else delete globalThis.navigator;
 }
}
test("both sides show attack count, official war stars, opponent attack stars and targets without writes",async()=>{
 const data=await renderOne();
 try{
  assert.match(data.ownSummary,/Unser Team/);
  assert.match(data.enemySummary,/Gegnerteam/);
  assert.match(data.ownSummary,/1\/2 Angriffe · 4 ★/);
  assert.match(data.enemySummary,/1\/2 Angriffe · 2 ★/);
  assert.match(data.score,/4:2/);
  assert.deepEqual(data.ownStars,["★★★","☆☆☆"]);
  assert.deepEqual(data.enemyStars,["★★☆","☆☆☆"]);
  assert.match(data.enemyResults,/77 %/);
  assert.match(data.enemyResults,/Eigener 2/,"opponent attack target is a player from our clan");
  assert.match(data.ownResults,/100 %/);
  assert.equal(data.section.querySelectorAll(".cwl-live-team-details").length,2);
  assert.ok(data.section.querySelector(".cwl-live-team-own")?.compareDocumentPosition(
   data.section.querySelector(".cwl-live-team-enemy"))&4,"own controls precede opponent controls");
  assert.equal(data.section.querySelectorAll("img[src=x]").length,0,"enemy names are escaped");
  assert.match(data.enemyResults,/<img src=x onerror=alert\(1\)>/);
  assert.equal(data.edits,0,"read-only UI cannot save or alter a Cloud plan");
 }finally{data.dom.window.close()}
});
test("preparation day lists both lineups but no invented attack progress",async()=>{
 const data=await renderOne("preparation");
 try{
  assert.match(data.ownSummary,/2 Spieler · vorläufig/);
  assert.match(data.enemySummary,/2 Spieler · vorläufig/);
  assert.doesNotMatch(data.ownSummary+data.enemySummary,/Angriffe|★/);
  assert.equal(data.section.querySelectorAll(".cwl-live-team-own .cwl-roster-member").length,2);
  assert.equal(data.section.querySelectorAll(".cwl-live-team-enemy .cwl-roster-member").length,2);
  assert.equal(data.section.querySelectorAll(".cwl-live-attack").length,0);
 }finally{data.dom.window.close()}
});
test("attack mapper safely handles both sides, pending players and unknown targets",async()=>{
 const {cwlAttackRows,sanitizeSnapshot}=await loadCore();
 const round=sanitizeSnapshot({ok:true,active:true,clanTag:"#2PQ",season:"2026-11",
  rounds:[example(),...Array.from({length:6},(_,i)=>({day:i+2,available:false}))]}).rounds[0];
 const enemyRows=cwlAttackRows(round,"opponent");
 assert.equal(enemyRows[0].player.name,"Gegner 2","live war prioritizes unplayed players");
 assert.equal(enemyRows[0].attack,null);
 assert.equal(enemyRows[1].attack.stars,2);
 assert.equal(enemyRows[1].target.name,"Eigener 2");
 assert.equal(cwlAttackRows(round)[1].target.name,"<img src=x onerror=alert(1)>");
 round.opponent.members[0].attacks.push({attackerTag:"#Q2V",defenderTag:"#JQL",stars:1,destructionPercentage:51});
 const rows=cwlAttackRows(round,"opponent");
 assert.equal(rows.length,3);
 assert.equal(rows[2].target,null,"unknown defender remains unknown, never invented");
});
test("desktop shows two aligned team cards; mobile stacks them without clipped controls",{
 timeout:120000
},async()=>{
 const data=await renderOne();
 const clean=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["dark","arena"]){
   for(const width of [320,390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(clean,{waitUntil:"domcontentloaded"});
     const info=await page.evaluate(({theme,markup})=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.body.innerHTML='<main id="view-plan" class="view active"><article class="day-card">'+markup+'</article></main>';
      const own=document.querySelector(".cwl-live-team-own");
      const enemy=document.querySelector(".cwl-live-team-enemy");
      own.open=true;enemy.open=true;
      const a=own.getBoundingClientRect(),b=enemy.getBoundingClientRect();
      const btnA=own.querySelector("summary").getBoundingClientRect();
      const btnB=enemy.querySelector("summary").getBoundingClientRect();
      return {a:{left:a.left,right:a.right,top:a.top,width:a.width},
       b:{left:b.left,right:b.right,top:b.top,width:b.width},
       buttonWidths:[btnA.width,btnB.width],
       viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       firstCards:document.querySelectorAll(".cwl-live-team-details").length,
       enemyStars:enemy.querySelectorAll(".cwl-live-stars").length};
     },{theme,markup:data.html});
     assert.equal(info.firstCards,2);
     assert.equal(info.enemyStars,2);
     assert.ok(info.scrollWidth<=width+3,"horizontal overflow: "+JSON.stringify({theme,width,info}));
     assert.ok(info.buttonWidths.every(n=>n>100),"summary controls remain obvious");
     if(width>800){
      assert.ok(info.a.right<info.b.left+4,"own team should be left of opponent");
      assert.ok(Math.abs(info.a.top-info.b.top)<4,"team sections share the same row");
     }else{
      assert.ok(info.b.top>info.a.top,"mobile teams stack in reading order");
      assert.ok(info.a.right<=width+2&&info.b.right<=width+2);
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close();data.dom.window.close()}
});
