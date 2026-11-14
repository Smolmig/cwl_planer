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

test("All five statistics sections fit a balanced mobile 3+2 navigation and a desktop single row",{
  timeout:120000
},async()=>{
  const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    const sizes=[[320,"arena"],[375,"dark"],[390,"light"],[430,"arena"],
      [720,"dark"],[820,"light"],[1366,"arena"]];
    for(const [width,theme] of sizes){
      const page=await browser.newPage({viewport:{width,height:880}});
      try{
        const problems=[];page.on("pageerror",err=>problems.push(err.message));
        await page.goto("http://127.0.0.1:"+server.address().port+
          "/cloud-app.html",{waitUntil:"domcontentloaded"});
        const result=await page.evaluate(async selectedTheme=>{
          document.documentElement.dataset.theme=selectedTheme;
          document.body.classList.add("cloud-mode");
          document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
          document.querySelector("#view-stats").classList.add("active");
          const {createCloudStats}=await import("./cwl-stats.mjs");
          const wars=[{war_key:"normal:navigation",war_type:"normal",
            started_at:"2026-11-05T10:00:00Z",team_size:15,
            finalized:true,source:"import",opponent_name:"Example"}];
          const attacks=[{war_key:"normal:navigation",attacker_tag:"#2PYL",
            attacker_name:"Sample",attacker_th:18,defender_th:18,
            attack_order:1,stars:3,destruction:100}];
          const sb={from(name){
            const data=name==="cwl_stat_wars"?wars:
              name==="cwl_stat_attacks"?attacks:[];
            return {select(){return this},eq(){return this},order(){return this},
              limit(){return Promise.resolve({data,error:null})},
              range(){return Promise.resolve({data,error:null})}};
          }};
          const stats=createCloudStats({sb,context:()=>({
            active:true,clanId:"nav-test",role:"viewer",memberTags:["#2PYL"]
          }),notify:()=>{},confirmAction:async()=>true});
          await stats.load();
          const nav=document.getElementById("statsSectionTabs");
          const buttons=[...nav.querySelectorAll("button[data-stats-section]")];
          const rects=buttons.map(el=>{
            const box=el.getBoundingClientRect();
            return {x:box.x,y:box.y,width:box.width,height:box.height,
              overflows:el.scrollWidth>el.clientWidth+1};
          });
          const checks=[];
          for(const button of buttons){
            button.focus({preventScroll:true});
            button.click();
            const active=buttons.filter(el=>el.getAttribute("aria-pressed")==="true");
            const visible=[...document.querySelectorAll("#view-stats [data-stats-panel]")]
              .filter(el=>!el.hidden&&getComputedStyle(el).display!=="none");
            checks.push({
              key:button.dataset.statsSection,
              oneActive:active.length===1&&active[0]===button,
              onePanel:visible.length===1&&visible[0].dataset.statsPanel===button.dataset.statsSection,
              focused:document.activeElement===button
            });
          }
          await stats.load();
          const last=buttons.at(-1);
          const reload={active:last.getAttribute("aria-pressed")==="true",
            panel:document.querySelector('[data-stats-panel="history"]').hidden===false};
          // Readability and touch sizes of the form and comparison filters.
          buttons.find(el=>el.dataset.statsSection==="form").click();
          const formWindows=[...document.querySelectorAll(".stats-form-window button")];
          const formButtons=formWindows.map(el=>{
            const rect=el.getBoundingClientRect();
            return {height:rect.height,width:rect.width,font:parseFloat(getComputedStyle(el).fontSize),
              detailFont:parseFloat(getComputedStyle(el.querySelector("small")).fontSize),
              clips:el.scrollWidth>el.clientWidth+1};
          });
          const formControls=["statsFormSearch","statsFormSort"].map(id=>
            document.getElementById(id).getBoundingClientRect().height);
          const formNotes=[];
          for(const el of formWindows){
            el.focus({preventScroll:true});el.click();
            formNotes.push({active:el.getAttribute("aria-pressed")==="true",
              focused:document.activeElement===el,
              text:document.getElementById("statsFormIntro").textContent});
          }
          formWindows[1].click();
          const formReload=await stats.load().then(()=>({
            active:formWindows[1].getAttribute("aria-pressed")==="true",
            text:document.getElementById("statsFormIntro").textContent
          }));
          buttons.find(el=>el.dataset.statsSection==="compare").click();
          const compareControls=["statsCompareType","statsCompareDays"].map(id=>
            document.getElementById(id).getBoundingClientRect().height);
          return {rects,checks,activeAfterReload:reload.active,
            headerAfterReload:reload.panel,
            formButtons,formControls,compareControls,formNotes,formReload,
            importHidden:document.getElementById("statsImportButton").hidden,
            navWidth:nav.getBoundingClientRect().width,
            horizontalOverflow:document.documentElement.scrollWidth-innerWidth};
        },theme);
        const msg=JSON.stringify({width,theme,result});
        assert.equal(result.rects.length,5,msg);
        assert.ok(result.rects.every(r=>r.height>=44&&r.width>0&&!r.overflows),msg);
        if(width<=720){
          const rs=result.rects;
          assert.ok(rs.slice(0,3).every(r=>Math.abs(r.y-rs[0].y)<2),msg);
          assert.ok(Math.abs(rs[3].y-rs[4].y)<2&&rs[3].y>rs[0].y+rs[0].height-2,msg);
          assert.ok(Math.abs(rs[3].x-rs[0].x)<2,msg);
          assert.ok(Math.abs((rs[4].x+rs[4].width)-(rs[2].x+rs[2].width))<2,msg);
          assert.ok(Math.abs(rs[3].width-rs[4].width)<2,msg);
        }else{
          assert.ok(result.rects.every(r=>Math.abs(r.y-result.rects[0].y)<2),msg);
        }
        assert.ok(result.checks.every(c=>c.oneActive&&c.onePanel&&c.focused),msg);
        assert.equal(result.activeAfterReload,true,msg);
        assert.equal(result.headerAfterReload,true,msg);
        assert.equal(result.importHidden,true,msg);
        assert.equal(result.formButtons.length,3,msg);
        assert.ok(result.formButtons.every(b=>b.height>=58&&b.width>0&&!b.clips),msg);
        assert.ok(result.formControls.every(h=>h>=44),msg);
        assert.ok(result.compareControls.every(h=>h>=44),msg);
        if(width<=720){
          assert.ok(result.formButtons.every(b=>b.height>=64&&b.font>=13&&b.detailFont>=12),msg);
        }
        assert.ok(result.formNotes.every((n,i)=>n.active&&n.focused&&
          n.text.includes("Sortiert nach Formwert")&&
          n.text.includes("Spieler mit vergleichbaren Angriffen")&&
          n.text.length<190),msg);
        assert.equal(result.formReload.active,true,msg);
        assert.ok(result.formReload.text.includes("Sortiert nach Formwert"),msg);
        assert.ok(result.horizontalOverflow<=3,msg);
        assert.deepEqual(problems,[],msg);
      }finally{await page.close()}
    }
  }finally{
    await browser.close();await new Promise(ok=>server.close(ok));
  }
});
