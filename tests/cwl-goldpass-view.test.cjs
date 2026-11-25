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
