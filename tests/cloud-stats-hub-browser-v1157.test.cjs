"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const read=filename=>fs.readFileSync(path.join(root,filename),"utf8");
const pageHtml=read("cloud-app.html");
const serverFor=()=>http.createServer((req,res)=>{
 const url=new URL(req.url||"/","http://localhost");
 const name=url.pathname.slice(1);
 if(name==="cloud-sync.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
    /^[a-z0-9-]+\.mjs$/.test(name)){
   const file=path.join(root,name);
   if(fs.existsSync(file)){
     res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
     res.end(name==="cloud-app.html"?pageHtml:read(name));return;
   }
 }
 res.writeHead(404);res.end("");
});

test("Stats hub navigation and measured RH table work in the browser at phone and desktop widths",{
 timeout:120000
},async()=>{
 const server=serverFor();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,1366]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const jsErrors=[];
    page.on("pageerror",e=>jsErrors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async()=>{
      const {createCloudStats}=await import("./cwl-stats.mjs?v=1.15.7");
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const wars=[
       {war_key:"normal:1",war_type:"normal",source:"import",finalized:true,started_at:"2026-10-10T10:00:00Z",team_size:15,opponent_name:"CW Gegner",roster_tags:[]},
       {war_key:"cwl:1",war_type:"cwl",source:"import",finalized:true,started_at:"2026-11-03T10:00:00Z",team_size:15,opponent_name:"CWL Gegner",roster_tags:[]}
      ];
      const attacks=[
       {war_key:"normal:1",attacker_tag:"#PPPP",attacker_name:"Beispiel",attacker_th:18,defender_th:17,attack_order:1,stars:3,destruction:100},
       {war_key:"cwl:1",attacker_tag:"#PPPP",attacker_name:"Beispiel",attacker_th:18,defender_th:18,attack_order:1,stars:2,destruction:95}
      ];
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
       return {
        select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}
       };
      }};
      const stats=createCloudStats({sb,context:()=>({active:true,clanId:"test-clan",role:"owner",memberTags:["#PPPP"]}),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      const tabs=[...document.querySelectorAll("#statsSectionTabs [data-stats-section]")];
      const show=key=>{
       const btn=tabs.find(b=>b.dataset.statsSection===key);
       btn.click();
       return {
        active:btn.getAttribute("aria-pressed"),
        visible:[...document.querySelectorAll("#view-stats [data-stats-panel]")].filter(p=>!p.hidden).map(p=>p.dataset.statsPanel),
        width:document.documentElement.scrollWidth
       };
      };
      const initial=[...document.querySelectorAll("#view-stats [data-stats-panel]")].filter(p=>!p.hidden).map(p=>p.dataset.statsPanel);
      const overviewText=document.getElementById("statsDataCount").textContent;
      const players=show("players");
      const numbered=document.querySelector("#statsRows .stats-row-number")?.textContent;
      const playerScope=document.getElementById("statsPlayerScope").textContent;
      const compare=show("compare");
      const comparison=document.getElementById("statsMatchupComparison").textContent;
      const history=show("history");
      const warNames=document.getElementById("statsWarHistory").textContent;
      const back=show("overview");
      return {initial,overviewText,players,numbered,playerScope,compare,comparison,history,warNames,back,
       tabs:tabs.length,finalWidth:document.documentElement.scrollWidth,viewport:innerWidth};
    });
    assert.deepEqual(result.initial,["overview"]);
    assert.equal(result.tabs,4);
    assert.equal(result.players.active,"true");
    assert.deepEqual(result.players.visible,["players"]);
    assert.equal(result.numbered,"1.");
    assert.match(result.playerScope,/2 ausgewählten Kriegen/);
    assert.deepEqual(result.compare.visible,["compare"]);
    assert.match(result.comparison,/Gegner-RH niedriger/);
    assert.match(result.comparison,/Gleiches Rathaus/);
    assert.match(result.comparison,/100 % 3★/);
    assert.deepEqual(result.history.visible,["history"]);
    assert.match(result.warNames,/CW Gegner/);
    assert.match(result.warNames,/CWL Gegner/);
    assert.deepEqual(result.back.visible,["overview"]);
    assert.ok(result.finalWidth<=width+3,JSON.stringify(result));
    assert.deepEqual(jsErrors,[],"Browser errors: "+width+" "+jsErrors.join(";"));
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
