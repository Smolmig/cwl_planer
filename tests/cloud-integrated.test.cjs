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
  assert.match(main,/const APP_VERSION="v1\.0\.2";/);
  assert.match(preview,/const APP_VERSION="v1\.1\.0-alpha\.9";/);
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
  assert.match(mod,/\.rpc\("cwl_redeem_named_invite"/);
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
 assert.ok(mod.includes('if(cloud.active&&role==="viewer")return;'));

 assert.match(mod,/initialImport=existing\.length===0/);
 assert.match(mod,/if\(!rosterDiff\.initialImport\)m\.cocSyncState="new"/);
 assert.match(mod,/m\.cocOrder=i/);
 assert.match(mod,/toggle\("guestMembersTools",!this\.active\)/);
 assert.match(mod,/\.limit\(100\)/);
 assert.match(mod,/table:"cwl_change_events"/);
});

test("Alpha 4: names, presence, clan management and reload feedback",()=>{
 const requiredHtml=[
  'const APP_VERSION="v1.1.0-alpha.9"',
  'class="member-name-edit"','placeholder="Name" readonly',
  'id="cloudClanActions"','id="cloudLeaveBtn"','id="cloudDeleteBtn"',
  'id="cloudActiveMembers"','id="cloudSyncFeedback"','id="autoUpdateStatus"',
  '#view-members .list-management-actions{display:grid'
 ];
 const requiredJs=[
  'function installNameEditors(','list.addEventListener("click"',
  'input.readOnly=false','cwl_touch_presence','leaveSharedClan','deleteOwnedClan',
  '.from("cwl_clan_presence")','checkForAppUpdate','refreshCloud()',
  'clanRoles=new Map'
 ];
 for(const fragment of requiredHtml)assert.ok(preview.includes(fragment),"Missing HTML fragment: "+fragment);
 for(const fragment of requiredJs)assert.ok(mod.includes(fragment),"Missing JS fragment: "+fragment);
});
test("Alpha 5: realtime reconcile, clear collaborator toast, archive removal and last release notes",()=>{
  assert.match(preview,/const APP_VERSION="v1\.1\.0-alpha\.9";/);
  assert.match(preview,/id="cloudChangeNotice"/);
  assert.match(preview,/id="cloudChangeDetails"/);
  assert.match(preview,/id="cloudChangeDismiss"/);
  assert.match(preview,/id="latestChangelog"/);
  assert.match(preview,/class="btn small danger delete-archive"/);
  assert.match(preview,/title:"Archiv wirklich löschen\?"/);
  assert.match(preview,/state\.archives=state\.archives\.filter/);
  assert.match(mod,/function checkRemoteChanges\(reason=/);
  assert.match(mod,/checkRemoteChanges\("realtime"\)/);
  assert.match(mod,/checkRemoteChanges\("interval"\)/);
  assert.match(mod,/function showChangeToast/);
  assert.match(mod,/remoteChangeMessage/);
  assert.match(mod,/\.select\("revision"\)/);
  assert.match(mod,/\.gt\("revision",oldRevision\)/);
  assert.match(mod,/\.from\("cwl_cloud_profiles"\)/);
  assert.match(mod,/function installPendingRelease/);
  assert.match(mod,/location\.replace\(next\.toString\(\)\)/);
  assert.match(mod,/window\.addEventListener\("pageshow"/);
  assert.match(mod,/document\.addEventListener\("pointerdown"/);
  const meta=JSON.parse(fs.readFileSync(path.join(root,"cloud-version.json"),"utf8"));
  assert.equal(meta.version,"v1.1.0-alpha.9");
});
test("Alpha 6: accepted membership roster, named invite and safe departed-lineup decisions",()=>{
 for(const id of ["cloudAccessList","cloudAccessCount","cloudAccessRefresh","cloudJoinName","cloudDepartedWarnings"])
   assert.ok(preview.includes('id="'+id+'"'),"Missing "+id);
 assert.doesNotMatch(preview,/id="cloudPauseDeparted"/);
 assert.match(mod,/async function loadAccessList/);
 assert.match(mod,/role==="owner"\|\|role==="editor"/);
 assert.match(mod,/\.rpc\("cwl_redeem_named_invite",\{p_code:code,p_name:name\}\)/);
 assert.match(mod,/storage\.toast\("✓ Einladungslink kopiert"\)/);
 assert.match(mod,/storage\.getPlannedLineups\(\)/);
 assert.match(mod,/cloud-missing-choice/);
 assert.match(mod,/Vorerst nichts ändern/);
 assert.match(mod,/Weiterhin als Dabei bestätigen/);
 assert.match(mod,/protectedIds\.has\(m\.id\)/);
 assert.match(mod,/if\(decisions\.get\(m\.id\)==="keep"\)/);
 assert.match(mod,/m\.cocSyncState="kept"/);
 assert.match(preview,/getPlannedLineups:\(\)=>lastPlan\?\.dayPlans/);
 const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261030015542_cwl_vize_invites_named_join.sql"),"utf8");
 assert.match(sql,/role in \('owner','editor'\)/);
 assert.match(sql,/display_name\)/);
 assert.match(sql,/cwl_redeem_named_invite/);
 assert.match(sql,/revoke execute on function public\.cwl_redeem_short_invite/);
});
test("Alpha 7: access controls, inline roster and accessible feedback",()=>{
 for(const id of ["cloudPendingList","cloudPendingCount","cloudPendingDetails",
  "cloudForgotPassword","cloudRecovery","cloudNewPassword","cloudConfirmPassword",
  "cloudResetSent","cloudRosterStatus","cloudAccessList"])
  assert.ok(preview.includes('id="'+id+'"'),"Missing "+id);
 assert.match(preview,/const APP_VERSION="v1\.1\.0-alpha\.9"/);
 assert.match(preview,/id="selectMembersBtn" type="button" aria-pressed="false"/);
 assert.match(preview,/id="selectAllBtn">Alle angezeigten auswählen/);
 assert.match(preview,/class="switch member-part"/);
 assert.match(preview,/id="latestChangelog"/);
 assert.match(preview,/role="status"/);
 assert.match(mod,/function loadAccessList/);
 assert.match(mod,/async function changeAccessRole/);
 assert.match(mod,/async function removeAccessMember/);
 assert.match(mod,/async function revokeInvite/);
 assert.match(mod,/\.update\(\{role:next\}\)/);
 assert.match(mod,/\.eq\("user_id",m\.user_id\)/);
 assert.match(mod,/\.from\("cwl_clan_invites"\)\.delete/);
 assert.match(mod,/async function sendPasswordReset/);
 assert.match(mod,/resetPasswordForEmail/);
 assert.match(mod,/async function completeRecovery/);
 assert.match(mod,/PASSWORD_RECOVERY/);
 assert.match(mod,/updateUser\(\{password:first\}\)/);
 assert.match(mod,/toggle\("cloudRosterBox",true\)/);
 const manifest=JSON.parse(fs.readFileSync(path.join(root,"cloud-version.json"),"utf8"));
 assert.equal(manifest.version,"v1.1.0-alpha.9");
});
test("Alpha 8: name pencil continues working after list re-render",()=>{
 const start=mod.indexOf("function installNameEditors(){");
 const end=mod.indexOf("function status(value,isError=false)",start);
 assert.ok(start>=0&&end>start);
 const source=mod.slice(start,end);
 const dom=new JSDOM('<div id="memberList"></div>',{pretendToBeVisual:true});
 const render=()=>{dom.window.document.querySelector("#memberList").innerHTML=
  '<div class="member" data-id="p1"><div class="name-wrap"><input class="member-name" readonly value="Test"><button type="button" class="member-name-edit">✎</button></div></div>'};
 try{
  const maker=new dom.window.Function("$","cloud","role","storage",source+";return installNameEditors;");
  const init=maker(id=>dom.window.document.getElementById(id),{active:true},"owner",
   {getProfile:()=>({members:[{id:"p1",name:"Test"}]})});
  render();init();
  let input=dom.window.document.querySelector(".member-name");
  dom.window.document.querySelector(".member-name-edit").click();
  assert.equal(input.readOnly,false,"first pencil click unlocks name");
  input.blur();assert.equal(input.readOnly,true,"blur returns to readonly");
  render();init(); // like a search/filter change, the list DOM was replaced
  input=dom.window.document.querySelector(".member-name");
  dom.window.document.querySelector(".member-name-edit").click();
  assert.equal(input.readOnly,false,"pencil still works after a list refresh");
 }finally{dom.window.close()}
});
test("Alpha 8: invitation summary and password reset are single-purpose panels",()=>{
 assert.equal((preview.match(/id="cloudPendingDetails"/g)||[]).length,1);
 const access=preview.indexOf('id="cloudAccessList"');
 const pending=preview.indexOf('id="cloudPendingDetails"');
 const invite=preview.indexOf('id="cloudInviteBox"');
 assert.ok(access<pending&&pending<invite,"pending invites live with access list, not invite form");
 assert.doesNotMatch(preview,/id="cloudInviteStats"/);
 for(const id of ["cloudForgotRequest","cloudRecoveryEmail","cloudSendReset","cloudBackToLogin"])
  assert.ok(preview.includes('id="'+id+'"'),id);
 assert.ok(mod.includes('const email=$("cloudRecoveryEmail").value.trim()'));
 assert.ok(mod.includes('list.dataset.editorDelegated="1"'));
 assert.ok(preview.includes("body:not(.cloud-mode) .topbar .profilebar"));
 const meta=JSON.parse(fs.readFileSync(path.join(root,"cloud-version.json"),"utf8"));
 assert.equal(meta.version,"v1.1.0-alpha.9");
});
test("Backup v1: automatic checkpoints, secure owner restore and offsite encryption",()=>{
 const backup=fs.readFileSync(path.join(root,"cloud-backups.mjs"),"utf8");
 const backupAction=fs.readFileSync(path.join(root,".github/workflows/encrypted-backup.yml"),"utf8");
 const snapshotMigration=fs.readFileSync(path.join(root,"supabase/migrations/20261030100706_cwl_profile_snapshots_recovery.sql"),"utf8");
 const wrapperMigration=fs.readFileSync(path.join(root,"supabase/migrations/20261030100737_cwl_restore_snapshot_secure_wrapper.sql"),"utf8");
 assert.doesNotThrow(()=>execFileSync(process.execPath,["--check",path.join(root,"cloud-backups.mjs")]));
 for(const id of ["cloudBackupPanel","cloudLoadSnapshots","cloudSnapshotSelect","cloudDownloadSnapshot","cloudRestoreSnapshot","cloudBackupStatus"])
  assert.ok(preview.includes('id="'+id+'"'),"Missing backup control: "+id);
 assert.match(mod,/createCloudBackups/);
 assert.match(mod,/backups\.reset\(\)/);
 assert.match(mod,/backups\.restore\(\)/);
 assert.match(backup,/\.from\("cwl_profile_snapshots"\)/);
 assert.match(backup,/\.rpc\("cwl_restore_profile_snapshot"/);
 assert.match(backup,/p_expected_revision:revision/);
 assert.match(backup,/role!=="owner"/);
 assert.match(backup,/kind:"cwl-profile"/);
 assert.match(snapshotMigration,/enable row level security/);
 assert.match(snapshotMigration,/private\.cwl_is_member\(clan_id\)/);
 assert.match(snapshotMigration,/role='owner'/);
 assert.match(snapshotMigration,/offset 24/);
 assert.match(wrapperMigration,/security definer/);
 assert.match(backupAction,/schedule:/);
 assert.match(backupAction,/supabase db dump/);
 assert.match(backupAction,/--schema auth --data-only/);
 assert.match(backupAction,/--symmetric --cipher-algo AES256/);
 assert.match(backupAction,/passphrase-fd 0/);
 assert.match(backupAction,/retention-days: 30/);
 assert.doesNotMatch(preview+mod+backup,/CWL_BACKUP_PASSPHRASE|SUPABASE_DB_URL/);
});
test("Stable and cloud saves reduce localStorage writes and preserve planner results",()=>{
 for(const content of [main,preview]){
  assert.match(content,/function saveApp()/);
  assert.match(content,/if\(before===lastLocalSavedJson\)return/);
  assert.match(content,/lastLocalRecoveryAt>=15\*60\*1000/);
  assert.match(content,/const memberOrder=new Map\(state\.members\.map/);
  assert.match(content,/memberOrder\.get\(a\.id\)/);
 }
 const worker=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
 assert.match(worker,/cwl-planer-v1-0-2/);
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
