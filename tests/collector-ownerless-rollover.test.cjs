"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=path.resolve(__dirname,"..");
const moduleFile=path.join(root,"supabase/functions/coc-stats-collector/collector-ownerless-rollover.mjs");
const load=()=>import(pathToFileURL(moduleFile).href);
const collector=fs.readFileSync(path.join(root,"supabase/functions/coc-stats-collector/index.ts"),"utf8");
const ownerless=fs.readFileSync(moduleFile,"utf8");
const sql=fs.readFileSync(path.join(root,"scripts/DRAFT_cwl_ownerless_atomic_rollover.sql"),"utf8");
const season="2026-12",sourceSeason="2026-11";
const tenantA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const tenantB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const cycleA="11111111-1111-4111-8111-111111111111";
const cycleB="33333333-3333-4333-8333-333333333333";
const tagA="#2PYL";
const tags=["#2PYL","#2PYQ","#2PYR","#2PYG","#2PYC","#2PYV","#2PY0","#2PY9"];
const observation=(overrides={})=>({
 season,clan_tag:tagA,group_tags:tags,war_count:7,rounds_count:0,
 group_state:"preparation",...overrides
});
const preflight=(overrides={})=>({
 candidate:true,reason:"atomic_archive_and_cycle_transaction_required",
 source_season:sourceSeason,target_season:season,source_cycle_id:cycleA,
 source_revision:20,source_war_count:7,target_war_count:7,
 source_locked_clash_days:6,source_unconfirmed_days:1,
 source_archive_exists:false,...overrides
});
const result=(overrides={})=>({
 applied:true,created:true,reason:"atomic_rollover_applied",
 source_season:sourceSeason,target_season:season,source_cycle_id:cycleA,
 target_cycle_id:cycleB,source_revision:20,target_revision:21,
 source_played_days:6,source_unconfirmed_days:1,...overrides
});
const settings={url:"https://fake-project.supabase.co",key:"synthetic-service-key"};
const fakeResponse=data=>({ok:true,json:async()=>data});
const policy=(mode="apply",ids=tenantA)=>({mode,allowlist:new Set(ids.split(",").filter(Boolean))});
function harness({mode="apply",ids=tenantA,observed=observation(),
  source=preflight(),commit=result(),now=1000,deadline=100000,
  persisted=true,httpOk=true,failAt=null}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  const endpoint=url.split("/").pop();
  const args=JSON.parse(options.body);
  calls.push({endpoint,args,options});
  if(failAt===endpoint)throw Error("secret-tenant-tag-should-not-leak");
  if(!httpOk)return {ok:false};
  return fakeResponse(endpoint==="cwl_ownerless_cycle_preflight"?source:commit);
 };
 const run=async(clanId=tenantA)=>(
  await (await load()).attemptOwnerlessRollover({
   policy:policy(mode,ids),settings,clanId,linkedTag:tagA,
   observation:observed,evidenceSaved:persisted,now:()=>now,
   deadline,fetcher
  }));
 return {run,calls};
}

test("disabled by default, unknown modes and empty/invalid apply allowlists never grant write",async()=>{
 const {ownerlessRolloverPolicy:configure}=await load();
 for(const value of [undefined,null,"true","enabled","APPLY","apply-now",""]){
  assert.equal(configure(value,tenantA).mode,"off");
 }
 assert.equal(configure("apply",undefined).mode,"off");
 assert.equal(configure("apply","").mode,"off");
 assert.equal(configure("apply","invalid").mode,"off");
 assert.equal(configure("apply",tenantA+",invalid").mode,"off");
 assert.equal(configure("apply","x".repeat(1801)).mode,"off");
 assert.equal(configure("apply",Array(26).fill(tenantA).join(",")).mode,"off");
 assert.deepEqual([...configure("apply",tenantA.toUpperCase()).allowlist],[tenantA]);
 assert.equal(configure("observe",tenantA).mode,"observe");
 const f=harness({mode:"off"});
 assert.deepEqual(await f.run(),{status:"off"});
 assert.equal(f.calls.length,0);
});

