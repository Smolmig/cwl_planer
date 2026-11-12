# #227 · CWL-Saisonwechsel ohne Owner – Etappe 2 (Preflight)

**Stand:** 12.11.2026 · **nur gestapelter Draft auf #262**, nicht live.  
**Live-App:** Cloud v1.18.1; kein neues Release, kein SQL-/Edge-Deploy.

## Ergebnis der read-only Bestandsprüfung (produktives Schema, keine personenbezogenen Daten)

- Es existieren **3 App-Clans, 3 Cloud-Profile, 1 Plan-Review-Zustand, 2 Gruppenarchive und 14 gespeicherte CWL-Aufstellungs-Tage**. Die neue Tabelle aus #262 ist am Prüfzeitpunkt **noch nicht installiert**.
- `cwl_cloud_profiles` hat vier entscheidende Trigger:
  `cwl_plan_guard` (prüft Ingame-/App-Rollen anhand von `auth.uid()`),
  `cwl_profile_revision` (setzt Revision/Updated-By),
  `cwl_auto_snapshot` (alle zwei Stunden/30 Revisionen Backup-Snapshot),
  `cwl_audit_profile_changes` (personenbezogene Änderungsereignisse).
- **Risiko:** Ein Hintergrunddienst besitzt keine Owner-Session. `cwl_plan_guard`
  verweigert mit bisheriger `private.cwl_plan_can_write` den Update; zudem
  setzt `cwl_profile_revision` das für `updated_by NOT NULL` ungeeignete
  `auth.uid()=NULL`. Ein neues `service_role`-SQL-Update dürfte diesen Zustand
  **nicht** durch das Abschalten von Triggern, gefälschte JWT-Owner oder globale
  RLS-Ausnahmen umgehen. Es braucht ein explizit geprüftes, transaktionales
  internes Schreibkonzept mit Auditidentität und denselben Rollback-Garantien.
- Deshalb wird **in dieser Etappe kein Reset, keine Profiländerung und kein
  Lifecycle-RPC zum Schreiben** hinzugefügt.

## Implementiert in diesem Draft

**`scripts/DRAFT_cwl_ownerless_cycle_preflight.sql`** ist eine reine
Postgres-Snapshot-Prüfung, keine Freigabe zum Umschalten. Es wird ausschließlich
für `service_role` ausführbar gemacht; SECURITY INVOKER, festes Suchschema,
keine EXPOSED-Browser-/Anon-/Authenticated-Rechte.

Eine Kandidatenerkennung benötigt gleichzeitig:

1. App-Clan mit verifiziertem Clash-Tag;
2. gespeicherten gemeinsamen Plan-Zyklus + Cloud-Profil mit Revision;
3. von #262 service-gespeicherte **frische** neue Supercell-CWL-Gruppe
   (pro exakt diesem App-Clan und Tag, sechs/acht Clans, 5/7 echte Kriege);
4. `sourceSeason` des alten Profils als bestätigtes altes `cwlLive.season`
   und exakt passendes Clan-Tag / altes 5/7-Tage-Format;
5. exakt sieben Lock-Arrayeinträge; alle gespielten Tage müssen mit
   `source=coc-api`, alter Saison und belegtem eigenen `warTag` übereinstimmen;
   unbestätigte/fehlende Tage bleiben **unbestätigt**;
6. höchstens ein bestehendes lokales Profilarchiv für die alte Saison,
   sonst Fehler statt stillschweigender Dublettenbereinigung.

**Ergebnis:** `candidate=true`, aber ausdrücklich
`reason=atomic_archive_and_cycle_transaction_required`.
Das enthält nur den *Prüfzustand*: alte Cycle-ID, Revision, Monate, alte/neue
Kriegstage, Zahl alter Clash-Locks und explizite unbestätigte Tage. **Keine
eigenen Spieler, Angriffe, Plan-Daten oder Zugangsdaten** werden zurückgegeben.
Alle Defizite liefern `candidate=false` mit einem festen Fehlercode.
Preflight verändert keine Tabellen und hält keine langlebige Sperre: die
spätere echte Transaktion muss **alle** Prüfungen unter `FOR UPDATE`
wiederholen. Ein grüner Preflight ist also niemals ein alleiniger Commit-Beleg.

## Isolierte PostgreSQL-Tests

Eine neue GitHub-Action startet **PostgreSQL 17 auf einem Wegwerf-Runner**
mit ausschließlich synthetischen App-Clans und Rollen.

Abfolge:

1. Testschemas erstellen (niemals Supabase-Live).
2. Tatsächliche #262-Migration in den Wegwerf-Postgres einspielen.
3. Zwei App-Tenants mit **identischem Supercell-Tag**, einem dritten fremden
   Tenant und einem neuen offiziellen League-Snapshot anlegen.
4. Den **DRAFT-Preflight** installieren und seine Logik unter PostgreSQL prüfen.
5. 6/7, 7/7, 5/5, Duplikatarchiv, ungültiger Clan, falsche Saison, manuell
   gesperrter Tag, veralteter League-Snapshot, RLS/EXECUTE-Berechtigungen,
   Tenant-Isolation und Fehlversuch der Änderung einer Gruppen-Identität.

Die GitHub-Action verwendet keine Supabase-Keys, keine produktiven IDs
und keine Daten aus der echten CWL.

## Nächste technisch notwendige Etappe: atomarer Writer, NOCH NICHT FREIGEGEBEN

- **Ein** Service-Transaktionspfad, der `cwl_plan_review_state` und
  `cwl_cloud_profiles` je Tenant in fester Reihenfolge sperrt und die
  bei Preflight beobachtete Cycle-ID/Revision erneut prüft.
- Alte Profil-JSON **unverändert und vollständig** sichern, inkl.
  Mitglieder, aktuelle/gespielte Locks, 6/7-Datenlücken und
  CWL-Archivstand. Erst nach erfolgreicher, unveränderlicher Sicherung
  den neuen Plan öffnen; niemals die Lücken als 0 oder abgeschlossen verbuchen.
- Dedup-/Crash-Schutz: einmaliger Übergang pro `(clan_id,source_season,
  target_season)`, parallele Cron-/Owner-Zugriffe, `ROLLBACK` bei jedem
  Fehler und dedizierte serverseitige Auditidentität.
- Trigger-/Rechte-Architektur **gezielt** lösen (kein blanket
  `disable trigger`, `RLS off`, Auth-Impersonation oder Schreibrecht
  für `authenticated`).
- Browser-Fallback so verschalten, dass ein nachträglicher Owner-Login den
  neuen Zyklus nicht erneut archiviert. Viewer sieht den neuen Stand erst
  nach abgeschlossenem Datenbank-Commit.
- Echte Geräte-/Rollen-/Mehrclan-Abnahme #213 und Wiederherstellbarkeit #178.
  Hilfe/DE+EN und öffentlicher Update-Verlauf bei einem tatsächlich
  sichtbaren Live-Release zusammen aktualisieren.

**Security-Gate:** Dieser Draft darf wegen der noch ungeklärten
Trigger-/Auditidentität und ohne produktionsgleiche Rollback-/Backup-Abnahme
nicht als fertiger autonomer Saisonwechsel gemergt/deployed werden.
