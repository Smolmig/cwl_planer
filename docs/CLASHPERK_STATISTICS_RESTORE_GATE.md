# ClashPerk-Historie – Backup-/Restore-Freigabeprüfung

**13.11.2026 | Entwurf zu Issues #178 und #269, Draft-PR #276.**
Die Datenbank und die Excel-Importfunktion sind bis zur kontrollierten Freigabe unverändert produktiv.

## Zweck

Ein ClashPerk-Import darf die gespeicherten historischen Kriegsdaten nicht nur optisch in der Statistik anzeigen: Nach einem Notfall-Restore müssen alle **Kriege**, **ausgeführten Angriffe** und **nachgewiesenen nicht verwendeten Angriffe** unverändert wieder verfügbar und weiterhin nach Clan-Zugehörigkeit geschützt sein.

Diese Daten liegen in drei bereits vorhandenen RLS-Tabellen:

| Tabelle | Beinhaltet | Wiederherstellungsprüfung |
| --- | --- | --- |
| `public.cwl_stat_wars` | normal/CWL, Quellenherkunft, Datum, Gegner, Teamgröße, `finalized`, `missed_log_complete`, ggf. Roster | Exakte Zeilen und Daten, RLS |
| `public.cwl_stat_attacks` | einzelne eigene Angriffe mit Player-Tags, Angriff 1/2, Sterne, Zerstörung und RH | Exakte Zeilen und Daten, RLS |
| `public.cwl_stat_missed` | pro Spieler/Krieg ausdrücklich belegte verpasste Angriffe | Exakte Zeilen und Daten, RLS |

Der bestehende tägliche Workflow `.github/workflows/encrypted-backup.yml` sichert das **gesamte Datenbankschema und die Daten** weiterhin verschlüsselt. Er wird nicht geändert. Der bereits vorhandene `.github/workflows/test-encrypted-restore.yml` prüft die Wiederherstellung aus einem solchen Backup in einer isolierten lokalen Supabase-PostgreSQL-Instanz. Bislang wurden dabei nicht ausdrücklich alle drei Statistik-Tabellen auf ihren tatsächlichen Inhalt überprüft.

## Änderung in #276

1. Die verschlüsselte Restore-Prüfung verlangt jetzt `COPY`-Abschnitte der drei Statistik-Tabellen und prüft deren Zeilenanzahl und aktiviertes RLS.
2. `scripts/verify_clashperk_restore.py` vergleicht alle **COPY-Textzeilen**, über SHA-256 in stabil sortierter Reihenfolge, zwischen dem gesicherten SQL-Dump und der zurückgespielten Datenbank. Eine Veränderung eines einzelnen Sterne-/Missed-Wertes bei gleicher Zeilenzahl wird erkannt. Der Checker selbst ist strikt lesend und druckt weder Spielernamen, Tags noch Inhalte oder Hashwerte.
3. Zusätzliche CI `.github/workflows/clashperk-stats-restore-ci.yml`: Erstellt in einem **kurzlebigen PostgreSQL 17** zwei künstliche Clans mit echten Statistik-RLS-Schemamigrationen, führt den atomaren ClashPerk-Import aus, sichert alles mit **passendem PostgreSQL-17-`pg_dump`**, restauriert das Backup mit `pg_restore` in eine **andere** Datenbank und prüft danach den exakten Inhalt, RLS/Viewer-/Owner-Isolation sowie einen erfolgreichen Import weiterer synthetischer historischer Kriegsdaten.
4. Ein zusätzlicher Negativtest verändert genau **einen Sternwert** in der restaurierten Testdatenbank, lässt aber alle Zeilenzahlen gleich. Der Vergleich **muss fehlschlagen**; nach Rücksetzung müssen die ursprünglichen Hashvergleiche wieder übereinstimmen.

## Was damit nicht getestet ist

- Keine Verbindung zur produktiven Datenbank und **kein** Test mit einem echten privaten Backup in diesem PR. Die neue verschlüsselte Restore-Prüfung wird im normalen Betriebsablauf nur nach einem tatsächlich erfolgreichen täglichen Backup der `main`-Version gestartet.
- Kein reales getrenntes Supabase-Staging verfügbar (nur ein Produktivprojekt, ohne Development-Branches): Der hier geprüfte PostgreSQL-17-Import und die Restore-Validierung ersetzen nicht die Abnahme in einem separaten Supabase-Testprojekt mit realen Logins.
- Kein physischer Safari-/iOS-PWA-Test; WebKit wurde separat in #275 geprüft.
- **Nicht** das manuelle, vollständige nutzerseitige Cloud-App-Backup aus Issue #178: Dieses bleibt ein separates Produktmerkmal, ebenso wie das Offline-Profil-Backup.
- Die bestehenden verschlüsselten GitHub-Backupartefakte haben weiterhin begrenzte Aufbewahrung (30 Tage). Für Katastrophenfälle ist langfristiger, sicherer externer Recovery-Zugriff gesondert zu planen.

## Freigabekriterien

Vor einer produktiven Aktivierung des direkten ClashPerk-XLSX-Imports müssen die isolierten Import-/HTTP-/Browser-/Restore-CI-Gates grün sein; danach müssen ein reales Staging-UAT mit echten Benutzerrollen, eine geprüfte Verschlüsselungs-/Wiederherstellungsstrategie für den konkreten Betrieb und die iOS-PWA-Abnahme erfolgen. Hilfe-Seite, Changelog und Version sind zusammen mit dem eigentlichen Live-Release zu pflegen.

**Der PR ist ein Entwicklungs-/Test-Entwurf und verändert keine historischen Produktivdaten.**
