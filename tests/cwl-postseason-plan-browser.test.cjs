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
const warSource='const safeBadgeUrl=x=>x; const clashTime=s=>Date.parse(s);\n'+
 read("cwl-normal-war-core.mjs").replace(/^export /gm,"")+"\n"+
 read("cwl-current-war.mjs").replace(/^import .*$/gm,"").replace(/^export /gm,"");
const payload={currentWar:{
 state:"preparation",teamSize:2,attacksPerMember:2,
 startTime:"2026-11-11T10:00:00Z",endTime:"2026-11-12T10:00:00Z",
 clan:{tag:"#2PYL",name:"United Fighters",badgeUrl:null,stars:5,
  destructionPercentage:76.3,attacks:1,
  members:[
   {tag:"#2PYL",name:"Luki",townHallLevel:18,mapPosition:1,attacks:[
    {defenderTag:"#8PYL",order:2,duration:151,stars:3,destructionPercentage:100}]},
   {tag:"#G9QL",name:"Testspieler",townHallLevel:17,mapPosition:2,attacks:[]}
  ]},
 opponent:{tag:"#8PYL",name:"Other Clan",badgeUrl:null,stars:4,
  destructionPercentage:58.1,attacks:1,
  members:[
   {tag:"#8PYL",name:"Enemy 1",townHallLevel:18,mapPosition:1,attacks:[
    {defenderTag:"#2PYL",order:1,duration:140,stars:2,destructionPercentage:90}]},
   {tag:"#P9QL",name:"Enemy 2",townHallLevel:17,mapPosition:2,attacks:[]}
  ]}
}};

test("Plan switches from preparation to prominent live CW with accessible tabs and collapsible CWL",{
 timeout:120000
},async()=>{
 assert.equal((html.match(/id="currentWarCard"/g)||[]).length,1);
 assert.ok(plan.includes('id="currentWarCard"'));
 const summary=html.slice(html.indexOf('<section id="view-summary"'),
  html.indexOf('<section id="view-stats"'));
 assert.doesNotMatch(summary,/id="currentWarCard"/);
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  for(const width of [320,390,430,1280]){
   const page=await browser.newPage({viewport:{width,height:844}});
   try{
    const errors=[];page.on("pageerror",e=>errors.push(e.message));
    await page.setContent(documentSource);
    await page.addScriptTag({content:warSource});
    await page.evaluate((data)=>{
     document.getElementById("planCwlPostseason").hidden=false;
     document.getElementById("planCwlPostseason").innerHTML=
      '<details class="plan-postseason-disclosure" open><summary>Letzte CWL</summary></details>';
     window.currentOverview=createCurrentWarOverview({
      context:()=>({active:true,clanId:"test",hasClanTag:true}),refresh:()=>{}
     });
     window.currentOverview.update(data);
    },payload);
    await page.locator("#currentWarCard").waitFor({state:"visible"});
    assert.equal(await page.locator(".plan-postseason-disclosure").evaluate(d=>d.open),true);
    assert.equal(await page.locator("#currentWarCard .section-title h3").innerText(),"Nächster Clankrieg");
    assert.match(await page.locator("#currentWarContent").innerText(),/Kriegsbeginn/);
    await page.evaluate(data=>{
      data.currentWar.state="inWar";
      window.currentOverview.update(data);
    },payload);
    assert.equal(await page.locator("#currentWarCard .section-title h3").innerText(),"Clankrieg live");
    assert.equal(await page.locator("#currentWarCard").evaluate(x=>x.nextElementSibling?.id),"planOverview");
    assert.equal(await page.locator(".plan-postseason-disclosure").evaluate(d=>d.open),false);
    assert.match(await page.locator("#currentWarContent").innerText(),/United Fighters/);
    assert.match(await page.locator("#currentWarContent").innerText(),/Other Clan/);
    assert.match(await page.locator("#currentWarContent").innerText(),/76,3 %/);
    assert.match(await page.locator("#currentWarContent").innerText(),/58,1 %/);
    assert.match(await page.locator("#currentWarContent").innerText(),/3-Sterne-Angriffe/);
    assert.match(await page.locator("#currentWarContent").innerText(),/Stärkste Angriffe/);
    await page.getByRole("tab",{name:"Angriffe"}).click();
    assert.equal(await page.locator("#cwNowPanel-attacks").isVisible(),true);
    assert.equal(await page.locator("#cwNowPanel-overview").isVisible(),false);
    assert.match(await page.locator("#cwNowPanel-attacks").innerText(),/Luki/);
    assert.match(await page.locator("#cwNowPanel-attacks").innerText(),/Enemy 1/);
    await page.getByRole("tab",{name:"Aufstellungen"}).click();
    assert.match(await page.locator("#cwNowPanel-rosters").innerText(),/Testspieler/);
    assert.match(await page.locator("#cwNowPanel-rosters").innerText(),/Enemy 2/);
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
     const layout=await page.evaluate(()=>({
      scroll:document.documentElement.scrollWidth,width:window.innerWidth
     }));
     assert.ok(layout.scroll<=layout.width+3,
      JSON.stringify({theme,viewport:width,layout}));
    }
    assert.deepEqual(errors,[]);
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
