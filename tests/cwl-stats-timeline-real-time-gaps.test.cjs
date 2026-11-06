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
const row=(key,normal=0,cwl=0)=>({
 key,normal:{attacks:normal},cwl:{attacks:cwl}
});

test("weekly gap uses real time positions, not evenly distributed observations",async()=>{
 const {computeTrendPlotGeometry}=await core();
 const plot=computeTrendPlotGeometry([
  row("2026-08-03",10),row("2026-08-10",15),row("2026-10-05",5)
 ],{granularity:"week",width:760,left:48,right:18});
 assert.equal(plot.missingPeriods,7);
 assert.equal(plot.gaps.length,1);
 assert.equal(plot.gaps[0].skipped,7);
 assert.deepEqual(plot.segments.normal,[[0,1]],
  "Never draw a normal-CW line over seven unobserved weeks");
 assert.deepEqual(plot.segments.cwl,[]);
 const near=plot.positions[1]-plot.positions[0];
 const distant=plot.positions[2]-plot.positions[1];
 assert.ok(Math.abs(distant/near-8)<0.001,
  "Eight elapsed weeks must take eight times as much space as one week");
 assert.equal(plot.positions[0],48);
 assert.equal(plot.positions.at(-1),742);
});

test("CW and CWL series do not bridge an intervening other-kind period",async()=>{
 const {computeTrendPlotGeometry}=await core();
 const plot=computeTrendPlotGeometry([
  row("2026-11-02",10),row("2026-11-09",0,9),row("2026-11-16",12)
 ],{granularity:"week"});
 assert.equal(plot.missingPeriods,0);
 assert.deepEqual(plot.segments.normal,[]);
 assert.deepEqual(plot.segments.cwl,[]);
});

test("month gap counts cross-year correctly and day gaps respect leap year",async()=>{
 const {computeTrendPlotGeometry}=await core();
 const monthly=computeTrendPlotGeometry([
  row("2026-11-01",3),row("2027-02-01",8)
 ],{granularity:"month"});
 assert.equal(monthly.missingPeriods,2);
 assert.deepEqual(monthly.segments.normal,[]);
 const daily=computeTrendPlotGeometry([
  row("2028-02-28",1),row("2028-03-01",1)
 ],{granularity:"day"});
 assert.equal(daily.missingPeriods,1,"Missing Feb 29 is a gap, not 0%");
 const consecutive=computeTrendPlotGeometry([
  row("2028-02-28",1),row("2028-02-29",1),row("2028-03-01",1)
 ],{granularity:"day"});
 assert.equal(consecutive.missingPeriods,0);
 assert.deepEqual(consecutive.segments.normal,[[0,1,2]]);
});

test("a single observation is centered and data gaps never create fake results",async()=>{
 const {computeTrendPlotGeometry,computeStatsTimeline}=await core();
 const point=computeTrendPlotGeometry([row("2026-11-02",2)],{granularity:"week"});
 assert.equal(point.positions[0],395);
 assert.deepEqual(point.segments.normal,[]);
 const none=computeTrendPlotGeometry([],{granularity:"week"});
 assert.deepEqual(none.positions,[]);
 assert.equal(none.missingPeriods,0);
 const wars=["2026-08-03","2026-08-10","2026-10-05"].map((d,i)=>({
  war_key:"cw:"+i,war_type:"normal",source:"import",finalized:true,
  started_at:d+"T19:00:00Z"
 }));
 const attacks=wars.map(w=>({war_key:w.war_key,stars:3}));
 const metrics=computeStatsTimeline(wars,attacks,{granularity:"week"});
 assert.equal(metrics.rows.length,3,"No invented empty/zero-percent row");
 assert.equal(metrics.recordedAttacks,3);
 assert.ok(metrics.rows.every(r=>r.normal.hitRate===100));
});

const read=filename=>fs.readFileSync(path.join(root,filename),"utf8");
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
   res.end(read(name));return;
  }
 }
 res.writeHead(404);res.end("");
});

test("mobile and desktop charts render a genuine horizontal gap and no fake line",{
 timeout:120000
},async()=>{
 const server=serverFor();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[390,"arena"],[1366,"dark"]]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+
      "/cloud-app.html",{waitUntil:"domcontentloaded"});
    const data=await page.evaluate(async theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const {createCloudStats}=await import("./cwl-stats.mjs");
      const dates=["2026-08-03","2026-08-10","2026-10-05"];
      const wars=dates.map((d,i)=>({
       war_key:"cw:"+i,war_type:"normal",source:"import",finalized:true,
       started_at:d+"T12:00:00Z",team_size:15,opponent_name:"Beispiel",roster_tags:[]
      }));
      const attacks=wars.map((w,i)=>({
       war_key:w.war_key,attacker_tag:"#PPPP",attacker_name:"Demo",
       attacker_th:18,defender_th:18,stars:i===1?2:3,
       destruction:i===1?85:100,attack_order:1
      }));
      const sb={from(name){
       const data=name==="cwl_stat_wars"?wars:
         name==="cwl_stat_attacks"?attacks:[];
       return {select(){return this},eq(){return this},order(){return this},
        limit(){return Promise.resolve({data,error:null})},
        range(){return Promise.resolve({data,error:null})}};
      }};
      const stats=createCloudStats({sb,
       context:()=>({active:true,clanId:"test",role:"owner",memberTags:["#PPPP"]}),
       notify:()=>{},confirmAction:async()=>true});
      await stats.load();
      document.querySelector('[data-stats-section="history"]').click();
      const svg=document.querySelector("#statsTrendChart svg");
      return {
       scope:document.getElementById("statsTrendScope").textContent,
       dots:[...svg.querySelectorAll("circle.series-cw")].map(e=>Number(e.getAttribute("cx"))),
       segments:svg.querySelectorAll("polyline.series-cw").length,
       gaps:svg.querySelectorAll(".stats-gap-mark").length,
       aria:svg.getAttribute("aria-label"),
       viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
      };
    },theme);
    assert.equal(data.dots.length,3,JSON.stringify(data));
    assert.equal(data.segments,1,"only adjacent August CWs may connect");
    assert.equal(data.gaps,1);
    assert.match(data.scope,/7 Wochen ohne dokumentierte Angriffe/);
    assert.match(data.aria,/Kalenderabstände maßstabsgetreu/);
    assert.ok(data.dots[2]-data.dots[1]>(data.dots[1]-data.dots[0])*6,
      "October must sit much farther away than the adjacent August week");
    assert.ok(data.scrollWidth<=data.viewport+3,
      "timeline must not cause horizontal scrolling at "+width);
    assert.deepEqual(errors,[],"Browser errors: "+errors.join(";"));
   }finally{await page.close()}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});
