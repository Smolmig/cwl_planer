# #178 – Portable Cloud-App-Backup: Datenvertrag und Sicherheitsgrenzen (19.11.2026)

**Status: Phase 3c in PR #327 erfolgreich gemergt und auf Supabase live installiert: tatsächlich schreibender Planungsfeld-Apply ausschließlich für unbenutzte Owner-Zielclans, atomarer privater Vorher-/Nachher-Checkpoint. Noch keine vollständige Plan-/Archiv-/Cloud-App-Wiederherstellung und weiterhin kein öffentlicher Backup-/Restore-Dialog.**
Produktive Cloud v1.27.0 bleibt unverändert. Die Datei `cloud-portable-backup-core.mjs` wird von keiner UI importiert. Die alten Cloud-Profil-Snapshots und Offline-Backups bleiben vorerst funktional, dürfen jedoch **nicht** als vollständiger Cloud-App-Roundtrip bezeichnet werden.

## 1. Tatsächliches Schema statt Annahmen

Das verbundene Supabase-Projekt wurde am 19.11.2026 **nur lesend** über die Table-Introspection geprüft: 23 `public.cwl_*`-Tabellen zum Zeitpunkt der Inventur (24 seit 19.11.2026 mit neuer operativer, Owner-RLS-geschützter Checkpoint-Tabelle). Weiterhin genau 17 portable Datentabellen, 6 ausdrücklich ausgeschlossene Sicherheits-/Betriebstabellen und `cwl_clans` als Clan-Metadaten. Schema- und Spaltennamen wurden mit den migrierten SQL-Dateien verglichen. Es wurden keine Nutzerzeilen angefragt und keine Migration, RLS-Policy, Rolle, Datenzeile oder Plattformkonfiguration verändert.

Das neue portable Format enthält für einen **ausdrücklich vom angemeldeten Benutzer besessenen** App-Clan nur die im Quellcode versionierten, explizit benannten Spalten aus diesen 17 Tabellen:

| Block | Tabellen | Wiederherstellungsregel |
| --- | --- | --- |
| Gemeinsamer Plan | `cwl_cloud_profiles`, `cwl_plan_review_state`, `cwl_clan_management_rules` | Aktuelle Stände mit Revision, Lock und Rollenbezug; **serverseitig** CAS und Rechte erneut prüfen |
| CWL-/CW-Archiv | `cwl_group_archives`, `cwl_own_lineup_archives` | Clan, Saison, Tag, War-Key, vorhandene endgültige Aufstellungen erhalten; nie durch leere Daten ersetzen |
| Angriffsbelege | `cwl_stat_wars`, `cwl_stat_attacks`, `cwl_stat_missed` | Stabile zusammengesetzte Primärschlüssel; API-/Import-Herkunft, Finalisierung, Missed-Coverage, Zerstörung und Clan-Tag nicht erfinden/überschreiben |
| Gesicherte Planstände und Anträge | `cwl_profile_snapshots`, `cwl_plan_suggestions` | IDs/Autor-/Revisionsbezüge sind historische Belege; kein unkontrolliertes Replay |
| Clanverwaltung und Beobachtung | `cwl_clan_member_tenure`, `cwl_clan_donation_observations`, `cwl_clan_absence_observations` | Nur beobachtete Fakten/Frische; Server-/Collector-Zustand beim Restore abgleichen statt Blind-Insert |
| Private Entscheidungen | `cwl_missed_owner_decisions`, `cwl_clan_review_decisions`, `cwl_clan_cw_missed_decisions` | RLS, Clash-Quelltag, Owner, Audit- und Event-Verifikation. Append-only-Zeilen **nicht automatisch importieren** |
| Aktivitätsprotokoll | `cwl_change_events` | Historische Protokolle nur als Audit, nicht mit frei gesetzter Actor-ID zurückschreiben |

**Clanstammdaten:** `source_clan_id`, Name und tatsächlicher `clash_tag` liegen pro Clan in der Hülle. Die ID ist nur eine **Quellreferenz**; sie erteilt niemals Berechtigung. Die referenzierten Auth-Konten sind im Format nicht rekonstruierbar.

