"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const raw=fs.readFileSync(path.resolve(__dirname,"../scripts/collector-tenure-health.sql"),"utf8");
const sql=raw.replace(/^\s*--.*$/gm,"").trim();

test("Tenure audit is read-only, aggregate-only and does not expose identifiers",()=>{
 assert.match(sql,/^WITH\s+tenure\s+AS\s*\(/i);
 assert.match(sql,/FROM\s+public\.cwl_clan_member_tenure/i);
 assert.match(sql,/FROM\s+public\.cwl_stat_collector_status/i);
 assert.match(sql,/SELECT\s+now\(\)\s+AS\s+audited_at_utc/i);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|CALL|COPY|EXECUTE|GRANT|REVOKE)\b/i);
 assert.doesNotMatch(sql,/\b(?:player_tag|player_name|source_clash_tag|war_key|attacker_tag|opponent_tag)\b/i);
 assert.doesNotMatch(sql,/SELECT\s+(?:\*|clan_id|player_tag)\b/i);
 assert.match(sql,/count\(DISTINCT\s+clan_id\)\s+AS\s+observed_app_clans/i);
 assert.match(sql,/count\(\*\)\s+AS\s+observed_member_rows/i);
});
test("First observation is not counted as earned time or a verified donation",()=>{
 assert.match(sql,/last_observed_at\s*>\s*first_observed_at/i);
 assert.match(sql,/confirmed_seconds\s*>\s*0/i);
 assert.match(sql,/last_donation_increase_at\s+IS\s+NOT\s+NULL/i);
 assert.match(sql,/awaiting_reobservation/i);
 assert.match(sql,/reobserved_without_confirmed_interval/i);
 assert.match(sql,/interval\s+'3 hours'/i);
 assert.doesNotMatch(sql,/coalesce\(last_donation_increase_at/i);
});
