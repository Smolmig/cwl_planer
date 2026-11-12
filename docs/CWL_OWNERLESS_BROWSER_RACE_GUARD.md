# #227 Etappe 5 – Browser/Server-CWL-Rennschutz

**12. November 2026 · Gestapelter Draft auf #265, KEIN Deployment.**

## Die gefährliche bisherige Situation

Die Cloud startete bei einer offiziell neu erkannten CWL im Owner-Browser
bisher in **zwei separaten Schritten**: alte Aufstellungen archivieren und
in die Cloud speichern; danach einen neuen Review-Cycle anfordern und
den lokalen Plan zurücksetzen. Gleichzeitig lädt der Browser die
`cwl_plan_review_state` periodisch neu.

Wenn der für #227 vorbereitete service-role-only Atomic-Writer
(Etappe 4, #265) genau dazwischen die neue Saison eröffnet,
kann im Tab bereits die **neue** Cycle-ID auftauchen, während die
alte `cwlLive` im lokalen Speicher noch bearbeitet wird.

Die bestehende Revisions-CAS des Cloud-Profils verhindert veraltete
Profil-Updates. Aber ein Owner-Fallback durfte den
**nach einem await erneut ausgelesenen** Cycle-Token für
`cwl_set_plan_lock_checked` verwenden – potentiell ein
zweiter, unbeabsichtigter Review-Cycle. Genau das ist jetzt abgesichert.

## Änderung in diesem Draft

1. `cloud-sync.mjs`: `authorizeBrowserCwlRollover(old,new)`
   liest vor der **ersten lokalen Archivmutation** sowohl den
   aktuellen Review-Cycle als auch Revision **und ursprüngliches
   cwlLive** vom Server. Ein alter Owner-Tab darf nur weiter,
   wenn Clan, Rolle, epoch, alte Saison, Cycle-ID,
   Profilrevision und alte Live-Saison übereinstimmen.
   Offline, ohne Review-State, mit ungespeicherten Änderungen,
   fremdem Tenant oder veralteten Daten: **Abbruch ohne Archiv/Reset**.
2. `cloud-app.html`: Der CWL-Live-Adapter
   `canAutoAdvanceCwl` ist **nur** eine geprüfte Weiterleitung
   auf die Cloud-Autorisierung. Fehlt sie, bleibt der
   automatische Browser-Fallback gesperrt.
3. `cwl-live.mjs`: Erlaubnisprüfung **vor**
   `archivePriorCwlForRollover`. Ein abgelehnter alter
   Tab speichert **keinen neuen** alten Archivdatensatz und
   öffnet keinen weiteren Cycle; die anschließende
   reguläre Cloud-Synchronisierung ist die Datenquelle.
4. `cloud-sync.mjs`: `openNewPlanCycle(oldSeason)` hält
   den **originalen** alten Cycle-Token **vor dem
   asynchronen Speichern** fest und verifiziert danach die
   lokale und für automatische Rollovers auch die
   aktuelle Server-Zyklus-ID. Keine erneute
   `reviewCycleToken()`-Abfrage beim RPC. Bricht
   stattdessen mit einer verständlichen
   `Cloud aktualisieren`-Meldung ab.
5. Die bestehende serverseitige `cwl_set_plan_lock_checked`
   CAS sowie die Profilrevision bleiben letzte Schutzlinie
   beim tatsächlichen gleichzeitigen Commit. Keine neue
   PostgreSQL-Migration, kein Bypass, keine API-Schlüssel
   im Browser, keine neuen Rollenrechte.

## Testing

`tests/cwl-ownerless-browser-cycle-race.test.cjs`
prüft **Produktiv-Quellcode**, u. a.:

- Gleiches altes Profil + Review-Cycle erlaubt die bisherige
  Owner-Fallback-Pipeline (abwärtskompatibel).
- Nach serverseitig neuem Cycle **kein** lokaler
  Archivanbau und **kein** weiterer Cloud-Neustart.
- Abweichende Profilrevision, falsche alte Saison, fehlende
  Berechtigung, Offline-/Dirty-Tab: fail closed.
- Review-Cycle wechselt beim `await ensureSaved()`:
  **kein** RPC mit frisch gelesener neuer Cycle-ID.
- Cycle wechselt erst nach dem Save auf dem Server:
  trotzdem kein extra `cwl_set_plan_lock_checked`.
- Stabiler Owner-Fallback behält den exakten alten
  CAS-Token und kann wie bisher nur einmal starten.
- Clanwechsel während Serverabfrage wird verworfen.

Weiterhin [#265](https://github.com/Smolmig/cwl_planer/pull/265):
PostgreSQL-Rollback/Idempotenz, offizielle Saisonbelege,
6/7, 5/5, 7/7 und Multi-Tenant-Tests.

## Was vor dem echten Release noch fehlt

**Nicht mergebar als eigenständige Veröffentlichung**: Da der
Etappe-4-Serverwriter und der Browser-Fallback aufeinander
abgestimmt werden, muss die tatsächliche Aktivierungsfolge
klar sein: zuerst echte Datenbankmigration und gesicherte
Backup-/Restore-Prüfung #178, dann signierter Edge-Collector,
dann Browser-Release und User-UAT #213.

Die parallelen Besitzer-/Vize-/Beobachter-Zugriffe, Handy-PWA
und Realtime-Konflikthinweise müssen in einer Staging-Umgebung
mit echter Session/Live-RLS geprüft werden. Alte offene Tabs
mit v1.18.1 bleiben bis zum Reload ältere Clients; die
serverseitige atomare Revisionsprüfung ist deshalb Pflicht.

**Help-/Changelog-Review**: Die bestehende Hilfe beschreibt
Cloud-Sync/Konflikte; beim sichtbaren Release muss dort
„Neue CWL im Hintergrund erkannt – bei Konflikt Cloud
aktualisieren“ ergänzt und in verständlicher Sprache in den
Changelog aufgenommen werden. Deutsch bleibt Standard,
Englisch nach vollständiger Sprachoption parallel pflegen.

**Produktiv bleibt v1.18.1.** Alle Änderungen dieses PR
liegen ausschließlich im Draft-Branch, keine Live-DB-Mutation.