**Ausgeschlossen:** `cwl_clan_invites` (Codes/Hashes), `cwl_clan_memberships` (authentifizierte App-User/Rollen), `cwl_access_blocks` (Sicherheits-/Sperrentscheidungen), `cwl_clan_presence` (flüchtige Sessions/Aktivität), `cwl_stat_collector_status` (technischer Laufstatus), Auth-Tabellen, Passwörter, JWT, Service-Role, API-Schlüssel, Edge-Konfiguration und externe Storage-Dateien. Mitgliedernamen, Clash-Tags, RH, Teilnahme, Notizen und Planvorgaben im **CWL-Profil-JSON** sind dagegen enthalten. Die Wiederherstellung von Einladungen, Besitzer-/Vize-Zugriffen, Sperrlisten und Auth-Identitäten erfordert einen **separat autorisierten administrativen Wiederaufbau**, nicht die Übernahme einer fremden JSON-Datei. Diese Grenze muss vor der finalen Produktfreigabe ausdrücklich angezeigt werden.

## 2. Was der technische Kern bereits tut

1. Formatkennung `cwl-cloud-app-backup`, Version `1`, ISO-Exportzeitpunkt, 1–30 Quellclans und **alle** 17 Tabellen; fehlende Tabellen werden nicht als leer geraten. Pro Datensatz nur erlaubte Spalten und korrekte `clan_id`; bei identischen Primärschlüsseln Abbruch.
2. Normalisierte, sortierte JSON-Felder und SHA-256-Inhaltsprüfung. Manipulierte/kaputte Dateien werden abgewiesen, bevor eine Vorschau entsteht. **SHA-256 ist keine Signatur oder Autorisierung**: Wer die Datei ändern kann, kann einen neuen Hash berechnen. Ziel-Owner und Rechte müssen immer serverseitig validiert werden.
3. Read-only-Collector `collectOwnerCloudBackup` mit dem regulären angemeldeten Supabase-Client: `auth.getUser()`, verifizierte `owner_user_id`, nur explizit ausgewählte eigene Clan-IDs, eindeutige Feldprojektion und `range`-Pagination (max. 1000 pro Seite, standardmäßig 500). RPC-/Service-Role-Bypass, Wildcard-`select("*")`, fremde Tenant-Reads und DB-Schreiboperationen sind **nicht** Bestandteil des Moduls.
4. War-/Attack-/Missed-Referenzen, Profil-Datenversion 9 und Grundstruktur des Profile-JSON werden geprüft. Ein fehlender Angriff wird nicht als 0 Sterne umgedeutet.
5. Restore-Vorschau `previewPortableCloudRestore` arbeitet ausschließlich mit **extern vertrauenswürdig ermittelten**, eigenen Ziel-Clans und explizitem Source→Target-Mapping. Aktueller Clash-Tag muss exakt stimmen. Ohne alle Zieldatentabellen kein positives Ergebnis. Erst dann werden nach Primärschlüsseln `new`, `identical`, `conflict` oder `reviewOnly` gezählt. Die Vorschau liefert immer `mutationPermitted:false`. Keine Schreibfunktion existiert.

### Zwei explizit getrennte Konsistenzstufen (Phase 2)

