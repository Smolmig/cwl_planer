"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
test("Arena's former castle/ring-watermark is removed without touching other themes",()=>{
 assert.doesNotMatch(html,/arena-castle-mark/);
 assert.doesNotMatch(html,/linear-gradient\(-45deg,transparent 47%/);
 assert.match(html,/radial-gradient\(ellipse at 82% 16%,rgba\(217,173,104,\.10\)/);
 assert.match(html,/html\[data-theme="arena"\] \.view-lead-heading h3/);
 assert.match(html,/html\[data-theme="arena"\] \.more-heading h2/);
});
test("main tabs retain meaningful titles and common Arena heading hierarchy at phone and desktop widths",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark"]){
   for(const width of [320,390,768,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(clean,{waitUntil:"domcontentloaded"});
     const result=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      const tabs=[
       {id:"view-plan",kicker:"PLANUNG",title:"CWL-Plan"},
       {id:"view-members",kicker:"KADER",title:"Mitglieder"},
       {id:"view-summary",kicker:"EINSÄTZE",title:"Einsatzverteilung"},
       {id:"view-stats",kicker:"AUSWERTUNG",title:"Clan-Statistik"}
      ];
      const more=document.getElementById("view-more");more.classList.add("active");
      const moreStyle=getComputedStyle(document.getElementById("moreTitle"));
      const results=tabs.map(({id,kicker,title})=>{
       more.classList.remove("active");
       document.querySelectorAll(".view.active").forEach(el=>el.classList.remove("active"));
       const view=document.getElementById(id);view.classList.add("active");
       const heading=view.querySelector(".view-lead-heading");
       const h=heading.querySelector("h3"),k=heading.querySelector(".view-lead-kicker");
       const rect=h.getBoundingClientRect(),summary=heading.getBoundingClientRect();
       const copy=heading.querySelector(".view-lead-copy").getBoundingClientRect();
       return {id,kicker:k.textContent,title:h.textContent,fontFamily:getComputedStyle(h).fontFamily,
        fontSize:parseFloat(getComputedStyle(h).fontSize),
        kickerShown:getComputedStyle(k).display!=="none",width:rect.width,
        right:rect.right,summaryRight:summary.right,copyWidth:copy.width};
      });
      return {results,moreFontSize:parseFloat(moreStyle.fontSize),viewport:innerWidth,
       watermarkCount:document.querySelectorAll(".arena-castle-mark").length,
       pseudo:getComputedStyle(document.querySelector(".plan-overview"),"::before").backgroundImage};
     },theme);
     assert.equal(result.watermarkCount,0);
     for(const item of result.results){
      assert.ok(item.kickerShown&&item.kicker.length>2,JSON.stringify(item));
      assert.ok(item.title.length>5,JSON.stringify(item));
      assert.ok(item.width>45&&item.copyWidth>60,JSON.stringify(item));
      assert.ok(item.right<=width+2,"headline overflows: "+JSON.stringify({theme,width,item}));
      assert.ok(item.summaryRight<=width+2,"section heading overflows: "+JSON.stringify({theme,width,item}));
      if(theme==="arena"){
       assert.match(item.fontFamily,/Georgia|Times New Roman/);
       assert.ok(item.fontSize>=24,"headings should feel like More: "+JSON.stringify(item));
       assert.ok(item.fontSize>=result.moreFontSize-10);
      }
     }
     if(theme==="arena"){
      assert.match(result.pseudo,/radial-gradient/);
      assert.doesNotMatch(result.pseudo,/45deg/,"old crossed diagonals must be gone");
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
