# Freigabereihenfolge – Dezember-Beta #44

Ziel: v1.38.0 MINOR (neuer rückwärtskompatibler intelligenter Planer). Keine offizielle Freigabe durch reine Code-Existenz. Bestehendes v1.37.0 bleibt bis Freigabe.

## Gating und Reihenfolge
1. Aktueller PR-HEAD: alle sechs CI grün, speziell tatsächlicher local Auth/PostgREST-Recompute und SQL. Testartefakt-Migration 20261127111001_cwl_strategic_derived_assignment.sql identisch mit getesteter Quelle, SHA b2c9be337df5946bede78469487abb16a4854dfc. Keine spätere SQL-Änderung ohne neue UAT.
2. Read-only Produktionspreflight: Datenbank-Migrationsstand, keine kollidierenden Tabellen/RPCs, relevante Tabellen/Spalten/Policies, bestehende Collector-Version und Cron, Backup/Restore-Nachweis. Keine geheimen Werte oder privaten IDs in GitHub/Logs. Staging und Sicherheitsabnahme nach AGENTS.
3. Additive Migration in Produktion erst nach Gate. Verify table RLS, authenticated select, no authenticated write or service RPC EXECUTE, anon deny, service-only RPC; counts and profile revisions unchanged. Keine Aktivierung oder Datenmigration an Profilen.
4. Getrennten Beta-Edge-Endpunkt mit leerem Grant deployen. Anon/ungültiger JWT muss abgewiesen werden. Keine Änderung der bestehenden Status-Function erforderlich. Tatsächliche Gateway-Antwort prüfen. Collector-Deploy mit Default-off: sicherstellen, dass vollständiger relativer Importgraph mitgeliefert und vorhandener regulärer Cron/Archivpfad gesund bleibt. Vorherige Deploy-Version für Rollback dokumentieren.
5. Beta-Capability auf exakt genehmigten App-Clan/Owner/Tag begrenzen; Auto-Grant serverseitig separat und leer bis Gate. Profil-Opt-in bleibt nötig. Minütlichen Cron nur nach erfolgreicher gezielter Fast-Lane-Prüfung aktivieren. Bestehenden 30-Minuten-Cron nicht ersetzen. Keine unbeschränkten Fanouts.
6. Release-Metadaten konsistent (APP_VERSION, Cache, History, CHANGELOG, Manifest, Hilfe/Settings; tatsächliches Datum), PR-Checkliste, CI, Merge. GitHub erzeugt offiziellen Release automatisch nur nach grüner main-Regression.
7. Hosted UAT mit echten berechtigten Nutzerrollen, tatsächlicher Member-/Plan-Ansicht auf Smartphone, vor Anmeldung Kaderempfehlung, gemeinsame Moduswahl und Opt-in, Vize-Entwurf und Owner-Freigabe. Dezember-Live-CWL erst bei verfügbarer realer Gruppe; Modell nicht kalibriert. Benutzerfeedback zu taktischer Güte und UI erwünscht.
8. Rollback: Auto-Opt-in aus, Auto-Grant entfernen, Fast-Lane Cron unschedule; Beta-Grant entfernen, vorherigen Collector deployen falls nötig. Neue additive Tabellen verbleiben ohne Reads/Publikation; kein DROP oder Restore produktiver Profile als normaler Rollback.

## Aktueller Stand
d036940: 1053/1053 + fünf CI grün, local auth UAT rot bei JSONB-Roundtrip No-op, korrigiert im Folgeschritt. Keine produktive Änderung. Zusätzliche Gegnerprofile, Regelverifikation zur konkreten Dezember-Gruppe, reale Geräte-/CWL-Abnahme nicht behaupten.
