# #227 – Autonomer CWL-Saisonwechsel: Etappe 1 / vertrauenswürdige neue Saison

**Stand 12.11.2026 · Draft, nicht produktiv ausgerollt · bestehende Cloud v1.18.1 unverändert.**

## Ziel dieser Etappe

Der bereits eigenständig laufende, streng signierte `coc-stats-collector` kennt den
verknüpften Clan-Tag für **jeden** App-Clan (auch wenn kein Owner einen Browser
öffnet). Er fragt die Supercell-Leaguegroup für die Kriegsstatistik bereits ab.
Dieselbe Antwort wird jetzt zusätzlich gegen ein enges, rein lesendes Schema
geprüft und als **CWL-Saisonankündigung** pro App-Clan gespeichert.

Dies ist **nicht** der automatische Saisonwechsel. Insbesondere werden weder
Planprofile noch Locks, Vorschläge, CWL-Archiv, gespielte Angriffe oder RLS-Rollen
verändert. Der echte atomare Wechsel ist die nächste, separat abzunehmende Etappe.

## Vertrauensgrenzen

1. **Nur verknüpfte App-Clans:** Der Collector bezieht App-Clan-IDs und Tags aus
   `cwl_clans` per service_role, nicht aus einer Anfrage des Browsers.
   Mehrere App-Clans mit demselben Supercell-Tag bleiben separate Datensätze.
2. **Nur offizielle plausible Leaguegroups:** 6 eindeutige zulässige Clan-Tags
   mit 0/5 Runden bzw. 8 mit 0/7; angefragter Clan gehört zur Gruppe; Tag,
   Monat, Status und War-Tags sind gültig. 0 Runden nur bei `preparation`.
   Fehlende, widersprüchliche und `notInWar`-Antworten werden verworfen.
3. **Nicht kalender- oder statusgetrieben:** `season` stammt aus der offiziellen
   Gruppe, nicht aus `Date.now()`. `ended` allein ist **kein** Beleg für einen
   tatsächlich abgeschlossenen letzten Krieg. Ein 6/7-Stand bleibt unvollständig.
4. **Service-Only-Tabelle:** `cwl_verified_league_observations` mit
   Primärschlüssel `(clan_id,season)`. Keine Public-/Anon-/Authenticated-Rechte
   oder Browser-RPCs. Ein DB-Trigger bestätigt den App-Clan/Clash-Tag erneut,
   prüft eindeutige Tags und verweigert Gruppen-Identitätswechsel. Phasen und
   Rundenzahl gehen bei wiederholten/stalen Polls nicht rückwärts.
5. **Kein exponierter Rohdatensatz:** Nur Clan-Tags, Gruppengröße, Saison,
   Phase, beobachtete Rundenzahl und Serverzeitstempel werden gespeichert;
   keine Spieler, Angriffe, API-Schlüssel oder komplette Supercell-Antwort.
   Öffentliche Collector-Antwort nennt ausschließlich aggregierte Zähler.
6. **Dauerhafte Beobachtung statt Browser-Trigger:** Die bestehenden Cron-/OIDC-
   Identitätsprüfungen bleiben unverändert, keine neuen Geheimnisse/Headers.
   Bei API-/Schema-/DB-Fehlern wird kein Saisonbeleg erfunden; pro App-Clan
   wird der Schreibfehler gezählt. Statistik-Sammlung bleibt getrennt.

## Reihenfolge für Deploy und Verifikation

- **Jetzt im Draft:** Node-Regressionsfixtures für 5er/7er-Ligen, Vorbereitung,
  fehlende/malformed Gruppen, falschen Tenant, Konflikte und statisches
  RLS-/Write-Scope-Gate. Vollständige CI abwarten. Keine Echtdaten schreiben.
- **Vor produktivem Deploy:** isoliertes SQL-Staging/Transaktionsprobe mit
  beabsichtigtem Rollback, eindeutigen sechs/acht Tags, Konflikt, zwei Tenants,
  gleicher Poll wiederholt und Phasen-Rückschritt; Rollenprivilegien und bestehende
  Tabellen prüfen. Backup- und Restore-Sicherheit aus #178 nachweisen.
- **Deploy A:** additive Migration zuerst. Keine bestehenden Daten mutieren.
- **Deploy B:** denselben geprüften Collector-Code mit bestehenden Auth-/
  Cron-Einstellungen deployen; signierten normalen Lauf abwarten.
- **Kontrolle:** Nur read-only, pro Tenant und Saison beobachten, ob das
  gespeicherte Gruppensignal der tatsächlichen Clash-Saison entspricht.
  0-Signal bei `notInWar` ist korrekt; unbekannter Finaltag bleibt unbekannt.
  Dokumentieren, dass die App bis zur Folgetappe **weiter Owner-abhängig rollt**.

## Weitere Etappen (noch NICHT implementiert)

1. **Server-Preflight** mit genauem Nachweis der *neuen* Saison aus dieser
   Tabelle, validierter alter Profil-/CWL-Saison, Revision, altem Cycle und
   vorhandenen Archiv-Snapshots. Auch 6/7, 7/7, 5/5 und fehlende Belege
   ausdrücklich unterscheiden.
2. **Atomarer per-Tenant-RPC** für alte Profilkopie inkl. unveränderter historischer
   Aufstellungen und Einsätze, idempotente Archivablage, CAS auf Profilrevision,
   alte Vorschläge abschließen, neuen offenen Cycle, und erst danach das neue
   Planprofil. DB-Zeilensperren, adversariale Zwei-Job-/Owner-/Viewer-Tests.
3. **Konkurrenz mit Browser-Fallback**: Ein erfolgreich vollzogener Serverwechsel
   wird bei Owner-Login nur gelesen und **nie ein zweites Mal** archiviert
   oder gelöscht. Fehlgeschlagene Transaktion lässt den alten Plan intakt.
4. **Rollout/UAT**: 5/5, 6/7, 7/7, Vorbereitungsphase vor Tag 1,
   zwei App-Clans (inkl. identischem Clash-Tag), Owner offline, Viewer zuerst,
   alte Tabs und echte mobile Owner/Vize/Viewer-Prüfung #213.
   Bei sichtbarer UI-Änderung Hilfe sowie DE/EN-Sprachstand aktualisieren.

**Keine Änderung an** `cloud-version.json`, `cloud-app.html`, Offline-PWA,
Freigabe-RPCs, `cwl_group_archives`, `cwl_own_lineup_archives` oder Spielerprofilen
durch diese Etappe. Die bestehende Hilfe-Seite bleibt inhaltlich gültig, da die
Nutzerfunktion des autonomen Wechsels noch nicht angeboten wird.
