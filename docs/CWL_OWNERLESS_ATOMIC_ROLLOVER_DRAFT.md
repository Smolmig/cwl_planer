# #227 · Etappe 4 – atomarer CWL-Saisonwechsel (DRAFT, nicht live)

**12. November 2026 · Cloud-Live: v1.18.1 unverändert**

## Was dieser Branch erstmals zusammenführt

Auf den gestapelten Drafts [#262](https://github.com/Smolmig/cwl_planer/pull/262),
[#263](https://github.com/Smolmig/cwl_planer/pull/263) und
[#264](https://github.com/Smolmig/cwl_planer/pull/264) baut ein **einziger**
service-role-only PostgreSQL-Aufruf auf:

`public.cwl_ownerless_atomic_rollover(clan, expected_cycle, expected_revision, target_season)`

Der Aufruf schreibt ausschließlich aus **serverseitig belegten Daten**,
übernimmt niemals einen fremden `profile_json`-Vorschlag aus dem Request und
läuft in genau **einer PostgreSQL-Transaktion**:

1. Revisionskontrolle unter Zeilensperren, zuerst Review-State, dann Cloud-Profil.
2. Neueste **frische, verifizierte** Supercell-CWL-Beobachtung und bisherige
   Clan-/Saison-/Lock-Daten erneut prüfen.
3. Unveränderliche Originalkopie des alten Cloud-Profils plus Review-State,
   voller SHA-256-Beleg pro App-Clan/Cycle/Revision (`#264`).
4. Falls noch nicht vorhanden: **einen** für die bestehende Archiv-UI
   verständlichen Eintrag mit `sourceSeason`, altem `cwlLive`,
   Spielern, damaligen Snapshots, tatsächlichen gespielten Aufstellungen
   und Einsatzzählern erstellen. Bei 6/7 bleibt **Tag 7 offen**, 5/5
   hat **genau fünf alte Tage**; vorhandene alte CWL-Archive werden
   niemals ein zweites Mal angehängt.
5. Nur die saisonalen Planungsregeln zurücksetzen: `locks`,
   `dayGoals`, Tagesstatus, Einsatzvorgaben,
   `cocBeforeDeparture`-Tagesregeln, `archivedMembers` und
   `cwlLive`. Mitgliederstammdaten, Tag, Notizen, fixe Spieler,
   Stärke und alle bestehenden Archive bleiben.
6. Offene Vorschläge **des alten Zyklus** abschließen (`stale`),
   neuen Review-Zyklus in der **offiziell nachgewiesenen neuen Saison**
   anlegen und entsperren.
7. Append-only `cwl_ownerless_cycle_transitions` mit Ursprung
   `signed_collector`, alter/neuer Revision, alter/neuer Cycle-ID,
   Fehl-/Spieltagen und SHA-256-Checksumme als System-Audit speichern.

**Jeder Fehler macht den gesamten Vorgang rückgängig**, auch wenn der Fehler
erst beim letzten Audit-Insert passiert. Alte Daten werden nicht manuell
nachträglich rekonstruiert. Zwei gleichzeitige Jobs werden durch
`FOR UPDATE` serialisiert; ein zweiter Aufruf liefert `already_applied`,
auch wenn der Owner den neuen Plan inzwischen wieder verändert hat.

## Bestehende Profil-Trigger: begrenzte Ausnahme statt Umgehung

Die Cloud hat bereits einen Owner-/Vize-Planwächter und einen
Revisions-Trigger, der bei einem service-role-Aufruf bisher
`updated_by = auth.uid() = NULL` setzen würde. Die SQL-Draftdatei
`scripts/DRAFT_cwl_ownerless_atomic_rollover.sql` ersetzt
**nur diese zwei Funktionen**:

- Ein dienstseitiger Schreibzugriff ist ausschließlich als **exakt
  berechnete Änderung** des archivierten Altprofils erlaubt.
  `private.cwl_ownerless_checked_system_write(old,new)` verlangt
  die Postgres-`service_role`, eine gespeicherte unveränderliche
  alte Checkpoint-Revision, denselben bisherigen Zyklus und eine
  byte-/JSONB-identische, deterministisch abgeleitete neue Planung.
  Eine beliebige `service_role`-Profiländerung wird weiterhin abgewiesen.
- Für die echte Servertransition bleibt `updated_by` der **letzte
  menschliche** Bearbeiter statt eines erfundenen Owner-Accounts.
  Die normale `cwl_change_events`-Auditspur läuft weiter
  (`actor_id=NULL`); zusätzlich identifiziert der neue, private
  Transition-Datensatz ausdrücklich den SYSTEM-Vorgang.
- Für normale Owner- und Vize-Sitzungen bleibt die vorhandene
  `private.cwl_plan_can_write`-Prüfung unverändert bestehen.
  Es gibt **keine** Anon-/Authenticated-Rechte für die neue RPC,
  Übergangstabelle oder vollständige Checkpoints.

Die beiden bestehenden Trigger werden **nicht deaktiviert**;
alte Backup-/Audit-Trigger bleiben aktiv. Kein SET ROLE oder
JWT-Impersonieren wird vom Funktionscode durchgeführt.

## Testumgebung und Grenzen

`.github/workflows/cwl-ownerless-atomic-sql-ci.yml` erzeugt ein
**isoliertes PostgreSQL 17** mit künstlichen Clans, echten ersten
Saison-/Checkpoint-Migrationen sowie einer der produktiven
Original-Guard-/Revision-Funktion entsprechenden Trigger-Fixture.
Die Audit-/Snapshot-Trigger sind dort als kompakte **Test-Doubles**
ausgeführt; für einen Rollout ist eine vollständige 1:1-Abnahme der
produktiven Trigger ebenfalls erforderlich.

Getestet werden unter anderem: Fehler **nach** Plan+Review-Änderung mit
Rücknahme sämtlicher DB-Effekte, 6/7, 7/7, 5/5, Wiederholung nach Crash,
Sperrkonflikt und erneuter Versuch, bekannte/ungültige Spieler,
Saison-/Clanzugehörigkeit, Archivduplikate, RLS/EXECUTE, alte
Vorschläge, Admin- und normale Owner-Updates nach dem Wechsel.

## Verifizierter CI-Stand vom 12.11.2026

**Der ausführbare Phase-4-Code (Commit `2367dd65124f93039a4a49fbc553bf91d5e4ca69`) besteht alle verfügbaren Gates:**

- [691/691 CWL-Planer-App-Regressionen, 0 Fehler](https://github.com/Smolmig/cwl_planer/actions/runs/43216131267).
- [PG17 Transaktions- und End-to-End-Fixtures: erfolgreich](https://github.com/Smolmig/cwl_planer/actions/runs/43216131571), inklusive absichtlich spät fehlschlagendem Audit-Insert mit komplettem Rollback, 5/5, 6/7, 7/7, zwei identische Clash-Tags verschiedener App-Clans, alte Owner-Bearbeitung nach Reset, Retry und Lock-Timeout.
- [Historische SQL-Regression: erfolgreich](https://github.com/Smolmig/cwl_planer/actions/runs/43216131270).

**Dies beweist nur die isolierte DB-Funktion in der synthetischen Umgebung, noch keine Live-UAT oder Edge-Aktivierung.**

## NICHT implementiert / Freigabesperren

- **Kein Live-Deployment:** Draft-Datei liegt unter `scripts/DRAFT_...`,
  nicht unter `supabase/migrations`. Keine Supabase-Live-Schemaänderung.
- **Noch kein Collector-Trigger für den Writer:** Die Edge-Funktion nutzt
  diesen RPC noch nicht. Zuerst sichere Installation der Phasen in
  geprüfter Reihenfolge und Backup-/Restore-Gate #178.
- **Browser-/PWA-Konkurrenz:** Auch der bisherige Owner-Fallback in
  `cloud-app.html`/`cloud-sync.mjs` muss den durch Server aktualisierten
  Cycle/Profile-Stand akzeptieren, statt lokale historische Daten neu
  wegzuspeichern. Alter Browser nach dem Commit muss den Revisionskonflikt
  erkennen. Die serverseitige Idempotenz allein ersetzt diesen UX-Test nicht.
- **Supercell-Evidenz im echten Monatsübergang:** Collector liefert nur
  nach signierter Ausführung offizielle saisonbezogene Beobachtungen,
  keine Monatsheuristik. Kein autonomer Reset aufgrund fehlendem
  oder zweifelhaftem Clash-Resultat.
- **Reale UAT #213:** Owner offline, Viewer zuerst, normale Owner-
  und Editor-Aktionen, zwei App-Clans mit identischem Clash-Tag,
  alte gespeicherte 6/7-CWL und Sondergrößen, Wiederherstellung nach
  Fehler; getrennte Freigabe der Live-Migration und des Edge-Deploys.
- Die öffentliche Hilfe-Seite und DE-/EN-Texte bleiben für diese
  unsichtbare Draft-Etappe unverändert; bei Live-Aktivierung
  **mit demselben Release** anpassen und Changelog aktualisieren.

**Keine Behauptung einer fertigen Produktivfunktion:** Die echte
automatische Saisonumschaltung wird erst nach diesen Gates freigegeben.
