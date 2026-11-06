"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const ui=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");

test("Raw statistics never mix a selected-war lookback with independent 14/30/90-day form",()=>{
 assert.match(html,/2 von 2 ergeben 100 %/);
 assert.match(html,/40 von 60/);
 assert.match(html,/data-stats-panel="form"/);
 assert.match(html,/id="statsFormMethod"/);
 assert.match(html,/id="statsFormRows"/);
 assert.match(html,/id="statsCoverageGuide"/);
 assert.doesNotMatch(html,/id="statsFormDetails"/);
 assert.doesNotMatch(html,/id="statsBestPlayer"/);
 assert.match(ui,/computeComparableForm\(inputWars,attacks,options\[days\]\)/);
 assert.match(ui,/windowDays:14,recentDays:7/);
 assert.match(ui,/windowDays:30,recentDays:14/);
 assert.match(ui,/windowDays:90,recentDays:30/);
 assert.match(ui,/periodBySection/);
 assert.doesNotMatch(ui,/computeComparableForm\(selection,attacks\)/);
 assert.doesNotMatch(ui,/statsBestPlayer/);
 assert.match(html,/const DATA_VERSION=9/);
});

test("Data provenance is honest: ClashPerk guide only appears for incomplete CWL, not false zeroes",()=>{
 assert.match(html,/CWL-Missed-Attack-/);
 assert.match(html,/docs\.clashperk\.com\/features\/logs/);
 assert.match(html,/keine beliebigen Screenshots/);
 assert.match(ui,/guide\.hidden=!\(cwl\.wars>0&&!cwl\.complete\)/);
 assert.match(ui,/if\(guide\.hidden\)guide\.open=false/);
 assert.match(ui,/displayMissed=\(known,complete\)=>complete\?String\(known\)/);
 assert.doesNotMatch(ui,/computeComparableForm\(selection,attacks\)/);
 assert.match(ui,/selectStatWars\(wars,\{type,last,cwlSeasons\}\)/);
});

test("Statistics layout is legible across 320–1366px and five themes",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light","cyber","cyberlight"]){
   for(const width of [320,390,430,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     const metrics=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.getElementById("view-plan").classList.remove("active");
      document.getElementById("view-stats").classList.add("active");
      const players=document.querySelector('[data-stats-panel="players"]');
      const form=document.querySelector('[data-stats-panel="form"]');
      players.hidden=false;form.hidden=false;
      const help=document.getElementById("statsExplain");
      const method=document.getElementById("statsFormMethod");
      const guide=document.getElementById("statsCoverageGuide");
      guide.hidden=false;help.open=true;method.open=true;guide.open=true;
      const rows=document.getElementById("statsFormRows");
      rows.innerHTML="<div class='stats-form-row'><div class='stats-form-person'><b>Very Long Player Name RH18</b><small>Wenig Daten – keine sichere Einstufung</small></div>"+
       "<div class='stats-form-barcell' data-days='14'><strong>100 %</strong><small>2/2</small><span class='stats-percent-track'><span class='stats-percent-fill' style='width:100%'></span></span></div>"+
       "<div class='stats-form-barcell' data-days='30'><strong>67 %</strong><small>2/3</small><span class='stats-percent-track'><span class='stats-percent-fill' style='width:67%'></span></span></div>"+
       "<div class='stats-form-barcell' data-days='90'><strong>45 %</strong><small>10/22</small><span class='stats-percent-track'><span class='stats-percent-fill' style='width:45%'></span></span></div>"+
       "<small class='stats-form-source'>CW: 10 · CWL: 12</small></div>";
      const statsRows=document.getElementById("statsRows");
      statsRows.innerHTML="<div class='stats-player-row'><div class='stats-player'><span class='stats-th'>RH18</span><div class='stats-name'><b>LongPlayerName</b></div></div><div class='stats-hit-cell'><small class='stats-mobile-label'>3★-Quote</small><strong class='stats-rate'>100 %</strong><small class='stats-rate-avg'>Ø 3,00 ★</small></div><span class='stats-number'><small class='stats-mobile-label'>Angriffe</small>2</span><span class='stats-number stats-missed-cell'><small class='stats-mobile-label'>Verpasst</small><strong>k. A.</strong></span><details class='stats-player-details'><summary>Datengrundlage</summary></details></div>";
      const rect=x=>x.getBoundingClientRect();
      const row=rows.querySelector(".stats-form-row");
      const formBars=[...row.querySelectorAll(".stats-form-barcell")];
      const panel=getComputedStyle(guide);
      const reads=[...document.querySelectorAll("#view-stats :is(.stats-explain,.stats-form-method,.stats-coverage-guide)>summary")];
      const playerRow=statsRows.querySelector(".stats-player-row");
      return {
       docWidth:document.documentElement.scrollWidth,viewport:innerWidth,
       rowWidth:rect(row).width,rowChildren:[...row.children].map(x=>rect(x).width),
       formColumns:getComputedStyle(row).gridTemplateColumns.split(" ").length,
       visibleFormBars:formBars.filter(el=>rect(el).width>0).length,
       guideBorderLeft:panel.borderLeftWidth,headHeights:reads.map(x=>rect(x).height),
       mainText:parseFloat(getComputedStyle(document.querySelector(".stats-reading-copy")).fontSize),
       methodVisible:!form.hidden&&method.open&&help.open&&guide.open,
       playerColumns:getComputedStyle(playerRow).gridTemplateColumns.split(" ").length,
       mobileLabel:getComputedStyle(playerRow.querySelector(".stats-mobile-label")).display,
       tableHead:getComputedStyle(document.querySelector(".stats-player-head")).display,
       playerWidth:rect(playerRow).width,
       playerChildren:[...playerRow.children].map(x=>rect(x).width)
      };
     },theme);
     const note=JSON.stringify({theme,width,metrics});
     assert.ok(metrics.docWidth<=width+3,note);
     assert.ok(metrics.rowWidth>0,note);
     assert.equal(metrics.formColumns,width<=699?3:4,note);
     assert.equal(metrics.visibleFormBars,3,note);
     assert.equal(metrics.guideBorderLeft,"0px",note);
     assert.ok(metrics.headHeights.every(n=>n>=43.5),note);
     assert.ok(metrics.mainText>=13,note);
     assert.equal(metrics.methodVisible,true,note);
     if(width<=699){
       assert.ok(metrics.rowChildren.every(w=>w<=metrics.rowWidth+2),note);
       assert.equal(metrics.playerColumns,3,note);
       assert.equal(metrics.mobileLabel,"block",note);
       assert.equal(metrics.tableHead,"none",note);
       assert.ok(metrics.playerChildren.every(w=>w<=metrics.playerWidth+2),note);
     }else{
       assert.equal(metrics.playerColumns,4,note);
       assert.equal(metrics.mobileLabel,"none",note);
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
