"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const css=read("cloud-app.html").match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css,"Cloud CSS must exist");
const modules=["cwl-stats.mjs","cwl-stats-core.mjs","cwl-live-core.mjs","cwl-comparable-form.mjs"];
async function fixtureMain(){
 const wars=Array.from({length:40},(_,i)=>({
  clan_id:"clan-a",war_key:"normal:"+i,war_type:"normal",
  started_at:new Date(Date.UTC(2026,9,31-i)).toISOString(),
  team_size:15,opponent_name:"Gegner "+i,source:"import",finalized:false,
  roster_tags:null,missed_log_complete:false
 }));
 const attacks=wars.flatMap(w=>Array.from({length:25},(_,i)=>({
  war_key:w.war_key,attacker_tag:"#2PYL",attacker_name:"Spieler Alpha",
  attacker_th:18,defender_name:"Gegner",defender_th:18,stars:i%4===0?2:3,
  destruction:90,attack_order:i+1
 })));
 window.__clan="clan-a";
 window.__dbReads=0;
 const sb={from(name){
  const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
  return {
   select(){return this},eq(){return this},order(){return this},
   async limit(n){window.__dbReads++;return {data:data.slice(0,n),error:null}},
   async range(start,end){window.__dbReads++;return {data:data.slice(start,end+1),error:null}}
  };
 }};
 window.__stats=createCloudStats({sb,context:()=>({
  active:true,clanId:window.__clan,role:"owner",memberTags:[],clanTag:"#2PYL"
 }),notify:()=>{},confirmAction:async()=>false});
 await window.__stats.load();
 window.__ready=true;
}
function startServer(){
 return http.createServer((req,res)=>{
  const file=new URL(req.url,"http://localhost").pathname.slice(1);
  if(file==="fixture"){
   res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
   res.end('<!doctype html><html lang="de" data-theme="arena"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="cloud-mode"><section id="view-stats" class="view active"><div id="statsSummary" class="stats-kpis"></div><span id="statsFeedback"></span><nav id="statsSectionTabs"><button data-stats-section="history">History</button><button data-stats-section="players">Players</button></nav><input id="statsSearch" type="search"><select id="statsSort"><option value="hitRate">Hit</option></select><div class="stats-player-table"><div id="statsRows"></div></div><div id="statsWarHistory"></div></section><script type="module" src="./fixture.mjs"></script></body></html>');
   return;
  }
  if(file==="fixture.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});
   res.end('import {createCloudStats} from "./cwl-stats.mjs";\n('+fixtureMain.toString()+')();');
   return;
  }
  if(modules.includes(file)){
   res.writeHead(200,{"content-type":"text/javascript"});
   res.end(read(file));return;
  }
  res.writeHead(404);res.end("Not found");
 });
}
test("Stats: 1000 hidden attacks mount on demand; filters reuse existing DOM",{
 timeout:120000
},async()=>{
 const server=startServer();
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1366,height:850}});
  try{
   const exceptions=[];page.on("pageerror",e=>exceptions.push(e.message));
   await page.goto("http://127.0.0.1:"+server.address().port+"/fixture",{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>window.__ready===true);
   await page.locator('[data-stats-section="history"]').click();
   assert.equal(await page.locator(".war-history-item").count(),40);
   assert.equal(await page.locator(".war-history-attack").count(),0,
    "closed history should not contain all 1000 attacks");
   await page.locator(".war-history-item > summary").first().click();
   await page.waitForFunction(()=>document.querySelectorAll(".war-history-attack").length===25);
   const snapshot=await page.evaluate(()=>{
    const host=document.getElementById("statsWarHistory");
    window.__warEl=host.querySelector(".war-history-item");
    document.querySelector('[data-stats-section="players"]').click();
    window.__statRow=document.querySelector("#statsRows .stats-player-row");
    document.getElementById("statsSearch").value="Spieler";
    document.getElementById("statsSearch").dispatchEvent(new Event("input",{bubbles:true}));
    return {
     sameWar:window.__warEl===host.querySelector(".war-history-item"),
     sameStatsRow:window.__statRow===document.querySelector("#statsRows .stats-player-row"),
     open:window.__warEl.open,
     attackCount:document.querySelectorAll(".war-history-attack").length
    };
   });
   assert.deepEqual(snapshot,{sameWar:true,sameStatsRow:true,open:true,attackCount:25});
   await page.evaluate(async()=>window.__stats.load());
   assert.equal(await page.locator(".war-history-item[open]").count(),1);
   assert.equal(await page.locator(".war-history-attack").count(),25);
   await page.evaluate(async()=>{
    window.__clan="clan-b";window.__stats.reset();await window.__stats.load();
   });
   assert.equal(await page.locator(".war-history-item[open]").count(),0,
    "new clan must not inherit another clan's expanded history");
   assert.deepEqual(exceptions,[]);
  }finally{await page.close()}
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
test("Large lists: viewport paint skipping, no fixed Gold gradient, mobile hit targets",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,1366]){
   const page=await browser.newPage({viewport:{width,height:840}});
   try{
    await page.setContent('<!doctype html><html lang="de" data-theme="arena"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body class="cloud-mode"><main id="view-members" class="view active"><div id="memberList"></div></main><section id="view-stats"><div id="statsRows"></div></section></body></html>');
    const layout=await page.evaluate(()=>{
     const root=document.getElementById("memberList"),rows=document.getElementById("statsRows");
     root.innerHTML=Array.from({length:100},(_,i)=>'<div class="member"><div class="member-top"><div class="name-wrap"><b class="member-name-label">Spieler mit langem Namen '+i+'</b><button class="member-name-edit">✎</button></div></div><div class="member-snapshot"><span class="member-brief">RH18 · 3★</span><div class="member-snapshot-actions"><div class="member-order"><button class="order-btn">↑</button><button class="order-btn">↓</button></div><button class="member-note-btn">Notiz</button><button class="member-edit-toggle">Bearbeiten</button></div></div></div>').join("");
     rows.innerHTML=Array.from({length:100},(_,i)=>'<div class="stats-player-row"><span>Spieler '+i+'</span><span>80 %</span><span>20</span><span>0</span></div>').join("");
     const member=root.querySelector(".member");
     const note=member.querySelector(".member-note-btn"),order=member.querySelector(".order-btn"),
      edit=member.querySelector(".member-edit-toggle"),pencil=member.querySelector(".member-name-edit");
     const metrics={
      memberPaint:getComputedStyle(member).contentVisibility,
      rowPaint:getComputedStyle(rows.firstElementChild).contentVisibility,
      memberShadow:getComputedStyle(member).boxShadow,
      backgroundAttachment:getComputedStyle(document.body).backgroundAttachment,
      touch:[note,order,edit,pencil].map(el=>Math.min(el.getBoundingClientRect().width,el.getBoundingClientRect().height))
     };
     window.scrollTo(0,1300);
     return {...metrics,scrollWidth:document.documentElement.scrollWidth,
       viewport:innerWidth,scrollY:window.scrollY};
    });
    assert.equal(layout.memberPaint,"auto");
    assert.equal(layout.rowPaint,"auto");
    assert.equal(layout.memberShadow,"none");
    assert.ok(layout.backgroundAttachment.split(",").every(value=>value.trim()==="scroll"),
     "every layered Arena gradient must scroll without a fixed background");
    assert.ok(layout.scrollWidth<=width+2,"no overflow at "+width+": "+JSON.stringify(layout));
    assert.ok(layout.scrollY>300,"long lists must remain scrollable at "+width);
    if(width<700)assert.ok(layout.touch.every(n=>n>=41),JSON.stringify(layout.touch));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
