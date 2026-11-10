"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("Twice-hourly off-peak schedule uses the same exact, signed OIDC workflow",()=>{
 const workflow=read(".github/workflows/collect-war-stats.yml");
 assert.match(workflow,/cron: '17,47 \* \* \* \*'/);
 assert.match(workflow,/workflow_dispatch:/);
 assert.match(workflow,/paths:\s*\n\s+- '\.github\/workflows\/collect-war-stats\.yml'/);
 assert.match(workflow,/id-token: write/);
 assert.match(workflow,/verifyCollectorIdentity/);
 assert.match(workflow,/ACTIONS_ID_TOKEN_REQUEST_TOKEN/);
 assert.match(workflow,/concurrency:\s*\n\s+group: cwl-clash-stats-collector\s*\n\s+cancel-in-progress: false/);
 assert.doesNotMatch(workflow,/SUPABASE_SERVICE_ROLE_KEY|COC_API_KEY|sb_secret_/);
 const auth=read("supabase/functions/coc-stats-collector/collector-auth.mjs");
 assert.match(auth,/workflowRef:"Smolmig\/cwl_planer\/\.github\/workflows\/collect-war-stats\.yml@refs\/heads\/main"/);
 assert.match(auth,/claims\.sub!==expected\.subject/);
 assert.match(auth,/claims\.workflow_ref!==expected\.workflowRef/);
 const minutes=[17,47];
 assert.equal((minutes[1]-minutes[0])%60,30);
 assert.equal((minutes[0]+60-minutes[1])%60,30);
});

test("Collector cannot report full success without complete member observations",()=>{
 const edge=read("supabase/functions/coc-stats-collector/index.ts");
 const wf=read(".github/workflows/collect-war-stats.yml");
 assert.match(edge,/ok:errors===0&&tenureWriteErrors===0&&tenureSkippedProfiles===0/);
 assert.match(edge,/errors\|\|tenureWriteErrors\|\|tenureSkippedProfiles\?503:200/);
 assert.match(edge,/tenureObservedProfiles,tenureSkippedProfiles,tenureWriteErrors,\s*\n\s+rosterFailureClasses/);
 assert.match(wf,/\.tenureSkippedProfiles == 0/);
 assert.match(wf,/\.tenureObservedProfiles == \.tenantProfiles/);
 assert.match(wf,/http" != "200"/);
 assert.match(wf,/::error::Collector coverage incomplete/);
 assert.match(edge,/rpc\/cwl_observe_clan_roster_evidence/);
});

test("Unknown API errors never leak raw text or IDs through roster diagnostics",()=>{
 const edge=read("supabase/functions/coc-stats-collector/index.ts");
 const a=edge.indexOf("function apiDiagnostic("),b=edge.indexOf("function adminSettings(",a);
 assert.ok(a>=0&&b>a);
 const code=edge.slice(a,b);
 const run=vm.runInNewContext(code+";rosterDiagnostic",{
  ERROR:{api:"clash_api_unavailable",invalid:"war_data_incomplete"}
 });
 assert.equal(run(Error("roster_incomplete")),"roster_incomplete");
 assert.equal(run(Error("roster_duplicates")),"roster_duplicates");
 assert.equal(run(Error("clash_api_unavailable:http_429")),"clash_api_unavailable:roster:http_429");
 assert.equal(run(Error("secret service-key #CLAN player=ABC")),"roster_unavailable");
 assert.equal(run(Error("clash_api_unavailable:http_503 token=123")),"clash_api_unavailable:roster:invalid_war_data");
});
