"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const sql=fs.readFileSync(path.resolve(__dirname,
  "../scripts/collector-cwl-missed-coverage.sql"),"utf8");
const statements=sql.replace(/^\s*--.*$/gm,"").trim();

test("CWL missed audit stays read-only and never exposes player or tenant identifiers",()=>{
  assert.match(statements,/^WITH\s+incomplete\s+AS\s*\(/i);
  assert.match(statements,/SELECT[\s\S]+FROM\s+classified/i);
  assert.doesNotMatch(statements,/\b(?:INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|MERGE|CALL|COPY|EXECUTE|GRANT|REVOKE)\b/i);
  assert.doesNotMatch(statements,/\b(?:player_name|attacker_name|opponent_name|player_tag|opponent_tag)\b/i);
  assert.match(statements,/count\(DISTINCT\s+war_key\)\s+AS\s+distinct_clash_wars/i);
  assert.match(statements,/count\(\*\)\s+AS\s+app_clan_records/i);
});

test("CWL missed audit scopes its joins per tenant and never treats unknown as zero",()=>{
  assert.match(statements,/a\.clan_id\s*=\s*w\.clan_id\s+AND\s+a\.war_key\s*=\s*w\.war_key/i);
  assert.match(statements,/GROUP\s+BY\s+w\.clan_id,w\.war_key/i);
  assert.match(statements,/w\.war_type='cwl'/);
  assert.match(statements,/w\.finalized=true/);
  assert.match(statements,/w\.missed_log_complete=false/);
  assert.match(statements,/roster_size=team_size/);
  assert.match(statements,/recorded_attacks=team_size/);
  assert.match(statements,/distinct_attackers=team_size/);
  assert.match(statements,/attacks_outside_saved_roster=0/);
  assert.match(statements,/unexpected_extra_attacks=0/);
  assert.match(statements,/partial_evidence_missed_unknown/);
  assert.match(statements,/all_slots_recorded_official_counter_unstored/);
  assert.doesNotMatch(statements,/\bcoalesce\([^)]*missed[^)]*,\s*0\s*\)/i);
});
