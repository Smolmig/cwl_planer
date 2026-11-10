"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const migration=fs.readFileSync(path.resolve(__dirname,
 "../supabase/migrations/20261110162000_cwl_pgnet_private_extension_registration.sql"),"utf8");
test("pg_net is registered outside public only when safe, never discards pending requests",()=>{
 assert.match(migration,/installed_schema\s*=\s*'public'/i);
 assert.match(migration,/net\.http_request_queue/i);
 assert.match(migration,/RAISE EXCEPTION/i);
 assert.match(migration,/DROP EXTENSION pg_net/i);
 assert.match(migration,/CREATE EXTENSION pg_net WITH SCHEMA extensions/i);
 assert.doesNotMatch(migration,/CASCADE|DROP\s+SCHEMA|DELETE\s+FROM/i);
 assert.doesNotMatch(migration,/SUPABASE_SERVICE_ROLE_KEY|COC_API_KEY|ALTER\s+ROLE/i);
});
