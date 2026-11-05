"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const stripped=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
test("Settings use one desktop surface, no phone frame or nested theme cards",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","cyber","cyberlight","dark","light"]){
   for(const width of theme==="arena"||theme==="cyber"?[320,390,430,1366]:[390,1366]){
    const page=await browser.newPage({viewport:{width,height:900}});
    try{
     await page.setContent(stripped,{waitUntil:"domcontentloaded"});
     const results=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.getElementById("view-more-settings").classList.add("active");
      const host=document.getElementById("moreSettingsContent");
      const groups={rules:["settingsRulesSection","settingsAutoRosterBox"],
       appearance:["settingsAppearanceSection"],backup:["settingsBackupSection"],
       profiles:["localProfileCard"]};
      const nodes=Object.fromEntries(Object.values(groups).flat().map(id=>[id,document.getElementById(id)]));
      return Object.entries(groups).map(([action,ids])=>{
       host.replaceChildren(...ids.map(id=>nodes[id]));
       const style=getComputedStyle(host);
       const sections=[...host.children].map(el=>{
        const css=getComputedStyle(el);
        return {bg:css.backgroundColor,image:css.backgroundImage,shadow:css.boxShadow,
         left:css.borderLeftWidth,right:css.borderRightWidth,top:css.borderTopWidth};
       });
       const log=host.querySelector(".latest-changelog");
       return {action,hostBorder:style.borderTopWidth,hostBg:style.backgroundColor,
        sections,logBorder:log?getComputedStyle(log).borderLeftWidth:null,
        docWidth:document.documentElement.scrollWidth};
      });
     },theme);
     for(const item of results){
      const info=JSON.stringify({theme,width,item});
      assert.ok(item.docWidth<=width+3,info);
      assert.equal(item.hostBorder,width<=699?"0px":"1px",info);
      if(width<=699)assert.equal(item.hostBg,"rgba(0, 0, 0, 0)",info);
      for(const section of item.sections){
       assert.equal(section.bg,"rgba(0, 0, 0, 0)",info);
       assert.equal(section.image,"none",info);
       assert.equal(section.shadow,"none",info);
       for(const side of ["left","right","top"])assert.equal(section[side],"0px",info);
      }
      if(item.action==="appearance")assert.equal(item.logBorder,"0px",info);
     }
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
