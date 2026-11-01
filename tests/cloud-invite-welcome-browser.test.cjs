"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {JSDOM}=require("jsdom");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const sync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261101145612_cwl_invitation_link_preview.sql"),"utf8");
const hardening=fs.readFileSync(path.join(root,"supabase/migrations/20261101150323_cwl_secure_private_invite_preview.sql"),"utf8");

test("Invitation links have a first-class accessible modal, not an auto-scrolling account section",()=>{
 const dom=new JSDOM(html);
 const doc=dom.window.document;
 const modal=doc.getElementById("inviteWelcome");
 assert.ok(modal);
 assert.equal(modal.getAttribute("role"),"dialog");
 assert.equal(modal.getAttribute("aria-modal"),"true");
 for(const id of ["inviteWelcomeTitle","inviteWelcomeRole","inviteWelcomeName","inviteWelcomeJoin",
  "inviteWelcomeGuest","inviteWelcomeLoginChoice","inviteWelcomeSignupChoice",
  "inviteWelcomeAuthForm","inviteWelcomeEmail","inviteWelcomePassword","inviteWelcomeAuthSubmit",
  "inviteWelcomeClose","inviteWelcomeError"])
  assert.ok(modal.querySelector("#"+id),"Missing invitation control: "+id);
 assert.ok(modal.querySelector("#inviteWelcomeJoin").textContent.includes("Beitreten"));
 assert.match(sync,/showInviteDialog\(resumedInvite\)/);
 assert.match(sync,/await showInviteDialog\(code\)/);
 assert.doesNotMatch(sync,/Einladung erkannt: Bitte noch deinen Ingame-Namen eintragen/);
 dom.window.close();
});

test("Invite link can show plan name and role before login without exposing private roster",()=>{
 assert.match(sync,/cwl_preview_invite/);
 assert.match(migration,/create function public\.cwl_preview_invite/);
 assert.match(migration,/join public\.cwl_clans/);
 assert.match(migration,/i\.short_code_hash/);
 assert.match(migration,/i\.used_at is null/);
 assert.match(migration,/i\.expires_at is null or i\.expires_at>now\(\)/);
 assert.match(migration,/grant execute on function public\.cwl_preview_invite\(text\) to anon,authenticated/);
 assert.doesNotMatch(migration,/select .*display_name/);
 assert.match(hardening,/create function private\.cwl_preview_invite/);
 assert.match(hardening,/language sql security invoker/);
 assert.match(hardening,/grant execute on function private\.cwl_preview_invite\(text\) to anon,authenticated/);
});
test("Sign-in and email confirmation retain the invitation without automatically joining",()=>{
 assert.match(sync,/saveInvite\(INVITE_TOKEN_KEY,invite\)/);
 assert.match(sync,/emailRedirectTo:redirect\.href/);
 assert.match(sync,/if\(code\)\{\s*close\(\);\s*await showInviteDialog\(code\);/);
 assert.match(sync,/async function confirmInviteJoin\(\)/);
 assert.match(sync,/await joinInvite\(\)/);
 assert.match(sync,/closeInviteDialog\(\)/);
 assert.match(sync,/if\(!pendingInviteCode\(\)\)open\(\)/);
});
test("Invitation sheet remains visible and fits common iPhone widths",async()=>{
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 try{
  const staticHtml=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,"").replace(/<link\b[^>]*>/gi,"");
  for(const width of [320,375,390,430]){
   const page=await browser.newPage({viewport:{width,height:800}});
   try{
    await page.setContent(staticHtml,{waitUntil:"domcontentloaded"});
    await page.evaluate(()=>{
     const modal=document.getElementById("inviteWelcome");
     modal.classList.add("open");
     modal.setAttribute("aria-hidden","false");
     document.getElementById("inviteWelcomeActions").hidden=false;
     document.getElementById("inviteWelcomeSigned").hidden=false;
     document.getElementById("inviteWelcomeTitle").textContent="United Fighters";
    });
    const dims=await page.evaluate(()=>{
     const panel=document.querySelector(".invite-welcome-panel").getBoundingClientRect();
     const overlay=document.getElementById("inviteWelcome");
     return {left:panel.left,right:panel.right,top:panel.top,visible:getComputedStyle(overlay).display!=="none",
      width:document.documentElement.scrollWidth};
    });
    assert.ok(dims.visible,"Welcome modal should display at "+width);
    assert.ok(dims.left>=-1&&dims.right<=width+1,JSON.stringify(dims));
    assert.ok(dims.width<=width+2,"Horizontal overflow "+JSON.stringify(dims));
   }finally{await page.close()}
  }
 }finally{await browser.close()}
});
