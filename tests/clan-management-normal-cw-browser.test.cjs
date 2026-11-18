"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(root,"clan-management-cw-core.js"),"utf8");
const view=fs.readFileSync(path.join(root,"clan-management-cw-view.js"),"utf8");
const stripped=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const members=[{tag:"#2PYL",name:"Spieler mit langem Namen",role:"admin"},
 {tag:"#2PYQ",name:"Vize",role:"coLeader"}];
const war={war_key:"normal:20261116T180000.000Z:#QPYL",war_type:"normal",source:"api",
 source_clash_tag:"#2PYL",finalized:true,missed_log_complete:true,
 started_at:"2026-11-16T18:00:00Z",team_size:2,roster_tags:["#2PYL","#2PYQ"]};
const missed={war_key:war.war_key,player_tag:"#2PYL",missed_count:2};
const fake='window.CWLCloud={active:true,isOwner:()=>true,getActiveClanId:()=>"tenant-one",'+
 'saveManagementNormalCwDecision:async(war_key,player_tag,decision,note)=>'+
 '({id:1,war_key,player_tag,decision,note,created_at:"2026-11-18T08:00:00Z"})};';
test("CW owner review: responsive, accessible and no horizontal clipping",{
 timeout:120000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:820}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(stripped,{waitUntil:"domcontentloaded"});
    await page.addScriptTag({content:core});
    await page.addScriptTag({content:view});
    await page.addScriptTag({content:fake});
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>{document.documentElement.dataset.theme=t;
      document.getElementById("view-clan-management").classList.add("active");},theme);
     await page.evaluate(({members,war,missed})=>{
      window.CWLNormalCwUI.render(members,{wars:[war],missed:[missed],decisions:[]},"#2PYL");
      document.getElementById("clanManagementNormalPanel").open=true;
     },{members,war,missed});
     const panel=page.locator("#clanManagementNormalPanel");
     assert.match(await panel.innerText(),/Degradierung prüfen/);
     const disclosure=panel.locator(".clan-management-evidence");
     if(!(await disclosure.evaluate(el=>el.open)))await disclosure.locator("summary").click();
     assert.match(await disclosure.innerText(),/0\/2 Angriffe genutzt/);
     const sizes=await page.evaluate(()=>{
      const panel=document.querySelector("#clanManagementNormalPanel");
      const controls=[...panel.querySelectorAll("button,summary,input")]
       .filter(x=>x.getClientRects().length);
      return {documentWidth:document.documentElement.scrollWidth,viewport:innerWidth,
       small:controls.filter(x=>x.getBoundingClientRect().height<43).map(x=>x.tagName+" "+x.textContent.slice(0,15))};
     });
     assert.ok(sizes.documentWidth<=sizes.viewport+3,JSON.stringify({width,theme,sizes}));
     assert.deepEqual(sizes.small,[],JSON.stringify({width,theme,sizes}));
     await panel.getByRole("button",{name:/Spieler mit langem Namen.*Als geprüft markieren/}).click();
     await page.waitForFunction(()=>document.getElementById("clanManagementNormalList").textContent.includes("Als geprüft markiert"));
     assert.match(await panel.innerText(),/Entscheidungsverlauf/);
     assert.deepEqual(errors,[]);
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
