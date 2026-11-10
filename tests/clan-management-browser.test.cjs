"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(__dirname,"..","clan-management-core.js"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("/* #183: do not reuse the roster import path");
const end=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',start);
assert.ok(start>0&&end>start);
const previewScript=html.slice(start,end);
const data=[
 {tag:"#2PYL",name:"One",role:"member"},{tag:"#2PYQ",name:"Two",role:"admin"},
 {tag:"#2PYR",name:"Vize",role:"coLeader"},{tag:"#2PYJ",name:"Leader",role:"leader"}
];
async function setup(page,theme="arena"){
 await page.setContent(markup,{waitUntil:"domcontentloaded"});
 await page.addScriptTag({content:core});
 await page.addScriptTag({content:
  "const mockRoster="+JSON.stringify(data)+";"+
  "let context='first',owner=true,delay=false,resolvePending=null;"+
  "window.CWLCloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,getActiveClanId:()=>context,"+
  "fetchManagementRoster:()=>delay?new Promise(resolve=>{resolvePending=resolve}):"+
  "Promise.resolve({clanId:context,members:mockRoster,checkedAt:Date.parse('2026-11-10T06:00:00Z')})};"+
  "function showPlannerView(target){document.querySelectorAll('.view').forEach("+
  "x=>x.classList.toggle('active',x.id==='view-'+target));}"
 });
 await page.addScriptTag({content:previewScript});
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
}
test("More/Clanverwaltung shows current Clash ranks without recommending actions or copying leader rows",{
 timeout:60000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await setup(page);
   await page.evaluate(()=>window.CWLClanManagementView.accessChanged("first"));
   await page.evaluate(()=>window.CWLClanManagementView.open());
   await page.waitForFunction(()=>document.getElementById("clanManagementStatus").textContent.includes("Clash-Stand"));
   const rows=await page.locator(".clan-management-person").allTextContents();
   assert.equal(rows.length,2);
   assert.ok(rows.some(s=>s.includes("One")&&s.includes("Mitglied")));
   assert.ok(rows.some(s=>s.includes("Two")&&s.includes("Ältester")));
   assert.ok(rows.every(s=>!s.includes("Vize")&&!s.includes("Leader")));
   assert.match(await page.locator("#clanManagementSummary").textContent(),/2 Vize\/Clanführer ausgenommen/);
   assert.equal(await page.locator("#clanManagementList button").count(),0);
   await page.locator("#clanManagementBack").click();
   assert.equal(await page.locator("#view-more").getAttribute("class"),"view active");
   assert.deepEqual(errors,[]);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("Discard pending API response after clan switch or lost owner permission",{
 timeout:60000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const page=await browser.newPage();
  try{
   await setup(page);
   await page.evaluate(()=>{
    window.CWLClanManagementView.accessChanged("first");
    delay=true;
    window.CWLClanManagementView.open();
    context="second";
    window.CWLClanManagementView.accessChanged("second");
    resolvePending({clanId:"first",members:mockRoster,checkedAt:Date.now()});
   });
   await page.waitForTimeout(20);
   assert.equal(await page.locator(".clan-management-person").count(),0);
   await page.evaluate(()=>{
    owner=false;
    window.CWLClanManagementView.accessChanged(null);
   });
   assert.equal(await page.locator("#view-clan-management").getAttribute("class"),"view more-subview");
   assert.equal(await page.locator(".clan-management-person").count(),0);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("Compact read-only management screen fits mobile Gold, Dark and Light widths",{
 timeout:90000
},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,1024]){
    const page=await browser.newPage({viewport:{width,height:844}});
    try{
     await setup(page,theme);
     await page.evaluate(()=>{window.CWLClanManagementView.accessChanged("first");window.CWLClanManagementView.open()});
     await page.waitForFunction(()=>document.querySelectorAll(".clan-management-person").length===2);
     const layout=await page.evaluate(()=>({
      viewport:innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      backHeight:document.getElementById("clanManagementBack").getBoundingClientRect().height,
      refreshHeight:document.getElementById("clanManagementRefresh").getBoundingClientRect().height,
      rows:document.querySelectorAll(".clan-management-person").length
     }));
     assert.ok(layout.documentWidth<=width+3,JSON.stringify({theme,width,layout}));
     assert.ok(layout.backHeight>=40&&layout.refreshHeight>=44,JSON.stringify({theme,width,layout}));
     assert.equal(layout.rows,2);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});
