"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom"),{chromium}=require("playwright");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const app=read("cloud-app.html"),cloud=read("cloud-sync.mjs");
function isolatedNavigator(){
 const dom=new JSDOM('<main>'+
  '<section id="view-settings"><div id="home">'+
  '<section id="settingsRulesSection"><input id="slotsPreset" value="15"></section>'+
  '<section id="settingsAutoRosterBox"><button id="settingsRosterRefresh"></button></section>'+
  '<section id="settingsAppearanceSection"><select id="themeSelect"><option value="arena">Gold</option></select></section>'+
  '<section id="settingsBackupSection"><input type="file" id="importFile"></section>'+
  '<section id="localProfileCard"><button id="newProfileBtn">Neu</button></section>'+
  '</div></section>'+
  '<section id="view-more-settings">'+
  '<h2 id="moreSettingsTitle"></h2><p id="moreSettingsDescription"></p>'+
  '<p id="moreSettingsNotice" hidden></p><button id="moreSettingsCloudBackup" hidden></button>'+
  '<div id="moreSettingsContent"></div></section></main>',{url:"https://example.test"});
 const start=app.indexOf("const moreSettingsMeta="),end=app.indexOf("function showPlannerView(view){",start);
 assert.ok(start>=0&&end>start);
 let route=null;
 const navigator=new Function("document","window","showPlannerView",
  app.slice(start,end)+"\nreturn {openMoreSettings,restoreMoreSettings,getActive:()=>activeMoreSettings,getMoved:()=>movedSettings.length};")
  (dom.window.document,dom.window,v=>{route=v});
 return {dom,...navigator,getRoute:()=>route};
}
test("Mehr navigation uses actual subviews instead of opening and scrolling a large settings modal",()=>{
 assert.match(app,/id="view-more-settings"/);
 assert.match(app,/id="moreSettingsBack"/);
 assert.match(app,/id="moreSettingsContent"/);
 assert.match(app,/if\(moreSettingsMeta\[action\]\)\{openMoreSettings\(action\);return\}/);
 assert.doesNotMatch(app,/const targets=\{rules:"settingsRulesSection"/);
 assert.match(app,/const navView=visible==="cwl-season"\?"plan":/);
 assert.match(app,/\["help","account","archive","more-settings","install"\]\.includes\(visible\)\?"more":visible/);
 assert.match(app,/if\(view!=="more-settings"&&typeof movedSettings!=="undefined"&&movedSettings.length\)restoreMoreSettings\(\)/);
 assert.match(app,/if\(view==="settings"&&window\.__previousPlannerView==="more-settings"\)/);
});
test("moving real controls preserves listeners, selected values, unique IDs and original DOM homes",()=>{
 const {dom,openMoreSettings,restoreMoreSettings,getMoved,getRoute}=isolatedNavigator();
 try{
  const d=dom.window.document,base=d.getElementById("home");
  const rules=d.getElementById("settingsRulesSection"),auto=d.getElementById("settingsAutoRosterBox");
  const appearances=d.getElementById("settingsAppearanceSection");
  const input=d.getElementById("slotsPreset");
  let edits=0;
  input.addEventListener("input",()=>edits++);
  input.value="30";
  openMoreSettings("rules");
  assert.equal(getRoute(),"more-settings");
  assert.equal(getMoved(),2);
  assert.equal(d.getElementById("moreSettingsContent").firstElementChild,rules);
  assert.equal(d.getElementById("settingsAutoRosterBox"),auto);
  assert.equal(input.value,"30");
  input.dispatchEvent(new dom.window.Event("input",{bubbles:true}));
  assert.equal(edits,1);
  openMoreSettings("appearance"); // first restores both rule controls
  assert.equal(getMoved(),1);
  assert.equal(rules.parentElement,base);
  assert.equal(auto.parentElement,base);
  assert.equal(d.getElementById("moreSettingsContent").firstElementChild,appearances);
  assert.equal(d.querySelectorAll("#slotsPreset").length,1,"never duplicate existing controls");
  restoreMoreSettings();
  assert.equal(getMoved(),0);
  assert.equal(appearances.parentElement,base);
  assert.equal(d.getElementById("moreSettingsContent").children.length,0);
  assert.equal([...base.children].map(x=>x.id).join(","),
   "settingsRulesSection,settingsAutoRosterBox,settingsAppearanceSection,settingsBackupSection,localProfileCard");
 }finally{dom.window.close()}
});
test("backup becomes a true page, while Cloud profiles route to existing Clan & Konto",()=>{
 const {dom,openMoreSettings,getRoute,getMoved}=isolatedNavigator();
 try{
  const d=dom.window.document;
  dom.window.CWLCloud={active:true};
  openMoreSettings("profiles");
  assert.equal(getRoute(),"account");
  assert.equal(getMoved(),0);
  openMoreSettings("backup");
  assert.equal(getRoute(),"more-settings");
  assert.equal(d.getElementById("moreSettingsNotice").hidden,false);
  assert.equal(d.getElementById("moreSettingsCloudBackup").hidden,false);
  assert.equal(d.getElementById("moreSettingsContent").firstElementChild.id,"settingsBackupSection");
  dom.window.CWLCloud.active=false;
  openMoreSettings("profiles");
  assert.equal(d.getElementById("moreSettingsContent").firstElementChild.id,"localProfileCard");
  assert.equal(d.getElementById("moreSettingsNotice").hidden,true);
 }finally{dom.window.close()}
});
test("viewer read-only covers moved settings controls while preserving navigation/theme/export",()=>{
 assert.match(cloud,/#view-more-settings button,#view-more-settings input,#view-more-settings select/);
 assert.match(cloud,/"moreSettingsBack","moreSettingsCloudBackup"/);
 assert.match(cloud,/if\(role==="viewer" && !keep\.has\(el\.id\)/);
 assert.match(app,/if\(action==="profiles"&&window\.CWLCloud\?\.active\)\{showPlannerView\("account"\);return\}/);
 assert.match(app,/\.cloud-mode #view-more \.more-tile\[data-more-action="profiles"\]\{display:none\}/);
});
test("mobile real subpages: no page overflow, aligned 44px buttons and visible values",{timeout:120000},async()=>{
 const staticHtml=app.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,375,390,430,820,1366]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    for(const action of ["rules","appearance","backup","profiles"]){
     const metric=await page.evaluate(action=>{
      document.documentElement.dataset.theme="arena";
      document.querySelectorAll(".view.active").forEach(x=>x.classList.remove("active"));
      const detail=document.getElementById("view-more-settings");
      detail.classList.add("active");
      const host=document.getElementById("moreSettingsContent");
      host.replaceChildren();
      const targets={rules:["settingsRulesSection","settingsAutoRosterBox"],
        appearance:["settingsAppearanceSection"],backup:["settingsBackupSection"],
        profiles:["localProfileCard"]};
      for(const id of targets[action])host.append(document.getElementById(id));
      const button=document.getElementById("moreSettingsBack").getBoundingClientRect();
      const main=host.getBoundingClientRect();
      const controls=[...host.querySelectorAll("button")].filter(x=>getComputedStyle(x).display!=="none"&&x.getBoundingClientRect().height>0);
      return{width:innerWidth,scroll:document.documentElement.scrollWidth,
       content:main.width,backHeight:button.height,
       buttonHeights:controls.map(b=>b.getBoundingClientRect().height)};
     },action);
     assert.ok(metric.scroll<=width+3,JSON.stringify({width,action,metric}));
     assert.ok(metric.content>180,JSON.stringify({width,action,metric}));
     assert.ok(metric.backHeight>=43,JSON.stringify({width,action,metric}));
     if(width<=430)assert.ok(metric.buttonHeights.every(h=>h>=39),JSON.stringify({width,action,metric}));
    }
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
