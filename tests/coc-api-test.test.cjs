"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const code = fs.readFileSync(path.join(root, "supabase/functions/coc-members-test/index.ts"), "utf8");
const config = fs.readFileSync(path.join(root, "supabase/config.toml"), "utf8");

async function invoke({ method = "POST", status = 200, payload, tag = "#ABC123", apiKey = "test-secret" } = {}) {
  let called = false;
  let outgoing = null;
  const wrapperArgs = [];
  const context = {
    AbortSignal, Response,
    Deno: { env: { get: name => ({ COC_API_KEY: apiKey, COC_CLAN_TAG: tag })[name] } },
    withSupabase: (args, fn) => { wrapperArgs.push(args); return fn; },
    fetch: async (url, options) => {
      called = true;
      outgoing = { url, options };
      return { ok: status === 200, status, json: async () => payload ?? { items: [
        { tag: "#PLAYER", name: "Testspieler", role: "coLeader", townHallLevel: 18, internal: "must-not-leak" },
      ] } };
    },
  };
  const js = code.replace(/^import .*?;\s*/m, "").replace(/export default\s*\{/, "globalThis.endpoint = {");
  vm.runInNewContext(js, context);
  const response = await context.endpoint.fetch({ method });
  return { response, body: await response.json(), outgoing, called, wrapperArgs };
}

test("function only accepts privileged Supabase secret key authentication", () => {
  assert.match(config, /\[functions\.coc-members-test\]\s*verify_jwt\s*=\s*false/);
  assert.match(code, /auth:\s*"secret"/);
  assert.doesNotMatch(code, /service_role|SUPABASE_SERVICE_ROLE_KEY|auth:\s*"none"|auth:\s*"publishable"/);
});
test("normalizes the fixed clan tag and returns only safe player fields", async () => {
  const r = await invoke({ tag: "#ABC123" });
  assert.equal(r.response.status, 200);
  assert.equal(r.outgoing.url, "https://cocproxy.royaleapi.dev/v1/clans/%23ABC123/members");
  assert.equal(r.outgoing.options.headers.Authorization, "Bearer test-secret");
  assert.equal(r.body.memberCount, 1);
  assert.deepEqual(Object.keys(r.body.members[0]), ["tag", "name", "townHallLevel", "role"]);
  assert.equal(JSON.stringify(r.body).includes("must-not-leak"), false);
});
test("upstream error only exposes status code, not key or raw payload", async () => {
  const r = await invoke({ status: 403, apiKey: "never-leak-this-key" });
  assert.equal(r.response.status, 502);
  assert.equal(r.body.upstreamStatus, 403);
  assert.equal(JSON.stringify(r.body).includes("never-leak-this-key"), false);
});
test("missing configuration and bad methods block any upstream request", async () => {
  for (const params of [{apiKey: ""}, {tag: "#BAD/URL"}, {method: "GET"}]) {
    const r = await invoke(params);
    assert.equal(r.called, false);
    assert.notEqual(r.response.status, 200);
  }
});
