# #227 · Etappe 3: unveränderlicher CWL-Saison-Checkpoint

**Stand: 12.11.2026 · SQL-Draft + synthetische PostgreSQL-17-Tests · kein Live-Deploy.**

## Ausgangslage

Die bisherigen zwei Etappen sind:
- [PR #262](https://github.com/Smolmig/cwl_planer/pull/262):
  API-verifizierte neue CWL-Saison serverseitig beobachtbar, nicht live.
- [PR #263](https://github.com/Smolmig/cwl_planer/pull/263):
  read-only Preflight für exakt denselben App-Clan, alte Revision und
  alte Zyklus-ID. Noch kein Reset; native PostgreSQL-Tests grün.

**Ziel dieses Schritts:** Einen alten CWL-Zustand im Auftrag des
serverseitigen Jobs transaktional und vollständig sichern können,
ohne bereits irgendeine aktive Planung zu verändern.

## Konkreter Entwurf

`scripts/DRAFT_cwl_ownerless_cycle_checkpoint.sql` (bewusst **kein
ausrollbares Supabase-Migrationsfile**) definiert:

1. **`public.cwl_ownerless_cycle_checkpoints`**:
   append-only Vollkopie von `cwl_cloud_profiles.profile_json` und
   `cwl_plan_review_state` inklusive aller Member, Locks, historischen
   Archive, Live-Runden, Tagesregeln, Notizen und unbekannten Zusatzfelder.
   Kein Rekonstruieren aus Statistiken, keine Annahme, dass 6/7 abgeschlossen ist.
2. **Exakte Identität** `(clan_id, source_cycle_id, source_revision)`:
   Bei einer neuen Revision desselben alten Plans entsteht eine neue,
   separat erhaltene Vollkopie. Wiederholung desselben Jobs ist idempotent.
   Quelle und Zielmonat stehen ebenfalls im Datensatz.
3. **Integritätsnachweis**:
   serverseitiges SHA-256 des vollständigen JSONB-Inhalts. Bei gleichem
   Primärschlüssel aber anderem Inhalt/Monat schlägt der Vorgang fehl;
   kein stilles Überschreiben.
4. **Datenzugriff**:
   RLS ist aktiviert und es gibt keine Browser-/Anon-/Authenticated-Policy.
   `service_role` besitzt nur `SELECT, INSERT`, **kein UPDATE/DELETE**.
   Das `SECURITY INVOKER`-RPC ist ausschließlich für `service_role`
   ausführbar. Clan-Löschung kann wie bei bestehenden Tabellen per FK
   historische Daten löschen (bewusster Datenschutz-Randfall).
5. **Datenbank-Transaktion**:
   `cwl_ownerless_cycle_checkpoint(clan, expected_cycle,
   expected_revision, target_season)` sperrt **zuerst den Review-Zyklus,
   dann das Profil** mit `FOR UPDATE`; unter beiden Locks wird der
   Phase-2-Preflight erneut geprüft. Bei Stale-CAS, falschem Tenant
   oder fehlender offizieller Saison: **kein Checkpoint**.
   Ein Fehler während der Transaktion: SQL-`ROLLBACK`, kein Teil-Archiv.
6. **Unveränderte aktive CWL**:
   Kein `UPDATE` an Profilen, Review-State oder Vorschlägen, kein
   neuer Cycle, keine veränderten Spieler oder Locks. Damit greifen die
   heutigen profiländernden Trigger nicht ein; insbesondere wird
   `auth.uid()` weder gefälscht noch ein Trigger deaktiviert.

## Tests und Freigabegate

Workflow: `.github/workflows/cwl-ownerless-checkpoint-sql-ci.yml`.

Die Action startet **PostgreSQL 17 in einem Wegwerf-Container** und
installiert dort die echte Stage-1-Migration, Phase-2-Draft-Preflight und
den neuen Checkpoint-Draft. Alle Daten sind künstlich, ohne
Supabase-Zugangsschlüssel. Verifiziert werden:

- `BEGIN` + `ROLLBACK`: kein Checkpoint bleibt zurück;
- 6/7 mit **einem unbestätigten Tag** unverändert übernommen;
- 5/5 und 7/7 separat erhalten, keine Phantomeinsätze;
- Dienst-Neustart / Retry: derselbe `cycle+revision` nur einmal;
- Revision geändert: **neue** Vollkopie, alte unverändert;
- falsche Revision, fremder Tenant bei identischem Clash-Tag,
  veraltete Cycle-ID/Zielmonat: keine Archivierung;
- schreibgeschützte Herkunft, volle SHA-256-Gleichheit, Rollenrechte
  und RLS;
- zwei konkurrierende Job-Transaktionen: der gesperrte Aufruf
  läuft in einen kontrollierten Lock-Timeout, erzeugt keine
  Teilkopie, danach sichere Wiederholung.

**Jedes dieser Gates muss grün sein.** Der separate vollständige
Node-Regressionstest der App muss ebenfalls durchlaufen.

## Warum jetzt NOCH KEIN neuer CWL-Plan erstellt wird

Das ist ausdrücklich nur die **erste Hälfte** des späteren
atomaren Saisonwechsels. Für das letzte Gate fehlt noch:

- Der echte **einheitliche** Transaktionsschreibpfad, der diesen
  Checkpoint **im selben Commit wie den Profil-Reset und neuen Cycle**
  ablegt (isolierte Vorab-Checkpoints sind allein nicht hinreichend).
- Integration des alten Profils als normales, lesbares
  `archives`-Element samt Spielern, eingesetzten Tagen, Zählern und
  Status `playedCount/days`; vollständige Originalkopie zusätzlich.
- Schmale Anpassung des bisherigen `cwl_plan_guard` und
  `cwl_profile_revision` für einen **expliziten serverseitigen
  Systemvorgang** mit gesondertem Audit statt falschem
  Benutzer-`updated_by`; normale Owner- und Vize-Regeln bleiben.
- Schutz gegen nachträglichen alten Browser-Write und doppelten
  Owner-Client-Saisonwechsel; sichere Umsetzung des bisherigen
  `resetPlanningData()` im serverseitigen Profilformat inklusive
  `cocBeforeDeparture` und `archivedMembers`.
- atomarer Zwei-Writer-/Owner-CAS-Test; Backup/Recovery #178,
  echtes Mobile-/Rollen-UAT #213.
- Freigabe nur mit überprüfter signierter Collector-Identität,
  Installation der vorgelagerten Phasen und Migrations-Rollout.

**Release-Status:** bisherige Cloud **v1.18.1** bleibt produktiv,
keine Datenbankmigration, kein Edge-Deploy, keine Hilfe-/UI-Änderung.
Eine künftig sichtbare Live-Funktion bekommt zugleich
Hilfe-Update, nachvollziehbaren Changelog sowie DE/EN-Texte.
