"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const {decorateDeploymentRow,filterDeploymentRows}=require("../cwl-deployment-filters.js");
const make=(name,opts={})=>{
 const m={id:name,name,playerTag:"#"+name.toUpperCase(),participating:true,
  fixed:false,targetDays:4,...opts.m};
 const played=opts.played??0,open=opts.open??Math.max(0,4-played),count=opts.count??4;
 const progress=opts.missingProgress?null:{
  executed:played,open,unknown:opts.unknown??0,missed:opts.missed??0,
  hitRate:played?Math.round((opts.threes??0)/played*100):null,
  averageStars:played?(opts.stars??0)/played:null
 };
 const row={m,count,played,open,unknown:opts.unknown??0,missed:opts.missed??0,progress};
 const medal=opts.medal===undefined?
  {status:"possible",stars:opts.stars??0,remainingStars:8-(opts.stars??0),unknown:false}:opts.medal;
 return decorateDeploymentRow(row,{cloud:true,medal,medalFresh:opts.fresh??true});
};
const ids=rows=>rows.map(r=>r.m.id);
test("rotation vs fixed are player attributes, not Clash lineup locks",()=>{
 const rotation=make("rotation",{played:3}),fix=make("fixed",{m:{fixed:true,targetDays:null}});
 const absent=make("absent",{m:{participating:false}}),former=make("former",{m:{cocSyncState:"former"}});
 assert.deepEqual(ids(filterDeploymentRows([rotation,fix,absent,former],{group:"rotation"})),["rotation"]);
 assert.deepEqual(ids(filterDeploymentRows([rotation,fix,absent,former],{group:"fixed"})),["fixed"]);
 assert.equal(fix.targetStatus,"automatic");
});
test("only actually executed attacks satisfy exact goals 2/3/4; planned is not executed",()=>{
 for(const target of [2,3,4]){
  const notDone=make("missing-"+target,{m:{targetDays:target},played:target-1,
   count:target,open:1});
  const done=make("done-"+target,{m:{targetDays:target},played:target,
   count:target,open:0});
  assert.equal(notDone.targetStatus,"open");
  assert.equal(done.targetStatus,"reached");
  assert.equal(notDone.restTarget,1);
  assert.equal(done.restTarget,0);
  assert.deepEqual(ids(filterDeploymentRows([notDone,done],{progress:"target-met"})),["done-"+target]);
 }
});
test("automatic target never invents a hard 4, fixed player has no exact rotation target",()=>{
 const automatic=make("auto",{m:{targetDays:null},played:4,open:0});
 assert.equal(automatic.exact,null);
 assert.equal(automatic.targetStatus,"automatic");
 assert.deepEqual(ids(filterDeploymentRows([automatic],{progress:"automatic"})),["auto"]);
 assert.deepEqual(ids(filterDeploymentRows([automatic],{progress:"target-met"})),[]);
 assert.equal(automatic.allPlannedDone,true);
});
test("all planned done needs every recorded attack and no unresolved or missed opportunity",()=>{
 const yes=make("yes",{played:4,open:0});
 const notYet=make("notYet",{played:3,open:1});
 const unknown=make("unknown",{played:3,count:4,open:0,unknown:1});
 const missed=make("missed",{played:3,count:4,open:0,missed:1});
 assert.deepEqual(ids(filterDeploymentRows([yes,notYet,unknown,missed],{progress:"planned-done"})),["yes"]);
});
test("8 stars after 3 attacks reaches medal goal, without reaching four-attack target",()=>{
 const r=make("medalDone",{played:3,open:1,stars:8,
  medal:{status:"reached",stars:8,remainingStars:0,unknown:false}});
 assert.equal(r.medalStatus,"reached");
 assert.equal(r.targetStatus,"open");
 assert.deepEqual(ids(filterDeploymentRows([r],{progress:"target-open",medal:"reached"})),["medalDone"]);
});
test("4 executed attacks with only 6 stars means target achieved but medal open",()=>{
 const r=make("six",{played:4,open:0,stars:6});
 assert.equal(r.targetStatus,"reached");
 assert.equal(r.medalStatus,"open");
 assert.deepEqual(ids(filterDeploymentRows([r],{progress:"target-met",medal:"open"})),["six"]);
});
test("unknown or stale 8-star evidence cannot silently become 'open' or zero stars",()=>{
 const uncertain=make("uncertain",{medal:{status:"uncertain",stars:4,remainingStars:4,unknown:true}});
 const stale=make("stale",{fresh:false,medal:{status:"possible",stars:6,remainingStars:2,unknown:false}});
 const missing=make("missing",{medal:null});
 const reached=make("reached",{fresh:false,medal:{status:"reached",stars:8,remainingStars:0}});
 assert.deepEqual(ids(filterDeploymentRows([uncertain,stale,missing,reached],{medal:"unknown"})),
  ["missing","stale","uncertain"]);
 assert.deepEqual(ids(filterDeploymentRows([uncertain,stale,missing,reached],{medal:"open"})),[]);
 assert.deepEqual(ids(filterDeploymentRows([uncertain,stale,missing,reached],{medal:"reached"})),["reached"]);
});
test("combined rotation + 8-star open + one planned attack + exact goal open",()=>{
 const rows=[
  make("alpha",{played:3,open:1,stars:6}),
  make("bravo",{played:3,open:1,stars:8,medal:{status:"reached",stars:8,remainingStars:0}}),
  make("charlie",{played:4,open:0,stars:6}),
  make("delta",{m:{fixed:true},played:3,open:1,stars:3}),
  make("echo",{played:3,open:1,medal:{status:"uncertain",stars:6,unknown:true}})
 ];
 assert.deepEqual(ids(filterDeploymentRows(rows,{
  legacy:"future",group:"rotation",progress:"target-open",medal:"open"})),["alpha"]);
});
test("sorting uses unknown last, stable name ties and actual CWL attack samples",()=>{
 const rows=[
  make("Z",{played:4,open:0,stars:8}),
  make("B",{played:1,open:3,stars:3,threes:1}),
  make("A",{played:1,open:3,stars:1,threes:0}),
  make("U",{missingProgress:true,played:0,open:4,medal:null})
 ];
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"rest-asc"})),["Z","A","B","U"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"hit-desc"})),["B","A","Z","U"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"name"})),["A","B","U","Z"]);
});
test("selectors are read-only and legacy search/filter remain usable",()=>{
 const rows=[make("Alice",{played:4,open:0}),make("Bob",{played:0,open:4})];
 const before=JSON.stringify(rows);
 assert.deepEqual(ids(filterDeploymentRows(rows,{query:"ALI",legacy:"played"})),["Alice"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{legacy:"zero"})),[]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{legacy:"future"})),["Bob"]);
 assert.equal(JSON.stringify(rows),before);
});
test("Cloud UI includes readable filters, Help and current season checks without touching Offline PWA",()=>{
 const root=path.resolve(__dirname,"..");
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const cloud=new JSDOM(html);
 const doc=cloud.window.document;
 for(const key of ["summarySearch","summaryFilter","summaryGroup","summaryProgress",
  "summaryMedal","summarySort","summaryResetFilters","summaryVisibleCount"]){
  assert.ok(doc.getElementById(key),key+" missing");
 }
 for(const [id,val] of [["summaryGroup","rotation"],["summaryProgress","target-open"],
  ["summaryMedal","unknown"],["summarySort","stars-asc"]]){
  assert.ok(doc.querySelector("#"+id+" option[value='"+val+"']"));
 }
 assert.match(html,/getObservedCwlAttackResults/);
 assert.match(html,/summaryAdvanced\[key\]=e\.target\.value;renderSummary/);
 assert.match(html,/summaryCloudFilters/);
 assert.match(html,/summaryResetFilters/);
 assert.match(html,/Einsatzziel: Automatisch/);
 assert.match(html,/cwl-deployment-filters\.js\?v=1\.16\.50/);
 assert.match(html,/Verpasster CWL-Angriff/);
 const offline=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.match(offline,/const APP_VERSION="v1\.0\.2"/);
 cloud.window.close();
});
