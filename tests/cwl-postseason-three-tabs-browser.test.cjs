"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const app=read("cloud-app.html"),live=read("cwl-live.mjs");
const styles=(app.match(/<style[^>]*>[\s\S]*?<\/style>/gi)||[]).join("");
const start=live.indexOf("  function selectPostseasonTab("),
 end=live.indexOf("  function renderPostseason()",start);
assert.ok(start>0&&end>start,"CWL tab controller exists");
const control=live.slice(start,end)+
 '\nattachPostseasonTabs(document.getElementById("planCwlPostseason"));';

test("Last CWL has three clear tabs, accessible switching and collapses on mobile",{
 timeout:120000
},async()=>{
 const {renderInlineCwlPostseason}=await import("../cwl-season-view.mjs");
 const rounds=Array.from({length:7},(_,i)=>({
  day:i+1,available:true,state:i===6?"inWar":"warEnded",
  warTag:"#P9Q"+("0289PYL"[i]),teamSize:2,
  clan:{tag:"#2PYL",name:"United",stars:32,
   members:[{tag:"#2PYL",name:"Luki",townHallLevel:18,attacks:[]},
    {tag:"#G9QL",name:"Second",townHallLevel:18,attacks:[]}]},
  opponent:{tag:"#8PYL",name:"Opponent",stars:25,
   members:[{tag:"#8PYL",name:"Enemy",townHallLevel:18,attacks:[]},
    {tag:"#P9QL",name:"Enemy 2",townHallLevel:18,attacks:[]}]}
 }));
 const profile={config:{days:7,slots:2},cwlLive:{season:"2026-11",
  clanTag:"#2PYL",rounds}};
 const html=renderInlineCwlPostseason(profile,profile.cwlLive,null,
  {mode:"postseason",savedDays:6,verifiedSeven:false});
 assert.match(html,/6\/7 Tage bestätigt/);
 assert.match(html,/LETZTE CWL/);
 assert.match(html,/data-postseason-tab="group"/);
 assert.match(html,/data-postseason-tab="rounds"/);
 assert.match(html,/data-postseason-tab="players"/);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:840}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent('<!doctype html><html lang="de"><head>'+
      '<meta name="viewport" content="width=device-width,initial-scale=1">'+
      styles+'</head><body><main class="content"><section id="view-plan" class="view active">'+
      '<div id="planCwlPostseason">'+html+'</div></section></main></body></html>');
    await page.addScriptTag({content:control});
    assert.equal(await page.locator(".plan-postseason-disclosure").evaluate(x=>x.open),true);
    assert.equal(await page.getByRole("tab",{name:"Tabelle"}).getAttribute("aria-selected"),"true");
    await page.getByRole("tab",{name:"Kriege"}).click();
    assert.equal(await page.locator("#postseasonPanel-group").isVisible(),false);
    assert.equal(await page.locator("#postseasonPanel-rounds").isVisible(),true);
    assert.match(await page.locator("#postseasonPanel-rounds").innerText(),/Runde 7/);
    await page.getByRole("tab",{name:"Kriege"}).press("ArrowRight");
    assert.equal(await page.getByRole("tab",{name:"Spieler"}).getAttribute("aria-selected"),"true");
    assert.equal(await page.locator("#postseasonPanel-players").isVisible(),true);
    await page.locator(".plan-postseason-summary").click();
    assert.equal(await page.locator(".plan-postseason-disclosure").evaluate(x=>x.open),false);
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
     const size=await page.evaluate(()=>({
       scroll:document.documentElement.scrollWidth,width:innerWidth
     }));
     assert.ok(size.scroll<=size.width+3,
       JSON.stringify({theme,viewport:width,size}));
    }
    assert.deepEqual(errors,[]);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
