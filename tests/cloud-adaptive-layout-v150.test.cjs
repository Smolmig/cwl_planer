"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const docs=fs.readFileSync(path.join(root,"docs/EXPERIMENTAL_ATTACK_STRENGTH_PLANNING.md"),"utf8");

test("Adaptive navigation shares actual view identities on desktop and mobile",()=>{
  for(const id of ["plan","members","summary","stats","more"])
    assert.match(html,new RegExp('class="navbtn[^"]*"[^>]*data-view="'+id+'"|id="statsNav" data-view="stats"'));
  assert.match(html,/id="view-more"/);
  assert.match(html,/data-more-action="archive"/);
  assert.match(html,/data-more-action="clan"/);
  assert.match(html,/data-more-action="rules"/);
  assert.match(html,/data-more-action="backup"/);
  assert.match(html,/@media\(min-width:1100px\)/);
  assert.match(html,/\.app\{max-width:none;width:calc\(100% - 228px\)/);
  assert.match(html,/\.bottomnav\{position:fixed;inset:0 auto 0 0;width:228px/);
  assert.match(html,/body\.cloud-mode \.navinner\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
test("Settings tiles target real panels without duplicating data forms",()=>{
  for(const id of ["settingsRulesSection","settingsAppearanceSection","settingsBackupSection","localProfileCard","archiveSection"])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/document\.querySelector\("\.more-menu"\)\.addEventListener\("click"/);
  assert.match(html,/showPlannerView\("settings"\)/);
});
test("Enter triggers existing login action, selecting text outside panel does not dismiss it",()=>{
 const a=sync.indexOf("let cloudBackdropStart=null;");
 const b=sync.indexOf('window.addEventListener("online"',a);
 assert.ok(a>0&&b>a);
 const ui=new JSDOM('<div id="cloudOverlay"><div id="cloudPanel"><section id="cloudAuth"><input id="cloudEmail"><input id="cloudPassword"><input id="cloudAuthName"><button id="cloudLogin">Anmelden</button></section><section id="inviteWelcomeAuthForm"><input id="inviteWelcomeEmail"><button id="inviteWelcomeAuthSubmit"></button></section></div></div>',{runScripts:"outside-only"});
 let closes=0,logins=0,inviteLogins=0;
 try{
  const w=ui.window,$=id=>w.document.getElementById(id);
  $("cloudLogin").addEventListener("click",()=>logins++);
  $("inviteWelcomeAuthSubmit").addEventListener("click",()=>inviteLogins++);
  const install=w.Function("$","close",sync.slice(a,b));
  install($,()=>closes++);
  $("cloudPassword").dispatchEvent(new w.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  assert.equal(logins,1);
  $("inviteWelcomeEmail").dispatchEvent(new w.KeyboardEvent("keydown",{key:"Enter",bubbles:true}));
  assert.equal(inviteLogins,1);
  const pointer=(target,type,props)=>{
   const event=new w.Event(type,{bubbles:true});
   for(const [key,val] of Object.entries(props))Object.defineProperty(event,key,{value:val});
   target.dispatchEvent(event);
  };
  pointer($("cloudEmail"),"pointerdown",{pointerId:1,clientX:100,clientY:100});
  pointer($("cloudOverlay"),"pointerup",{pointerId:1,clientX:130,clientY:200});
  assert.equal(closes,0,"dragging a selection out of the dialog must not close it");
  pointer($("cloudOverlay"),"pointerdown",{pointerId:2,clientX:50,clientY:50});
  pointer($("cloudOverlay"),"pointerup",{pointerId:2,clientX:52,clientY:52});
  assert.equal(closes,1,"intentional backdrop tap closes");
  pointer($("cloudOverlay"),"pointerdown",{pointerId:3,clientX:50,clientY:50});
  pointer($("cloudOverlay"),"pointerup",{pointerId:3,clientX:150,clientY:80});
  assert.equal(closes,1,"swipe on backdrop is not a tap");
 }finally{ui.window.close()}
});
test("Historical subjective bulk strength remains guest-only, actual stats unaffected",()=>{
  assert.match(html,/class="bulk-group bulk-strength-group"/);
  assert.match(html,/body\.cloud-mode \.bulk-strength-group\{display:none!important\}/);
  assert.match(html,/function memberTownHallMarkup\(m\)/);
  assert.match(html,/level_\x27\+th\+\x27\.webp/);
  assert.match(html,/memberTownHallMarkup\(m\)/);
});
test("Days expose played, next and future statuses while keeping mobile short labels",()=>{
  assert.match(html,/stateName=played\?"Gespielt":d===playedPrefixLength\(\)\?"Nächster":"Geplant"/);
  assert.match(html,/class="day-long-status"/);
  assert.match(html,/class="day-short-status"/);
});
test("Shield branding responds to theme accents; browser has new vector favicon",()=>{
  assert.match(html,/class="brand-lockup"/);
  assert.match(html,/class="brand-mark"/);
  assert.match(html,/href="\.\/brand-mark\.svg"/);
  assert.match(html,/html\[data-theme="arena"\] \.brand-mark\{color:#e7bf72\}/);
});
test("Strength-aware planner remains a simulation and preserves existing hard constraints",()=>{
  assert.match(docs,/standardmäßig aus|standardmäßig aus/i);
  assert.match(docs,/Fix\/MUSS\/RAUS/);
  assert.match(docs,/Bei vier bis sieben nur niedrige Konfidenz/);
  assert.match(docs,/Vor Anwenden/);
  assert.match(docs,/keine zusätzlichen Supabase-Änderungen/);
});
