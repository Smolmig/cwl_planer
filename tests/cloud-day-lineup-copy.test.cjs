"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const start=html.indexOf("function buildDayLineupText(day){");
const end=html.indexOf("function copyDayLineup(day){",start);

function formatWith(dayPlans,members,day){
 assert.ok(start>=0&&end>start,"day lineup formatter remains present");
 const fn=vm.runInNewContext(html.slice(start,end)+"\nbuildDayLineupText",{
  lastPlan:{dayPlans},
  lineupPlayer:(id,d)=>members[id]||null,
  displayMemberName:m=>m.duplicate?`${m.name} (${m.playerTag})`:m.name
 });
 return fn(day);
}

test("single-day Clash copy includes only that day's player names, without planner details",()=>{
 const plans=Array.from({length:7},(_,i)=>({day:i+1,lineup:i===4?["a","b","c"]:["other"]}));
 const text=formatWith(plans,{
  a:{name:"Cree"},
  b:{name:"Dani Blaze V2"},
  c:{name:"Flo",duplicate:true,playerTag:"#P8Y2"},
  other:{name:"NotInDayFive",townHall:18}
 },4);
 assert.equal(text,"⚔️ CWL Tag 5 – Aufstellung\n1. Cree\n2. Dani Blaze V2\n3. Flo (#P8Y2)");
 assert.doesNotMatch(text,/NotInDayFive|Hitrate|3★|Ø Sterne|Wechsel|Gegner|Tag 1|RH18/);
 assert.equal(formatWith(plans,{other:{name:"Other"}},0),"⚔️ CWL Tag 1 – Aufstellung\n1. Other");
});

test("empty and missing day rosters do not produce a misleading paste",()=>{
 assert.equal(formatWith([{day:1,lineup:[]},{day:2,lineup:["ghost"]}],{},0),"");
 assert.equal(formatWith([{day:1,lineup:[]},{day:2,lineup:["ghost"]}],{},1),"");
 assert.equal(formatWith([],{},3),"");
});

test("plan day button is always rendered regardless of Clash comparison status",()=>{
 assert.match(html,/class="day-copy-tools"><button class="btn small copy-day-lineup"/);
 assert.match(html,/data-day="\$\{dp\.day-1\}"\$\{names\.length\?"":" disabled"\}/);
 assert.match(html,/\.copy-day-lineup"\)\.forEach\(b=>b\.onclick=\(\)=>copyDayLineup\(Number\(b\.dataset\.day\)\)\)/);
 assert.match(html,/function copyDayLineup\(day\)\{/);
 assert.match(html,/void copyText\(text,`Aufstellung für Tag \$\{day\+1\} kopiert ✓`\)/);
 assert.match(html,/id="copyFullPlanBtn">Plan kopieren/,"full multi-day export stays independent");
 assert.match(html,/copy-changes/,"existing plan rotation copy stays independent");
});
