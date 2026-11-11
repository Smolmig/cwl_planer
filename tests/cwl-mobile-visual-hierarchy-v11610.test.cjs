"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"")
  .replace(/<link\b[^>]*>/gi,"");

test("plan performance fits in a quiet side line while retaining exact sources",()=>{
 const start=html.indexOf("function memberCompactPerformance(m,progress=null){");
 const end=html.indexOf("function memberPerformance(m){",start);
 assert.ok(start>=0&&end>start);
 const fn=vm.runInNewContext(html.slice(start,end)+";memberCompactPerformance",{
  window:{CWLCloud:{active:true},CWLCloudStats:{getRecentPlayerStats:()=>({
   hitRate:86,attacks:7,cwlBySeason:{"2026-11":2}
  })}},
  state:{cwlLive:{season:"2026-11"}},
  lastPlan:{playedCounts:{kaizen:2},counts:{kaizen:7}},
  currentCwlDisplayProgress:()=>new Map([["kaizen",{
   executed:2,open:5,unknown:0,missed:0,completed:2,running:0
  }]]),
  esc:v=>String(v).replaceAll("&","&amp;").replaceAll('"',"&quot;")
 });
 const markup=fn({id:"kaizen",playerTag:"#PYL"});
 const wrapper=new JSDOM("<div>"+markup+"</div>").window.document;
 assert.equal(wrapper.querySelector(".cwl-performance-recent").textContent,"3★ 86 % · 7 AG");
 assert.equal(wrapper.querySelector(".cwl-performance-schedule").textContent,"2 ausgeführt · 5 offen");
 assert.match(wrapper.querySelector(".cwl-performance-recent").title,/7 gespeicherte AG \(CW\/CWL\)/);
 assert.match(wrapper.querySelector(".cwl-performance-recent").getAttribute("aria-label"),/2 AG dieser CWL enthalten/);
 assert.doesNotMatch(wrapper.body.textContent,/Letzte 7 gespeicherte AG/);
});
test("member approval uses its original trigger to close, with no floating Schließen button",()=>{
 assert.doesNotMatch(html,/id="membersReviewClose"/);
 assert.match(html,/id="membersReviewOpenPlan" aria-expanded="false" aria-controls="membersReviewManageHost"/);
 const dom=new JSDOM('<div id="view-members"><button id="membersReviewOpenPlan" aria-expanded="false"></button>'+
  '<section id="membersReviewManageHost" hidden></section></div>'+
  '<section id="planReviewPanel"><details id="planReviewDisclosure"><summary>Freigabe</summary></details></section>'+
  '<div id="mobileDaySwitcher"></div>');
 const document=dom.window.document;
 const start=sync.indexOf("function restorePlanReviewToPlan(){");
 const end=sync.indexOf('bind("planRefreshSuggestions"',start);
 assert.ok(start>=0&&end>start);
 const src=sync.slice(start,end);
 let refreshes=0;
 const functions=vm.runInNewContext(src+";({openPlanReviewInMembers,restorePlanReviewToPlan})",{
  $:id=>document.getElementById(id),cloud:{active:true},role:"owner",isPlanReviewPaused:()=>false,
  renderMembersReview:()=>{refreshes++},bind:()=>{},document
 });
 const trigger=document.getElementById("membersReviewOpenPlan");
 trigger.focus();
 functions.openPlanReviewInMembers();
 assert.equal(document.getElementById("membersReviewManageHost").hidden,false);
 assert.equal(document.getElementById("planReviewPanel").parentElement.id,"membersReviewManageHost");
 assert.equal(document.getElementById("planReviewDisclosure").open,true);
 functions.openPlanReviewInMembers();
 assert.equal(document.getElementById("membersReviewManageHost").hidden,true);
 assert.equal(document.getElementById("planReviewPanel").nextElementSibling.id,"mobileDaySwitcher");
 assert.equal(refreshes,2);
});
test("gold mobile navigation is anchored in flow, never overlays player cards",{
 timeout:45000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [375,390,430]){
   const page=await browser.newPage({viewport:{width,height:780},isMobile:true,hasTouch:true});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.evaluate(()=>{
     document.documentElement.dataset.theme="arena";
     document.getElementById("mobileDayTabs").innerHTML=Array.from({length:7},(_,i)=>
      '<button type="button" class="mobile-day-tab'+(i===2?' active':'')+'"><span class="day-no">Tag '+(i+1)+'</span><span class="day-state">✓</span></button>').join("");
     const list=document.getElementById("planDays");
     list.innerHTML='<div class="day-card" style="height:2500px">'+
       '<div class="lineup"><div class="player-chip fixed-player">KAIZEN <span class="player-fixed-badge">FIX</span>'+
       '<span class="player-meta"><span class="member-townhall">RH18</span>'+
       '<span class="cwl-performance-recent">3★ 86 % · 7 AG</span>'+
       '<span class="cwl-performance-schedule">2 gespielt · 5 geplant</span>'+
       '</span></div></div></div>';
    });
    const before=await page.evaluate(()=>{
      const nav=document.getElementById("mobileDaySwitcher");
      const performance=document.querySelector(".cwl-performance-recent");
      return {
       position:getComputedStyle(nav).position,
       background:getComputedStyle(nav).backgroundColor,
       label:getComputedStyle(nav.querySelector(".day-switcher-header")).display,
       rateWeight:getComputedStyle(performance).fontWeight,
       navBottom:nav.getBoundingClientRect().bottom,
       viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth
      };
    });
    assert.equal(before.position,"static","day bar is not sticky at "+width);
    assert.equal(before.background,"rgba(0, 0, 0, 0)");
    assert.equal(before.label,"none");
    assert.equal(before.rateWeight,"500");
    assert.ok(before.scrollWidth<=before.viewport+2,"horizontal scroll at "+width);
    await page.evaluate(()=>window.scrollTo(0,1200));
    const after=await page.evaluate(()=>({
      scrollY,navBottom:document.getElementById("mobileDaySwitcher").getBoundingClientRect().bottom
    }));
    assert.ok(after.scrollY>500,"page must scroll at "+width);
    assert.ok(after.navBottom<0,"day bar must scroll away instead of covering players at "+width);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
