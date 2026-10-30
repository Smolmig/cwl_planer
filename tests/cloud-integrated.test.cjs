"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {execFileSync}=require("node:child_process");
const {JSDOM,VirtualConsole}=require("jsdom");
const root=path.resolve(__dirname,"..");
const main=fs.readFileSync(path.join(root,"index.html"),"utf8");
const preview=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
const mod=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const fn=fs.readFileSync(path.join(root,"supabase/functions/coc-clan-members/index.ts"),"utf8");
const migration=fs.readFileSync(path.join(root,"supabase/migrations/20261029232620_cwl_shared_alpha_invitations_activity.sql"),"utf8");
test("Cloud alpha is a separate copy of the complete existing CWL planner",()=>{
  assert.match(main,/const APP_VERSION="v1\.0\.1";/);
  assert.match(preview,/const APP_VERSION="v1\.1\.0-alpha\.4";/);
  assert.match(preview,/const DATA_VERSION=9;/);
  assert.match(preview,/const STORAGE_KEY="cwl_planer_mobile_v9";/);
  for(const id of ["view-plan","view-members","view-summary","planDays","memberList","archiveList","cloudOverlay","cloudRosterDiff","cloudAudit","cloudInviteRole"]){
    assert.ok(preview.includes('id="'+id+'"'),id);
  }
  assert.match(preview,/if\(window\.CWLCloud\?\.active\)\{window\.CWLCloud\.onLocalChange\(\);return\}/);
  assert.match(preview,/location\.pathname\.endsWith\("\/cloud-app\.html"\)/);
  assert.match(preview,/cloud-sync\.mjs/);
});
test("Cloud frontend JS syntax and separation of browser secrets",()=>{
  assert.doesNotThrow(()=>execFileSync(process.execPath,["--check",path.join(root,"cloud-sync.mjs")]));
  assert.doesNotMatch(preview+mod,/sb_secret_|COC_API_KEY|SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(mod,/\.eq\("revision",expectedRevision\)/);
  assert.match(mod,/cloud\.active=true;role="viewer";hydrating=true/);
  assert.match(mod,/changedSerial/);
  assert.match(mod,/\.rpc\("cwl_create_short_invite"/);
  assert.match(mod,/\.rpc\("cwl_redeem_short_invite"/);
  assert.match(mod,/sb\.functions\.invoke\("coc-clan-members"/);
  assert.match(mod,/\.from\("cwl_change_events"\)/);
  assert.match(mod,/m\.participating=false/);
});
test("Member import is prominent and manual controls remain accessible",()=>{
 assert.match(preview,/id="cloudMembersSyncBtn"/);
 assert.match(preview,/id="cloudManualMembers"/);
 assert.match(preview,/id="cloudManualOne"/);
 assert.match(preview,/id="selectMembersBtn"/);
 assert.match(preview,/id="localProfileCard"/);
 assert.match(preview,/\.cloud-mode #memberList \.member-former/);
 assert.match(preview,/cloud-roster-flag/);
 assert.match(preview,/cocSyncState==="former"/);
 assert.match(mod,/m\.cocSyncState="new"/);
 assert.match(mod,/m\.cocSyncState="former"/);
 assert.match(mod,/delete member\.cocSyncState/);
 assert.match(mod,/m\.participating=false/);
 assert.match(mod,/\.eq\("revision",expectedRevision\)/);
 assert.match(mod,/role!=="viewer"/);
 assert.match(mod,/\.functions\.invoke\("coc-clan-members"/);
});
test("Alpha 3: guest UX, pencil editing, multi-select and initial import are safe",()=>{
 assert.match(preview,/id="guestMembersTools"/);
 assert.match(preview,/id="guestImportMembersBtn"/);
 assert.match(preview,/id="bulkDoneBtn"/);
 assert.match(preview,/value="coc-order"/);
 assert.match(preview,/member-name-edit/);
 assert.match(preview,/id="cloudHelpSection"/);
 assert.match(preview,/if\(day===mobileSelectedDay && uiSettings\.dayViewMode==="single"\)return/);
 assert.match(mod,/function installNameEditors\(\)/);
 assert.match(mod,/input\.readOnly=true/);
 assert.match(mod,/role==="viewer"\)continue/);
 assert.match(mod,/initialImport=existing\.length===0/);
 assert.match(mod,/if\(!rosterDiff\.initialImport\)m\.cocSyncState="new"/);
 assert.match(mod,/m\.cocOrder=i/);
 assert.match(mod,/toggle\("guestMembersTools",!this\.active\)/);
 assert.match(mod,/\.limit\(100\)/);
 assert.match(mod,/table:"cwl_change_events"/);
});

test("Alpha 4: real member pencils, consistent controls, clan roles, presence and refresh",()=>{
 assert.match(preview,/const APP_VERSION="v1\\.1\\.0-alpha\\.4"/);
 assert.match(preview,/class="member-name-edit"/);
 assert.match(preview,/placeholder="Name" readonly/);
 assert.match(preview,/id="cloudClanActions"/);
 assert.match(preview,/id="cloudLeaveBtn"/);
 assert.match(preview,/id="cloudDeleteBtn"/);
 assert.match(preview,/id="cloudActiveMembers"/);
 assert.match(preview,/id="cloudSyncFeedback"/);
 assert.match(preview,/id="autoUpdateStatus"/);
 assert.match(preview,/#view-members \\.list-management-actions\\{display:grid/);
 assert.match(mod,/function installNameEditors\\(/);
 assert.match(mod,/button\\.addEventListener\\("click"/);
 assert.match(mod,/input\\.readOnly=false/);
 assert.match(mod,/cwl_touch_presence/);
 assert.match(mod,/leaveSharedClan/);
 assert.match(mod,/deleteOwnedClan/);
 assert.match(mod,/\.eq\\("id",id\\)/);
 assert.match(mod,/\.from\\("cwl_clan_presence"\\)/);
 assert.match(mod,/new Date\\(\\)\\.toLocaleTimeString/);
 assert.match(mod,/checkForAppUpdate/);
});
test("CoC function never accepts attacker-supplied API URL/key/tag",()=>{
  assert.match(fn,/withSupabase\(\{auth:"user"\}/);
  assert.match(fn,/cocproxy\.royaleapi\.dev/);
  assert.match(fn,/\.eq\("clan_id",clanId\)/);
  assert.match(fn,/\.eq\("user_id",ctx\.userClaims\.id\)/);
  assert.doesNotMatch(fn,/userClaims\.sub/);
  assert.match(fn,/\.select\("clash_tag"\)/);
  assert.doesNotMatch(fn,/req\.body\.apiKey|body\.tag|body\.url/);
});
test("short codes and audit log are RLS-protected",()=>{
  assert.match(migration,/cwl_change_events enable row level security/);
  assert.match(migration,/cwl_change_events_members_read/);
  assert.match(migration,/grant select on public\.cwl_change_events to authenticated/);
  assert.match(migration,/cwl_create_short_invite/);
  assert.match(migration,/cwl_redeem_short_invite/);
  assert.match(migration,/short_code_hash/);
});
test("Guest experience boots with original planner structure",()=>{
 const dom=new JSDOM(preview,{runScripts:"dangerously",url:"https://smolmig.github.io/cwl_planer/cloud-app.html",
  virtualConsole:new VirtualConsole(),pretendToBeVisual:true,beforeParse(w){w.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=function(){};}});
 try{
  assert.equal(dom.window.document.querySelectorAll("#planDays").length,1);
  assert.equal(dom.window.document.querySelectorAll("#memberList").length,1);
  assert.equal(dom.window.document.querySelector("#kpiParticipants").textContent,"0");
  assert.ok(dom.window.CWLLegacy);
 }finally{dom.window.close()}
});
