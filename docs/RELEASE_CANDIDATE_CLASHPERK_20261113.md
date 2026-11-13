# Release-Kandidat #269 – ClashPerk-Excel-Import und Clanwechsel-UX

**Stand 13.11.2026 | Draft-Stack #270 → #272 → #273 → #274 → #275 → #276 → #277 → #278 → Release-Review #279.**  
**Status: VORBEREITUNG, NO-GO für Produktionsdeploy; `main` bleibt v1.18.1.**  
Die Ownerless-CWL-Saisonwechsel-PRs #262–#267 gehören **nicht** zu diesem Release.

## 1. Was wird gemeinsam veröffentlicht?

| Bereich | PR | Release-Verhalten |
| --- | --- | --- |
| Clanwechsel, CWL-Fehlwarnungen, letzte CW/CWL und sichtbarer Statistikimport | #270 | Bessere Ladeansicht und relevante abgeschlossene Kriege statt leerer Planansicht |
| ClashPerk-XLSX-Dateien direkt im Browser und historisches CW-/CWL-Statistikmodell | #272 | Originale Attack-/Missed-Exporte; keine JSON-Konvertierung notwendig |
| Ein atomarer Importvorgang, RLS und Schutz der verifizierten API-Kriege | #273 | Ein bestätigter Upload entspricht einem vollständigen Datenbankaufruf |
| Browser-/Mobil-/WebKit-UAT | #274, #275 | Responsive Import, Vorschaubestätigung und Rollenprüfung |
| Backup- und Restore-Prüfungen | #276 | Historien-COPY-Inhalte, RLS und exakter Datenvergleich |
| Tatsächliche lokale GoTrue-Logins und HTTP-RLS | #277 | Owner, Editor, Viewer, fremde Clans über echte lokale Auth |
| Integration im **gleichen** Browserdurchlauf mit GoTrue und PostgREST | #278 | Login → Excel-Dateiauswahl → Bestätigung → RPC → Statistiken |
| Migration, tatsächliche Release-Prüfung und schnelle Clanwechsel | #279 | Versionierter DB-RPC und Race-Regression, ohne Produktivaktivierung |

### Noch zu beachten

Die verifizierte **historische Statistik** darf nicht mit einem vollständigen **CW-Archiv** verwechselt werden: Gegnerangriffe und Discord-Aufstellungswechsel sind in den Original-XLSX nicht durchgängig enthalten. Ein vollständiger CW-Detailbericht bleibt separat #268. Fehlende Missed-Nachweise sind **unbekannt**, nicht „0 verpasst“. Ausgetretene Spieler bleiben für historische Quoten enthalten, aber nicht im **aktuellen Kader**. Der Import ist auf den **gewählten App-Clan** beschränkt.

Die bisherigen JSON-Historienuploads nutzen weiterhin einen **separaten, älteren Mehrbatch-Schreibweg**. Der neue atomare RPC wird ausschließlich für **ClashPerk-XLSX** verwendet. Ein übergreifender JSON-Migrations-/Integritätsumbau gehört zu #178/#269, nicht still in diesen Release. Beim Release die alte JSON-Funktion nicht als „atomar“ bezeichnen; vor einem JSON-Massenimport eine eigene Sicherung erforderlich.

## 2. Kritische Release-Gates

