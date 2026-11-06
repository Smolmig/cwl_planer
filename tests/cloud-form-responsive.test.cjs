"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8")
 .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");

test("Independent 14/30/90-day form bars fit phone and desktop in all themes",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","cyberlight","dark","light"]){
   for(const width of [320,390,430,1366]){
    const page=await browser.newPage({viewport:{width,height:880}});
    try{
     await page.setContent(html,{waitUntil:"domcontentloaded"});
     const m=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(e=>e.classList.remove("active"));
      document.getElementById("view-stats").classList.add("active");
      const panel=document.querySelector('[data-stats-panel="form"]');
      panel.hidden=false;
      const method=document.getElementById("statsFormMethod");method.open=true;
      const rows=document.getElementById("statsFormRows");
      rows.innerHTML="<div class='stats-form-row'><div class='stats-form-person'>"+
       "<b>UF⚡️Spieler mit sehr langem Namen</b>"+
       "<small>Kurze Stichprobe – kein Stärkerang</small></div>"+
       [14,30,90].map((days,i)=>"<div class='stats-form-barcell' data-days='"+days+
         "'><strong>"+[100,75,66][i]+" %</strong><small>"+[2,12,22][i]+
         " Angriffe</small><span class='stats-percent-track'><span class='stats-percent-fill' style='width:"+
         [100,75,66][i]+"%'></span></span></div>").join("")+
       "<small class='stats-form-source'>CWL 8 · normaler CW 14</small></div>";
      const rect=x=>x.getBoundingClientRect();
      const row=rows.querySelector(".stats-form-row");
      const b=rows.querySelector(".stats-form-person b");
      const small=rows.querySelector(".stats-form-person small");
      const summary=method.querySelector("summary");
      return {
       viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
       panelLeft:rect(panel).left,panelRight:rect(panel).right,
       rowScroll:row.scrollWidth,rowWidth:row.clientWidth,
       columns:getComputedStyle(row).gridTemplateColumns.split(" ").length,
       bars:[...row.querySelectorAll(".stats-form-barcell")].map(el=>rect(el).width),
       summaryHeight:rect(summary).height,
       nameSize:parseFloat(getComputedStyle(b).fontSize),
       descriptionSize:parseFloat(getComputedStyle(small).fontSize)
      };
     },theme);
     const desc=JSON.stringify({theme,width,metrics:m});
     assert.ok(m.scrollWidth<=width+3,desc);
     assert.ok(m.panelLeft>=-3,desc);
     assert.ok(m.panelRight<=width+3,desc);
     assert.ok(m.rowScroll<=m.rowWidth+3,desc);
     assert.equal(m.columns,width<=699?3:4,desc);
     assert.ok(m.bars.every(x=>x>0),desc);
     assert.ok(m.summaryHeight>=43,desc);
     assert.ok(m.nameSize>=13,desc);
     assert.ok(m.descriptionSize>=11,desc);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
