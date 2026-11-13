"use strict";
// Exact-definition guard for a service-only collector trigger. No live writes.
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const original=fs.readFileSync(path.join(root,
 "supabase/migrations/20261110182000_cwl_clan_loyalty_evidence.sql"),"utf8");
const fixed=fs.readFileSync(path.join(root,
 "supabase/migrations/20261113230000_cwl_clan_loyalty_absence_greatest_fix.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,
 ".github/workflows/collector-loyalty-absence-sql-ci.yml"),"utf8");
function definition(sql){
 const a=sql.indexOf("FUNCTION public.cwl_capture_clan_loyalty_evidence()");
 const b=sql.indexOf("$loyalty$;",a);
 assert.ok(a>=0&&b>a,"loyalty function body not found");
 return sql.slice(a,b+"$loyalty$;".length).trim();
}
test("collector-loyalty fix changes exactly one qualified GREATEST, no tenant/role logic",()=>{
 const old=definition(original);
 const next=definition(fixed);
 assert.equal((old.match(/pg_catalog\.greatest\s*\(/gi)||[]).length,1);
 assert.equal(next,old.replace("pg_catalog.greatest(","GREATEST("));
 assert.doesNotMatch(next,/pg_catalog\.greatest/i);
 assert.match(next,/SECURITY INVOKER SET search_path = ''/i);
 assert.match(next,/current_user <> 'service_role'/);
 assert.match(next,/v_elapsed <= 10800/);
 assert.match(next,/NEW\.last_observed_at > OLD\.last_observed_at/);
 const outside=fixed.replace(/CREATE OR REPLACE FUNCTION public\.cwl_capture_clan_loyalty_evidence\(\)[\s\S]*?\$loyalty\$;/i,"")
  .replace(/^\s*--.*$/gm,"");
 assert.doesNotMatch(outside,/\b(?:DROP|TRUNCATE|GRANT|REVOKE|ALTER|INSERT|UPDATE|DELETE)\b/i);
});
test("real PG17 CI first reproduces SQLSTATE 42883, then verifies the exact new function",()=>{
 assert.match(workflow,/image: postgres:17/);
 assert.match(workflow,/tests\/sql\/cwl-loyalty-absence-fixture\.sql/);
 const order=[
  "20261110182000_cwl_clan_loyalty_evidence.sql",
  "tests/sql/cwl-loyalty-absence-before.sql",
  "20261113230000_cwl_clan_loyalty_absence_greatest_fix.sql",
  "tests/sql/cwl-loyalty-absence-after.sql"
 ];
 let previous=-1;
 for(const name of order){
  const at=workflow.indexOf(name);
  assert.ok(at>previous,"must reproduce bug before applying fix: "+name);
  previous=at;
 }
 assert.match(fs.readFileSync(path.join(root,
  "tests/sql/cwl-loyalty-absence-before.sql"),"utf8"),/WHEN undefined_function THEN/);
 assert.match(fs.readFileSync(path.join(root,
  "tests/sql/cwl-loyalty-absence-after.sql"),"utf8"),/max_streak_seconds<>1200/);
 assert.doesNotMatch(workflow,/SUPABASE_DB_URL|service_role.*secret|supabase db push|workflow_dispatch/i);
});
