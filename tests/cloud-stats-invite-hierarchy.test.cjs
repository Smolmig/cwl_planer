"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const file=name=>fs.readFileSync(path.join(root,name),"utf8");
const core=()=>import("../cwl-stats-core.mjs");

test("Combined statistics applies separate limits to normal CW and CWL seasons",async()=>{
 const {selectStatWars,computeWarStats}=await core();
 const cw=Array.from({length:10},(_,i)=>({war_key:"normal"+i,war_type:"normal",started_at:"2026-10-"+String(11+i).padStart(2,"0")+"T12:00:00Z",finalized:true}));
 const leagues=["2026-08","2026-09","2026-10"].flatMap((month,j)=>
  Array.from({length:7},(_,i)=>({war_key:"league"+j+"-"+i,war_type:"cwl",started_at:month+"-"+String(i+1).padStart(2,"0")+"T12:00:00Z",finalized:true})));
 const wars=[...cw,...leagues];
 for(const [normalCount,seasons,expected] of [[1,1,8],[2,1,9],[10,2,24],[5,3,26]]){
  const chosen=selectStatWars(wars,{type:"all",last:normalCount,cwlSeasons:seasons});
  assert.equal(chosen.length,expected);
  assert.equal(chosen.filter(w=>w.war_type==="normal").length,normalCount);
  assert.equal(computeWarStats(wars,[],{type:"all",last:normalCount,cwlSeasons:seasons}).wars,expected);
 }
 assert.equal(selectStatWars(wars,{type:"normal",last:2}).length,2);
 assert.equal(selectStatWars(wars,{type:"cwl",cwlSeasons:2}).length,14);
});

test("Stats controls are compact but individually selectable",()=>{
 const html=file("cloud-app.html"),ui=file("cwl-stats.mjs");
 assert.match(html,/id="statsPeriodConfig"/);
 assert.match(html,/id="statsPeriodSummary"/);
 assert.match(html,/id="statsRange"/);
 assert.match(html,/id="statsCwlRange"/);
 assert.match(html,/3★-Hit-Rate/);
 assert.match(html,/>Verpasst</);
 assert.match(ui,/type,last,cwlSeasons,sameHigher/);
 assert.match(ui,/id="statsCwlField"|statsCwlField/);
 assert.match(ui,/raw\.githubusercontent\.com\/ClashKingInc\/ClashKingAssets/);
 assert.match(ui,/onerror='this\.remove\(\)'/);
});

test("Account control fits without truncating the clan name",()=>{
 const html=file("cloud-app.html"),sync=file("cloud-sync.mjs");
 assert.match(html,/class="cloud-toggle-icon"/);
 assert.match(html,/\.topbar #cloudOpen\{max-width:none!important/);
 assert.doesNotMatch(sync,/label\.slice\(0,13\)/);
 assert.match(sync,/accountBtn\.title=this\.active\?label/);
});

test("Invitations have 24h, 7d, indefinite and a strict role hierarchy",()=>{
 const html=file("cloud-app.html"),sync=file("cloud-sync.mjs");
 const migrations=["20261101032315_cwl_reusable_invites_duration_controls.sql",
   "20261101032501_cwl_editor_viewer_hierarchy_invite_edit.sql",
   "20261101032623_cwl_block_removed_members_rejoin.sql"].map(x=>file("supabase/migrations/"+x));
 for(const v of ["24h","7d","never"])assert.ok(html.includes('value="'+v+'"'));
 for(const id of ["cloudInviteKind","cloudInviteRole","cloudBlockedList","cloudBlockedDetails"])assert.ok(html.includes('id="'+id+'"'));
 for(const fn of ["cwl_create_reusable_invite","cwl_update_reusable_invite","cwl_remove_clan_member","cwl_unblock_clan_member","cwl_redeem_reusable_invite"])
  assert.ok(sync.includes(fn),fn);
 assert.match(sync,/inv\.created_by===user\.id/);
 assert.match(sync,/role==="editor"&&m\.role==="viewer"/);
 assert.match(migrations[0],/p_duration not in \('24h','7d','never'\)/);
 assert.match(migrations[1],/v_blocked|v_invite\.created_by=v_user|v_invite\.created_by=v_user|v_invite\.created_by/);
 assert.match(migrations[2],/private\.cwl_prevent_blocked_membership/);
 assert.match(migrations[2],/v_target\.role<>'viewer'/);
 assert.match(migrations[2],/v_block\.blocked_by=v_actor/);
});

test("Registration keeps invitation, signup identity and auto-redemption",()=>{
 const html=file("cloud-app.html"),sync=file("cloud-sync.mjs");
 assert.match(html,/id="cloudAuthName"/);
 assert.match(sync,/localStorage\.getItem/);
 assert.match(sync,/emailRedirectTo:redirect\.href/);
 assert.match(sync,/await joinInvite\(\)/);
 assert.match(sync,/cwl_redeem_reusable_invite/);
 assert.match(html,/maxLength="24"|maxlength="24"/);
});
