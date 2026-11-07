# CWL Planer – aktuelle Projektübergabe (lebendes Dokument)

**Stand:** 07.11.2026, **Cloud v1.16.20 live**; #145 und #146 gemergt; P0-Entwurf für transaktional abgesicherte historische CWL-Missed-Korrektur auf Feature-Branch – **NICHT deployed**. Keine historische Datenkorrektur.  
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

### P0-Nächster Baustein – SQL-Transaktionsentwurf (nicht installiert!)

- Entwicklungsbranch: [feature/cwl-missed-atomic-rpc-design-20261107](https://github.com/Smolmig/cwl_planer/tree/feature/cwl-missed-atomic-rpc-design-20261107). **Noch kein produktiver Write**; der Entwurf unter `scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql` liegt **absichtlich NICHT** in `supabase/migrations`. Die aktive Edge Function und der Browser importieren/rufen keine neue RPC.
- Pure `prepareHistoricalCwlMissedRpc` in `collector-reconciliation.mjs` erstellt nach vollständig erfolgreicher offizieller Endkriegs-Vorprüfung ausschließlich kanonische Argumente **mit `p_apply:false`**; bei fehlendem `updated_at` oder abweichender offizieller Quelle keine Argumente.
- Entwurf `public.cwl_commit_verified_historical_missed`: `SECURITY INVOKER`, SQL-`current_user` muss `service_role` sein, `REVOKE` von `PUBLIC/anon/authenticated` und `GRANT` nur `service_role` in einer SQL-Transaktion. Unter fixer leerer `search_path` und kurzem Lock-Timeout: alle vier beteiligten Tabellen kurz sperren, verknüpften Clan, finalen Krieg, Versionszeitstempel, komplette sortierte Angriffe und bereits vorhandene Missed-Zeilen neu prüfen, fehlende Roster-Tags gegen bestätigte Vorschlagszeilen vergleichen. Erst bei separat explizit freigegebenem `p_apply=true`: Missed-Zeilen einfügen und Status im **selben** SQL-Aufruf setzen oder komplett zurückrollen.
- **Wesentliche Sicherheitsgrenze:** SQL kennt selbst keine originale Clash-API-Herkunft. Nur ein später separat reviewter geschützter Server-Pfad darf die Daten vom offiziellen Endpunkt holen, die Preview prüfen und die RPC aufrufen. Niemals Browserdaten als Beleg akzeptieren. Bestehender stündlicher Collector darf nicht automatisch historischen Write starten.
- Tests: `tests/collector-historical-cwl-atomic-rpc-design.test.cjs` prüft aktuell pure Argumenterzeugung und statische Privileg-/Transaktions-/Lock-Regeln. **NOCH KEIN echter PostgreSQL-Integrationstest**. Vor Freigabe: disposable PostgreSQL 17 mit Supabase-Rollen, tatsächliche SQL-Ausführung und Konfliktfälle (paralleler Collector, phantom Inserts, Double-Submit, Rollback, Lock-Timeout, Rollenverbote) sowie Security-Advisors und Backup testen.
- Kein Release-/Versionswechsel; `missed_log_complete` für alte unbestätigte Kriege bleibt **false**. Offizielle Quellen- und 29.10.-Lücke weiterhin offen. Ausführliche Gates [AUTO_STATS_COLLECTOR.md](AUTO_STATS_COLLECTOR.md).

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

1. **Zuerst GitHub-Main, aktuelle PRs, CI und Cloud-Version neu prüfen.** Die letzte vor diesem Entwurf abgeschlossene Arbeit #146 ist gemergt, 485/485 Main-Tests und Pages erfolgreich, Cloud v1.16.20 live.
2. Den Branch `feature/cwl-missed-atomic-rpc-design-20261107` und zugehörigen PR auf CI, konkrete Versionsunterschiede und SQL-Sicherheit prüfen. Design/Node-Tests dürfen gemergt werden; **die DRAFT-SQL gehört NICHT in Live-Migrationen und darf NICHT ausgeführt/deployed werden**.
3. **Nächstes P0-Gate:** SQL in eigener PostgreSQL-17-Testumgebung ausführen, Service-Rollen und RLS belegen, atomaren Rollback, konkurrierende Angriffs-INSERT/UPDATE und zwei gleichzeitige Korrekturen real testen. Bewertung der Tabellen-Locks (kurzer Global-Write-Block). Ohne echte Tests keine Produktionsmigration. Offizielle Endkriegsquelle muss separat vertrauenswürdig bezogen und mit `clan.attacks` abgeglichen werden.
4. Wenn P0-Gate nicht umsetzbar ist, danach überschaubare Statistik-UX #114 / App-UX #46 weiterführen; bei Live-UI nach UX-Regeln Mobile/Theme/Rollen und aktive CWL schützen.
5. Am Ende jeder Runde **diese Übergabe** mit echtem PR-/CI-/Merge-/Deploy-Status, offenen Risiken, nächsten Schritten und aktueller Live-Version aktualisieren; historische Daten nicht als verpasst oder vollständig erfinden.
