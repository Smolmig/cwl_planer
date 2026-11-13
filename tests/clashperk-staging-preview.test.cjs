"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const root=path.resolve(__dirname,"..");
const build=path.join(root,"scripts/build_clashperk_staging_preview.cjs");
const liveSync=fs.readFileSync(path.join(root,"cloud-sync.mjs"),"utf8");
const productionUrl=/const SUPABASE_URL="([^"]+)";/.exec(liveSync)[1];
const productionKey=/const SUPABASE_PUBLISHABLE_KEY="([^"]+)";/.exec(liveSync)[1];
const productionRef=new URL(productionUrl).hostname.split(".")[0];
const stagingRef="stagingprojectxyz123";
const stagingUrl="https://"+stagingRef+".supabase.co";
const stagingKey="sb_publishable_synthetic_test_1234567890";

function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"cwl-preview-"));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=(opts={})=>{
  const out=opts.out||path.join(dir,"preview");
  return {out,res:spawnSync(process.execPath,[build,out],{
   encoding:"utf8",
   timeout:10000,
   env:{...process.env,CWL_STAGING_SUPABASE_URL:opts.url??stagingUrl,
    CWL_STAGING_PUBLISHABLE_KEY:opts.key??stagingKey}
  })};
 };
 return {dir,run};
}

test("staging preview uses only a different hosted Supabase project and shows an iPhone-visible label",t=>{
 const {run}=fixture(t);
 const {out,res}=run();
 assert.equal(res.status,0,res.stderr);
 const sync=fs.readFileSync(path.join(out,"cloud-sync.mjs"),"utf8");
 const html=fs.readFileSync(path.join(out,"cloud-app.html"),"utf8");
 const manifest=JSON.parse(fs.readFileSync(path.join(out,"cloud-manifest.webmanifest"),"utf8"));
 const worker=fs.readFileSync(path.join(out,"service-worker.js"),"utf8");
 assert.match(sync,/const SUPABASE_URL="https:\/\/stagingprojectxyz123\.supabase\.co";/);
 assert.ok(sync.includes('const SUPABASE_PUBLISHABLE_KEY="'+stagingKey+'";'));
 assert.match(html,/TESTUMGEBUNG · Keine Echtdaten/);
 assert.match(html,/CWL Planer · TEST/);
 assert.match(html,/swRegistration=await navigator\.serviceWorker\.register\("\.\/service-worker\.js"\)/,
  "Staging Cloud route must register its own service worker");
 assert.match(worker,/addEventListener\("fetch"/);
 assert.match(worker,/cache:"no-store"/);
 assert.doesNotMatch(worker,/caches\.open|caches\.match|index\.html/);
 assert.match(html,new RegExp("sb-"+stagingRef+"-auth-token"));
 assert.equal(manifest.short_name,"CWL TEST");
 assert.equal(manifest.start_url,"./cloud-app.html");
 assert.doesNotMatch(worker,/index\.html|cwl-planer-v1-0-2/);
 assert.match(worker,/online-only/);
 assert.equal(fs.existsSync(path.join(out,"index.html")),false,
  "Offline guest planner must not accidentally be deployed as staging");
 assert.equal(fs.existsSync(path.join(out,"cwl-clashperk-xlsx.mjs")),true);
 assert.equal(fs.existsSync(path.join(out,"brand-icon-192.png")),true);
 for(const name of fs.readdirSync(out)){
  if(!/\.(mjs|js|html|webmanifest|json|svg)$/.test(name))continue;
  const value=fs.readFileSync(path.join(out,name),"utf8");
  assert.equal(value.includes(productionRef),false,name+" refers to production");
  assert.equal(value.includes(productionUrl),false,name+" refers to production URL");
  assert.equal(value.includes(productionKey),false,name+" contains the production publishable key");
 }
});

test("staging preview fails closed on live URL, live key, spoofed host and unsafe output location",t=>{
 const {run}=fixture(t);
 for(const [label,opts] of [
  ["production URL",{url:productionUrl}],
  ["production key",{key:productionKey}],
  ["HTTP URL",{url:"http://"+stagingRef+".supabase.co"}],
  ["host suffix",{url:stagingUrl+".example.invalid"}],
  ["path suffix",{url:stagingUrl+"/rest/v1/"}],
  ["secret key",{key:"sb_secret_do_not_pass_here_9876543210"}],
  ["target inside repo",{out:path.join(root,"staging-preview-unsafe")}]
 ]){
  const {out,res}=run(opts);
  assert.notEqual(res.status,0,label+" was accepted");
  assert.equal(fs.existsSync(out),false,label+" created an unsafe preview");
  assert.doesNotMatch(res.stderr, /sb_secret_do_not_pass_here_9876543210/,
   "Sensitive provided values should not be printed in errors");
 }
});
