"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8")
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");
const live=fs.readFileSync(path.join(root,"cwl-live.mjs"),"utf8");
const core=fs.readFileSync(path.join(root,"cwl-live-core.mjs"),"utf8");
const medal=fs.readFileSync(path.join(root,"cwl-medal-goals.mjs"),"utf8");
function serve(){
 return http.createServer((req,res)=>{
  const u=(req.url||"").split("?")[0];
  const type=u.endsWith(".mjs")?"text/javascript":"text/html";
  res.writeHead(u==="/test.html"||u==="/cwl-live.mjs"||u==="/cwl-live-core.mjs"||u==="/cwl-medal-goals.mjs"?200:404,
   {"content-type":type+"; charset=utf-8"});
  res.end(u==="/test.html"?app:u==="/cwl-live.mjs"?live:u==="/cwl-live-core.mjs"?core:u==="/cwl-medal-goals.mjs"?medal:"");
 });
}
test("Chromium: mobile/desktop preparation swaps and opponent dropdown fit the viewport",{timeout:150000},async()=>{
 const server=serve();await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  for(const [width,theme] of [[390,"dark"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.goto("http://127.0.0.1:"+server.address().port+"/test.html",{waitUntil:"domcontentloaded"});
    await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode");
     document.getElementById("view-plan").style.display="block";
     document.getElementById("planDays").innerHTML=
      '<div id="day-card-0" class="card day-card"><div class="day-head">Tag 1</div></div>';
     const alphabet="0289PYLQGRJCUV",tag=i=>"#2P"+alphabet[Math.floor(i/alphabet.length)]+alphabet[i%alphabet.length];
     const members=Array.from({length:17},(_,i)=>({id:"m"+i,name:"Clan Spieler "+(i+1),
      playerTag:tag(i),townHall:19,participating:true,statuses:Array(7).fill("auto")}));
     const own=members.slice(0,15).map(m=>({tag:m.playerTag,name:m.name,townHallLevel:m.townHall}));
     const opponent=members.slice(0,15).map((m,i)=>({tag:tag(i+30),name:"Gegner "+(i+1),townHallLevel:20-i%4}));
     const season=new Date().toISOString().slice(0,7);
     const round={day:1,available:true,warTag:"#2PYR",state:"preparation",teamSize:15,
      clan:{tag:"#2PYG",name:"United Fighters",members:own},
      opponent:{tag:"#2PYJ",name:"Gegnerclan",members:opponent}};
     const profile={id:"fixture",config:{slots:15,days:1},members,archivedMembers:[],
      cwlLive:{season,clanTag:"#2PYG",rounds:[round]}};
     const dayPlan={day:1,locked:false,warnings:[],
      lineup:[...members.slice(0,13),...members.slice(15)].map(m=>m.id)};
     document.getElementById("planDays").innerHTML=
      '<div id="day-card-0" class="card day-card"><div class="day-head">Tag 1</div>'+
      '<button type="button" class="mobile-lineup-toggle">Aufstellung aufklappen</button>'+
      '<div class="lineup">'+dayPlan.lineup.map(id=>{
       const m=members.find(member=>member.id===id);
       return '<div class="player-chip" data-player-tag="'+m.playerTag+'">'+m.name+'</div>';
      }).join("")+'</div></div>';
     const {createCwlLive}=await import("/cwl-live.mjs");
     window.__reviewLive=createCwlLive({
      sb:{functions:{invoke:async()=>({data:{ok:true,active:true,season,clanTag:"#2PYG",rounds:[round]}})}},
      context:()=>({active:true,hasClanTag:true,clanId:"fixture",role:"viewer",profile}),
      storage:{getPlannedLineups:()=>[dayPlan],getPlanningState:()=>({ok:true}),
       getProfile:()=>profile,rerender:()=>{throw Error("Read-only preview mutated a plan")}},
      notify:()=>{throw Error("Unexpected Cloud write")}
     });
     window.__reviewLive.render();
     if(!document.querySelector(".cwl-prep-review")?.textContent.includes("nicht aktuell"))
       throw Error("Stored CWL data must never produce authoritative swap advice");
     await window.__reviewLive.refresh();
    },theme);
    await page.locator(".cwl-prep-review").waitFor();
    assert.match(await page.locator(".cwl-prep-review").textContent(),/2 raus, 2 rein/);
    assert.equal(await page.locator(".lineup .cwl-plan-candidate-hidden").count(),2);
    assert.equal(await page.locator(".lineup .cwl-plan-actual-exit").count(),2);
    assert.equal(await page.locator(".mobile-lineup-toggle").count(),1,
      "the original planned lineup toggle must not disappear");
    const dimensions=await page.evaluate(()=>{
     const card=document.getElementById("day-card-0");
     card.classList.add("mobile-lineup-expanded");
     const lineup=card.querySelector(".lineup");
     return {overflow:document.documentElement.scrollWidth-innerWidth,
      box:lineup.getBoundingClientRect().width,
      count:lineup.querySelectorAll(".player-chip:not(.cwl-plan-candidate-hidden)").length,
      exitVisible:lineup.querySelectorAll(".cwl-plan-actual-exit").length};
    });
    assert.equal(dimensions.overflow,0,"no horizontal overflow on "+width);
    assert.equal(dimensions.count,15);
    assert.equal(dimensions.exitVisible,2);
    await page.locator(".cwl-opponent-details > summary").click();
    assert.equal(await page.locator(".cwl-opponent-details .cwl-roster-member").count(),15);
    assert.equal(await page.locator(".cwl-opponent-details").evaluate(n=>n.open),true);
    await page.evaluate(()=>window.__reviewLive.render());
    assert.equal(await page.locator(".cwl-opponent-details").evaluate(n=>n.open),true);
   }finally{await page.close()}
  }
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});
