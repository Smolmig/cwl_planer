"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("strategic SQL source has exactly one publish body and intact tag regexes",()=>{
 const sql=read("supabase/experimental/strategic-assignment.sql");
 assert.equal((sql.match(/insert into public\.cwl_strategic_assignments as a/g)||[]).length,1);
 assert.equal((sql.match(/\{3,15\}\$'/g)||[]).length,3);
 assert.equal((sql.match(/\$fn\$/g)||[]).length,2);
 assert.equal((sql.match(/\$claim\$/g)||[]).length,2);
});
test("pending recompute only after verified internal cron; no caller target or archive write",()=>{
 const s=read("supabase/functions/coc-stats-collector/index.ts");
 assert.ok(s.indexOf("if(!await verifyIndependentCron(request,settings))")<s.indexOf("if(body?.strategicPending===true)return runPendingStrategic(settings)"));
 const f=s.slice(s.indexOf("async function runPendingStrategic"),s.indexOf("export default"));
 assert.match(f,/claimPendingStrategic/);assert.match(f,/context.saved.revision!==pending.revision/);assert.match(f,/null,true,true/);
 assert.doesNotMatch(f,/archiveForAppClan|rollSeasonForAppClan|request\.json/);
 const sql=read("supabase/experimental/strategic-assignment.sql");
 assert.match(sql,/q.claimed_at<clock_timestamp\(\)-interval '5 minutes'/);
 assert.match(sql,/grant execute on function public.cwl_claim_strategic_recompute\(jsonb\) to service_role/);
});

test("appwide server flags have explicit global off and invalid fail closed",async()=>{
 const {automaticEnabled}=await import("../supabase/functions/coc-stats-collector/collector-strategic-config.mjs"),{betaEnabled}=await import("../supabase/functions/coc-cwl-strategy-beta/beta-config.mjs");
 for(const check of [automaticEnabled,betaEnabled]){assert.equal(check(undefined),true);assert.equal(check("true"),true);for(const value of ["false","",null,"*","invalid"])assert.equal(check(value),false)}
});
test("appwide queue is service-only, fair and opt-in; no client-selected target",()=>{
 const sql=read("supabase/experimental/strategic-appwide-queue.sql"),runner=read("supabase/functions/coc-stats-collector/collector-strategic-runner.mjs");
 assert.match(sql,/cwl_claim_strategic_recompute_appwide\(\)/);assert.match(sql,/pg_try_advisory_xact_lock/);assert.match(sql,/order by q.claimed_at nulls first,p.updated_at,c.id limit 1/);
 assert.match(sql,/m.user_id=c.owner_user_id and m.role='owner'/);assert.match(sql,/strategicAuto/);
 assert.match(sql,/grant execute on function public.cwl_claim_strategic_recompute_appwide\(\) to service_role/);
 assert.doesNotMatch(sql,/p_grants/);assert.match(runner,/rpc\/cwl_claim_strategic_recompute_appwide/);
});
