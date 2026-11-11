"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const core=()=>import(pathToFileURL(path.join(root,"cwl-stats-core.mjs")));
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
 }
 if(name==="cloud-app.html"||name==="cwl-planning-core.js"||
    /^[a-z0-9-]+\.mjs$/.test(name)){
  if(fs.existsSync(path.join(root,name))){
   res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
   res.end(read(name));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("Austrian period labels distinguish day, ISO calendar week and month across year boundaries",async()=>{
 const {formatTrendPeriod}=await core();
 assert.equal(formatTrendPeriod("2026-11-03","day",{short:true}),"03.11.26");
 assert.equal(formatTrendPeriod("2026-11-03","day"),"03.11.2026");
 assert.equal(formatTrendPeriod("2028-02-29","day"),"29.02.2028");
 assert.equal(formatTrendPeriod("2026-11-02","week",{short:true}),"KW 45/26");
 assert.equal(formatTrendPeriod("2026-11-02","week"),"KW 45/2026 (ab 02.11.2026)");
 assert.equal(formatTrendPeriod("2025-12-29","week",{short:true}),"KW 01/26");
 assert.equal(formatTrendPeriod("2025-12-29","week"),"KW 01/2026 (ab 29.12.2025)");
 assert.equal(formatTrendPeriod("2027-01-01","week",{short:true}),"KW 53/26");
 assert.equal(formatTrendPeriod("2026-11-01","month",{short:true}),"Nov 26");
 assert.equal(formatTrendPeriod("2026-11-01","month"),"November 2026");
 assert.equal(formatTrendPeriod("2026-01-01","month",{short:true}),"Jän 26");
 assert.equal(formatTrendPeriod("2026-01-01","month"),"Jänner 2026");
 assert.throws(()=>formatTrendPeriod("2026-02-30","day"),/Ungültiges Verlaufsdatum/);
 assert.throws(()=>formatTrendPeriod("2026-11-03","unsupported"),/Ungültige Zeitachse/);
});

test("Timeline shows Austrian date labels on chart, tooltip and table without changing metrics",{
 timeout:150000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
     {waitUntil:"domcontentloaded"});
    const result=await page.evaluate(async theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
     document.getElementById("view-stats").classList.add("active");
     const {createCloudStats}=await import("./cwl-stats.mjs");
     const dates=["2025-12-29","2026-01-05","2026-06-15","2026-11-03"];
     const wars=dates.map((d,i)=>({
      war_key:"normal:date"+i,war_type:"normal",source:"import",finalized:true,
      started_at:d+"T12:00:00Z",team_size:15,opponent_name:"Test-Gegner "+i
     }));
     const attacks=wars.map((w,i)=>({
      war_key:w.war_key,attacker_tag:"#PPPP",attacker_name:"Testspieler",
      attacker_th:18,defender_th:18,attack_order:1,stars:i===1?2:3,
      destruction:i===1?85:100
     }));
     const sb={from(name){
      const data=name==="cwl_stat_wars"?wars:name==="cwl_stat_attacks"?attacks:[];
      return {select(){return this},eq(){return this},order(){return this},
       limit(){return Promise.resolve({data,error:null})},
       range(){return Promise.resolve({data,error:null})}};
     }};
     const stats=createCloudStats({sb,context:()=>({
      active:true,clanId:"synthetic-date-test",role:"viewer",memberTags:["#PPPP"]
     }),notify:()=>{},confirmAction:async()=>true});
     await stats.load();
     document.querySelector('[data-stats-section="history"]').click();
     const control=document.getElementById("statsTrendGranularity");
     const checks={};
     for(const granularity of ["day","week","month"]){
      control.value=granularity;
      control.dispatchEvent(new Event("change",{bubbles:true}));
      const svg=document.querySelector("#statsTrendChart svg");
      const table=document.querySelector("#statsTrendTable details");
      table.open=true;
      const axis=[...svg.querySelectorAll('text.axislabel[text-anchor="middle"]')]
        .map(e=>e.textContent);
      const tooltip=[...svg.querySelectorAll(".statpoint title")].map(e=>e.textContent);
      const tableDates=[...document.querySelectorAll("#statsTrendTable tbody tr")]
        .map(tr=>tr.querySelector("td")?.textContent);
      checks[granularity]={
       axis,tooltip,tableDates,points:svg.querySelectorAll(".statpoint").length,
       gaps:svg.querySelectorAll(".stats-gap-mark").length,
       scope:document.getElementById("statsTrendScope").textContent,
       open:table.open,
       pageOverflow:document.documentElement.scrollWidth-innerWidth
      };
     }
     return {checks,importHidden:document.getElementById("statsImportButton").hidden};
    },theme);
    const context=JSON.stringify({width,theme,result});
    const day=result.checks.day,week=result.checks.week,month=result.checks.month;
    assert.ok(day.axis.includes("29.12.25")&&day.axis.includes("03.11.26"),context);
    assert.ok(week.axis.includes("KW 01/26")&&week.axis.includes("KW 45/26"),context);
    assert.ok(month.axis.includes("Dez 25")&&month.axis.includes("Nov 26"),context);
    assert.ok(day.tooltip.some(x=>x.includes("03.11.2026")),context);
    assert.ok(week.tooltip.some(x=>x.includes("KW 01/2026 (ab 29.12.2025)")),context);
    assert.ok(month.tooltip.some(x=>x.includes("November 2026")),context);
    assert.ok(day.tableDates.includes("03.11.2026"),context);
    assert.ok(week.tableDates.includes("KW 01/2026 (ab 29.12.2025)"),context);
    assert.ok(month.tableDates.includes("November 2026"),context);
    for(const chart of [day,week,month]){
     assert.equal(chart.points,4,context);
     assert.ok(chart.gaps>=1,"keep real calendar gaps: "+context);
     assert.match(chart.scope,/4 erfasste Angriffe/,context);
     assert.equal(chart.open,true,context);
     assert.ok(chart.pageOverflow<=3,context);
     assert.doesNotMatch(chart.axis.join(" "),/\b(?:2026-11|11-03)\b/,context);
    }
    assert.equal(result.importHidden,true,context);
    assert.deepEqual(errors,[],"browser page errors: "+context);
   }finally{await page.close()}
  }
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok));
 }
});
