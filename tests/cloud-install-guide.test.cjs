"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const planner=fs.readFileSync(path.join(root,"cwl-planning-core.js"),"utf8");
const serve=()=>http.createServer((request,response)=>{
 const pathname=new URL(request.url,"http://127.0.0.1").pathname;
 if(pathname==="/cloud-app.html"){response.writeHead(200,{"content-type":"text/html"});response.end(html);return;}
 if(pathname==="/cwl-planning-core.js"){response.writeHead(200,{"content-type":"text/javascript"});response.end(planner);return;}
 if(pathname==="/cloud-sync.mjs"){response.writeHead(200,{"content-type":"text/javascript"});response.end("export {};\n");return;}
 response.writeHead(404);response.end("");
});
const agents={
 ios:"Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1",
 android:"Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
};
test("Mobile install help stays in More, never takes over plan, hides hint after dismiss or installation",{
 timeout:120000
},async()=>{
 const server=serve();
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [platform,ua] of Object.entries(agents)){
   const page=await browser.newPage({viewport:{width:390,height:844},userAgent:ua,hasTouch:true,isMobile:false});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    const url="http://127.0.0.1:"+server.address().port+"/cloud-app.html";
    await page.goto(url,{waitUntil:"domcontentloaded"});
    assert.equal(await page.locator("#view-plan.active").count(),1,"initial plan remains active");
    assert.equal(await page.locator("#view-install.active").count(),0,"install UI is not an overlay");
    assert.equal(await page.locator(".more-tile[data-more-action='install']").count(),1);
    await page.evaluate(()=>window.showPlannerView("more"));
    assert.equal(await page.locator("#installSuggestion").isVisible(),platform==="ios",
     "quiet one-time hint belongs only in More on an iPhone browser");
    await page.locator(".more-tile[data-more-action='install']").click();
    assert.equal(await page.locator("#view-install.active").count(),1);
    assert.equal(await page.locator(".navbtn[data-view='more'].active").count(),1);
    assert.equal(await page.locator("#installPlatforms [aria-pressed='true']").count(),1);
    const steps=await page.locator("#installGuideSteps").innerText();
    if(platform==="ios"){
     assert.match(steps,/Teilen/);
     assert.match(steps,/Zum Home-Bildschirm hinzufügen/);
     assert.match(steps,/Als Web-App öffnen/);
    }else{
     assert.match(steps,/Chrome/);
     assert.match(steps,/Browsermenü/);
    }
    await page.locator("#installPlatforms [data-install-platform='android']").click();
    assert.match(await page.locator("#installGuideTitle").innerText(),/Android/);
    assert.match(await page.locator("#installGuideSteps").innerText(),/Chrome|Samsung Internet|Firefox/);
    assert.equal(await page.locator("#installPlatforms [data-install-platform='android']").getAttribute("aria-pressed"),"true");
    await page.locator("#installPlatforms [data-install-platform='desktop']").click();
    assert.match(await page.locator("#installGuideTitle").innerText(),/Computer/);
    await page.locator("#installPlatforms [data-install-platform='ios']").click();
    assert.match(await page.locator("#installGuideSteps").innerText(),/Zum Home-Bildschirm hinzufügen/);
    await page.locator("#installBack").click();
    assert.equal(await page.locator("#view-more.active").count(),1);
    if(platform==="ios"){
     await page.locator("#installSuggestionDismiss").click();
     assert.equal(await page.locator("#installSuggestion").isVisible(),false);
     await page.reload({waitUntil:"domcontentloaded"});
     await page.evaluate(()=>window.showPlannerView("more"));
     assert.equal(await page.locator("#installSuggestion").isVisible(),false,
      "hint dismissal must survive reloads");
     assert.equal(await page.locator(".more-tile[data-more-action='install']").count(),1,
      "manually accessible guide stays available");
    }
    assert.deepEqual(errors,[],"no browser errors on "+platform);
   }finally{await page.close();}
  }
  const installed=await browser.newPage({viewport:{width:390,height:844},userAgent:agents.ios});
  try{
   await installed.addInitScript(()=>{
    Object.defineProperty(navigator,"standalone",{value:true,configurable:true});
   });
   await installed.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
   await installed.evaluate(()=>window.showPlannerView("more"));
   assert.equal(await installed.locator("#installSuggestion").isVisible(),false);
   await installed.locator(".more-tile[data-more-action='install']").click();
   assert.match(await installed.locator("#installGuideTitle").innerText(),/bereits installiert/);
  }finally{await installed.close();}
 }finally{
  await browser.close();
  await new Promise(ok=>server.close(ok));
 }
});
 
test("Installationshilfe erklärt die vollständige App und einen zugänglichen Fehlerfall ohne Technikjargon",{
 timeout:120000
},async()=>{
 const server=serve();await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const [width,theme] of [[320,"arena"],[390,"dark"],[430,"light"],[1366,"arena"]]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",
     {waitUntil:"domcontentloaded"});
    await page.evaluate(theme=>{
     document.documentElement.dataset.theme=theme;
     document.body.classList.add("cloud-mode","cloud-role-viewer");
     window.showPlannerView("more");
    },theme);
    await page.locator('.more-tile[data-more-action="install"]').click();
    const guide=page.locator("#view-install");
    assert.equal(await guide.isVisible(),true);
    assert.match(await guide.locator(".install-guide-check").innerText(),
     /gemeinsamen Planer.*Clan & Konto.*Statistik/s);
    assert.doesNotMatch(await guide.innerText(),/cloud-app\\.html|Offline-PWA/);
    const help=guide.locator(".install-troubleshoot");
    assert.equal(await help.getAttribute("open"),null);
    assert.match(await help.locator("summary").innerText(),/ohne Anmeldung oder Statistik/);
    assert.ok(await help.locator("summary").evaluate(e=>e.getBoundingClientRect().height)>=44);
    await help.locator("summary").click();
    assert.equal(await help.getAttribute("open"),"");
    assert.match(await help.locator("p").innerText(),/bisherige Startbildschirm-Verknüpfung/);
    assert.match(await help.locator("p").innerText(),/Cloud-Daten bleiben erhalten/);
    await guide.locator('[data-install-platform="ios"]').click();
    assert.match(await guide.locator("#installGuideSteps").innerText(),/gemeinsamen CWL-Planer/);
    assert.equal(await help.getAttribute("open"),"",
     "switching platform must not collapse an open troubleshooting section");
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    assert.ok(overflow<=3,"no horizontal overflow: "+width+" "+theme+" "+overflow);
    assert.deepEqual(errors,[],"browser errors: "+width+" "+theme);
   }finally{await page.close()}
  }
 }finally{await browser.close();await new Promise(ok=>server.close(ok))}
});
