"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");
const navBegin=html.indexOf("function showPlannerView(view){");
const navEnd=html.indexOf('document.getElementById("settingsCloudManage").onclick=',navBegin);
assert.ok(navBegin>=0&&navEnd>=navBegin,"Navigation binding source must exist");
const navTail=html.indexOf(";",navEnd)+1;
const navScript=html.slice(navBegin,navTail);

test("Settings and backup fields live outside Overview, existing IDs remain wired",()=>{
  const {JSDOM}=require("jsdom");
  const dom=new JSDOM(staticHtml);
  try{
    const doc=dom.window.document;
    assert.equal(doc.querySelectorAll("#view-settings").length,1);
    assert.equal(doc.querySelectorAll("#settingsOpen").length,1);
    assert.equal(doc.querySelectorAll("#slotsPreset").length,1);
    assert.equal(doc.querySelectorAll("#themeSelect").length,1);
    assert.equal(doc.querySelectorAll("#localProfileCard").length,1);
    for(const id of ["slotsPreset","daysInput","themeSelect","newProfileBtn","copyProfileBtn",
      "renameProfileBtn","deleteProfileBtn","exportProfileBtn","exportAllBtn","importBtn",
      "resetBtn","reportBugBtn","lastBackupText"]){
      assert.ok(doc.getElementById(id)?.closest("#view-settings"),id+" must be in settings");
      assert.equal(doc.querySelector("#view-summary #"+id),null,id+" must not be in Overview");
    }
    assert.equal(doc.querySelectorAll(".navbtn").length,4,
      "No extra bottom navigation tab");
    assert.equal(doc.querySelectorAll("#settingsCloudManage").length,1);
    assert.match(sync,/#view-settings button,#view-settings input,#view-settings select/);
    assert.match(sync,/"settingsCloudManage"/);
  }finally{dom.window.close()}
});
test("iPhone and desktop: top gear opens settings, navbar exits, account accessible",{
  timeout:120000
},async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    for(const width of [320,375,390,430,820,1280]){
      const page=await browser.newPage({viewport:{width,height:850}});
      try{
        await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
        await page.addScriptTag({content:navScript});
        await page.evaluate(()=>{
          document.body.classList.add("cloud-mode");
          document.getElementById("statsNav").hidden=false;
          document.getElementById("cloudOpen").textContent="☁️ United Fighters ▾";
          window.__accountOpens=0;
          document.getElementById("cloudOpen").onclick=()=>window.__accountOpens++;
        });
        const size=await page.evaluate(()=>{
          const t=document.querySelector(".topbar").getBoundingClientRect();
          const button=document.getElementById("settingsOpen").getBoundingClientRect();
          return {bodyWidth:document.documentElement.scrollWidth,screen:innerWidth,
            topRight:t.right,gearRight:button.right,gearLeft:button.left};
        });
        assert.ok(size.bodyWidth<=width+2,"Unexpected horizontal overflow at "+width+": "+JSON.stringify(size));
        assert.ok(size.gearRight<=width+2&&size.gearLeft>=0,"Gear clipped at "+width);
        await page.locator("#settingsOpen").click();
        assert.equal(await page.locator("#view-settings").evaluate(e=>getComputedStyle(e).display!=="none"),true);
        assert.equal(await page.locator("#view-summary").evaluate(e=>getComputedStyle(e).display==="none"),true);
        assert.equal(await page.locator("#settingsOpen").getAttribute("aria-pressed"),"true");
        assert.equal(await page.locator("#localProfileCard").evaluate(e=>getComputedStyle(e).display==="none"),true);
        await page.locator("#settingsCloudManage").click();
        assert.equal(await page.evaluate(()=>window.__accountOpens),1);
        await page.locator('.navbtn[data-view="summary"]').click();
        assert.equal(await page.locator("#view-summary").evaluate(e=>getComputedStyle(e).display!=="none"),true);
        assert.equal(await page.locator("#view-settings").evaluate(e=>getComputedStyle(e).display==="none"),true);
        assert.equal(await page.locator("#settingsOpen").getAttribute("aria-pressed"),"false");
        await page.evaluate(()=>{document.body.classList.remove("cloud-mode")});
        await page.locator("#settingsOpen").click();
        assert.equal(await page.locator("#localProfileCard").evaluate(e=>getComputedStyle(e).display!=="none"),true);
        assert.equal(await page.locator("#settingsCloudAccount").evaluate(e=>getComputedStyle(e).display==="none"),true);
      }finally{await page.close()}
    }
  }finally{await browser.close()}
});
