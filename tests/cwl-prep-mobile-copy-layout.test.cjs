"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const style=html.match(/<style>([\s\S]*?)<\/style>/)?.[1];

test("CWL mobile comparison keeps timestamp, completed swaps and copy button in independent rows",{
 timeout:90000
},async()=>{
 assert.ok(style,"Cloud app CSS is available");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,768]){
    const page=await browser.newPage({viewport:{width,height:800}});
    try{
     await page.setContent('<!doctype html><html lang="de" data-theme="'+theme+'"><head>'+
      '<meta name="viewport" content="width=device-width,initial-scale=1"><style>'+
      style+'</style></head><body class="cloud-mode">'+
      '<main id="view-plan" class="view active" style="width:100%;max-width:640px;margin:auto;padding:12px">'+
      '<div class="card day-card"><div class="cwl-live-day"><div class="cwl-prep-review">'+
      '<div class="cwl-prep-heading"><b>✓ Aufstellung stimmt mit Clash überein</b></div>'+
      '<div class="statusline cwl-prep-meta">Details in „Aufstellung“ · Stand 17:42</div>'+
      '<div class="statusline cwl-prep-completed">Seit Tag 4: 2 raus · 2 rein (bereits in Clash)</div>'+
      '<div class="cwl-prep-actions"><button type="button" class="btn small cwl-copy-live-swaps">Wechseltext kopieren</button></div>'+
      '</div></div></div></main></body></html>',{waitUntil:"domcontentloaded"});
     const box=await page.evaluate(()=>{
      const rect=selector=>{
       const r=document.querySelector(selector).getBoundingClientRect();
       return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};
      };
      return {meta:rect(".cwl-prep-meta"),completed:rect(".cwl-prep-completed"),
       actions:rect(".cwl-prep-actions"),button:rect(".cwl-copy-live-swaps"),
       overflow:document.documentElement.scrollWidth-innerWidth};
     });
     const reason=JSON.stringify({theme,width,box});
     assert.ok(box.meta.bottom+2<=box.completed.top,"timestamp and summary overlap: "+reason);
     assert.ok(box.completed.bottom+2<=box.actions.top,"summary and copy button overlap: "+reason);
     assert.ok(box.button.top>=box.actions.top-2&&box.button.bottom<=box.actions.bottom+2,
      "button escapes its action row: "+reason);
     assert.ok(box.overflow<=2,"horizontal overflow: "+reason);
     assert.ok(box.button.height>=42,"button too small: "+reason);
     if(width<=699)assert.ok(Math.abs(box.button.width-box.actions.width)<=2,
       "mobile action must span the full comparison width: "+reason);
     else assert.ok(box.button.width<350,"desktop action stays compact: "+reason);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
