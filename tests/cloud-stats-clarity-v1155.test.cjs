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

test("Stats explain 2-of-2 samples and no longer crown an unvalidated top player",()=>{
 assert.match(html,/2 von 2 ergeben 100 %/);
 assert.match(html,/40 von 60/);
 assert.doesNotMatch(html,/id="statsBestPlayer"/);
 assert.match(html,/Aktuelle Form \(mit Datenmenge\)/);
 assert.match(html,/id="statsFormDetails"/);
 assert.match(html,/id="statsFormMethod"/);
 assert.match(html,/id="statsCoverageGuide"/);
 assert.match(ui,/qualityLabel=\{none:/);
 assert.match(ui,/p\.last30\.triples/);
 assert.match(ui,/p\.last90\.attacks/);
 assert.match(ui,/p\.weighted90\.hitRate/);
 assert.match(ui,/form\.performanceRankable/);
 assert.match(ui,/summary\.missedCoverage\.cwl/);
 assert.doesNotMatch(ui,/statsBestPlayer/);
 assert.doesNotMatch(ui,/n_eff/);
 assert.doesNotMatch(ui,/performanceIndex\+"\/100"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(ui,/Mirror-Position/);
});

test("Data provenance is honest: ClashPerk guide only appears for incomplete CWL, not false zeroes",()=>{
 assert.match(html,/CWL-Missed-Attack-/);
 assert.match(html,/docs\.clashperk\.com\/features\/logs/);
 assert.match(html,/keine beliebigen Screenshots/);
 assert.match(ui,/guide\.hidden=!\(cwl\.wars>0&&!cwl\.complete\)/);
 assert.match(ui,/if\(guide\.hidden\)guide\.open=false/);
 assert.match(ui,/displayMissed=\(known,complete\)=>complete\?String\(known\)/);
 assert.match(ui,/computeComparableForm\(selection,attacks\)/);
 assert.match(ui,/selectStatWars\(wars,\{type,last,cwlSeasons\}\)/);
});

test("Statistics layout is legible and border-light across 320–1366px and all themes",{
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
      const help=document.getElementById("statsExplain");
      const form=document.getElementById("statsFormDetails");
      const guide=document.getElementById("statsCoverageGuide");
      const rows=document.getElementById("statsFormRows");
      guide.hidden=false;form.open=true;help.open=true;guide.open=true;
      rows.innerHTML="<div class='stats-form-row'><div class='stats-form-person'><b>Very Long Player Name RH18</b><span class='stats-form-quality'>Wenig Daten</span><small>Keine belastbare Rang-Einordnung</small></div><div class='stats-form-results'><div class='stats-form-cell'><span>Letzte 30 Tage</span><strong>100 %</strong><small>2 von 2 Angriffen mit 3★</small></div><div class='stats-form-cell'><span>90-Tage-Trend</span><strong>87 %</strong><small>2 gleich-RH-Angriffe · neuere zählen stärker</small></div><small class='stats-form-breakdown'>CWL: 1 Angriff · normaler CW: 1 Angriff</small></div></div>";
      const statsRows=document.getElementById("statsRows");
      statsRows.innerHTML="<div class='stats-player-row'><div class='stats-player'><span class='stats-th'>RH18</span><div class='stats-name'><b>LongPlayerName</b></div></div><div class='stats-hit-cell'><small class='stats-mobile-label'>3★-Quote</small><strong class='stats-rate'>100 %</strong><small class='stats-rate-avg'>Ø 3,00 ★</small></div><span class='stats-number'><small class='stats-mobile-label'>Angriffe</small>2</span><span class='stats-number stats-missed-cell'><small class='stats-mobile-label'>Verpasst</small><strong>k. A.</strong></span><small class='stats-form-score'>Vergleich: Wenig Daten · 2 gleich-RH-Angriffe</small><details class='stats-player-details'><summary>Letzte Kriege</summary></details></div>";
      const playerRow=statsRows.querySelector(".stats-player-row");
      const rect=x=>x.getBoundingClientRect();
      const row=rows.querySelector(".stats-form-row"),results=row.querySelector(".stats-form-results");
      const panel=getComputedStyle(guide);
      const reads=[...document.querySelectorAll("#view-stats :is(.stats-explain,.stats-form-method,.stats-coverage-guide)>summary")];
      return {
       docWidth:document.documentElement.scrollWidth,
       viewport:innerWidth,
       rowWidth:rect(row).width,
       rowChildren:[...row.children].map(x=>rect(x).width),
       resultColumns:getComputedStyle(results).gridTemplateColumns.split(" ").length,
       guideBorderLeft:panel.borderLeftWidth,
       headHeights:reads.map(x=>rect(x).height),
       mainText:parseFloat(getComputedStyle(document.querySelector(".stats-reading-copy")).fontSize),
       methodVisible:form.open&&help.open&&guide.open,
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
     assert.equal(metrics.resultColumns,2,note);
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
