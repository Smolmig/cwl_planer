"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const load=(file)=>import(pathToFileURL(path.join(root,file)).href);
test("Rolling stats use last 50 normal CWs and three latest CWL seasons",async()=>{
 const {selectStatWars,computeWarStats}=await load("cwl-stats-core.mjs");
 const normal=Array.from({length:53},(_,i)=>({
   war_key:"cw:"+i,war_type:"normal",source:"import",started_at:
   new Date(Date.UTC(2026,0,i+1)).toISOString(),team_size:15
 }));
 const league=Array.from({length:4},(_,month)=>Array.from({length:7},(_,day)=>({
   war_key:"cwl:"+month+":"+day,war_type:"cwl",source:"import",
   started_at:new Date(Date.UTC(2026,6+month,day+4)).toISOString(),team_size:15
 }))).flat();
 const pending={war_key:"cw:pending",war_type:"normal",source:"api",finalized:false,
   started_at:"2026-11-01T00:00:00Z",team_size:15};
 const all=[...normal,...league,pending];
 const combined=selectStatWars(all,{type:"all",last:50,cwlSeasons:3});
 assert.equal(combined.length,71);
 assert.equal(combined.filter(w=>w.war_type==="normal").length,50);
 assert.equal(combined.filter(w=>w.war_type==="cwl").length,21);
 assert.equal(combined.some(w=>w.war_key===pending.war_key),false);
 assert.equal(combined.some(w=>w.war_key==="cw:0"),false);
 assert.equal(combined.some(w=>w.war_key==="cwl:0:0"),false);
 assert.equal(selectStatWars(all,{type:"normal",last:50}).length,50);
 assert.equal(selectStatWars(all,{type:"normal",last:10}).length,10);
 assert.equal(selectStatWars(all,{type:"cwl",cwlSeasons:3}).length,21);
 const total=computeWarStats(all,[],{type:"all",last:50,cwlSeasons:3});
 assert.equal(total.wars,71);
 assert.equal(total.totalCwlSeasons,4);
});
test("Current CW appears only in Plan and never writes to CWL plan or stats early",async()=>{
 const dom=new JSDOM('<section id="currentWarCard" hidden><div id="currentWarContent"></div>'+
   '<button id="currentWarRefresh"></button></section>',{url:"https://example.test"});
 const old=global.document;
 global.document=dom.window.document;
 let refreshes=0,active=true;
 try{
  const {createCurrentWarOverview}=await load("cwl-current-war.mjs");
  const widget=createCurrentWarOverview({
   context:()=>({active,clanId:"demo",hasClanTag:true}),
   refresh:()=>refreshes++
  });
  const data={currentWar:{state:"inWar",teamSize:15,attacksPerMember:2,
    startTime:"20261030T100000.000Z",endTime:"20261031T200000.000Z",
    clan:{name:"United Fighters",stars:35,members:[
      {name:"Spieler <script>alert(1)</script>",townHallLevel:18,
       attacks:[{stars:3,defenderTag:"#8PY"}]}]},
    opponent:{name:"Gegner",stars:27,members:[{name:"Basis",tag:"#8PY"}]}}};
  widget.update(data);
  const host=dom.window.document.getElementById("currentWarCard");
  assert.equal(host.hidden,false);
  assert.match(host.textContent,/35\s*:\s*27/);
  assert.match(host.textContent,/Unsere Angriffe1 Angriffe erfasst/);
  assert.match(host.textContent,/Gegnerische Angriffe0 Angriffe erfasst/);
  assert.match(host.textContent,/Gegner/);
  assert.equal(host.querySelector("script"),null,"Player names are HTML escaped");
  dom.window.document.getElementById("currentWarRefresh").click();
  assert.equal(refreshes,1);
  widget.update({ok:true,active:false,currentWar:null});
  assert.equal(host.hidden,true);
  widget.update(data);active=false;widget.update(data);
  assert.equal(host.hidden,true,"Cloud logout hides live war details");
 }finally{
  global.document=old;
  dom.window.close();
 }
});
test("Normal CW combines two attacks per player, in first/second order as Clash reports them",async()=>{
 const dom=new JSDOM('<section id="currentWarCard" hidden><div id="currentWarContent"></div>'+
  '<button id="currentWarRefresh"></button></section>',{url:"https://example.test"});
 const original=global.document;
 global.document=dom.window.document;
 try{
  const {createCurrentWarOverview}=await load("cwl-current-war.mjs");
  const overview=createCurrentWarOverview({
   context:()=>({active:true,clanId:"test",hasClanTag:true}),refresh:()=>{}
  });
  const first={defenderTag:"#B",stars:2,destructionPercentage:81,order:3};
  const second={defenderTag:"#C",stars:3,destructionPercentage:100,order:11};
  const war={
   state:"inWar",teamSize:2,attacksPerMember:2,startTime:"20261111T100000.000Z",
   clan:{tag:"#A",name:"United Fighters",members:[
    {tag:"#P",name:"Spieler",townHallLevel:18,attacks:[first]},
    {tag:"#Q",name:"Noch offen",townHallLevel:17,attacks:[]}
   ]},
   opponent:{tag:"#X",name:"Gegner",members:[
    {tag:"#B",name:"Basis B",townHallLevel:18,attacks:[]},
    {tag:"#C",name:"Basis C",townHallLevel:17,attacks:[]}
   ]}
  };
  const card=dom.window.document.getElementById("currentWarContent");
  overview.update({currentWar:war});
  let player=card.querySelector('.cw-now-details[data-team="own"] .cw-now-player');
  assert.match(player.textContent,/1\/2 Angriffe/);
  assert.equal(player.querySelectorAll(".cw-now-attack").length,1);
  assert.match(player.textContent,/1\. Angriff.*Basis B/);
  assert.doesNotMatch(player.textContent,/2\. Angriff/);
  // API arrays need not arrive in chronological order; keep the earlier hit first.
  war.clan.members[0].attacks=[second,first];
  overview.update({currentWar:war});
  player=card.querySelector('.cw-now-details[data-team="own"] .cw-now-player');
  const attacks=[...player.querySelectorAll(".cw-now-attack")].map(x=>x.textContent);
  assert.match(player.textContent,/2\/2 Angriffe/);
  assert.equal(attacks.length,2);
  assert.match(attacks[0],/^1\. Angriff.*Basis B/);
  assert.match(attacks[1],/^2\. Angriff.*Basis C/);
  assert.doesNotMatch(card.textContent,/verpasster Angriff/i);
  // Unknown order must not force a guessed chronology.
  war.clan.members[0].attacks=[{...second,order:null},first];
  overview.update({currentWar:war});
  player=card.querySelector('.cw-now-details[data-team="own"] .cw-now-player');
  assert.match(player.querySelector(".cw-now-attack").textContent,/^1\. Angriff.*Basis C/);
 }finally{
  global.document=original;
  dom.window.close();
 }
});
test("Safari member refresh uses valid scrollIntoView and has retry error feedback",()=>{
 const cloud=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.doesNotMatch(cloud,/scrollIntoView\(\{behavior:"nearest"/);
 assert.match(cloud,/scrollIntoView\(\{behavior:"auto",block:"nearest"\}\)/);
 assert.match(cloud,/async function safeRosterRefresh/);
 assert.match(cloud,/bind\("cloudMembersSyncBtn","click",safeRosterRefresh\)/);
 assert.match(cloud,/currentWarOverview\?\.reset\(\)/);
 assert.match(html,/id="currentWarCard"/);
 assert.match(html,/id="currentWarContent"/);
 assert.match(html,/id="currentWarRefresh"/);
 assert.match(html,/durchschnittlich erreichte Sterne pro Angriff/);
 assert.doesNotMatch(html,/Angriffe und Ergebnisse werden derzeit noch nicht automatisch übernommen/);
});
