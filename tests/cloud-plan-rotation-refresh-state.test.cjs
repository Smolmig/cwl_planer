"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const planner=fs.readFileSync(path.join(__dirname,"..","cwl-planning-core.js"),"utf8");

function serveApp(){
 return http.createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  if(pathname==="/cloud-app.html"){
   res.writeHead(200,{"content-type":"text/html"});res.end(html);return;
  }
  if(pathname==="/cwl-planning-core.js"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end(planner);return;
  }
  if(pathname==="/cloud-sync.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};\n");return;
  }
  res.writeHead(404);res.end("");
 });
}
test("Plan: expanded rotations survive automatic re-render without leaking to another clan",{
 timeout:120000
},async()=>{
 const server=serveApp();
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [390,1366]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    const errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{
     waitUntil:"domcontentloaded"
    });
    const selector="#day-card-1 .plan-rotation-backup";
    assert.equal(await page.locator(selector).count(),1);
    // Open several independent day details and focus a summary like a real user.
    await page.evaluate(()=>{
     document.querySelector("#day-card-1 .plan-rotation-backup").open=true;
     document.querySelector("#day-card-2 .plan-rotation-backup").open=true;
     window.CWLLegacy.rerender(); // e.g. Realtime/automatic Cloud refresh
    });
    const expanded=await page.evaluate(()=>({
     first:document.querySelector("#day-card-1 .plan-rotation-backup").open,
     second:document.querySelector("#day-card-2 .plan-rotation-backup").open,
     third:document.querySelector("#day-card-3 .plan-rotation-backup").open
    }));
    assert.deepEqual(expanded,{first:true,second:true,third:false},
     "an unrelated refresh must not close or open a rotation");
    // Changes to the same saved clan must keep the exact details states.
    await page.evaluate(()=>{
     window.CWLLegacy.getProfile().members.push(window.CWLLegacy.newMember("Tester"));
     window.CWLLegacy.rerender();
    });
    assert.equal(await page.locator(selector).evaluate(el=>el.open),true);
    // Switching the profile is a deliberate context change.
    await page.evaluate(()=>{
     const old=window.CWLLegacy.getProfile();
     const next=window.CWLLegacy.normalize({...old,id:"another-clan-test",
      name:"Anderer Clan"});
     window.CWLLegacy.switchToCloud(next);
    });
    assert.equal(await page.locator(selector).evaluate(el=>el.open),false,
     "new clan must not inherit another clan's disclosure state");
    assert.deepEqual(errors,[],"no browser errors on rerenders at "+width+"px");
   }finally{await page.close();}
  }
 }finally{
  await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
});