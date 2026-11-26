"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test("Grind UI creates a dated campaign, updates member marks, confirms one server winner and restores it",async()=>{
 const {createActivityCampaignView}=await import("../cwl-activity-campaign-view.mjs");
 const dom=new JSDOM("<main id='root'></main>"),old=global.document,oldMedia=global.matchMedia;
 global.document=dom.window.document;global.matchMedia=()=>({matches:true});
 try{
  const root=document.getElementById("root"),tag="#2PYL";
  const context={owner:true,clanId:"A",clanTag:"#8PYL",session:1};
  let saved=null,discord=null,now="2026-11-25",confirm=false;
  const calls=[];
  const response=()=>({...saved,today:now,rows:[{tag,name:"Spieler A",discord,status:"qualified",checks:saved.rules.map(r=>({metric:r.metric,minimum:r.minimum,value:r.minimum,status:"met"}))}],
   qualified:1,unknown:0,pool:[{tag,name:"Spieler A"}],ready:now>saved.end,witness:"fixture-"+saved.revision});
  const api=async req=>{
   calls.push(req);
   if(req.action==="list")return saved?[saved]:[];
   if(req.action==="create"){saved={id:req.id,title:req.title,start:req.start,end:req.end,rules:req.rules,decisions:req.decisions,revision:1}}
   if(req.action==="save"){assert.equal(req.revision,saved.revision);saved={...saved,decisions:req.decisions,revision:saved.revision+1}}
   if(req.action==="discord"){discord=req.discord;return {ok:true}}
   if(req.action==="draw"){assert.equal(req.witness,"fixture-"+saved.revision);saved={...saved,revision:saved.revision+1,official:{winner:{name:"Spieler A",tag},pool:[{name:"Spieler A",tag}],ticket:0,rows:[],witness:"fixture"}}}
   return response();
  };
  const button=text=>[...root.querySelectorAll("button")].find(b=>b.textContent===text);
  const control=label=>[...root.querySelectorAll("label")].find(e=>e.querySelector("span")?.textContent===label)?.querySelector("input,select");
  const change=(e,value)=>{e.value=value;e.dispatchEvent(new dom.window.Event("change"))};
  const view=createActivityCampaignView({root,getContext:()=>context,api,confirmDraw:async()=>confirm,today:()=>now});
  assert.equal(view.open(),true);await tick();
  button("Neue Verlosung").click();
  assert.ok(control("Start"));button("Ausgewogener Grind").click();assert.match(root.textContent,/maximal .* Sterne/);
  change(control("Start"),"2026-12-01");change(control("Ende (einschließlich)"),"2026-12-31");
  button("Aktiver Clan").click();
  button("Verlosung anlegen").click();await tick();
  assert.equal(saved.start,"2026-12-01");assert.equal(saved.end,"2026-12-31");
  assert.equal(saved.rules.find(r=>r.metric==="cwStars").minimum,21);
  assert.equal(button("Gewinner offiziell ziehen").disabled,true);
  const oldCrypto=global.crypto;if(!oldCrypto)global.crypto=require("node:crypto").webcrypto;
  const beforeTest=calls.length;button("Testziehung starten").click();
  assert.match(root.textContent,/TESTZIEHUNG – UNVERBINDLICH/);
  assert.equal(calls.length,beforeTest);assert.equal(saved.revision,1);
  change(control("Discord (dauerhaft)"),"yes");await tick();
  assert.equal(control("Discord (dauerhaft)").value,"yes");
  change(control("Abgestimmt (diese Verlosung)"),"yes");button("Änderungen speichern").click();await tick();
  assert.equal(saved.decisions[tag].voted,true);
  now="2027-01-01";button("Fortschritt neu laden").click();await tick();
  assert.equal(button("Gewinner offiziell ziehen").disabled,false);
  button("Gewinner offiziell ziehen").click();await tick();assert.equal(calls.filter(x=>x.action==="draw").length,0);
  confirm=true;button("Gewinner offiziell ziehen").click();await tick();
  assert.equal(calls.filter(x=>x.action==="draw").length,1);
  assert.match(root.textContent,/OFFIZIELLES ERGEBNIS/);
  assert.equal(button("Gewinner offiziell ziehen"),undefined);
  assert.match(root.querySelector("[data-raffle-winner]").textContent,/Spieler A/);
  assert.equal(view.accessChanged({...context,session:2}),false);assert.equal(root.textContent,"");
 }finally{if(old===undefined)delete global.document;else global.document=old;if(oldMedia===undefined)delete global.matchMedia;else global.matchMedia=oldMedia;dom.window.close()}
});

test("Grind sandbox works without a saved campaign and never calls a write or tracking API",async()=>{
 const {createActivityCampaignView}=await import("../cwl-activity-campaign-view.mjs");
 const dom=new JSDOM("<main id='root'></main>"),old=global.document,oldMedia=global.matchMedia;
 global.document=dom.window.document;global.matchMedia=()=>({matches:true});
 try{
  const root=document.getElementById("root"),calls=[];
  const c={owner:true,clanId:"A",clanTag:"#8PYL",session:1};
  const view=createActivityCampaignView({root,getContext:()=>c,api:async req=>{calls.push(req.action);return []},today:()=>"2026-11-26"});
  const button=text=>[...root.querySelectorAll("button")].find(b=>b.textContent===text);
  view.open();await tick();assert.deepEqual(calls,["list"]);assert.equal(root.querySelector("select"),null);
  button("Testen").click();assert.match(root.textContent,/nur Beispieldaten/);assert.equal(button("Verlosung anlegen"),undefined);assert.equal(button("Gewinner offiziell ziehen"),undefined);
  button("Ausgewogener Grind").click();assert.match(root.textContent,/Beispiel-Fortschritt/);assert.equal(button("Testziehung starten").disabled,false);
  button("Testziehung starten").click();assert.match(root.textContent,/TESTZIEHUNG – UNVERBINDLICH/);
  view.open();await tick();assert.deepEqual(calls,["list"]);
  button("Test beenden").click();await tick();assert.deepEqual(calls,["list","list"]);assert.doesNotMatch(root.textContent,/Beispiel-Fortschritt/);
 }finally{if(old===undefined)delete global.document;else global.document=old;if(oldMedia===undefined)delete global.matchMedia;else global.matchMedia=oldMedia;dom.window.close()}
});
