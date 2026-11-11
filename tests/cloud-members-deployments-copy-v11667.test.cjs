"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const html=read("cloud-app.html");

test("member and deployment entry text is concise and uses only existing controls",()=>{
 assert.match(html,/Wer ist bei der CWL dabei\?/);
 assert.match(html,/Jetzt abgleichen/);
 assert.match(html,/Keine passenden Mitglieder\. Suche oder Filter ändern/);
 assert.match(html,/3★-Quote · letzte 7 Angriffe/);
 assert.match(html,/Tagesregeln anzeigen ▾/);
 assert.match(html,/Tagesregeln schließen ▴/);
 assert.match(html,/el\.querySelector\("\.toggle-rules"\)\.textContent=expanded\?/);
 assert.match(html,/Tage verfügbar|Tagen verfügbar/);
 assert.match(html,/von \$\{state\.config\.days\} Tagen verfügbar/);
});

test("cloud deployment copy separates actual attacks, planned placements, availability and eight-star goals",()=>{
 assert.match(html,/Offene Einsätze ↓/);
 assert.match(html,/Ausgeführte Angriffe ↓/);
 assert.match(html,/Abstand zu 8★ ↑/);
 assert.match(html,/\?"Im Plan: ":"Ziel: "\)\+x\.played/);
 assert.match(html,/x\.exact\+" Einsätze · "/);
 assert.match(html,/in Clash bestätigte Angriffe/);
 assert.match(html,/Ein beendeter Krieg allein beweist keinen Angriff/);
 assert.match(html,/Geplante Einsätze ohne bestätigten Angriff/);
 const filters=read("cwl-deployment-filters.js");
 assert.match(filters,/target-open/);
 assert.match(filters,/target-met/);
 assert.match(filters,/reached/);
});

test("help explains the distinction to newcomers without naming a real clan member",()=>{
 const a=html.indexOf('<div class="help-item"><b>Filter in Einsätze</b>');
 const b=html.indexOf("</div></div>",a);
 assert.ok(a>0&&b>a);
 const portion=html.slice(a,b);
 assert.match(portion,/3\/4/);
 assert.match(portion,/1\/5/);
 assert.match(portion,/Im Plan: 3\/4 Einsätze/);
 assert.match(portion,/Ziel: 3\/4 Einsätze/);
 assert.match(portion,/unvollständigen Clash-Daten/);
 assert.doesNotMatch(portion,/Jamie|Pro_Gamer|Summarizer|Raphtor/);
 assert.match(html,/Die Mitgliederliste zeigt dagegen die letzten sieben erfassten CW-\/CWL-Angriffe/);
 assert.match(html,/kein Einsatzziel/);
});

test("copy-only Cloud release keeps the current public history and offline PWA intact",()=>{
 const version=JSON.parse(read("cloud-version.json"));
 const history=read("cloud-release-history.mjs");
 assert.equal(version.version,"v1.16.68");
 assert.match(html,/Neu in v1\.16\.68/);
 assert.match(history,/"version": "v1\.16\.68"/);
 assert.match(history,/"title": "Einsätze und Mitglieder verständlicher bedienen"/);
 assert.match(read("index.html"),/const APP_VERSION="v1\.0\.2"/);
 assert.match(html,/const DATA_VERSION=9/);
 assert.match(read("CHANGELOG.md"),/\[1\.16\.68\]/);
});
