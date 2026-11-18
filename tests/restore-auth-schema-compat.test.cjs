"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const sql=fs.readFileSync(path.join(root,"scripts/restore_local_auth_compat.sql"),"utf8");
const workflow=fs.readFileSync(path.join(root,".github/workflows/test-encrypted-restore.yml"),"utf8");
const drill=fs.readFileSync(path.join(root,".github/workflows/verify-encrypted-backup-drill.yml"),"utf8");

test("local Auth compatibility is narrowly additive, idempotent and schema-validated",()=>{
 assert.match(sql,/to_regclass\('auth\.one_time_tokens'\)/);
 assert.match(sql,/ALTER TABLE auth\.one_time_tokens\s+ADD COLUMN IF NOT EXISTS expires_at timestamp with time zone,\s+ADD COLUMN IF NOT EXISTS link_token_hash text/);
 assert.match(sql,/format_type\(a\.atttypid, a\.atttypmod\) <> 'timestamp with time zone'/);
 assert.match(sql,/format_type\(a\.atttypid, a\.atttypmod\) <> 'text'/);
 assert.match(sql,/a\.attnotnull/);
 assert.doesNotMatch(sql,/\b(?:DROP|TRUNCATE|DELETE|UPDATE|INSERT|COPY|CREATE ROLE|ALTER ROLE|GRANT|REVOKE)\b/i);
 assert.doesNotMatch(sql,/postgresql?:\/\/|supabase\.co|session_replication_role|auth\.users\b/);
});

test("compatibility never connects to production and stays in the same atomic local SQL restore",()=>{
 assert.match(workflow,/PGPASSWORD=postgres psql -X -h 127\.0\.0\.1 -p "\$CWL_RESTORE_DB_PORT"/);
 assert.match(workflow,/--single-transaction/);
 const schema=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/schema.sql"');
 const compat=workflow.indexOf("-f scripts/restore_local_auth_compat.sql");
 const auth=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/auth-data.sql"');
 const application=workflow.indexOf('-f "$WORK/unpacked/cwl-backup/data-local.sql"');
 assert.ok(schema>=0&&schema<compat&&compat<auth&&auth<application);
 assert.match(workflow,/Remove disposable database and decrypted files/);
 assert.match(workflow,/if: always\(\)/);
 assert.doesNotMatch(workflow,/SUPABASE_DB_URL|service_role|supabase db push/);
});

test("replay uses the same successful encrypted 18 November backup with only passphrase",()=>{
 assert.match(drill,/backup_run_id:.*'44283214780'/);
 assert.match(drill,/uses: \.\/\.github\/workflows\/test-encrypted-restore\.yml/);
 assert.match(drill,/CWL_BACKUP_PASSPHRASE: \$\{\{ secrets\.CWL_BACKUP_PASSPHRASE \}\}/);
 assert.doesNotMatch(drill,/secrets:\s*inherit|SUPABASE_DB_URL|service_role|actions\/upload-artifact/);
});
