# Supabase Advisor – Sicherheitsbestand und Regressionstest

**Erhebung 13.11.2026 · Produktionsprojekt nur lesend.**
**Kein Notfall, keine automatische Entwarnung:** Ein Advisor-Fund ist ein prüfenswerter Hinweis, nicht automatisch eine nachgewiesene Schwachstelle. Die Sicherheitsregeln der Live-App dürfen nicht allein deshalb still geändert werden. Cloud-Version bleibt **v1.18.1**.

## 1. Read-only-Ergebnisse

Die verbundenen Supabase-Tools `get_advisors(security/performance/health)` sowie eine stark begrenzte Prüfung der PostgreSQL-Katalog-Metadaten wurden am **13.11.2026** ausgeführt. Es wurden **keine Nutzer- oder Clanzeilen gelesen**, keine SQL-Migration ausgeführt und keine RLS-/Auth-Konfiguration geändert.

| Bereich | Befund | Einordnung und Folge |
| --- | --- | --- |
| Security – `authenticated_security_definer_function_executable` | **5 Warnungen** für authentifizierte Aufrufer in `public` | Nachfolgend einzeln geprüft: erhöhte Funktion-Rechte sind für den Planworkflow beabsichtigt, Zugriff über explizite Owner-/Editor-Bedingungen, feste `search_path` und Saison-/Revision-Checks eingeschränkt. Anonyme Execute-Rechte für diese fünf sind laut Live-Katalog **nicht** vorhanden. **Trotzdem** keine Aussage, dass sämtliche Laufzeit-Szenarien gegen ein Ausnutzen getestet seien. |
| Security – `rls_enabled_no_policy` | **1 Information**: `private.cwl_invite_link_secrets` | RLS aktiv, keine Policies; `anon` und `authenticated` besitzen laut Katalog **kein SELECT** auf diese private Tabelle. Das ist aktuell eine bewusst gesperrte private Quelle; keine blanket-Policy hinzufügen. |
| Security – `auth_leaked_password_protection` | **1 Warnung**: Schutz vor bekannten kompromittierten Passwörtern ausgeschaltet | Supabase dokumentiert diese Option als **Pro-Tarif und höher**, während die angeschlossene Organisation Free nutzt. **Kein kostenpflichtiges Upgrade** auslösen. Langfristig Passwort-/MFA-Konzept unabhängig prüfen. |
| Performance – `unindexed_foreign_keys` | **7 Informationshinweise** | Nutzer-/Owner-FK-Referenzen in vorhandenen Tabellen; erst Abfragemuster und Last prüfen, keine vorschnellen Indizes auf Live. |
| Performance – `unused_index` | **2 Informationshinweise** | Ein seit Anlage nicht beobachteter Index ist nicht grundsätzlich überflüssig. Keine Löschung ohne reale Daten-/Query-Nachweise. |
| Performance – `multiple_permissive_policies` | **3 Warnungen** zu mehrfachen PERMISSIVE-Richtlinien (Einladungen, Mitgliedschaften) | Primär Optimierungsbedarf. Vor Zusammenlegung zwingend Editor/Owner/Viewer, Austritt/Entfernung, Wiedereinladung und Cross-Clan-Berechtigungen dynamisch testen. Nicht während des ClashPerk-Imports mit umbauen. |
| Health Advisor | **0 Hinweise** | Kein genereller Datenbank-Health-Fund zur Prüfzeit. |

