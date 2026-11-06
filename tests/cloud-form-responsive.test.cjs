"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8")
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");

test("Comparable 30/90-day form disclosure stays within mobile stats width in all themes",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","cyberlight","dark","light"]){
   for(const width of [320,390,430,1366]){
    const page=await browser.newPage({viewport:{width,height:880}});
    try{
     await page.setContent(html,{waitUntil:"domcontentloaded"});
     const metrics=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      document.querySelector('[data-stats-panel="form"]').hidden=false;
      const details=document.getElementById("statsFormDetails");details.open=true;
      document.getElementById("statsFormIntro").textContent=
       "90 Tage: 1004 Angriffe gegen gleiches Rathaus. Mirror-Positionen nicht belegt.";
      document.getElementById("statsFormRows").innerHTML=
       "<div class='stats-form-row'><div class='stats-form-person'>"+
       "<b>UF⚡️Spieler mit sehr langem Namen</b>"+
       "<small>Erste Tendenz · 3 andere RH-Ziele nicht gewertet</small></div>"+
       "<div class='stats-form-results'><div><strong>75 % 3★ · Ø 2,75 ★</strong>"+
       "<small>Letzte 30 Tage · 12 Angriffe</small></div>"+
       "<div><span>90 Tage zeitgewichtet: 66 % 3★ · Ø 2,62 ★ · n_eff 13,5</span>"+
       "<small>CWL 8 · 50 % / CW 14 · 71 %</small></div></div></div>";
      const detailsRect=details.getBoundingClientRect();
      const row=document.getElementById("statsFormRows").querySelector(".stats-form-row");
      const small=document.getElementById("statsFormRows").querySelector(".stats-form-person small");
      return {
       viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       panelLeft:detailsRect.left,panelRight:detailsRect.right,
       rowScroll:row.scrollWidth,rowWidth:row.clientWidth,
       summaryHeight:details.querySelector("summary").getBoundingClientRect().height,
       nameSize:parseFloat(getComputedStyle(row.querySelector("b")).fontSize),
       descriptionSize:parseFloat(getComputedStyle(small).fontSize)
      };
     },theme);
     const desc=JSON.stringify({theme,width,metrics});
     assert.ok(metrics.scrollWidth<=width+3,desc);
     assert.ok(metrics.panelLeft>=-3,desc);
     assert.ok(metrics.panelRight<=width+3,desc);
     assert.ok(metrics.rowScroll<=metrics.rowWidth+3,desc);
     assert.ok(metrics.summaryHeight>=43,desc);
     assert.ok(metrics.nameSize>=13,desc);
     assert.ok(metrics.descriptionSize>=11,desc);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
