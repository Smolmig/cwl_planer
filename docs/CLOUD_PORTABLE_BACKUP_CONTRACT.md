# #178 – Portable Cloud-App-Backup: Datenvertrag und Sicherheitsgrenzen (19.11.2026)

**Status: Phase 1, technischer Grundbaustein, NICHT als nutzbarer Cloud-Export/Restore freigeschaltet.**
Produktive Cloud v1.27.0 bleibt unverändert. Die Datei `cloud-portable-backup-core.mjs` wird von keiner UI importiert. Die alten Cloud-Profil-Snapshots und Offline-Backups bleiben vorerst funktional, dürfen jedoch **nicht** als vollständiger Cloud-App-Roundtrip bezeichnet werden.

## 1. Tatsächliches Schema statt Annahmen

Das verbundene Supabase-Projekt wurde am 19.11.2026 **nur lesend** über die Table-Introspection geprüft: 23 `public.cwl_*`-Tabellen, alle mit RLS aktiviert. Schema- und Spaltennamen wurden mit den migrierten SQL-Dateien verglichen. Es wurden keine Nutzerzeilen angefragt und keine Migration, RLS-Policy, Rolle, Datenzeile oder Plattformkonfiguration verändert.

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

### Wichtige Konsistenzgrenze

**Clientabfragen über 17 Tabellen sind keine Datenbanktransaktion.** Ein Collector oder Vize kann während des Lesens einen Krieg/Plan ändern. Deshalb trägt die Hülle bewusst `consistency:"client-read-non-atomic"`. Dieses Modul ist ein **sicherer Datenformat-/Lese-/Vorschau-Grundbaustein**, noch kein atomarer, belastbarer vollständiger Datensicherungsknopf. Für einen produktiven Export wird vor der Freigabe eine konsistente serverseitige Snapshot-/Revisionsstrategie benötigt, bei der jeder relevante Schreibstrom (Plan, Archive, Statistik, Audit) berücksichtigt wird. Auch 100 % API-/Historienabdeckung lässt sich nicht aus einem vollständigen Tabellenexport ableiten.

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

- **Serverseitiger konsistenter Export-Snapshot:** sichere Eigeneigentümer-/Tenant-Prüfung und transaktionaler Snapshot oder belastbare globale Revision. Read-only UI erst dann als **„Backup herunterladen“** bezeichnen.
- **Serverseitiger Restore-Preflight:** Dateiformat/Inhalt/Tabellenbeziehungen/FK, Zielmapping, Rollen, neue/verifizierte Konflikte, Speicherlimits; bevorzugte neuere API-Belege nicht mit älteren Importdaten ersetzen. Spätestens hier Integrity/Version mit denselben Verträgen noch einmal prüfen.
- **Transaktionales Wiederherstellen:** nur von autorisierter Backend-Funktion, vor jeder Mutation frischer Sicherungspunkt, CAS auf laufende Pläne/Locks, idempotente Kriegs-/Angriffs-/Missed-Schlüssel, strikte Belegqualität, referenzierte Archiv-/Review-Zyklen, `append-only`-Decision-Audit sicher; Rollback bei jeder Teilabweichung.
- **UI-Ersetzung nach UAT:** Im Cloud-Modus unter **Mehr → Backup & Wiederherstellung** genau **„Backup herunterladen“** und **„Backup wiederherstellen“** plus nichtdestruktive Vorschau, bewusstes Zielmapping und zweite Bestätigung. Legacy-Plan-Snapshots bleiben **intern** erreichbar, sind aber keine konkurrenzierenden Cloud-Backup-Downloads; noch nicht voreilig entfernen. Offline-PWA behält ihre Einzel-/Alle-Profile-Funktionen.
- **Abnahme:** leere Cloud nach Neuaufbau, mehrfacher Reimport, überlappende API/ClashPerk-Historie, Datenlücken, 5er/11er/30er, zwei eigene und ein fremder Tenant, Editor/Viewer, blockierte Accounts, entschuldigte CW-/CWL-Misses, aktueller gesperrter CWL-Plan, 320/390/430px/Desktop, reales iPhone Safari/PWA, Android, deutsche und englische Hilfe. CI ist kein Ersatz für Owner-UAT #213.

## 5. Nutzertexte DE / EN (noch nicht in der App ausrollen)

**DE:** „Ein vollständiges Cloud-App-Backup ist noch in Vorbereitung. Die vorhandenen Sicherungspunkte enthalten nur frühere Planstände. Auth-Zugänge und Einladungen werden aus Sicherheitsgründen nicht in eine App-Backup-Datei übernommen.“

**EN:** “A complete cloud-app backup is still being prepared. Existing recovery points only contain earlier planning states. Account credentials and invitations are not included in an app backup for security reasons.”

**Abhängigkeiten:** #178, #212, #103, #183, #213, `docs/CROSS_CLAN_PLAYER_DATA_ARCHITECTURE.md`, `docs/UX_DESIGN_PRINCIPLES.md`. Vor dem UI-/Release-Schritt öffentliche Hilfe, Update-History und Cloud-Version **gemeinsam** pflegen; in Phase 1 bewusst **kein** Versionsbump oder neues, unvollständiges Exportversprechen.
