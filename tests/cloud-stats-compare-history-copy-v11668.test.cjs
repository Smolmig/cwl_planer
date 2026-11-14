"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");

const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return}
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||/^[a-z0-9-]+\.mjs$/.test(name)){
  const file=path.join(root,name);
  if(fs.existsSync(file)){res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});res.end(read(name));return}
 }
 res.writeHead(404);res.end("");
});

test("statistic comparison/history empty cases and recorded-star meaning stay clear on phones and desktop",{timeout:120000},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[1366,"light"]]){
   const page=await browser.newPage({viewport:{width,height:860}});
   try{
    const problems=[];page.on("pageerror",error=>problems.push(error.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.getElementById("view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const wars=[],attacks=[];
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>({active:true,clanId:"copy-audit",role:"viewer",
       memberTags:["#PPPP"],memberProfiles:[{playerTag:"#PPPP",name:"Muster"}]}),
       notify:()=>{},confirmAction:async()=>true});
     const click=id=>document.querySelector('[data-stats-section="'+id+'"]').click();
     const snapshot=()=>({
      compareScope:document.getElementById("statsCompareScope").textContent,
      matchup:document.getElementById("statsMatchupComparison").textContent,
      duel:document.getElementById("statsDuelResults").textContent,
      trendScope:document.getElementById("statsTrendScope").textContent,
      chart:document.getElementById("statsTrendChart").textContent,
      history:document.getElementById("statsWarHistory").textContent,
      overflow:document.documentElement.scrollWidth-innerWidth
     });
     await stats.load();click("compare");click("history");
     const none=snapshot();
     wars.push({war_key:"normal:one",war_type:"normal",source:"import",
       finalized:true,started_at:"2026-11-01T12:00:00Z",team_size:15,opponent_name:"Normal-Gegner"});
     attacks.push({war_key:"normal:one",attacker_tag:"#PPPP",attacker_name:"Muster",
       attacker_th:18,defender_th:18,attack_order:1,stars:3,destruction:100});
     wars.push({war_key:"cwl:one",war_type:"cwl",source:"import",
       finalized:true,started_at:"2026-11-04T12:00:00Z",team_size:15,opponent_name:"Liga-Gegner"});
     await stats.load();
     click("compare");
     const sel=document.getElementById("statsCompareType");sel.value="cwl";
     sel.dispatchEvent(new Event("change",{bubbles:true}));
     const noAttacks=snapshot();
     click("history");
     const type=document.getElementById("statsTrendType");type.value="cwl";
     type.dispatchEvent(new Event("change",{bubbles:true}));
     const league=snapshot();
     type.value="normal";type.dispatchEvent(new Event("change",{bubbles:true}));
     const normal=snapshot();
     return {none,noAttacks,league,normal,
       explanation:document.querySelector("[data-stats-panel='history'] .stats-trend-controls")?.textContent,
       tableLabel:document.getElementById("statsTrendTable").getAttribute("aria-label")};
    },theme);
    const ctx=JSON.stringify({width,theme,result});
    assert.match(result.none.compareScope,/Noch keine abgeschlossenen Kriege erfasst/,ctx);
    assert.match(result.none.matchup,/Keine Kriege für diesen Vergleich/,ctx);
    assert.match(result.none.history,/Noch keine abgeschlossenen Kriege gespeichert/,ctx);
    assert.match(result.noAttacks.compareScope,/1 abgeschlossene? CWL-Kriegstage? ausgewählt|1 abgeschlossene CWL-Kriegstage ausgewählt/,ctx);
    assert.match(result.noAttacks.matchup,/noch keine Angriffe erfasst/,ctx);
    assert.match(result.noAttacks.duel,/zwei Spieler mit erfassten Angriffen/,ctx);
    assert.match(result.league.trendScope,/1 ausgewählter Krieg · 0 erfasste Angriffe/,ctx);
    assert.match(result.league.history,/0 erfasste Angriffe · Sterne noch nicht bekannt/,ctx);
    assert.match(result.normal.history,/1 erfasster Angriff · 3 erfasste Sterne/,ctx);
    assert.match(result.normal.trendScope,/1 ausgewählter Krieg · 1 erfasster Angriff/,ctx);
    assert.match(result.tableLabel,/Anzahl erfasster Angriffe/,ctx);
    assert.ok([result.none,result.noAttacks,result.league,result.normal]
      .every(row=>row.overflow<=3),ctx);
    assert.deepEqual(problems,[],ctx);
   }finally{await page.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});

test("week and war copy is clear without changing the actual timeline and filter logic",()=>{
 const html=read("cloud-app.html"),stats=read("cwl-stats.mjs");
 assert.match(html,/Kalenderwoche \(KW\)/);
 assert.match(html,/KW 12\/26<\/b> bedeutet Kalenderwoche 12 im Jahr 2026/);
 assert.match(html,/Statistik: Vergleiche &amp; Verlauf/);
 assert.match(html,/nicht das offizielle Kriegsergebnis/);
 assert.match(html,/Letzte 365 Tage/);
 assert.match(stats,/const chosen=comparisonWars\(\)/);
 assert.match(stats,/selectWarDateScope\(wars,\{type:trendType,days:trendDays\}\)/);
 assert.match(stats,/computeStatsTimeline\(ownWars,attacks/);
 assert.match(read("cloud-release-history.mjs"),/"version": "v1\.21\.0"/);
 assert.equal(JSON.parse(read("cloud-version.json")).version,"v1.21.0");
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
});
