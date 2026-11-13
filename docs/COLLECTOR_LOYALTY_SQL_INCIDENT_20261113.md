# Collector: Abwesenheitsbeobachtung kann SQLSTATE 42883 auslösen

**Status 14.11.2026, 00:13 MEZ: PROD-FIX ANGEWANDT, echter Collector-Nachtest BESTANDEN.** Der folgende Abschnitt zur anfänglichen Fehlersuche dokumentiert weiterhin den historischen Vorher-Stand.

## Abschluss: echte Supabase-Live-Migration und Collector-Wiederherstellung

Der Nutzer hat den Einsatz der zuvor isoliert getesteten Einzel-Funktionskorrektur ausdrücklich freigegeben. Daraufhin wurde die identische SQL-Datei `supabase/migrations/20261113230000_cwl_clan_loyalty_absence_greatest_fix.sql` mit dem Supabase-Migrationswerkzeug auf **das bereits bestehende Live-Projekt** angewendet. Supabase registriert sie in der Live-Migrationsliste als Version `20261113231214` mit dem Namen `cwl_clan_loyalty_absence_greatest_fix`. **Keine** Datenwerte, Rollen, RLS-Policies, Triggerzuordnungen, Cloud-App-Dateien oder inaktive historische Zeiten wurden verändert.

Die unmittelbare reine Leseprüfung bestätigt: `pg_catalog.greatest(` **nicht** mehr in der Live-Funktion, `max_streak_seconds=GREATEST(` **vorhanden**, Trigger weiterhin aktiv, `SECURITY INVOKER`, `service_role` mit EXECUTE, `authenticated` und `anon` ohne EXECUTE. Die zuvor grüne Pull-Request-CI [#287](https://github.com/Smolmig/cwl_planer/pull/287) mit **696/696 Tests**, realem PostgreSQL-17-Vorher-/Nachher-Test und unabhängiger SQL-CI bleibt als Regressionsnachweis bestehen.

Für den **tatsächlichen Live-Funktionstest** wurde der zuvor gescheiterte, bereits autorisierte [GitHub-Collector-Lauf #43517365457](https://github.com/Smolmig/cwl_planer/actions/runs/43517365457) **als fehlgeschlagener Job erneut ausgeführt** (neuer Job `132229747576`). Die unveränderte GitHub-OIDC-Authentisierung und das reguläre Edge-Collector-Programm wurden verwendet. Ergebnis **SUCCESS** mit `tenantProfiles=3`, `tenureObservedProfiles=3`, `tenureWriteErrors=0`, `tenureSkippedProfiles=0`, `rosterFailureClasses={}`, sowie der Ausgabe `Protected collection completed with full roster coverage`. Keine geheime oder tenantidentifizierende Antwort protokolliert.

Die nachfolgende, aggregierte **read-only** Datenbankprüfung ergab zum **13.11.2026 23:13 UTC / 14.11.2026 00:13 MEZ**: **103 beobachtete Mitgliedereinträge aus 3 App-Clans**, alle 103 innerhalb der vorangegangenen 15 Minuten neu beobachtet, letzter vollständiger Rosterstand `2026-11-13 23:13:07.950603+00`. Der unveränderte Gesundheits-SQL-Check `scripts/collector-tenure-health.sql` meldete `roster_freshness='roster_within_3h'`, `collector_profiles=3`, `collector_profiles_with_error=0`, `collector_profiles_stale_gt_3h=0`. Die rund 40 Stunden zuvor fehlender Roster-Beobachtungen bleiben **unbekannt**; es gibt **keine automatische Zeitnachverrechnung, keinen erfundenen Offline-Beleg und keine Verwaltungsentscheidung**.

**Abschluss der Störung:** Behebung und vollständige Wiederaufnahme der Collector-Roster-Schreibungen für die geprüften drei Profile bestätigt. Das System muss bei späteren autonom geplanten Läufen weiterhin die reguläre Datenfrische beobachten; ein erfolgreicher einmaliger Retry ersetzt nicht den dauerhaften Scheduler-Betrieb. Öffentlich sichtbare Cloud-App-Version bleibt **v1.18.1**. Der separate [ClashPerk-Draft #280](https://github.com/Smolmig/cwl_planer/pull/280) bleibt ausdrücklich **NO-GO**, und es wurde **kein zweites Supabase-Staging-Projekt** angelegt.

---

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

**Historischer Stand vor dem 14.11.2026: Produktionsfix war damals NOCH NICHT ANGEWANDT. Die oben dokumentierte Live-Migration und der erfolgreiche Collector-Retry schließen diesen Punkt inzwischen ab.** Kein SQL-Schreibzugriff auf Live in dieser Audit-/PR-Phase. Nach grüner PR-CI ist eine **gesondert freizugebende** Migration und anschließende, echte Collector-Nachkontrolle notwendig. Für den nächsten gültigen Plan-/Cron-Lauf müssen `tenureWriteErrors=0`, `tenureObservedProfiles=tenantProfiles` und vollständig berechtigte Rosters nachweisbar sein. Lücken aufgrund fehlgeschlagener Polls werden **nicht** still nachträglich aufgefüllt oder als gesicherte Aktivitäts-/Abwesenheitsdauer behandelt.

**Versionierung:** backendseitiger Defektfix ohne neuen Cloud-App-Code; nach `VERSIONING.md` keine neue öffentliche App-Version. Eine spätere technische DB-Migration wird als eigenständiger Backend-Eingriff dokumentiert. **ClashPerk-Draft #280 bleibt unangetastet und ohne Freigabe.**

## Paralleler Staging-Freiplatz

Stand 13.11.2026: Die Supabase-Organisation läuft auf **Free**; der verbundene Account zeigt aktuell **ein aktives Projekt**. Der Free-Tarif erlaubt zwei aktive kostenlose Projekte **über alle betroffenen Owner/Admin-Organisationen** hinweg; Teammitglieder können das nutzbare zweite Kontingent einschränken. Unter dieser Voraussetzung kann ein zweites Staging-Projekt **ohne Pro-Upgrade** eingerichtet werden. Kein Projekt wurde angelegt; erst nach ausdrücklicher Freigabe und Bestätigung eines `$0`-Projekts. Offizielle Konditionen: https://supabase.com/docs/guides/platform/billing-on-supabase
