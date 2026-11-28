"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const engine=process.env.CWL_TEST_BROWSER==="webkit"?webkit:chromium;
const launch=()=>engine.launch({headless:true,...(engine===chromium?{args:["--no-sandbox"]}:{})});
const html=fs.readFileSync(path.join(__dirname,"..","cloud-app.html"),"utf8");
const core=fs.readFileSync(path.join(__dirname,"..","clan-management-core.js"),"utf8");
const markup=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
const start=html.indexOf("/* #183: do not reuse the roster import path");
const end=html.indexOf('document.querySelector(".more-menu").addEventListener("click"',start);
assert.ok(start>0&&end>start);
const previewScript=html.slice(start,end);
const data=[
 {tag:"#2PYL",name:"One",role:"member",donations:37},{tag:"#2PYQ",name:"Two",role:"admin",donations:0},
 {tag:"#2PYR",name:"Vize",role:"coLeader"},{tag:"#2PYJ",name:"Leader",role:"leader"}
];
async function setup(page,theme="arena"){
 await page.setContent(markup,{waitUntil:"domcontentloaded"});
 await page.addScriptTag({content:core});
 await page.addScriptTag({content:
  "const mockRoster="+JSON.stringify(data)+";"+
  "let context='first',owner=true,delay=false,resolvePending=null;"+
  "window.CWLCloud={active:true,isOwner:()=>owner,hasApiClan:()=>true,getActiveClanId:()=>context,"+
  "fetchManagementRoster:()=>delay?new Promise(resolve=>{resolvePending=resolve}):"+
  "Promise.resolve({clanId:context,members:mockRoster,checkedAt:Date.parse('2026-11-10T06:00:00Z'),"+
  "tenure:[{player_tag:'#2PYL',confirmed_seconds:7200,last_observed_at:'2026-11-10T05:00:00Z',observed_visits:2,is_present:true,rank_before_leave:'elder',rank_before_leave_at:'2026-11-08T05:00:00Z',last_donation_increase_at:'2026-11-10T05:00:00Z',last_donation_increase_by:4}]})};"+
  "function showPlannerView(target){document.querySelectorAll('.view').forEach("+
  "x=>x.classList.toggle('active',x.id==='view-'+target));}"
 });
 await page.addScriptTag({content:previewScript});
 await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
}
test("More/Clanverwaltung shows current Clash ranks without recommending actions or copying leader rows",{
 timeout:60000
},async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  try{
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await setup(page);
   await page.evaluate(()=>window.CWLClanManagementView.accessChanged("first"));
   await page.evaluate(()=>window.CWLClanManagementView.open());
   await page.waitForFunction(()=>document.getElementById("clanManagementStatus").textContent.includes("Clash zuletzt geprüft"));
   assert.equal(await page.locator("#managementOverview").isVisible(),true);
   assert.match(await page.locator("#clanManagementActionHeading").innerText(),/Mindestens 0 Spieler/);
   await page.locator('[data-management-source="rank"]').click();
   const first=await page.locator("#clanManagementList .clan-management-person").allTextContents();
   assert.equal(first.length,1,"open recommendations must be the default view");
   assert.match(first[0],/One/);
   assert.match(first[0],/Früheren Rang prüfen/);
   assert.match(await page.locator("#clanManagementSummary").textContent(),/gespeicherte Prüfstände nicht abrufbar/);
   await page.locator("#clanManagementFilterAll").click();
   const rows=await page.locator("#clanManagementList .clan-management-person").allTextContents();
   assert.equal(rows.length,2,"the full evaluated list includes members and elders");
   assert.ok(rows.some(t=>t.includes("One")&&t.includes("Mitglied")));
   assert.ok(rows.some(t=>t.includes("Two")&&t.includes("Ältester")&&t.includes("Keine Empfehlung")));
   assert.ok(rows.every(t=>!t.includes("Vize")&&!t.includes("Leader")));
   await page.locator('.clan-management-person[data-player-tag="#2PYL"] details > summary').click();
   const info=await page.locator('.clan-management-person[data-player-tag="#2PYL"]').innerText();
   assert.match(info,/Spenden laut Clash/);
   assert.match(info,/Rang nach Rückkehr/);
   assert.equal(await page.locator("#clanManagementList button").count(),0,
    "unreadable private decisions never expose write buttons");
   await page.locator("#clanManagementBack").click();
   assert.equal(await page.locator("#view-more").getAttribute("class"),"view active");
   assert.deepEqual(errors,[]);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("Discard pending API response after clan switch or lost owner permission",{
 timeout:60000
},async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage();
  try{
   await setup(page);
   await page.evaluate(()=>{
    window.CWLClanManagementView.accessChanged("first");
    delay=true;
    window.CWLClanManagementView.open();
    context="second";
    window.CWLClanManagementView.accessChanged("second");
    resolvePending({clanId:"first",members:mockRoster,checkedAt:Date.now()});
   });
   await page.waitForTimeout(20);
   assert.equal(await page.locator("#clanManagementList .clan-management-person").count(),0);
   await page.evaluate(()=>{
    owner=false;
    window.CWLClanManagementView.accessChanged(null);
   });
   assert.equal(await page.locator("#view-clan-management").getAttribute("class"),"view more-subview");
   assert.equal(await page.locator("#clanManagementList .clan-management-person").count(),0);
  }finally{await page.close()}
 }finally{await browser.close()}
});
test("Compact read-only management screen fits mobile Gold, Dark and Light widths",{
 timeout:90000
},async()=>{
 const browser=await launch();
 try{
  for(const theme of ["arena","dark","light"]){
   for(const width of [320,390,430,1024]){
    const page=await browser.newPage({viewport:{width,height:844}});
    try{
     await setup(page,theme);
     await page.evaluate(()=>{window.CWLClanManagementView.accessChanged("first");window.CWLClanManagementView.open()});
     await page.waitForFunction(()=>document.getElementById("clanManagementStatus").textContent.includes("Clash zuletzt geprüft"));
     await page.locator('[data-management-source="rank"]').click();
     await page.locator("#clanManagementFilterAll").click();
     await page.waitForFunction(()=>document.querySelectorAll("#clanManagementList .clan-management-person").length===2);
     const layout=await page.evaluate(()=>({
      viewport:innerWidth,
      documentWidth:document.documentElement.scrollWidth,
      backHeight:document.getElementById("clanManagementBack").getBoundingClientRect().height,
      refreshHeight:document.getElementById("clanManagementRefresh").getBoundingClientRect().height,
      rows:document.querySelectorAll("#clanManagementList .clan-management-person").length
     }));
     assert.ok(layout.documentWidth<=width+3,JSON.stringify({theme,width,layout}));
     assert.ok(layout.backHeight>=40&&layout.refreshHeight>=44,JSON.stringify({theme,width,layout}));
     assert.equal(layout.rows,2);
    }finally{await page.close()}
   }
  }
 }finally{await browser.close()}
});

