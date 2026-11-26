"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"..");
const allowed=new Set(["tests/fixtures/strategic-preview.html","tests/fixtures/strategic-preview.mjs","cwl-planning-core.js","cwl-strategic-experiment.mjs","cwl-strategic-daily.mjs","cwl-strategic-targets.mjs"]);
test("isolated strategic UI uses actual cores, handles modes, role, disclosure and responsive themes",{timeout:120000},async()=>{
 const server=http.createServer((req,res)=>{const name=(req.url||"/").slice(1).split("?")[0];if(!allowed.has(name)){res.writeHead(404);res.end();return}res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8","cache-control":"no-store"});res.end(fs.readFileSync(path.join(root,name)))});
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));let browser;
 try{
 browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],remote=[];
 page.on("pageerror",e=>errors.push(e.message));page.on("request",r=>{if(!r.url().startsWith("http://127.0.0.1:"))remote.push(r.url())});
 await page.goto("http://127.0.0.1:"+server.address().port+"/tests/fixtures/strategic-preview.html");
 await page.locator("#rosterRows li").first().waitFor();assert.equal(await page.locator("#rosterRows li").count(),22);
 await page.locator("input[value=performance]").check();assert.ok(await page.locator("#size option").count()>1);
 await page.locator("#size").selectOption({index:1});assert.equal(await page.locator("#rosterRows li").count(),21);
 assert.match(await page.locator("#rosterWarning").innerText(),/Einzelprüfung/);
 await page.locator("#rosterInfo summary").click();await page.locator("input[value=development]").check();assert.equal(await page.locator("#rosterInfo[open]").count(),1);
 await page.locator("#phase").selectOption("daily");await page.locator("input[value=balanced]").check();
 assert.match(await page.locator("#tableStatus").innerText(),/Klassenerhalt offen/);
 assert.equal(await page.locator("#days span").count(),5);assert.match(await page.locator("#days").innerText(),/Tag 3 · Vorbereitung/);
 await page.locator("#medals summary").click();await page.locator("#role").selectOption("viewer");assert.match(await page.locator("#status").innerText(),/Lesemodus/);assert.equal(await page.locator("#medals[open]").count(),1);assert.equal(await page.locator("#dismiss").isVisible(),false);
 const dir=process.env.CWL_UX_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
 for(const width of [320,390,430,1366,1440]){await page.setViewportSize({width,height:900});for(const theme of ["dark","light","gold"]){await page.locator("#theme").selectOption(theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(dir&&theme==="dark")await page.screenshot({path:path.join(dir,"strategic-daily-"+width+".png"),fullPage:true})}}
 await page.locator("#phase").selectOption("roster");await page.locator("#role").selectOption("owner");await page.locator("#theme").selectOption("dark");await page.locator("input[value=performance]").check();
 for(const width of [320,390,430,1366,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);if(dir)await page.screenshot({path:path.join(dir,"strategic-roster-"+width+".png"),fullPage:true})}
 assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve))}
});
