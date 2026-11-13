# CWL Planer – Backup- und Optimierungskonzept
Stand: 31.10.2026 · Cloud v1.1.0-alpha.9 · lokale PWA v1.0.2

## Ergänzung 13.11.2026 – echtes Backup mit dem neuen Inhaltsprüfer erneut testen

**Ziel:** Den bereits vorhandenen, am 13.11.2026 erfolgreich verschlüsselten Backup-Lauf [43402344939](https://github.com/Smolmig/cwl_planer/actions/runs/43402344939) mit dem **neueren** exakten Statistik-Content-Prüfer nochmals in einer unabhängigen lokalen Datenbank wiederherstellen. Das Artefakt `cwl-encrypted-db-43402344939` wurde heute als vorhanden und **nicht abgelaufen** bestätigt (30 Tage Aufbewahrung). Der [ältere Restore-Lauf 43402524839](https://github.com/Smolmig/cwl_planer/actions/runs/43402524839) war grün, liegt jedoch **vor** Einführung des exakten COPY-Inhaltsvergleichs und ist daher **kein** Beleg für diese neue Prüfung.

**Technischer Testpfad:** Der bereits bestehende `.github/workflows/test-encrypted-restore.yml` kann nun zusätzlich als **wiederverwendbarer GitHub-Actions-Workflow** mit einer explizit übergebenen `backup_run_id` genutzt werden. Der neue, auf `main` begrenzte Helper `.github/workflows/verify-encrypted-backup-drill.yml` löst beim **erstmaligen Merge seiner eigenen Workflowdatei** einmalig den sicheren Restore des genannten Bestandsartefakts aus. Später ist derselbe Helper per `workflow_dispatch` mit einer neuen Backup-Run-ID manuell nutzbar. Der nächtliche Auslöser `workflow_run` nach jedem erfolgreichen neuen Backup bleibt weiterhin aktiv.

**Datengrenzen:** Der Helper erhält **ausschließlich** den GitHub-Lesetoken, eine öffentliche Backup-Run-ID und das in den GitHub-Actions-Secrets hinterlegte GPG-Passwort. Er erhält **keine `SUPABASE_DB_URL`**, keinen DB-Admin-Zugang und kein Service-Role-Token. Die Wiederherstellung läuft ausschließlich gegen eine temporäre lokale PostgreSQL-Instanz unter `127.0.0.1` **mit einem auf dem Runner erst ausgewählten freien TCP-Port**. Der Port wird einmalig in der erzeugten lokalen Supabase-Konfiguration gesetzt und über `GITHUB_ENV` allen Wiederherstellungs- und Vergleichsschritten identisch übergeben; ein fest belegter Standardport ist nicht erforderlich. GPG-Entschlüsselung erfolgt nur innerhalb des Action-Runners. Das Artefakt wird auf SHA-256 geprüft. In den Logs erscheinen **keine** Spieler-/Clan-Datensätze, SQL-Dumps, Geheimnisse oder Vergleichshashes. Nach dem Test werden die temporäre lokale Datenbank und die entschlüsselten Dateien gelöscht. Das bestehende automatische Restore-Gate bleibt unverändert im Verhalten.

**Echter erster Re-Drill:** [GitHub-Run #43513814369](https://github.com/Smolmig/cwl_planer/actions/runs/43513814369) erreichte erfolgreich Download, GPG-Entschlüsselung, SHA-256 und Auth-Dump-Konsistenz. Die lokale Datenbank **startete nicht**, weil der GitHub-Runner Port `54322` bereits belegt hatte. SQL-Restore, Zeilenvergleich und exakter Statistik-Inhaltsvergleich wurden daher **übersprungen** und gelten **nicht als erfolgreich**. Der daraufhin getrennt vorbereitete Fix wählt einen freien Port, prüft den Konfigurationswechsel synthetisch und startet den bestehenden Helper durch einen gezielten Workflowdatei-Push erneut. **Nur ein nachweislich vollständiger grüner Wiederholungsrun darf das Gate schließen.**

**Zweiter echter Re-Drill / Umgebungsvariablen-Scope:** [Run #43514747116](https://github.com/Smolmig/cwl_planer/actions/runs/43514747116) hat das reale Artefakt erneut erfolgreich geprüft und **diesmal die lokale Supabase-Instanz mit einem freien Port gestartet**. Der letzte Health-Probe-`psql`-Befehl derselben GitHub-Actions-Step scheiterte jedoch wegen Bash `set -u`: Der in `GITHUB_ENV` geschriebene Wert `CWL_RESTORE_DB_PORT` wird von GitHub erst in **nachfolgenden** Steps eingelesen, nicht rückwirkend im laufenden Shell-Prozess. Der sichere Fix exportiert die Variable deshalb **zusätzlich im aktuellen Prozess vor der ersten psql-Probe**; die bisherige `GITHUB_ENV`-Weitergabe an die nachfolgenden Schritte bleibt erhalten. Auch dieser Lauf hat noch keinen SQL-Restore/Content-Vergleich ausgeführt und ist **kein** grünes Gate.

**Abnahme – nicht vorgreifen:** Bis die tatsächlich von `main` ausgelöste Wiederholung **grün** ist und ihr Protokoll die drei exakten Datenabgleiche enthält, gilt die neue reale Inhaltsprüfung weiterhin als **offen / NO-GO**. Der Test bestätigt auch nach Erfolg nur die drei Statistik-Tabellen (und die übrigen bestehenden Restore-Checks), **nicht** die vollständige Wiederherstellbarkeit von GitHub-Secrets, Edge-Functions, GitHub-Konfiguration, Auth-E-Mails oder externem Storage. Der ClashPerk-Draft #280 benötigt zusätzlich gehostetes Staging, Original-XLSX, iPhone und die gesonderte Veröffentlichungsentscheidung.

---

## Ergänzung 13.11.2026 – verschlüsselte Statistik-Wiederherstellung absichern

Die täglichen verschlüsselten Datenbank-Backups und der nachfolgende isolierte Restore wurden am **13.11.2026** auf `main` erfolgreich ausgeführt ([Backup-Lauf](https://github.com/Smolmig/cwl_planer/actions/runs/43402344939), [Restore-Lauf](https://github.com/Smolmig/cwl_planer/actions/runs/43402524839)). Der damalige Produktiv-Workflow verglich zwar Zeilenzahlen und RLS der wichtigen Tabellen, **nicht aber den exakten Inhalt** aller historischen CW/CWL-Angriffe und Missed-Nachweise.

Eine unabhängige Backup-Prüfungsänderung ergänzt deshalb im bestehenden automatischen Restore-Workflow:
- `public.cwl_stat_wars`, `public.cwl_stat_attacks` und `public.cwl_stat_missed` als verpflichtende COPY-Tabellen mit Anzahlprüfung;
- den exakten, zeilenreihenfolgeunabhängigen COPY-Inhaltsabgleich jeder dieser Tabellen nach Wiederherstellung in der **isolierten lokalen Datenbank**, einschließlich RLS;
- synthetische Negativtests für gleichen Rowcount bei geändertem Sternwert, fehlenden Tabellenblock und ausgeschaltete RLS. Bei Abweichung ist der Restore-Check **rot**, nicht fälschlich grün.

Der Abgleich verwendet nur den **bereits entschlüsselten lokalen Backup-Dump** und die **lokale Restore-Datenbank (127.0.0.1:54322)**; keine Verbindung oder Schreiboperation zur produktiven Supabase-DB. Inhaltliche Zeilen/Hashes werden nicht in GitHub-Logs veröffentlicht. Diese Änderung ist ein **technisches Backup-Gate**, **kein** neues Cloud-App-Backup-/Import-Menü und kein Ersatz für die vollständige Infrastruktur-/Auth-/Storage-Disaster-Recovery (#178). `main` bleibt auf App-Version **v1.18.1**; erst nach Merge und nachfolgendem echtem automatischem Backup-/Restore-Durchlauf gilt der neue Inhaltsvergleich für ein tatsächliches verschlüsseltes Produktiv-Artifact als bestätigt. Die umfangreiche ClashPerk-Release-PR #280 bleibt getrennt und weiterhin ohne Produktiv-Migration.

---

## Neue Produktentscheidung 09.11.2026 – vereinfachter Backup-/Import-Pfad (noch nicht live)

**Verbindliche Anforderung aus Nutzerfeedback:** [Issue #178](https://github.com/Smolmig/cwl_planer/issues/178). Die folgenden Punkte sind das **zukünftige Zielbild** und dürfen nicht mit bereits implementierter Funktionalität verwechselt werden.

| Variante | Sichtbarer Nutzerweg | Inhalt / Zweck |
| --- | --- | --- |
| **Cloud – interne technische Sicherung** | Automatisch, keine zusätzliche App-Backup-Variante für Nutzer | Vorhandene Cloud-Profil-Snapshots und externe verschlüsselte DB-Dumps samt geprüftem Restore-Prozess für Betrieb und Notfall erhalten. Snapshot in derselben Supabase-DB ist **kein** unabhängiges Offsite-Backup. |
| **Cloud – eine externe App-Datensicherung** | **Backup herunterladen** | **Eine** versionierte Datei für die wichtigen berechtigten Anwendungsdaten aus der **gesamten App**, inklusive Clanprofil(e), Mitgliedern/Notizen, Regeln/Planungen, CWL-Archiv, Statistiken und Angriffs-/Kriegs-/Quellhistorie sowie relevanten Einstellungen. Datenumfang erst nach Inventar aller Tabellen/Relationen festlegen. |
| **Cloud – wieder einspielen** | **Backup wiederherstellen** | Dieselbe Datei kontrolliert und idempotent einspielen; nach Totalausfall **erst Backend/Anmeldung/Autorisierung wiederherstellen**, dann App-Daten importieren. Keine doppelten Daten durch Überlappung oder Wiederholung, keine stillen Überschreibungen. |
| **Separate Offline-PWA** | **Einzelprofil** oder **alle Profile** sichern/importieren | Bisheriges lokales Einzel-/Sammelprofil-Backup erhalten, inklusive Rückwärtskompatibilität und ohne Cloud-Datenvermischung. |

- **Nur ein Cloud-Backup-/Restore-Weg**, keine zusätzlichen funktionalen Cloud-Teilbackups oder separater Statistik-Restore. Frühere Cloud-Plan-JSON-Downloadmöglichkeiten bei Einführung schonend zusammenführen, ohne alte exportierte Dateien oder interne technische Sicherungen unbrauchbar zu machen. Die folgenden Abschnitte dokumentieren teils historische tatsächlich vorhandene Mechanismen.
- **Statistik-Berichtexporte** bleiben als lesbare/teilbare Auswertung, nicht als Backupdatei. **ClashPerk-Originalimporte** bleiben als spezialisierter Erst-/Fremddatenimport erhalten ([#176](https://github.com/Smolmig/cwl_planer/issues/176)); nicht als zweites generisches Backup-Menü ausgestalten.
- **Sicherheit:** Rollen und Clanzugehörigkeit für jeden exportierten oder importierten Datensatz serverseitig prüfen (Multi-Tenant/RLS); ein Cloud-App-Backup umfasst nur autorisiert gesicherte Clans, keine fremden Beobachterdaten. Keine Passwörter, Tokens oder Service-Secrets in die exportierte Nutzerdatei. Importdateien prüfen, Sicherungspunkt/Bestätigung und atomare/rollbackfähige Wiederherstellung verlangen.
- **Wiederherstellung testen:** kompletter Roundtrip mit Kriegen/Angriffen/Quellen/Abdeckung, Duplikatimport, Cloud-Merge-Konflikt, verlorener DB nach Infrastruktur-Restore, unberechtigtem Clan-Zugriff und Offline-Einzel-/Sammelprofilen. Kein bloßer JSON-Export eines Planprofils als „vollständig“ bezeichnen.

---

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

## 3. Externe tägliche Datenbank-Backups – AKTIV

**Stand 31.10.2026:** Der verschlüsselte Backup-Workflow wurde manuell erfolgreich ausgeführt (Lauf #2). Das Artifact wurde heruntergeladen und der isolierte Wiederherstellungstest #10 hat Schema, Auth- und CWL-Anwendungsdaten eingespielt sowie Datensatzzahlen und RLS geprüft. Nachfolgend bleibt die Einrichtung als Anleitung für spätere Neuinstallationen dokumentiert.

1. In GitHub `Smolmig/cwl_planer` → **Settings → Secrets and variables → Actions → New repository secret**.
2. `SUPABASE_DB_URL`: Supabase Dashboard → Projekt → **Connect** → **Session pooler** (Transaktions-Pooler vermeiden, weil `pg_dump` eine längere Session benötigt). Die vollständige URL inklusive DB-Passwort dort kopieren. Sonderzeichen im Passwort korrekt URL-encodieren. **Niemals in einen Chat, in HTML, Commit, Screenshot oder in ein Issue kopieren.**
3. `CWL_BACKUP_PASSPHRASE`: eigenes zufälliges starkes Passwort mit mindestens 24 Zeichen. Außerhalb von GitHub im Passwortmanager sicher hinterlegen; **ohne dieses Passwort sind die Backups nicht wiederherstellbar**.
4. GitHub → **Actions → Encrypted Supabase backup → Run workflow**. Erst wenn der Lauf grün ist und ein nichtleeres `cwl-encrypted-db-<run-id>`-Artifact vorhanden ist, gilt der externe Backup-Job als erfolgreich eingerichtet. Danach folgt der tägliche Zeitplan 02:17 UTC. Ein fehlendes Secret führt bewusst zu einem fehlschlagenden Lauf mit klarer Fehlermeldung.
5. Monatlich mindestens ein verschlüsseltes Artifact **zusätzlich außerhalb GitHub** in einem geschützten Speicher sichern, beispielsweise verschlüsselter Tresor/Cloud oder externe Festplatte. Ein wiederholt fehlgeschlagener Actions-Lauf muss aktiv untersucht werden.

Der Backup-Workflow erhält nur `contents: read`; der Restore-Test zusätzlich `actions: read`, um das verschlüsselte Artifact herunterladen zu können. Es werden **keine** SQL-Dumps ins öffentliche Git-Repository committed. Artefakte verlassen den Runner ausschließlich **nach** GPG-Verschlüsselung. Der Workflow testet nach der Verschlüsselung die Entschlüsselbarkeit des TAR-Archivs und speichert eine SHA-256-Prüfsumme.

**Automatischer Restore-Test:** `.github/workflows/test-encrypted-restore.yml` startet nach jedem erfolgreichen Lauf von `Encrypted Supabase backup` auf `main` automatisch (GitHub-Event `workflow_run`). Er übernimmt die Run-ID des gerade erstellten Backups, entschlüsselt das Artifact nur auf dem temporären GitHub-Runner, spielt die Anwendungsdaten in eine isolierte lokale Supabase-Datenbank ein und prüft Zeilenzahlen und RLS. Bei fehlgeschlagenem Backup wird der Restore-Job übersprungen. Der bisherige manuelle Test über `workflow_dispatch` bleibt erhalten. **Diese neue automatische Verkettung wurde noch nicht mit einem nachfolgenden Backup-Lauf praktisch getestet.**

**Achtung:** Der kostenlose Supabase-Plan enthält keine täglich abrufbaren Plattform-Backups. Ein grüner Backup-Workflow ersetzt keine echte Wiederherstellungsprobe.

## 4. Wiederherstellungsprobe / Disaster Recovery

Für einen einfachen versehentlichen Spieler-/CWL-Fehler: In der Cloud das passende Profil/Sicherungspunkt wählen und nur als Besitzer nach vollständiger Bestätigung wiederherstellen; idealerweise zuvor ein JSON exportieren.

Für einen Supabase-Totalausfall:
1. Letztes verschlüsseltes Artifact aus Actions herunterladen und die SHA-256-Prüfsumme des verschlüsselten Files prüfen.
2. Auf einem **eigenen sicheren Rechner** GPG mit dem hinterlegten Passwort ausführen, um `cwl-backup.tar.gz.gpg` zu entschlüsseln (Passwort nicht in die Shell-History als Klartext übernehmen), TAR entpacken. Enthalten: `roles.sql`, `schema.sql`, `data.sql`, `auth-data.sql` und eine Zeitstempel-README.
3. Neue **Test-Supabase-Instanz** einrichten. Rollen, Schema und App-Daten nach der offiziellen Supabase-Anleitung importieren. Auth-Daten sind bewusst separat und erfordern eine gezielte Migration in das neue Auth-Schema; nicht blind in ein aktives Produktionsprojekt einspielen.
4. Prüfen: Auth-Benutzer vorhanden; `public.cwl_clans`, `public.cwl_clan_memberships`, `public.cwl_cloud_profiles`, `public.cwl_change_events` und `public.cwl_profile_snapshots` korrekt; Zugriffsrechte/RLS aktiv. Supabase Edge-Functions und ihre **Secrets** sowie die öffentliche Frontend-Projektkonfiguration müssen separat wiederhergestellt werden. Fehlende Auth-/Storage-Anpassungen und Migrationshistorie separat beachten.
5. Erst nach erfolgreicher Probe und vollständiger Validierung eine Produktions-Umschaltung durchführen.

**Nachgewiesen:** Am 31.10.2026 hat der manuelle isolierte Restore-Test #10 das verschlüsselte Artifact aus Backup-Lauf #2 entschlüsselt und das Schema, Auth- und CWL-Daten erfolgreich in eine lokale Testdatenbank importiert. Für die fünf zentralen CWL-Tabellen sowie `auth.users` stimmen die Zeilenzahlen mit dem Backup überein; RLS ist bei den geprüften CWL-Tabellen aktiv. Überschneidende Auth-COPY-Blöcke werden nur bei identischem Inhalt dedupliziert; leere plattformverwaltete Storage-Vector-Tabellen werden beim lokalen Test übersprungen.

**Weiterhin offen:** `roles.sql` wird im lokalen Test nicht importiert, weil die lokale Supabase-Instanz ihre Systemrollen bereits selbst provisioniert. Ein vollständiger Disaster-Recovery-Test in einem frischen gehosteten Supabase-Projekt (einschließlich Rollen, Secrets, Edge Functions, externen Storage-Objekten und End-to-End-Anmeldung) wurde noch nicht durchgeführt. Ein grüner lokaler Restore-Test darf daher nicht als vollständig bewiesene Produktionswiederherstellung missverstanden werden.

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

