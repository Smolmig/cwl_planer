"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),http=require("node:http");
const {chromium,webkit}=require("playwright"),root=path.resolve(__dirname,"..");
const engine=process.env.CWL_TEST_BROWSER==="webkit"?webkit:chromium;
const app=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const allowed=new Set(["cloud-app.html","cwl-planning-core.js","cwl-strategic-pilot-view.mjs","cwl-strategic-pilot.mjs","cwl-strategic-rest.mjs","cwl-strategic-experiment.mjs","cwl-strategic-daily.mjs","cwl-strategic-targets.mjs","cwl-strategic-presentation.mjs"]);
test("integrated pilot in actual Cloud shell: real core, responsive themes, same-clan refresh, late-response isolation",{timeout:120000},async()=>{
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
  if(name==="cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return}
  if(!allowed.has(name)){res.writeHead(404);res.end();return}
  res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8"});res.end(name==="cloud-app.html"?app:fs.readFileSync(path.join(root,name)));
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
 try{
  browser=await engine.launch({headless:true,...(engine===chromium?{args:["--no-sandbox"]}:{})});
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
    const contrast=await entry.locator("select").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{const s=getComputedStyle(n);const lum=c=>{const rgb=c.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number);return rgb?.length===3?rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0):null};const a=lum(s.color),b=lum(s.backgroundColor);return {appearance:s.appearance,ratio:a===null||b===null?0:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)}}));
    assert.ok(contrast.length&&contrast.every(c=>c.appearance==="none"&&c.ratio>=4.5),"select appearance or contrast "+width+" "+theme+" "+JSON.stringify(contrast));
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),"app overflow "+width+" "+theme);
    if(dir&&["arena","dark"].includes(theme)){await entry.evaluate(n=>{const top=n.getBoundingClientRect().top+scrollY;const header=document.querySelector(".topbar")?.getBoundingClientRect().height||0;scrollTo(0,Math.max(0,top-header-8))});await page.screenshot({path:path.join(dir,"strategic-integrated-"+theme+"-"+width+".png")});}
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
  // Real members host: same single panel, no second copy of plan controls.
  await page.evaluate(()=>{window.__pilotContext={...window.__pilotContext,key:"clan-c",ready:true};window.__pilot.relocate(document.getElementById("membersStrategicAnchor"));window.__pilot.sync()});
  assert.equal(await entry.evaluate(n=>n.closest(".view")?.id),"view-members");
  assert.equal(await page.locator("#strategicPilotCalculate").count(),1);
  assert.match(await entry.locator(":scope > summary").textContent(),/Kaderempfehlungen/);
  assert.deepEqual(errors,[]);
  // External assets may be blocked by this synthetic shell; no real backend.
  assert.ok(remote.every(url=>!url.includes("supabase.co")));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
});


