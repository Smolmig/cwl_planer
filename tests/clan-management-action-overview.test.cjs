"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {JSDOM}=require("jsdom");
const core=require("../clan-management-core.js");
const root=path.resolve(__dirname,"..");
const person=(tag,name,rank,states=[])=>({tag,name,rank,
 rankLabel:rank==="elder"?"Ältester":"Mitglied",
 reviewCases:states.map(state=>({state}))});
const preview=()=>({ok:true,total:6,rows:[
 person("#2PYL","Anna","member",["open","open"]),
 person("#2PYQ","Bert","elder"),
 person("#2PYR","Chris","member",["acknowledged","exception"]),
 person("#2PYJ","Vize","coLeader",["open"]),
 person("#2PYC","Unklar","unknown",["open"]),
 person("#2PYG","Dora","member",["open"])
]});
const input=()=>({preview:preview(),reviewReadable:true,
 cwlRows:[{tag:"#2PYL",missedCount:1,severe:false},
  {tag:"#2PYQ",missedCount:2,severe:true},{tag:"#2PYJ",missedCount:2,severe:true},
  {tag:"#2PYV",missedCount:3,severe:true}],
 normalResult:{rows:[{tag:"#2PYL",openCount:2,severe:false,events:[{state:"open",missing:2},{state:"open",missing:1},{state:"excused",missing:2}]},
  {tag:"#2PYQ",openCount:1,severe:true,events:[{state:"open",missing:2}]},{tag:"#2PYR",openCount:0,severe:false}]}});
test("existing open review sources merge once per current player; severe and overlapping evidence first",()=>{
 const x=input(),before=JSON.stringify(x),v=core.buildActionOverview(x);
 assert.deepEqual(v.rows.map(p=>p.tag),["#2PYQ","#2PYL","#2PYG"]);
 assert.deepEqual(v.rows[0].sources,["cw","cwl"]);
 assert.equal(v.rows[0].severe,true);
 assert.deepEqual(v.rows[1].sources,["rank","cw","cwl"]);
 assert.equal(v.rows[1].conflicting,true);
 assert.equal(v.rows[1].openMisses,4);
 assert.equal(v.rows[0].openMisses,4);
 assert.equal(v.rows[1].missCountComplete,true);
 assert.deepEqual(v.counts,{rank:2,cw:2,cwl:2});
 assert.equal(v.complete,true);
 assert.equal(JSON.stringify(x),before);
});
test("unavailable source differs from zero; closed and excused cases do not reappear",()=>{
 const x=input();x.reviewReadable=false;x.cwlRows=null;x.normalResult={rows:[{tag:"#2PYR",openCount:0}]};
 const v=core.buildActionOverview(x);
 assert.deepEqual(v.rows,[]);
 assert.deepEqual(v.counts,{rank:null,cw:0,cwl:null});
 assert.equal(v.complete,false);
 assert.equal(core.buildActionOverview({preview:{ok:false,rows:[]}}),null);
});
test("DOM overview renders safe names and jumps to the player's existing normal-CW evidence",()=>{
 const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const start=app.indexOf("function clearClanManagementActionOverview(){");
 const end=app.indexOf("function renderClanManagementReviewSummary(){",start);
 assert.ok(start>=0&&end>start);
 const dom=new JSDOM('<details id="clanManagementActionOverview" hidden open><summary id="clanManagementActionHeading"></summary>'+
  '<p id="clanManagementActionCoverage"></p><div id="clanManagementActionList"></div></details>'+
  '<details id="clanManagementNormalPanel"><summary>CW</summary><div id="clanManagementNormalList">'+
  '<div data-player-tag="#2PYL"><details><summary>Belege</summary></details></div></div></details>');
 try{
  const x=input();x.preview.rows[0].name="<img src=x onerror=alert(1)>";
  const api=new Function("document","window","clanManagementLastPreview","clanManagementReviewsReadable",
   "clanManagementCwlRows","clanManagementNormalResult",app.slice(start,end)+
   ";return {renderClanManagementActionOverview,clearClanManagementActionOverview};")(
    dom.window.document,{CWLClanManagement:core},x.preview,true,x.cwlRows,x.normalResult);
  api.renderClanManagementActionOverview();
  const d=dom.window.document,host=d.getElementById("clanManagementActionOverview");
  assert.equal(host.hidden,false);
  assert.match(d.getElementById("clanManagementActionHeading").textContent,/3 Spieler/);
  assert.equal(host.querySelector("img"),null);
  const button=[...host.querySelectorAll("button")].find(b=>b.getAttribute("aria-label")==="Normale CW für <img src=x onerror=alert(1)> ansehen");
  assert.ok(button);button.click();
  assert.equal(d.getElementById("clanManagementNormalPanel").open,true);
  assert.equal(d.querySelector('#clanManagementNormalList details').open,true);
  api.clearClanManagementActionOverview();
  assert.equal(host.hidden,true);
  assert.equal(host.querySelectorAll("button").length,0);
 }finally{dom.window.close()}
});
test("normal CW decision re-render preserves the overview callback and clan resets clear overview",()=>{
 const source=fs.readFileSync(path.join(root,"clan-management-cw-view.js"),"utf8");
 const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 assert.match(source,/onResult\(result\)/);
 assert.match(source,/render\(members,payload,sourceTag,onResult\)/);
 assert.match(app,/clanManagementCwlRows=null;clanManagementNormalResult=null;\s*clearClanManagementActionOverview\(\)/);
 assert.match(app,/request!==clanManagementRequest\|\|clan!==cloud.getActiveClanId\(\)/);
});

