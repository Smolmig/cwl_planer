# ClashPerk-Import: isolierte Staging-Vorschau und iPhone-Abnahme

**Stand: 13.11.2026 · PR #280 · Freigabestatus: NO-GO.**
Das ist eine technische Vorbereitung, **keine** bereits durchgeführte echte Staging-/iPhone-Abnahme. Produktive Cloud-App bleibt v1.18.1.

## 1. Kosten und tatsächlicher Projektbestand

Die verbundenen Supabase-Metadaten wurden am 13.11.2026 **nur lesend** geprüft: eine aktive gehostete Produktionsinstanz, Organisation im **Free-Tarif**; keine zweite Staging-Instanz angelegt. Supabase dokumentiert im Free-Tarif grundsätzlich **zwei aktive kostenlose Projekte**, organisationsübergreifend und abhängig von weiteren Berechtigungen. Quellen: [Billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Billing FAQ](https://supabase.com/docs/guides/platform/billing-faq). Das ist eine **mögliche kostenlose Lösung**, keine Garantie für den konkreten nächsten Projektpreis. **Vor** einem Projekt/Branch immer die echte Kostenabfrage für die ausgewählte Organisation durchführen, Kosten ausdrücklich nennen und eine explizite Besitzerfreigabe einholen. **Niemals kostenpflichtige Staging-Ressourcen ohne Freigabe anlegen.**

Die [offizielle lokale Entwicklung](https://supabase.com/docs/guides/local-development) ist ebenfalls kostenlos; der bestehende GitHub-Actions-GoTrue/PostgREST/WebKit-Test nutzt genau eine isolierte lokale Instanz und keine produktiven Geheimnisse. Für **physisches iPhone Safari samt installierter PWA auf einer echten HTTPS-Adresse** ist ein separates *gehostetes* Testprojekt mit separater HTTPS-Frontend-Origin jedoch die bessere Abnahme. Die lokale/CI-Simulation ersetzt diese Prüfung nicht.

## 2. Vorbereitung ist bereits automatisierbar – ohne Staging-Projekt anzulegen

Das neue Skript `scripts/build_clashperk_staging_preview.cjs` erzeugt aus dem unveröffentlichten PR #280 einen **separaten, statischen Cloud-Test-Build**, aber **verbindet sich niemals selbst mit einer Datenbank** und **veröffentlicht keine Dateien**.

Beispiel **nach** separat bestätigter und angelegter Testinstanz, ausgeführt im PR-Branch (Platzhalter ersetzen, keine echten Geheimnisse im Repository hinterlegen):

```bash
# Nur die ÖFFENTLICHE publishable Staging-Projektkennung als Umgebungsvariable;
# KEIN service_role, kein DB-Passwort, kein produktiver Public-Key.
export CWL_STAGING_SUPABASE_URL="https://<STAGING-PROJEKT-REF>.supabase.co"
export CWL_STAGING_PUBLISHABLE_KEY="sb_publishable_<TEST-PUBLISHABLE-KEY>"
node scripts/build_clashperk_staging_preview.cjs /tmp/cwl-clashperk-staging-preview
```

Die konkreten Sicherungen:

- **Fail closed:** Die eindeutige Produktions-Supabase-URL und der dortige öffentliche Key werden im Quellmodul erkannt. Gleiches Projekt, gleicher Key, unverschlüsseltes HTTP, gefälschte Subdomain, unerwarteter Pfad/Query oder Secret-Key werden **abgelehnt**.
- **Nur getrennte Kopie:** Ausgabeverzeichnis muss absolut, neu und **außerhalb des Repositories** sein. Es werden keine Quell-Dateien, keine Live-App-Version und keine Supabase-Datenbank verändert.
- **Alle Projektbindungen:** Die Kopie verwendet die Staging-URL, deren *öffentlichen* Publishable-Key und die passende Staging-Auth-Storage-Kennung, auch für den Rückkehrer-Ladebildschirm. Die produktive Kennung darf in keiner generierten Textdatei verbleiben.
- **Mobil deutlich:** Im Test-HTML ein sichtbarer Hinweis **„TESTUMGEBUNG · Keine Echtdaten“**, im Browser-Tab „CWL Planer · TEST“, im PWA-Manifest **und in Apples separatem Home-Screen-Titel** „CWL TEST“. Social-Preview-Metadaten mit produktiver Live-Adresse werden ausschließlich aus der Testkopie entfernt, damit ein geteilter Testlink nicht irreführend zum Live-Planer führt.
- **PWA-Installationsweg tatsächlich aktiv:** Die Produktions-Cloud-Seite registriert auf `cloud-app.html` bewusst keinen Worker. **Nur die generierte Testkopie** registriert den eigenen online-only Worker auf diesem Einstieg. Der Test-Worker leitet gleichoriginige GET-Anfragen ohne Cache an das Netz weiter; weder Offline-Profile noch alte Importskripte werden zwischengespeichert. Das Cloud-Manifest bleibt erhalten.
- **iPhone-PWA-Guard:** Registrierung und tatsächliche Kontrolle des generierten Online-only-Workers nach Reload werden im Browser-Smoke geprüft. Das testet die Web-PWA-Verkabelung, **nicht** das physische Installationsverhalten in iOS-Safari; jene Abnahme bleibt ausdrücklich offen.
- **Zusätzlicher echter Chromium-Smoke-Test (synthetisch, ohne Supabase/Internet):** `tests/clashperk-staging-browser.test.cjs` startet die *erzeugte* Testkopie an einer temporären Loopback-Adresse, ersetzt lediglich das externe `supabase-js`-Modul durch eine künstliche Gastsession, kontrolliert die Staging-Projekt-URL, TEST-Kennzeichnung, mobile Breite, Service-Worker-Registrierung und dessen Kontrolle nach Reload. Fremde Netzwerkanfragen werden abgebrochen und gemeldet. **Kein** Ersatz für iOS-PWA-/Cloud-Echtlogin, aber ein direkter Test des ausgelieferten Preview-Builds.
- **Keine Original-ClashPerk-Dateien, Nutzerdaten, Tokens oder privilegierten Schlüssel** gehören in Git, GitHub-Logs oder in die öffentliche statische Testvorschau.

Die generierten Dateien können später **auf einer eigenen HTTPS-Test-Origin** (nicht im produktiven Live-PWA-Scope!) gehostet werden. Die Veröffentlichung selbst ist nicht automatisiert und benötigt separate Freigabe. Eine öffentliche HTTPS-URL bedeutet nicht „geschützter Test“: Testkonten ausschließlich mit künstlichen Daten; echte Berechtigungen bleiben serverseitig durch RLS erzwungen.

## 3. Gehostetes Test-Supabase – Freigabe und Einrichtung noch offen

1. **Zuerst** Preis, tatsächliche freie Projektkapazität und explizite Zustimmung prüfen; erst dann gegebenenfalls neues Projekt anlegen. Unabhängige Projekt-Ref und Passwörter, möglichst vergleichbare PostgreSQL-Hauptversion/Region. Keine Kopie der Produktions-Accounts, kein Restore privater Live-Daten nach Staging.
2. Schema und die tatsächlich im Release vorgesehenen **versionierten** Migrationen in **diesem** Testprojekt nach Review installieren, einschließlich `20261113153000_cwl_clashperk_atomic_history_import.sql`. Nie `supabase link` oder `supabase db push` mit produktiver Ref/URL. RLS, `SECURITY INVOKER`, PostgREST-Grant und tatsächliche migrationsbasierte Rechte prüfen.
3. Zwei **synthetische Clans** mit voneinander getrennten Accounts und **Owner/Vize/Viewer** anlegen. Kein Collector-Cron, keine echte Supercell-API-Verbindung, keine produktiven Edge-Function-Secrets; ausschließlich ausdrücklich benötigte, separat abgesicherte Funktionen für den Test.
4. Den erstellten Cloud-TEST-Build nur auf einer **separaten HTTPS-Origin** verfügbar machen; vor dem ersten Login im Netzwerkprotokoll nachweisen, dass jede PostgREST-/Auth-/RPC-Anfrage an die **Staging-Projekt-Ref** geht.
5. Nach Abnahme Testkonten/-daten bereinigen oder Testprojekt pausieren; keine geheime Backupdatei oder private Excel-Originale publizieren.

## 4. Abnahme auf einem **echten** iPhone – Safari und installierte PWA

| Prüfung | Erwartung | Nachweis |
| --- | --- | --- |
| Safari direkt, danach „Zum Home-Bildschirm“ und standalone starten | TEST-Hinweis und TEST-App-Name bleiben eindeutig; keine produktive Session/Clan-Verwechslung | Beide Betriebsarten manuell |
| Cloud-Login und Neustart als Owner | Session bleibt im Staging; kein endloser Gast- oder Ladebildschirm, keine mehrfach blinkende Ansicht | Bildschirm und Browser-/Netzwerkdiagnose |
| Drei ClashPerk-Dateien aus iOS „Dateien“ auswählen | 2× `/export attack-log` Regular/CWL und **1×** gemischtes `/export missed`, Vorschau und bewusste Bestätigung | Echter iOS-Dateipicker, nur private/kontrollierte Testdaten |
| 2/10/30/100+ Kriege und wiederholter Upload | Richtige Kriegs-/Angriffszahlen, keine doppelte Historie, keine UI-Überläufe | Vor-/Nach-Zählung in **Staging** |
| Missed unvollständig oder Krieg zu jung | **Unbekannt statt 0**; kein falscher vollständig-Beleg, laufende Kriege nicht als abgeschlossen importiert | Kontrollierte Varianten |
| Owner / Vize / Viewer | Owner/Vize können nach Bestätigung importieren, Viewer weder per UI noch durch erzwungene RPC-Anfrage | Andere Testkonten und HTTP 4xx |
| Erster Clan → zweiter Clan → zurück | Historie, Formular und Rolle wechseln tenantkorrekt, kein alter Claninhalt bei langsamer Antwort | Zwei isolierte Clans |
| Bereits API-verifizierter Krieg und widersprüchliche Datei | API wird nicht überschrieben, Identitätskonflikt bricht **vor** dem Datenbank-Commit ab | Vor-/Nach-Daten in Staging |
| Schwaches Netz, Reload, App im Hintergrund, erneuter Start | Kein unbeabsichtigter Doppelimport, keine falsche Erfolgsmeldung oder veraltete Ladeanzeige | iPhone-Geräteabnahme |
| Hilfe, verständliche Hinweise, Themes und Update-Anzeige | Drei-Datei-Anleitung korrekt, Staging erkennbar; Deutsch Standard; spätere EN-Option separat | Sichtprüfung |

**Wichtig:** Playwright-WebKit auf Linux ist ein guter automatisierter Test, aber **kein Nachweis für den echten iOS-Dateipicker, Safari-Home-Screen-PWA oder iPhone-Sitzungspersistenz**.

## 5. Go/No-Go

- [x] Kostenfreie Alternative als **Option** geprüft; Free-Plan-Metadaten read-only bestätigt. **Keine Kosten-/Projektfreigabe.**
- [x] Separate statische Staging-Vorschau mit hartem Produktions-Target-Guard und klarer iPhone-/PWA-Kennzeichnung implementiert; Testseite registriert eigenen online-only Worker; generierte Dateien werden in Chromium mit synthetischer Gastsession auch nach Reload geprüft.
- [ ] Reale Staging-Projektkosten abgerufen, ausdrücklich bestätigt und separates Projekt eingerichtet.
- [ ] Migrationen und RLS/HTTP-Rollen gegen **dieses gehostete Testprojekt** geprüft.
- [ ] Test-Build auf separater HTTPS-Origin geöffnet; Routing ausschließlich zu Staging bestätigt.
- [ ] Physisches iPhone Safari und installierte PWA mit Dateiimport, Clanwechsel, Rollen und Netzproblemen abgenommen.
- [ ] Frisches verschlüsseltes Produktiv-Backup **nach** dem neuen Inhalts-Gate tatsächlich extern restauriert und geprüft.
- [ ] Finale Release-Version, Hilfe, Changelog und Rückfallplan bestätigt; erst dann #280 erwägen.

**Das Vorbereiten dieser Testmöglichkeit ist noch kein „Staging getestet“, kein Prod-Release und keine Freigabe zum Import echter Clan-Historie.**
