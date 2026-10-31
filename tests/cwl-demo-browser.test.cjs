"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const allowed=new Set(["cwl-demo.html","cwl-demo-data.mjs","cwl-live.mjs","cwl-live-core.mjs"]);
function demoServer(){
 return http.createServer((req,res)=>{
  const file=decodeURIComponent((req.url||"/").split("?")[0]).replace(/^\/+/,"");
  if(!allowed.has(file)){res.writeHead(404);res.end();return}
  res.writeHead(200,{"content-type":file.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8","cache-control":"no-store"});
  res.end(fs.readFileSync(path.join(root,file)));
 });
}
test("Isolated CWL browser simulation: seven days, live war attacks, idempotent locks, no cloud requests",{timeout:120000},async()=>{
 const srv=demoServer();
 await new Promise(resolve=>srv.listen(0,"127.0.0.1",resolve));
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const pageErrors=[],remoteRequests=[];
  page.on("pageerror",e=>pageErrors.push(e.message));
  page.on("request",r=>{
   if(!r.url().startsWith("http://127.0.0.1:"))remoteRequests.push(r.url());
  });
  await page.goto("http://127.0.0.1:"+srv.address().port+"/cwl-demo.html");
  await page.locator("#day-card-0 .cwl-live-day").waitFor();
  assert.match(await page.locator("#cwlLiveOverview").innerText(),/CWL 2026-11/);
  assert.match(await page.locator("#day-card-0 .cwl-live-day").innerText(),/Nachtwächter/);
  assert.equal((await page.locator("#day-card-0 .cwl-live-score").innerText()).replace(/\s/g,""),"0:0");
  assert.equal(await page.locator("#day-card-0 .cwl-live-badge-placeholder").count(),2);
  assert.match(await page.locator("#day-card-1 .cwl-live-day").innerText(),/Eislegion/);
  assert.match(await page.locator("#day-card-2 .cwl-live-day").innerText(),/Noch nicht von Clash freigegeben/);
  assert.match(await page.locator("#demoCompleted").innerText(),/0 \/ 7/);
  await page.locator("#demoNext").click();
  await page.locator("#day-card-0 .cwl-live-attack").first().waitFor({state:"attached"});
  assert.match(await page.locator("#day-card-0 .cwl-live-day").innerText(),/Krieg läuft/);
  assert.match(await page.locator("#day-card-0 .cwl-live-day").innerText(),/8\/15 Angriffe/);
  const details=page.locator("#day-card-0 .cwl-live-details");
  await details.locator("summary").click();
  assert.equal(await details.locator(".cwl-live-attack").count(),15);
  assert.equal(await details.locator(".cwl-live-attack.pending").count(),7);
  assert.match(await details.locator(".cwl-live-attack").first().innerText(),/Angriff offen/);
  assert.match(await details.locator(".cwl-live-attack").first().innerText(),/Spieler 09/);
  assert.equal(await details.locator(".cwl-live-attack").nth(7).locator(".cwl-live-stars").innerText(),"★★☆");
  assert.match(await details.locator(".cwl-live-attack").nth(7).locator(".cwl-live-percent").innerText(),/83/);
  assert.match(await details.locator(".cwl-live-attack").nth(7).innerText(),/Gegner 01/);
  assert.equal((await page.locator("#day-card-0 .cwl-live-score").innerText()).replace(/\s/g,""),"20:15");
  await page.locator("#demoNext").click();
  await page.waitForFunction(()=>document.getElementById("demoCompleted").textContent.includes("1 / 7"));
  assert.match(await page.locator("#day-card-0").innerText(),/GESPIELT/);
  assert.equal(await page.locator("#day-card-0 .cwl-live-details[open]").count(),1,
    "Expanded attack details should stay expanded after a live refresh");
  assert.equal(await page.locator("#day-card-0 .cwl-live-attack.pending").count(),1);
  assert.match(await page.locator("#day-card-0 .cwl-live-attack").first().innerText(),/Spieler 01/);
  assert.match(await page.locator("#day-card-0 .cwl-live-attack").last().innerText(),/Kein Angriff erfasst/);
  assert.equal((await page.locator("#day-card-0 .cwl-live-score").innerText()).replace(/\s/g,""),"35:27");
  assert.match(await page.locator("#day-card-0 .cwl-live-score-detail").innerText(),/Zerstörung/);
  assert.match(await page.locator("#day-card-0").innerText(),/Automatisch abgeschlossen/);
  await page.locator("#cwlLiveRefresh").click();
  await page.waitForFunction(()=>!document.getElementById("cwlLiveRefresh").disabled);
  assert.match(await page.locator("#demoCompleted").innerText(),/1 \/ 7/);
  await page.locator("#demoError").check();
  await page.waitForFunction(()=>document.getElementById("demoApiState").textContent==="Fehler");
  assert.match(await page.locator("#demoCompleted").innerText(),/1 \/ 7/);
  assert.match(await page.locator("#cwlLiveOverview").innerText(),/API nicht erreichbar/);
  await page.locator("#demoError").uncheck();
  await page.locator("#demoNoCwl").check();
  await page.waitForFunction(()=>document.getElementById("demoApiState").textContent==="Aus");
  assert.equal(await page.locator(".cwl-live-day").count(),0);
  assert.match(await page.locator("#demoCompleted").innerText(),/1 \/ 7/);
  await page.locator("#demoNoCwl").uncheck();
  await page.locator("#demoAll").click();
  await page.waitForFunction(()=>document.getElementById("demoCompleted").textContent.includes("7 / 7"),undefined,{timeout:20000});
  assert.equal(await page.locator(".day-card.locked").count(),7);
  assert.match(await page.locator("#day-card-6").innerText(),/GESPIELT/);
  assert.equal(await page.locator("#demoNext").isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  assert.equal(await page.evaluate(()=>sessionStorage.length),0);
  assert.deepEqual(remoteRequests,[],"Simulation must never call Supabase or a third-party API");
  assert.deepEqual(pageErrors,[],"No browser JavaScript exceptions");
  await page.locator("#demoReset").click();
  await page.waitForFunction(()=>document.getElementById("demoCompleted").textContent.includes("0 / 7"));
  assert.equal(await page.locator(".day-card.locked").count(),0);
  await page.close();
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>srv.close(resolve));
 }
});
