"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const version=JSON.parse(fs.readFileSync(path.join(root,"cloud-version.json"),"utf8"));
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("function showPlannerView(view){");
const end=html.indexOf('document.getElementById("settingsCloudManage").onclick=',start);
assert.ok(start>=0&&end>start,"Navigation module must be extractable");
const navScript=html.slice(start,html.indexOf(";",end)+1);

test("Cloud v1.16.37 preserves existing navigation, backend and More routing",()=>{
  assert.equal(version.version,"v1.16.37");
  assert.match(html,/const APP_VERSION="v1\.16\.37"/);
  assert.match(html,/cloud-sync\.mjs\?v=1\.16\.37/);
  assert.match(html,/id="quickClanChoices"/);
  assert.match(html,/id="quickClanConfirm"/);
  assert.match(html,/id="quickClanCancel"/);
  assert.doesNotMatch(html,/id="quickClanSelect"/);
  assert.match(html,/id="sidebarCollapse"/);
  assert.match(html,/original\.dispatchEvent\(new Event\("change",\{bubbles:true\}\)\)/);
  assert.match(html,/cwl_desktop_sidebar_collapsed/);
  assert.match(html,/body\.sidebar-collapsed \.bottomnav\{width:74px/);
  assert.doesNotMatch(html,/id="moreDetailBack"/);
  assert.doesNotMatch(html,/html\[data-theme="arena"\] \.stats-th\{border:0;background:transparent/);
});

test("desktop and iPhone: direct clan switch and account management stay usable",{
  timeout:120000
},async()=>{
  const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  try{
    for(const width of [320,390,1366]){
      const page=await browser.newPage({viewport:{width,height:900}});
      try{
        await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
        await page.addScriptTag({content:navScript});
        await page.evaluate(()=>{
          document.body.classList.add("cloud-mode");
          window.CWLCloud={active:true};
          const original=document.getElementById("cloudClanSelect");
          original.replaceChildren(new Option("United Fighters · Mein Clan","a"),new Option("Zweiter Clan · Vize","b"));
          original.value="a";
          window.__clanChanges=0;window.__manageOpens=0;
          original.addEventListener("change",()=>window.__clanChanges++);
          document.getElementById("cloudOpen").onclick=()=>window.__manageOpens++;
          const button=document.getElementById("headerClanName");
          button.hidden=false;button.textContent="United Fighters";
        });
        const btn=page.locator("#headerClanName");
        await btn.click();
        assert.equal(await btn.getAttribute("aria-expanded"),"true");
        assert.equal(await page.locator("#quickClanChoices button").count(),2);
        await page.locator('#quickClanChoices button[data-clan-id="b"]').click();
        assert.equal(await page.evaluate(()=>document.getElementById("cloudClanSelect").value),"a");
        assert.equal(await page.evaluate(()=>window.__clanChanges),0);
        await page.locator("#quickClanCancel").click();
        assert.equal(await page.locator("#quickClanMenu").isVisible(),false);
        assert.equal(await page.evaluate(()=>window.__clanChanges),0);
        await btn.click();
        await page.locator('#quickClanChoices button[data-clan-id="b"]').click();
        assert.equal(await page.locator("#quickClanConfirm").isEnabled(),true);
        await page.locator("#quickClanConfirm").click();
        assert.equal(await page.evaluate(()=>document.getElementById("cloudClanSelect").value),"b");
        assert.equal(await page.evaluate(()=>window.__clanChanges),1);
        await btn.click();
        await page.locator("#quickClanManage").click();
        assert.equal(await page.evaluate(()=>window.__manageOpens),1);
        await btn.click();
        await page.keyboard.press("Escape");
        assert.equal(await page.locator("#quickClanMenu").isVisible(),false);
        const widths=await page.evaluate(()=>({
          body:document.documentElement.scrollWidth,viewport:innerWidth,
          header:document.getElementById("headerClanName").getBoundingClientRect().right,
          gear:document.getElementById("settingsOpen").getBoundingClientRect().right
        }));
        assert.ok(widths.body<=width+2,"Unexpected horizontal overflow at "+width+": "+JSON.stringify(widths));
        assert.ok(widths.header<=width+2,"Clan switcher outside viewport at "+width);
        assert.ok(widths.gear<=width+2,"Settings gear outside viewport at "+width);
        if(width<700){
          const positions=await page.evaluate(()=>({
            brand:document.querySelector(".topbar .brand-lockup").getBoundingClientRect().bottom,
            clan:document.getElementById("headerClanName").getBoundingClientRect().top
          }));
          assert.ok(positions.clan>=positions.brand+4,"Clan must sit below brand at "+width);
        }
        if(width>=1100){
          assert.equal(await page.locator(".topbar .brand-lockup").isVisible(),false);
          const before=await page.locator(".bottomnav").evaluate(el=>Math.round(el.getBoundingClientRect().width));
          assert.equal(before,228);
          await page.locator("#sidebarCollapse").click();
          const after=await page.locator(".bottomnav").evaluate(el=>Math.round(el.getBoundingClientRect().width));
          assert.equal(after,74);
          assert.equal(await page.locator("#sidebarCollapse").getAttribute("aria-expanded"),"false");
          await page.locator("#sidebarCollapse").click();
          assert.equal(await page.locator(".bottomnav").evaluate(el=>Math.round(el.getBoundingClientRect().width)),228);
        }
      }finally{await page.close()}
    }
  }finally{await browser.close()}
});
