"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const source=fs.readFileSync(path.resolve(__dirname,
 "../scripts/collector-monthly-coverage.sql"),"utf8");
const sql=source.replace(/^\s*--.*$/gm,"").trim();

test("Monthly collector audit is read-only and exports only aggregate data",()=>{
 assert.match(sql,/^WITH\s+monthly\s+AS\s*\(/i);
 assert.match(sql,/SELECT\s+monthly\.\*,/i);
 assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|CALL|COPY|EXECUTE|GRANT|REVOKE)\b/i);
 assert.doesNotMatch(sql,/\b(?:player_tag|player_name|attacker_tag|attacker_name|opponent_tag|opponent_name)\b/i);
 assert.match(sql,/count\(DISTINCT\s+war_key\)\s+AS\s+distinct_clash_wars/i);
 assert.match(sql,/count\(\*\)\s+AS\s+app_clan_wars/i);
 assert.match(sql,/FROM\s+public\.cwl_stat_wars/i);
 assert.match(sql,/FROM\s+public\.cwl_stat_collector_status/i);
 assert.match(sql,/WHERE\s+war_type='cwl'/i);
});
test("A finalized CWL without trusted missed coverage remains unknown, not zero",()=>{
 assert.match(sql,/finalized\s+IS\s+TRUE\s+AND\s+missed_log_complete\s+IS\s+TRUE/i);
 assert.match(sql,/finalized\s+IS\s+TRUE\s+AND\s+missed_log_complete\s+IS\s+DISTINCT\s+FROM\s+TRUE/i);
 assert.match(sql,/AS\s+finalized_missed_unknown/i);
 assert.doesNotMatch(sql,/\bmissed_count\b/i);
 assert.doesNotMatch(sql,/\b(?:cwl_stat_missed|cwl_stat_attacks)\b/i);
 assert.doesNotMatch(sql,/\b(?:WHERE|JOIN|GROUP\s+BY)\s+[^;]*clan_id/i);
});