test("Goldpass workspace in actual Cloud shell: tabs, responsive presets, isolated test draws and confirmation",{timeout:120000},async()=>{
 const files=new Set(["cloud-app.html","clan-management-core.js","clan-management-missed-core.js","clan-management-cw-core.js","clan-management-cw-view.js","cwl-deployment-filters.js","cwl-plan-whatif.js","cwl-planning-core.js","cwl-goldpass-view.mjs","cwl-goldpass-core.mjs","cwl-raffle-reveal.mjs","cwl-live-core.mjs","cwl-activity-campaign-view.mjs","cwl-activity-campaign.mjs","cwl-activity-raffle-core.mjs"]);
 const server=http.createServer((req,res)=>{
  const name=new URL(req.url||"/","http://localhost").pathname.slice(1);
  if(name==="cloud-sync.mjs"){res.writeHead(200,{"content-type":"text/javascript"});res.end("export {};");return}
  if(!files.has(name)){res.writeHead(404);res.end();return}
  res.writeHead(200,{"content-type":name.endsWith(".html")?"text/html; charset=utf-8":"text/javascript; charset=utf-8"});res.end(fs.readFileSync(path.join(root,name)));
 });
 await new Promise(r=>server.listen(0,"127.0.0.1",r));let browser;
 try{
  browser=await engine.launch({headless:true,...(engine===chromium?{args:["--no-sandbox"]}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:"reduce"});page.setDefaultTimeout(12000);
  const errors=[],remote=[];page.on("pageerror",e=>errors.push(e.message));
  page.on("response",r=>{if(r.status()>=400&&/goldpass|activity|raffle|cwl-live-core/.test(r.url()))errors.push(r.status()+" "+r.url())});
  await page.route("**/*",r=>{if(!r.request().url().startsWith("http://127.0.0.1:")){remote.push(r.request().url());return r.abort()}return r.continue()});
  await page.goto("http://127.0.0.1:"+server.address().port+"/cloud-app.html",{waitUntil:"domcontentloaded"});
  await page.evaluate(async()=>{
   const {DEFAULT_RAFFLE_RULES,rafflePreview}=await import("/cwl-goldpass-core.mjs");
   const players=Array.from({length:15},(_,i)=>({tag:"#P"+["02","08","09","0P","0Y","0L","0Q","0G","0R","0J","0C","0U","0V","20","22"][i],name:i===0?"Sehr langer Spielername ★ United Fighter":"Testspieler "+(i+1),appearances:5,attacks:5,stars:15,one:0,two:0,three:5,missed:0}));
   const evidence={season:"2026-11",complete:true,warCount:5,ended:5,players};
   let cwl={revision:1,rules:{...DEFAULT_RAFFLE_RULES},eligibility:Object.fromEntries(players.map(p=>[p.tag,{discord:true}])),organizerConfirmed:true};
   const pool=players.slice(0,3).map(p=>({tag:p.tag,name:p.name}));
   let grind={id:"fixture-campaign",title:"November Grind",start:"2026-11-01",end:"2026-11-10",today:"2026-11-11",revision:1,rules:[{metric:"donations",minimum:1000}],decisions:{},ready:true,qualified:3,unknown:0,pool,rows:pool.map(p=>({...p,status:"qualified",discord:true,checks:[{metric:"donations",minimum:1000,value:1800,status:"met"}]})),witness:"grind-witness"};
   window.__goldCalls=[];window.__goldOwner=true;
   const cwlResponse=()=>({...cwl,evidence,preview:rafflePreview(evidence,cwl.rules,cwl.eligibility),witness:"cwl-"+cwl.revision});
   window.CWLCloud={active:true,onLocalChange:()=>{},isOwner:()=>window.__goldOwner,hasApiClan:()=>true,getActiveClanId:()=>"fixture-clan",getActiveClanTag:()=>"#P02",getGoldpassSession:()=>1,getActivitySession:()=>1,
    goldpassSeasons:async()=>["2026-11"],
    goldpassRequest:async q=>{
     window.__goldCalls.push("cwl:"+q.action);
     if(q.action==="save")cwl={...cwl,revision:cwl.revision+1,rules:q.rules,eligibility:q.eligibility,organizerConfirmed:q.organizerConfirmed};
     if(q.action==="draw"){const p=cwlResponse();if(q.expectedWitness!==p.witness)throw Error("witness");cwl={...cwl,revision:cwl.revision+1,official:{version:1,winnerName:p.preview.rows[0].name,winnerTag:p.preview.rows[0].tag,drawnAt:"2026-11-27T12:00:00Z",rules:p.rules,evidence,preview:p.preview,witness:p.witness,ticket:0}}}
     return cwlResponse();
    },
    activityCampaignRequest:async q=>{
     window.__goldCalls.push("grind:"+q.action);
     if(q.action==="list")return [grind];
     if(q.action==="draw"){if(q.witness!==grind.witness)throw Error("witness");grind={...grind,revision:2,official:{winner:pool[0],pool,ticket:0,rows:grind.rows,witness:grind.witness,rules:grind.rules}}}
     return grind;
    }};
   document.body.classList.add("cloud-mode");
   document.querySelector('[data-more-action="goldpass"]').hidden=false;
  });
  await page.locator('.navbtn[data-view="more"]').click();
  await page.locator('[data-more-action="goldpass"]').click();
  const cwl=page.locator("#view-goldpass"),grind=page.locator("#view-activity-goldpass");
  const cwlBtn=name=>cwl.getByRole("button",{name,exact:true}),grindBtn=name=>grind.getByRole("button",{name,exact:true});
  const preset=cwl.locator('select:has(option[value="october"])');
  try{await preset.waitFor()}catch(e){throw Error("Goldpass did not render: "+JSON.stringify({active:await cwl.evaluate(n=>n.classList.contains("active")),content:await cwl.locator("#goldpassContent").textContent(),calls:await page.evaluate(()=>window.__goldCalls),errors}),{cause:e})}
  await preset.selectOption("october");
  assert.match(await cwl.innerText(),/75 Lose insgesamt/);
  assert.equal(await cwlBtn("Offiziell ziehen").isDisabled(),true);
  const count=()=>page.evaluate(()=>window.__goldCalls.filter(x=>/:(save|create|draw|discord)$/.test(x)));
  await cwlBtn("Testziehung starten").click();await cwl.getByText("TESTZIEHUNG – UNVERBINDLICH",{exact:true}).waitFor();assert.deepEqual(await count(),[]);
  const dir=process.env.CWL_UX_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
  async function check(view,name){
   for(const width of [320,390,430,1366,1440]){
    await page.setViewportSize({width,height:900});
    for(const theme of ["arena","dark","light"]){
     await page.evaluate(t=>{document.documentElement.dataset.theme=t;scrollTo(0,0)},theme);
     assert.ok(await view.evaluate(n=>n.scrollWidth<=n.clientWidth+2),name+" view overflow "+width+" "+theme);
     assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3),name+" app overflow "+width+" "+theme);
     const controls=await view.locator("select,input:not([type=checkbox])").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{
      const s=getComputedStyle(n),lum=c=>{const a=c.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number);return a?.length===3?a.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0):null};
      const a=lum(s.color),b=lum(s.backgroundColor);return {height:n.getBoundingClientRect().height,ratio:a===null||b===null?0:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),scheme:s.colorScheme};
     }));
     assert.ok(controls.length&&controls.every(c=>c.height>=43&&c.ratio>=4.5&&c.scheme===(theme==="light"?"light":"dark")),name+" control styling "+width+" "+theme+" "+JSON.stringify(controls));
     if(dir&&["arena","dark"].includes(theme)){
      await page.screenshot({path:path.join(dir,"goldpass-"+name+"-"+theme+"-"+width+".png")});
      const section=view.getByRole("heading",{name:name==="cwl"?"Teilnehmer & Gewinnchancen":"Zielvorlagen",exact:true});
      await section.evaluate(n=>{const y=n.getBoundingClientRect().top+scrollY;const header=document.querySelector(".topbar")?.getBoundingClientRect().height||0;scrollTo({top:Math.max(0,y-header-8),behavior:"instant"})});
      await page.screenshot({path:path.join(dir,"goldpass-detail-"+name+"-"+theme+"-"+width+".png")});
     }
    }
   }
  }
  await check(cwl,"cwl");
  await cwlBtn("Grind-Verlosung").click();await grindBtn("Testen").waitFor();
  // Wait for the list request to finish rather than relying on timing.
  await grind.locator('select').waitFor();
  await grindBtn("Testen").click();await grind.getByText("Testmodus · nur Beispieldaten",{exact:true}).waitFor();
  await grind.getByLabel("Start",{exact:true}).evaluate(e=>{e.value="2026-12-01";e.dispatchEvent(new Event("change"))});
  await grind.getByLabel("Ende (einschließlich)",{exact:true}).evaluate(e=>{e.value="2026-12-31";e.dispatchEvent(new Event("change"))});
  await grindBtn("Aktiver Clan").click();
  assert.equal(await grind.getByLabel("Mindestziel Normale CW-Sterne").inputValue(),"21");
  await grind.getByLabel("Erwartete normale CWs (optional)").fill("1");
  assert.match(await grind.locator(".goldpass-estimate-warning").innerText(),/21 verlangt, maximal 6/);
  assert.equal(await grind.getByLabel("Mindestziel Normale CW-Sterne").inputValue(),"21");
  await grindBtn("Ausgewogener Grind").click();
  await grindBtn("Testziehung starten").click();await grind.getByText("TESTZIEHUNG – UNVERBINDLICH",{exact:true}).waitFor();
  assert.deepEqual(await count(),[]);
  assert.equal(await grindBtn("Verlosung anlegen").count(),0);
  await check(grind,"grind-test");
  // Unsaved CWL settings and sandbox remain independent across both real tabs.
  await grindBtn("CWL-Verlosung").click();
  assert.equal(await preset.inputValue(),"october");
  await cwlBtn("Regeln speichern").click();
  await cwl.getByText("Regeln gespeichert.",{exact:true}).waitFor();
  await cwlBtn("Offiziell ziehen").click();
  await page.locator("#inlineActionPanel").getByRole("button",{name:"Abbrechen",exact:true}).click();
  assert.deepEqual(await count(),["cwl:save"]);
  await cwlBtn("Offiziell ziehen").click();await page.locator("#inlineActionPanel").getByRole("button",{name:"Jetzt offiziell ziehen",exact:true}).click();
  await cwl.getByText("OFFIZIELLES ERGEBNIS",{exact:true}).waitFor();
  assert.equal(await cwlBtn("Offiziell ziehen").count(),0);
  await cwlBtn("Grind-Verlosung").click();await grindBtn("Test beenden").click();
  await grind.locator("select").waitFor();
  await grind.locator('select:has(option[value="fixture-campaign"])').selectOption("fixture-campaign");
  await grindBtn("Gewinner offiziell ziehen").waitFor();
  await grindBtn("Gewinner offiziell ziehen").click();
  await page.locator("#inlineActionPanel").getByRole("button",{name:"Abbrechen",exact:true}).click();
  assert.deepEqual(await count(),["cwl:save","cwl:draw"]);
  await grindBtn("Gewinner offiziell ziehen").click();await page.locator("#inlineActionPanel").getByRole("button",{name:"Gewinner ziehen",exact:true}).click();
  await grind.getByText("OFFIZIELLES ERGEBNIS",{exact:true}).waitFor();
  assert.equal(await grindBtn("Gewinner offiziell ziehen").count(),0);
  assert.deepEqual(await count(),["cwl:save","cwl:draw","grind:draw"]);
  await page.evaluate(()=>{window.__goldOwner=false;window.CWLGoldpassPreview.accessChanged(null);window.CWLActivityGoldpass.accessChanged(null)});
  assert.equal(await page.locator("#goldpassContent").textContent(),"");assert.equal(await page.locator("#activityGoldpassContent").textContent(),"");
  assert.deepEqual(errors,[]);assert.ok(remote.every(url=>!url.includes("supabase.co")));
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
});
