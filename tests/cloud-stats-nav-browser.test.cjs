"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const style=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];
const navbar=html.match(/<nav class="bottomnav">[\s\S]*?<\/nav>/)?.[0];
test("Cloud mobile bottom navigation: four equal visible tabs, guest gets three and Plan",{
 timeout:90000
},async()=>{
 assert.ok(style&&navbar);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,360,390,430,820]){
   const page=await browser.newPage({viewport:{width,height:800}});
   try{
    await page.setContent('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
      style+'</style></head><body class="cloud-mode"><main>'+
      '<section class="view" id="view-plan">Plan</section>'+
      '<section class="view active" id="view-stats">Statistik</section></main>'+navbar+'</body></html>');
    await page.locator("#statsNav").evaluate(el=>{el.hidden=false});
    const logged=await page.evaluate(()=>{
      const buttons=[...document.querySelectorAll(".navbtn")].filter(e=>getComputedStyle(e).display!=="none");
      return {scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
        items:buttons.map(e=>({x:e.getBoundingClientRect().left,width:e.getBoundingClientRect().width}))};
    });
    assert.equal(logged.items.length,4,"Cloud should show all four tabs at "+width);
    assert.ok(logged.scrollWidth<=logged.width+2,"navigation overflows at "+width);
    const widths=logged.items.map(x=>x.width);
    assert.ok(Math.max(...widths)-Math.min(...widths)<4,"uneven tab widths at "+width);
    assert.ok(logged.items.at(-1).x+logged.items.at(-1).width<=width+2,"Stats clipped at "+width);
    await page.evaluate(()=>{
      document.body.classList.remove("cloud-mode");
      document.getElementById("statsNav").hidden=true;
      document.getElementById("view-stats").classList.remove("active");
      document.getElementById("view-plan").classList.add("active");
      document.querySelector('.navbtn[data-view="plan"]').classList.add("active");
      document.querySelector('.navbtn[data-view="stats"]').classList.remove("active");
    });
    const guest=await page.evaluate(()=>{
      const items=[...document.querySelectorAll(".navbtn")].filter(e=>getComputedStyle(e).display!=="none");
      return {items:items.map(e=>e.dataset.view),
        scrollWidth:document.documentElement.scrollWidth,width:innerWidth,
        plan:getComputedStyle(document.getElementById("view-plan")).display,
        stats:getComputedStyle(document.getElementById("view-stats")).display};
    });
    assert.deepEqual(guest.items,["plan","members","summary"]);
    assert.ok(guest.scrollWidth<=guest.width+2);
    assert.notEqual(guest.plan,"none");
    assert.equal(guest.stats,"none");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
