# ClashPerk: lokale Supabase-Auth- und Import-UAT

**Stand 13.11.2026 · gestapelter Draft #277 · kein Produktiv-Deploy.**

## Warum noch ein weiterer Test?

Die bisherigen #273–#276-Gates haben XLSX-Parsing, den sichtbaren Chromium-/WebKit-Upload, die atomare PostgreSQL-RPC, signierte HTTP-JWTs und Backup/Restore erfolgreich abgedeckt. Beim HTTP-Test wurden die signierten JWTs allerdings direkt von einer Testfunktion erzeugt. **Dieser Test ergänzt den echten Supabase-Auth-/GoTrue-Passwort-Login** und stellt dadurch sicher, dass die ausgegebenen Session-Tokens auch über die tatsächliche Supabase-API mit den historischen Statistik-RLS-Regeln funktionieren.

## Technische Durchführung

- Workflow: `.github/workflows/clashperk-local-supabase-auth-ci.yml`.
- Die gepinnte **Supabase CLI 2.122.0** erstellt mit `supabase init --yes` eine frische temporäre Projektkonfiguration und startet ausschließlich lokale Dienste (PostgreSQL, Auth/GoTrue, Kong/API und PostgREST). **Kein `supabase link`, kein Fernzugriff auf das Produktivprojekt, keine echte Benutzer-ID oder Originaldaten.**
- Datei `tests/sql/clashperk-local-supabase-auth-fixture.sql`: erzeugt zwei ausschließlich künstliche Clans und eine echte per-Clan-Mitgliederrollentabelle. Dabei verwendet die Postgres-RLS-Funktion `auth.uid()` der lokalen Supabase-Installation, keine selbst erfundene Mock-UID-Funktion.
- Danach werden die bereits verwendeten historischen Statistikmigrationen und der **DRAFT** der sicheren `public.cwl_import_clashperk_atomic`-RPC lokal installiert. Dies ist **keine produktive Migration**.
- Datei `tests/clashperk-local-gotrue-auth.test.cjs`: GoTrue-Admin erstellt vier lokale Testkonten mit bestätigter E-Mail; alle vier führen einen echten `/auth/v1/token?grant_type=password`-Login aus. Die Clanrollen sind separat in PostgreSQL hinterlegt, **nicht** von frei editierbarem `user_metadata` abhängig.
- Anschließend laufen alle HTTP-Anfragen mit den **tatsächlich von GoTrue signierten Access-Tokens** durch die lokal gestartete PostgREST-API.

## Nachgewiesene Anforderungen

1. Vize kann historische Angriffe und Missed-Angaben in einem Schritt übernehmen. Owner kann Resultate lesen und denselben Import idempotent wiederholen.
2. Viewer mit **gültigem** Login darf nur den Clan lesen, zu dem er gehört, und nichts schreiben.
3. Ein Benutzer mit Rechten in **Clan B** darf nichts in Clan A lesen oder verändern; Clan B kann eigene Daten importieren.
4. Falscher Clan-Tag oder falsches Passwort wird abgelehnt.
5. Ein fehlerhafter später Missed-Beleg verursacht eine transaktionale Rollback ohne halbfertige neue Kriege.
6. Der Testserver, alle lokalen Nutzer und alle Schlüssel werden am Ende wieder entfernt.

## Ergebnisse

- [Lokale Supabase-Auth-CI #43421566636](https://github.com/Smolmig/cwl_planer/actions/runs/43421566636): **bestanden** (1 umfangreicher Integrationstest).
- [Vollständige App-Regression #43421566474](https://github.com/Smolmig/cwl_planer/actions/runs/43421566474): **718/718 bestanden, 0 Fehler**.
- [Historische CWL-SQL-Regression #43421566374](https://github.com/Smolmig/cwl_planer/actions/runs/43421566374): **bestanden**.

## Was vor einer Freigabe weiterhin aussteht

Diese UAT testet **wirkliche lokale Supabase-Anmeldungen**, nicht aber die aktuelle produktive Account-Konfiguration oder eine vollständige bestehende Mitgliederliste. Die Live-Instanz ist bisher das einzige bestätigte gehostete Supabase-Projekt; ein separates Hosting-Testprojekt wurde nicht erstellt.

Die vorherigen UI-Tests verwenden simulierte Datenbankaufrufe; die vorliegende Auth-UAT verwendet direkte HTTP-Anfragen statt der mobilen Cloud-Oberfläche. Daher sind noch gesondert abzunehmen: vollständiger iPhone-Safari-/PWA-Benutzerfluss mit einer Testinstallation, konservativer Release-/Backup-Rollback-Plan und die Freigabe eines produktionsidentischen Test- oder Staging-Betriebs. Das gesamte manuelle Cloud-App-Backup aus #178 ist ein anderer, weiterhin offener Produktpunkt.

**Bis dahin: kein Merge, keine SQL-Migration und kein Deployment. Produktiv bleibt v1.18.1.**