test("cross-war totals count attacks rather than wars, exclude decisions, and retain lower bounds",()=>{
 const x=input();x.cwlRows=null;
 const row=core.buildActionOverview(x).rows.find(p=>p.tag==="#2PYL");
 assert.equal(row.openMisses,3);
 assert.equal(row.openCwlMisses,null);
 assert.equal(row.missCountComplete,false);
 x.cwlRows=input().cwlRows;x.normalResult.rows[0].events=[];
 const unknown=core.buildActionOverview(x).rows.find(p=>p.tag==="#2PYL");
 assert.equal(unknown.openMisses,1);
 assert.equal(unknown.openCwMisses,null);
 assert.equal(unknown.missCountComplete,false);
});

test("qualification progress counts unknown separately and does not change recommendation eligibility",()=>{
 const rules=core.normalizeRules({});
 const person={rank:"member",tag:"#2PYL"};
 const now=Date.parse("2026-11-25T20:00:00Z");
 const entry={is_present:true,confirmed_seconds:13*86400,last_observed_at:new Date(now).toISOString()};
 const check=core.evaluatePromotion(person,entry,{attack_count:10,three_star_count:8},rules,now);
 assert.equal(check.eligible,undefined);
 const eligible=core.evaluatePromotion(person,{...entry,confirmed_seconds:14*86400},{attack_count:10,three_star_count:8},rules,now);
 assert.equal(eligible.eligible,true);
 const progress=core.buildPerformanceProgress([
  {...person,performanceQualification:check.qualification},
  {...person,performanceQualification:eligible.qualification},
  {...person,performanceQualification:null},
  {...person,returnRankNote:"Rückkehr"},
  {rank:"elder"}
 ],rules);
 assert.deepEqual(progress,{candidates:3,known:2,unknown:1,timeOK:1,attackCountOK:2,attackAndQuoteOK:2,allOK:1,maxSeconds:14*86400,minDays:14,minAttacks:10,minQuote:80,lookback:14});
 assert.equal(core.buildPerformanceProgress([], {...rules,performance_enabled:false}),null);
 const invalid=core.evaluatePromotion(person,entry,{attack_count:2,three_star_count:3},rules,now);
 assert.equal(invalid.qualification,undefined);
});

test("polished qualification summary exposes counts, unknowns and individual blockers without changing rules",()=>{
 const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const start=app.indexOf("function managementRowSummary("),end=app.indexOf("function renderClanManagementRows(",start);
 assert.ok(start>=0&&end>start);
 const dom=new JSDOM("<main></main>");
 try{
  const {renderClanManagementProgress,managementRowSummary}=new Function("document",app.slice(start,end)+";return {renderClanManagementProgress,managementRowSummary};")(dom.window.document);
  const progress={candidates:4,known:3,unknown:1,timeOK:2,attackCountOK:1,attackAndQuoteOK:1,allOK:0,maxSeconds:13.6*86400,minDays:14,minAttacks:10,minQuote:80,lookback:14};
  const card=renderClanManagementProgress(progress);
  assert.deepEqual([...card.querySelectorAll("dd")].map(x=>x.textContent),["2 / 3","1 / 3","1 / 3","0 / 3"]);
  assert.match(card.textContent,/3 von 4 Mitgliedern auswertbar/);
  assert.match(card.textContent,/Bei 1 Mitgliedern fehlen/);
  assert.match(card.textContent,/13,6 Tage/);
  const unknown=renderClanManagementProgress({...progress,known:0,unknown:4,maxSeconds:null});
  assert.deepEqual([...unknown.querySelectorAll("dd")].map(x=>x.textContent),["–","–","–","–"]);
  const person={rank:"member",promotionStatus:"Nachweise offen",performanceQualification:{timeOK:false,countOK:false,quoteOK:false}};
  assert.deepEqual(managementRowSummary(person,[]),["Kriterien noch nicht erreicht","Clanzeit · Angriffsstichprobe"]);
  assert.deepEqual(managementRowSummary({...person,performanceQualification:null},[]),["Nachweise offen","Aktuelle Clanzeit oder Angriffsdaten nicht bestätigt"]);
 }finally{dom.window.close()}
});
