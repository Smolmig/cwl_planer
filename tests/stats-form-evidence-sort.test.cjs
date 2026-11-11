"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const core=()=>import("file://"+path.join(root,"cwl-stats-core.mjs"));
const player=(name,attacks,triples,days=90)=>({
 name,tag:"#"+name.toUpperCase(),windows:{[days]:{
  attacks,triples,hitRate:attacks?Math.round(100*triples/attacks):null
 }}
});

test("evidence-first form: robust sample precedes perfect tiny samples",async()=>{
 const {sortPlayerFormRows}=await core();
 const list=[
  player("Two",2,2),player("Thirty",33,30),
  player("Six",6,6),player("Fifteen",17,15),
  player("NoData",0,0)
 ];
 const sorted=sortPlayerFormRows(list,90,"evidence").map(x=>x.name);
 assert.deepEqual(sorted,["Thirty","Fifteen","Six","Two","NoData"]);
 assert.equal(list[0].name,"Two","sorting must not mutate original data");
});

test("within each evidence group raw hit-rate sorts, then attacks, then name",async()=>{
 const {sortPlayerFormRows}=await core();
 const list=[
  player("Low",7,4),player("High",9,8),
  player("BigLower",20,16),player("BigHigher",16,15),
  player("TinyZero",1,0),player("TinyPerfect",3,3)
 ];
 const sorted=sortPlayerFormRows(list,90).map(p=>p.name);
 assert.deepEqual(sorted,["BigHigher","BigLower","High","Low","TinyPerfect","TinyZero"]);
});

test("explicit raw-rate mode keeps actual 100% top; no hidden skill score",async()=>{
 const {sortPlayerFormRows}=await core();
 const list=[player("Two",2,2),player("Thirty",33,30),player("NoData",0,0)];
 assert.deepEqual(sortPlayerFormRows(list,90,"hitRate").map(x=>x.name),
  ["Two","Thirty","NoData"]);
 assert.deepEqual(sortPlayerFormRows(list,90,"attacks").map(x=>x.name),
  ["Thirty","Two","NoData"]);
 assert.deepEqual(sortPlayerFormRows(list,90,"name").map(x=>x.name),
  ["NoData","Thirty","Two"]);
});

test("form sort respects selected window and rejects unknown options",async()=>{
 const {sortPlayerFormRows}=await core();
 const a=player("Alpha",2,2,30);
 const b=player("Beta",17,15,30);
 a.windows[90]={attacks:25,triples:20,hitRate:80};
 b.windows[90]={attacks:1,triples:1,hitRate:100};
 assert.deepEqual(sortPlayerFormRows([a,b],30).map(x=>x.name),["Beta","Alpha"]);
 assert.deepEqual(sortPlayerFormRows([a,b],90).map(x=>x.name),["Alpha","Beta"]);
 assert.throws(()=>sortPlayerFormRows([a],90,"strength"),/Ungültige Sortierung/);
});

test("UI distinguishes evidence ordering from the explicitly raw hit-rate choice",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const js=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/<option value="evidence" selected>Angriffsmenge &amp; 3★-Quote<\/option>/);
 assert.match(html,/<option value="hitRate">3★-Quote \(auch bei wenigen Angriffen\)<\/option>/);
 assert.match(js,/formWindow=90,formSearch="",formSort="evidence"/);
 assert.match(js,/sortPlayerFormRows\(data\.players\.filter/);
 assert.match(js,/Sortiert nach Datenmenge, danach 3★-Quote/i);
 assert.match(html,/kein(?:e)? statistische Spielstärkebewertung/i);
});
