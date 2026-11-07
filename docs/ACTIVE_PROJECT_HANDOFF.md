# CWL Planer – aktuelle Projektübergabe (lebendes Dokument)

**Stand:** 08.11.2026, **Cloud v1.16.20 live**; #145–#147 gemergt. Neues P0-Quellprüfungsmodul mit Staging-Checkliste auf Feature-Branch, nicht produktiv. **Keine historischen Korrekturen, Migration oder Edge-Änderung.**  
**Verbindlich:** Diese Datei ist der **aktuelle Einstiegspunkt für jeden neuen Chat**. Historische Übergaben dokumentieren ältere Zustände und dürfen nicht als gegenwärtig gelten. Nach jeder Arbeitsrunde diesen Stand mit PR, Tests, Release und nächstem Schritt aktualisieren.

## 1. Sofortstart beim Chatwechsel

1. Aktuellen [GitHub-Main](https://github.com/Smolmig/cwl_planer), [Versionsmanifest](../cloud-version.json), offene PRs und Actions neu prüfen. Nie aus einem alten Chat einen Releasezustand behaupten.
2. Danach diese Übergabe, [UX-Leitlinien](UX_DESIGN_PRINCIPLES.md), [Changelog](../CHANGELOG.md) sowie die betroffenen Issues lesen.
3. Nächste offene Aufgabe in Feature-Branch bearbeiten, Regression hinzufügen, PR anlegen. CI vor Merge, Main-CI und Pages nach Merge kontrollieren.
4. Bei reiner UI-/Statistikarbeit **keine Änderung an produktiver Supabase-DB, Clanprofilen, Aufstellungen, Solver, RLS, Cloud-Rollen oder lokaler Offline-PWA**.

## 2. Nachgewiesener Ausgangsstand (07.11.2026)

- main ist auf **Cloud v1.16.20**, [PR #144](https://github.com/Smolmig/cwl_planer/pull/144) gemergt am 07.11. (Commit `5b0a0468`); **474/474 PR-CI erfolgreich**, Main-CI, GitHub Pages und [offizielles Release v1.16.20](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.20) am 07.11. erfolgreich. Reale Smartphone-Praxis bleibt separat.
- [Cloud-App live](https://smolmig.github.io/cwl_planer/cloud-app.html), zentrale Dateien cloud-app.html, cloud-sync.mjs, cwl-stats.mjs, cwl-stats-core.mjs.
- v1.16.17: Clash-Wechseltext auch nach erledigtem Wechsel kopieren; eintretende Spieler mit @ markieren.
- v1.16.18: Zwischen @Erwähnungen Leerzeichen statt Kommas; responsiver Kopierbutton in eigener Aktionszeile.
- v1.16.19: offene Tagesregeln, Tastaturfokus und Position bei Realtime-Refresh erhalten.
- Spielerduelle, Zeitdiagramme und Statistikform wurden zuvor in v1.16.12–v1.16.16 umfangreich verbessert; **nicht doppelt bauen**.
- Frühere [#49](https://github.com/Smolmig/cwl_planer/issues/49)-Anforderungen zu exakten Einsatzzielen, Rotation und Notizen wurden bereits in v1.6.0 umgesetzt. [NEXT_CHAT_HANDOFF.md](NEXT_CHAT_HANDOFF.md) ist historisch.

## 3. Zuletzt abgeschlossen & aktueller P0-Audit (kein App-Release)

### Cloud v1.16.20 – veröffentlicht, 07.11.2026

- [PR #144](https://github.com/Smolmig/cwl_planer/pull/144) merged: Statistik > Vergleiche zeigt bei „Nur CW“ drei passende CW-Rathausgruppen, bei „Nur CWL“ die drei CWL-Gruppen; kombinierter Vergleich unverändert. Aufgeklappte Details überstehen Filterwechsel, unabhängige Spielerstatistik bleibt isoliert.
- **474/474 Tests auf PR-Head erfolgreich**, Main-Regression [42417285128](https://github.com/Smolmig/cwl_planer/actions/runs/42417285128) erfolgreich, [GitHub Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42417284660) erfolgreich und [offizielles Release](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.20) publiziert. Keine DB-/Solver-/Offline-PWA-Änderung.
- Die neue Übergaberegel ist in `AGENTS.md` verankert. Diese Datei ist bei jedem Chatwechsel zu lesen und mit dem echten aktuellen Stand fortzuschreiben.

### Issue #104 – read-only Collector-/Missed-Audit, 07.11.2026

- **[PR #145](https://github.com/Smolmig/cwl_planer/pull/145) gemergt** am 07.11.2026 (Squash-Commit `f6ea5b6e`), **476/476 PR-Tests grün** ([GitHub Actions 42417829737](https://github.com/Smolmig/cwl_planer/actions/runs/42417829737)). SQL wurde zusätzlich *nur lesend* gegen die produktive Datenbank ausgeführt. Main-Regression [42418047000](https://github.com/Smolmig/cwl_planer/actions/runs/42418047000) und Pages [42418046703](https://github.com/Smolmig/cwl_planer/actions/runs/42418046703) nach Dokumentationsupdate ebenfalls erfolgreich. **Keine Datenmutation, kein Cloud-Versionswechsel, kein Produktions-Edge-Deploy.**
- Mindestens **drei selbstständige `schedule`-Läufe** sind erfolgreich: [07:28](https://github.com/Smolmig/cwl_planer/actions/runs/42351395780), [14:58](https://github.com/Smolmig/cwl_planer/actions/runs/42384101005), [19:31 UTC](https://github.com/Smolmig/cwl_planer/actions/runs/42406623454). GitHub Cron bleibt Best-Effort; keine lückenlose Garantie.
- **Supabase Edge Collector v5** ist aktiv. 3 Clanprofile hatten bei Abfrage 19:31 UTC letzte Erfolge 19:31:41–50 UTC, 0 gespeicherte Fehler und 45 beobachtete Angriffe (über Profile aufsummiert).
- Produktiver, **nur lesender** Datenqualitäts-Befund: 33 CWL-App-Clan-Kriegszeilen, 31 final und 2 vorläufig. Von 31 finalen sind 21 Import-Zeilen als Missed-vollständig gekennzeichnet; die **10 finalen API-Kriegszeilen ohne Missed-Nachweis** decken **7 eindeutige Clash-War-Keys** ab. Sechs der 10 (fünf eindeutige) dokumentieren 15/15 individuelle Angriffe und volle Roster; zwei (ein Krieg) 14/15; zwei (ein Krieg) 13/15. **Fehlender gespeicherter Angriff ist KEIN bewiesener verpasster Angriff.**
- Die Originalquelle `clan.attacks` (offizieller clanweiter Angriffs-Zähler) wurde für diese historischen finalen Zeilen nicht persistiert; deshalb weder die sechs 15/15-Zeilen automatisch als Missed-vollständig setzen noch die übrigen als Misses werten.
- Reproduzierbares SQL [`scripts/collector-cwl-missed-coverage.sql`](../scripts/collector-cwl-missed-coverage.sql) – aggregiert, tenant-sichere Joins und unterschiedliche App-Clan-/Spiel-Kardinalitäten. Safety-Regression `tests/collector-cwl-missed-coverage-sql.test.cjs`. Ausführlich [AUTO_STATS_COLLECTOR.md](AUTO_STATS_COLLECTOR.md).
- **Nächster P0-Gate:** Eigener geprüfter Reconciliation-Entwurf ausschließlich mit noch abrufbarem originalen abgeschlossenen Clash-API-Endstand und echtem Attack-Counter; Quellnachweis, Auth, RLS, Fehler-/Retry-Verhalten und Idempotenz separat prüfen, **kein stilles Backfill**. Wenn Quelle nicht mehr verfügbar, bleibt Unbekannt bestehen. Historische Lücke 29.10. weiterhin offen.

### P0-Baustein #146 – historische CWL-Missed-Vorprüfung (gemergt, NICHT deployed)

- **[PR #146](https://github.com/Smolmig/cwl_planer/pull/146) gemergt** am 07.11.2026 (Squash-Commit `217613f2`), **485/485 PR-Tests erfolgreich** ([Run 42421650031](https://github.com/Smolmig/cwl_planer/actions/runs/42421650031), 0 Fehler). Das ist **ein reines serverseitiges, unverkabeltes Vorschau-Modul**; keine Cloud-Versionsanhebung, keine historische DB-Mutation und keine Änderung an der aktiven Supabase-Edge-Version v5. Main-Regression [42421810188](https://github.com/Smolmig/cwl_planer/actions/runs/42421810188) mit **485/485 Tests erfolgreich**, Pages [42421809658](https://github.com/Smolmig/cwl_planer/actions/runs/42421809658) sowie offizieller unveränderter Cloud-Release-Workflow [42421919370](https://github.com/Smolmig/cwl_planer/actions/runs/42421919370) erfolgreich.
- `supabase/functions/coc-stats-collector/collector-reconciliation.mjs` stellt `previewHistoricalCwlMisses` bereit. Ohne gültigen `warEnded`-Snapshot vom authentifizierten offiziellen Clash-Endpunkt samt **offiziellem `clan.attacks`-Zähler** keine Bestätigung. Auch verifizierte 15/15 gespeicherte Angriffe allein reichen ausdrücklich nicht.
- Für einen berechtigten App-Clan müssen exakt passende `clan_id`, Kriegsart, War-Key, separat geprüfter API-WarTag, Beginn, Gegner, vollständiges Roster sowie **sämtliche gespeicherten Angriffe** mit API-Angriffen (Identität, RH, Ziel, Sterne, Schaden) übereinstimmen. Andere Clanprofile, laufende/nicht finale Kriege, bestehende Missed-Zeilen, Imports, unvollständige oder abweichende Daten werden **abgelehnt**.
- Ergebnis nur intern: `eligible`, explizite `confirmedMissedCount` **oder `null` (unbekannt)**, private Vorschlagszeilen; **kein API-/DB-Zugriff, kein Logger, kein Schreibpfad**. Tests: `tests/collector-historical-cwl-missed-preview.test.cjs` mit 15/15, 14/15, 13/15, 0/15, 30er, unbekannten Zählern, Manipulation, fehlenden Daten, tenantübergreifenden Risiken, widersprüchlichen Angriffen.
- Dokumentation in [AUTO_STATS_COLLECTOR.md](AUTO_STATS_COLLECTOR.md) ergänzt. **Release-Gate:** Erst GitHub-PR-CI, Code-Review, Main-CI. Da das Modul nicht importiert/aufgerufen wird, gibt es kein Live-Reconciliation-Verhalten. Späterer Writer erfordert eigenständige Freigabe, autorisierten serverseitigen Fetch, transaktionalen Konfliktschutz, Write-Order, Retries und echte Quellabnahme. Historische Lücken weiterhin unbekannt lassen.
- Der vorherige PR #145 hatte nach Merge **erfolgreiche Main-Regression [42418047000](https://github.com/Smolmig/cwl_planer/actions/runs/42418047000)** und **Pages [42418046703](https://github.com/Smolmig/cwl_planer/actions/runs/42418046703)**; offizielles Cloud-Release bleibt v1.16.20.

### P0-Baustein #147 – atomarer SQL-Transaktionsentwurf gemergt (nicht installiert!)

- **[PR #147](https://github.com/Smolmig/cwl_planer/pull/147) gemergt** am 07.11.2026 (Squash-Commit `8d457463`). Der Entwurf `scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql` liegt **absichtlich NICHT** in `supabase/migrations`, ist NICHT in Supabase installiert und wird weder im produktiven Collector noch im Browser aufgerufen. **Kein produktiver Write.**
- Pure `prepareHistoricalCwlMissedRpc` in `collector-reconciliation.mjs` erstellt nach vollständig erfolgreicher offizieller Endkriegs-Vorprüfung ausschließlich kanonische Argumente **mit `p_apply:false`**; bei fehlendem `updated_at` oder abweichender offizieller Quelle keine Argumente.
- Entwurf `public.cwl_commit_verified_historical_missed`: `SECURITY INVOKER`, SQL-`current_user` muss `service_role` sein, `REVOKE` von `PUBLIC/anon/authenticated` und `GRANT` nur `service_role` in einer SQL-Transaktion. Unter fixer leerer `search_path` und kurzem Lock-Timeout: alle vier beteiligten Tabellen kurz sperren, verknüpften Clan, finalen Krieg, Versionszeitstempel, komplette sortierte Angriffe und bereits vorhandene Missed-Zeilen neu prüfen, fehlende Roster-Tags gegen bestätigte Vorschlagszeilen vergleichen. Erst bei separat explizit freigegebenem `p_apply=true`: Missed-Zeilen einfügen und Status im **selben** SQL-Aufruf setzen oder komplett zurückrollen.
- **Wesentliche Sicherheitsgrenze:** SQL kennt selbst keine originale Clash-API-Herkunft. Nur ein später separat reviewter geschützter Server-Pfad darf die Daten vom offiziellen Endpunkt holen, die Preview prüfen und die RPC aufrufen. Niemals Browserdaten als Beleg akzeptieren. Bestehender stündlicher Collector darf nicht automatisch historischen Write starten.
- **PR-Tests grün:** [App-Regression 42422933843](https://github.com/Smolmig/cwl_planer/actions/runs/42422933843) **491/491**, [isolierte PostgreSQL-17-Integration 42422933401](https://github.com/Smolmig/cwl_planer/actions/runs/42422933401) **erfolgreich**. **Merge-Main grün:** [491/491 Tests 42423086862](https://github.com/Smolmig/cwl_planer/actions/runs/42423086862), [PG17-Integration 42423086882](https://github.com/Smolmig/cwl_planer/actions/runs/42423086882), [GitHub Pages 42423086387](https://github.com/Smolmig/cwl_planer/actions/runs/42423086387). SQL wurde nur im **synthetischen CI-PostgreSQL**, niemals in Supabase ausgeführt. Validiert: Rollenrechte, Trockenlauf, stale Angriffe, Rollback unter künstlichem Fehler, getrennte App-Clans, idempotenter Abbruch sowie Lock-Timeout bei parallelem Writer. **Kein Supabase-Staging/Produktivdeploy.** Vor jeder Migration: Produktiv-RLS/Trigger/Lock-Last in wirklich Supabase-äquivalentem Staging und Security-Advisors prüfen.
- Kein Release-/Versionswechsel; `missed_log_complete` für alte unbestätigte Kriege bleibt **false**. Offizielle Quellen- und 29.10.-Lücke weiterhin offen. Ausführliche Gates [AUTO_STATS_COLLECTOR.md](AUTO_STATS_COLLECTOR.md).

### P0 – offizieller CWL-Endkriegsabruf, nicht deployed (08.11.2026)

- Branch: [feature/collector-official-endwar-source-gate-20261108](https://github.com/Smolmig/cwl_planer/tree/feature/collector-official-endwar-source-gate-20261108), noch PR-CI und Merge prüfen. Keine Cloud-Version, DB, RPC, Edge- oder Scheduler-Änderung.
- Neues `supabase/functions/coc-stats-collector/collector-reconciliation-source.mjs`, **nicht in den Live-Collector oder die PWA importiert**. Prüft einen gültigen berechtigten Tenant samt finalem API-CWL-Krieg vor Netzwerkzugriff, ruft die CWL-Gruppe über den fixen Clash-Proxy ab, bestätigt genau einen unabhängigen WarTag-Treffer und holt nur dann den Endkrieg. Der bestehende Vorprüfer erstellt ausschließlich `p_apply:false`.
- Netzwerk nur mit servergehaltenem `COC_API_KEY`, maximal 2 GETs zum festen Clash-Proxy, redirects deaktiviert, 8-s-Timeout, JSON- und Größenprüfung. Upstream-Fehler sind sichere Codes ohne Rohdaten/Tags/Tokens. Es ist **kein kryptografisch signierter Supercell-Beleg**: der bestehende RoyaleAPI-Proxy liefert offiziell strukturierte Clash-Daten.
- Fehlt die alte Liga-Gruppe/WarTag, ein tatsächlicher abgeschlossener Kriegsstand, der offizielle Angriffs-Zähler oder ein vollständiger Datenabgleich, bleibt Missing unbekannt, **keine Korrektur**.
- Regression `tests/collector-official-endwar-source.test.cjs` (synthetisch): API-/Gruppenbeleg, 0/1 Misses, 404/403/429/5xx, falsche Daten, getrennte App-Clans und fehlende Live-Anbindung. CI-Ergebnis separat prüfen.
- Neue [COLLECTOR_RECONCILIATION_STAGING_CHECKLIST.md](COLLECTOR_RECONCILIATION_STAGING_CHECKLIST.md), ergänzte [AUTO_STATS_COLLECTOR.md](AUTO_STATS_COLLECTOR.md): expliziter Staging-RLS-/Lock-/Security-/Backup-Gate. **Kein Staging-Projekt angelegt und keine Live-Datenbank-Mutation**.
- Zuvor #147 Main-CI [42423214098](https://github.com/Smolmig/cwl_planer/actions/runs/42423214098) 491/491, Pages [42423213088](https://github.com/Smolmig/cwl_planer/actions/runs/42423213088) und Release-Workflow [42423337529](https://github.com/Smolmig/cwl_planer/actions/runs/42423337529) erfolgreich. Cloud bleibt v1.16.20.
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

1. `main`, aktuelle Actions/Pages, offene PRs, Cloud v1.16.20 und Issue #104 **neu prüfen**. #145/#146/#147 gemergt; bisher weder Live-Reconciliation noch historische Korrektur.
2. Branch `feature/collector-official-endwar-source-gate-20261108` samt neuem PR, Regression und CI abnehmen; bei grüner CI sicher mergen, Main-CI/Pages prüfen und **diese Übergabe auf echten Merge-Stand ändern**.
3. **Nächstes P0-Gate:** in echter isolierter Supabase-Staging-Instanz produktionsähnliche Rollen/RLS/Trigger/Lock-Last prüfen; unabhängige alte offizielle WarTags ggf. read-only abrufen. Ohne originale API-Evidenz **keine Missed-Zahlen schätzen**.
4. Erst nach ausdrücklicher Freigabe, Backup/Rollback, separat überprüftem server-only Caller und Staging-Abnahme eine echte Migration und Edge-Anbindung erwägen. DRAFT-SQL und das neue Quellenmodul sind **nicht deployed**.
5. Wenn alte Clash-Endkriegsquellen nicht mehr verfügbar sind, #104 als historische Quellenlücke dokumentieren und zu Statistik-UX #114 oder App-UX #46 übergehen. Alle Schritte/CI/Release fortlaufend auf GitHub dokumentieren.
