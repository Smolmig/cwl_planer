"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
function demoApp(){
 const members=Array.from({length:26},(_,i)=>({
   id:"player"+i,name:i===1?"Sehr langer Clash-Spielername mit Sonderzeichen ★":("Spieler "+String(i+1).padStart(2,"0")),
   playerTag:"",townHall:19-i%5,participating:true,fixed:i<2,priority:i%6,
   threeStar:["high","medium","unknown","low"][i%4],statuses:Array(7).fill("auto"),firstDay:null,outFromDay:null
 }));
 const locks=Array.from({length:7},(_,day)=>({
   locked:day===0,lineup:day===0?members.slice(0,15).map(x=>x.id):[],snapshots:{}
 }));
 return {version:9,dataVersion:9,activeProfileId:"browser-test",
  profiles:[{id:"browser-test",name:"Test-Clan",config:{slots:15,days:7,memberSort:"manual"},
    members,archivedMembers:[],dayGoals:Array.from({length:7},()=>({townHall:{},strength:{}})),
    locks,archives:[]}]};
}
function server(){
 return http.createServer((req,res)=>{
   const url=(req.url||"/").split("?")[0];
   if(url==="/"||url==="/index.html"){
     res.writeHead(200,{"content-type":"text/html; charset=utf-8"});
     res.end(html);
   }else{
     res.writeHead(404);res.end();
   }
 });
}
test("Chromium: responsive member layout, headers, dialogs, help and input controls",{timeout:150000},async(t)=>{
 const appServer=server();
 await new Promise(resolve=>appServer.listen(0,"127.0.0.1",resolve));
 const address="http://127.0.0.1:"+appServer.address().port+"/index.html";
 let browser;
 try{
   browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
   const sizes=[
     {name:"iPhone portrait",width:390,height:844,landscape:false},
     {name:"small iPhone landscape",width:667,height:375,landscape:true},
     {name:"iPhone landscape",width:844,height:390,landscape:true},
     {name:"large iPhone landscape",width:932,height:430,landscape:true},
     {name:"desktop short landscape",width:1100,height:480,landscape:true},
     {name:"tablet portrait",width:820,height:1180,landscape:false},
     {name:"desktop",width:1280,height:800,landscape:false}
   ];
   for(const size of sizes){
     await t.test(size.name,async()=>{
       const page=await browser.newPage({viewport:{width:size.width,height:size.height}});page.setDefaultTimeout(6000);
       const errors=[];page.on("pageerror",e=>errors.push(e.message));
       try{
         await page.addInitScript(data=>{localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data))},demoApp());
         await page.goto(address,{waitUntil:"domcontentloaded"});
         await page.locator("#memberList .member").first().waitFor();
         await page.locator('.navbtn[data-view="members"]').click();
         const metrics=await page.evaluate(()=>{
           const rect=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,top:r.top,right:r.right,bottom:r.bottom}};
           const member=document.querySelector("#memberList .member");
           return{
             header:rect(".topbar"),title:rect(".titleblock h1"),profile:rect(".profilebar select"),
             help:rect("#helpBtn"),firstMember:rect("#memberList .member"),nav:rect(".bottomnav"),
             viewport:{w:innerWidth,h:innerHeight},scrollWidth:document.documentElement.scrollWidth,
             columns:getComputedStyle(document.getElementById("memberList")).gridTemplateColumns,
             memberVisible:!!member&&getComputedStyle(member).display!=="none",
             headerFont:parseFloat(getComputedStyle(document.querySelector(".titleblock h1")).fontSize)
           };
         });
         assert.ok(metrics.scrollWidth<=size.width+3,"unexpected horizontal scroll: "+JSON.stringify(metrics));
         assert.ok(metrics.memberVisible,"member list hidden");
         assert.ok(metrics.title.x>=0&&metrics.title.right<=size.width+2,"title clipped");
         assert.ok(metrics.help.right<=size.width+2,"help clipped");
         if(size.landscape&&size.width>=600&&size.width<=1100){
           assert.ok(metrics.header.h<=67,"landscape header too tall: "+metrics.header.h);
           assert.ok(metrics.headerFont>=16,"landscape heading too small: "+metrics.headerFont);
           assert.ok(metrics.firstMember.top < metrics.nav.top-18,
             "first member not accessible above navigation: "+JSON.stringify(metrics));
           assert.equal(metrics.columns.trim().split(/\s+/).length,2,"landscape members not two columns");
         }
         await page.locator("#helpBtn").click();
         const help=await page.locator(".help-modal-box").boundingBox();
         assert.ok(help.x>=-2&&help.x+help.width<=size.width+2,"help horizontal overflow");
         assert.ok(help.y>=-2&&help.y+help.height<=size.height+2,"help vertical overflow");
         await page.locator("#helpClose").click();
         assert.deepEqual(errors,[],"browser runtime errors");
       }finally{await page.close()}
     });
   }
   await t.test("desktop new-CWL modal is truly centered and backdrop closes",async()=>{
     const page=await browser.newPage({viewport:{width:1280,height:800}});page.setDefaultTimeout(6000);
     try{
       await page.addInitScript(data=>{localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data))},demoApp());
       await page.goto(address,{waitUntil:"domcontentloaded"});
       await page.locator("#manageCwlBtn").click();
       await page.locator("#inlineActionPanel.open").waitFor();
       await page.waitForTimeout(250);
       const modal=await page.locator("#inlineActionPanel").boundingBox();
       assert.ok(Math.abs(modal.x+modal.width/2-640)<5,"dialog not horizontally centered: "+JSON.stringify(modal));
       assert.ok(Math.abs(modal.y+modal.height/2-400)<5,"dialog not vertically centered: "+JSON.stringify(modal));
       assert.equal(await page.locator("#inlineActionBackdrop.open").count(),1);
       await page.keyboard.press("Escape");
       assert.equal(await page.locator("#inlineActionPanel.open").count(),0);
     }finally{await page.close()}
   });
   await t.test("mobile priority picker and played-day confirmation stay within viewport",async()=>{
     const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(6000);
     try{
       await page.addInitScript(data=>{localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify(data))},demoApp());
       await page.goto(address,{waitUntil:"domcontentloaded"});
       await page.locator('.navbtn[data-view="members"]').click();
       await page.locator("#memberList .member-edit-toggle").first().click();
       await page.locator("#memberList .member-prio-picker").first().click();
       const choice=await page.locator("#townHallPickerModal .townhall-picker-box").boundingBox();
       assert.ok(choice.y>=-2&&choice.y+choice.height<=846,"picker out of vertical bounds");
       await page.locator("#townHallPickerClose").click();
       await page.locator('.navbtn[data-view="plan"]').click();
       await page.locator("#planDays .edit-day").first().click();
       await page.locator("#lineupModal.open").waitFor();
       const button=await page.locator("#modalSave").boundingBox();
       assert.ok(button.bottom<=845&&button.y>=0,"save button is outside viewport");
       await page.locator("#modalClose").click();
     }finally{await page.close()}
   });
 }finally{
   if(browser)await browser.close();
   await new Promise(resolve=>appServer.close(resolve));
 }
});
