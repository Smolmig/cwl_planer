"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");

test("Compact Cloud deployment filters fit 320/390/430px in Gold, Dark and Light without overflow",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,768,1240]){
    const page=await browser.newPage({viewport:{width,height:840}});
    try{
     await page.setContent(markup,{waitUntil:"domcontentloaded"});
     const info=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelector("#view-plan")?.classList.remove("active");
      document.getElementById("view-summary").classList.add("active");
      document.getElementById("summaryCloudFilters").hidden=false;
      document.getElementById("summaryFilter").hidden=true;
      document.querySelector(".summary-tools").classList.add("cloud-filter-mode");
      const selects=[...document.querySelectorAll("#summaryCloudFilters select")];
      const rects=selects.map(el=>el.getBoundingClientRect().toJSON());
      const search=document.getElementById("summarySearch").getBoundingClientRect();
      const legacy=document.getElementById("summaryFilter").getBoundingClientRect();
      return {
       scrollWidth:document.documentElement.scrollWidth,
       viewport:innerWidth,
       selectHeights:rects.map(r=>r.height),
       firstRow:Math.abs(rects[0].top-rects[1].top)<2,
       secondRow:Math.abs(rects[2].top-rects[3].top)<2,
       fourSameRow:Math.abs(rects[0].top-rects[3].top)<2,
       legacyHidden:legacy.width===0&&legacy.height===0,
       searchWidth:search.width,
       rows:selects.length
      };
     },theme);
     const context=JSON.stringify({theme,width,info});
     assert.ok(info.scrollWidth<=width+3,context);
     assert.equal(info.rows,4,context);
     assert.ok(info.searchWidth>90,context);
     assert.ok(info.selectHeights.every(h=>h>=37),context);
     assert.equal(info.legacyHidden,true,context);
     assert.equal(info.firstRow,true,context);
     assert.equal(info.secondRow,true,context);
     assert.equal(info.fourSameRow,width>760,context);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
