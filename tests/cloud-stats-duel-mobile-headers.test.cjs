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

test("Duel CW/CWL values stay explicitly assigned to player A/B, aligned and readable on mobile",{
 timeout:120000
},async()=>{
  const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const viewports=[[320,"arena"],[375,"dark"],[390,"light"],[430,"arena"],
      [720,"dark"],[1366,"light"]];
    for(const [width,theme] of viewports){
      const page=await browser.newPage({viewport:{width,height:880}});
      try{
        const errors=[];page.on("pageerror",e=>errors.push(e.message));
        await page.goto("http://127.0.0.1:"+server.address().port+
          "/cloud-app.html",{waitUntil:"domcontentloaded"});
        const result=await page.evaluate(async theme=>{
          document.documentElement.dataset.theme=theme;
          document.documentElement.style.scrollBehavior="auto";
          document.body.classList.add("cloud-mode");
          document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
          document.querySelector("#view-stats").classList.add("active");
          const {createCloudStats}=await import("./cwl-stats.mjs");
          const wars=Array.from({length:8},(_,i)=>({
            war_key:"duel:clarity"+i,war_type:i%2?"cwl":"normal",
            started_at:new Date(Date.UTC(2026,9,15+i)).toISOString(),
            team_size:15,finalized:true,source:"api",opponent_name:"Opponent "+i
          }));
          const attacks=wars.flatMap((w,i)=>[
            {war_key:w.war_key,attacker_tag:"#2PYL",
              attacker_name:"Alpha besonders langer Clanmitgliedername",
              attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:1},
            {war_key:w.war_key,attacker_tag:"#2PQL",
              attacker_name:"Beta sehr langer Spielername",
              attacker_th:18,defender_th:18,stars:i%2?2:3,
              destruction:i%2?80:100,attack_order:1}
          ]);
          const sb={from(name){
            const data=name==="cwl_stat_wars"?wars:
              name==="cwl_stat_attacks"?attacks:[];
            return {select(){return this},eq(){return this},order(){return this},
              limit(){return Promise.resolve({data,error:null})},
              range(){return Promise.resolve({data,error:null})}};
          }};
          const stats=createCloudStats({sb,context:()=>({
            active:true,clanId:"duel-clarity-test",role:"viewer",
            memberTags:["#2PYL","#2PQL"]
          }),notify:()=>{},confirmAction:async()=>true});
          await stats.load();
          document.querySelector('[data-stats-section="compare"]').click();
          const header=document.querySelector(".stats-duel-split-head");
          const columns=[...header.querySelectorAll("span")];
          const cards=[...document.querySelectorAll(".stats-duel-grid .stats-duel-person")];
          const rows=[...document.querySelectorAll(".stats-duel-split-row")];
          const summaries=[...document.querySelectorAll(
            ".stats-duel-details>summary,.stats-matchup-breakdown>summary")];
          const checks={
            names:cards.map(c=>c.querySelector("h4").textContent.trim()),
            keys:cards.map(c=>c.querySelector(".stats-duel-player-key")?.textContent),
            header:columns.map(c=>c.textContent),
            headerFont:columns.map(c=>parseFloat(getComputedStyle(c).fontSize)),
            rowTypes:rows.map(r=>r.querySelector(".stats-duel-split-label").textContent),
            data:rows.map(row=>[...row.querySelectorAll(".stats-duel-split-value")]
              .map(v=>({text:v.textContent,description:v.getAttribute("aria-label")}))),
            aligned:rows.every(row=>{
              const values=[row.querySelector(".stats-duel-split-label"),
                ...row.querySelectorAll(".stats-duel-split-value")];
              return values.every((el,i)=>Math.abs(el.getBoundingClientRect().x-
                columns[i].getBoundingClientRect().x)<2);
            }),
            clipped:[...cards,...columns,...rows,...summaries]
              .some(el=>el.scrollWidth>el.clientWidth+2),
            summaryHeights:summaries.map(el=>el.getBoundingClientRect().height)
          };
          const matchup=document.querySelector(".stats-matchup-breakdown");
          const duel=document.querySelector(".stats-duel-details");
          matchup.open=true;duel.open=true;
          const duelSummary=duel.querySelector("summary");
          duelSummary.focus({preventScroll:true});
          attacks.push({
            war_key:wars[0].war_key,attacker_tag:"#2PYL",
            attacker_name:"Alpha besonders langer Clanmitgliedername",
            attacker_th:18,defender_th:18,stars:3,destruction:100,attack_order:2
          });
          await stats.load();
          const newDuel=document.querySelector(".stats-duel-details");
          const newMatchup=document.querySelector(".stats-matchup-breakdown");
          return {...checks,
            reloadOpen:newDuel.open&&newMatchup.open,
            reloadFocused:document.activeElement===newDuel.querySelector("summary"),
            headersAfterReload:[...document.querySelectorAll(".stats-duel-split-head span")]
              .map(el=>el.textContent),
            visibleCompare:document.querySelector('[data-stats-panel="compare"]').hidden===false,
            importHidden:document.getElementById("statsImportButton").hidden,
            overflow:document.documentElement.scrollWidth-innerWidth
          };
        },theme);
        const note=JSON.stringify({width,theme,result});
        assert.deepEqual(result.keys,["Spieler A","Spieler B"],note);
        assert.ok(result.names[0].includes("Alpha")&&result.names[1].includes("Beta"),note);
        assert.deepEqual(result.header,["Kriegsart","Spieler A","Spieler B"],note);
        assert.ok(result.headerFont.every(size=>size>=12),note);
        assert.deepEqual(result.rowTypes,["Normaler CW","CWL"],note);
        assert.ok(result.data.every((cells,i)=>cells.length===2&&
          cells[0].description.startsWith("Spieler A: "+result.rowTypes[i]+", ")&&
          cells[1].description.startsWith("Spieler B: "+result.rowTypes[i]+", ")),note);
        assert.equal(result.aligned,true,note);
        assert.equal(result.clipped,false,note);
        assert.ok(result.summaryHeights.every(h=>h>=44),note);
        assert.equal(result.reloadOpen,true,note);
        assert.equal(result.reloadFocused,true,note);
        assert.deepEqual(result.headersAfterReload,result.header,note);
        assert.equal(result.visibleCompare,true,note);
        assert.equal(result.importHidden,true,note);
        assert.ok(result.overflow<=3,note);
        assert.deepEqual(errors,[],note);
      }finally{await page.close();}
    }
  }finally{
    await browser.close();await new Promise(ok=>server.close(ok));
  }
});
