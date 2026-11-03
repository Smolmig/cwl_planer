> **Historischer Stand:** Diese Übergabe dokumentiert die Entwicklungsplanung **vor Cloud v1.6.0**. Der Gesamt-Release wurde am 03.11.2026 über [PR #56](https://github.com/Smolmig/cwl_planer/pull/56) veröffentlicht. Für den aktuellen Stand siehe [Cloud v1.6.0](https://github.com/Smolmig/cwl_planer/releases/tag/v1.6.0) und die offenen Punkte in [Issue #46](https://github.com/Smolmig/cwl_planer/issues/46) / [#44](https://github.com/Smolmig/cwl_planer/issues/44). Alte Draft-PRs #50–#55 wurden durch #56 ersetzt und dürfen nicht erneut gemergt werden. Diese Datei bleibt zur Nachvollziehbarkeit erhalten.

# CWL-Planer – aktiver Entwicklungsstand (nach Cloud v1.5.2)
**Datum:** 03.11.2026. **Status:** Entwicklungsstand, **nicht live**. Diese Notiz ergänzt `docs/NEXT_CHAT_HANDOFF.md` auf `main`; die alte Übergabe beschreibt weiterhin korrekt den produktiven Stand und den ursprünglichen Backlog.

## Einstieg in einem neuen Chat
1. `main`, `cloud-version.json`, PRs [#50](https://github.com/Smolmig/cwl_planer/pull/50), [#51](https://github.com/Smolmig/cwl_planer/pull/51), [#52](https://github.com/Smolmig/cwl_planer/pull/52), [#53](https://github.com/Smolmig/cwl_planer/pull/53) und [Issue #49](https://github.com/Smolmig/cwl_planer/issues/49) **live erneut abfragen**. Nichts anhand bloßer Erinnerungen als gemergt behandeln.
2. `main` war zuletzt `b9f9019430b2668463bfe853e8b3a0b9aaaa24ca`, Cloud `v1.5.2`, separate Offline-`index.html` `v1.0.2`. Kein Entwicklungscode nach `main` übertragen, keine Supabase-Produktivdaten verändert.
3. Der Integrationsbranch `integration/cwl-planner-roster-review` (Draft-PR #53) kombiniert die isolierten Änderungen; die einzelnen PRs bleiben gegen `main` reviewbar. **Nicht blind GitHub-PRs mergen** oder alte PR #45 wiederverwenden.
4. GitHub Actions aktuellsten PR-Head via `fetch_commit_workflow_runs` prüfen; nicht die grüne CI eines älteren Commits als aktuellen Stand ausgeben. Die vollständigen Tests laufen mit `node --test tests/*.test.cjs` und Playwright/Chromium in GitHub Actions.
5. Restarbeiten: synthetische/Browser-/Cloud-Rollen-Prüfung, nachvollziehbare Release-Checkliste, dann **geplante** Versionierung/Cache/Deployment. Keine spontane produktive Cloud-Write-Probe.

## Implementiert – **nur im Draft**
| PR | Bestandteil | Dateien / wichtige Tests |
|----|-------------|-------------------------|
| #50 | Globaler Constraint-Solver mit **exakt N Einsätzen** über alle Kriege statt Greedy, Konflikte hart sichtbar, Fix/MUSS/RAUS/Gespielt/15-30-50 Plätze, 3 einfache Rotationsstufen; alte Prio 0–5 bis zur bewussten Umstellung unverändert | `cwl-planning-core.js`, `cloud-app.html`, `cloud-sync.mjs`, `tests/cwl-planning-core.test.cjs`, `tests/cwl-plan-approval-validation.test.cjs`, `tests/cwl-rotation-weight-migration.test.cjs` |
| #51 | **Sichere Wiedereintritte**: Spielerstatus vor dem Austritt anhand Player-Tag sichern, nur automatisch veränderte/nicht bewusst editierte Werte bei Rückkehr herstellen. Historische/gesperrte Lineups erhalten, CWL-Neustart leert alte Tagesregeln. Leere, ungültige und duplizierte API-Kader blockieren; ungewöhnlich viele Austritte manuell bestätigen. **Verspätete API-Antworten** und veraltete Revisionen nie in anderen Clanplan übernehmen | `cloud-sync.mjs`, `cloud-app.html`, `tests/cloud-roster-rejoin-state.test.cjs`, `tests/cloud-roster-upstream-guard.test.cjs`, `tests/cloud-roster-request-race.test.cjs` |
| #52 | Spielernotizen max. **200 Zeichen**, Escaping, Rollen. Im verknüpften Clan sind API-geführte Namen/RH im Normalmodus schreibgeschützt, kein versteckter Add-/CSV-/Lösch- oder RH-Bulk-Bypass. **Expliziter Cloud-Notfallmodus** bei Clash-API-Ausfall; gespeichertes `cocManualEmergency.pending` pausiert auto-API-Abgleich bis zur bestätigten Rückkehr zu den API-Daten. Backup-/Profilkopie behält den Pending-Vermerk | `cloud-app.html`, `cloud-sync.mjs`, `tests/cloud-member-notes.test.cjs`, `tests/cloud-api-emergency.test.cjs`, `tests/cloud-api-manual-entry-guard.test.cjs`, `tests/cloud-emergency-backup.test.cjs`, `tests/cloud-two-client-conflict.test.cjs` |
| #53 | **Integration der obigen Bausteine**. Testet exaktes Ziel, Wiedereintritt, Notizen, API-Fallback und Simulationskonflikte gemeinsam | `tests/cwl-combined-features.test.cjs`, `tests/cloud-combined-browser.test.cjs` (Chromium Mobile/Desktop, synthetische Gastdaten, keine echte Cloud), alle übrigen Tests aus #50–#52 |

### Präzise Grenzen und wichtige Datenregeln
- **Spezialfall „Genau 7“**: für einen 7-Tage-Rotationsspieler **nicht wählbar**; dafür `Fix`. Historische Altziele nicht heimlich uminterpretieren.
- `rotationWeight` (preferred/balanced/less) ist weich, exakte Ziele sind hart. Alte `priority` Werte werden niemals ohne ausdrückliche Benutzeraktion in neue Stufen umgemappt.
- `cocBeforeDeparture` enthält Kopien der letzten gültigen Planungsfelder; individuell veränderte Werte während der Abwesenheit nicht überschreiben; bereits gespielte Kriege bleiben unverändert.
- `cocManualEmergency.pending` gehört zum **Cloud-Profil-JSON**, nicht bloß zu lokalem Storage. Der Vermerk muss in Realtime, Backup/Kopie und nach zweitem Gerätestart erhalten bleiben, damit kein automatischer Clash-Abgleich manuelle Notfallkorrekturen überschreibt.
- `getRoster` bindet verzögerte Abfragen an `clanId`, Profil-ID, `accountEpoch`, `revision` und eine Request-Seriennummer. `applyRoster` prüft den Kontext auch **nach** einem Bestätigungsdialog; ungültiger Vergleich verlangt erneuten Abgleich.
- `cloud-sync.mjs` benutzt für Save `revision`-CAS; konkurrierende Browser dürfen sich nicht still gegenseitig überschreiben. `tests/cloud-two-client-conflict.test.cjs` simuliert zwei Geräte. **Kein Nachweis für echte Internet-/Supabase-Realtime-End-to-End-Funktionalität**.
- `index.html` bleibt die eigenständige Offline-PWA. Gäste in `cloud-app.html` dürfen ihre lokalen manuellen Mitglieder weiter verwalten.
- Keine eigene Supabase-Staginginstanz. Productive API-Daten nicht verändern, nur um Tests auszuführen.

## Release-Gates, weiterhin offen
1. **CI des neuesten Heads** von #50–#53 vollständig grün; insbesondere dynamisch geänderte PR-Heads neu prüfen.
2. Browser/Interaktion: iPhone Safari auf echter Hardware und Desktop, Dark/Light/Gold-Arena; Notizdialog, API-normales und Notfall-Bearbeiten, Fix-Ziel-Ausblenden, 15/30 Spieler pro Tag und gespielte Tage. Playwright-Synthesetests ersetzen keine echten iOS-Tests.
3. Owner/Vize/Viewer und kontrollierte Realtime-Konflikte, Cloud-Speichern und Rejoin-Rollen über getrennte Konten verifizieren; keine ungeschützten Testschreibzugriffe auf laufende produktive CWL-Pläne.
4. Prüfung gegen aktuelle Supabase-RLS/RPC und Version-Refresh älterer Clients. Alte Tabs mit vorherigem Cloud-Code dürfen nicht heimlich ein neues, manuell gepflegtes Profil falsch synchronisieren.
5. Releaseversion/Changelog/Cache-Token/Pages-Deployment **erst beim kontrollierten Release** anheben. Solange Draft keine Live-Merge-Aktion.
6. PRs mit überschneidenden Änderungen `cloud-app.html`/`cloud-sync.mjs` **nicht blind nacheinander mergen**; #53 dient als Konflikt-/Integrationsreferenz. Kleinere Schritte nur nach Rebase und erneut grünem CI.

## Nicht vergessen – späterer Backlog
- [#46](https://github.com/Smolmig/cwl_planer/issues/46): Gold/Arena-Polish, Mitgliederkarte/Plannavigation/Filter sauber trennen, Raus/Rein nach oben, brauchbare „Mehr“, „Konto“ und „Hilfe“-Unterseiten, verständliche Texte, Desktop-Flächennutzung, Performance und reversible Cleanup-Änderungen. Alt-PR #45 keinesfalls direkt mergen.
- [#44](https://github.com/Smolmig/cwl_planer/issues/44): optionales Angriffsstärke-/Gegner-Modell **separat, standardmäßig deaktiviert**. Nicht in den reinen Rotationssolver einmischen.
- Datenschutz, Zugriffsrechte, gespielte CWL-Historie, Cloud-Backups und Offline-PWA stets schützen.
- Ursprüngliche, weitere Produktanforderungen bleiben vollständig in `docs/NEXT_CHAT_HANDOFF.md` und Issue #49 bestehen; diese Kurznotiz ist **eine Ergänzung, kein Ersatz**.
