"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,".."),sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8"),html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const src=sync.slice(sync.indexOf("function describeRemoteEvent(event){"),sync.indexOf("async function showRemoteChangeDetails(){"))+
 sync.slice(sync.indexOf("function classifyAuditEvent(event){"),sync.indexOf("let auditRequestSerial=0;"));
const updated=(id,details,actor_id="a")=>({id,actor_id,event_type:"profile_updated",created_at:"2026-11-28T10:00:00Z",details});
const plan=updated(1,{spieleraenderungen:[{name:"Alpha",felder:{fixed:[false,true],targetDays:[null,3]}}],bereiche:["members","updatedAt"]});
const technical=updated(2,{bereiche:["cwlLive","updatedAt"]},null);
const legacy=updated(3,{spieleraenderungen:[]},"former");
const sort=updated(4,{config_differenzen:{memberSort:["name","manual"]},config_geaendert:true,bereiche:["config"]});
const mixed=updated(5,{bereiche:["cwlLive","updatedAt"],weitere_spieler:4});
const unknown=updated(6,{bereiche:["updatedAt"],config_geaendert:true});
function fixture(){
 const dom=new JSDOM('<div id="cloudAudit"></div>');
 const api=new Function("document",src+"return {classifyAuditEvent,renderAuditRows};")(dom.window.document);
 return {dom,api,host:dom.window.document.getElementById("cloudAudit")};
}
test("Audit classification uses stored fields and never drops legacy or mixed evidence",()=>{
 const {dom,api}=fixture();
 try{
  for(const e of [plan,updated(7,{plan_geaendert:true}),updated(8,{day_goals_geaendert:true}),updated(9,{config_differenzen:{slots:[15,30]}})])
   assert.equal(api.classifyAuditEvent(e),"planning");
  assert.equal(api.classifyAuditEvent(technical),"technical");
  for(const e of [legacy,sort,mixed,unknown])assert.equal(api.classifyAuditEvent(e),"other");
 }finally{dom.window.close()}
});
test("Audit puts planning first, retains other rows, restores open details only for same clan/account",()=>{
 const {dom,api,host}=fixture();
 try{
  const rows=[technical,legacy,sort,mixed,plan,unknown];
  api.renderAuditRows(host,rows,[{user_id:"a",display_name:"<script>"}],"a","scope-a");
  assert.equal(host.firstElementChild.dataset.auditKey,"event:1");
  assert.match(host.firstElementChild.textContent,/Du.*Alpha · Fix: Nein → Ja/s);
  const group=host.querySelector(".cloud-audit-other");
  assert.equal(group.open,false);
  assert.match(group.firstElementChild.textContent,/Weitere Aktivitäten \(5\)/);
  assert.equal(host.querySelectorAll(".cloud-audit-item").length,6);
  assert.match(group.textContent,/System \/ nicht zugeordnet/);
  assert.match(group.textContent,/damals nicht aufgezeichnet/);
  assert.equal(host.querySelector("script"),null);
  group.open=true;host.firstElementChild.open=true;
  api.renderAuditRows(host,rows,[],"a","scope-a");
  assert.equal(host.querySelector(".cloud-audit-other").open,true);assert.equal(host.firstElementChild.open,true);
  api.renderAuditRows(host,rows,[],"a","scope-b");
  assert.equal(host.querySelector(".cloud-audit-other").open,false);assert.equal(host.firstElementChild.open,false);
  api.renderAuditRows(host,[technical],[],"a","scope-b");
  assert.match(host.textContent,/keine konkreten Planänderungen belegt/);
  api.renderAuditRows(host,[],[],"a","scope-b");assert.match(host.textContent,/Noch keine gemeinsamen Änderungen/);
 }finally{dom.window.close()}
});
test("Audit browser: real grouped history supports disclosure and no horizontal overflow",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 try{
  for(const width of [320,390,430,1366,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.evaluate(({src,rows})=>{
     document.documentElement.dataset.theme="arena";
     document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
     document.getElementById("view-account").classList.add("active");
     document.getElementById("cloudAccount").hidden=false;
     document.getElementById("cloudAccountAuditSection").hidden=false;
     new Function("document",src+"return renderAuditRows;")(document)(document.getElementById("cloudAudit"),rows,[],"a","a");
    },{src,rows:[technical,legacy,sort,plan]});
    const group=page.locator("#cloudAudit .cloud-audit-other");
    await group.locator("summary").first().click();
    assert.equal(await group.getAttribute("open"),"");
    const m=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,heights:[...document.querySelectorAll("#cloudAudit summary")].map(x=>x.getBoundingClientRect().height)}));
    assert.ok(m.scroll<=width+3,JSON.stringify({width,m}));assert.ok(m.heights.every(x=>x>=43));
    fs.mkdirSync(path.join(root,"ux-screenshots"),{recursive:true});
    await page.locator("#cloudAccountAuditSection").scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(root,"ux-screenshots","account-audit-arena-"+width+".png")});
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
