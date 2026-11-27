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

test("private deployment grants default deny and explicit empty environment disables fallback",async()=>{const {autoGrantRecords,DEPLOYMENT_AUTO_GRANTS}=await import("../supabase/functions/coc-stats-collector/collector-strategic-config.mjs");assert.equal(DEPLOYMENT_AUTO_GRANTS,"");assert.equal(autoGrantRecords(undefined),"");assert.equal(autoGrantRecords(undefined,"synthetic-grants"),"synthetic-grants");assert.equal(autoGrantRecords("","synthetic-grants"),"");assert.equal(autoGrantRecords("invalid","synthetic-grants"),"invalid");});