- [x] **Zusammenhängende, konfliktfreie Draft-Basis**: `#270 → #272 → #273 → #274 → #275 → #276 → #277 → #278`. Vor jedem Merge noch einmal den gegenwärtigen `main` prüfen.
- [x] **Abgleich mit dem tatsächlichen Produktivschema, ausschließlich read-only (13.11.2026):** Postgres 17; 29/29 benötigte Spalten, 3/3 eindeutig passende War-/Attack-/Missed-Schlüssel, RLS 3/3, authentifizierte SELECT-/INSERT-/UPDATE-Policies 9/9 und Hilfsfunktion `private.cwl_can_edit(uuid)` vorhanden. Die neue `cwl_import_clashperk_atomic(uuid,jsonb)` ist **noch nicht** im Produktivschema. `scripts/clashperk-schema-preflight.sql` ist eine wiederholbare SELECT-only-Prüfung; gegen die echte produktive DB im Modus `pre` erfolgreich mit **PASS** ausgeführt. In synthetischer PostgreSQL-17-CI läuft sie vor und nach der Migration (inklusive gezielter negativer Tests für fehlende RLS und anonym zugängliche RPC). **Dies ist eine statische Struktur-/Grant-Vorprüfung, kein gehosteter Migrationstest und keine Freigabe des Produktivdeployments.**
- [x] **Versionierte DB-Migration im Release-Branch:** `supabase/migrations/20261113153000_cwl_clashperk_atomic_history_import.sql` mit `SECURITY INVOKER`, authentifizierter Bearbeiterprüfung und `EXECUTE` nur für `authenticated`. Die frühere SQL-Entwurfsdatei dient als Vergleichsreferenz.
- [x] **CI verwendet für lokale Postgres-/HTTP-/GoTrue-/Restore-Tests das tatsächliche Migrationsskript**, nicht eine möglicherweise abweichende Entwurfsdatei. Ein Test prüft beide Bodies auf Gleichheit.
- [x] **Schneller Clanwechsel bei laufender Statistikabfrage:** Alte Tenant-Ergebnisse werden bei neuem Clan sofort ausgeblendet, spät eintreffende Ergebnisse verworfen und ein Import lädt die Daten **nach** dem bestätigten Server-Commit ausdrücklich frisch.
- [x] **Echter browserseitiger Login/Excel/RPC/Datenbank-Gesamtweg** in isoliertem Chromium und WebKit, ohne Produktivdaten.
- [x] **Excel-ZIP-Konsistenz gegen manipulierte Dateiheader:** Ein Excel-Eintrag muss im lokalen ZIP-Header exakt denselben Namen und dieselbe Komprimierung wie im zentralen Verzeichnis tragen; abweichende Dateien werden abgewiesen. Synthetischer Regressionstest für manipulierten Dateinamen und Kompressionsmethode. Keine Änderung an der Importvorschau, Nutzeranleitung oder produktiven Daten.
- [x] **Backup-Restore mit Testdaten** inklusive exakter Werte, RLS und bewusst veränderter Sterne bei identischen Zeilenzahlen.
- [x] **Staging-Vorbereitung ohne Produktivzugriff:** `scripts/build_clashperk_staging_preview.cjs` erzeugt eine getrennte Cloud-Testkopie mit eigener Supabase-Projektkennung und abweichendem öffentlichen Schlüssel; die produktive Kennung ist im Build explizit gesperrt. Der Test-Build kennzeichnet Browser-Tab, Apple-Home-Screen-Namen, PWA-Manifest und UI als **TEST** und entfernt produktive Social-Preview-Links. **Cloud-PWA-Spezialfall abgesichert:** Im Test-Build registriert `cloud-app.html` gezielt einen eigenen online-only Worker; `tests/clashperk-staging-browser.test.cjs` lädt den **erzeugten Build** im echten Chromium mit künstlicher Gastsession, prüft keine Fremd-/Produktivrequests, Worker-Registrierung und Kontrolle nach Reload. [732/732 Regressionen grün](https://github.com/Smolmig/cwl_planer/actions/runs/43503372450). **Weiter offen:** separate gehostete Testinstanz, vollständiger echter Cloud-Login-/Routing-Test und physische iPhone-Safari-/PWA-Abnahme; die lokale Browserprobe ersetzt das nicht. [Kosten-/Abnahmeplan](CLASHPERK_STAGING_RELEASE_UAT_20261113.md).
- [ ] **Echte private ClashPerk-Uploaddateien durch den Parser in einer kontrollierten Nicht-Produktivumgebung prüfen** (keine Originaldateien ins öffentliche GitHub/CI hochladen). Streng zwischen `war_id`-Dubletten und offiziell API-verifizierten Kriegen unterscheiden. Auffälligkeiten gegen Sample-Kriege im Spiel prüfen.
- [ ] **Frisches verschlüsseltes Produktiv-Backup** vor dem Deployment, Wiederherstellung **außerhalb der Live-DB** und Kontrolle aller drei Statistiktabellen. Den aktuellen technischen Sicherungsstand mit Issue #178 abgleichen.
- [ ] **Echte getrennte Supabase-Staging-Umgebung** oder ausdrücklich freigegebene, dokumentierte alternative Release-Strategie für das einzige vorhandene gehostete Produktivprojekt. Kein Staging-Projekt stillschweigend kostenpflichtig anlegen.
- [ ] **Manuelles iPhone Safari und installierte PWA**, echter Cloud-Login/Clanwechsel, Importauswahl aus iOS-Dateien, Bestätigung, aktualisierte Statistiken, Verlauf, langsame Verbindung, Viewer/Vize/Owner und Zweitclan durchspielen.
- [x] **In-App-Importanleitung und Hilfe-Seite fachlich korrigiert:** Der echte ClashPerk-Missed-Export enthält **Regular + CWL gemeinsam**. Pro Clan braucht man daher **zwei Attack-Logs + einen gemeinsamen Missed-Export** (drei Dateien, `limit: 100`); `/export wars` ist nicht notwendig. Der von dir gelieferte Original-XLSX-Aufbau wurde privat geprüft (Details in `CLASHPERK_XLSX_IMPORT_IMPLEMENTATION_DRAFT.md`).
- [ ] **Finales Hilfe-/Release-Textaudit vor Aktivierung**: Alle sichtbaren Bezeichnungen, Grenzen und die tatsächlich veröffentlichte Version nach Einführung überprüfen. Deutsch Standard; mit späterer englischer UI **beide Sprachfassungen synchron**.
- [ ] **Release-Artefakte in einem eigenen freigegebenen Merge**: `APP_VERSION`/sichtbare Version, `cloud-version.json`, alle Modul-Cache-Buster einschließlich `cloud-sync.mjs` und `cwl-stats.mjs`, Service Worker und verständliches Changelog samt Datum konsistent ändern. **In einem Draft kein voreiliger Versionssprung.**
- [ ] **Abschließende CI auf tatsächlichem Release-HEAD** grün, echte Browser-Konsole und DB-Migrationshistorie geprüft, anschließend gestapelte Draft-PRs konsolidiert/geschlossen statt versehentlich mehrfach gemergt.
- [ ] **GO/NO-GO ausdrücklich bestätigen** und einen praktischen Rückfallzeitpunkt dokumentieren. Die Live-Datenbank darf bis dahin nicht migriert und keine echte Excel-Historie automatisch importiert werden.

## 3. Zulässige Reihenfolge bei einem tatsächlich freigegebenen Release

1. Aktuellen `main`-Diff und den Stand aller offenen PRs erneut abgleichen. Release-Branch auf aktuellen `main` aufsetzen bzw. geordnet übernehmen; parallel den separaten Ownerless-CWL-Stack nicht versehentlich einmischen.
2. Frisches, **verschlüsseltes und erfolgreich extern restauriertes** Backup der produktiven Cloud erstellen. Zusätzlich Rückfallversion der Cloud-Dateien und die Schema-Version protokollieren.
3. Versionierte SQL-Migration zunächst **nur isoliert** installieren und mit **realen Auth-Rollen, RLS und War-/Attack-/Missed-Werten** prüfen. Die SQL-Funktion ist additiv und hat kein destruktives DDL; das allein ersetzt jedoch keinen Restore-Plan.
4. Bei ausdrücklicher Freigabe Datenbankmigration vor dem Frontend veröffentlichen: Ohne passende RPC blockiert der Browser den Upload und führt **keinen unsicheren Mehrbatch-Fallback** aus. Danach Cloud-App samt konsistentem Versionsstand aktivieren.
5. Smoke-Test: Owner öffnet neue Statistik, Uploadvorschau an einem **nur für Tests bestimmten Clan**, Vize/Viewer und mehrere Clans sowie Rückwechsel prüfen. Keine Kriege/Statistiken fremder Clans sichtbar. Echte Nutzer-Datenimporte sind **manuell**, nie Teil eines Hintergrundmigrationsskripts.
6. Bei Fehler Frontend-Dateien auf die letzte gute Version zurücksetzen (Feature verschwindet), die additiv installierte RPC nicht blind droppen, solange importierte Daten existieren. Datenbank-/Historienrollback nur aus explizit geprüfter Sicherung und nach Abwägung neuer Datensätze. Keine SQL-Löschung automatisieren.

## 4. Aktuelle Freigabeentscheidung

**NO-GO für Produktion**, solange gehostetes Test-/Freigabekonzept, ein echtes iPhone-/PWA-UAT und die konkrete verschlüsselte Recovery-Abnahme fehlen. Automatisierte Tests können das Risiko reduzieren, aber die reale Freigabe nicht ersetzen.

**Verknüpfte Themen:** #269 direkter ClashPerk-Import, #270 Clanwechsel/Plan-UX, #268 detailliertes CW-Archiv, #178 Backup/Restore, #213 manuelles UAT, #46 Hilfe-/Release-Regeln.
