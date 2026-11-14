"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const html=read("cloud-app.html");

test("#226 clan management shows plain actions and keeps detailed evidence behind a disclosure",()=>{
 const section=html.slice(html.indexOf('<section id="view-clan-management"'),html.indexOf('<section id="view-account"'));
 assert.ok(section.length>0);
 assert.match(section,/<h2 id="clanManagementTitle">Ränge prüfen<\/h2>/);
 assert.match(section,/Du entscheidest selbst – im Spiel ändert sich nichts automatisch/);
 assert.match(section,/Wann eine Beförderung prüfen\?/);
 assert.match(section,/Angriffsleistung berücksichtigen/);
 assert.match(section,/Mindestens belegte Angriffe/);
 assert.match(section,/Rückkehr prüfen ab \(Tage Abwesenheit/);
 assert.match(section,/<details class="clan-management-criteria clan-management-explanation"><summary>Wie entstehen diese Vorschläge\?<\/summary>/);
 assert.match(section,/maximal 3 Stunden Abstand/);
 assert.match(section,/Keine automatische Beförderung, Degradierung oder Änderung am CWL-Plan/);
 assert.doesNotMatch(section,/Leistungspfad aktiv|Treuepfad aktiv|Ränge & Nachweise/);
});

test("#226 review labels are clear, but permanent storage decisions and permission checks remain unchanged",()=>{
 assert.match(html,/\["Als geprüft markieren","acknowledged"\]/);
 assert.match(html,/\["Vorschlag ausblenden","exception"\]/);
 assert.match(html,/item.state==="acknowledged"\?"Geprüft"/);
 assert.match(html,/item.state==="exception"\?"Ausgeblendet"/);
 assert.match(html,/\?"Wieder anzeigen":"Prüfung wieder öffnen"/);
 assert.match(html,/cloud\.saveManagementReview\(/);
 assert.match(html,/!cloud\.active\|\|!cloud\.isOwner\(\)/);
 assert.match(html,/clan!==clanManagementContext/);
 const help=html.slice(html.indexOf('<section id="view-help"'),html.indexOf('<section id="view-clan-management"'));
 assert.match(help,/„Als geprüft markieren“/);
 assert.match(help,/„Vorschlag ausblenden“/);
 assert.match(help,/„Wieder anzeigen“/);
 assert.match(help,/„Prüfung wieder öffnen“/);
});

test("#226 copy release applies only to Cloud and preserves local PWA version",()=>{
 assert.match(html,/Neu in v1\.20\.1/);
 assert.match(html,/const APP_VERSION="v1\.20\.1"/);
 assert.equal(JSON.parse(read("cloud-version.json")).version,"v1.20.1");
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
 assert.match(read("CHANGELOG.md"),/\[1\.20\.1\]/);
});