- **Legacy-Clientsammler** `collectOwnerCloudBackup`: unverändert `consistency:"client-read-non-atomic"`. Viele `range`-Abfragen können unterschiedliche Datenbankzeitpunkte sehen, daher **niemals als garantiert vollständige Datensicherung bewerben**.
- **Neuer SQL-RPC** `public.cwl_export_owned_backup(p_clan_ids uuid[])`: `LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=''`. Alle 17 expliziten Tabellenprojektionen eines bzw. mehrerer berechtigter Owner-Clans liegen in **einem PostgreSQL-Statement-MVCC-Snapshot**; Rückgabe `consistency:"server-stable-statement"`. Die PostgreSQL-17-Dokumentation bestätigt diese STABLE-Snapshot-Semantik. Es gibt **keinen privilegierten Zugriff**: authentifizierter Benutzer + Clan-Owner-ID + tatsächliche Owner-Mitgliedschaft **für jeden angefragten Clan** und bestehende RLS-/SELECT-Policies für jede Tabelle sind zwingend. Ein Fehler bricht die gesamte JSON-Antwort ab.
- Der RPC begrenzt 1–30 eindeutige Clan-IDs, maximal **100.000 Zeilen pro Tabelle und Clan** (100.001 als Fehler-Sentinel), maximal **64 MiB pro Clan und insgesamt**. Es wird keine unvollständig paginierte/gekappte Tabelle zurückgegeben; Datenbank-/Response-Limits dürfen den Download nur **abbrechen**, nie als erfolgreich erscheinen lassen.
- `exportOwnerCloudSnapshot` prüft lokale Sitzung vor/nach RPC, vollständige Quellclanliste, die Konsistenzkennung, alle Tabellen/Datenspalten/Beziehungen und bildet erst anschließend den SHA-256-Fingerprint. Keine fremde `clan_id`, keine Wildcard-SELECTs. `previewOwnerCloudRestore` vergleicht die Datei mit einem ebenso **ownerautorisiert und atomar** gelesenen Ziel-Snapshot, bei Bedarf für mehrere Clans. Die Vorschau zeigt nur `new`/`identical`/`conflict`/`reviewOnly`, immer `mutationPermitted:false`.
- **Wichtig:** Ein MVCC-konsistenter Snapshot heißt *nur*: alle enthaltenen Daten entsprechen einem Datenbankzeitpunkt. Er beweist **nicht** vollständige API-Beobachtung, nicht die Existenz älterer unter RLS ausgeblendeter Quell-Clash-Tag-Historien und nicht die Wiederherstellbarkeit von Konten, Rechten oder Einladungen. Nach Verlust des gehosteten Projekts müssen Accounts und autorisierte Zielclans vor einem Import separat wiederhergestellt sein. Die Restore-Transaktion muss **alle Berechtigungen und Konflikte erneut prüfen**, unabhängig vom JSON-Hash oder der Vorschau.

**Echte SQL-UAT:** [GitHub Workflow `portable-cloud-export-ci.yml`](../.github/workflows/portable-cloud-export-ci.yml) startet eine **isolierte PostgreSQL-17-Datenbank** mit synthetischen Eigentümer-, Fremdclan- und fehlenden-Mitgliedschaft-Fällen. Der Test prüft Owner-only, anonyme Sperre, Zwei-Eigene-Clans, gemischte Zugriffe, Datenumfang, STABLE/INVOKER und validiert das erzeugte JSON mit dem **gleichen** JS-Validator wie die Cloud-Datei. Dieses Testsetup hat **keinen Zugriff auf die Produktionsdatenbank**.

Auch 100 % API-/Historienabdeckung lässt sich nicht aus einem vollständigen Tabellenexport ableiten.

## Phase 3a – transaktionaler Teil-Restore für CW-/CWL-Fakten (PR #323)

Der neue serverseitige RPC public.cwl_restore_portable_facts_atomic ist ausdrücklich **kein vollständiger Cloud-App-Restore** und bleibt bis zur finalen Produktfreigabe aus der UI ausgeblendet. Seine Standardaktion ist eine **rein lesende Vorschau**. Nur bei explizitem Bestätigungstext, gültiger Owner-ID **und** aktueller Owner-Mitgliedschaft, passendem Clan-Tag und unveränderter Cloud-Planrevision darf er neue Fakten einspielen.

**Genaue Importgrenze:** nur neue Schlüssel in cwl_stat_wars, cwl_stat_attacks und cwl_stat_missed. Bestehende Fakten werden weder gelöscht noch überschrieben. Bei abweichenden War-Identitäten, Sternen, Zerstörungswerten oder Missed-Angriffen gibt es einen Konflikt statt eines Upserts. Es werden niemals zusätzliche Attacken oder Misses in einen bestehenden API-Krieg eingefügt. Für dieselbe Datei entstehen beim zweiten Import keine Duplikate.

