"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const source=read("cwl-live.mjs");
const start=source.indexOf("  function selectPostseasonTab(");
const end=source.indexOf("  const effective=()=>",start);
assert.ok(start>0&&end>start,"CWL recap tab functions must exist");
const fragment=source.slice(start,end);
const ctx=()=>{
 const dom=new JSDOM('<section id="view-plan"><div id="planOverview"><h3>CWL-Plan</h3></div>'+
  '<div id="planCwlPostseason"></div><div id="currentWarCard"></div></section>',{
  url:"https://smolmig.github.io/cwl_planer/cloud-app.html"
 });
 const state={profile:{cwlLive:{season:"2026-11",clanTag:"#2PYL"}}};
 const model={mode:"postseason",season:"2026-11",verifiedSeven:false,
  savedDays:6,snapshot:{season:"2026-11",clanTag:"#2PYL",rounds:[]}};
 const sandbox={document:dom.window.document,context:()=>({
  active:true,clanId:"tenant-one",profile:state.profile
 }),getLifecycle:()=>model,current:{currentWar:{state:"preparation"}},
  confirmedNoCwl:true,lastKnownGroup:null,
  renderInlineCwlPostseason:()=>'<section class="plan-postseason-results">'+
   '<div role="tablist">'+
   ["rounds","group","players"].map((v,i)=>
    '<button role="tab" data-postseason-tab="'+v+'" aria-selected="'+
    (i===0?"true":"false")+'" tabindex="'+(i===0?"0":"-1")+'">'+v+'</button>').join("")+
   '</div>'+["rounds","group","players"].map((v,i)=>
    '<div class="plan-postseason-panel" id="postseason-panel-'+v+'"'+
    (i===0?"":' hidden')+'>'+v+'</div>').join("")+'</section>',
  esc:v=>String(v).replaceAll("&","&amp;"),Date,console};
 vm.runInNewContext(fragment+
  ';this.renderPostseason=renderPostseason;this.selectPostseasonTab=selectPostseasonTab;',sandbox);
 return {dom,sandbox,model,state};
};
test("CWL recap has three tabs; keeps tab and focus on refresh; battle folds and next preparation opens",()=>{
 const {dom,sandbox,model}=ctx();
 try{
  sandbox.renderPostseason();
  const root=dom.window.document.getElementById("planCwlPostseason");
  const disclose=()=>root.querySelector(".plan-last-cwl");
  assert.equal(disclose().open,true);
  const tabs=()=>[...root.querySelectorAll("[data-postseason-tab]")];
  assert.equal(tabs().length,3);
  tabs()[1].click();
  assert.equal(tabs()[1].getAttribute("aria-selected"),"true");
  assert.equal(root.querySelector("#postseason-panel-group").hidden,false);
  assert.equal(root.querySelector("#postseason-panel-rounds").hidden,true);
  model.savedDays=7; // Relevant new evidence must not reset the chosen tab.
  sandbox.renderPostseason();
  assert.equal(tabs()[1].getAttribute("aria-selected"),"true");
  assert.equal(disclose().open,true);
  tabs()[1].dispatchEvent(new dom.window.KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));
  assert.equal(tabs()[2].getAttribute("aria-selected"),"true");
  sandbox.current.currentWar.state="inWar";
  sandbox.renderPostseason();
  assert.equal(disclose().open,false,"current battle takes visual priority");
  disclose().open=true; // User deliberately reopened previous league.
  model.savedDays=6;sandbox.renderPostseason();
  assert.equal(disclose().open,true,"API update preserves manual expansion");
  sandbox.current.currentWar.state="warEnded";
  sandbox.renderPostseason();
  assert.equal(disclose().open,true,"closing should not override a chosen open recap");
  sandbox.current.currentWar.state="preparation";
  sandbox.renderPostseason();
  assert.equal(disclose().open,true,"next preparation defaults to accessible recap");
  sandbox.context=()=>({active:false,clanId:null,profile:{}});
  sandbox.renderPostseason();
  assert.equal(root.hidden,true);
 }finally{dom.window.close()}
});
test("Current regular war is first only in battle, preparation sits after recap; selected roster tab survives sync",async()=>{
 const dom=new JSDOM('<section id="view-plan" class="plan-postseason-mode">'+
  '<div id="planOverview"></div><div id="planCwlPostseason"></div>'+
  '<div id="currentWarCard" hidden><h3></h3>'+
  '<div class="section-title"><div class="statusline"></div></div>'+
  '<button id="currentWarRefresh"></button><div id="currentWarContent"></div></div></section>',{
  url:"https://smolmig.github.io/cwl_planer/cloud-app.html"
 });
 const old=global.document;global.document=dom.window.document;
 try{
  const {createCurrentWarOverview}=await import(pathToFileURL(path.join(root,"cwl-current-war.mjs")).href);
  const control=createCurrentWarOverview({
   context:()=>({active:true,clanId:"one",hasClanTag:true}),refresh:()=>{}
  });
  const war={state:"preparation",teamSize:2,attacksPerMember:2,
   startTime:"2026-11-11T11:00:00Z",endTime:"2026-11-12T11:00:00Z",
   clan:{name:"United <script>hack()</script>",tag:"#2PYL",stars:0,
    members:[{tag:"#2PYL",name:"Luki",mapPosition:1,townHallLevel:18,attacks:[]}]},
   opponent:{name:"Gegner",tag:"#8PYL",stars:0,
    members:[{tag:"#8PYL",name:"enemy",mapPosition:1,townHallLevel:18,attacks:[]}]}
  };
  control.update({currentWar:war});
  const view=dom.window.document.getElementById("view-plan"),
   card=dom.window.document.getElementById("currentWarCard"),
   recap=dom.window.document.getElementById("planCwlPostseason"),
   overview=dom.window.document.getElementById("planOverview");
  assert.equal(recap.nextElementSibling,card);
  assert.equal(card.nextElementSibling,overview);
  assert.equal(view.classList.contains("plan-cw-battle-mode"),false);
  war.state="inWar";
  war.clan.stars=3;war.opponent.stars=2;
  war.clan.members[0].attacks=[{order:2,defenderTag:"#8PYL",stars:3,
   destructionPercentage:100}];
  control.update({currentWar:war});
  assert.equal(card.nextElementSibling,recap);
  assert.equal(recap.nextElementSibling,overview);
  assert.equal(view.classList.contains("plan-cw-battle-mode"),true);
  assert.equal(dom.window.document.querySelectorAll("#currentWarContent script").length,0);
  assert.match(card.textContent,/Beste Angriffe unseres Clans/);
  assert.match(card.textContent,/Luki/);
  assert.match(card.textContent,/3\s*:\s*2/);
  const teamTab=dom.window.document.querySelector('[data-cw-tab="ours"]');
  teamTab.click();
  assert.equal(teamTab.getAttribute("aria-selected"),"true");
  war.clan.stars=5;control.update({currentWar:war});
  assert.equal(dom.window.document.querySelector('[data-cw-tab="ours"]').getAttribute("aria-selected"),"true");
  assert.equal(card.nextElementSibling,recap);
  war.state="preparation";control.update({currentWar:war});
  assert.equal(recap.nextElementSibling,card);
  control.reset();
  assert.equal(card.hidden,true);
 }finally{global.document=old;dom.window.close()}
});
test("Frontend does not invent official heroic attack or treat live unused attacks as missed",()=>{
 const c=read("cwl-current-war.mjs");
 assert.match(c,/nicht die offizielle Auszeichnung/);
 assert.match(c,/offene Angriffe sind während des Kampftags/);
 assert.match(c,/sort\(\(a,b\)=>[\s\S]*?b\.order-a\.order/);
 assert.doesNotMatch(c,/automaticKick|demotePlayer|setPlanLock/);
 const edge=read("supabase/functions/coc-cwl-status/index.ts");
 assert.match(edge,/mapPosition:/);
 assert.match(edge,/order:Number\.isInteger\(a\?\.order\)/);
 assert.match(edge,/withSupabase\(\{auth:"user"\}/);
});
