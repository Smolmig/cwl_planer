"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {createServer}=require("node:http");
const {spawnSync}=require("node:child_process");
const {chromium}=require("playwright");

// Actual generated staging HTML, modules, manifest, and network-only service
// worker in a real browser. No live Supabase access and no real XLSX files.
const root=path.resolve(__dirname,"..");
const build=path.join(root,"scripts/build_clashperk_staging_preview.cjs");
const localRef="stagingprojectxyz123";
const stagingUrl="https://"+localRef+".supabase.co";
const fakeKey="sb_publishable_synthetic_preview_only_2026";
const liveModule=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const liveUrl=/const SUPABASE_URL="([^"]+)";/.exec(liveModule)[1];
const liveRef=new URL(liveUrl).hostname;

test("generated Cloud staging preview starts and registers a network-only PWA in Chromium",{
 timeout:120000
},async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cwl-preview-browser-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const out=path.join(dir,"site");
 const built=spawnSync(process.execPath,[build,out],{
  encoding:"utf8",timeout:15000,
  env:{...process.env,CWL_STAGING_SUPABASE_URL:stagingUrl,
   CWL_STAGING_PUBLISHABLE_KEY:fakeKey}
 });
 assert.equal(built.status,0,built.stderr);
 assert.ok(fs.existsSync(path.join(out,"cwl-player-linked-history.mjs")),
   "Staging bundle must include linked-player dependency");
 const type=name=>name.endsWith(".mjs")||name.endsWith(".js")?"text/javascript":
  name.endsWith(".webmanifest")||name.endsWith(".json")?"application/json":
  name.endsWith(".svg")?"image/svg+xml":
  name.endsWith(".png")?"image/png":"text/html";
 const server=createServer((req,res)=>{
  const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
  if(!name||name.includes("/")||name.includes("..")){
   res.writeHead(404).end();return;
  }
  const file=path.join(out,name);
  if(!fs.existsSync(file)){
   res.writeHead(404).end();return;
  }
  res.writeHead(200,{"Content-Type":type(name),"Cache-Control":"no-store"});
  fs.createReadStream(file).pipe(res);
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const origin="http://127.0.0.1:"+server.address().port;
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:"allow",viewport:{width:390,height:844}});
 t.after(()=>context.close());
 const page=await context.newPage();
 const unexpectedRequests=[],pageErrors=[],clientConfig=[];
 page.on("pageerror",e=>pageErrors.push(e.message));
 await context.route("**/*",async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.origin===origin)return route.continue();
  // Replace the third-party Supabase library with a synthetic, in-memory
  // guest-session facade; the real Cloud routing code still runs untouched.
  if(url.origin==="https://esm.sh"){
   return route.fulfill({status:200,contentType:"text/javascript",body:
    "export const createClient=(url,key)=>{"+
    "window.__stagingClient={url,key};"+
    "return {auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),"+
    "getSession:async()=>({data:{session:null},error:null})}};};"});
  }
  unexpectedRequests.push(url.origin+url.pathname);
  return route.abort();
 });
 await page.goto(origin+"/cloud-app.html",{waitUntil:"load",timeout:45000});
 await page.waitForFunction(()=>!!window.__stagingClient,{timeout:25000})
  .catch(error=>{throw new Error("Staging client did not initialize: "+
    JSON.stringify({pageErrors,unexpectedRequests})+" · "+error.message);});
 const initial=await page.evaluate(()=>({
  title:document.title,
  mark:document.getElementById("cwl-staging-watermark")?.textContent,
  host:window.__stagingClient?.url,
  clientKey:window.__stagingClient?.key,
  manifest:document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
  viewportWidth:innerWidth,
  contentWidth:document.documentElement.scrollWidth
 }));
 assert.equal(initial.host,stagingUrl);
 assert.equal(initial.clientKey,fakeKey);
 assert.match(initial.title,/TEST/);
 assert.match(initial.mark,/TESTUMGEBUNG/);
 assert.equal(initial.manifest,"./cloud-manifest.webmanifest");
 assert.ok(initial.contentWidth<=initial.viewportWidth+2,"Staging preview overflows mobile viewport");
 await page.waitForFunction(async()=>{
  const regs=await navigator.serviceWorker.getRegistrations();
  return regs.some(x=>x.active?.scriptURL.endsWith("/service-worker.js"));
 },{timeout:15000});
 const workerCount=await page.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).length);
 assert.equal(workerCount,1,"Only one isolated staging service worker is registered");
 await page.reload({waitUntil:"load",timeout:45000});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller,{timeout:15000});
 const controlled=await page.evaluate(()=>({
  script:navigator.serviceWorker.controller?.scriptURL,
  title:document.title
 }));
 assert.ok(controlled.script.endsWith("/service-worker.js"));
 assert.match(controlled.title,/TEST/);
 assert.deepEqual(unexpectedRequests,[],"Staging attempted an unexpected external network request");
 assert.deepEqual(pageErrors,[],"Generated Cloud app produced browser JavaScript errors");
 assert.equal(clientConfig.length,0);
 assert.equal(unexpectedRequests.some(x=>x.includes(liveRef)),false);
});
