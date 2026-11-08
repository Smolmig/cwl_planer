"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
 .replace(/<link\b[^>]*>/gi,"");

test("Member search, sorting, status filters and help stay touchable",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const cases=[[320,844,"arena",false],[390,844,"dark",true],[430,844,"light",false],
   [699,900,"arena",true],[820,400,"dark",false],[1366,900,"light",true]];
  for(const [width,height,theme,viewer] of cases){
   const page=await browser.newPage({viewport:{width,height}});
   try{
    await page.setContent(markup,{waitUntil:"domcontentloaded"});
    const m=await page.evaluate(({theme,viewer})=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode");
     if(viewer)document.body.classList.add("cloud-role-viewer");
     document.getElementById("view-members").classList.add("active");
     document.getElementById("cloudMembersTools").hidden=false;
     const help=document.getElementById("cloudManualMembers");help.hidden=false;
     const member=document.createElement("div");
     member.innerHTML='<div class="member-details-footer"><button class="btn small member-config-help" type="button">Hilfe zu den Einstellungen</button></div>';
     document.getElementById("memberList").append(member);
     const search=document.getElementById("memberSearch"),filter=document.getElementById("memberFilter"),
      sort=document.getElementById("memberSortSelect"),count=document.getElementById("memberVisibleCount");
     count.textContent="12 von 30";
     const measure=e=>{const r=e.getBoundingClientRect();return {height:r.height,top:r.top,bottom:r.bottom,left:r.left,right:r.right,visible:getComputedStyle(e).display!=="none"}};
     const before=getComputedStyle(filter).borderLeftColor;
     filter.value="fixed";filter.classList.add("is-filtered");search.classList.add("is-filtered");
     const after=getComputedStyle(filter).borderLeftColor;
     return {search:measure(search),filter:measure(filter),sort:measure(sort),count:measure(count),
      helper:measure(member.querySelector(".member-config-help")),cloudHelp:measure(help.querySelector("summary")),
      chooser:measure(document.getElementById("selectMembersBtn")),
      inputFont:parseFloat(getComputedStyle(search).fontSize),
      filterFont:parseFloat(getComputedStyle(filter).fontSize),
      before,after,overflow:document.documentElement.scrollWidth-innerWidth};
    },{theme,viewer});
    const ctx=JSON.stringify({width,height,theme,viewer,m});
    assert.ok(m.search.height>=44,ctx);
    assert.ok(m.filter.height>=44,ctx);
    assert.ok(m.sort.height>=44,ctx);
    assert.ok(m.helper.height>=44,ctx);
    assert.notEqual(m.before,m.after,"active filter must stand out: "+ctx);
    assert.ok(m.overflow<=3,"no horizontal scrolling: "+ctx);
    if(width<=699 || height<=540){
     assert.ok(m.search.right<=m.filter.left+2,ctx);
     assert.ok(m.count.top>=Math.max(m.search.bottom,m.filter.bottom)-1,ctx);
     assert.ok(m.inputFont>=16&&m.filterFont>=16,ctx);
    }
    if(viewer)assert.equal(m.chooser.visible,false,ctx);
    else{
     assert.ok(m.cloudHelp.height>=44,ctx);
     await page.locator("#cloudManualMembers summary").click();
     assert.equal(await page.locator("#cloudManualMembers").evaluate(el=>el.open),true,ctx);
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
test("Member edit toggle references its member-specific settings region",()=>{
 assert.ok(html.includes('aria-controls="member-details-'+'$'+'{esc(m.id)}"'));
 assert.ok(html.includes('id="member-details-'+'$'+'{esc(m.id)}"'));
 assert.ok(html.includes('role="group" aria-label="Einstellungen für '+'$'+'{esc(m.name)}"'));
 assert.match(html,/const DATA_VERSION=9/);
});
