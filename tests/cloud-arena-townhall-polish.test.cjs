"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const icon="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23dfbd7a'/%3E%3C/svg%3E";

test("both member and stats views use the provider-documented CDN and keep RH text if icons fail",()=>{
 const ownerCdn="https://assets.clashk.ing/buildings/home-village/town_hall/level_";
 assert.match(html,/function memberTownHallMarkup\(m\)/);
 assert.ok(html.includes("src='"+ownerCdn+'"+th+".webp'));
 assert.ok(stats.includes("src='"+ownerCdn+'"+p.th+".webp'));
 assert.match(html,/onerror='this\.remove\(\)'/);
 assert.match(stats,/onerror='this\.remove\(\)'/);
 assert.match(html,/member-townhall.*RH/);
 assert.match(stats,/p\.th\?"RH"\+p\.th:"RH\?"/);
 assert.match(stats,/<span class='stats-th'>/);
 assert.doesNotMatch(html.slice(html.indexOf("function memberTownHallMarkup("),html.indexOf("function rotationWeightLabel(")),/raw\.githubusercontent\.com/);
});
test("Rathaus icons scale consistently and Arena surfaces avoid rectangular cut-outs on desktop and mobile",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["dark","arena"]){
   for(const width of [320,390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
     const result=await page.evaluate(({theme,icon})=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      const statsHost=document.getElementById("statsRows");
      const membersHost=document.getElementById("memberList");
      statsHost.innerHTML='<div class="stats-player-row"><div class="stats-player"><span class="stats-th"><img class="stats-th-icon" src="'+icon+'" alt=""><small>RH18</small></span><div class="stats-name"><b>Spieler Beispiel</b></div></div><strong class="stats-rate">75%</strong><span class="stats-number">8</span><span class="stats-number">1</span></div>';
      membersHost.innerHTML='<div class="member member-expanded"><div class="member-snapshot"><span class="member-townhall"><img class="member-th-icon" alt="" src="'+icon+'"><span>RH18</span></span></div><div class="member-details"><div class="member-tools">Rotation</div></div></div>';
      const cs=selector=>getComputedStyle(document.querySelector(selector));
      const rect=selector=>document.querySelector(selector).getBoundingClientRect();
      const style={
       rowBg:cs(".stats-player-row").backgroundColor,
       innerBg:cs(".stats-player").backgroundColor,
       tableBg:cs(".stats-player-table").backgroundColor,
       snapshotBg:cs("#memberList .member-snapshot").backgroundColor,
       detailsBg:cs("#memberList .member-details").backgroundColor,
       toolsBg:cs("#memberList .member-tools").backgroundColor,
       thBg:cs(".stats-th").backgroundColor,
       thBox:rect(".stats-th").width,
       thImage:rect(".stats-th img").width,
       memberImage:rect(".member-th-icon").width,
       thText:document.querySelector(".stats-th").textContent.trim(),
       memberText:document.querySelector(".member-townhall").textContent.trim(),
       scrollWidth:document.documentElement.scrollWidth,
       width:innerWidth
      };
      document.querySelector(".stats-th img").remove();
      style.iconFallback=Boolean(document.querySelector(".stats-th small")?.textContent==="RH18");
      return style;
     },{theme,icon});
     assert.equal(result.thText,"RH18");
     assert.equal(result.memberText,"RH18");
     assert.equal(result.iconFallback,true,"RH text remains even if the image disappears");
     assert.ok(result.thImage>=20&&result.thImage<=30,"stats icon width "+JSON.stringify(result));
     assert.ok(result.memberImage>=18&&result.memberImage<=25,"member icon width "+JSON.stringify(result));
     assert.ok(result.thBox>=32&&result.thBox<=45,"stats badge too large "+JSON.stringify(result));
     assert.ok(result.scrollWidth<=width+2,"horizontal overflow "+JSON.stringify(result));
     if(theme==="arena"){
      for(const key of ["rowBg","innerBg","snapshotBg","detailsBg","toolsBg"]){
       assert.equal(result[key],"rgba(0, 0, 0, 0)","Arena nested background must be transparent: "+key+" "+JSON.stringify(result));
      }
      assert.notEqual(result.tableBg,"rgba(0, 0, 0, 0)","Outer stats table must own the surface");
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
