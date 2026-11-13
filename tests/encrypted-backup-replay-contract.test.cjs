"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const replay=fs.readFileSync(path.join(root,".github/workflows/verify-encrypted-backup-drill.yml"),"utf8");
const restore=fs.readFileSync(path.join(root,".github/workflows/test-encrypted-restore.yml"),"utf8");
const verifier=fs.readFileSync(path.join(root,"scripts/verify_clashperk_restore.py"),"utf8");

test("one-off encrypted backup replay is main-only, reuses isolated restore and passes only its passphrase",()=>{
 assert.match(replay,/^\s*push:\s*$/m);
 assert.match(replay,/branches:\s*\[main\]/);
 assert.match(replay,/verify-encrypted-backup-drill\.yml'/);
 assert.match(replay,/workflow_dispatch:/);
 assert.match(replay,/github\.repository == 'Smolmig\/cwl_planer'/);
 assert.match(replay,/github\.ref == 'refs\/heads\/main'/);
 assert.match(replay,/uses: \.\/\.github\/workflows\/test-encrypted-restore\.yml/);
 assert.match(replay,/backup_run_id:.*'43402344939'/);
 assert.match(replay,/CWL_BACKUP_PASSPHRASE: \$\{\{ secrets\.CWL_BACKUP_PASSPHRASE \}\}/);
 assert.doesNotMatch(replay,/secrets:\s*inherit/);
 assert.doesNotMatch(replay,/SUPABASE_DB_URL|service_role|SUPABASE_SERVICE_ROLE_KEY|supabase db dump|supabase db push|DELETE FROM/i);
});

test("original automatic restore remains active and callable replay verifies exact stats on loopback only",()=>{
 assert.match(restore,/workflow_call:/);
 assert.match(restore,/workflow_run:/);
 assert.match(restore,/workflows:\s*\[Encrypted Supabase backup\]/);
 assert.match(restore,/github\.event\.workflow_run\.conclusion == 'success'/);
 assert.match(restore,/github\.event\.workflow_run\.head_repository\.full_name == github\.repository/);
 assert.match(restore,/workflow_dispatch:/);
 assert.match(restore,/inputs\.backup_run_id != '' && github\.ref == 'refs\/heads\/main'/);
 assert.match(restore,/BACKUP_RUN_ID: \$\{\{ github\.event_name == 'workflow_run' && github\.event\.workflow_run\.id \|\| inputs\.backup_run_id \}\}/);
 assert.match(restore,/^\s*actions: read$/m);
 assert.match(restore,/gh run download "\$BACKUP_RUN_ID"/);
 assert.match(restore,/sha256sum --check cwl-backup\.tar\.gz\.gpg\.sha256/);
 assert.match(restore,/Verify exact restored historical CW\/CWL statistics and RLS/);
 assert.match(restore,/python3 scripts\/verify_clashperk_restore\.py "\$WORK\/unpacked\/cwl-backup\/data-local\.sql"/);
 assert.match(restore,/supabase db start/);
 assert.match(restore,/PGHOST: 127\.0\.0\.1/);
 assert.match(restore,/CWL_RESTORE_DB_PORT/);
 assert.match(restore,/export PGPORT="\$CWL_RESTORE_DB_PORT"/);
 assert.match(restore,/echo "CWL_RESTORE_DB_PORT=\$restore_port" >> "\$GITHUB_ENV"/);
 assert.match(restore,/supabase stop --no-backup/);
 assert.doesNotMatch(restore,/SUPABASE_DB_URL|service_role|supabase db push|actions\/upload-artifact/);
 for(const name of ["cwl_stat_wars","cwl_stat_attacks","cwl_stat_missed"])
  assert.match(verifier,new RegExp(name));
 assert.match(verifier,/content differs from encrypted backup/);
});
