"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const begin=html.indexOf("const sidebarCollapse=document.getElementById(\"sidebarCollapse\")");
const end=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',begin);
assert.ok(begin>0&&end>begin,"Sidebar controller must be present");
const sidebarScript=html.slice(begin,end);

test("desktop sidebar control remains in header on both states, with persistent SVG and no protruding arrow",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["dark","arena"]){
   const page=await browser.newPage({viewport:{width:1280,height:820}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:sidebarScript});
    await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;document.body.classList.remove("sidebar-collapsed")},theme);
    const button=page.locator("#sidebarCollapse");
    assert.equal(await button.isVisible(),true);
    assert.equal(await button.locator("svg.sidebar-panel-icon").count(),1);
    assert.equal(await button.getAttribute("aria-expanded"),"true");
    const before=await page.evaluate(()=>{
     const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();
      return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width}};
     return {nav:rect(".bottomnav"),brand:rect(".sidebar-brand"),toggle:rect("#sidebarCollapse"),
      scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};
    });
    assert.ok(before.toggle.left>=before.nav.left+5,"expanded toggle stays within the navigation");
    assert.ok(before.toggle.right<=before.nav.right-5,"expanded toggle does not float into content");
    assert.ok(before.toggle.top>=before.brand.top&&before.toggle.bottom<=before.brand.bottom,
      "expanded control belongs in the header");
    assert.equal(before.scrollWidth,before.viewport);
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"),"false");
    assert.equal(await button.getAttribute("aria-label"),"Seitenleiste ausklappen");
    assert.equal(await button.locator("svg.sidebar-panel-icon").count(),1,
      "collapsing must not erase the accessible icon");
    const after=await page.evaluate(()=>{
     const nav=document.querySelector(".bottomnav").getBoundingClientRect(),
      toggle=document.querySelector("#sidebarCollapse").getBoundingClientRect(),
      brand=document.querySelector(".sidebar-brand").getBoundingClientRect();
     return {navLeft:nav.left,navRight:nav.right,toggleLeft:toggle.left,toggleRight:toggle.right,
      brandTop:brand.top,brandBottom:brand.bottom,toggleTop:toggle.top,toggleBottom:toggle.bottom,
      markDisplay:getComputedStyle(document.querySelector(".sidebar-brand>.brand-mark")).display,
      collapsed:document.body.classList.contains("sidebar-collapsed"),
      scrollWidth:document.documentElement.scrollWidth};
    });
    assert.equal(after.collapsed,true);
    assert.equal(after.markDisplay,"none","panel icon replaces the logo in collapsed state");
    assert.ok(after.toggleLeft>=after.navLeft+5&&after.toggleRight<=after.navRight-5);
    assert.ok(after.toggleTop>=after.brandTop&&after.toggleBottom<=after.brandBottom);
    assert.equal(after.scrollWidth,1280);
    await button.click();
    assert.equal(await button.getAttribute("aria-expanded"),"true");
    assert.equal(await button.locator("svg.sidebar-panel-icon").count(),1);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("mobile and tablet layouts do not show the desktop-only sidebar toggle",{timeout:90000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,820,1099]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:sidebarScript});
    assert.equal(await page.locator("#sidebarCollapse").isVisible(),false);
    assert.equal(await page.locator(".bottomnav").isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
