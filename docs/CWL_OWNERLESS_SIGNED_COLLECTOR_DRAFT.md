# #227 – Etappe 6: Signierter CWL-Hintergrunddienst → atomarer Saisonwechsel (DRAFT)

**Stand: 12. November 2026 · Produktivversion v1.18.1 UNVERÄNDERT**

Diese Etappe verdrahtet den bestehenden, bereits unabhängig authentifizierten
`coc-stats-collector` mit den ausschließlich dienstseitigen PostgreSQL-RPCs
aus #263 und #265. Der Collector erhält dabei **keine neue öffentliche
Berechtigung**, keinen vom Browser vorgegebenen Quell-Plan und keinen
clientseitigen Secret-Wert.

## Bisherige Bausteine und Reihenfolge

1. #262: Die offiziell von Supercell gelieferte **neue** 6-/8-Clan-CWL-Gruppe
   wird für **jedes verknüpfte App-Clan-Tenant separat** geprüft und
   als `cwl_verified_league_observations` geschrieben.
2. #263: `cwl_ownerless_cycle_preflight(clan)` verifiziert Saison, Quelle,
   alten Cycle und Profilrevision sowie tatsächliche gespielte 5/5,
   6/7 oder 7/7 Tage – **nur lesend**.
3. #264: Unveränderlicher vollständiger JSON- und Review-State-Checkpoint.
4. #265: `cwl_ownerless_atomic_rollover(clan,expected_cycle,
   expected_revision,target_season)`: **eine einzige DB-Transaktion** für
   Checkpoint, normales CWL-Archiv, Reset, neuen Cycle und SYSTEM-Audit.
5. #266: Schon offene Owner-Browser-Tabs erkennen einen vom Server
   übernommenen Cycle und dürfen weder das alte Archiv kopieren
   noch einen neuen zweiten Cycle eröffnen.
6. **Diese Etappe**: ein bisher nicht ausgeführter Adapter im
   signierten Collector, der erst nach Schritt 1 die RPCs aus 2/4
   **mit den serverseitig erhaltenen CAS-Werten** ansteuert.

## Zwei unabhängige Feature-Schalter (fail closed)

Beide Werte stammen **ausschließlich aus den Edge-Funktion-Umgebungswerten**
und nicht aus POST-Body/URL/Header der eingehenden Anfrage.

| Edge-Einstellung | Erlaubter Inhalt | Wirkung |
| --- | --- | --- |
| `CWL_OWNERLESS_ROLLOVER_MODE` | `off` oder nicht gesetzt | **Standard:** keinerlei RPC-Anfragen oder Planänderungen |
| Gleiche Variable | `observe` | Für freigegebene App-Clans nur **lesenden Preflight**, niemals Reset |
| Gleiche Variable | `apply` | Dienstseitiges Archiv + neuer Cycle **nur** bei zusätzlich freigegebenem UUID |
| `CWL_OWNERLESS_ROLLOVER_CLAN_IDS` | Kommagetrennte App-Clan-UUIDs | Pflicht-Allowlist für `observe` und `apply`; kein Clash-Tag |

Leere, falsche oder mehr als 25 IDs sowie zu lange Listen deaktivieren
`apply`. **Ein identisches Clash-Clan-Tag ist niemals Berechtigung für
einen anderen App-Clan.** Die Umgebungsvariable wird bewusst nicht aus
einem Browser-Request übernommen; die RPC benutzt nur die bereits
existierende Dienstrolle.

**Hinweis zur Sicherheit:** Dieser Draft ist nicht in der laufenden Edge
Function installiert. Ein späterer Code-Deploy mit nicht gesetzten
Variablen hätte den Dienstpfad weiterhin **ausgeschaltet**.
`apply` ist eine ausdrückliche spätere Betriebsentscheidung nach UAT,
nicht Teil dieses Pull Requests.

## Ausführung im Collector

- Existierende unabhängige Auth-Gates bleiben unverändert:
  gültiger GitHub-OIDC-Identitätsbeleg für den fixen Main-Workflow oder
  unabhängig verifizierter interner HMAC-Cron. Andere Eingänge
  werden **vor jeder** privilegierten Tabellen-/RPC-Aktion abgewiesen.
- Collectorspeicherung eines offiziellen `scan.seasonObservation`
  muss **für genau diese App-Clan-ID erfolgreich** gewesen sein;
  erst dann werden weitere RPCs überhaupt angefragt.
- `observe` liest Preflight. `apply` liest denselben Preflight und
  nutzt ausschließlich dessen `source_cycle_id`,
  `source_revision` und `target_season` als erwartete Werte für
  den bereits im SQL nochmals prüfenden atomaren Writer.
- Quelle, Ziel, Sonderformat und gespielte/nicht bestätigte Tage
  werden nochmals gegen den aktuellen offiziellen Gruppenbeleg
  verglichen. Unsichere/malformed Antworten stoppen **ohne**
  irgendwelche Client-Profile zu übernehmen.
- Keine automatischen Wiederholungen des Schreib-RPC **im selben
  Collector-Aufruf**. Der nächste signierte Lauf darf später erneut
  prüfen. Der DB-Writer ist idempotent: `already_applied` eröffnet
  keine zweite Saison.
- Zeitbudget: Vor dem Read-Preflight mindestens 14 Sekunden,
  vor dem Writer mindestens 8,5 Sekunden Reserven; RPCs haben
  Timeout. Bei Ende des Collector-Budgets **kein riskanter Reset**.
- Nur aggregierte, nicht personen-/clanbezogene Zähler im
  Collector-Ergebnis: `rolloverMode`, `rolloverChecked`,
  `rolloverCandidates`, `rolloverApplied`,
  `rolloverAlreadyApplied`, `rolloverSkipped`, `rolloverErrors`.
  Kein Spieler, Clan-Tag, JWT, alter Profilinhalt oder Schlüssel
  wird im Bericht protokolliert.
- Ein problematischer Tenant verhindert nicht den normalen
  Statistikabruf anderer Clans. Ein aktivierter, fehlgeschlagener
  Rollover verursacht dennoch einen sichtbaren Collector-503,
  statt eine falsche Erfolgsmeldung zu erzeugen.

## Tests und Release-Gates

`tests/collector-ownerless-rollover.test.cjs` führt die Adapterlogik
mit künstlichen Clan-IDs und einem Fake-PostgREST aus:

- standardmäßig aus, beide Operator-Gates, ungültige Allowlist;
- nur offiziell bekannte neue Saison des **richtigen** App-Clans,
  nach bestätigter Speicherung; falscher Tag/unvollständige Gruppe aus;
- `observe` ist rein lesend;
- `apply` sendet ausschließlich vier CAS-Parameter, niemals
  JSON-Profil, Aufstellungen, Spieler- oder Geheimdaten;
- Zieländerungen, veraltete Revision, unsichere JSONB-/RPC-Antworten,
  Netzwerkfehler und Budgetende sind fail closed;
- bereits angewendeter Zyklus wird als `already_applied`
  unterschieden;
- zwei App-Tenants mit dem gleichen Clash-Tag brauchen
  **separat** Freigabe.

Die SQL-Seite bleibt zusätzlich mit den nativen PostgreSQL-17-Tests
aus #265 abgedeckt, inklusive Fehler am Ende der Transaktion.

**Vor tatsächlicher Freigabe weiterhin ausstehend:**

1. Backup-/Restore-Gate #178 mit reproduzierbarem Recovery-Protokoll.
2. Die gestapelten Phase-1–4-SQL-Änderungen geordnet, **als
   geprüfte Migrationen**, auf einer eigenen Staging-Datenbank testen;
   dabei die originalen Owner-/Revision-/Audit-Trigger und RLS prüfen.
3. Edge-Funktion auf Staging installieren, **Modus `observe`**
   und exakt eine Staging-App-Clan-UUID; beweisen, dass weder
   Archiv noch Plan verändert werden.
4. Staging-Canary mit `apply`, echte Race-/Retry-Tests und
   Browser-/PWA-UAT #213 für Owner, Vize und Beobachter.
5. Erst danach schrittweise produktive Freigabe mit Rollback-
   Möglichkeit (`MODE=off`) und Monitoring der Zähler.
6. Beim **sichtbaren** Live-Release Hilfe-Seite, verständliche
   DE-Changelog-History und später vollständige EN-Übersetzung
   synchron pflegen; Gold-/Arena-Theme bleibt Standard.

**Keine Live-Änderung im Draft.** Keine App-Deployment-
oder Datenbank-Migration in diesem Arbeitsschritt durchgeführt.
