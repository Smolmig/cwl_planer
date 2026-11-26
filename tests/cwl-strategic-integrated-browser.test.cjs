"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium}=require("playwright"),root=path.resolve(__dirname,"..");
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const allowed=new Set(["cloud-app.html","cwl-planning-core.js","cwl-strategic-pilot-view.mjs","cwl-strategic-pilot.mjs","cwl-strategic-experiment.mjs","cwl-strategic-daily.mjs","cwl-strategic-targets.mjs","cwl-strategic-presentation.mjs"]);
test("integrated pilot in actual Cloud shell: real core, responsive themes, same-clan refresh, late-response isolation",{timeout:120000},async()=>{
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
  if(name==="cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return}
  if(!allowed.has(name)){res.writeHead(404);res.end();return}
  res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8"});res.end(name==="cloud-app.html"?app:fs.readFileSync(path.join(root,name)));
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
 try{
  browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
  const page=await browser.newPage({viewport:{width:390,height:844}});page.setDefaultTimeout(12000);
  const errors=[],remote=[];page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/*",r=>{if(!r.request().url().startsWith("http://127.0.0.1:")){remote.push(r.request().url());return r.abort()}return r.continue()});
  const abc="0289PYLQGRJCUV",tag=i=>"#P"+abc[Math.floor(i/13)%13]+abc[i%13];
  const profile={id:"pilot-browser",name:"Testclan",config:{slots:15,days:7},members:Array.from({length:18},(_,i)=>({id:"p"+i,name:i===0?"Sehr langer Spielername ★ "+("X".repeat(20)):"Testspieler "+(i+1),playerTag:tag(i+10),townHall:19,participating:true,statuses:Array(7).fill("auto")})),archivedMembers:[],locks:Array.from({length:7},()=>({locked:false,lineup:[]})),dayGoals:Array.from({length:7},()=>({townHall:{},strength:{}})),archives:[]};
  await page.addInitScript(p=>localStorage.setItem("cwl_planer_mobile_v9",JSON.stringify({version:9,dataVersion:9,activeProfileId:p.id,profiles:[p]})),profile);
  await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
  await page.evaluate(async profile=>{
   const {createStrategicPilotView}=await import("/cwl-strategic-pilot-view.mjs");
   const {preparePilotInput,buildPilotPreview}=await import("/cwl-strategic-pilot.mjs");
   const currentPlan=window.CWLPlanningCore.planCwl({members:profile.members,slots:15,days:7}).dayPlans;
   window.__pilotProfile=profile;
   window.__pilotBefore=JSON.stringify(profile);
   window.__pilotStorage=localStorage.getItem("cwl_planer_mobile_v9");
   window.__pilotContext={key:"clan-a",token:"rev1",phase:"roster",ready:true,role:"owner",clanTag:"#P02",slots:15,days:7,candidates:profile.members.map(m=>({id:m.id,tag:m.playerTag,name:m.name,fixed:false}))};
   window.__pilotDelay=false;
   window.__pilot=createStrategicPilotView({anchor:document.getElementById("planCwlSeasonEntry"),getContext:()=>window.__pilotContext,load:async(mode,c,draft)=>{
    if(window.__pilotDelay)await new Promise(r=>window.__pilotResolve=r);
    const now=Date.now(),input=preparePilotInput({context:c,profile,currentPlan,draft});
    return buildPilotPreview({input,history:{kind:"current_snapshot_war_start_proxy",asOf:now,facts:[],obligations:[],audit:{}},mode,planStandard:window.CWLPlanningCore.planCwl,now});
   }});
   document.body.classList.add("cloud-mode");
  },profile);
  const entry=page.locator("#planStrategicPilot"),calculate=page.locator("#strategicPilotCalculate");
  await entry.locator(":scope > summary").click();await calculate.click();
  await page.getByText("Kadervergleich",{exact:true}).waitFor();
  assert.match(await entry.innerText(),/18 Spieler mit offener Teilnahme/);
  assert.match(await entry.innerText(),/Noch benötigte Zusagen.*15/s);
  assert.doesNotMatch(await entry.innerText(),/-15/);
  assert.match(await entry.innerText(),/Annahme: 15 gegen 15 · 7 Kriegstage/);
  await page.locator("#strategicPilotDetails > summary").click();
  assert.equal(await entry.locator("tbody tr").count(),18);
  await entry.getByLabel("Spieler filtern").selectOption("review");
  assert.equal(await entry.locator("tbody tr").count(),18);
  await page.evaluate(()=>window.__pilot.sync());
  assert.equal(await page.locator("#strategicPilotDetails").evaluate(n=>n.open),true);
  assert.equal(await entry.getByLabel("Spieler filtern").inputValue(),"review");
  const dir=process.env.CWL_UX_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
  for(const width of [320,390,430,1366,1440]){
   await page.setViewportSize({width,height:900});
   for(const theme of ["arena","dark","light","cyber","cyberlight"]){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.ok(await entry.evaluate(n=>n.scrollWidth<=n.clientWidth+2),"pilot overflow "+width+" "+theme);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),"app overflow "+width+" "+theme);
    if(dir&&["arena","dark"].includes(theme))await entry.screenshot({path:path.join(dir,"strategic-integrated-"+theme+"-"+width+".png")});
   }
  }
  await entry.getByText("Teilnahme erfassen (optional)",{exact:true}).click();
  const participant=entry.getByLabel("Teilnehmer suchen");
  await participant.fill("Testspieler 2");await entry.getByLabel("Teilnahme Testspieler 2 "+profile.members[1].playerTag,{exact:true}).selectOption("yes");
  await participant.fill("Testspieler 3");await entry.getByLabel("Teilnahme Testspieler 3 "+profile.members[2].playerTag,{exact:true}).selectOption("no");
  await entry.getByLabel("Angenommene Kriegstage").selectOption("5");await calculate.click();
  await page.getByText("Kadervergleich",{exact:true}).waitFor();assert.match(await entry.innerText(),/Eine Absage wurde nur für diesen Entwurf berücksichtigt/);
  assert.match(await entry.innerText(),/5 Kriegstage/);assert.match(await entry.innerText(),/16 Spieler mit offener Teilnahme/);
  await entry.getByLabel("CWL-Format").selectOption("30");await calculate.click();
  await page.getByText("Entwurf noch nicht möglich",{exact:true}).waitFor();
  assert.match(await entry.innerText(),/30 Plätze.*17 mögliche Teilnehmer/);
  await entry.getByLabel("CWL-Format").selectOption("15");
  await page.evaluate(()=>{window.__pilotDelay=true});await calculate.click();
  await page.getByText("Vorschau wird berechnet …",{exact:true}).waitFor();
  await page.evaluate(()=>{window.__pilotContext=null;window.__pilot.sync();window.__pilotResolve()});
  await entry.waitFor({state:"hidden"});assert.doesNotMatch(await entry.textContent(),/Testspieler|Sehr langer Spielername/);
  await page.evaluate(()=>{window.__pilotContext={key:"clan-b",token:"rev2",phase:"roster",ready:false,role:"vice",clanTag:"#P08",slots:15,days:7};window.__pilot.sync()});
  await entry.locator(":scope > summary").click();assert.equal(await calculate.isDisabled(),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(window.__pilotProfile)===window.__pilotBefore&&localStorage.getItem("cwl_planer_mobile_v9")===window.__pilotStorage),true);
  assert.deepEqual(errors,[]);
  // External assets may be blocked by this synthetic shell; no real backend.
  assert.ok(remote.every(url=>!url.includes("supabase.co")));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
});
