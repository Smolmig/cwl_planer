"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const raw=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const html=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");

test("CW and CWL missed coverage stays readable at 320–1366px in all themes",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","cyberlight","dark","light"]){
   for(const width of [320,390,430,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(html,{waitUntil:"domcontentloaded"});
     const check=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
      const view=document.getElementById("view-stats");view.classList.add("active");
      const coverage=document.getElementById("statsMissedCoverage");
      coverage.textContent="Nachgewiesene Ausfälle: CW: 57 verpasst · 30/30 Kriege vollständig · "+
       "CWL: mind. 2 verpasst · 1/22 Kriege vollständig erfasst";
      const rows=document.getElementById("statsRows");
      rows.innerHTML="<div class='stats-player-row'>"+
       "<div class='stats-player'><span class='stats-th'>RH18</span>"+
       "<div class='stats-name'><b>Viel zu langer Clan-Spielername</b></div></div>"+
       "<div class='stats-hit-cell'><strong class='stats-rate'>72 %</strong>"+
       "<small class='stats-rate-avg'>Ø 2,55 ★</small></div>"+
       "<span class='stats-number'>27</span>"+
       "<span class='stats-number stats-missed-cell warn'>"+
       "<strong>mind. 12</strong><small>CW 11</small><small>CWL mind. 1</small></span></div>";
      const item=rows.querySelector(".stats-missed-cell");
      const text=item.querySelector("small");
      const width=item.getBoundingClientRect().width;
      return {
        overall:document.documentElement.scrollWidth,
        viewport:innerWidth,
        cellWidth:width,
        cellScroll:item.scrollWidth,
        smallStyle:getComputedStyle(text).fontSize,
        text:coverage.textContent,
        contentVisible:getComputedStyle(coverage).display!=="none"
      };
     },theme);
     const msg=JSON.stringify({theme,width,check});
     assert.ok(check.overall<=width+3,msg);
     assert.ok(check.cellScroll<=check.cellWidth+3,msg);
     assert.ok(check.contentVisible,msg);
     assert.match(check.text,/30\/30/);
     assert.match(check.text,/1\/22/);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
