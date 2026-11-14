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
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||/^[a-z0-9-]+\.mjs$/.test(name)){
  if(fs.existsSync(path.join(root,name))){
   res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(name));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("free stats uses finalized normal CWs for All/Last N and empty selections",{
 timeout:150000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const problems=[];page.on("pageerror",e=>problems.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
     {waitUntil:"domcontentloaded"});
    const outcome=await page.evaluate(async selectedTheme=>{
     document.documentElement.dataset.theme=selectedTheme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
     document.getElementById("view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const wars=[
      {war_key:"normal:old",war_type:"normal",source:"import",finalized:true,
       started_at:"2026-10-10T12:00:00Z",team_size:15,opponent_name:"Old"},
      {war_key:"normal:new",war_type:"normal",source:"api",finalized:true,
       started_at:"2026-11-03T12:00:00Z",team_size:15,opponent_name:"New"},
      {war_key:"normal:pending",war_type:"normal",source:"api",finalized:false,
       started_at:"2026-11-08T12:00:00Z",team_size:15,opponent_name:"Still running"},
      {war_key:"cwl:pending",war_type:"cwl",source:"api",finalized:false,
       started_at:"2026-11-07T12:00:00Z",team_size:15,opponent_name:"League running"}
     ];
     const attacks=[
      {war_key:"normal:old",attacker_tag:"#PPPP",attacker_name:"Form",
       attacker_th:18,defender_th:18,attack_order:1,stars:2,destruction:80},
      {war_key:"normal:new",attacker_tag:"#PPPP",attacker_name:"Form",
       attacker_th:18,defender_th:18,attack_order:1,stars:3,destruction:100},
      {war_key:"normal:pending",attacker_tag:"#PPPP",attacker_name:"Form",
       attacker_th:18,defender_th:18,attack_order:1,stars:0,destruction:0}
     ];
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>({
      active:true,clanId:"stats-scope",role:"viewer",memberTags:["#PPPP"],
      memberProfiles:[{playerTag:"#PPPP",name:"Form"}]}),notify:()=>{},
      confirmAction:async()=>true});
     await stats.load();
     const loadedNotice=document.getElementById("statsFeedback").textContent;
     document.querySelector('[data-stats-section="players"]').click();
     const type=document.getElementById("statsType");
     const range=document.getElementById("statsRange");
     const query=()=>({
      scope:document.getElementById("statsPlayerScope").textContent,
      explainer:document.getElementById("statsScopeExplainer").textContent,
      period:document.getElementById("statsPeriodSummary").textContent,
      count:document.getElementById("statsDataCount").textContent,
      detail:document.getElementById("statsSeasonDetails").textContent,
      row:document.getElementById("statsRows").textContent,
      overview:document.getElementById("statsSummary").textContent
     });
     type.value="normal";type.dispatchEvent(new Event("change",{bubbles:true}));
     const all=query();
     range.value="1";range.dispatchEvent(new Event("change",{bubbles:true}));
     const one=query();
     range.value="all";range.dispatchEvent(new Event("change",{bubbles:true}));
     const back=query();
     type.value="cwl";type.dispatchEvent(new Event("change",{bubbles:true}));
     const empty=query();
     await stats.load();
     const afterReload=query();
     document.querySelector('[data-stats-section="overview"]').click();
     const overview={
      count:document.getElementById("statsDataCount").textContent,
      text:document.getElementById("statsSummary").textContent
     };
     // One finalized CW/attack, then the same as a finalized CWL day.
     const singleWar={...wars[1]},singleAttack={...attacks[1]};
     wars.splice(0,wars.length,singleWar);
     attacks.splice(0,attacks.length,singleAttack);
     await stats.load();
     document.querySelector('[data-stats-section="players"]').click();
     type.value="normal";type.dispatchEvent(new Event("change",{bubbles:true}));
     range.value="all";range.dispatchEvent(new Event("change",{bubbles:true}));
     const singleNormal=query();
     document.querySelector('[data-stats-section="history"]').click();
     const singleHistory={
      scope:document.getElementById("statsTrendScope").textContent,
      tooltip:[...document.querySelectorAll("#statsTrendChart svg title")].map(e=>e.textContent),
      table:document.getElementById("statsTrendTable").textContent,
      wars:document.getElementById("statsWarHistory").textContent
     };
     document.querySelector('[data-stats-section="overview"]').click();
     const singleOverview=document.getElementById("statsDataCount").textContent;
     singleWar.war_type="cwl";singleWar.war_key="cwl:#SINGLE";
     singleAttack.war_key=singleWar.war_key;
     await stats.load();
     document.querySelector('[data-stats-section="players"]').click();
     type.value="cwl";type.dispatchEvent(new Event("change",{bubbles:true}));
     const singleCwl=query();
     return {all,one,back,empty,afterReload,overview,loadedNotice,
      singleNormal,singleHistory,singleOverview,singleCwl,
      importHidden:document.getElementById("statsImportButton").hidden,
      pageOverflow:document.documentElement.scrollWidth-innerWidth};
    },theme);
    const note=JSON.stringify({width,theme,outcome});
    assert.match(outcome.loadedNotice,/2 abgeschlossene Kriege gespeichert/,note);
    assert.match(outcome.loadedNotice,/2 weitere Kriege noch nicht bestätigt/,note);
    assert.doesNotMatch(outcome.loadedNotice,/Statistik aktuell/,note);
    assert.match(outcome.all.scope,/2 ausgewählte abgeschlossene Kriege/,note);
    assert.match(outcome.all.explainer,/2 abgeschlossene Kriegstage ausgewählt/,note);
    assert.match(outcome.all.period,/Gesamt · 2 CW/,note);
    assert.match(outcome.all.count,/Alle 2 abgeschlossenen normalen CWs · 2 Angriffe/,note);
    assert.match(outcome.all.detail,/Alle verfügbaren abgeschlossenen/,note);
    assert.doesNotMatch(outcome.all.scope,/08\.11\./,note);
    assert.doesNotMatch(outcome.all.count,/3 abgeschlossenen/,note);
    assert.doesNotMatch(outcome.all.detail,/Bis zu all/,note);
    assert.match(outcome.one.scope,/1 ausgewählten abgeschlossenen Krieg/,note);
    assert.match(outcome.one.count,/1 von 2 abgeschlossenen normalen CWs · 1 Angriff/,note);
    assert.match(outcome.one.period,/Gesamt · 1 CW/,note);
    assert.match(outcome.back.count,/Alle 2 abgeschlossenen normalen CWs/,note);
    assert.match(outcome.empty.scope,/noch keine abgeschlossenen Kriege/,note);
    assert.match(outcome.empty.period,/Gesamt · 0 CWL-Durchgänge/,note);
    assert.match(outcome.empty.count,/Noch keine abgeschlossenen CWL-Kriegstage gespeichert/,note);
    assert.doesNotMatch(outcome.empty.scope,/– –/,note);
    assert.match(outcome.empty.explainer,/keine abgeschlossenen Kriege/,note);
    assert.match(outcome.empty.row,/Keine passenden Spieler/,note);
    assert.equal(outcome.empty.scope,outcome.afterReload.scope,note);
    assert.match(outcome.overview.count,/2 normale CWs \+ 0 CWL-Kriegstage/,note);
    assert.match(outcome.overview.text,/Angriffe2/,note);
    assert.match(outcome.singleNormal.count,/1 abgeschlossener normaler CW · 1 Angriff/,note);
    assert.doesNotMatch(outcome.singleNormal.count,/Alle 1|1 Angriffe/,note);
    assert.match(outcome.singleNormal.row,/Details dieser Auswahl · 1 Angriff/,note);
    assert.match(outcome.singleNormal.row,/1 von 1 Angriff mit 3★/,note);
    assert.match(outcome.singleHistory.scope,/1 ausgewählter Krieg · 1 erfasster Angriff/,note);
    assert.ok(outcome.singleHistory.tooltip.some(t=>t.includes("1 Angriff")),note);
    assert.match(outcome.singleHistory.table,/1 Angriff/,note);
    assert.match(outcome.singleHistory.wars,/1 erfasster Angriff/,note);
    assert.match(outcome.singleOverview,/1 normaler CW.*1 Angriff/,note);
    assert.match(outcome.singleCwl.count,/1 Angriff/,note);
    assert.doesNotMatch(outcome.singleCwl.count,/1 Angriffe/,note);
    assert.equal(outcome.importHidden,true,note);
    assert.ok(outcome.pageOverflow<=3,note);
    assert.deepEqual(problems,[],note);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
});