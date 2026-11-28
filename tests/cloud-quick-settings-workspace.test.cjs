"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8"),sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const html=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
test("Cloud quick settings preserve single-instance controls and viewer navigation allowlist",()=>{
 for(const id of ["settingsRulesSection","settingsAutoRosterBox","settingsBackupSection","settingsAppearanceSection","themeSelect","settingsClose","openReleaseHistory","reportBugBtn"]){
  assert.equal((app.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 }
 assert.match(sync,/"settingsCloudManage","settingsClose","openReleaseHistory","reportBugBtn","moreSettingsBack"/);
 assert.match(app,/data-more-action="rules"/);assert.match(app,/data-more-action="backup"/);
});
test("Cloud quick settings retain detailed fallback pages and local settings at mobile and desktop widths",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    for(const theme of ["arena","dark","light","cyber","cyberlight"]){
     const result=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode");
      document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
      document.getElementById("view-settings").classList.add("active");
      const byId=id=>document.getElementById(id);
      const display=id=>getComputedStyle(byId(id)).display;
      const box=byId("view-settings").querySelector(".settings-window").getBoundingClientRect();
      const select=byId("themeSelect");select.value=theme;const style=getComputedStyle(select),ctx=document.createElement("canvas").getContext("2d");ctx.font=style.font;
      const fits=ctx.measureText(select.options[select.selectedIndex].text).width<=select.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-18;
      const visible=["themeSelect","settingsClose","settingsCloudManage","openReleaseHistory","reportBugBtn"].map(id=>({id,h:byId(id).getBoundingClientRect().height}));
      return {width:innerWidth,scroll:document.documentElement.scrollWidth,box:box.width,visible,fits,
       rules:display("settingsRulesSection"),auto:display("settingsAutoRosterBox"),backup:display("settingsBackupSection"),
       appearance:getComputedStyle(document.querySelector('[data-more-action="appearance"]')).display};
     },theme);
     assert.ok(result.scroll<=width+3,JSON.stringify({theme,width,result}));
     assert.ok(result.box<=481&&result.box>200,JSON.stringify({theme,width,result}));
     assert.ok(result.fits,"Selected theme label must fit: "+JSON.stringify({theme,width,result}));
     assert.equal(result.rules,"none");assert.equal(result.auto,"none");assert.equal(result.backup,"none");assert.equal(result.appearance,"none");
     for(const x of result.visible)assert.ok(x.h>=43,JSON.stringify({theme,width,x}));
     if(theme==="arena"||theme==="dark"){
      fs.mkdirSync(path.join(root,"ux-screenshots"),{recursive:true});
      await page.screenshot({path:path.join(root,"ux-screenshots","quick-settings-"+theme+"-"+width+".png")});
     }
    }
    const fallback=await page.evaluate(()=>{
     const host=document.getElementById("moreSettingsContent");
     document.getElementById("view-settings").classList.remove("active");
     document.getElementById("view-more-settings").classList.add("active");
     const nodes=["settingsRulesSection","settingsAutoRosterBox","settingsBackupSection"].map(id=>document.getElementById(id));
     const homes=nodes.map(n=>n.parentNode);
     host.append(...nodes);
     const details=nodes.map(n=>getComputedStyle(n).display);
     nodes.forEach((n,i)=>homes[i].append(n));
     document.body.classList.remove("cloud-mode");
     document.getElementById("view-more-settings").classList.remove("active");
     document.getElementById("view-settings").classList.add("active");
     return {details,localRules:getComputedStyle(nodes[0]).display,localBackup:getComputedStyle(nodes[2]).display,
      localTheme:getComputedStyle(document.querySelector('[data-more-action="appearance"]')).display};
    });
    assert.ok(fallback.details.every(x=>x!=="none"));assert.notEqual(fallback.localRules,"none");assert.notEqual(fallback.localBackup,"none");assert.notEqual(fallback.localTheme,"none");
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("More groups keep unique routes, Cloud hides redundant entries, install stays reachable from help",async()=>{
 const {JSDOM}=require("jsdom");
 const dom=new JSDOM(html);
 try{
  const d=dom.window.document;
  const groups=[...d.querySelectorAll(".more-menu .more-group")];
  assert.deepEqual(groups.map(g=>g.getAttribute("aria-label")),["Clan & Planung","Verlosungen & Archiv","App & Sicherheit"]);
  const routes=[...d.querySelectorAll(".more-menu [data-more-action]")].map(x=>x.dataset.moreAction);
  assert.equal(routes.length,11);assert.equal(new Set(routes).size,11);
  assert.equal(d.querySelectorAll(".more-tile-symbol svg").length,11,"no font-dependent missing glyphs");
  assert.equal(d.querySelector("#themeSelect [value=arena]").textContent,"Arena · Gold (Standard)");
  assert.ok(d.getElementById("helpInstallOpen").closest("#view-help"));
 }finally{dom.window.close()}
});
test("Grouped More: compact navigation across widths, roles and local/Cloud mode",{timeout:120000},async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1366,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   try{
    await page.setContent(html,{waitUntil:"domcontentloaded"});
    for(const theme of ["arena","dark","light","cyber","cyberlight"]){
     const m=await page.evaluate(theme=>{
      document.documentElement.dataset.theme=theme;
      document.body.classList.add("cloud-mode","cloud-role-viewer");
      document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
      document.getElementById("view-more").classList.add("active");
      document.querySelectorAll(".navbtn").forEach(b=>b.classList.toggle("active",b.dataset.view==="more"));
      const tiles=[...document.querySelectorAll(".more-menu [data-more-action]")];
      const visible=()=>tiles.filter(x=>getComputedStyle(x).display!=="none").map(x=>({route:x.dataset.moreAction,height:x.getBoundingClientRect().height}));
      const viewer=visible();
      for(const key of ["management","goldpass"])document.querySelector('[data-more-action="'+key+'"]').hidden=false;
      const owner=visible();
      document.body.classList.remove("cloud-mode","cloud-role-viewer");
      const local=visible();
      document.body.classList.add("cloud-mode");return {viewer,owner,local,scroll:document.documentElement.scrollWidth};
     },theme);
     const routes=x=>x.map(y=>y.route);
     assert.ok(m.scroll<=width+3,JSON.stringify({theme,width,m}));
     for(const key of ["appearance","updates","install","profiles"])assert.ok(!routes(m.viewer).includes(key),key);
     for(const key of ["clan","rules","archive","backup","help"])assert.ok(routes(m.viewer).includes(key),key);
     assert.ok(routes(m.owner).includes("management")&&routes(m.owner).includes("goldpass"));
     assert.ok(routes(m.local).includes("updates")&&routes(m.local).includes("install"));
     assert.ok(m.owner.every(x=>x.height>=44));
     if(theme==="arena"||theme==="dark"){
      fs.mkdirSync(path.join(root,"ux-screenshots"),{recursive:true});
      await page.screenshot({path:path.join(root,"ux-screenshots","grouped-more-"+theme+"-"+width+".png")});
     }
     await page.evaluate(()=>{for(const key of ["management","goldpass"])document.querySelector('[data-more-action="'+key+'"]').hidden=true});
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});

test("Roster status and legacy resume are in the member workspace, not duplicated in settings",()=>{
 const {JSDOM}=require("jsdom");
 const dom=new JSDOM(html);
 try{
  const d=dom.window.document;
  for(const id of ["autoRosterStatus","settingsAutoRoster","resumeAutoRosterLabel","cloudMembersSyncBtn"])
   assert.ok(d.getElementById(id)?.closest("#view-members"),id);
  assert.equal(d.getElementById("settingsRosterRefresh"),null);
  assert.ok(d.getElementById("resumeAutoRosterLabel").hidden);
  assert.match(d.getElementById("cloudAutoRosterInfo").textContent,/wenn der Planer geöffnet ist/);
 }finally{dom.window.close()}
});
test("Roster preference preserves prior opt-out and never resumes or schedules for unlinked/viewer contexts",()=>{
 const {JSDOM}=require("jsdom");
 const dom=new JSDOM(html,{url:"https://example.test"});
 try{
  const w=dom.window,d=w.document;
  const start=sync.indexOf("const autoRosterChecks=new Map();"),end=sync.indexOf("async function getRoster(",start);
  assert.ok(start>0&&end>start);
  const scope={clanId:"a",accountEpoch:1,role:"owner",linked:true,active:true};
  const src=sync.slice(start,end);
  const api=new Function("document","localStorage","scope",`let clanId=scope.clanId,accountEpoch=scope.accountEpoch,role=scope.role;
   const $=id=>document.getElementById(id);
   const cloud={get active(){return scope.active},hasApiClan:()=>scope.linked};
   `+src+`return {sync:()=>{clanId=scope.clanId;accountEpoch=scope.accountEpoch;role=scope.role;syncAutoRosterSetting()}};`)(d,w.localStorage,scope);
  const label=d.getElementById("resumeAutoRosterLabel"),status=d.getElementById("autoRosterStatus");
  api.sync();assert.equal(label.hidden,true);
  w.localStorage.setItem("cwl_auto_roster_a","off");scope.accountEpoch++;api.sync();
  assert.equal(label.hidden,false);assert.match(status.textContent,/deaktiviert/);
  status.textContent="old clan status";scope.clanId="b";api.sync();assert.equal(label.hidden,true);assert.doesNotMatch(status.textContent,/old clan/);
  scope.clanId="a";scope.role="viewer";api.sync();assert.equal(label.hidden,true);assert.match(status.textContent,/Clanführung/);
  scope.role="owner";scope.linked=false;api.sync();assert.equal(label.hidden,true);assert.equal(status.textContent,"");
  assert.equal(w.localStorage.getItem("cwl_auto_roster_a"),"off");
  assert.match(src,/!cloud\.hasApiClan\?\.\(\)/);
  assert.match(src,/clanId===expectedClan&&accountEpoch===expectedEpoch&&role===expectedRole/);
 }finally{dom.window.close()}
});
