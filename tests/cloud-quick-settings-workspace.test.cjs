"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8"),sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
test("Cloud quick settings preserve single-instance controls and viewer navigation allowlist",()=>{
 for(const id of ["settingsRulesSection","settingsAutoRosterBox","settingsBackupSection","settingsAppearanceSection","themeSelect","settingsClose","openReleaseHistory","reportBugBtn"]){
  assert.equal((app.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 }
 assert.match(sync,/"settingsCloudManage","settingsClose","openReleaseHistory","reportBugBtn","moreSettingsBack"/);
 assert.match(app,/data-more-action="rules"/);assert.match(app,/data-more-action="backup"/);
});
test("Cloud quick settings retain detailed fallback pages and local settings at mobile and desktop widths",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    for(const theme of ["arena","dark","light","cyber","cyberlight"]){
     const result=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
      document.getElementById("view-settings").classList.add("active");
      const byId=id=>document.getElementById(id);
      const display=id=>getComputedStyle(byId(id)).display;
      const box=byId("view-settings").querySelector(".settings-window").getBoundingClientRect();
      const visible=["themeSelect","settingsClose","settingsCloudManage","openReleaseHistory","reportBugBtn"].map(id=>({id,h:byId(id).getBoundingClientRect().height}));
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,box:box.width,visible,
       rules:display("settingsRulesSection"),auto:display("settingsAutoRosterBox"),backup:display("settingsBackupSection"),
       appearance:getComputedStyle(document.querySelector('[data-more-action="appearance"]')).display};
     },theme);
     assert.ok(result.scroll<=width+3,JSON.stringify({theme,width,result}));
     assert.ok(result.box<=481&&result.box>200,JSON.stringify({theme,width,result}));
     assert.equal(result.rules,"none");assert.equal(result.auto,"none");assert.equal(result.backup,"none");assert.equal(result.appearance,"none");
     for(const x of result.visible)assert.ok(x.h>=43,JSON.stringify({theme,width,x}));
     if(theme==="arena"||theme==="dark"){
      fs.mkdirSync(path.join(root,"ux-screenshots"),{recursive:true});
      await page.screenshot({path:path.join(root,"ux-screenshots","quick-settings-"+theme+"-"+width+".png")});
     }
    }
    const fallback=await page.evaluate(()=>{
     const host=document.getElementById("moreSettingsContent");
     document.getElementById("view-settings").classList.remove("active");
     document.getElementById("view-more-settings").classList.add("active");
     const nodes=["settingsRulesSection","settingsAutoRosterBox","settingsBackupSection"].map(id=>document.getElementById(id));
     const homes=nodes.map(n=>n.parentNode);
     host.append(...nodes);
     const details=nodes.map(n=>getComputedStyle(n).display);
     nodes.forEach((n,i)=>homes[i].append(n));
     document.body.classList.remove("cloud-mode");
     document.getElementById("view-more-settings").classList.remove("active");
     document.getElementById("view-settings").classList.add("active");
     return {details,localRules:getComputedStyle(nodes[0]).display,localBackup:getComputedStyle(nodes[2]).display,
      localTheme:getComputedStyle(document.querySelector('[data-more-action="appearance"]')).display};
    });
    assert.ok(fallback.details.every(x=>x!=="none"));assert.notEqual(fallback.localRules,"none");assert.notEqual(fallback.localBackup,"none");assert.notEqual(fallback.localTheme,"none");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
