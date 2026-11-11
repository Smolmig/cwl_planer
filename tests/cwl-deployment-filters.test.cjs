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
  identifiable:opts.identifiable??true,
  hitRate:played?Math.round((opts.threes??0)/played*100):null,
  averageStars:played?(opts.stars??0)/played:null
 };
 const row={m,count,played,open,unknown:opts.unknown??0,missed:opts.missed??0,progress};
 const medal=opts.medal===undefined?
  {status:"possible",stars:opts.stars??0,remainingStars:8-(opts.stars??0),unknown:false}:opts.medal;
 return decorateDeploymentRow(row,{cloud:true,medal,medalFresh:opts.fresh??true});
};
const ids=rows=>rows.map(r=>r.m.id);

test("Alle Spieler and Rotierende Spieler: only participating non-fixed members rotate",()=>{
 const rotation=make("rotation",{played:3});
 const fix=make("fixed",{m:{fixed:true,targetDays:null}});
 const absent=make("absent",{m:{participating:false}});
 const former=make("former",{m:{cocSyncState:"former"}});
 assert.deepEqual(ids(filterDeploymentRows([rotation,fix,absent,former],{group:"rotation"})),["rotation"]);
 assert.deepEqual(ids(filterDeploymentRows([rotation,fix,absent,former],{group:"all"})),["absent","fixed","former","rotation"]);
});
test("Ziel offen / erreicht distinguishes executed attacks from merely planned (2–7 days)",()=>{
 for(const target of [2,3,4,5,6,7]){
  const pending=make("pending-"+target,{m:{targetDays:target},played:target-1,count:target,open:1});
  const reached=make("reached-"+target,{m:{targetDays:target},played:target,count:target,open:0});
  assert.equal(pending.targetStatus,"open",target+" attacks expected");
  assert.equal(reached.targetStatus,"reached",target+" attacks expected");
  assert.deepEqual(ids(filterDeploymentRows([pending,reached],{progress:"target-open"})),["pending-"+target]);
  assert.deepEqual(ids(filterDeploymentRows([pending,reached],{progress:"target-met"})),["reached-"+target]);
 }
});
test("Jamie and Pro_Gamer: 3 executed plus one planned qualifies as Ziel offen",()=>{
 for(const name of ["Jamie","Pro_Gamer"]){
  const row=make(name,{m:{targetDays:null},played:3,open:1,count:4});
  assert.equal(row.targetStatus,"open");
  assert.equal(row.targetSource,"planned");
  assert.equal(row.exact,4);
  assert.deepEqual(ids(filterDeploymentRows([row],{progress:"target-open"})),[name]);
  const reached=make(name,{m:{targetDays:null},played:4,open:0,count:4});
  assert.equal(reached.targetStatus,"reached");
  assert.deepEqual(ids(filterDeploymentRows([reached],{progress:"target-met"})),[name]);
 }
});
test("Actual 1/5 planned stays open; 5/5 executed is reached without explicit target",()=>{
 const open=make("pending",{m:{targetDays:null},played:1,count:5,open:4});
 const met=make("done",{m:{targetDays:null},played:5,count:5,open:0});
 assert.equal(open.targetStatus,"open");
 assert.equal(met.targetStatus,"reached");
 assert.deepEqual(ids(filterDeploymentRows([open,met],{progress:"target-open"})),["pending"]);
 assert.deepEqual(ids(filterDeploymentRows([open,met],{progress:"target-met"})),["done"]);
});
test("Explicit user goal remains authoritative even if plan has fewer appearances",()=>{
 const goal5=make("goal5",{m:{targetDays:5},count:4,played:4,open:0});
 assert.equal(goal5.targetStatus,"open");
 assert.equal(goal5.targetSource,"fixed");
 assert.equal(goal5.exact,5);
 const completed=make("completed",{m:{targetDays:5},count:4,played:5,open:0});
 assert.equal(completed.targetStatus,"reached");
});
test("No planned target and uncertain/player tag remain unclassified instead of fake zero",()=>{
 const noPlan=make("noPlan",{m:{targetDays:null},count:0,played:0,open:0});
 const duplicate=make("duplicate",{played:3,identifiable:false});
 const withoutTag=make("withoutTag",{m:{playerTag:""},played:0});
 assert.equal(noPlan.targetStatus,"unknown");
 assert.equal(duplicate.targetStatus,"unknown");
 assert.equal(withoutTag.targetStatus,"unknown");
 assert.deepEqual(ids(filterDeploymentRows([noPlan,duplicate,withoutTag],{progress:"target-open"})),[]);
});
test("8★ reached after 3 AG does not mean 4/4 AG; six stars after 4 AG do not mean medal reached",()=>{
 const early=make("early",{played:3,open:1,medal:{status:"reached",stars:8,remainingStars:0,unknown:false}});
 const six=make("six",{played:4,open:0,stars:6});
 assert.equal(early.targetStatus,"open");
 assert.equal(early.medalStatus,"reached");
 assert.equal(six.targetStatus,"reached");
 assert.equal(six.medalStatus,"open");
 assert.deepEqual(ids(filterDeploymentRows([early,six],{progress:"target-open",medal:"reached"})),["early"]);
 assert.deepEqual(ids(filterDeploymentRows([early,six],{progress:"target-met",medal:"open"})),["six"]);
});
test("8★ offen excludes stale/missing/unknown rather than treating uncertainty as zero",()=>{
 const unclear=make("unclear",{medal:{status:"uncertain",stars:6,remainingStars:2,unknown:true}});
 const stale=make("stale",{fresh:false,medal:{status:"possible",stars:6,remainingStars:2,unknown:false}});
 const missing=make("missing",{medal:null});
 const open=make("open",{medal:{status:"possible",stars:6,remainingStars:2,unknown:false}});
 const unreachable=make("unreachable",{medal:{status:"not-reachable",stars:4,remainingStars:4,unknown:false}});
 const reached=make("reached",{fresh:false,medal:{status:"reached",stars:8,remainingStars:0,unknown:false}});
 const all=[unclear,stale,missing,open,unreachable,reached];
 assert.deepEqual(ids(filterDeploymentRows(all,{medal:"open"})),["open","unreachable"]);
 assert.deepEqual(ids(filterDeploymentRows(all,{medal:"reached"})),["reached"]);
 assert.equal(unclear.medalStatus,"unknown");
 assert.equal(stale.medalStatus,"unknown");
 assert.equal(missing.medalStatus,"unknown");
});
test("Three filters compose with search using AND; no hidden extra filter dimensions",()=>{
 const rows=[
  make("Anna",{played:3,open:1,stars:6}),
  make("Bernd",{played:3,open:1,medal:{status:"reached",stars:8,remainingStars:0}}),
  make("Cora",{played:4,open:0,stars:6}),
  make("Dennis",{m:{fixed:true},played:3,open:1,stars:3}),
  make("Erik",{played:3,open:1,medal:{status:"uncertain",stars:6,unknown:true}})
 ];
 assert.deepEqual(ids(filterDeploymentRows(rows,{group:"rotation",progress:"target-open",medal:"open"})),["Anna"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{group:"rotation",progress:"target-open",medal:"open",query:"enn"})),[]);
});
test("Sort by open AG, stars, rate and name; do not advertise Rest zum festen Ziel",()=>{
 const rows=[
  make("Z",{played:4,open:0,stars:8}),
  make("B",{played:1,open:3,stars:3,threes:1}),
  make("A",{played:1,open:3,stars:1,threes:0}),
  make("U",{missingProgress:true,played:0,open:4,medal:null})
 ];
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"open-desc"})),["U","A","B","Z"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"hit-desc"})),["B","A","Z","U"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{sort:"name"})),["A","B","U","Z"]);
 const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
 assert.doesNotMatch(html,/option value="rest-(asc|desc)"/);
});
test("Read-only and legacy guest filtering preserve existing simple filters",()=>{
 const rows=[make("Alice",{played:4,open:0}),make("Bob",{played:0,open:4})];
 const before=JSON.stringify(rows);
 assert.deepEqual(ids(filterDeploymentRows(rows,{query:"ALI",legacy:"played"})),["Alice"]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{legacy:"zero"})),[]);
 assert.deepEqual(ids(filterDeploymentRows(rows,{legacy:"future"})),["Bob"]);
 assert.equal(JSON.stringify(rows),before);
});
test("Cloud UI provides exactly three dropdown filters, compact sorting, reset and updated help",()=>{
 const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
 const doc=new JSDOM(html).window.document;
 const group=doc.getElementById("summaryGroup"),goal=doc.getElementById("summaryProgress"),
  medal=doc.getElementById("summaryMedal");
 const options=el=>[...el.options].map(x=>x.textContent);
 assert.deepEqual(options(group),["Alle Spieler","Rotierende Spieler"]);
 assert.deepEqual(options(goal),["Alle Ziele","Ziel offen","Ziel erreicht"]);
 assert.deepEqual(options(medal),["Alle 8★","8 Sterne offen","8 Sterne erreicht"]);
 assert.ok(doc.getElementById("summaryFilterPicker"));
 assert.ok(doc.getElementById("summaryActiveFilters"));
 assert.ok(doc.getElementById("summarySort"));
 assert.equal(doc.querySelectorAll("#summaryFilterMenu button[data-filter-key]").length,5);
 assert.deepEqual([...doc.querySelectorAll("#summaryFilterMenu button[data-filter-key]")].map(x=>x.textContent.trim()),
  ["Rotierende Spieler","Ziel offen","Ziel erreicht","8 Sterne offen","8 Sterne erreicht"]);
 assert.equal(doc.querySelectorAll("#summaryCloudFilters select").length,4,"3 hidden compatibility selects plus sort");
 assert.ok(doc.getElementById("summaryResetFilters"));
 assert.match(html,/targetSource==="planned"/);
 assert.match(html,/cwl-deployment-filters\.js\?v=1\.16\.67/);
 assert.match(html,/Filter in Einsätze/);
 assert.match(html,/summary-filter-chip/);
 assert.match(fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8"),/const APP_VERSION="v1\.0\.2"/);
});
