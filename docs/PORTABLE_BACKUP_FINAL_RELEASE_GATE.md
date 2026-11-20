# #178 – Verbindliche Abschlussgrenze für EIN vollständiges Cloud-App-Backup

**Stand 19.11.2026 · Cloud v1.27.0 · noch nicht als Nutzerfunktion freigegeben**

Dieses Dokument ersetzt **keine** der bestehenden Datenverträge, sondern stellt die abschließende technische und fachliche Abnahme **an einer Stelle** zusammen. Weitere unsichtbare Einzel-RPCs ohne Nachweis eines vollständigen, nutzerseitigen Roundtrips sind **nicht** das Ziel. Insbesondere darf ein teilweise erfolgreicher Restore nie als „Komplettes Backup wiederhergestellt“ angezeigt werden.


## 20.11.2026 – Korrektur der 17-Bereiche-Restore-Vorschau (separates Qualitätsgate)

Ein tatsächlicher Export und eine anschließende Vorschau auf denselben unveränderten Clan dürfen nicht wegen bereits vorhandener Audit-/Beobachtungszeilen als noch ausstehende Wiederherstellung erscheinen. Der Vergleich unterscheidet deshalb jetzt auch für `audit` und `observed` **identische, bereits vorhandene** Zeilen (`identical`) von **fehlenden oder widersprüchlichen historischen Belegen** (`reviewOnly`). Letztere bleiben ausdrücklich nicht automatisch rückspielbar. Zudem zählt der Reverse-Diff `targetOnly` bereits im Ziel vorhandene Datensätze, die in der älteren Quelldatei nicht vorkommen; sie dürfen weder gelöscht noch als fehlende Backup-Zeilen gezählt werden. Ein Ziel kann dadurch mehr Daten enthalten als die Sicherung, ohne dass überhaupt ein Import erforderlich ist.

Das Summenprotokoll trennt `alreadyIdentical` (auch keine Ziel-Extras) von `nothingToImport` (alle Quellzeilen bereits vorhanden, Ziel-Extras erlaubt) und stellt zusätzliche Zielzeilen separat dar. Bestehende Read-only-Gates `fullRestoreAvailable:false`, `mutationPermitted:false` bleiben zwingend. Die beiden Funktionen aus #330 sind seit Migration **20261120084903** nachgewiesen in der Live-DB installiert (beide SECURITY INVOKER, kein anon EXECUTE). Dieses Qualitätsgate verändert keine Live-Daten und ist **nicht** die Freigabe eines Full-Restores.

## 20.11.2026 – Originalherkunft für 17-Tabellen-Dateien (PR #330; vor Full-Apply)

Der SHA-256-Wert in einer frei bearbeitbaren JSON-Datei weist nur Beschädigungen nach: Der Dateibesitzer kann ihn nach jeder Bearbeitung neu berechnen. Für eine **spätere Rückübernahme von offiziell vom Clash-Collector geschützten Archiven** ist das nicht ausreichend.

