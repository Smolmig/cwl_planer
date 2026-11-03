# Cloud v1.7.0 – Release-Kandidat (03.11.2026)

## Ziel
Einmalige, kontrollierte Veröffentlichung des vollständig zusammengeführten UI-Phase-2-Standes aus [PR #60](https://github.com/Smolmig/cwl_planer/pull/60), der die drei früheren Drafts #57/#58/#59 enthält. **Diese vier Entwicklungs-PRs danach niemals separat noch einmal mergen.**

**Istzustand:** `main` bleibt vor diesem Merge Cloud **v1.6.0**, Commit `59f761561300dc98ad170d910ec4be4f770950bd`. Die CWL läuft; daher keine unnötigen produktiven Schreibtests.

## Funktionsumfang
- Hilfe und Clan & Konto als eigenständige Seiten. Anmeldung, Registrierung, Einladungsannahme und Passwort-Wiederherstellung bleiben eigene Dialoge. Die bestehenden Cloud-Handler und Rechte bleiben unverändert.
- Mitgliederkarten, Tagesregeln und doppelte Spielernamen ohne vollständige Listenrekonstruktion; Such-Eingaben 85 ms bündeln, Filter weiterhin direkt.
- Arena-/Gold-Oberflächen mit weniger doppelt verschachtelten Karten; gleiche Rathausbild-Quelle und lesbarer RH-Fallback in Mitgliederliste und Statistik.

## Versions- und Datensicherheit
- `cloud-app.html`, `cloud-version.json` und Modul-Cachekennungen konsistent auf **v1.7.0**.
- `cloud-sync.mjs` importiert Cloud-Backups, CWL-Live, Statistik und Current War alle mit `v=1.7.0`. `cwl-live.mjs` verwendet einen frischen Token für seinen Core; der übrige unveränderte Modul-Code bleibt unverändert.
- **Kein** `supabase/`-SQL-/Edge-Deployment, keine Änderung an Auth-/RLS-Rollen, `DATA_VERSION=9`, `STORAGE_KEY=cwl_planer_mobile_v9`. Keine produktiven Profil-/Plan-/Snapshot-Änderungen als Teil des Release-Vorgangs.
- Offline-PWA `index.html` bleibt **v1.0.2**; `service-worker.js` und Cache für Offline-PWA bleiben unverändert.
- Der bestehende Versionschecker verschiebt App-Neuladen bei laufender Eingabe, offenem Cloud-Dialog, Einladungsannahme, Speicherkonflikt und nun auch bei geöffneter Konto-Unterseite.

## Freigabegates
1. PR `release/cloud-v1.7.0-ui-phase2` ist gegen den erwarteten Main-Commit konfliktfrei.
2. Vollständige Unit-, JSDOM- und Chromium-Testserie **auf dem letzten Release-PR-Commit** grün; separate Auth-Session-Simulation prüft Gast-Login → Kontoseite, bestehende Session → aktueller Tab, Recovery/Einladungen → Dialog.
3. `git diff` / PR-Dateiliste zeigt **keine** Supabase-Migration, keine Offline-PWA-/Service-Worker-Änderung, keinen Solver-Eingriff.
4. Echte End-to-End-Prüfung mit einem berechtigten Nutzer: Login, bestehende Session, Passwort-Reset, Einladung und Clan-/Rollenwechsel – ohne die laufenden CWL-Einsätze zu ändern. Diese **manuelle Abnahme kann die CI nicht vollständig ersetzen**.
5. Nach bewusstem Merge GitHub Pages, Versionsdatei, Asset-URLs und Release-Workflow prüfen. „Live“ erst behaupten, wenn GitHub Pages das Deployment bestätigt.
6. Danach alte Einzel-Drafts #57–#60 als durch diesen Release ersetzt kennzeichnen, keine Doppel-Merges.

## Rückfall
Bei kritischem Bedienungs-/Datenfehler: **Code-only Revert** des Release-Merges; neue Versions- und Cachekennungen benutzen, damit aktive Browser nicht fehlerhafte alte Module behalten. **Niemals** produktive Cloud-Profile, Revisionszähler, historische CWL-Tage, Snapshots oder Backup-Tabellen zurücksetzen.

## Bleibt offen
- Echte iOS-Safari-/Mehrgeräte-/Rollen-Sichtprüfung (nicht durch synthetischen Browser beweisbar).
- Separate #46: Header-/Zahnrad-Konzept, alte Demo-/Pilotdateien nach Link-/Deep-Link-Inventar bereinigen.
- #44: optionales Angriffsstärke-Modell bleibt deaktiviertes Experiment.
