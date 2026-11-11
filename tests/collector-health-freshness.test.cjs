"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const root=path.resolve(__dirname,"..");
const importStats=()=>import("file://"+path.join(root,"cwl-stats.mjs"));

test("a recent successful collector is informational, not a guaranteed complete war",async()=>{
 const {collectorHealthDisplay}=await importStats();
 const now=Date.parse("2026-11-06T21:05:00Z");
 const view=collectorHealthDisplay({last_success_at:"2026-11-06T20:05:00Z",last_error:null},true,now);
 assert.equal(view.state,"ok");
 assert.match(view.text,/Kriegsdaten zuletzt erfolgreich geprüft/);
 assert.match(view.text,/Laufende Kriege bleiben bis zum Abschluss vorläufig/);
});
test("an old success is visibly stale even if no error is recorded",async()=>{
 const {collectorHealthDisplay}=await importStats();
 const now=Date.parse("2026-11-06T21:05:00Z");
 const view=collectorHealthDisplay({last_success_at:"2026-11-06T17:05:00Z",last_error:null},true,now);
 assert.equal(view.state,"stale");
 assert.match(view.text,/möglicherweise verspätet/);
 assert.match(view.text,/Neue Angriffe könnten noch fehlen/);
});
test("a recent collector failure takes priority over a recent past success",async()=>{
 const {collectorHealthDisplay}=await importStats();
 const view=collectorHealthDisplay({
  last_success_at:"2026-11-06T20:05:00Z",last_error:"clash_api_unavailable:leaguewar:http_429"
 },true,Date.parse("2026-11-06T21:05:00Z"));
 assert.equal(view.state,"error");
 assert.match(view.text,/letzte automatische Abgleich ist fehlgeschlagen/);
 assert.doesNotMatch(view.text,/http_429|leaguewar/,"internal diagnostics stay out of the UI");
});
test("missing/invalid timestamps and disconnected mode are not presented as fresh",async()=>{
 const {collectorHealthDisplay}=await importStats();
 assert.equal(collectorHealthDisplay(null,true).state,"none");
 assert.equal(collectorHealthDisplay({last_success_at:"garbage"},true).state,"none");
 assert.equal(collectorHealthDisplay({last_success_at:"2026-11-06T20:05:00Z"},false).state,"none");
});
test("freshness UI stays within stats header without a new boxed warning",()=>{
 const html=fs.readFileSync(path.join(root,"cloud-app.html"),"utf8");
 const stats=fs.readFileSync(path.join(root,"cwl-stats.mjs"),"utf8");
 assert.match(html,/#statsCollectorHealth\[data-health="stale"\]/);
 assert.match(html,/id="statsCollectorHealth"/);
 assert.match(stats,/const presentation=collectorHealthDisplay\(collectorHealth,enabled\)/);
 assert.doesNotMatch(stats,/freshness\.innerHTML=/);
});