[PR #330](https://github.com/Smolmig/cwl_planer/pull/330) ergänzt deshalb ein **serverseitig ausgestelltes Originalzeugnis**:

- `cwl_issue_owned_backup_witness` ruft nach erneuter Owner-/Mitgliedschaftsprüfung den **aktuellen konsistenten, bereits vorhandenen 17-Tabellen-SQL-Export** selbst auf. Für diesen tatsächlichen Live-Datenstand legt der Server in `private.cwl_portable_backup_witnesses` einen Digest mit Quell-Owner, Quellclans und echten Clash-Tags ab. Die private Tabelle bleibt außerhalb des öffentlichen REST-Datenschemas. Authentifizierte Benutzer dürfen **nur die vorgesehenen Receipt-Spalten** befüllen; die **INSERT-RLS-Policy berechnet den aktuellen vollständigen SQL-Snapshot nochmals selbst und lehnt jede abweichende Prüfsumme ab**. Es gibt keine UPDATE-/DELETE-Rechte und keinen frei setzbaren Zeitstempel oder Receipt-Identifier.
- In derselben **einen Backup-JSON-Datei** erscheint ein optionaler `server_receipt` (Receipt-ID, Owner-ID, Server-Hash, Original-Zeitpunkt). Der portable Datei-SHA-256 schützt auch dieses Feld gegen versehentliche Bearbeitung. Bestehende Format-v1-Dateien bleiben lesbar, sind ohne Datenbankzeugnis jedoch **nicht als originär belegt**.
- `cwl_verify_owned_backup_witness` prüft später serverseitig dieses Zeugnis erneut, den exakt gleichen vollständigen Originalinhalt (alle 17 Tabellen und sämtliche Zeilen/Felder; harmlose JSON-Array-Sortierung wird normalisiert), das anfragende aktuelle Besitzerkonto, sämtliche Zielclan-Mitgliedschaften und passende Clash-Tags. Wer Sterne, API-Angriffe oder historisch verifizierte Aufstellungen verändert und den gewöhnlichen Dateihash neu ausrechnet, kann dadurch **kein echtes Server-Originalzeugnis** herstellen.
- `exportWitnessedOwnerCloudSnapshot` und `verifyWitnessedOwnerCloudBackup` kapseln diese Prüfungen für den Client. Die bestehende `preparePortableOwnerBackupDownload`-Logik nutzt das Zeugnis. `inspectPortableOwnerRestoreFile` weist einen fehlenden oder ungültigen Beleg gesondert aus bzw. weist einen falschen Beleg ab.
- Der Beleg liegt **in derselben Supabase-Datenbank**. Nach einem vollständigen Ausfall samt Verlust dieses Receipts lässt sich seine Herkunft nur dann bestätigen, wenn auch das Receipt aus der **unabhängigen verschlüsselten technischen DB-Sicherung** zurückgeholt wurde. Es ist **keine portable Offline-Digitalsignatur**. Diese Grenze darf die Nutzeroberfläche später nicht verschweigen.

**Noch kein kompletter Wiederherstellungserfolg:** Ein Originalzeugnis verhindert das Einschleusen gefälschter Archiv-/Auditbelege, führt aber noch **keine** Schreiboperation aus. Die derzeitigen 17-tabelligen Client-Vorschauen bleiben `fullRestoreAvailable:false` und `mutationPermitted:false`. Erst nach einer isolierten echten 17-Tabellen-**Ein-Transaktions**-Apply-/Rollback-/Konflikt-UAT einschließlich aktiver Pläne darf der Nutzer-Restore freigeschaltet werden. Ein Export/Restore nach Verlust *aller* Infrastruktur ohne Witness muss separat als **unverifizierter** Wiederherstellungsmodus mit ausdrücklich abgestufter Datenqualität entworfen werden, nicht als bereits sicher bestätigt gelten. Die öffentliche Cloud-Version wird für diesen reinen Backendbaustein nicht erhöht.

## Stand der 17 portablen Datenbereiche

Der einzige app-weit konsistente Owner-Export `public.cwl_export_owned_backup` deckt alle **17 Tabellen** in einem MVCC-Lese-Snapshot ab; die Datei ist unabhängig vom laufenden Browser als JSON speicherbar und trägt Formatversion, Erstellungszeit, Herkunft, Clan-Tags und SHA-256. Auth-Passwörter, Session-Tokens, Einladungen, Owner-Rechte/Clanzugänge, operativer Collector-Status und technische Recovery-Tabellen sind bewusst ausgenommen. Bestehender verschlüsselter kompletter DB-Dump ist ein **separater** technischer Notfallweg.

| Datenbereich | Export | Tatsächlicher Rückschreibweg Stand heute | Verbindlicher letzter Gate |
|---|---|---|---|
| `cwl_cloud_profiles` | Vollständig | **Nur** `members`, `dayGoals`, `config` in *unbenutzte* Zielclans | Aktive CWL-Tage, alte Planstände und Archive transaktional/migrationsfähig, ohne jüngere Tage zu entwerten |
| `cwl_plan_review_state` | Vollständig | Nur Vorschau/private Kandidatenablage | Freigaben und gesperrte Pläne mit Owner-/Cycle-/CAS-Kontrolle |
| `cwl_clan_management_rules` | Vollständig | Noch kein Import | Regeln mit vorhandener Revision abgleichen und nur mit explizitem Owner-Okay zurückspielen |
| `cwl_stat_wars`, `cwl_stat_attacks`, `cwl_stat_missed` | Vollständig | **Ja, additiv**, transaktional in einem RPC mit Owner-RLS und unbestätigter Datei-Provenienz | Gemeinsam mit allen anderen Tabellen in **eine** atomare Wiederherstellung integrieren |
| `cwl_group_archives`, `cwl_own_lineup_archives` | Vollständig | Nur Vorschau/private Kandidatenablage | Collector-Verified-Status nicht aus editierbarer JSON-Datei vortäuschen; konfliktfreie, nachvollziehbare historische Wiederaufnahme |
| `cwl_profile_snapshots`, `cwl_change_events`, `cwl_plan_suggestions` | Vollständig | Kein Import | Unveränderliche Revisions-/Autorkette und Auth-Zuordnung sicher rekonstruieren |
| `cwl_missed_owner_decisions`, `cwl_clan_review_decisions`, `cwl_clan_cw_missed_decisions` | Vollständig | Kein Import | Vergangene Ownerentscheidungen nicht per JSON zu aktuellen disziplinarischen Nachweisen machen |
| `cwl_clan_member_tenure`, `cwl_clan_donation_observations`, `cwl_clan_absence_observations` | Vollständig | Kein Import | Beobachtungszeit, gesicherte Herkunft und wiederkehrende Spieler sicher behandeln |

**Wichtig:** Eine SHA-256-Prüfsumme erkennt beschädigte/irrtümlich veränderte Dateien, ist aber **keine Signatur** dafür, dass ein historischer API-/Collector-Fakt authentisch ist. Genau deshalb dürfen aktuell nicht unterstützte Tabellen nicht einfach über einen generischen UPSERT freigeschaltet werden.

## Tatsächlicher Datenumfang am 19.11.2026 (nur lesender Live-Count)

3 Profile, 338 Kriege, 6.112 Angriffe, 333 Missed-Einträge, 2 Gruppenarchive, 14 eigene Aufstellungsarchive, 12 Profil-Snapshots, 648 Änderungsereignisse, 498 Spendenbeobachtungen, 110 Clan-Mitgliedschaftsbeobachtungen, 16 Abwesenheitsbeobachtungen, 1 Regelwerk und 1 Planfreigabe. Andere Tabellen sind für spätere andere Clans trotzdem Teil des verpflichtenden Exports. Es wurden nur **aggregierte Zähler**, keine privaten Profil- oder Spielerwerte gelesen.

## Definition of Done: ein zusammenhängendes letztes Produktpaket

**Keine Teilfreigabe als „vollständiger Restore“.** Ein öffentliches Feature ist erst fertig, wenn folgende Eigenschaften gemeinsam nachgewiesen sind:

1. **Genau zwei** Cloud-Aktionen unter **Mehr → Backup & Wiederherstellung**: „Backup herunterladen“ und „Backup wiederherstellen“. Die Offline-Optionen für einzelnes/alle lokalen Profile bleiben separat wie bisher.
2. **Eine Datei** enthält die 17 autorisierten Datentabellen für alle berechtigten Owner-Clans. Der Download wird vor Freigabe erneut geparst und gegen SHA-256 und Dateikontrakt geprüft. Alte lokale Backups werden nicht als Cloud-Datei akzeptiert.
3. **Vorher-Vergleich statt Blind-UPSERT:** Eigentümer, echte Mitgliedschaft, Clantag, Zielrevision/CAS, Datenalter und Provenienz erneut **im Server** prüfen; Sicht auf `neu / identisch / Konflikt / unverifiziert`, inklusive gespielten CWL-Tagen, Archiv-/Statistikqualität und Owner-Entscheidungen.
4. **Ein serverseitiger, atomarer Schreibaufruf** mit vorherigem dauerhaften Recovery-Checkpoint für den **gesamten** wiederhergestellten App-Bestand. Bei jeder Konfliktsperre oder SQL-Ausnahme bleiben alle Tabellen unverändert. Wiederholter Import zählt keine Angriffe/Misses/Einsätze doppelt.
5. **Zwei vollständige isolierte Recovery-Versuche mit exportierter Originaldatei:** (a) frischer berechtigter Clan nach Datenverlust; (b) aktiver Clan mit newer API-Angriffen, CWL-Locks und verifizierten Archiven. Vorher-/Nachher-Vergleich **jedes** erforderlichen Bereichs; tatsächliche Nicht-Übernahme bei unlösbaren Konflikten. Identitätsreferenzen, die ohne Auth-/App-Owner-Neuanlage nicht mehr existieren, werden kenntlich gemacht, nicht stillschweigend erfunden.
6. **Release- und Gerätefreigabe:** GitHub-CI, PostgreSQL-RLS-, Datenduplikat- und echte Owner-/iPhone-PWA-/Android-Prüfung (#213), DE und EN Hilfe/Status/Fehlertexte, Gold/Dark/Light sowie Version/Update-Verlauf/Changelog synchron. Erst dann Veröffentlichung und Schließen von #178.

## Der neue technisch prüfbare Gate-Aufruf

`cloud-portable-backup-release-gate.mjs` stellt `preparePortableOwnerBackupDownload` (17-Tabellen-Owner-Snapshot, Ein-Datei-JSON-Roundtrip, Integritätsprüfung) und `inspectPortableOwnerRestoreFile` (Dateiverifikation + neue/identische/konfliktierende/prüfpflichtige Zeilen **aus dem RLS-geprüften Live-Ziel**) bereit. `summarizePortableRestoreCoverage` zeigt die Lücken pro Tabelle und lehnt jede Behauptung eines vollständigen schreibenden Roundtrips aktuell ausdrücklich ab: `mutationPermitted:false`, `fullRestoreAvailable:false`.

**Die Schalter sind Absicht und kein Fehler:** Keinen öffentlichen Wiederherstellen-Knopf einschalten, solange der Beweis für die restlichen Tabellen fehlt. Auch ein leerer Konfliktbericht bedeutet höchstens, dass **nichts zu schreiben** ist – nicht, dass ein erfolgreicher Full-Restore durchgeführt wurde. Die echten partiellen RPCs #323/#325/#327 bleiben nur gezielte Backendwerkzeuge ohne automatische Vollbackup-Freigabe.

## Abschlussentscheidung

Den bisherigen technischen **Export-/Restore-Vorbereitungsabschnitt** jetzt beenden. Die fehlende produktive Voll-Wiederherstellung ist **genau ein zusammenhängendes, releasegeprüftes Restpaket**, kein neuer Stapel kleiner Zwischen-PRs. #178 bleibt bis zur vollständigen Abnahme offen. Die vollständige tägliche **verschlüsselte technische Datenbanksicherung mit isoliertem Restore-Test** läuft unabhängig davon weiter. Cloud v1.27.0 unverändert.
