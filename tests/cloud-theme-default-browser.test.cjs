"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const http=require("node:http");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("cloud-app.html"),offline=read("index.html");
const KEY="cwl_planer_ui_v1";
const serve=()=>http.createServer((req,res)=>{
 const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
 if(name==="cloud-sync.mjs"){
  res.writeHead(200,{"content-type":"text/javascript"});
  res.end("export {};\n");return;
 }
 if(["cloud-app.html","cwl-planning-core.js"].includes(name)){
  res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html":"text/javascript"});
  res.end(read(name));return;
 }
 res.writeHead(404);res.end("");
});
test("Cloud Gold first visit, saved choices, system, malformed prefs and separate Offline PWA",{
 timeout:150000
},async()=>{
 assert.match(html,/<html lang="de" data-theme="arena">/);
 assert.match(html,/<meta name="theme-color" content="#151a20">/);
 const beforeCss=html.slice(0,html.indexOf("<style>"));
 assert.match(beforeCss,/localStorage\.getItem\("cwl_planer_ui_v1"\)/);
 assert.match(beforeCss,/document\.documentElement\.dataset\.theme=theme/);
 assert.match(offline,/<html lang="de" data-theme="dark">/);
 assert.match(offline,/Dunkel \(Standard\)/);
 const server=serve();
 await new Promise(ok=>server.listen(0,"127.0.0.1",ok));
 const url="http://127.0.0.1:"+server.address().port+"/cloud-app.html";
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366]){
   const page=await browser.newPage({viewport:{width,height:880}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.goto(url,{waitUntil:"domcontentloaded"});
    const fresh=await page.evaluate(key=>({
     resolved:document.documentElement.dataset.theme,
     option:document.getElementById("themeSelect").value,
     first:document.getElementById("themeSelect").options[0].textContent,
     meta:document.querySelector('meta[name="theme-color"]').content,
     saved:localStorage.getItem(key),
     overflow:document.documentElement.scrollWidth-innerWidth
    }),KEY);
    assert.equal(fresh.resolved,"arena",JSON.stringify({width,fresh}));
    assert.equal(fresh.option,"arena");
    assert.match(fresh.first,/Gold \(Standard\)/);
    assert.equal(fresh.meta,"#151a20");
    assert.ok(fresh.overflow<=3,JSON.stringify({width,fresh}));
    assert.ok(fresh.saved===null||JSON.parse(fresh.saved).theme==="arena");
    await page.evaluate(key=>localStorage.setItem(key,JSON.stringify({
     theme:"dark",compactPlan:true,dayViewMode:"single",lastBackupAt:12345
    })),KEY);
    await page.reload({waitUntil:"domcontentloaded"});
    const old=await page.evaluate(key=>({
     theme:document.documentElement.dataset.theme,
     option:document.getElementById("themeSelect").value,
     saved:JSON.parse(localStorage.getItem(key))
    }),KEY);
    assert.equal(old.theme,"dark",JSON.stringify({width,old}));
    assert.equal(old.option,"dark");
    assert.equal(old.saved.compactPlan,true);
    assert.equal(old.saved.dayViewMode,"single");
    assert.equal(old.saved.lastBackupAt,12345);
    await page.evaluate(()=>{
     const select=document.getElementById("themeSelect");
     select.value="light";
     select.dispatchEvent(new Event("change",{bubbles:true}));
    });
    assert.match(await page.evaluate(key=>localStorage.getItem(key),KEY),/"theme":"light"/);
    await page.reload({waitUntil:"domcontentloaded"});
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),"light");
    assert.equal(await page.locator("#themeSelect").inputValue(),"light");
    assert.deepEqual(errors,[],JSON.stringify({width,errors}));
   }finally{await page.close()}
  }
  const page=await browser.newPage({viewport:{width:390,height:840},colorScheme:"light"});
  try{
   await page.goto(url,{waitUntil:"domcontentloaded"});
   for(const [raw,expected] of [
    [JSON.stringify({theme:"invalid"}),"arena"],
    ["{broken JSON","arena"],
    [JSON.stringify({theme:"cyberlight"}),"cyberlight"],
    [JSON.stringify({theme:"system"}),"light"]
   ]){
    await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:KEY,value:raw});
    await page.reload({waitUntil:"domcontentloaded"});
    assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),expected,raw);
   }
   assert.equal(await page.locator("#themeSelect").inputValue(),"system");
   await page.emulateMedia({colorScheme:"dark"});
   await page.reload({waitUntil:"domcontentloaded"});
   assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),"dark");
   assert.equal(await page.locator("#themeSelect").inputValue(),"system");
  }finally{await page.close()}
 }finally{
  await browser.close();await new Promise(ok=>server.close(ok))
 }
});