test("no saved evidence, foreign tag, malformed group and unauthorized app tenant never cause RPC",async()=>{
 const t=harness({persisted:false});
 assert.deepEqual(await t.run(),{status:"no_evidence"});
 assert.equal(t.calls.length,0);
 for(const obs of [
  observation({season:"2026-13"}),observation({clan_tag:"#2PYQ"}),
  observation({group_tags:tags.slice(0,7)}),
  observation({group_tags:tags.map(()=>"#2PYL")}),
  observation({war_count:5})
 ]){
  const f=harness({observed:obs});
  assert.deepEqual(await f.run(),{status:"no_evidence"});
  assert.equal(f.calls.length,0);
 }
 const b=harness();
 assert.deepEqual(await b.run(tenantB),{status:"not_allowed"});
 assert.equal(b.calls.length,0);
});

test("deadline budget fail-closed, before BOTH preflight and committing",async()=>{
 const early=harness({deadline:11000});
 assert.deepEqual(await early.run(),{status:"time_budget"});
 assert.equal(early.calls.length,0);
 const {attemptOwnerlessRollover}=await load();
 let clock=1000;
 const late=harness();
 const fetcher=async()=>{
  clock=95000;
  return fakeResponse(preflight());
 };
 assert.deepEqual(await attemptOwnerlessRollover({
  policy:policy(),settings,clanId:tenantA,linkedTag:tagA,
  observation:observation(),evidenceSaved:true,deadline:100000,
  now:()=>clock,fetcher
 }),{status:"time_budget"});
 assert.equal(late.calls.length,0);
});

test("no candidate means no mutation; never infer eligibility from group or wall clock",async()=>{
 const f=harness({source:{candidate:false,reason:"no_new_verified_season"}});
 assert.deepEqual(await f.run(),{status:"not_candidate"});
 assert.deepEqual(f.calls.map(c=>c.endpoint),["cwl_ownerless_cycle_preflight"]);
});

test("observe mode performs exactly one read-only preflight even if valid candidate",async()=>{
 const f=harness({mode:"observe"});
 assert.deepEqual(await f.run(),{status:"candidate"});
 assert.deepEqual(f.calls.map(c=>c.endpoint),["cwl_ownerless_cycle_preflight"]);
 assert.deepEqual(f.calls[0].args,{p_clan:tenantA});
});

test("invalid preflight target, cycle, revision or played-day proof blocks commit",async()=>{
 for(const override of [
  {target_season:"2027-01"},
  {source_season:"2026-12"},
  {source_cycle_id:"not-uuid"},
  {source_revision:Number.MAX_SAFE_INTEGER+1},
  {source_revision:0},
  {target_war_count:5},
  {source_unconfirmed_days:0},
  {source_locked_clash_days:9},
  {source_archive_exists:"no"}
 ]){
  const f=harness({source:preflight(override)});
  await assert.rejects(f.run(),/ownerless_preflight_integrity_conflict/);
  assert.deepEqual(f.calls.map(c=>c.endpoint),["cwl_ownerless_cycle_preflight"]);
 }
});

test("apply mode only sends CAS expectations from fresh verified preflight, never profile JSON",async()=>{
 const f=harness();
 assert.deepEqual(await f.run(),{status:"applied"});
 assert.deepEqual(f.calls.map(c=>c.endpoint),[
  "cwl_ownerless_cycle_preflight","cwl_ownerless_atomic_rollover"
 ]);
 const post=f.calls[1];
 assert.deepEqual(post.args,{
  p_clan:tenantA,p_expected_cycle:cycleA,
  p_expected_revision:20,p_target_season:season
 });
 assert.equal(post.options.method,"POST");
 assert.equal(post.options.headers.Authorization,"Bearer "+settings.key);
 assert.equal(post.options.headers.apikey,settings.key);
 assert.ok(!JSON.stringify(post.args).includes("cwlLive"));
 assert.ok(!JSON.stringify(post.args).includes("player"));
 assert.ok(!JSON.stringify(post.args).includes("rounds"));
 assert.ok(!JSON.stringify(post.args).includes("warTag"));
 assert.ok(!JSON.stringify(post.args).includes("source_profile"));
 assert.ok(!Object.hasOwn(post.args,"p_profile"));
});

