"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const read=x=>fs.readFileSync(path.join(root,x),"utf8");
const html=read("cloud-app.html");
const styles=(html.match(/<style[^>]*>[\s\S]*?<\/style>/gi)||[]).join("");
const plan=html.slice(html.indexOf('<section id="view-plan"'),
 html.indexOf('<section id="view-members"'));
const documentSource='<!doctype html><html lang="de"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+
 styles+'</head><body><main class="content">'+plan+'</main></body></html>';
const warSource=read("cwl-current-war.mjs")
 .replace(/^import .*\n/m,'const safeBadgeUrl=x=>x; const clashTime=s=>Date.parse(s);\n')
 .replace("export function summarizeCurrentWar(","function summarizeCurrentWar(")
 .replace("export function createCurrentWarOverview(","function createCurrentWarOverview(");
const payload={currentWar:{
 state:"inWar",teamSize:2,attacksPerMember:2,
 startTime:"2026-11-10T10:00:00Z",endTime:"2026-11-11T10:00:00Z",
 clan:{name:"United Fighters",badgeUrl:null,stars:5,destructionPercentage:76.3,
 members:[
  {tag:"#2PYL",name:"Luki",townHallLevel:18,attacks:[
   {defenderTag:"#8PYL",stars:3,destructionPercentage:100}]},
  {tag:"#G9QL",name:"Testspieler",townHallLevel:17,attacks:[]}
 ]},
 opponent:{name:"Other Clan",badgeUrl:null,stars:4,destructionPercentage:58.1,
 members:[
  {tag:"#8PYL",name:"Enemy 1",townHallLevel:18,attacks:[
   {defenderTag:"#2PYL",stars:2,destructionPercentage:90}]},
  {tag:"#P9QL",name:"Enemy 2",townHallLevel:17,attacks:[]}
 ]}
}};

test("Normal CW belongs on Plan, not Einsätze, with both rosters and real attack data",async()=>{
 assert.equal((html.match(/id="currentWarCard"/g)||[]).length,1);
 assert.ok(plan.includes('id="currentWarCard"'));
 const oldSummary=html.slice(html.indexOf('<section id="view-summary"'),
   html.indexOf('<section id="view-stats"'));
 assert.doesNotMatch(oldSummary,/id="currentWarCard"/);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(documentSource);
    await page.addScriptTag({content:warSource});
    await page.evaluate((data)=>{
      window.currentOverview=createCurrentWarOverview({
       context:()=>({active:true,clanId:"test",hasClanTag:true}),refresh:()=>{}
      });
      window.currentOverview.update(data);
    },payload);
    await page.locator("#currentWarCard").waitFor({state:"visible"});
    assert.match(await page.locator("#currentWarContent").innerText(),
     /United Fighters[\s\S]*5[\s\S]*4[\s\S]*Other Clan/);
    assert.match(await page.locator("#currentWarContent").innerText(),/76,3 %/);
    assert.match(await page.locator("#currentWarContent").innerText(),/58,1 %/);
    assert.match(await page.locator("#currentWarContent").innerText(),/1\/4 Angriffe/);
    assert.equal(await page.evaluate(()=>document.getElementById("currentWarCard").nextElementSibling?.id),"planOverview",
      "Live battle card should appear above the CWL Plan summary");
    const own=page.locator('.cw-now-details[data-team="own"]');
    const enemy=page.locator('.cw-now-details[data-team="enemy"]');
    await own.locator("summary").click();
    await enemy.locator("summary").click();
    assert.match(await own.innerText(),/Luki/);
    assert.match(await enemy.innerText(),/Enemy 1/);
    for(const theme of ["gold","dark","light"]){
     await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
     const dimensions=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,width:window.innerWidth
     }));
     assert.ok(dimensions.scroll<=dimensions.width+3,
      JSON.stringify({theme,viewport:width,dimensions}));
    }
    assert.deepEqual(errors,[]);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
