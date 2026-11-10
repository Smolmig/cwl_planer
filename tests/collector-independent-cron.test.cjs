"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const auth=()=>import("../supabase/functions/coc-stats-collector/collector-cron-auth.mjs");
const now=Date.parse("2026-11-10T16:30:00Z");
const validAt=Math.floor(now/1000);
const sig="a".repeat(64);
function request(at=validAt,sigValue=sig,extra={}){
 return new Request("https://collector.test/",{method:"POST",headers:{
  "x-cwl-collector-cron-at":String(at),
  "x-cwl-collector-cron-signature":sigValue,...extra
 }});
}
const settings={url:"https://project.supabase.co",key:"test-private-service-key"};

test("Cron header validation denies partial, malformed, stale, future and mixed identities",async()=>{
 const {hasCronHeaders,validCronHeaderShape}=await auth();
 assert.equal(hasCronHeaders(request()),true);
 assert.deepEqual(validCronHeaderShape(request(),{now}),{at:validAt,signature:sig});
 for(const [at,signature,extra] of [
  [validAt-91,sig,{}],[validAt+16,sig,{}],
  [validAt,sig.toUpperCase(),{}],
  [validAt,"1234",{}],
  ["",sig,{}],
  [validAt,sig,{Authorization:"Bearer fake-oidc"}]
 ]){
  assert.equal(validCronHeaderShape(request(at,signature,extra),{now}),null);
 }
 const noHeaders=new Request("https://collector.test/",{method:"POST"});
 assert.equal(hasCronHeaders(noHeaders),false);
 const onlyOne=request();
 onlyOne.headers.delete("x-cwl-collector-cron-signature");
 assert.equal(hasCronHeaders(onlyOne),true);
 assert.equal(validCronHeaderShape(onlyOne,{now}),null);
});

test("Only valid-shaped Cron requests reach a private service-role RPC; boolean true required",async()=>{
 const {verifyIndependentCron}=await auth();
 let calls=0;
 const fetcher=async(url,options)=>{
  calls++;
  assert.equal(url,"https://project.supabase.co/rest/v1/rpc/cwl_verify_collector_cron_request");
  assert.equal(options.method,"POST");
  assert.equal(options.headers.apikey,settings.key);
  assert.equal(options.headers.Authorization,"Bearer "+settings.key);
  assert.deepEqual(JSON.parse(options.body),{p_timestamp:validAt,p_signature:sig});
  return {ok:true,json:async()=>true};
 };
 assert.equal(await verifyIndependentCron(request(),settings,{now,fetcher}),true);
 assert.equal(calls,1);
 assert.equal(await verifyIndependentCron(request(validAt-91),settings,{now,fetcher}),false);
 assert.equal(await verifyIndependentCron(request(validAt,sig,{Authorization:"Bearer x"}),settings,{now,fetcher}),false);
 assert.equal(calls,1);
 for(const reply of [{ok:true,json:async()=>false},{ok:true,json:async()=>({ok:true})},{ok:false,status:503}]){
  assert.equal(await verifyIndependentCron(request(),settings,{now,fetcher:async()=>reply}),false);
 }
 assert.equal(await verifyIndependentCron(request(),settings,{now,fetcher:async()=>{throw Error("network")}}),false);
});

test("DB verifier uses Vault, short-lived HMAC and service role only; no plaintext secret",()=>{
 const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261110160000_cwl_collector_cron_hmac.sql"),"utf8");
 assert.match(sql,/SECURITY INVOKER/i);
 assert.doesNotMatch(sql,/SECURITY DEFINER/i);
 assert.match(sql,/vault\.create_secret/i);
 assert.match(sql,/extensions\.gen_random_bytes\(32\)/i);
 assert.match(sql,/vault\.decrypted_secrets/i);
 assert.match(sql,/extensions\.hmac/i);
 assert.match(sql,/cwl:collector:cron:v1/);
 assert.match(sql,/REVOKE ALL ON FUNCTION[^;]+FROM PUBLIC/i);
 assert.match(sql,/REVOKE ALL ON FUNCTION[^;]+FROM authenticated/i);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION[^;]+TO service_role/i);
 assert.doesNotMatch(sql,/GRANT EXECUTE ON FUNCTION[^;]+TO (?:PUBLIC|anon|authenticated)/i);
 assert.doesNotMatch(sql,/service_role\s*[:=]\s*['"][A-Za-z0-9_-]+/i);
});

test("Independent job uses signed Vault values with no service-role token in cron command",()=>{
 const sql=fs.readFileSync(path.join(root,"supabase/migrations/20261110160500_cwl_collector_cron_activate.sql"),"utf8");
 assert.match(sql,/CREATE EXTENSION IF NOT EXISTS pg_cron/i);
 assert.match(sql,/CREATE EXTENSION IF NOT EXISTS pg_net/i);
 assert.match(sql,/cron\.schedule\(/i);
 assert.match(sql,/'5,35 \* \* \* \*'/i);
 assert.match(sql,/net\.http_post/i);
 assert.match(sql,/vault\.decrypted_secrets/i);
 assert.match(sql,/extensions\.hmac/i);
 assert.match(sql,/x-cwl-collector-cron-at/i);
 assert.match(sql,/x-cwl-collector-cron-signature/i);
 assert.doesNotMatch(sql,/SUPABASE_SERVICE_ROLE_KEY|Bearer\s|verify_jwt\s*=\s*true/i);
 assert.match(sql,/cron\.unschedule/i);
});

test("Edge dispatch preserves strict GitHub OIDC and never treats Cron header as fallback",()=>{
 const src=fs.readFileSync(path.join(root,"supabase/functions/coc-stats-collector/index.ts"),"utf8");
 assert.match(src,/if\(hasCronHeaders\(request\)\)/);
 assert.match(src,/validCronHeaderShape\(request\)/);
 assert.match(src,/verifyIndependentCron\(request,settings\)/);
 assert.match(src,/verifyCollectorIdentity\(match\[1\]\)/);
 assert.match(src,/collector_verified_trigger=internal_cron/);
 assert.match(src,/if\(!match\|\|!await verifyCollectorIdentity/);
});
