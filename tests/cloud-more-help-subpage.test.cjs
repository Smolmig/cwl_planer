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
 assert.match(html,/Wechselhinweise vergleichen Clash mit der Empfehlung/);
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

test("Help explains current Einsatzverteilung and availability on phone and desktop",{
 timeout:120000
},async()=>{
 assert.match(html,/Gespielt \$\{x\.played\}/);
 assert.match(html,/Geplant \$\{Math\.max\(0,x\.count-x\.played\)\}/);
 assert.match(html,/Tage ohne RAUS/);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:script});
    await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode","cloud-role-viewer");
    },theme);
    await page.locator('.navbtn[data-view="more"]').click();
    await page.locator('[data-more-action="help"]').click();
    const help=page.locator("#view-help");
    const intro=help.locator(".help-steps > div").first();
    const explanation=help.locator(".help-item").filter({hasText:"Einsatzverteilung"});
    assert.equal(await explanation.isVisible(),true);
    assert.match(await intro.innerText(),/Mitglieder prüfen/);
    assert.match(await intro.innerText(),/gemeinsamen Clan.*Clash.*Gastmodus/s);
    const copy=await explanation.innerText();
    for(const value of ["Gespielt","Geplant","Gesamt","6/7 Tage ohne RAUS","kein Einsatzziel",
      "einzelnen Kriegstage","in Clash fix","nicht garantiert"])
      assert.ok(copy.includes(value),width+" "+theme+": "+value);
    assert.doesNotMatch(copy,/\bG\s*=|\bP\s*=/);
    assert.equal(await help.locator("#cloudHelpSection").isVisible(),false);
    const geom=await page.evaluate(()=>({
      page:document.documentElement.scrollWidth-innerWidth,
      textFont:parseFloat(getComputedStyle(
        document.querySelector("#view-help .help-item div")).fontSize)
    }));
    assert.ok(geom.page<=3,"overflow at "+width+" "+theme+": "+geom.page);
    assert.ok(geom.textFont>=12,"small copy at "+width+" "+theme);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
