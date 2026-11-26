"use strict";const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{JSDOM}=require("jsdom");
test("one Goldpass entry, two distinct routes, owner-gated existing loaders",()=>{
 const h=fs.readFileSync(path.join(__dirname,"../cloud-app.html"),"utf8"),s=fs.readFileSync(path.join(__dirname,"../cloud-sync.mjs"),"utf8"),d=new JSDOM(h).window.document;
 assert.equal(d.querySelectorAll('[data-more-action="goldpass"]').length,1);
 assert.equal(d.querySelectorAll('[data-more-action="activity-goldpass"]').length,0);
 for(const [id,tab] of [["view-goldpass","cwl"],["view-activity-goldpass","grind"]]){
  const nav=d.querySelector("#"+id+" .goldpass-nav");
  assert.equal(nav.querySelectorAll("button").length,2);assert.equal(nav.querySelector('[aria-current="page"]').dataset.goldpassTab,tab);
 }
 assert.match(h,/if\(b\.dataset\.goldpassTab==="cwl"\)openGoldpassPreview\(\);else openActivityGoldpass\(\)/);
 assert.match(s,/if\(goldpassEntry\)goldpassEntry\.hidden=!managementAllowed/);
});
