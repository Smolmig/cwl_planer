"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

test("new invitation links are recoverable without recreating or revoking an invitation",()=>{
 const sync=read("cloud-sync.mjs");
 const html=read("cloud-app.html");
 assert.match(sync,/rpc\("cwl_create_copyable_invite"/);
 assert.match(sync,/p_reusable:reusable/);
 assert.match(sync,/rpc\("cwl_read_copyable_invite",\{p_id:inv\.id\}\)/);
 assert.match(sync,/copy\.textContent="Link kopieren"/);
 assert.match(sync,/navigator\.clipboard\.writeText\(inviteUrlForCode\(data\)\)/);
 assert.match(sync,/inv\.created_by===user\.id/);
 assert.match(sync,/role==="owner"/);
 // List the invitations without ever fetching the secret token.
 assert.match(sync,/select\("id,role,created_by,expires_at,reusable,link_label,use_count"\)/);
 assert.doesNotMatch(sync,/\.select\([^\n]*invite_code/);
 assert.match(sync,/Dieser ältere Link kann nicht erneut angezeigt werden/);
 assert.match(html,/Neue Einladungslinks findest du später unter „Aktive Einladungslinks“/);
});

test("recoverable invite tokens are private and readable only via an authorized scoped RPC",()=>{
 const sql=read("supabase/migrations/20261106134441_cwl_invite_copy_secure.sql");
 assert.match(sql,/create table private\.cwl_invite_link_secrets/i);
 assert.match(sql,/invite_id uuid primary key references public\.cwl_clan_invites\(id\) on delete cascade/i);
 assert.match(sql,/enable row level security/i);
 assert.match(sql,/revoke all on private\.cwl_invite_link_secrets from public, anon, authenticated/i);
 assert.match(sql,/short_code_hash=encode\(pg_catalog\.sha256/);
 assert.match(sql,/i\.used_at is null/);
 assert.match(sql,/i\.expires_at is null or i\.expires_at>now\(\)/);
 assert.match(sql,/m\.clan_id=i\.clan_id and m\.user_id=auth\.uid\(\)/);
 assert.match(sql,/m\.role='owner' or \(m\.role='editor' and i\.created_by=auth\.uid\(\)\)/);
 assert.match(sql,/revoke all on function public\.cwl_read_copyable_invite.*from public,anon/i);
 assert.match(sql,/grant execute on function public\.cwl_read_copyable_invite.*to authenticated/i);
 assert.doesNotMatch(sql,/update public\.cwl_clan_invites set short_code_hash/i);
});