**Herkunftsschutz:** Herkunftsangaben aus einer bearbeitbaren Backup-Datei sind kein Beweis für echte Collector-Beobachtung. Neue Kriege werden daher ausschließlich als Quelle 'import', mit source_clash_tag=NULL und missed_log_complete=false gespeichert. **Zusätzlich sind Missed-Einträge nur bei bereits beendeten Kriegen zulässig:** ein noch laufender importierter Krieg könnte später vom Collector mit API-Quelle vervollständigt werden; zuvor aus einer veränderbaren Datei stammende Missed-Einträge dürften dadurch keinesfalls als verifiziert gelten. Ein ursprüngliches API-Label in der Datei wird nicht als verifiziert übernommen. Vorhandene hochwertige API-Daten bleiben unverändert.

**Vorher-Sicherungsstand:** Vor dem ersten INSERT erzeugt derselbe SQL-Transaktionsaufruf einen dauerhaften, append-only Datensatz in der neuen RLS-geschützten Tabelle cwl_portable_restore_checkpoints. Dieser enthält den Vorher-Stand der betroffenen War-Keys, Angriffe, Misses, die Zielrevision und den aktuellen Owner. Er wird bei Fehlern zusammen mit allen Inserts zurückgerollt; ein identischer Wiederholungsimport erzeugt keinen zweiten Checkpoint. Das ist ein nachprüfbarer Wiederherstellungsanker, **kein fertiger Undo-Button**. Die Checkpoint-Tabelle ist ein interner Betriebsdatensatz und ausdrücklich **nicht Bestandteil des portablen Backups**.

**Getestete Sicherheitsfälle in isoliertem PostgreSQL 17:** Besitzer/Fremdclan/Clash-Tag, CAS-Revision, Vorschau ohne Schreibzugriff, tatsächliches Einspielen, zweites Einspielen ohne Duplikate, absichtlich fehlerhafter Angriff nach dem Einfügen eines Kriegs mit vollständigem Transaktions- und Checkpoint-Rollback, Schutz von vorhandenen API-Missed-Angriffen, fehlende Bestätigung und anonymer Zugriff. Ein erfolgreicher SQL-Test ersetzt nicht die Live-Owner- und Geräteabnahme.

**Noch offen für Issue #178:** Plan-/Lock-/Archiv-/Regel-/Beobachtungs-/Audit-Historie, vollständiges Wiederaufbau-Mapping nach Datenverlust, Transaktionen/Checkpoint über sämtliche diese Daten, internationalisierte UI mit genau zwei Cloud-Aktionen sowie reale iOS-/Android-Tests. Der vorliegende Fakten-Restore darf deswegen niemals als 'komplettes Backup wiederhergestellt' angezeigt werden.

**DE-Hilfe (später mit UI):** „Beim Wiederherstellen bleiben verifizierte Kriegsdaten erhalten. Neue Fakten aus Backup-Dateien gelten zunächst als unbestätigte Importe. Pläne und Archive werden gesondert und geschützt wiederhergestellt.“

**EN help (for future UI):** “Restoring a backup never overwrites verified war evidence. Newly recovered facts are initially unverified imports. Plans and archives require a separate protected restore.”


## Phase 3b – CWL-Plan und verifizierte Archive sicher für die Wiederherstellung vorbereiten (PR #325)

Die bisherigen Import-RPCs stellen **nur CW/CWL-Fakten** tatsächlich wieder her. CWL-Pläne, die sieben Tages-Slots sowie die beiden vom Collector geprüften Archivtabellen dürfen durch eine alte, beliebig bearbeitbare JSON-Datei nicht pauschal verändert werden.

