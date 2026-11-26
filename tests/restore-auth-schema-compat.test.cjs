"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sql=fs.readFileSync(path.join(root,"scripts/restore_local_auth_compat.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/test-encrypted-restore.yml"),"utf8");
const drill=fs.readFileSync(path.join(root,".github/workflows/verify-encrypted-backup-drill.yml"),"utf8");
const authCanary=fs.readFileSync(path.join(root,".github/workflows/restore-local-auth-schema-ci.yml"),"utf8");
const statsRestore=fs.readFileSync(path.join(root,".github/workflows/clashperk-stats-restore-ci.yml"),"utf8");

test("local hosted-Auth schema gate is read-only and rejects missing or incompatible columns",()=>{
 assert.match(sql,/to_regclass\('auth\.one_time_tokens'\)/);
 for(const col of ["expires_at","link_token_hash"])
  assert.match(sql,new RegExp("a\\.attname='"+col+"'"));
 assert.match(sql,/format_type\(a\.atttypid,a\.atttypmod\)='timestamp with time zone'/);
 assert.match(sql,/format_type\(a\.atttypid,a\.atttypmod\)='text'/);
 assert.match(sql,/NOT a\.attnotnull/);
 // Comments may mention forbidden DDL for explanation; inspect executable SQL only.
 const executableSql=sql.split("\n").filter(line=>!line.trimStart().startsWith("--")).join("\n");
 assert.doesNotMatch(executableSql,/\b(?:ALTER|CREATE|DROP|TRUNCATE|DELETE|UPDATE|INSERT|COPY|GRANT|REVOKE)\s+(?:TABLE|COLUMN|FROM|INTO|ON|ROLE)\b/i);
 assert.doesNotMatch(sql,/postgresql?:\/\/|supabase\.co|session_replication_role|auth\.users\b/);
});

test("restore uses current pinned v3 CLI, checks Auth in same transaction and has no production credentials",()=>{
 assert.match(workflow,/uses: supabase\/setup-cli@v1\s+with:\s+version: 3\.4\.0/);
 assert.match(workflow,/PGPASSWORD=postgres psql -X -h 127\.0\.0\.1 -p "\$CWL_RESTORE_DB_PORT"/);
 assert.match(workflow,/--single-transaction/);
 const schema=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/schema.sql"');
 const check=workflow.indexOf("-f scripts/restore_local_auth_compat.sql");
 const auth=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/auth-data.sql"');
 const application=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/data-local.sql"');
 assert.ok(schema>=0&&schema<check&&check<auth&&auth<application);
 assert.match(workflow,/Remove disposable database and decrypted files/);
 assert.match(workflow,/if: always\(\)/);
 assert.doesNotMatch(workflow,/SUPABASE_DB_URL|service_role|supabase db push/);
});
test("replay targets the same successful encrypted 26 November backup without production access",()=>{
 assert.match(drill,/backup_run_id:.*'45805944787'/);
 assert.match(drill,/uses: \.\/\.github\/workflows\/test-encrypted-restore\.yml/);
 assert.match(drill,/CWL_BACKUP_PASSPHRASE: \$\{\{ secrets\.CWL_BACKUP_PASSPHRASE \}\}/);
 assert.doesNotMatch(drill,/secrets:\s*inherit|SUPABASE_DB_URL|service_role|actions\/upload-artifact/);
});

test("restore and Auth canary require preinstalled psql without Ubuntu package downloads",()=>{
 for(const source of [workflow,authCanary,statsRestore]){
  assert.match(source,/command -v psql/);
  assert.match(source,/psql --version/);
  assert.doesNotMatch(source,/\bapt-get\b|\bapt\s+install\b/i);
 }
});

test("new OAuth schema gate is shared by isolated canary and restore, no skipped COPY",()=>{
 for(const col of ["custom_claims_allowlist","client_auth_method","client_assertion_audience"])assert.ok(sql.includes(col));
 assert.match(sql,/auth\.custom_oauth_providers/);
 assert.match(authCanary,/scripts\/restore_local_auth_compat\.sql/);
 for(const source of [workflow,authCanary])assert.match(source,/supabase config convert --to toml/);
 assert.match(workflow,/-f "\$WORK\/unpacked\/cwl-backup\/auth-data\.sql"/);
});


test("restore and real canary pin official GoTrue migration release, never patch hosted Auth",()=>{
 for(const source of [workflow,authCanary]){
  const start=source.indexOf("          supabase db start");
  const pin=source.indexOf(" > supabase/.temp/gotrue-version");
  assert.ok(pin>=0&&pin<start);
  assert.match(source,/v2\.199\.0/);
  assert.match(source,/SUPABASE_EXPERIMENTAL_STACK=0/);
  assert.doesNotMatch(source,/supabase link|ALTER TABLE auth\./i);
 }
 const fixture=fs.readFileSync(path.join(root,"tests/sql/restore-auth-compat-fixture.sql"),"utf8");
 assert.match(fixture,/CREATE TABLE auth\.custom_oauth_providers/);
 assert.match(fixture,/custom_claims_allowlist text\[\] NOT NULL/);
 assert.match(fixture,/client_auth_method text NOT NULL/);
 assert.match(fixture,/client_assertion_audience text NULL/);
 assert.match(fixture,/ROLLBACK;/);
});
