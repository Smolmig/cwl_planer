"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const serve=()=>http.createServer((req,res)=>{
 const pathName=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(pathName==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
 }
 if(pathName==="cloud-app.html"||pathName==="cwl-planning-core.js"||
   /^[a-z0-9-]+\.mjs$/.test(pathName)){
  if(fs.existsSync(path.join(root,pathName))){
   res.writeHead(200,{"content-type":pathName.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(pathName));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("Overview always describes all recorded wars; player-specific filters cannot rewrite its data scope",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"light"],[430,"dark"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const problems=[];page.on("pageerror",err=>problems.push(err.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
      {waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const wars=[
       {war_key:"normal:one",war_type:"normal",source:"import",finalized:true,
        started_at:"2026-10-15T10:00:00Z",team_size:15,opponent_name:"Normal"},
       {war_key:"cwl:two",war_type:"cwl",source:"import",finalized:true,
        started_at:"2026-11-05T10:00:00Z",team_size:15,opponent_name:"League"}
      ];
      const attacks=[
       {war_key:"normal:one",attacker_tag:"#2PYL",attacker_name:"Beispiel",
        attacker_th:18,defender_th:18,attack_order:1,stars:3,destruction:100},
       {war_key:"cwl:two",attacker_tag:"#2PYL",attacker_name:"Beispiel",
        attacker_th:18,defender_th:18,attack_order:1,stars:2,destruction:82}
      ];
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,context:()=>({
       active:true,clanId:"synthetic-clan",role:"viewer",memberTags:["#2PYL"]
      }),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      const intro=document.querySelector('[data-stats-panel="overview"] .stats-note').textContent;
      const allSummary=document.getElementById("statsSummary").textContent;
      const allCount=document.getElementById("statsDataCount").textContent;
      const allCoverage=document.getElementById("statsMissedCoverage").textContent;
       const basis=document.getElementById("statsSeasonDisclosure");
       const basisClosed=!basis.open&&!basis.hidden;
       const basisText=document.getElementById("statsSeasonDetails").textContent;
       const basisTouchHeight=basis.querySelector("summary").getBoundingClientRect().height;
       basis.open=true;
       await stats.load();
       const basisOpenAfterReload=basis.open;
      document.querySelector('[data-stats-section="players"]').click();
      const select=document.getElementById("statsType");
      select.value="normal";select.dispatchEvent(new Event("change",{bubbles:true}));
      const restricted=document.getElementById("statsPlayerScope").textContent;
      document.querySelector('[data-stats-section="overview"]').click();
      return {
       intro,allSummary,allCount,allCoverage,restricted,
        basisClosed,basisText,basisTouchHeight,basisOpenAfterReload,
       restoredSummary:document.getElementById("statsSummary").textContent,
       restoredCount:document.getElementById("statsDataCount").textContent,
       importHidden:document.getElementById("statsImportButton").hidden,
       scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth
      };
    },theme);
    const info=JSON.stringify({width,theme,result});
    assert.match(result.intro,/Ergebnisse aus allen gespeicherten, abgeschlossenen Kriegen/,info);
    assert.doesNotMatch(result.intro,/oben ausgewählten Kriege/,info);
    assert.match(result.allCount,/1 normaler CW \+ 1 CWL-Kriegstag/,info);
    assert.match(result.allCoverage,/aus gespeicherten Kriegen/,info);
     assert.equal(result.basisClosed,true,info);
     assert.match(result.basisText,/Ausgewertet werden/,info);
     assert.ok(result.basisTouchHeight>=44,info);
     assert.equal(result.basisOpenAfterReload,true,info);
    assert.match(result.restricted,/1 ausgewählten abgeschlossenen Krieg/,info);
    assert.equal(result.restoredCount,result.allCount,info);
    assert.equal(result.restoredSummary,result.allSummary,info);
    assert.equal(result.importHidden,true,info);
    assert.ok(result.scrollWidth<=result.viewport+3,info);
    assert.deepEqual(problems,[]);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
});

test("Reload preserves focused open player details and visible row on mobile and desktop; zero-war overview is neutral",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const problems=[];page.on("pageerror",err=>problems.push(err.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
      {waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.documentElement.style.scrollBehavior="auto";
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const chars="0289PYLQGRJCUV";
      const players=Array.from({length:42},(_,i)=>({
       tag:"#2P"+chars[Math.floor(i/chars.length)]+chars[i%chars.length]+"L",
       name:"Spieler "+String(i+1).padStart(2,"0")
      }));
      const wars=[{war_key:"normal:one",war_type:"normal",source:"import",
       finalized:true,started_at:"2026-11-02T10:00:00Z",team_size:50,opponent_name:"Example"}];
      const attacks=players.map(p=>({
       war_key:"normal:one",attacker_tag:p.tag,attacker_name:p.name,
       attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:1
      }));
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,context:()=>({
       active:true,clanId:"synthetic-clan",role:"viewer",memberTags:players.map(p=>p.tag)
      }),notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      document.querySelector('[data-stats-section="players"]').click();
      const list=document.getElementById("statsRows");
      const details=[...list.querySelectorAll(".stats-player-details")];
      const chosen=details.find(x=>x.dataset.playerTag===players[20].tag);
      const chosenRow=chosen.closest(".stats-player-row");
      window.scrollTo(0,window.scrollY+chosenRow.getBoundingClientRect().top-145);
      await new Promise(done=>setTimeout(done,0));
      chosen.open=true;
      await new Promise(done=>setTimeout(done,0));
      chosen.querySelector("summary").focus({preventScroll:true});
      const top=Math.max(0,document.querySelector(".topbar")?.getBoundingClientRect().bottom||0)+4;
      const anchorRow=[...list.querySelectorAll(".stats-player-row")].find(row=>{
       const box=row.getBoundingClientRect();return box.bottom>top&&box.top<innerHeight-24;
      });
      const anchorTag=anchorRow.querySelector(".stats-player-details").dataset.playerTag;
      const beforeTop=anchorRow.getBoundingClientRect().top;
      const beforeScroll=window.scrollY;
      const original=chosen.querySelector("summary");
      attacks.push({war_key:"normal:one",attacker_tag:"#2P00G",
       attacker_name:"AAA Neu",attacker_th:18,defender_th:18,
       stars:2,destruction:95,attack_order:1});
      await stats.load();
      const newDetails=[...list.querySelectorAll(".stats-player-details")];
      const afterChosen=newDetails.find(x=>x.dataset.playerTag===players[20].tag);
      const afterAnchor=newDetails.find(x=>x.dataset.playerTag===anchorTag).closest(".stats-player-row");
      const afterTop=afterAnchor.getBoundingClientRect().top;
      const rowCount=list.querySelectorAll(".stats-player-row").length;
      const focusPreserved=document.activeElement===afterChosen.querySelector("summary");
      const afterScroll=window.scrollY;
      const newPlayerVisible=!!newDetails.find(x=>x.dataset.playerTag==="#2P00G");
      // Reset must remove the old clan's private players immediately.
      stats.reset();
      const rowsCleared=list.querySelectorAll(".stats-player-row").length===0;
      const noWars=document.getElementById("statsDataCount").textContent;
      return {
       opened:afterChosen.open,focusPreserved,
       wasReplaced:original!==afterChosen.querySelector("summary"),
       beforeTop,afterTop,beforeScroll,afterScroll,
       rowCount,newPlayerVisible,rowsCleared,noWars,
       scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth
      };
    },theme);
    const note=JSON.stringify({width,theme,result});
    assert.equal(result.opened,true,note);
    assert.equal(result.focusPreserved,true,note);
    assert.equal(result.wasReplaced,true,note);
    assert.ok(Math.abs(result.afterTop-result.beforeTop)<4,note);
    assert.equal(result.rowCount,43,note);
    assert.equal(result.newPlayerVisible,true,note);
    assert.equal(result.rowsCleared,true,note);
    assert.match(result.noWars,/Noch keine abgeschlossenen Kriege gespeichert/,note);
    assert.ok(result.scrollWidth<=result.viewport+3,note);
    assert.deepEqual(problems,[]);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
});