Die nächste Stufe trennt deshalb die Wiederherstellung in **(1) serverseitige Vorschau** und **(2) ausdrücklich bestätigte, private Ablage eines Wiederherstellungskandidaten**:

- `public.cwl_stage_portable_plan_recovery` prüft die **aktuelle Owner-ID und tatsächliche Owner-Mitgliedschaft** für den Zielclan, die gleiche Clash-Clan-ID (Tag), einen exakten Ziel-Plan-Revisionsstand und ausschließlich vier benötigte Quelltabellen: `cwl_cloud_profiles`, `cwl_plan_review_state`, `cwl_group_archives`, `cwl_own_lineup_archives`. Der Quellplan muss Datenversion 9 und sieben sauber strukturierte Tages-Slots enthalten. Fremde Clan-Zeilen, fehlende Tabellendaten und doppelte Archivschlüssel werden abgewiesen.
- Die Vorschau meldet **aktive geschützte Tage**, vorhandene Mitglieder und Planarchive, abweichende Planfreigabe sowie für Gruppenarchive und eigene Aufstellungen jeweils **neu / identisch / widersprüchlich**. Ein vorhandener `warEnded`-Datensatz und der verifizierte Tageskader werden **nicht zurückgesetzt**. Ein als `neu` gezähltes Archiv ist eine **Prüfposition**, kein automatisch als echt akzeptiertes Ergebnis.
- `p_stage=false` bedeutet **keine Datenbankänderung**. Nur mit dem expliziten Text `STAGE_PLAN_FOR_MANUAL_REVIEW` wird ein Kandidat in der neuen **Owner-/RLS-beschränkten, append-only** Tabelle `cwl_portable_plan_recovery_candidates` abgelegt. Er enthält die eingehenden Plan-/Archivdaten sowie den **kompletten sichtbaren Ziel-Vorher-Stand** von Plan, Freigabestatus, Gruppenarchiven und eigenen Lineups. Dieser Stand ist **informativ und keine transaktional garantierte Live-Recovery-Sicherung**, weil die offiziellen Archivtabellen bewusst nur lesbar sind und während der Abfrage durch den Collector fortgeschrieben werden können. Ein künftiges wirkliches Einspielen muss daher unter frischen Schreibtransaktionsprüfungen erneut vergleichen.
- Gleiche Source-Clan-ID, Source-Revision **und** Target-Revision erzeugen dieselbe Kandidaten-ID. Geänderte Inhalte bei derselben Identität werden nicht überschrieben, sondern abgewiesen. Actor-ID, Zeitstempel und Datensatz-ID können nicht durch den Client festgelegt werden; Owner dürfen Kandidaten nicht verändern oder löschen. Die Tabelle ist **operative Recovery-Metadaten**, gehört **nicht in das portable 17-Tabellen-Format** und erteilt keine neuen Besitzerrechte.
- Besonders wichtig: `cwl_group_archives` und `cwl_own_lineup_archives` sind im aktuellen Supabase-Schema für `authenticated` ausdrücklich **SELECT-only**, während der Collector sie über eigene geprüfte Serverprozesse füllt. **Diese Berechtigung wird nicht aufgeweicht.** Der neue RPC nutzt `SECURITY INVOKER`, **keine** Service-Role-/Definer-Umgehung, keine UPDATE/DELETE/INSERT in aktive Plan- oder Archivtabellen. Die Staging-Tabelle darf niemand als verifizierte Clash-Quelle interpretieren.

Der Clientadapter `previewPortablePlanArchiveRecovery` prüft zunächst die vollständige SHA-256-Datei und akzeptiert hier nur die konsistente `server-stable-statement`-Dateiform. Den aktuellen Zielclan lädt er erneut über den bestehenden Owner-/RLS-geprüften Snapshot. Die Serverfunktion prüft ihre Berechtigungen unabhängig davon noch einmal. Es gibt bewusst **keinen öffentlichen Download-/Restore-Button** zu dieser Stufe.

