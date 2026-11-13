# Collector: Abwesenheitsbeobachtung kann SQLSTATE 42883 auslösen

**Audit 13.11.2026 · Live nur lesend untersucht · Fix ausschließlich als noch nicht produktiv angewandte Migration.**

## Beobachtung

Der [geplante GitHub-Lauf #43517365457](https://github.com/Smolmig/cwl_planer/actions/runs/43517365457) der geschützten automatischen Clash-Statistiksammlung scheiterte am 13.11.2026 gegen **22:13 UTC** mit HTTP 503. Die anonymisierten Sammelzähler des bestehenden Workflows melden **3 berechtigte Profile**, `failedProfiles=0`, `tenureObservedProfiles=0`, `tenureWriteErrors=3`, `tenureSkippedProfiles=0`. Die validierte OIDC-Identität und vollständige Clash-Roster waren **nicht** der Verweigerungsgrund.

Die PostgreSQL-Katalog-/Supabase-Logprüfung ohne private Ergebnisdaten zeigt **SQLSTATE 42883 (undefined_function)** für eine während `public.cwl_observe_clan_roster_evidence(uuid,text,jsonb)` ausgelöste Trigger-Aktualisierung. Die betroffene Funktion ist `public.cwl_capture_clan_loyalty_evidence()`, aus der bereits laufenden Migration `20261110182000_cwl_clan_loyalty_evidence.sql`. In ihrem wiederholten *abwesend → abwesend*-Pfad verwendet sie

```sql
max_streak_seconds=pg_catalog.greatest(
  a.max_streak_seconds,
  CASE WHEN v_elapsed <= 10800
    THEN a.current_streak_seconds+v_elapsed ELSE 0 END
)
```

`GREATEST` ist in PostgreSQL ein spezieller SQL-Ausdruck und keine schemaqualifizierbare Funktion unter `pg_catalog`. Die Fehlermeldung kommt **erst**, wenn ein Clanmitglied bei **zwei vollständigen aufeinanderfolgenden Polls** abwesend beobachtet wird. Dadurch konnten vorhergehende Einzeltests den Fehler übersehen. PostgreSQL-Dokumentation: https://www.postgresql.org/docs/current/functions-conditional.html

## Fix ohne Datennacherfindung

Neue versionierte Korrektur `supabase/migrations/20261113230000_cwl_clan_loyalty_absence_greatest_fix.sql` ist **nur ein `CREATE OR REPLACE FUNCTION`** mit exakt unverändertem Triggerbody bis auf **`pg_catalog.greatest(` → `GREATEST(`**. Trigger, `SECURITY INVOKER`, fixer leerer `search_path`, `current_user='service_role'`-Schranke, Tenant-Where, Grants/RLS und konservative maximal dreistündige Beobachtungsfenster bleiben unverändert. Keine automatischen Clanplan-Änderungen, keine Datenbereinigung, keine Rückdatierung von Abwesenheiten oder rückwirkenden Aktivitätsminuten.

Neue [isolierte PG17-CI](../.github/workflows/collector-loyalty-absence-sql-ci.yml) führt:

1. Synthetische Rollen/Datensätze anlegen; exakt die derzeit produktive Originalmigration einspielen.
2. Einmal *anwesend → abwesend* und danach *abwesend → abwesend* ausführen. Der unveränderte Trigger muss mit **42883 genau wegen `pg_catalog.greatest`** scheitern; Transaktion und vorheriger Stand müssen konsistent bleiben.
3. **Nur in dieser Wegwerf-Datenbank** die neue Korrekturmigration installieren.
4. Zwei Abwesenheitsintervalle innerhalb 3h, eine Lücke über 3h, ein neues Kurzintervall und tatsächliche Rückkehr testen: beobachtete Anzahl, aktuelle/maximale Dauer, ein einziger Austrittsbeleg, keine erfundene Spende; Tenant-/Trigger-/Grants-Prüfung.
5. Mit dem Node-Contract-Test exakt diese eine Funktionsänderung absichern.

## Freigabe und Nachkontrolle

**Stand: Produktionsfix NOCH NICHT ANGEWANDT.** Kein SQL-Schreibzugriff auf Live in dieser Audit-/PR-Phase. Nach grüner PR-CI ist eine **gesondert freizugebende** Migration und anschließende, echte Collector-Nachkontrolle notwendig. Für den nächsten gültigen Plan-/Cron-Lauf müssen `tenureWriteErrors=0`, `tenureObservedProfiles=tenantProfiles` und vollständig berechtigte Rosters nachweisbar sein. Lücken aufgrund fehlgeschlagener Polls werden **nicht** still nachträglich aufgefüllt oder als gesicherte Aktivitäts-/Abwesenheitsdauer behandelt.

**Versionierung:** backendseitiger Defektfix ohne neuen Cloud-App-Code; nach `VERSIONING.md` keine neue öffentliche App-Version. Eine spätere technische DB-Migration wird als eigenständiger Backend-Eingriff dokumentiert. **ClashPerk-Draft #280 bleibt unangetastet und ohne Freigabe.**

## Paralleler Staging-Freiplatz

Stand 13.11.2026: Die Supabase-Organisation läuft auf **Free**; der verbundene Account zeigt aktuell **ein aktives Projekt**. Der Free-Tarif erlaubt zwei aktive kostenlose Projekte **über alle betroffenen Owner/Admin-Organisationen** hinweg; Teammitglieder können das nutzbare zweite Kontingent einschränken. Unter dieser Voraussetzung kann ein zweites Staging-Projekt **ohne Pro-Upgrade** eingerichtet werden. Kein Projekt wurde angelegt; erst nach ausdrücklicher Freigabe und Bestätigung eines `$0`-Projekts. Offizielle Konditionen: https://supabase.com/docs/guides/platform/billing-on-supabase
