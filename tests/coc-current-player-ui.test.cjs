"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const http=require("node:http");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const serve=()=>http.createServer((req,res)=>{
 const file=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(file==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
 }
 if(file==="cloud-app.html"||/^[a-z0-9-]+\.mjs$/.test(file)){
  const p=path.join(root,file);
  if(fs.existsSync(p)){
   res.writeHead(200,{"content-type":file.endsWith(".html")?"text/html":"text/javascript"});
   res.end(fs.readFileSync(p,"utf8"));return;
  }
 }
 res.writeHead(404);res.end("");
});
test("current API profile is on-demand, labelled as current and does not change attack history",{
 timeout:90000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:850}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
    {waitUntil:"domcontentloaded"});
  const initial=await page.evaluate(async()=>{
   document.body.classList.add("cloud-mode");
   document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
   document.getElementById("view-stats").classList.add("active");
   const {createCloudStats}=await import("./cwl-stats.mjs");
   const w={war_key:"normal:old",war_type:"normal",source:"import",finalized:true,
     missed_log_complete:true,team_size:15,started_at:new Date(Date.now()-86400000).toISOString()};
   const a={war_key:w.war_key,attacker_tag:"#2PYL",attacker_name:"Alter Weiss",
     attacker_th:17,defender_th:17,stars:3,destruction:100,attack_order:1};
   let fetchCalls=0;
   const sb={
     from(name){
       const data=name==="cwl_stat_wars"?[w]:name==="cwl_stat_attacks"?[a]:[];
       return {select(){return this},eq(){return this},order(){return this},
         limit(){return Promise.resolve({data,error:null})},
         range(){return Promise.resolve({data,error:null})}};
     },
     functions:{async invoke(name,args){
       fetchCalls++;
       if(name!=="coc-player-profile")throw Error("wrong endpoint");
       if(args.body.playerTag!=="#2PYL")throw Error("wrong tag");
       return {data:{ok:true,profile:{tag:"#2PYL",name:"Weiss aktuell",
         townHallLevel:19,clan:{tag:"#QPPP",name:"United Fighters"},
         checkedAt:"2026-11-14T12:00:00Z"}},error:null};
     }}
   };
   window.__getCalls=()=>fetchCalls;
   const stats=createCloudStats({sb,context:()=>({
     active:true,clanId:"owned-tenant",role:"viewer",memberTags:[]
   }),notify:()=>{},confirmAction:async()=>true});
   await stats.load();
   document.querySelector('[data-stats-section="form"]').click();
   const row=[...document.querySelectorAll(".stats-form-row")]
     .find(x=>x.dataset.formTag==="#2PYL");
   return {before:row?.querySelector(".stats-form-rate")?.textContent,
     buttonCount:row?.querySelectorAll("[data-current-profile]").length||0,
     calls:fetchCalls};
  });
  assert.equal(initial.calls,0);
  assert.equal(initial.buttonCount,1);
  assert.match(initial.before,/3★-Quote 100 %/);
  await page.locator(".stats-form-row .stats-form-player-details summary").first().click();
  await page.locator("button[data-current-profile]").first().click();
  await page.waitForFunction(()=>document.querySelector(".stats-current-profile-result")
    ?.textContent.includes("RH 19"));
  const outcome=await page.evaluate(()=>({
    calls:window.__getCalls(),
    detail:document.querySelector(".stats-current-profile-result").textContent,
    rate:document.querySelector(".stats-form-rate").textContent,
    names:document.querySelector(".stats-form-person b").textContent
  }));
  assert.equal(outcome.calls,1);
  assert.match(outcome.detail,/Aktueller API-Stand: Weiss aktuell · RH 19/);
  assert.match(outcome.detail,/Historische RH der Angriffe bleiben unverändert/);
  assert.equal(outcome.rate,initial.before);
  assert.equal(outcome.names,"Alter Weiss");
  assert.deepEqual(errors,[]);
  await page.close();
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
