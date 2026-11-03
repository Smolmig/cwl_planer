"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const a=html.indexOf("function showPlannerView(view){");
const b=html.indexOf("// v1.5.1: reuse",a);
const c=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',b);
const d=html.indexOf('document.getElementById("settingsOpen").onclick',c);
assert.ok(a>0&&b>a&&c>b&&d>c);
const script='function closeQuickClan(){}\n'+html.slice(a,b)+'\n'+html.slice(c,d)+
 '\ndocument.getElementById("helpClose").onclick=()=>showPlannerView("more");'+
 '\ndocument.getElementById("helpBtn").onclick=()=>showPlannerView("help");';

test("More Help is an actual accessible view, not an overlay or a demo link",()=>{
 assert.match(html,/<section id="view-help" class="view more-subview" aria-labelledby="helpTitle">/);
 assert.match(html,/<button class="btn small" id="helpClose" type="button">Zurück zu Mehr/);
 assert.doesNotMatch(html,/id="helpModal"/);
 assert.doesNotMatch(html,/openModal\("helpModal"\)/);
 assert.doesNotMatch(html,/href="\.\/cwl-demo\.html"/);
 assert.match(html,/Rotation & Einsatzziel/);
 assert.match(html,/Gemeinsamer Cloud-Clan:/);
 assert.match(html,/Clash-Aufstellung.*mit der Empfehlung/);
});
test("More -> Help -> Back, header help and settings keep the correct navigation selected across viewport and themes",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["dark","arena"]){
   for(const width of [320,390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     await page.addScriptTag({content:script});
     await page.evaluate(t=>{document.documentElement.dataset.theme=t},theme);
     await page.locator('.navbtn[data-view="more"]').click();
     assert.equal(await page.locator("#view-more.active").count(),1);
     await page.locator('[data-more-action="help"]').click();
     assert.equal(await page.locator("#view-help.active").count(),1);
     assert.equal(await page.locator("#view-more.active").count(),0);
     assert.equal(await page.locator('.navbtn[data-view="more"].active').count(),1);
     assert.equal(await page.locator("#helpTitle").isVisible(),true);
     assert.equal(await page.locator("#cloudHelpSection").isVisible(),false);
     assert.equal(await page.evaluate(()=>document.body.classList.contains("modal-open")),false);
     const widths=await page.evaluate(()=>({viewport:innerWidth,document:document.documentElement.scrollWidth,
       helpRight:document.getElementById("view-help").getBoundingClientRect().right}));
     assert.ok(widths.document<=width+2,"Horizontal overflow: "+JSON.stringify({theme,width,...widths}));
     assert.ok(widths.helpRight<=width+2,"Help view extends outside viewport: "+JSON.stringify(widths));
     await page.locator("#helpClose").click();
     assert.equal(await page.locator("#view-more.active").count(),1);
     await page.locator('.navbtn[data-view="plan"]').click();
     await page.locator("#helpBtn").click();
     assert.equal(await page.locator("#view-help.active").count(),1);
     assert.equal(await page.locator('.navbtn[data-view="more"].active').count(),1);
     await page.locator("#helpClose").click();
     assert.equal(await page.locator("#view-more.active").count(),1);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
test("Cloud-specific help can be shown without creating a second modal",{timeout:50000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:1080,height:780}});
  await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
  await page.addScriptTag({content:script});
  await page.evaluate(()=>{document.body.classList.add("cloud-mode");document.getElementById("cloudHelpSection").hidden=false});
  await page.locator('.navbtn[data-view="more"]').click();
  await page.locator('[data-more-action="help"]').click();
  assert.equal(await page.locator("#cloudHelpSection").isVisible(),true);
  assert.equal(await page.locator("#view-help").getAttribute("role"),null);
  assert.equal(await page.locator("#cloudOverlay").getAttribute("aria-hidden"),"true");
  assert.equal(await page.locator("#helpClose").isEnabled(),true);
 }finally{await browser.close()}
});
