"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");

test("stats load status distinguishes finalized, unconfirmed and empty histories",async()=>{
  const {statsLoadNotice}=await import("../cwl-stats.mjs");
  const done={finalized:true},pending={finalized:false},legacy={};
  assert.equal(statsLoadNotice([]),"Noch keine Kriege gespeichert.");
  assert.equal(statsLoadNotice([done]),"Historie geladen · 1 abgeschlossener Krieg gespeichert.");
  assert.equal(statsLoadNotice([done,done,pending,legacy]),
    "Historie geladen · 2 abgeschlossene Kriege gespeichert · 2 weitere Kriege noch nicht bestätigt.");
  assert.equal(statsLoadNotice([pending]),
    "Historie geladen · Noch keine abgeschlossenen Kriege · 1 weiterer Krieg noch nicht bestätigt.");
  assert.equal(statsLoadNotice([legacy,legacy]),
    "Historie geladen · Noch keine abgeschlossenen Kriege · 2 weitere Kriege noch nicht bestätigt.");
  assert.equal(statsLoadNotice(null),"Noch keine Kriege gespeichert.");
});