**Was für den vollständigen #178-Restore weiter fehlt:** Transaktionale **tatsächliche Übernahme** des Plans inklusive gespielter Tage, Freigaben, Member-Einsätzen, Archivqualität und Einstellungen, belastbarer atomarer Vorher-Sicherungsstand und ggf. streng begrenzter vertrauenswürdiger Backend-Schreibpfad für Collector-Archive; Konfliktsperre mit Collector-Läufen, Auflösung historischer Nutzer-/Quell-ID-Bezüge, echte Owner-/iPhone-/Android-UAT, DE/EN-Hilfe und öffentliche Versionierung. Ein Kandidat darf erst nach erneuter serverseitiger Validierung und ausdrücklicher Owner-Bestätigung übernommen werden.

**DE-Hilfe (erst zur späteren UI-Freigabe):** „Vor dem Wiederherstellen vergleichen wir deinen aktuellen CWL-Plan und das Archiv mit der Sicherungsdatei. Bereits gespielte oder gesperrte Tage und verifizierte Aufstellungen bleiben geschützt. Bei Widersprüchen wird nichts automatisch überschrieben.“

**EN help (for the eventual UI):** “Before restoring, we compare your current CWL plan and archives with the backup. Played or locked days and verified lineups stay protected. Conflicting records are never silently overwritten.”


## Phase 3c – Erster tatsächlicher Plan-Import, nur in **unbenutzte** Zielclans (PR #327)

