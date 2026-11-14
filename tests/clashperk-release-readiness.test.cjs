"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const draft="scripts/DRAFT_cwl_clashperk_atomic_import_rpc.sql";
const migration="supabase/migrations/20261113153000_cwl_clashperk_atomic_history_import.sql";
const start="create or replace function public.cwl_import_clashperk_atomic(";
const body=s=>{
 const p=s.indexOf(start);
 assert.ok(p>=0,"Versioned migration must contain the complete RPC body");
 return s.slice(p).trim();
};
test("The versioned release migration matches the isolated SQL previously approved in integration tests",()=>{
 assert.equal(body(read(migration)),body(read(draft)));
 const sql=read(migration).toLowerCase();
 assert.match(sql,/security invoker/);
 assert.match(sql,/private\.cwl_can_edit\(p_clan\)/);
 assert.match(sql,/revoke all on function public\.cwl_import_clashperk_atomic\(uuid,jsonb\)\s+from public,anon,authenticated/);
 assert.match(sql,/grant execute on function public\.cwl_import_clashperk_atomic\(uuid,jsonb\)\s+to authenticated/);
 assert.doesNotMatch(sql,/security definer/);
});
test("All isolated database UAT workflows execute the versioned migration (not an abandoned draft)",()=>{
 const names=[
 ".github/workflows/clashperk-local-supabase-auth-ci.yml",
 ".github/workflows/clashperk-atomic-import-sql-ci.yml",
 ".github/workflows/clashperk-http-jwt-uat.yml",
 ".github/workflows/clashperk-stats-restore-ci.yml"
 ];
 for(const name of names){
  const text=read(name);
  assert.match(text,/supabase\/migrations\/20261113153000_cwl_clashperk_atomic_history_import\.sql/,
   "Missing versioned migration in "+name);
  assert.doesNotMatch(text,/scripts\/DRAFT_cwl_clashperk_atomic_import_rpc\.sql/,
   "Outdated SQL path in "+name);
 }
});
test("The direct ClashPerk upload is explained in-app without requiring manual JSON conversion",()=>{
 const html=read("cloud-app.html");
 assert.match(html,/id="statsImportButton"/);
 assert.match(html,/id="statsImportHelp"/);
 assert.match(html,/\/export attack-log/);
 assert.match(html,/\/export missed/);
 assert.match(html,/limit: 100/);
 assert.match(html,/alte[nr]? Kriege aus ClashPerk importieren/i);
 const browser=read("cwl-stats.mjs");
 assert.match(browser,/readClashPerkXlsx/);
 assert.match(browser,/commitClashPerkMerge/);
 assert.match(browser,/await load\(true\)/);
});
test("Stats v1.21.0 minor release keeps ClashPerk SQL migration unchanged",()=>{
 const v=JSON.parse(read("cloud-version.json"));
 assert.equal(v.version,"v1.21.0");
 // In this branch we create a migration file but NEVER run the production
 // supabase db push/deploy commands, and no production credentials are stored.
 const jobs=[".github/workflows/clashperk-local-supabase-auth-ci.yml"];
 for(const name of jobs){
  const workflow=read(name);
  assert.doesNotMatch(workflow,/\bsupabase (?:link|db push)\b/);
  assert.match(workflow,/never link production/i);
 }
});


test("Discord help recommends four original exports after full UF 2 coverage test",()=>{
 const html=read("cloud-app.html");
 const start=html.indexOf('<details id="statsImportHelp"');
 const end=html.indexOf("</details>",start);
 assert.ok(start>0&&end>start);
 const guide=html.slice(start,end);
 assert.equal((guide.match(/\/export attack-log/g)||[]).length,2);
 assert.equal((guide.match(/\/export missed/g)||[]).length,2);
 assert.match(guide,/vier getrennte Exporte/i);
 assert.match(guide,/zunächst die Attack-Logs und danach separat/);
 assert.match(guide,/Regular/);
 assert.match(guide,/CWL/);
 assert.match(guide,/nicht automatisch die ganze Clan-Geschichte/);
 const helpPage=html.slice(html.indexOf("<b>Alte Kriege aus ClashPerk ergänzen:</b>"));
 assert.match(helpPage,/zweimal <strong>\/export missed<\/strong>/);
 const notes=read("docs/CLASHPERK_XLSX_IMPORT_IMPLEMENTATION_DRAFT.md");
 assert.match(notes,/vier separaten Dateien/);
});