Offizielle Quellen: [Supabase Database Advisors](https://supabase.com/docs/guides/database/database-advisors), [Security-Definer-Check 0029](https://supabase.com/docs/guides/database/database-advisors?lint=0029_authenticated_security_definer_function_executable), [Passwortschutz](https://supabase.com/docs/guides/auth/password-security).

## 2. Die fünf SECURITY-DEFINER-Funktionen

| Funktion | Erwartete Authentifizierung und Autorisierung | Weitere Sperre |
| --- | --- | --- |
| `public.cwl_apply_verified_missed_pause` | Angemeldeter **Owner** des ausgewählten Clans; `private.cwl_is_owner(p_clan)` | Nur belegter API-Missed; erwartete Profilrevision, passende alte/freie CWL-Tage |
| `public.cwl_set_plan_lock_checked` | Angemeldeter **Owner** des Clans | Erwarteter Planzyklus und offizielle Saison |
| `public.cwl_resolve_plan_suggestion_checked` | Angemeldeter **Owner** des Clans, zu dem der Vorschlag gehört | Erwarteter Planzyklus und Saison |
| `public.cwl_submit_plan_suggestion_checked` | Angemeldeter **Editor** des genau ausgewählten Clans | Erwarteter Planzyklus und Saison |
| `public.cwl_withdraw_plan_suggestion_checked` | Angemeldeter **Editor** des Clans, dem der Vorschlag zugeordnet ist | Erwarteter Planzyklus und Saison |

Diese Bedingungen wurden aus der **aktiven Live-Katalog-Metadatenprüfung** und den bestehenden Migrationsdateien rekonstruiert:
`20261109192000_cwl_apply_verified_missed_pause.sql`, dessen Nachfolge-Definition `20261109192100_cwl_apply_verified_missed_pause_lock_order.sql`, sowie `20261111163500_cwl_review_cycle_cas_checked_rpc.sql`. Die vier alten ungesicherten Plan-RPC-Einstiegspunkte sind laut Live-Katalog **weder für `anon` noch für `authenticated` ausführbar**. Die fünf aktuell aufrufbaren Funktionen sind `SECURITY DEFINER`, haben `search_path=''`, `authenticated=true`, `anon=false`. Das ist eine **gezielte Privilegiengrenze**, die sich nicht ohne weitere Tests in `SECURITY INVOKER` umschreiben lässt.

## 3. Neue Regression und Grenzen

Die neue CI-Datei `tests/supabase-privileged-rpc-contract.test.cjs` schützt die vorhandenen Funktionen vor unabsichtlichen Änderungen an:

- `SECURITY DEFINER` **mit festem Suchpfad** und nicht-null `auth.uid()`
- clanbezogenem **Owner-/Editor-Check**, inklusive Vorschlag → tatsächlichem Clan
- erwarteter Version/Saison und Fehlersperre bei veraltetem Zyklus
- `REVOKE ... FROM PUBLIC, anon` und explizitem `GRANT ... TO authenticated`
- exemplarischen negativen Testmutationen, die Auth-/Rollen-/Grant-Kontrollen entfernen oder verwechseln

**Ein Quellcode-Vertragstest ersetzt keinen vollständigen HTTP-RLS-/GoTrue-Test**, keine Pentest-Freigabe und keine Überprüfung von Sicherheitslücken in Hilfsfunktionen. Die Tests sind ein zusätzlicher Schutz gegen Regressionen in genau den fünf bereits laufenden Funktionen. Der neue ClashPerk-Import-RPC aus Draft-PR #280 bleibt separat **`SECURITY INVOKER`** und unterliegt seinen eigenen Test-/Staging-/Rollback-Gates. Dieser Security-Audit-PR verändert **weder App-UI noch Datenbank**, benötigt daher **keine neue Cloud-Version** nach `VERSIONING.md`.

## 4. Offene Folgeschritte

- Vor einem weiteren DB-/ClashPerk-Release Advisor erneut ausführen; zusätzliche `public SECURITY DEFINER`-Funktionen **nicht ohne ausdrückliche Rollenprüfung** akzeptieren.
- Dynamischen separaten Owner/Editor/Viewer- und Cross-Tenant-/Negativpfad für diese fünf RPCs in kontrollierter Staging-Umgebung absichern (aktuelle statische Tests reichen allein nicht).
- Performance-Warnungen erst nach reale(n) Last-/Query-Nachweisen optimieren. Kein Entfernen bestehender Indizes oder Zusammenlegen von Richtlinien nur zur Beseitigung eines Advisor-Hinweises.
- Passwort-Leak-Check bei möglichem späterem Tarifwechsel erneut bewerten; zuvor **kein Pro-Upgrade** als Fix unterstellen.

**Freigabestatus: Nur dokumentiertes Read-only-Audit und synthetischer Quellcode-Regressionstest; kein Live-Deploy erforderlich.**
