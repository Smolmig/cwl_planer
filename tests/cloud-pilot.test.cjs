"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "cloud-pilot.html"), "utf8");
const schema = fs.readFileSync(path.join(root, "supabase/migrations/20261029225544_cwl_cloud_pilot_schema.sql"), "utf8");
const wrapper = fs.readFileSync(path.join(root, "supabase/migrations/20261029225621_cwl_invite_security_wrapper.sql"), "utf8");

test("Cloud pilot module is syntactically valid and has required controls", () => {
  const script = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(script, "ES module present");
  const code = script[1].replace(/^import .* from "https:\/\/esm\.sh\/[^"]+";\s*/m, "");
  assert.doesNotThrow(() => new vm.Script(code));
  for (const id of ["authSection","loginBtn","signupBtn","clanSelect","createClanBtn","makeInviteBtn","joinBtn","profileStatus","backupFile","uploadProfileBtn","logoutBtn"]) {
    assert.match(html, new RegExp('id="'+id+'"'));
  }
});
test("only a publishable key is used by the browser; JSON profiles require data format 9", () => {
  assert.match(html, /sb_publishable_/);
  assert.doesNotMatch(html, /sb_secret_|SUPABASE_SERVICE_ROLE_KEY|COC_API_KEY/);
  assert.match(html, /obj\.dataVersion\)!==9/);
  assert.match(html, /\.eq\("revision",currentRow\.revision\)/);
  assert.match(html, /hasRemoteUpdate/);
  assert.match(html, /if\(!confirm\(text\)\)return/);
  assert.match(html, /auth\.signInWithPassword/);
});
test("Cloud database has RLS on every public table and a private privileged redemption helper", () => {
  for (const name of ["cwl_clans","cwl_clan_memberships","cwl_clan_invites","cwl_cloud_profiles"]) {
    assert.match(schema, new RegExp("alter table public\\."+name+" enable row level security"));
  }
  assert.match(schema, /grant update \(profile_json\)/);
  assert.match(schema, /grant execute on function public\.cwl_redeem_invite\(uuid\) to authenticated/);
  assert.match(wrapper, /create function private\.cwl_redeem_invite_internal/);
  assert.match(wrapper, /language sql security invoker/);
});