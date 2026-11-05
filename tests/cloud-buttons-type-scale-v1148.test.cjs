"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const raw=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const staticHtml=raw.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");

test("Button font sizes and touch areas are readable at narrow widths in every theme",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","cyberlight","light","dark"]){
   for(const width of [320,390,430,1366]){
    const page=await browser.newPage({viewport:{width,height:850}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     const measurements=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.getElementById("planOverview").classList.add("overview-open");
      document.getElementById("planDays").innerHTML=
        '<div class="day-card"><div class="day-actions">'+
        '<button class="btn small" id="auditDayButton">Aufstellung bearbeiten</button>'+
        '<button class="btn small" id="auditLongButton">Aufstellungswechsel kopieren</button></div></div>';
      const metrics=el=>{
       if(!el)return null;
       const css=getComputedStyle(el);
       const rect=el.getBoundingClientRect();
       return {font:parseFloat(css.fontSize),min:parseFloat(css.minHeight)||0,
        height:rect.height,boxWidth:rect.width,scroll:el.scrollWidth,
        client:el.clientWidth};
      };
      const tabs=[...document.querySelectorAll(".navinner .navbtn")]
       .filter(el=>getComputedStyle(el).display!=="none")
       .map(el=>({label:el.textContent.trim(),...metrics(el)}));
      // Recheck the optional fifth destination without relying on a fixed
      // number of navigation buttons or an empty ghost grid column.
      const hiddenGrid=getComputedStyle(document.querySelector(".navinner")).gridTemplateColumns;
      const statsNav=document.getElementById("statsNav");
      statsNav.hidden=false;
      const allTabs=[...document.querySelectorAll(".navinner .navbtn")]
       .filter(el=>getComputedStyle(el).display!=="none")
       .map(el=>({label:el.textContent.trim(),...metrics(el)}));
      const visibleGrid=getComputedStyle(document.querySelector(".navinner")).gridTemplateColumns;
      statsNav.hidden=true;
      const plan=metrics(document.getElementById("copyFullPlanBtn"));
      const day=metrics(document.getElementById("auditDayButton"));
      const long=metrics(document.getElementById("auditLongButton"));
      const overview=metrics(document.getElementById("mobileOverviewToggle"));
      const desktop=metrics(document.getElementById("singleDayMode"));
      return {tabs,allTabs,hiddenGrid,visibleGrid,plan,day,long,overview,desktop,
        docWidth:document.documentElement.scrollWidth,viewport:innerWidth};
     },theme);
     const desc=JSON.stringify({theme,width,measurements});
     assert.ok(measurements.docWidth<=width+3,desc);
     if(width<=699){
      assert.ok(measurements.tabs.length>=3,desc);
      assert.equal(measurements.tabs.length,4,desc);
      assert.equal(measurements.allTabs.length,5,desc);
      assert.equal(measurements.hiddenGrid.split(" ").length,4,desc);
      assert.equal(measurements.visibleGrid.split(" ").length,5,desc);
      for(const tab of [...measurements.tabs,...measurements.allTabs]){
       assert.ok(tab.font>=(width<=375?11:12)-.05,desc);
       assert.ok(tab.min>=46,desc);
       assert.ok(tab.height>=45,desc);
       assert.ok(tab.scroll<=tab.client+2,desc);
      }
      for(const key of ["plan","day","long","overview"]){
       const v=measurements[key];
       assert.ok(v.font>=13,desc);
       assert.ok(v.min>=44,desc);
      }
     }else{
      assert.ok(measurements.plan.font>=13,desc);
      assert.ok(measurements.desktop.font>=13,desc);
     }
    }finally{await page.close();}
   }
  }
 }finally{await browser.close();}
});

test("Compact phone landscape controls are not resized by portrait-only audit rules",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:640,height:360}});
  try{
   await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
   const result=await page.evaluate(()=>{
    document.body.classList.add("cloud-mode");
    document.getElementById("planDays").innerHTML=
     '<div class="day-card"><div class="day-actions">'+
     '<button class="btn small" id="compactDay">Aufstellung bearbeiten</button></div></div>';
    const el=document.getElementById("compactDay");
    const style=getComputedStyle(el);
    return {minimum:parseFloat(style.minHeight),font:parseFloat(style.fontSize)};
   });
   assert.ok(result.minimum<=40,JSON.stringify(result));
   assert.ok(result.font<=12,JSON.stringify(result));
  }finally{await page.close();}
 }finally{await browser.close();}
});
