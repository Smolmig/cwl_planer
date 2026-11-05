"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const markup=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8")
 .replace(/<script\\b[^>]*>[\\s\\S]*?<\\/script>/gi,"")
 .replace(/<link\\b[^>]*>/gi,"");

test("Einsatzverteilung uses readable, unboxed rows and full-width filters on small phones",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light","cyber","cyberlight"]){
   for(const width of [320,390,430,768]){
    const page=await browser.newPage({viewport:{width,height:850}});
    try{
     await page.setContent(markup,{waitUntil:"domcontentloaded"});
     const v=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelector("#view-plan")?.classList.remove("active");
      document.querySelector("#view-summary").classList.add("active");
      const root=document.querySelector("#summaryList");
      root.innerHTML='<div class="summary-compact-row"><button class="summary-compact-name summary-player-toggle" type="button" aria-expanded="false"><b>LongPlayerNameExample</b><span class="summary-compact-meta">RH18 · 3★ · Bevorzugt berücksichtigen</span></button><div class="summary-compact-numbers"><span>G 2</span><span>P 3</span></div></div><div class="summary-compact-row"><button class="summary-compact-name summary-player-toggle" type="button" aria-expanded="false"><b>Second</b><span class="summary-compact-meta">RH17</span></button></div>';
      const search=document.querySelector("#summarySearch"),filter=document.querySelector("#summaryFilter");
      const tools=document.querySelector("#view-summary .summary-tools");
      const row=root.querySelector(".summary-compact-row");
      const clickTarget=row.querySelector(".summary-player-toggle");
      const style=getComputedStyle(row);
      return {
       docWidth:document.documentElement.scrollWidth,
       grid:getComputedStyle(tools).gridTemplateColumns.split(" ").length,
       searchWidth:search.getBoundingClientRect().width,
       filterWidth:filter.getBoundingClientRect().width,
       searchHeight:search.getBoundingClientRect().height,
       filterHeight:filter.getBoundingClientRect().height,
       searchFont:parseFloat(getComputedStyle(search).fontSize),
       filterFont:parseFloat(getComputedStyle(filter).fontSize),
       targetHeight:clickTarget.getBoundingClientRect().height,
       nameFont:parseFloat(getComputedStyle(clickTarget.querySelector("b")).fontSize),
       rowBorderTop:style.borderTopWidth,rowBorderBottom:style.borderBottomWidth,
       rowRadius:style.borderTopLeftRadius,rowBg:style.backgroundColor,
       listColumns:getComputedStyle(root).gridTemplateColumns.split(" ").length
      };
     },theme);
     const reason=JSON.stringify({theme,width,v});
     assert.ok(v.docWidth<=width+3,reason);
     if(width<=470){
      assert.equal(v.grid,1,reason);
      assert.equal(v.listColumns,1,reason);
      assert.ok(Math.abs(v.searchWidth-v.filterWidth)<2,reason);
      assert.ok(v.searchHeight>=44 && v.filterHeight>=44,reason);
      assert.ok(v.searchFont>=14 && v.filterFont>=14,reason);
      assert.ok(v.targetHeight>=44 && v.nameFont>=13,reason);
      assert.equal(v.rowBorderTop,"0px",reason);
      assert.equal(v.rowBorderBottom,"1px",reason);
      assert.equal(v.rowRadius,"0px",reason);
      assert.equal(v.rowBg,"rgba(0, 0, 0, 0)",reason);
     }else{
      assert.ok(v.grid>=2,reason);
      assert.equal(v.rowBorderTop,"1px",reason);
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});

test("Mobile summary change is styling only; existing role and filter controls remain",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
 for(const id of ["summarySearch","summaryFilter","summaryVisibleCount","summaryList"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/if\(summaryFilter==="played"\)/);
 assert.match(html,/if\(summaryFilter==="future"\)/);
 assert.match(html,/if\(summaryFilter==="fixed"\)/);
 assert.match(html,/summaryOpenMemberId===x\.m\.id/);
 assert.match(html,/const DATA_VERSION=9/);
});