In [PR #327](https://github.com/Smolmig/cwl_planer/pull/327) wird nach der privaten Phase-3b-Kandidatenablage erstmals ein **tatsächlich schreibender** Restore vorbereitet. Seine absichtlich sehr enge Grenze schützt historische CWL-Daten: Ein **aktiver Clan mit Spielern, Kriegsdaten, gesperrten/gespielten Tagen, Clanarchiven oder anstehenden Vorschlägen ist ausdrücklich NICHT für diesen Import zulässig**.

### Exakter Umfang

- Aus dem geprüften, unveränderlichen Recovery-Kandidaten werden **nur** die drei planungsbezogenen Felder `members` (Spielerliste inkl. Fixstatus, Einsatzwunsch und Planungshinweisen), `dayGoals` (Tagesziele) und `config` (Planungseinstellungen) in ein noch unbenutztes, ownerautorisiertes Cloud-Profil übernommen.
- **Ausdrücklich unverändert:** Ziel-Profil-ID und -Clan-Identität, `locks` mit allen sieben Tagen, gespielte Tage, `archives`, `archivedMembers`, `cwlLive`, Planfreigabestatus und Freigabe-Autor, bestehende verifizierte Gruppenarchive und Aufstellungsarchive, Rohangriffe, Misses, Rollen, Auth, Clan-/Owner-Entscheidungen und Collector-Beobachtungen. Selbst wenn die Quell-JSON verifizierte historische Aufstellungen behauptet, werden diese **nicht** als echte API-Beweise in das Ziel übernommen.
- **Streng sauberer Zielbestand:** keine aktiven Mitglieder, keine archivierten Spieler/Saisons, keine CW- oder CWL-Kriegszeilen, keine verifizierten Archivzeilen, keine pending Vorschläge, kein gesperrter Plan; sieben vorhandene, aber **ungeplante** Tages-Slots ohne Lock, War-Tag, Endzeit, Teilnehmer oder Tages-Snapshots. Ein Ziel mit einem einzigen gespielten Tag scheitert. Die sieben Slots im leeren Ziel sind normal und dürfen nicht mit sieben gespeicherten Kampftagen verwechselt werden. 
- `public.cwl_apply_portable_pristine_plan` prüft den Kandidaten erneut unter `SECURITY INVOKER` mit echtem `auth.uid()`, Clan-`owner_user_id`, aktueller `owner`-Mitgliedschaft, identischem Clash-Tag, exakt passender Kandidaten-/Zielrevision (**CAS**), identischem Ziel-Vorher-Profil, Planfreigabe, Quellprofil-Struktur und eindeutigen Mitglieds-IDs/`playerTag`s. **`p_apply=false`** liefert nur den Prüfbericht; **`p_apply=true`** verlangt ausdrücklich `APPLY_TO_EMPTY_CWL_PLAN` und wird bei jedem Konflikt abgebrochen.
- **Transaktionaler Schutz:** Direkt vor dem einzigen `UPDATE public.cwl_cloud_profiles SET profile_json=...` entsteht ein unveränderlicher, RLS-geschützter **Vorher-/Nachher-Sicherungspunkt** in der **nicht öffentlich exponierten** Tabelle `private.cwl_portable_plan_apply_checkpoints`. Der vorhandene Profiltrigger erhöht die Revision. Passt sie nicht genau um +1, verändert ein Trigger geschützte Felder oder schlägt die Aktualisierung fehl, **rollen sowohl die Planänderung als auch der Sicherungspunkt zurück**. Ein identischer Wiederholungsversuch mit alter Revision wird zurückgewiesen; die Quell-Kandidaten und Archivdaten bleiben unberührt.
- Im Gegensatz zu den vorangehenden öffentlichen Betriebs-Tabellen ist dieser neue Checkpoint bewusst im schon vorhandenen `private`-Schema. Er ist nicht Teil der 17 exportierbaren App-Datentabellen und auch nicht direkt per öffentlicher Data API anlegbar. Nur der aktuell berechtigte Owner darf seine eigenen Checkpoints nach RLS sehen; keine regulären Update-/Delete-Berechtigungen.
- Der neue JS-Adapter `previewPortablePristinePlanApply` / `applyPortablePristinePlan` liest vor jedem RPC eine aktuelle ownerautorisierte Quelle, überprüft die Zielrevision und bestätigt die Rückgabe- und Checkpoint-Semantik. Er ist **absichtlich nicht an das öffentliche Cloud-Menü angeschlossen**.

**Keine vollständige Restore-Garantie:** Dieser Weg ist für einen **bereits als leer bestätigten und nicht aktiven Clan** vorgesehen. Er stellt **nicht** alle Archive, historischen Daten, Planlocks oder Konten wieder her und ist **kein** allgemeiner Merge in laufende Clans. Planfreigabestatus ist weiterhin eine eigene SELECT-only-Ressource für normale Benutzer; der RPC prüft ihn vor und nach dem Profilupdate, sperrt aber dessen Zeile nicht. Deshalb ist ein späterer, umfassender Recovery-Weg mit vollständiger Sperrkoordination zum Live-Plan/Collector und unabhängiger Autor-/Datenqualitätsprüfung weiter zwingend. Die öffentlichen Backup- und Restore-Aktionen von #178 bleiben deaktiviert, bis ein kompletter atomarer Roundtrip einschließlich Archive/Regeln/Audit mit realer Owner- und iOS-/Android-UAT vorliegt.

**DE (Hilfe zur späteren Produktfreigabe):** „Eine Wiederherstellung in einem neuen, leeren Clan kann Mitglieder und Planungsziele übernehmen. Bestehende CWL-Tage, Angriffe und verifizierte Archive werden dabei niemals ersetzt. Für bereits aktive Clans ist eine eigene Konfliktprüfung nötig.“

**EN (for later product help):** “A new, empty clan can recover its member list and planning goals. Existing CWL days, attacks, and verified archives are never replaced. Active clans require a separate conflict-aware restore.”


## 3. Zugriffs- und Wiederherstellungsmatrix

| Rolle/Fall | Lesen / Export | Wiedereinspielen |
| --- | --- | --- |
| Eigener verifizierter App-Owner, ein Clan | Read-only-Grundbaustein vorgesehen | Noch **nicht** freigeschaltet; serverseitiges Verfahren fehlt |
| Eigener Owner, mehrere Clans | Nur explizite eigene Clan-IDs, jede einzeln nachprüfen | Jede Zuordnung mit gleichem Clash-Tag und individueller Berechtigung |
| Editor/Vize, Viewer | Kein gesamter Owner-Datenexport über diesen Pfad | Keine Rechte für einen globalen Restore |
| Zweitbesitzer eines anderen App-Tenants | Fremde Tabellen bleiben RLS-privat | Keine fremden Clan-IDs oder Notizen übernehmen |
| Historischer CW/CWL-Import vorhanden | Schlüssel-/Source-Herkunft in Backup erhalten | Konflikt statt blindem Upsert/Überschreiben |
| Leerer bzw. umgezogener Clash-Tag | Kein automatisches Target-Mapping | Fail-Closed, bewusstes gesondertes Migrationsverfahren erforderlich |

## 4. Nächste zwingende Implementierungsgates (nicht erledigt)

- **Export-Snapshot integrieren und Live-UAT:** Der neue `STABLE SECURITY INVOKER`-RPC plus JS-Adapter ist implementiert, muss vor Nutzerfreischaltung im echten angemeldeten Owner-Kontext und mit Datenabdeckungs-/Responsegrößen geprüft werden. Erst **gemeinsam mit sicherem Restore** zwei Cloud-Backup-Aktionen aktivieren.
- **Serverseitiger Restore-Preflight:** Dateiformat/Inhalt/Tabellenbeziehungen/FK, Zielmapping, Rollen, neue/verifizierte Konflikte, Speicherlimits; bevorzugte neuere API-Belege nicht mit älteren Importdaten ersetzen. Spätestens hier Integrity/Version mit denselben Verträgen noch einmal prüfen.
- **Transaktionales Wiederherstellen:** nur von autorisierter Backend-Funktion, vor jeder Mutation frischer Sicherungspunkt, CAS auf laufende Pläne/Locks, idempotente Kriegs-/Angriffs-/Missed-Schlüssel, strikte Belegqualität, referenzierte Archiv-/Review-Zyklen, `append-only`-Decision-Audit sicher; Rollback bei jeder Teilabweichung.
- **UI-Ersetzung nach UAT:** Im Cloud-Modus unter **Mehr → Backup & Wiederherstellung** genau **„Backup herunterladen“** und **„Backup wiederherstellen“** plus nichtdestruktive Vorschau, bewusstes Zielmapping und zweite Bestätigung. Legacy-Plan-Snapshots bleiben **intern** erreichbar, sind aber keine konkurrenzierenden Cloud-Backup-Downloads; noch nicht voreilig entfernen. Offline-PWA behält ihre Einzel-/Alle-Profile-Funktionen.
- **Abnahme:** leere Cloud nach Neuaufbau, mehrfacher Reimport, überlappende API/ClashPerk-Historie, Datenlücken, 5er/11er/30er, zwei eigene und ein fremder Tenant, Editor/Viewer, blockierte Accounts, entschuldigte CW-/CWL-Misses, aktueller gesperrter CWL-Plan, 320/390/430px/Desktop, reales iPhone Safari/PWA, Android, deutsche und englische Hilfe. CI ist kein Ersatz für Owner-UAT #213.

## 5. Nutzertexte DE / EN (noch nicht in der App ausrollen)

**DE:** „Ein vollständiges Cloud-App-Backup ist noch in Vorbereitung. Die vorhandenen Sicherungspunkte enthalten nur frühere Planstände. Auth-Zugänge und Einladungen werden aus Sicherheitsgründen nicht in eine App-Backup-Datei übernommen.“

**EN:** “A complete cloud-app backup is still being prepared. Existing recovery points only contain earlier planning states. Account credentials and invitations are not included in an app backup for security reasons.”

**Abhängigkeiten:** #178, #212, #103, #183, #213, `docs/CROSS_CLAN_PLAYER_DATA_ARCHITECTURE.md`, `docs/UX_DESIGN_PRINCIPLES.md`. Vor dem UI-/Release-Schritt öffentliche Hilfe, Update-History und Cloud-Version **gemeinsam** pflegen; in Phase 1 bewusst **kein** Versionsbump oder neues, unvollständiges Exportversprechen.