test("duplicate scheduled invocation accepts already-applied without another reset signal",async()=>{
 const f=harness({commit:result({
  created:false,reason:"already_applied",
  source_season:undefined,source_revision:undefined,target_revision:undefined,
  source_played_days:undefined,source_unconfirmed_days:undefined
 })});
 assert.deepEqual(await f.run(),{status:"already_applied"});
 assert.equal(f.calls.length,2);
});

test("database CAS refusal is a harmless skip; mismatched writer result is a hard error",async()=>{
 const declined=harness({commit:{applied:false,reason:"stale_cycle"}});
 assert.deepEqual(await declined.run(),{status:"not_candidate"});
 for(const override of [
  {target_season:"2027-01"},{target_cycle_id:cycleA},
  {target_cycle_id:"missing"},{source_revision:19},
  {target_revision:22},{source_unconfirmed_days:0},
  {created:false,reason:"pretend_complete"},
  {applied:true,created:undefined}
 ]){
  const f=harness({commit:result(override)});
  await assert.rejects(f.run(),/ownerless_transition_integrity_conflict/);
 }
});

test("failed/malformed service RPC is never silently promoted to success, secrets never leak",async()=>{
 for(const params of [{failAt:"cwl_ownerless_cycle_preflight"},
                      {failAt:"cwl_ownerless_atomic_rollover"},
                      {httpOk:false},{source:["not", "an", "object"]}]){
  const f=harness(params);
  await assert.rejects(f.run(),e=>{
   assert.match(e.message,/^ownerless_(rpc_unavailable|rpc_invalid_result)$/);
   assert.doesNotMatch(e.message,/secret-tenant|synthetic-service-key/);
   return true;
  });
 }
});

test("same Clash tag but separate app clans need independently allowed UUID",async()=>{
 const a=harness({ids:tenantA});
 assert.deepEqual(await a.run(tenantB),{status:"not_allowed"});
 const b=harness({ids:tenantB,source:preflight({source_cycle_id:cycleB}) ,
  commit:result({source_cycle_id:cycleB,target_cycle_id:cycleA})});
 assert.deepEqual(await b.run(tenantB),{status:"applied"});
 assert.deepEqual(b.calls[0].args,{p_clan:tenantB});
 assert.equal(b.calls[1].args.p_clan,tenantB);
});

test("collector authentication happens BEFORE policy and per-tenant commit happens only AFTER persisted evidence",()=>{
 const auth=collector.indexOf('if(hasCronHeaders(request)){');
 const policyPos=collector.indexOf('const policy=ownerlessRolloverPolicy(');
 const persist=collector.indexOf('await upsert(settings,"cwl_verified_league_observations"');
 const saved=collector.indexOf('evidenceSaved=true;');
 const call=collector.indexOf('const outcome=await attemptOwnerlessRollover(');
 assert.ok(auth>=0&&policyPos>auth&&persist>policyPos&&saved>persist&&call>saved);
 assert.match(collector,/if\(policy\.mode!=="off"&&evidenceSaved\)\{/);
 assert.match(collector,/CWL_OWNERLESS_ROLLOVER_MODE/);
 assert.match(collector,/CWL_OWNERLESS_ROLLOVER_CLAN_IDS/);
 assert.match(collector,/seasonObservationsSaved\+\+/);
 assert.doesNotMatch(ownerless,/req\.headers|get\("authorization"\)|user_metadata|p_profile:/i);
 assert.match(ownerless,/p_expected_cycle:preflight\.source_cycle_id/);
 assert.match(ownerless,/p_expected_revision:preflight\.source_revision/);
 assert.match(ownerless,/p_target_season:preflight\.target_season/);
 assert.match(sql,/security invoker/);
 assert.match(sql,/grant execute on function public\.cwl_ownerless_atomic_rollover\(uuid,uuid,bigint,text\)\s+to service_role/);
});
