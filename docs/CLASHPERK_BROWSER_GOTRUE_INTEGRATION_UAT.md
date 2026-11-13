# ClashPerk: echter Browser-Login und Excel-Import in einem Test

**13.11.2026 · Draft PR #278 · Issue #269 / UAT #213 · Produktiv weiterhin unverändert.**

## Warum dieser Test?

Die bisherigen Freigabegates prüften den originalgetreu nachgebildeten ClashPerk-XLSX-Dateiupload im echten Chromium-/WebKit-Browser (#274/#275) und echte lokale Supabase-GoTrue-Logins mit RLS und atomarer Datenbankübernahme (#277) **getrennt**. Nun ist beides im **selben Browserdurchlauf** integriert.

## Aufbau

- Testdatei `tests/clashperk-browser-gotrue-integration.test.cjs` erzeugt zwei reine Test-XLSX-Dateien mit ZIP/DEFLATE, OpenXML-`sharedStrings.xml` und dem ClashPerk-Layout: zwei historische normale CWs (`cp:321`/ `cp:322`), drei eigene Angriffe und ein Missed-Eintrag.
- Die bereits vorhandene CI `.github/workflows/clashperk-local-supabase-auth-ci.yml` startet **vollständig lokale** Supabase CLI + Auth/GoTrue + PostgreSQL + PostgREST. Owner- und Viewer-Testkonten werden über die lokale GoTrue-Admin-API angelegt und auf die künstliche Clanmitgliedschaftstabelle beschränkt.
- **Im jeweiligen echten Browser** wird mit E-Mail und Passwort über **GoTrue** angemeldet, mit dessen tatsächlich ausgestelltem Access-Token gegen **PostgREST** gelesen und die statistische Web-App-Oberfläche `cloud-app.html` mit dem echten Modul `createCloudStats` geöffnet.
- Der Browser lädt über den echten `statsImportFile`-Datei-Input beide XLSX-Dateien hoch, bekommt die echte Parser-/Import-Vorschau, bestätigt sie und sendet **genau einen atomaren RPC** an das echte lokale PostgreSQL. Die Statistik wird neu geladen und der Serverinhalt per REST überprüft.
- Test bei **390 px und 1366 px**, in **Chromium und WebKit**. Kontrolliert: 2 War-IDs, 3 eigene Angriffe, 1 nachgewiesener Missed-Eintrag, nur `cp:321` vollständig und `cp:322` mit weiterhin offenen Nachweisen; zweiter Upload idempotent (keine zusätzlichen War-/Attack-Zeilen).
- Separater Viewer meldet sich ebenfalls mit **einer echten GoTrue-Session** an, darf die Clankriegstatistik sehen, aber bekommt keinen Import-Button und löst auch bei manueller Dateiauswahl keinen RPC aus.
- Ein leichter browserseitiger `sb`-Testadapter übersetzt `select/eq/order/range/limit/rpc` in **echte PostgREST-HTTP-Anfragen**. Die Datenbankantworten und der RPC sind nicht simuliert; der Test lädt aber **nicht** die gesamte App-Login-/Router-Initialisierung oder den Produktions-Supabase-JS-Client.

## CI-Ergebnisse

- [Lokale Supabase mit **integriertem Chromium- und WebKit-Upload** #43426714806](https://github.com/Smolmig/cwl_planer/actions/runs/43426714806): **grün**, inkl. echter GoTrue-Passwortanmeldung, Browser-Datei-Upload, API-Lesezugriff, Datenbank-Speicherung, Viewer-Sperre.
- [Gesamte App-Regression #43426714803](https://github.com/Smolmig/cwl_planer/actions/runs/43426714803): **719/719 Tests bestanden, 0 Fehler**.
- Ein früher Zwischenlauf #43426223756 scheiterte nach korrekt ausgeführtem Upload **an der Testdatenauswertung**: Der vorgeschaltete GoTrue-RPC-Test hatte schon `cp:720` in derselben lokalen Testdatenbank gespeichert, was irrtümlich mitgezählt wurde. Der Test zählt nun ausschließlich die beiden im Browser hochgeladenen War-IDs und lief anschließend in **beiden Browser-Engines erfolgreich**.

## Grenzen und nächste Freigabeentscheidung

1. **Keine Produktivdatenbank oder Nutzerdateien** verwendet, keine Original-XLSX im öffentlichen GitHub. Die Testkonten, Datenbank und Schlüssel werden in der GitHub-CI am Ende zerstört.
2. Noch **kein physisches iPhone** in Safari/PWA und keine vollständige Produktiv-App-Anmeldung inklusive Routing/Offline-Synchronisierung. Browserprüfung ist ein realer Import-UI-Test gegen echte lokale Auth/REST, aber nicht die gesamte Endnutzer-App-Navigation.
3. Kein zweites gehostetes Supabase-Staging-Projekt vorhanden; kein `supabase link`, SQL-Deployment, Merge oder Live-Release ausgelöst.
4. Backup-/Restore-Gate #276 ist für synthetische DB-Dumps grün; Abnahme mit einem echten verschlüsselten Produktiv-Backup und konservative Rollback-/Migrationsfreigabe bleibt gesondert.
5. Produktiver Feature-Release benötigt Review und Konsolidierung der gestapelten Drafts **#270 → #272 → #273 → #274 → #275 → #276 → #277 → #278**, Hilfe-Seiten-Abgleich, verständlichen Changelog und Versionssprung. Der separate Ownerless-CWL-Stack #227 bleibt unabhängig.

**Die Funktion ist weiterhin nicht in der Live-App verfügbar (v1.18.1).**
