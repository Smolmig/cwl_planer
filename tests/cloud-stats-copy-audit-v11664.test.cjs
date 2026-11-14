"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("#226: stats overview and form show concise language, detail stays in disclosures and help",()=>{
 const html=read("cloud-app.html");
 assert.match(html,/Ergebnisse aus allen gespeicherten, abgeschlossenen Kriegen/);
 assert.match(html,/<summary>Welche Kriege zählen\?<\/summary>/);
 assert.match(html,/Datenbasis anpassen/);
 assert.match(html,/Formwert \(empfohlen\)/);
 assert.match(html,/<option value="hitRate">3★-Quote<\/option>/);
 assert.doesNotMatch(html,/<option value="attacks">Angriffe auf gleiches RH<\/option>/);
 assert.match(html,/Wilson-Untergrenze/);
 assert.match(html,/id="statsFormDetails"/);
 assert.match(html,/Formwert.*Zuverlässigkeit/);
 assert.doesNotMatch(html,/Nur 3★-Quote \(roh\)|Anzahl gleich-RH-Angriffe|Eigenständige Formanalyse aus der gesamten/);
 const stats=read("cwl-stats.mjs");
 assert.match(stats,/unassessed\+" ohne gleich-RH-Angriffe/);
 assert.match(stats,/Sortiert nach Formwert/);
 assert.match(stats,/Leistungswert/);
 assert.match(stats,/Keine gleich-RH-Angriffe/);
 assert.match(stats,/stats-form-player-details/);
 assert.match(stats,/computePlayerFormWindows\(wars,attacks/);
});

test("#226: automatic collection status is plain German without leaking internal errors",async()=>{
 const {collectorHealthDisplay}=await import("file://"+path.join(root,"cwl-stats.mjs"));
 const now=Date.parse("2026-11-11T12:00:00Z");
 const ok=collectorHealthDisplay({last_success_at:"2026-11-11T11:00:00Z"},true,now);
 assert.equal(ok.state,"ok");
 assert.match(ok.text,/Kriegsdaten zuletzt erfolgreich geprüft/);
 assert.match(ok.text,/Laufende Kriege bleiben bis zum Abschluss vorläufig/);
 const stale=collectorHealthDisplay({last_success_at:"2026-11-11T07:00:00Z"},true,now);
 assert.equal(stale.state,"stale");
 assert.match(stale.text,/möglicherweise verspätet/);
 assert.match(stale.text,/Neue Angriffe könnten noch fehlen/);
 const bad=collectorHealthDisplay({last_error:"internal_secret_http_429",last_success_at:"2026-11-11T11:00:00Z"},true,now);
 assert.equal(bad.state,"error");
 assert.match(bad.text,/letzte automatische Abgleich ist fehlgeschlagen/);
 assert.doesNotMatch(bad.text,/internal_secret|http_429|Collector|Server-Abgleich/);
 assert.equal(collectorHealthDisplay(null,true,now).state,"none");
 assert.equal(collectorHealthDisplay(null,false,now).state,"none");
});
