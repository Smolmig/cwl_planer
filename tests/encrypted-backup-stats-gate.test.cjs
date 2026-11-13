"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {spawnSync}=require("node:child_process");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const verifier=path.join(root,"scripts/verify_clashperk_restore.py");
const workflow=fs.readFileSync(path.join(root,".github/workflows/test-encrypted-restore.yml"),"utf8");
const rows={
 cwl_stat_wars:"synthetic-clan\tcp:123\n",
 cwl_stat_attacks:"cp:123\t#8PYL\t3\n",
 cwl_stat_missed:"cp:123\t#QPYL\t1\n"
};
const sqlDump=(records,omit="")=>Object.entries(records)
 .filter(([name])=>name!==omit)
 .map(([name,data])=>"COPY public."+name+" (synthetic_key, synthetic_value) FROM stdin;\n"+
  data+"\\.\n").join("\n");

function setup(){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cwl-stats-restore-"));
 const mock=path.join(dir,"psql");
 fs.writeFileSync(mock,String.raw`#!/usr/bin/env node
const query=process.argv.at(-1)||"";
if(query.includes("relrowsecurity")){
 process.stdout.write(process.env.MOCK_RLS==="off"?"f\n":"t\n");
 process.exit(0);
}
const table=/FROM public\.(cwl_stat_[a-z_]+)/.exec(query)?.[1];
const rows=JSON.parse(process.env.MOCK_ROWS||"{}");
if(!table||!Object.hasOwn(rows,table)) process.exit(2);
process.stdout.write(rows[table]);
`);
 fs.chmodSync(mock,0o755);
 const dump=path.join(dir,"data-local.sql");
 const run=(data,values=rows,rls="on")=>{
  fs.writeFileSync(dump,data);
  return spawnSync("python3",[verifier,dump],{
   encoding:"utf8",
   env:{...process.env,PATH:dir+path.delimiter+process.env.PATH,
    MOCK_ROWS:JSON.stringify(values),MOCK_RLS:rls,
    PGHOST:"127.0.0.1",PGPORT:"54322",PGUSER:"postgres",PGDATABASE:"postgres"}
  });
 };
 return {dir,run};
}

test("daily encrypted restore compares all historical stats tables after isolated restore",()=>{
 assert.match(workflow,/workflow_run:/);
 assert.match(workflow,/Verify exact restored historical CW\/CWL statistics and RLS/);
 assert.match(workflow,/python3 scripts\/verify_clashperk_restore\.py "\$WORK\/unpacked\/cwl-backup\/data-local\.sql"/);
 for(const table of Object.keys(rows))assert.match(workflow,new RegExp("public\\."+table));
 assert.match(workflow,/PGHOST: 127\.0\.0\.1/);
 assert.match(workflow,/PGPORT: '54322'/);
 // No production DB credentials are supplied to this verification step.
 const step=workflow.split("- name: Verify exact restored historical CW/CWL statistics and RLS")[1]
  .split("- name: Remove disposable database")[0];
 assert.doesNotMatch(step,/SUPABASE_DB_URL|service_role|supabase db push/);
});

test("encrypted COPY restore verifier rejects same-count data corruption and RLS loss",t=>{
 const {dir,run}=setup();
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const valid=sqlDump(rows);
 const pass=run(valid);
 assert.equal(pass.status,0,pass.stderr);
 assert.match(pass.stdout,/PASS: ClashPerk historical/);
 const altered={...rows,cwl_stat_attacks:"cp:123\t#8PYL\t2\n"};
 const bad=run(valid,altered);
 assert.notEqual(bad.status,0);
 assert.match(bad.stderr,/public\.cwl_stat_attacks content differs/);
 assert.doesNotMatch(bad.stderr,/cp:123|#8PYL/,"Never print private row content in logs");
 const missing=run(sqlDump(rows,"cwl_stat_missed"));
 assert.notEqual(missing.status,0);
 assert.match(missing.stderr,/Backup does not contain public\.cwl_stat_missed/);
 const noRls=run(valid,rows,"off");
 assert.notEqual(noRls.status,0);
 assert.match(noRls.stderr,/RLS not enabled after restore/);
});
