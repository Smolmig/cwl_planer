# CWL Planer – Backup- und Optimierungskonzept
Stand: 30.10.2026 · Cloud v1.1.0-alpha.9 · lokale PWA v1.0.2

## 1. Drei Ebenen, unterschiedliche Ausfälle

| Ebene | Was ist enthalten? | Wo gespeichert? | Wie wird wiederhergestellt? |
| --- | --- | --- | --- |
| Lokaler Recovery-Snapshot | Voriger lokaler Stand pro Browsergerät | localStorage (gleicher Browser!) | Bestehende Recovery-Funktion / JSON-Export |
| Automatische Cloud-Sicherungspunkte | Gemeinsamer CWL-Plan samt Mitgliedern, Regeln, gespielten Tagen und Archiven | `public.cwl_profile_snapshots` (selbe Supabase-Datenbank) | Besitzer über **Clan & Konto → Sicherungspunkte** |
| Verschlüsselter täglicher Datenbankexport | DB-Rollen, Schema, App-Daten und separate Auth-Daten | **GitHub Actions Artifact**, AES-256 mit GPG, 30 Tage | Herunterladen, lokal entschlüsseln und in eine frische Test-Datenbank importieren |

**Wichtig:** Cloud-Sicherungspunkte sind keine unabhängigen Backups: Wenn die Supabase-Datenbank verloren geht oder der Clan vollständig gelöscht wird, sind auch diese Snapshots weg. Deshalb gibt es zusätzlich den externen Workflow. GitHub Actions Artifacts sind keine dauerhafte Archivierung und laufen nach 30 Tagen ab.

## 2. Was bereits automatisch funktioniert

Die Datenbank legt vor einer Änderung des Cloud-Profils einen Snapshot an, wenn bisher noch keiner existiert, der jüngste mindestens 30 Minuten alt ist oder mindestens 20 weitere Revisionen entstanden sind. Pro Clan werden beim nächsten neuen Snapshot die ältesten Einträge auf maximal 24 reduziert. Snapshotdaten sind RLS-geschützt; nur bereits berechtigte Clanmitglieder können sie lesen.

Der **Besitzer** kann einen älteren Stand nach doppelter Bestätigung zurückholen. Die Wiederherstellung prüft die erwartete Cloud-Revision atomar und sichert den unmittelbar vorherigen aktuellen Stand separat. Vize und Beobachter können Sicherungspunkte als JSON herunterladen, nicht aber den gemeinsamen Stand zurücksetzen. Anschließend werden verbundene Clients durch die normale Realtime-/Revisionslogik aktualisiert.

Die App ist kein vollständiges Datenbank-Backup: Der JSON-Export enthält nur den gewählten Clanplan, nicht die Supabase-Accounts, Einladungen, Berechtigungen anderer Clans oder die Serverkonfiguration.

## 3. Externe tägliche Datenbank-Backups AKTIVIEREN

Die Datei `.github/workflows/encrypted-backup.yml` ist im Repository vorhanden, aber **bis zum erfolgreichen Hinterlegen der Geheimnisse und einem verifizierten manuellen Test nicht als aktiviert betrachten**.

1. In GitHub `Smolmig/cwl_planer` → **Settings → Secrets and variables → Actions → New repository secret**.
2. `SUPABASE_DB_URL`: Supabase Dashboard → Projekt → **Connect** → **Session pooler** (Transaktions-Pooler vermeiden, weil `pg_dump` eine längere Session benötigt). Die vollständige URL inklusive DB-Passwort dort kopieren. Sonderzeichen im Passwort korrekt URL-encodieren. **Niemals in einen Chat, in HTML, Commit, Screenshot oder in ein Issue kopieren.**
3. `CWL_BACKUP_PASSPHRASE`: eigenes zufälliges starkes Passwort mit mindestens 24 Zeichen. Außerhalb von GitHub im Passwortmanager sicher hinterlegen; **ohne dieses Passwort sind die Backups nicht wiederherstellbar**.
4. GitHub → **Actions → Encrypted Supabase backup → Run workflow**. Erst wenn der Lauf grün ist und ein nichtleeres `cwl-encrypted-db-<run-id>`-Artifact vorhanden ist, gilt der externe Backup-Job als erfolgreich eingerichtet. Danach folgt der tägliche Zeitplan 02:17 UTC. Ein fehlendes Secret führt bewusst zu einem fehlschlagenden Lauf mit klarer Fehlermeldung.
5. Monatlich mindestens ein verschlüsseltes Artifact **zusätzlich außerhalb GitHub** in einem geschützten Speicher sichern, beispielsweise verschlüsselter Tresor/Cloud oder externe Festplatte. Ein wiederholt fehlgeschlagener Actions-Lauf muss aktiv untersucht werden.

GitHub Actions erhält nur `contents: read`. Es werden **keine** SQL-Dumps ins öffentliche Git-Repository committed. Artefakte verlassen den Runner ausschließlich **nach** GPG-Verschlüsselung. Der Workflow testet nach der Verschlüsselung die Entschlüsselbarkeit des TAR-Archivs und speichert eine SHA-256-Prüfsumme.

