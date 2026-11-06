"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

const serverFor=()=>http.createServer((req,res)=>{
 const url=new URL(req.url||"/","http://localhost"),name=url.pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
   /^[a-z0-9-]+\.mjs$/.test(name)){
  const file=path.join(root,name);
  if(fs.existsSync(file)){
   res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(name));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("duel shows actual percentages AND sample sizes without implying a winner",{
 timeout:120000
},async()=>{
 const server=serverFor();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"arena"],[430,"light"],[1366,"dark"]]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    const info=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const wars=Array.from({length:33},(_,i)=>{
       const when=new Date(Date.UTC(2026,8,1+i)).toISOString();
       return {war_key:"war:"+i,war_type:i%2===0?"normal":"cwl",source:"import",
        finalized:true,started_at:when,team_size:15,opponent_name:"Beispiel",roster_tags:[]};
      });
      const attack=(w,tag,name,stars)=>({
       war_key:w.war_key,attacker_tag:tag,attacker_name:name,
       attacker_th:18,defender_th:18,stars,
       destruction:stars===3?100:85,attack_order:1
      });
      const attacks=[
       ...wars.map((w,i)=>attack(w,"#2PYL","Viel",i<30?3:2)),
       ...wars.slice(0,2).map(w=>attack(w,"#PPPP","Klein",3))
      ];
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:
        name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,context:()=>({
       active:true,clanId:"demo",role:"owner",memberTags:["#PPPP","#2PYL"]
      }),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      document.querySelector('[data-stats-section="compare"]').click();
      const host=document.getElementById("statsDuelResults");
      const primary=[...host.querySelectorAll(".stats-duel-person")]
       .map(el=>el.textContent.replace(/\s+/g," ").trim());
      const splits=[...host.querySelectorAll(".stats-duel-split-row")]
       .map(el=>el.textContent.replace(/\s+/g," ").trim());
      const highlights=[...document.querySelectorAll(".stats-highlight-col")]
       .map(el=>el.textContent.replace(/\s+/g," ").trim());
      const details=host.querySelector(".stats-duel-details");
      const initiallyClosed=!details.open;
      details.open=true;
      const insideDetails=details.querySelectorAll(".stats-stacked-stars").length;
      const checkbox=document.getElementById("statsDuelSameTH");
      checkbox.checked=false;checkbox.dispatchEvent(new Event("change",{bubbles:true}));
      const expandedAfterFilter=host.querySelector(".stats-duel-details")?.open===true;
      const duel=host.getBoundingClientRect();
      return {primary,splits,highlights,initiallyClosed,insideDetails,
       expandedAfterFilter,detailsCount:host.querySelectorAll(".stats-duel-details").length,
       chartCount:host.querySelectorAll(".stats-duel-grid .stats-stacked-stars").length,
       width:document.documentElement.scrollWidth,
       viewport:innerWidth,duelWidth:duel.width,errors:[]};
    },theme);
    assert.equal(info.primary.length,2,JSON.stringify(info));
    assert.ok(info.primary.some(x=>/Klein.*100 %.*2 von 2 Angriffen.*Wenige Daten/.test(x)),
      "2/2 must explicitly be a small sample: "+JSON.stringify(info));
    assert.ok(info.primary.some(x=>/Viel.*91 %.*30 von 33 Angriffen/.test(x)),
      "30/33 must retain the actual sample: "+JSON.stringify(info));
    assert.equal(info.splits.length,2);
    assert.match(info.splits.join(" "),/Normaler CW/);
    assert.match(info.splits.join(" "),/CWL/);
    assert.equal(info.highlights.length,3,"Only three first-glance TH comparisons");
    assert.equal(info.initiallyClosed,true);
    assert.equal(info.insideDetails,2);
    assert.equal(info.expandedAfterFilter,true,"Disclosure state must survive checkbox filter");
    assert.equal(info.chartCount,0,"Never show duplicate star legends in primary cards");
    assert.equal(info.detailsCount,1,"Only one shared detail disclosure");
    assert.ok(info.width<=info.viewport+3,
     "No horizontal overflow at "+width+" "+theme+": "+JSON.stringify(info));
    assert.deepEqual(errors,[],"Browser errors: "+errors.join(";"));
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});

test("comparison UI remains data-only, preserving the independent scopes",()=>{
 const html=read("cloud-app.html"),js=read("cwl-stats.mjs");
 assert.match(html,/id="statsCompareType"/);
 assert.match(html,/id="statsCompareDays"/);
 assert.match(html,/id="statsDuelSameTH"/);
 assert.match(js,/stats-duel-splits/);
 assert.match(js,/stats-duel-details/);
 assert.match(js,/const previousOpen=host.querySelector/);
 assert.match(js,/Wenige Angriffe erlauben noch keinen belastbaren Vergleich/);
 assert.doesNotMatch(js,/Wer ist besser\?|Sieger:/);
});
