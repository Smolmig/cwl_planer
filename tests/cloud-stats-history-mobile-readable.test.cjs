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
  const file=new URL(req.url||"/","http://localhost").pathname.slice(1);
  if(file==="cloud-sync.mjs"){
    res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return;
  }
  if(file==="cloud-app.html"||file==="cwl-planning-core.js"||
    /^[a-z0-9-]+\.mjs$/.test(file)){
    if(fs.existsSync(path.join(root,file))){
      res.writeHead(200,{"content-type":file.endsWith(".html")?"text/html":"text/javascript"});
      res.end(read(file));return;
    }
  }
  res.writeHead(404);res.end("");
});

test("History table scrolls within its region; war and attack details stay readable and survive reload",{
  timeout:120000
},async()=>{
  const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const viewports=[[320,"arena"],[375,"dark"],[390,"light"],[430,"arena"],
      [550,"dark"],[720,"light"],[1366,"arena"]];
    for(const [width,theme] of viewports){
      const page=await browser.newPage({viewport:{width,height:880}});
      try{
        const errors=[];page.on("pageerror",err=>errors.push(err.message));
        await page.goto("http://127.0.0.1:"+server.address().port+
          "/cloud-app.html",{waitUntil:"domcontentloaded"});
        const result=await page.evaluate(async theme=>{
          document.documentElement.dataset.theme=theme;
          document.documentElement.style.scrollBehavior="auto";
          document.body.classList.add("cloud-mode");
          document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
          document.querySelector("#view-stats").classList.add("active");
          const {createCloudStats}=await import("./cwl-stats.mjs");
          const wars=Array.from({length:36},(_,i)=>({
            war_key:"history:mobile"+i,war_type:i%2?"cwl":"normal",
            started_at:new Date(Date.UTC(2026,9,1+i)).toISOString(),
            team_size:15,finalized:true,source:"api",
            opponent_name:"GegnerclanMitExtremLangemNamenOhneWorttrennung_"+i
          }));
          const attacks=wars.flatMap((w,i)=>[
            {war_key:w.war_key,attacker_tag:"#2PYL",
              attacker_name:"SpielerMitExtremLangemNamenOhneWorttrennung",
              attacker_th:18,defender_name:"BasisMitEinemExtremLangenNamenOhneLeerzeichen",
              defender_th:18,stars:3,destruction:100,attack_order:1},
            {war_key:w.war_key,attacker_tag:"#2PQL",
              attacker_name:"Anderer sehr langer Spielername",
              attacker_th:18,defender_name:"Ein wirklich sehr langer Gegnername",
              defender_th:18,stars:i%2?2:3,destruction:i%2?85:100,attack_order:1}
          ]);
          const sb={from(name){
            const data=name==="cwl_stat_wars"?wars:
              name==="cwl_stat_attacks"?attacks:[];
            return {select(){return this},eq(){return this},order(){return this},
              limit(){return Promise.resolve({data,error:null})},
              range(){return Promise.resolve({data,error:null})}};
          }};
          const stats=createCloudStats({sb,context:()=>({
            active:true,clanId:"history-mobile-test",role:"viewer",
            memberTags:["#2PYL","#2PQL"]
          }),notify:()=>{},confirmAction:async()=>true});
          await stats.load();
          document.querySelector('[data-stats-section="history"]').click();
          const selects=[...document.querySelectorAll(".stats-trend-controls select")];
          const controlHeights=selects.map(el=>el.getBoundingClientRect().height);
          const plot=document.querySelector("#statsTrendChart svg");
          const plotRect=plot?.getBoundingClientRect();
          const disclosure=document.querySelector("#statsTrendTable details");
          disclosure.open=true;
          const table=document.querySelector(".stats-war-history-scroll");
          const headerFonts=[...table.querySelectorAll("th")]
            .map(el=>parseFloat(getComputedStyle(el).fontSize));
          const tableLayout={
            role:table.getAttribute("role"),
            tabIndex:table.tabIndex,
            client:table.clientWidth,
            scroll:table.scrollWidth,
            minWidth:parseFloat(getComputedStyle(table.querySelector("table")).minWidth),
            overflowX:getComputedStyle(table).overflowX,
            rows:table.querySelectorAll("tbody tr").length
          };
          table.scrollLeft=60;
          const previousScroll=table.scrollLeft;
          table.focus({preventScroll:true});
          attacks.push({...attacks[0],attack_order:2});
          await stats.load();
          const nextTable=document.querySelector(".stats-war-history-scroll");
          const reload={
            open:document.querySelector("#statsTrendTable details").open,
            focused:document.activeElement===nextTable,
            scrollLeft:nextTable.scrollLeft,
            previousScroll,
            replaced:nextTable!==table
          };
          const war=document.querySelector("#statsWarHistory .war-history-item");
          war.open=true;
          await new Promise(resolve=>setTimeout(resolve,0));
          const summary=war.querySelector("summary");
          const summaryParts=[...summary.children].map(el=>el.getBoundingClientRect());
          // The UI sorts attacks alphabetically: select our long-name case by identity.
          const attack=[...war.querySelectorAll(".war-history-attack")]
            .find(el=>el.textContent.includes("SpielerMitExtremLangem"));
          const attackParts=[...attack.children].map(el=>el.getBoundingClientRect());
          const warChecks={
            summaryHeight:summary.getBoundingClientRect().height,
            headingLine:summaryParts[0].bottom,
            statsLine:summaryParts[1].top,
            attackHeadingLine:attackParts[0].bottom,
            attackStatsLine:attackParts[1].top,
            summaryClient:summary.clientWidth,summaryScroll:summary.scrollWidth,
            attackClient:attack.clientWidth,attackScroll:attack.scrollWidth,
            opponentText:summary.querySelector("small")?.textContent,
            attackText:attack.textContent
          };
          summary.focus({preventScroll:true});
          attacks.push({...attacks[2],attack_order:3});
          await stats.load();
          const renewed=document.querySelector(
            '#statsWarHistory [data-war-key="'+war.dataset.warKey+'"]');
          return {controls:controlHeights,plotWidth:plotRect?.width,
            plotAccessible:plot?.getAttribute("aria-label")?.includes("Kreise"),
            table:tableLayout,reload,war:warChecks,
            warReload:{open:renewed?.open,
              focused:document.activeElement===renewed?.querySelector("summary")},
            outerOverflow:document.documentElement.scrollWidth-innerWidth,
            importHidden:document.getElementById("statsImportButton").hidden
          };
        },theme);
        const note=JSON.stringify({width,theme,result});
        assert.ok(result.controls.length===4&&result.controls.every(v=>v>=44),note);
        assert.ok(result.plotWidth>0&&result.plotAccessible,note);
        assert.equal(result.table.role,"region",note);
        assert.equal(result.table.tabIndex,0,note);
        assert.ok(result.table.minWidth>=420&&result.table.rows>=1,note);
        assert.ok(["auto","scroll"].includes(result.table.overflowX),note);
        assert.ok(result.table.client>0,note);
        if(width<=430)assert.ok(result.table.scroll>result.table.client+30,note);
        assert.equal(result.reload.replaced,true,note);
        assert.equal(result.reload.open,true,note);
        assert.equal(result.reload.focused,true,note);
        assert.ok(Math.abs(result.reload.scrollLeft-result.reload.previousScroll)<=2,note);
        assert.ok(result.table.rows>=1&&result.war.summaryHeight>=44,note);
        assert.ok(result.war.opponentText.includes("GegnerclanMitExtremLangem"),note);
        assert.ok(result.war.attackText.includes("SpielerMitExtremLangem"),note);
        if(width<=550){
          assert.ok(result.war.statsLine>=result.war.headingLine-2,note);
          assert.ok(result.war.attackStatsLine>=result.war.attackHeadingLine-2,note);
        }else{
          assert.ok(result.war.statsLine<result.war.headingLine,note);
          assert.ok(result.war.attackStatsLine<result.war.attackHeadingLine,note);
        }
        assert.ok(result.war.summaryScroll<=result.war.summaryClient+2,note);
        assert.ok(result.war.attackScroll<=result.war.attackClient+2,note);
        assert.ok(result.warReload.open&&result.warReload.focused,note);
        assert.equal(result.importHidden,true,note);
        assert.ok(result.outerOverflow<=3,note);
        assert.deepEqual(errors,[],note);
      }finally{await page.close();}
    }
  }finally{
    await browser.close();await new Promise(ok=>server.close(ok));
  }
});
