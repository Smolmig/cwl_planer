"use strict";
// Regression guard for the five *existing* privileged Cloud RPCs flagged by
// Supabase Security Advisor. STATIC CONTRACT, not proof of runtime RLS safety.
// No DB access, credentials, test accounts or live profile reads.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const reviewFile="supabase/migrations/20261111163500_cwl_review_cycle_cas_checked_rpc.sql";
const pauseFile="supabase/migrations/20261109192100_cwl_apply_verified_missed_pause_lock_order.sql";
const pauseGrantFile="supabase/migrations/20261109192000_cwl_apply_verified_missed_pause.sql";
const read=filename=>fs.readFileSync(path.join(root,filename),"utf8");
const cases=[
 {name:"cwl_apply_verified_missed_pause",file:pauseFile,grants:pauseGrantFile,
  role:"owner",owner:"p_clan",version:"stale_revision",
  checks:["v_profile.revision<>p_expected_revision","w.source='api'","m.missed_count>0"]},
 {name:"cwl_set_plan_lock_checked",file:reviewFile,role:"owner",
  owner:"p_clan",version:"stale_plan_cycle",checks:["p_expected_cycle","p_expected_season"]},
 {name:"cwl_resolve_plan_suggestion_checked",file:reviewFile,role:"owner",
  owner:"v_clan",version:"stale_plan_cycle",checks:["where id=p_suggestion","p_expected_cycle"]},
 {name:"cwl_submit_plan_suggestion_checked",file:reviewFile,role:"editor",
  scoped:"p_clan",version:"stale_plan_cycle",checks:["p_expected_cycle","p_expected_season"]},
 {name:"cwl_withdraw_plan_suggestion_checked",file:reviewFile,role:"editor",
  scoped:"v_clan",version:"stale_plan_cycle",checks:["where id=p_suggestion","p_expected_cycle"]}
];

function extract(sql,name){
 const head=new RegExp("\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+public\\."+name+"\\s*\\(","i");
 const start=sql.search(head);
 if(start<0)throw Error("Missing function "+name);
 const section=sql.slice(start),match=/\bas\s+(\$[A-Za-z_0-9]*\$)/i.exec(section);
 if(!match)throw Error("Missing quoted body for "+name);
 const end=section.indexOf(match[1]+";",match.index+match[0].length);
 if(end<0)throw Error("Missing function end for "+name);
 return section.slice(0,end+match[1].length+1);
}
function failures(def,spec,grants){
 const faults=[];
 const requireMatch=(pattern,label)=>
  {if(!pattern.test(def))faults.push(label)};
 requireMatch(/\bsecurity\s+definer\s+set\s+search_path\s*=\s*''/i,
  "fixed SECURITY DEFINER search_path");
 requireMatch(/(?:\(\s*select\s+)?auth\.uid\(\)\s*\)?\s+is\s+null\b/i,"signed-in guard");
 requireMatch(new RegExp("raise\\s+exception\\s+'"+
  (spec.role==="owner"?"owner_only":"editor_only")+
  "'\\s+using\\s+errcode\\s*=\\s*'42501'","i"),"permission error");
 if(spec.role==="owner"){
  requireMatch(new RegExp("private\\.cwl_is_owner\\s*\\(\\s*"+spec.owner+"\\s*\\)","i"),
   "tenant-scoped owner guard");
 }else{
  requireMatch(new RegExp("clan_id\\s*=\\s*"+spec.scoped+
   "\\s+and\\s+user_id\\s*=\\s*auth\\.uid\\(\\)\\s+and\\s+role\\s*=\\s*'editor'","i"),
   "tenant-scoped editor guard");
 }
 requireMatch(new RegExp(spec.version,"i"),"stale cycle/revision guard");
 for(const fragment of spec.checks)
  if(!def.includes(fragment))faults.push("identity/evidence check: "+fragment);
 const safeName=spec.name;
 if(!new RegExp("revoke\\s+all\\s+on\\s+function\\s+public\\."+safeName+
   "\\s*\\([^;]*\\)\\s+from\\s+public\\s*,\\s*anon\\s*;","i").test(grants))
  faults.push("PUBLIC/anon execution revoke");
 if(!new RegExp("grant\\s+execute\\s+on\\s+function\\s+public\\."+safeName+
   "\\s*\\([^;]*\\)\\s+to\\s+authenticated\\s*;","i").test(grants))
  faults.push("explicit authenticated-only grant");
 return faults;
}

test("all five privileged Cloud RPCs have explicit tenant-role, version and anonymous-call safeguards",()=>{
 for(const spec of cases){
  const definition=extract(read(spec.file),spec.name);
  const grantSql=read(spec.grants||spec.file);
  assert.deepEqual(failures(definition,spec,grantSql),[],spec.name);
 }
});

test("contract catches removed/mis-scoped owner, editor, session, GRANT and CAS checks",()=>{
 const owner=cases[1],editor=cases[3];
 const ownerDef=extract(read(owner.file),owner.name);
 const editorDef=extract(read(editor.file),editor.name);
 const grants=read(owner.file);
 function broken(def,spec,patch,sql=grants){
  const altered=patch(def);
  assert.notEqual(altered,def,"mutation did not affect source");
  assert.notEqual(failures(altered,spec,sql).length,0,
   "tampered "+spec.name+" passed security contract");
 }
 broken(ownerDef,owner,s=>s.replace("security definer","security invoker"));
 broken(ownerDef,owner,s=>s.replace("auth.uid() is null","false"));
 const pause=cases[0],pauseDef=extract(read(pause.file),pause.name);
 const unsafePause=pauseDef.replace("(select auth.uid()) is null","false");
 assert.notEqual(unsafePause,pauseDef,"pause-session mutation did not affect source");
 assert.ok(failures(unsafePause,pause,read(pause.grants)).includes("signed-in guard"),
  "Missed-pause RPC must reject missing (select auth.uid()) authorization");
 broken(ownerDef,owner,s=>s.replace("private.cwl_is_owner(p_clan)","true"));
 broken(ownerDef,owner,s=>s.replaceAll("stale_plan_cycle","ignored_cycle"));
 broken(editorDef,editor,s=>s.replace("role='editor'","role='viewer'"));
 broken(editorDef,editor,s=>s.replace("clan_id=p_clan","clan_id is not null"));
 const unsafeGrants=grants.replace(
  /revoke all on function public\.cwl_set_plan_lock_checked\([^;]*\) from public,anon;/i,"");
 assert.notEqual(unsafeGrants,grants);
 assert.ok(failures(ownerDef,owner,unsafeGrants).includes("PUBLIC/anon execution revoke"));
});
