"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");
function between(first,last){
 const start=html.indexOf(first),end=html.indexOf(last,start);
 assert.ok(start>=0&&end>start,"Expected in-app source: "+first);
 return html.slice(start,end);
}
const filtersState=between("const summaryAdvanced=","let lastRenderedCloudClanId=");
const filtersEvents=between('document.getElementById("summarySearch").oninput=',
 'document.getElementById("memberSearch").oninput=');
async function prepare(page,theme){
 await page.setContent(markup,{waitUntil:"domcontentloaded"});
 await page.evaluate(theme=>{
  document.documentElement.dataset.theme=theme;
  document.body.classList.add("cloud-mode");
  document.querySelector("#view-plan")?.classList.remove("active");
  document.getElementById("view-summary").classList.add("active");
  document.getElementById("summaryCloudFilters").hidden=false;
  document.getElementById("summaryFilter").hidden=true;
  document.querySelector(".summary-tools").classList.add("cloud-filter-mode");
 },theme);
 // Use the actual app functions and click handlers. Only the final data-list
 // rendering is stubbed; the pure filter selector has separate data tests.
 await page.addScriptTag({content:
  'let summarySearch="",summaryFilter="all";'+filtersState+
  'function renderSummary(){renderSummaryFilterChips();'+
  'document.getElementById("summaryResetFilters").hidden='+ 
  '!(summarySearch.trim()||summaryAdvanced.group!=="all"||summaryAdvanced.progress!=="all"||'+
  'summaryAdvanced.medal!=="all"||summaryAdvanced.sort!=="default");}'+filtersEvents+
  'renderSummary();'
 });
}
async function choose(page,key,value){
 await page.locator("#summaryFilterPicker>summary").click();
 await page.locator('#summaryFilterMenu button[data-filter-key="'+key+'"][data-filter-value="'+value+'"]').click();
}
test("Chip picker adds/removes/replaces filters with stable names, keyboard and search",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:840}});
  try{
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await prepare(page,"arena");
   assert.equal(await page.locator(".summary-filter-chip").count(),0,"default shows all players");
   await choose(page,"progress","target-open");
   assert.deepEqual(await page.locator(".summary-filter-chip").allTextContents(),["Ziel offen×"]);
   assert.equal(await page.locator("#summaryProgress").inputValue(),"target-open");
   await choose(page,"group","rotation");
   await choose(page,"medal","open");
   assert.deepEqual(await page.locator(".summary-filter-chip").allTextContents(),
    ["Ziel offen×","Rotierende Spieler×","8 Sterne offen×"]);
   assert.equal(await page.locator("#summaryFilterPicker").getAttribute("open"),null);
   await page.locator("#summarySearch").fill("Jamie");
   assert.equal(await page.locator("#summarySearch").inputValue(),"Jamie");
   await page.locator("#summarySort").selectOption("name");
   assert.equal(await page.locator(".summary-filter-chip").count(),3);
   await page.locator('.summary-filter-chip[data-filter-key="progress"]').click();
   assert.deepEqual(await page.locator(".summary-filter-chip").allTextContents(),
    ["Rotierende Spieler×","8 Sterne offen×"]);
   assert.equal(await page.locator("#summaryProgress").inputValue(),"all");
   await choose(page,"medal","reached");
   assert.deepEqual(await page.locator(".summary-filter-chip").allTextContents(),
    ["Rotierende Spieler×","8 Sterne erreicht×"],"one chip per dimension; replace in place");
   await page.locator("#summaryFilterPicker>summary").click();
   assert.equal(await page.locator("#summaryFilterPicker").getAttribute("open"),"");
   await page.keyboard.press("Escape");
   assert.equal(await page.locator("#summaryFilterPicker").getAttribute("open"),null);
   await page.locator("#summaryResetFilters").click();
   assert.equal(await page.locator(".summary-filter-chip").count(),0);
   assert.equal(await page.locator("#summarySearch").inputValue(),"");
   assert.equal(await page.locator("#summarySort").inputValue(),"default");
   assert.deepEqual(errors,[]);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("Filter button and individually removable chips fit iPhone and desktop widths in three themes",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,768,1240]){
    const page=await browser.newPage({viewport:{width,height:840}});
    try{
     const errors=[];page.on("pageerror",e=>errors.push(e.message));
     await prepare(page,theme);
     await choose(page,"group","rotation");
     await choose(page,"progress","target-open");
     await choose(page,"medal","open");
     const v=await page.evaluate(()=>{
      const chips=[...document.querySelectorAll(".summary-filter-chip")];
      const button=document.querySelector("#summaryFilterPicker>summary");
      const sort=document.getElementById("summarySort");
      const input=document.getElementById("summarySearch");
      const legacy=document.getElementById("summaryFilter");
      const menu=document.getElementById("summaryFilterMenu");
      return{
       docWidth:document.documentElement.scrollWidth,viewport:innerWidth,
       chips:chips.length,chipWidths:chips.map(c=>c.getBoundingClientRect().width),
       filterButtonHeight:button.getBoundingClientRect().height,
       sortHeight:sort.getBoundingClientRect().height,
       sortWidth:sort.getBoundingClientRect().width,
       inputWidth:input.getBoundingClientRect().width,
       legacyVisible:legacy.getBoundingClientRect().width>0,
       menuWidth:menu.getBoundingClientRect().width
      };
     });
     const msg=JSON.stringify({theme,width,v});
     assert.ok(v.docWidth<=width+3,msg);
     assert.equal(v.chips,3,msg);
     assert.ok(v.chipWidths.every(w=>w>70&&w<width),msg);
     assert.ok(v.inputWidth>100,msg);
     assert.ok(v.filterButtonHeight>=36&&v.sortHeight>=36&&v.sortWidth>100,msg);
     assert.equal(v.legacyVisible,false,msg);
     assert.deepEqual(errors,[],msg);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
