"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const http=require("node:http");
const path=require("node:path");
const {chromium}=require("playwright");

const root=path.resolve(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
const manifest=JSON.parse(read("cloud-manifest.webmanifest"));
const localManifest=JSON.parse(read("manifest.webmanifest"));
const cloudHtml=read("cloud-app.html");
const offlineHtml=read("index.html");

test("Cloud and offline app have distinct, stable launch identities while refreshing only the offline icon cache",()=>{
 assert.equal(manifest.id,"./cloud-app.html");
 assert.equal(manifest.start_url,"./cloud-app.html");
 assert.equal(manifest.scope,"./");
 assert.equal(manifest.display,"standalone");
 assert.equal(manifest.name,"CWL Planer Cloud");
 assert.notEqual(manifest.id,localManifest.id||localManifest.start_url);
 assert.notEqual(manifest.start_url,localManifest.start_url);
 assert.equal(localManifest.start_url,"./");
 assert.equal(localManifest.scope,"./");
 assert.match(cloudHtml,/<link rel="manifest" href="\.\/cloud-manifest\.webmanifest">/);
 assert.match(offlineHtml,/<link rel="manifest" href="\.\/manifest\.webmanifest">/);
 assert.match(read("service-worker.js"),/cwl-planer-v1-0-2-brand2/);
 assert.ok(read("service-worker.js").includes("brand-icon-192.png"));
 assert.ok(read("service-worker.js").includes("brand-icon-512.png"));
 for(const item of [manifest,localManifest]){
   assert.deepEqual(item.icons.map(icon=>icon.src),["./brand-icon-192.png","./brand-icon-512.png"]);
   assert.ok(item.icons.every(icon=>icon.purpose==="any"));
 }
 assert.ok(cloudHtml.includes('rel="apple-touch-icon" sizes="192x192" href="./brand-icon-192.png"'));
 assert.ok(offlineHtml.includes('rel="apple-touch-icon" sizes="192x192" href="./brand-icon-192.png"'));
 assert.ok(cloudHtml.includes('property="og:image" content="https://smolmig.github.io/cwl_planer/brand-social-preview.png"'));
 assert.ok(offlineHtml.includes('property="og:image" content="https://smolmig.github.io/cwl_planer/brand-social-preview.png"'));
 for(const [asset,size] of [["brand-icon-192.png",192],["brand-icon-512.png",512]]){
   const bytes=fs.readFileSync(path.join(root,asset));
   assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
   assert.equal(bytes.readUInt32BE(16),size);
   assert.equal(bytes.readUInt32BE(20),size);
 }
 const share=fs.readFileSync(path.join(root,"brand-social-preview.png"));
 assert.equal(share.readUInt32BE(16),1200);
 assert.equal(share.readUInt32BE(20),630);
 assert.match(read("service-worker.js"),/cloud-app\\\.html/);
 assert.ok(!read("service-worker.js").includes("cloud-manifest.webmanifest"),
  "offline worker must never pre-cache the online Cloud installation metadata");
});

test("Android installation follows cloud-app.html, not the legacy three-tab offline planner",{
 timeout:120000
},async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  if(pathname==="/cloud-sync.mjs"){
   res.writeHead(200,{"content-type":"text/javascript"});
   res.end("export {};\n");return;
  }
  const map={"/":"index.html","/index.html":"index.html",
   "/cloud-app.html":"cloud-app.html",
   "/cloud-manifest.webmanifest":"cloud-manifest.webmanifest",
   "/manifest.webmanifest":"manifest.webmanifest",
   "/cwl-planning-core.js":"cwl-planning-core.js"};
  const file=map[pathname];
  if(!file){res.writeHead(404);res.end("");return}
  const kind=file.endsWith(".webmanifest")?"application/manifest+json":
   file.endsWith(".png")?"image/png":
   file.endsWith(".js")?"text/javascript":"text/html";
  res.writeHead(200,{"content-type":kind+"; charset=utf-8"});
  res.end(read(file));
 });
 await new Promise(done=>server.listen(0,"127.0.0.1",done));
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const url="http://127.0.0.1:"+server.address().port;
  const page=await browser.newPage({
   viewport:{width:384,height:854},isMobile:true,hasTouch:true,
   userAgent:"Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36"
  });
  try{
   const errors=[];
   page.on("pageerror",err=>errors.push(err.message));
   await page.goto(url+"/cloud-app.html",{waitUntil:"domcontentloaded"});
   const info=await page.evaluate(async()=>{
    const link=document.querySelector('link[rel="manifest"]');
    const response=await fetch(link.href);
    const manifest=await response.json();
    const start=new URL(manifest.start_url,response.url);
    const id=new URL(manifest.id,response.url);
    return {linkPath:new URL(link.href).pathname,startPath:start.pathname,
      idPath:id.pathname,startOrigin:start.origin,currentOrigin:location.origin,
      cloudLogin:!!document.getElementById("cloudOpen"),
      cloudStats:!!document.getElementById("statsNav"),
      cloudMore:!!document.querySelector('.navbtn[data-view="more"]'),
      name:manifest.name};
   });
   assert.deepEqual(info,{
    linkPath:"/cloud-manifest.webmanifest",startPath:"/cloud-app.html",
    idPath:"/cloud-app.html",startOrigin:new URL(url).origin,currentOrigin:new URL(url).origin,
    cloudLogin:true,cloudStats:true,cloudMore:true,name:"CWL Planer Cloud"
   });
   await page.goto(url+info.startPath,{waitUntil:"domcontentloaded"});
   assert.equal(await page.locator("#cloudOpen").count(),1,
    "the installed Cloud launch must expose its account entry point");
   assert.ok(await page.locator("#statsNav").count()===1);
   assert.deepEqual(errors,[]);
  }finally{await page.close();}
 }finally{
  await browser.close();
  await new Promise(done=>server.close(done));
 }
});