test("Action workspace search, rule drafts, refresh and clan isolation remain usable across themes", {timeout:120000},async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await setup(page);
  await page.evaluate(()=>{
   const now=Date.now();
   window.CWLCloud.fetchManagementRoster=async()=>({clanId:context,members:mockRoster,checkedAt:now,ruleRevision:null,rules:window.CWLClanManagement.DEFAULT_RULES,reviewDecisions:[],
    tenure:[{player_tag:"#2PYL",confirmed_seconds:30*86400,last_observed_at:new Date(now-1000).toISOString(),is_present:true,observed_visits:1}],
    evidence:[{player_tag:"#2PYL",attack_count:10,three_star_count:9,relevant_wars:7}],loyalty:null});
   window.CWLClanManagementView.open();
  });
  const host=page.locator("#view-clan-management"),query=host.locator("#managementActionQuery");
  await query.waitFor();
  assert.match(await host.locator("#clanManagementActionHeading").innerText(),/1 Spieler.*1 offener Fall/);
  await query.fill("nicht vorhanden");
  assert.match(await host.locator("#clanManagementActionList").innerText(),/Keine passenden Spieler/);
  assert.match(await host.locator("#clanManagementActionHeading").innerText(),/1 offener Fall/);
  await query.fill("#2pyl");
  await host.locator("#clanManagementRefresh").click();
  await page.waitForFunction(()=>!document.getElementById("clanManagementRefresh").disabled);
  assert.equal(await query.inputValue(),"#2pyl");
  assert.equal(await host.locator("#managementActionMatches").innerText(),"1 von 1 Spielern");
  await host.getByRole("button",{name:"Beförderung / Rückkehr für One ansehen"}).click();
  assert.equal(await host.locator("#managementOverview").isVisible(),false);
  assert.equal(await host.locator("#managementRank").isVisible(),true);
  assert.equal(await host.locator('#clanManagementList [data-player-tag="#2PYL"] details').evaluate(n=>n.open),true);
  await host.locator('[data-management-section="rules"]').click();
  await host.locator("#clanRuleDays").fill("27");
  assert.equal(await host.locator("#clanRulesStatus").getAttribute("data-tone"),"warning");
  assert.match(await host.locator("#clanRulesDraftSummary").innerText(),/Entwurf: Leistung: ab 27 Clantagen/);
  assert.equal(await host.locator("#clanPerformanceState").getAttribute("data-tone"),"positive");
  await host.locator("#clanRuleEnabled").uncheck();
  assert.equal(await host.locator("#clanPerformanceState").innerText(),"Inaktiv");
  assert.match(await host.locator("#clanRulesDraftSummary").innerText(),/Keine leistungs- oder treuebasierte/);
  await host.locator("#clanRuleEnabled").check();
  await host.locator(".clan-rule-future > summary").click();
  await host.locator("#clanRuleLoyaltyEnabled").check();
  await host.locator("#clanRuleDonationDays").fill("31");
  await host.locator("#clanRuleDonationWindow").fill("30");
  assert.equal(await host.locator("#clanRulesDraftSummary").getAttribute("data-tone"),"warning");
  assert.match(await host.locator("#clanRulesDraftSummary").innerText(),/Spendentage/);
  await host.locator("#clanRuleDonationDays").fill("3");
  assert.equal(await host.locator("#clanLoyaltyState").getAttribute("data-tone"),"positive");
  assert.match(await host.locator("#clanRulesDraftSummary").innerText(),/Treue: ab/);
  await host.locator('[data-management-section="members"]').click();
  await host.locator('[data-management-section="rules"]').click();
  assert.equal(await host.locator("#clanRuleDays").inputValue(),"27");
  assert.equal(await host.locator("#clanRulesSave").isEnabled(),true);
  assert.equal(await host.locator("#clanRuleLoyaltyEnabled").isChecked(),true);
  assert.match(await host.locator("#clanManagementActionHeading").textContent(), /1 Spieler.*1 offener Fall/);
  await host.locator("#clanManagementRefresh").click();
  await page.waitForFunction(()=>!document.getElementById("clanManagementRefresh").disabled);
  assert.equal(await host.locator("#clanRuleDays").inputValue(),"27");
  assert.equal(await host.locator("#clanRuleLoyaltyEnabled").isChecked(),true);
  const dir=process.env.CWL_UX_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
  for(const width of [320,390,430,1366,1440]){
   await page.setViewportSize({width,height:900});
   for(const theme of ["arena","dark","light","cyber","cyberlight"]){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    for(const section of ["actions","rules"]){
     await host.locator('[data-management-section="'+section+'"]').click();
     if(section==="actions"){await host.locator('[data-management-source="overview"]').click();await query.fill("");}
     assert.ok(await host.evaluate(n=>n.scrollWidth<=n.clientWidth+3),section+" overflow "+width+" "+theme);
     const heights=await host.locator(".management-workspace-nav button,.management-source-nav button").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));
     assert.ok(heights.length>=3&&heights.every(h=>h>=43),JSON.stringify({width,theme,section,heights}));
     if(section==="actions"){
      const tones=await host.locator(".clan-management-person-status[data-review=positive]").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>{
       const rgb=c=>c.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number),lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
       const style=getComputedStyle(n),probe=document.createElement("span");probe.style.color="var(--green)";n.append(probe);const green=getComputedStyle(probe).color;probe.remove();
       let parent=n,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=="rgba(0, 0, 0, 0)"&&bg!=="transparent")break;parent=parent.parentElement}
       const a=lum(style.color),b=lum(bg);return {correct:style.color===green,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
      }));
      assert.ok(tones.length&&tones.every(x=>x.correct&&x.contrast>=4.5),JSON.stringify({theme,width,tones}));
      const otherTones=await host.locator("#clanManagementActionList").evaluate(list=>{
       const rgb=c=>c.match(/\d+(?:\.\d+)?/g)?.slice(0,3).map(Number),lum=c=>rgb(c).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
       return [["severe","red"],["warning","amber"]].map(([state,token])=>{
        const row=document.createElement("div");row.className="clan-management-person";const status=document.createElement("div");status.className="clan-management-person-status";status.dataset.review=state;status.textContent="Kontrastprüfung";row.append(status);list.append(row);
        const fg=getComputedStyle(status).color;const probe=document.createElement("span");probe.style.color="var(--"+token+")";status.append(probe);const expected=getComputedStyle(probe).color;
        let parent=status,bg;while(parent){bg=getComputedStyle(parent).backgroundColor;if(bg!=="rgba(0, 0, 0, 0)"&&bg!=="transparent")break;parent=parent.parentElement}
        const a=lum(fg),b=lum(bg);row.remove();return {state,correct:fg===expected,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
       });
      });
      assert.ok(otherTones.every(x=>x.correct&&x.contrast>=4.5),JSON.stringify({theme,width,otherTones}));
      // Gradients do not appear in computed backgroundColor. Sample the painted
      // pixels under text in the actual Cyber layouts, not transparent black.
      if(["cyber","cyberlight"].includes(theme)&&[320,1440].includes(width)){
       const status=host.locator("#clanManagementActionList .clan-management-person-status[data-review=positive]").first();
       const foreground=await status.evaluate(n=>getComputedStyle(n).color);
       let png;
       await status.evaluate(n=>n.style.setProperty("color","transparent","important"));
       try{png=await status.screenshot({animations:"disabled"});}
       finally{await status.evaluate(n=>n.style.removeProperty("color"));}
       const ratios=await page.evaluate(async({png,foreground})=>{
        const image=new Image();image.src="data:image/png;base64,"+png;await image.decode();
        const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
        const ctx=canvas.getContext("2d");ctx.drawImage(image,0,0);
        const lum=rgb=>Array.from(rgb).slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const fg=lum(foreground.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number)),ratios=[];
        for(const x of [.1,.3,.5,.7,.9])for(const y of [.25,.5,.75]){
         const bg=lum(ctx.getImageData(Math.floor((canvas.width-1)*x),Math.floor((canvas.height-1)*y),1,1).data);
         ratios.push((Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05));
        }
        return ratios;
       },{png:png.toString("base64"),foreground});
       assert.ok(ratios.every(x=>x>=4.5),JSON.stringify({theme,width,paintedBackgroundRatios:ratios}));
      }
     }
     if(dir&&["arena","dark"].includes(theme)){
      await page.evaluate(()=>scrollTo(0,0));
      await page.screenshot({path:path.join(dir,"management-"+section+"-"+theme+"-"+width+".png")});
     }
    }
   }
  }
  await host.locator('[data-management-section="actions"]').click();await host.locator('[data-management-source="overview"]').click();await query.fill("One");
  await page.evaluate(()=>{context="second";window.CWLClanManagementView.accessChanged("second")});
  assert.equal(await query.inputValue(),"");
  assert.equal(await host.locator("#clanManagementActionList .clan-management-person").count(),0);
  assert.equal(await host.locator("#clanRuleDays").inputValue(),"14");
  assert.equal(await host.locator("#clanRulesSave").isEnabled(),false);
  await page.evaluate(()=>{owner=false;window.CWLClanManagementView.accessChanged(null);window.CWLClanManagementView.open()});
  assert.equal(await host.isVisible(),false);
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});


