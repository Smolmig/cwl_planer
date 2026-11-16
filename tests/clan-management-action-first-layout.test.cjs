"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const css=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
assert.ok(css,"Cloud app CSS is available");
test("Clan review disclosure and action filter remain usable at 320/390/430/1366px in Gold/Dark/Light",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   for(const theme of ["arena","dark","light"]){
    const page=await browser.newPage({viewport:{width,height:800}});
    try{
     const source='<!doctype html><html lang="de" data-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
       css+'</style></head><body><div class="app" style="padding:14px"><section class="view active">'+
       '<div class="clan-management-filter"><button aria-pressed="true">Offene Vorschläge 12</button><button aria-pressed="false">Alle Spieler</button></div>'+
       '<div class="clan-management-list"><div class="clan-management-person">'+
       '<div class="clan-management-person-head"><strong>Pro Gamer mit wirklich langem Clash-Spielernamen</strong><span class="clan-management-rank">Clash: Mitglied</span></div>'+
       '<div class="clan-management-person-status">Beförderung prüfen</div>'+
       '<small>28/14 Clantage · 15/10 Angriffe · 13 von 15 mit 3★</small>'+
       '<details class="clan-management-evidence"><summary><span>Details anzeigen</span></summary><div class="clan-management-evidence-body"><p>Bestätigte Clanzeit · letzte 14 Tage · Quellen und Abdeckung</p>'+
       '<div class="clan-management-review-actions"><button>Als geprüft markieren</button><button>Vorschlag ausblenden</button></div></div></details></div></div>'+
       '</section></div></body></html>';
     await page.setContent(source,{waitUntil:"domcontentloaded"});
     const result=await page.evaluate(()=>{
      const f=document.querySelector(".clan-management-filter button");
      const summary=document.querySelector(".clan-management-evidence>summary");
      const head=document.querySelector(".clan-management-person-head");
      const rank=document.querySelector(".clan-management-rank");
      const b=f.getBoundingClientRect(),d=summary.getBoundingClientRect();
      const before=document.documentElement.scrollWidth-innerWidth;
      summary.click();
      const action=document.querySelector(".clan-management-review-actions button");
      return {before,after:document.documentElement.scrollWidth-innerWidth,
       filterHeight:b.height,detailHeight:d.height,actionHeight:action.getBoundingClientRect().height,
       open:summary.parentElement.open,headWidth:head.getBoundingClientRect().width,
       rankRight:rank.getBoundingClientRect().right};
     });
     assert.ok(result.filterHeight>=44&&result.detailHeight>=44,{width,theme,result});
     assert.equal(result.open,true,{width,theme,result});
     assert.ok(result.before<=3&&result.after<=3,{width,theme,result});
     assert.ok(result.headWidth>0&&result.rankRight<=width+1,{width,theme,result});
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
