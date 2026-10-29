"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
const worker=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
const readme=fs.readFileSync(path.join(root,"README.txt"),"utf8");

test("SemVer app version matches PWA cache, separately from persistent data format",()=>{
  const m=html.match(/const APP_VERSION="(v\\d+\\.\\d+\\.\\d+(?:-[0-9A-Za-z.-]+)?)";/);
  assert.ok(m,"APP_VERSION must use vMAJOR.MINOR.PATCH");
  const appVersion=m[1];
  const cache=worker.match(/const CACHE="([^"]+)";/);
  assert.ok(cache,"Service-worker cache must have a versioned namespace");
  assert.equal(cache[1],"cwl-planer-"+appVersion.replaceAll(".","-"));
  assert.match(html,/const DATA_VERSION=9;/);
  assert.match(html,/const STORAGE_KEY="cwl_planer_mobile_v9";/);
  assert.match(html,/const RECOVERY_KEY="cwl_planer_mobile_v9_recovery";/);
  assert.match(html,/const LEGACY_KEYS=\[/);
  assert.match(html,/version:APP_VERSION,dataVersion:DATA_VERSION/);
  assert.match(readme,/VERSIONING\.md/);
});