test("Member workspace loads real metadata view, retains filters and decisions, isolates late clan responses",{timeout:120000},async()=>{
 const browser=await launch();
 try{
  const page=await browser.newPage({viewport:{width:390,height:900}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await setup(page);
  const moduleSource=fs.readFileSync(path.join(__dirname,"..","cwl-activity-member-view.mjs"),"utf8");
  const moduleUrl="data:text/javascript;base64,"+Buffer.from(moduleSource).toString("base64");
  const begin=html.indexOf("let activityMemberView=null"),end=html.indexOf(" let activityGoldpassView=null;",begin);
  assert.ok(begin>0&&end>begin);
  const bridge=html.slice(begin,end).replace("./cwl-activity-member-view.mjs?v=1.41.0",moduleUrl);
  await page.addScriptTag({content:bridge+String.raw`
   let memberSession=1,memberCalls=[],memberDelay=false,memberResolve=null;
   const tagLetters="0289PYLQGRJCUV";
   let memberRows=Array.from({length:50},(_,i)=>({tag:"#P"+tagLetters[Math.floor(i/13)]+tagLetters[i%13],name:i===0?"Sehr langer Spielername mit Sonderzeichen ★":i===1?"Main":"Spieler "+i,present:i<48,discord:i===0?null:i%3===0?true:false,primaryTag:null}));
   function activityGoldpassContext(){return owner?{owner:true,clanId:context,clanTag:"#2PYL",session:memberSession}:null}
   window.CWLCloud.activityMemberRequest=async req=>{
    memberCalls.push({action:req.action,player:req.player,context:req.context});
    if(memberDelay)return new Promise(resolve=>{memberResolve=resolve});
    const row=memberRows.find(x=>x.tag===req.player);
    if(req.action==="discord")row.discord=req.discord;
    if(req.action==="link"){if(row.primaryTag!==req.expectedPrimary)throw Error("revision");row.primaryTag=req.primary}
    return JSON.parse(JSON.stringify(memberRows));
   };
   window.CWLClanManagementView.open();
  `});
  const host=page.locator("#view-clan-management"),members=host.locator("#clanActivityMembersContent");
  await host.locator('[data-management-section="members"]').click();
  await members.locator(".activity-member-row").first().waitFor();
  assert.equal(await members.locator(".activity-member-row").count(),48);
  const search=members.getByRole("searchbox",{name:"Mitglied suchen"});
  await search.fill("#P00");
  assert.equal(await members.locator(".activity-member-row").count(),1);
  const row=members.locator(".activity-member-row").first();
  await row.getByLabel("Discord").selectOption("yes");
  await page.waitForFunction(()=>document.querySelector('#clanActivityMembersContent select[data-discord="confirmed"]')?.value==="yes");
  assert.equal(await search.inputValue(),"#P00");
  await row.locator("summary").click();
  await row.getByLabel("Hauptaccount").selectOption("#P02");
  await row.getByRole("button",{name:"Zuordnung speichern"}).click();
  await page.waitForFunction(()=>document.querySelector(".activity-member-row")?.textContent.includes("Zweitaccount von Main"));
  assert.equal(await row.locator("details").evaluate(n=>n.open),true);
  await search.fill("");
  await members.getByLabel("Anzeigen").selectOption("linked");
  assert.equal(await members.locator(".activity-member-row").count(),2);
  assert.equal(await members.locator('[data-player-tag="#P00"] details').evaluate(n=>n.open),true);
  const dir=process.env.CWL_UX_SCREENSHOTS;if(dir)fs.mkdirSync(dir,{recursive:true});
  for(const width of [320,390,430,1366,1440]){
   await page.setViewportSize({width,height:900});
   for(const theme of ["arena","dark","light","cyber","cyberlight"]){
    await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
    assert.ok(await host.evaluate(n=>n.scrollWidth<=n.clientWidth+3),JSON.stringify({width,theme}));
    const controls=await members.locator("input,select,button,summary").evaluateAll(nodes=>nodes.filter(n=>n.getClientRects().length).map(n=>n.getBoundingClientRect().height));
    assert.ok(controls.length>=5&&controls.every(h=>h>=43),JSON.stringify({width,theme,controls}));
    if(dir&&["arena","dark"].includes(theme)){
     await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(dir,"management-members-"+theme+"-"+width+".png")});
     await members.locator(".activity-member-row").first().evaluate(n=>n.scrollIntoView({block:"center"}));
     await page.screenshot({path:path.join(dir,"management-members-detail-"+theme+"-"+width+".png")});
    }
   }
  }
  await page.evaluate(()=>{memberDelay=true});
  await members.getByRole("button",{name:"Mitgliedsmerkmale neu laden"}).click();
  await page.waitForFunction(()=>typeof memberResolve==="function");
  await page.evaluate(()=>{context="second";memberSession++;window.CWLActivityMembers.accessChanged(activityGoldpassContext());window.CWLClanManagementView.accessChanged(context);memberResolve([{tag:"#P00",name:"Private old clan",present:true,discord:true,primaryTag:null}]);});
  assert.equal(await members.textContent(),"");
  assert.equal(await host.locator("#managementOverview").isVisible(),true);
  await page.evaluate(()=>{owner=false;window.CWLActivityMembers.accessChanged(null);window.CWLClanManagementView.accessChanged(null)});
  assert.equal(await host.isVisible(),false);
  assert.equal(await members.textContent(),"");
  assert.deepEqual(errors,[]);
 }finally{await browser.close()}
});
