"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {JSDOM}=require("jsdom");
const own="#2PYL",player="#G9QL",enemy="#8PYL";
function snapshot(season,tag=own){
 return {season,clanTag:tag,warCount:5,rounds:[{day:1,available:true,state:"warEnded",warTag:"#2PY0",teamSize:1,
 clan:{tag,members:[{tag:player,name:"<img src=x onerror=alert(1)>",attacks:[{attackerTag:player,defenderTag:enemy,stars:3,destructionPercentage:100}]}]},
 opponent:{tag:"#Q9QL",members:[{tag:enemy}]}}]};
}
test("Preview selects own-clan evidence without summing archive and live snapshots",async()=>{
 const {raffleSeasons}=await import("../cwl-goldpass-view.mjs");
 const s=snapshot("2026-11");
 const p={cwlLive:s,archives:[{sourceSeason:"2026-11",cwlLive:s,createdAt:5,days:5},
  {sourceSeason:"2026-10",cwlLive:snapshot("2026-10"),createdAt:4,days:5},
  {sourceSeason:"2026-09",cwlLive:snapshot("2026-09","#P9QL"),createdAt:3,days:5}]};
 const rows=raffleSeasons(p,own);
 assert.deepEqual(rows.map(x=>x.season),["2026-11","2026-10"]);
 assert.equal(rows[0].players[0].attacks,1);
});
test("Owner preview recalculates without mutating profile and clears on loss of access",async()=>{
 const {createGoldpassPreview}=await import("../cwl-goldpass-view.mjs");
 const dom=new JSDOM("<main id='root'></main>"),before=global.document;
 global.document=dom.window.document;
 try{
  const profile={cwlLive:snapshot("2026-11"),archives:[]},original=JSON.stringify(profile);
  let context={owner:true,clanId:"A",clanTag:own};
  const root=document.getElementById("root"),view=createGoldpassPreview({root,getProfile:()=>profile,getContext:()=>context});
  assert.equal(view.open(),true);
  assert.match(root.textContent,/Keine offizielle Ziehung möglich/);
  assert.match(root.textContent,/3 Lose insgesamt/);
  assert.equal(root.querySelector("img"),null);
  const numberInputs=root.querySelectorAll('input[type="number"]');
  numberInputs[1].value="4";numberInputs[1].dispatchEvent(new dom.window.Event("input"));
  assert.match(root.textContent,/6 Lose insgesamt/);
  const organizer=[...root.querySelectorAll("label")].find(x=>x.textContent==="Veranstalter").querySelector("input");
  organizer.checked=true;organizer.dispatchEvent(new dom.window.Event("change"));
  assert.match(root.textContent,/Veranstalter ausgeschlossen/);
  assert.match(root.textContent,/0 Lose insgesamt/);
  assert.equal(JSON.stringify(profile),original);
  context={owner:false,clanId:"A",clanTag:own};
  assert.equal(view.open(),false);assert.equal(root.textContent,"");
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});

test("Saved server preview gates official draw; confirmation, reload and immutable result",async()=>{
 const {createGoldpassPreview}=await import("../cwl-goldpass-view.mjs");
 const {DEFAULT_RAFFLE_RULES,rafflePreview}=await import("../cwl-goldpass-core.mjs");
 const dom=new JSDOM("<main id='root'></main>"),before=global.document;
 global.document=dom.window.document;
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 try{
  const profile={cwlLive:snapshot("2026-11"),archives:[]},original=JSON.stringify(profile);
  const context={owner:true,clanId:"A",clanTag:own,session:1};
  const e={complete:true,warCount:5,ended:5,players:[{tag:player,name:"Spieler",appearances:5,attacks:5,stars:15,one:0,two:0,three:5,missed:0}]};
  let saved={revision:0,rules:{...DEFAULT_RAFFLE_RULES},eligibility:{},organizerConfirmed:false};
  const calls=[];let confirmed=false;
  const response=()=>({...saved,evidence:e,preview:rafflePreview(e,saved.rules,saved.eligibility),witness:"witness-"+saved.revision});
  const api=async request=>{
   calls.push(request);
   if(request.action==="save"){
    assert.equal(request.expectedRevision,saved.revision);
    saved={revision:saved.revision+1,rules:request.rules,eligibility:request.eligibility,organizerConfirmed:request.organizerConfirmed};
   }
   if(request.action==="draw"){
    assert.equal(request.expectedWitness,"witness-"+saved.revision);
    const official={version:1,winnerName:"Spieler",winnerTag:player,drawnAt:"2026-11-25T20:00:00Z",
     rules:saved.rules,evidence:e,preview:response().preview,witness:request.expectedWitness,ticket:0};
    saved={...saved,revision:saved.revision+1,official};
   }
   return response();
  };
  const root=document.getElementById("root"),view=createGoldpassPreview({root,getProfile:()=>profile,getContext:()=>context,
   api,listSeasons:async()=>["2026-11","2026-10"],confirmDraw:async()=>confirmed});
  const button=text=>[...root.querySelectorAll("button")].find(b=>b.textContent===text);
  assert.equal(view.open(),true);await tick();
  assert.equal(root.querySelector("select").options.length,2);
  assert.equal(button("Offiziell ziehen").disabled,true);
  const organizer=[...root.querySelectorAll("label")].find(x=>x.textContent.startsWith("Veranstalter geprüft")).querySelector("input");
  organizer.checked=true;organizer.dispatchEvent(new dom.window.Event("change"));
  assert.equal(button("Offiziell ziehen").disabled,true);
  button("Regeln speichern").click();await tick();
  assert.equal(button("Offiziell ziehen").disabled,false);
  button("Offiziell ziehen").click();await tick();
  assert.equal(calls.filter(x=>x.action==="draw").length,0);
  confirmed=true;button("Offiziell ziehen").click();await tick();
  assert.equal(calls.filter(x=>x.action==="draw").length,1);
  assert.match(root.textContent,/OFFIZIELLES ERGEBNIS/);
  assert.equal(button("Regeln speichern"),undefined);assert.equal(button("Offiziell ziehen"),undefined);
  assert.equal(JSON.stringify(profile),original);
  view.open();await tick();assert.match(root.textContent,/OFFIZIELLES ERGEBNIS/);
  assert.equal(calls.filter(x=>x.action==="draw").length,1);
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
test("A pending server response cannot repopulate the Goldpass view after account change",async()=>{
 const {createGoldpassPreview}=await import("../cwl-goldpass-view.mjs");
 const dom=new JSDOM("<main id='root'></main>"),before=global.document;global.document=dom.window.document;
 try{
  let context={owner:true,clanId:"A",clanTag:own,session:1},resolveRequest;
  const root=document.getElementById("root"),view=createGoldpassPreview({root,getProfile:()=>({cwlLive:snapshot("2026-11"),archives:[]}),
    getContext:()=>context,api:()=>new Promise(resolve=>{resolveRequest=resolve})});
  view.open();assert.ok(resolveRequest);
  context={...context,session:2};assert.equal(view.accessChanged(context),false);
  resolveRequest({revision:2,rules:{},eligibility:{},official:{winnerName:"Old private result"}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(root.textContent,"");
 }finally{if(before===undefined)delete global.document;else global.document=before;dom.window.close()}
});
