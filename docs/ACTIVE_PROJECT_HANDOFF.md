# CWL Planer – aktuelle Projektübergabe (lebendes Dokument)

**Stand:** 07.11.2026, Fortsetzung nach Cloud v1.16.19.  
**Verbindlich:** Diese Datei ist der **aktuelle Einstiegspunkt für jeden neuen Chat**. Historische Übergaben dokumentieren ältere Zustände und dürfen nicht als gegenwärtig gelten. Nach jeder Arbeitsrunde diesen Stand mit PR, Tests, Release und nächstem Schritt aktualisieren.

## 1. Sofortstart beim Chatwechsel

1. Aktuellen [GitHub-Main](https://github.com/Smolmig/cwl_planer), [Versionsmanifest](../cloud-version.json), offene PRs und Actions neu prüfen. Nie aus einem alten Chat einen Releasezustand behaupten.
2. Danach diese Übergabe, [UX-Leitlinien](UX_DESIGN_PRINCIPLES.md), [Changelog](../CHANGELOG.md) sowie die betroffenen Issues lesen.
3. Nächste offene Aufgabe in Feature-Branch bearbeiten, Regression hinzufügen, PR anlegen. CI vor Merge, Main-CI und Pages nach Merge kontrollieren.
4. Bei reiner UI-/Statistikarbeit **keine Änderung an produktiver Supabase-DB, Clanprofilen, Aufstellungen, Solver, RLS, Cloud-Rollen oder lokaler Offline-PWA**.

## 2. Nachgewiesener Ausgangsstand (07.11.2026)

- main war auf **Cloud v1.16.19**, gemergter [PR #143](https://github.com/Smolmig/cwl_planer/pull/143); das Versionsmanifest bestätigte v1.16.19.
- [Cloud-App live](https://smolmig.github.io/cwl_planer/cloud-app.html), zentrale Dateien cloud-app.html, cloud-sync.mjs, cwl-stats.mjs, cwl-stats-core.mjs.
- v1.16.17: Clash-Wechseltext auch nach erledigtem Wechsel kopieren; eintretende Spieler mit @ markieren.
- v1.16.18: Zwischen @Erwähnungen Leerzeichen statt Kommas; responsiver Kopierbutton in eigener Aktionszeile.
- v1.16.19: offene Tagesregeln, Tastaturfokus und Position bei Realtime-Refresh erhalten.
- Spielerduelle, Zeitdiagramme und Statistikform wurden zuvor in v1.16.12–v1.16.16 umfangreich verbessert; **nicht doppelt bauen**.
- Frühere [#49](https://github.com/Smolmig/cwl_planer/issues/49)-Anforderungen zu exakten Einsatzzielen, Rotation und Notizen wurden bereits in v1.6.0 umgesetzt. [NEXT_CHAT_HANDOFF.md](NEXT_CHAT_HANDOFF.md) ist historisch.

## 3. Laufende Änderung Cloud v1.16.20 – NICHT automatisch live

- **Branch:** [fix/stats-compare-war-type-focus-v11620](https://github.com/Smolmig/cwl_planer/tree/fix/stats-compare-war-type-focus-v11620).
- Bezug: [Statistik-UX #114](https://github.com/Smolmig/cwl_planer/issues/114), [Statistik 3.0 #110](https://github.com/Smolmig/cwl_planer/issues/110).
- **Problem:** Unter Statistik > Vergleiche zeigte die erste Dreierspalte immer CW niedriger/gleich und CWL gleich. Bei Auswahl von „Nur CW“ oder „Nur CWL“ entstanden dadurch leere, inhaltlich irrelevante Vergleichsflächen sowie eine nicht passende Detailgruppe.
- **Lösung:** „CW und CWL“ behält die drei bisherigen Cross-League-Kategorien. „Nur CW“ zeigt normale Clankriege gegen niedrigeres, gleiches und höheres Gegner-RH. „Nur CWL“ zeigt die drei entsprechenden CWL-Kategorien. Aufgeklappte Detailgruppen enthalten nur die ausgewählte Kriegsart und behalten beim Filterwechsel ihren Öffnungszustand.
- Kennzahlen sind ausschließlich dokumentierte Dreierquoten mit echten Angriffszahlen, keine Erfolgsprognosen. Vergleichszeitraum und die freie Spielerstatistik bleiben getrennt. Ohne Angriffe keine erfundene 0-%-Quote.
- **Code:** cwl-stats.mjs; Cache-/App-Version in cloud-app.html, cloud-sync.mjs und cloud-version.json; CHANGELOG.md und README.txt ergänzt.
- **Test:** zusätzlicher echter Chromium-Fall in tests/cloud-duel-comparison-clarity.test.cjs für 320/390/1366 px, Gold/Light/Dark, alle Vergleichsfilter, isolierte freie Spielerstatistik und offenen Detailzustand.
- **Release-Gate:** PR-CI, Main-CI, Pages und offizielles Release erst nach tatsächlichem Nachweis als bestätigt markieren; echte iOS-/Android-Abnahme separat. Keine DB-/Solver-/Auth-/Offline-Änderung.

## 4. Priorisierte offene Themen (immer frisch verifizieren)

1. **P0 – Datenintegrität:** [#104](https://github.com/Smolmig/cwl_planer/issues/104) autonomer Collector und Endkriegs-/Missed-Attack-Nachweise. Der signierte Cron wurde am 07.11. nachgewiesen, vollständige Endkriegs-/Misses-Abnahme bleibt offen. [Draft-PR #142](https://github.com/Smolmig/cwl_planer/pull/142) nicht blind deployen.
2. **Statistik-UX:** [#114](https://github.com/Smolmig/cwl_planer/issues/114), [#110](https://github.com/Smolmig/cwl_planer/issues/110), [#96](https://github.com/Smolmig/cwl_planer/issues/96). Klare CW/CWL-Quellen, n/Fallzahlen, Zeitraum und aussagekräftige Diagramme; weitere punktuelle mobile/desktop Praxisabnahme.
3. **Spielerform/Multi-Clan:** [#88](https://github.com/Smolmig/cwl_planer/issues/88) und [#103](https://github.com/Smolmig/cwl_planer/issues/103). UF 2 und fremde Clans nur mit datenschutzgerechter Freigabe; kein unvalidiertes Skill-Ranking oder RH-übergreifende Verzerrung.
4. **Planungsmodi:** [#44](https://github.com/Smolmig/cwl_planer/issues/44) ist Forschung/Konzept; keinerlei Live-Solveränderung ohne ausdrückliche Fachfreigabe.
5. **App-UI:** [#46](https://github.com/Smolmig/cwl_planer/issues/46), [#118](https://github.com/Smolmig/cwl_planer/issues/118). Designregel: „Wichtiges zuerst, mit Abstand statt Kästen gruppieren, Bedienkontext bei Refresh erhalten“.

Alte Drafts [#45](https://github.com/Smolmig/cwl_planer/pull/45), [#109](https://github.com/Smolmig/cwl_planer/pull/109), [#92](https://github.com/Smolmig/cwl_planer/pull/92), [#95](https://github.com/Smolmig/cwl_planer/pull/95), [#97](https://github.com/Smolmig/cwl_planer/pull/97) nicht ungeprüft mergen. Unvollständige CWL-/ClashPerk-Imports dürfen **nicht** als 0 versäumte Angriffe erscheinen.

## 5. Verbindliche Arbeits- und Dokumentationsweise

- Nutzer möchte proaktiv an der nächsten offenen Aufgabe weiterarbeiten und **sämtliche Entscheidungen/Arbeitsschritte auf GitHub dokumentiert** haben, damit ein Chatwechsel nahtlos möglich ist.
- Jeder Patch: Problem und Ursache, betroffene Dateien, Daten-/Sicherheitsgrenzen, Regression/CI, PR-/Merge-/Deploymentnachweis, verbleibende Risiken und nächste Priorität in PR, Changelog und **dieser Übergabe**.
- Kleine Stichprobe (1/1, 2/2 = 100 %) nie als endgültige Spielerstärke darstellen. Gegner-RH, CW vs. CWL, Datum, Quelle und Anzahl nennen.
- Bei Auto-Refresh Filter, Scrollposition, aktiven Tab, Fokus und offene Details erhalten. Gold-/Dark-/Light-Themes, 320/390/430/1366 px und Beobachterrolle testen.
- Keine Tests gegen den produktiven Plan oder produktive DB-Änderungen. Separate lokale Offline-App mit historischen Daten respektieren.

## 6. Nächster Chat / nächste Arbeit

1. Branch-/PR- und CI-Status für Cloud v1.16.20 prüfen; nicht als live ausgeben, solange Main + Pages nicht bestätigt.
2. Fehlgeschlagene Tests am tatsächlichen Fail beheben und wiederholen; nur grünes Ergebnis mergen.
3. Danach entweder weitere konkrete Punkte aus [#114](https://github.com/Smolmig/cwl_planer/issues/114) / [#46](https://github.com/Smolmig/cwl_planer/issues/46) abarbeiten oder die höhere P0-Collector-Arbeit [#104](https://github.com/Smolmig/cwl_planer/issues/104) fortsetzen.
4. **Am Ende jeder Runde diese Datei aktualisieren**, inkl. aktueller Head-SHA, PR/Release, CI-Stand, offene Probleme und sofort nächster Schritt.