**Achtung:** Der kostenlose Supabase-Plan enthält keine täglich abrufbaren Plattform-Backups. Ein grüner Backup-Workflow ersetzt keine echte Wiederherstellungsprobe.

## 4. Wiederherstellungsprobe / Disaster Recovery

Für einen einfachen versehentlichen Spieler-/CWL-Fehler: In der Cloud das passende Profil/Sicherungspunkt wählen und nur als Besitzer nach vollständiger Bestätigung wiederherstellen; idealerweise zuvor ein JSON exportieren.

Für einen Supabase-Totalausfall:
1. Letztes verschlüsseltes Artifact aus Actions herunterladen und die SHA-256-Prüfsumme des verschlüsselten Files prüfen.
2. Auf einem **eigenen sicheren Rechner** GPG mit dem hinterlegten Passwort ausführen, um `cwl-backup.tar.gz.gpg` zu entschlüsseln (Passwort nicht in die Shell-History als Klartext übernehmen), TAR entpacken. Enthalten: `roles.sql`, `schema.sql`, `data.sql`, `auth-data.sql` und eine Zeitstempel-README.
3. Neue **Test-Supabase-Instanz** einrichten. Rollen, Schema und App-Daten nach der offiziellen Supabase-Anleitung importieren. Auth-Daten sind bewusst separat und erfordern eine gezielte Migration in das neue Auth-Schema; nicht blind in ein aktives Produktionsprojekt einspielen.
4. Prüfen: Auth-Benutzer vorhanden; `public.cwl_clans`, `public.cwl_clan_memberships`, `public.cwl_cloud_profiles`, `public.cwl_change_events` und `public.cwl_profile_snapshots` korrekt; Zugriffsrechte/RLS aktiv. Supabase Edge-Functions und ihre **Secrets** sowie die öffentliche Frontend-Projektkonfiguration müssen separat wiederhergestellt werden. Fehlende Auth-/Storage-Anpassungen und Migrationshistorie separat beachten.
5. Erst nach erfolgreicher Probe und vollständiger Validierung eine Produktions-Umschaltung durchführen.

**Nicht getan:** Eine vollständige Wiederherstellung der verschlüsselten Dumps in einem zweiten Supabase-Projekt ist noch nicht getestet (hierzu braucht es einen erfolgreich erstellten echten Export und eine Testinstanz). Das gilt daher noch nicht als bewiesener Disaster-Recovery-Pfad.

## 5. Speicher- und Performance-Optimierungen

- Beim lokalen Speichern prüfen beide App-Versionen zuerst, ob sich das serialisierte Profil überhaupt verändert hat. UI-only-Renders verursachen dann keinen erneuten kompletten Schreibvorgang.
- Die Backup-Kopie unter `RECOVERY_KEY` wird nicht mehr nach jedem lokalen Speichern neu geschrieben, sondern maximal ungefähr alle 15 Minuten, sofern ein gültiger vorheriger Stand existiert. Der **aktuelle** geänderte Stand wird weiterhin sofort gespeichert.
- Die Tagessortierung nutzt einmal pro Berechnung ein `Map` der Mitgliederreihenfolge statt mehrfaches lineares `indexOf` innerhalb des Sortiervergleichs. Die Auswahlkriterien, Regeln und die Tie-Break-Formel bleiben unverändert.
- Die Cloud-Wiederherstellungs-UI wurde in `cloud-backups.mjs` ausgelagert. Nur Metadaten der letzten 24 Snapshots werden zunächst übertragen; die volle JSON-Nutzlast wird nur beim Download/Wiederherstellen geladen.
- Profil-Datenformat bleibt **v9** und der Speicherschlüssel `cwl_planer_mobile_v9`; keine Datenmigration, kein Löschen von Archiven.

## 6. Monitoring und Grenzen

Zum Start der Runde: ca. **12 MB PostgreSQL-Datenbankgröße**, ein Cloud-Profil mit ca. **13,7 KB JSON** und rund **82 Änderungsereignisse**. Das ist eine Momentaufnahme, keine Verbrauchsprognose. Bei mehreren Clans werden Realtime-/Datenverkehr und Angriffshistorien eher zum Problem als die jetzigen Mitgliederlisten.

Regelmäßig kontrollieren: GitHub Actions Backupgrün, Größe/Anzahl der Artifacts, Supabase Quota/DB-Größe, Realtime und Edge-Function-Aufrufe, Fehlerraten, fehlgeschlagene Restore-Versuche. Auf Supabase Free ist die Plattform-Datenbank nach Inaktivität pausierbar.

## 7. Quellen

- Supabase offizielle Anleitung: https://supabase.com/docs/guides/deployment/ci/backups
- Supabase Plattform-Backups: https://supabase.com/docs/guides/platform/backups
- Supabase CLI Dump & Schemafilter: https://supabase.com/docs/reference/cli/global-flags
- GitHub Actions Artifacts: https://github.com/actions/upload-artifact

