# CWL-Archiv: ein Saison-Eintrag (Cloud v1.18.1)

**Anforderung vom 12. November 2026:** Die bisher doppelte Darstellung „Gruppenergebnisse aus Clash“ und „Archivierte CWL-Pläne“ verwirrt. Statt zweimal „November 2026“ soll ein einzelner Saison-Eintrag alle verfügbaren Informationen enthalten. Die Quellen bleiben getrennt, um keine Altdaten zu verlieren.

## Ergebnis aus Anwendersicht

- **Mehr → CWL-Archiv:** Liste „Vergangene CWL-Saisons“. Eine Karte pro verifizierter Kombination aus offiziellem Saisonmonat und Clash-Clan-Tag.
- Jede Saisonkarte zeigt **Kriegstage**, **Tabelle** (mit aufklappbaren Paarungen aller Clans), **Spieler** (nur belegte Angriffe) und **Einsätze** (archivierte Aufstellungen und Einsatzhäufigkeiten). Der Nutzer wechselt Reiter, ohne eine zweite Monatskarte oder ein Modal durchsuchen zu müssen.
- Der bestehende **Mit Clash abgleichen**-Button bleibt sichtbar und verwendet die bisherige autorisierte Serverfunktion.
- Manuelle, importierte oder ältere Pläne ohne passende `sourceSeason` + originales `cwlLive.season` + valides `cwlLive.clanTag` erscheinen separat. Das gleiche Monatslabel allein ist **kein** Nachweis zum Zusammenführen.
- Eine Saison mit Gruppendaten ohne gespeicherten Plan bleibt vollständig lesbar. Ein Plan ohne zugängliche Gruppendaten oder ohne Cloud-Login bleibt über sein Planarchiv erreichbar. Unbekannte Scores/Angriffe werden nicht zu Null oder zu einem erfundenen CWL-Abschluss.
- **Löschen** entfernt ausschließlich einen ausdrücklich ausgewählten gespeicherten Plan nach bisheriger Bestätigung, nie Clash-Gruppe/Statistiken/andere Pläne; Cloud-Beobachter dürfen nicht löschen.
- Aufgeklappte Karte, Reiter und Unterabschnitte bleiben bei automatischem Hintergrundabruf offen bzw. geschlossen. Bei Clanwechsel werden alte Netzwerkantworten verworfen.

## Datenmodell und Sicherheitsgrenzen

- Die bisherige Supabase-Tabelle `public.cwl_group_archives` bleibt read-only über RLS.
- Die bisherige `public.cwl_own_lineup_archives` bleibt read-only über RLS.
- Der lokale/gemeinsame Profilwert `profile.archives` bleibt unverändert; nur seine **Darstellung** wird mit der passenden Saison zusammengeführt.
- Keine API-Schlüssel im Browser, keine Schemaänderung, keine RLS- oder Edge-Mutation. Der Cloud-Verbindungsstatus steuert nur, ob ein Gruppendatenabruf erfolgt.
- Die historische, versteckte Legacy-Liste bleibt im DOM zunächst kompatibel zu älteren App-Funktionen, erscheint aber **nicht mehr** als zweite Nutzerliste. Die neue Übersicht ist der einzige sichtbare Einstieg für vergangene CWLs.
- Die Offline-PWA (`index.html` und `service-worker.js`) bleibt separat v1.0.2 und wird nicht geändert.

## Format- und Regressionstests

- Paarungen mit 6 Clans / 5 Kriegen und reguläre 8 Clans / 7 Kriege.
- 15vs15 und skalierbare Kriegstage, inkl. bereits dokumentierter 5vs5/30vs30-Kompatibilität.
- Ein unverwechselbarer Saison-/Clan-Key und Unterscheidung von manuellen/importierten Archiven ohne exakte Herkunft.
- Ein 28/28-Gruppenergebnis und ein vorhandener 7/7-Plan ergeben **genau eine** Karte.
- Rollen-/Löschschutz, Offline-Planarchiv, historische Spielerbelege, Tabwechsel und Hintergrundaktualisierung.
- Reaktionsfähiges Layout für iPhone 320/390/430 und Desktop 1366; Light/Dark/Gold als weitere reale Abnahme.
- Der frühere Nutzerwunsch zur vollständigen historischen CWL-Ansicht aus v1.18.0 bleibt erhalten, nur die Navigation wird vereinfacht.

## Versionierung und Dokumentation

SemVer **PATCH v1.18.1**: Konsolidierung der bestehenden Funktionen/UX, keine neue eigenständige Funktion und keine Datenmigration. Neues `cloud-version.json`, öffentlicher `cloud-release-history.mjs`-Eintrag, Settings-Hinweis, Hilfe und `CHANGELOG.md` werden gemeinsam gepflegt.

**Pull Request:** [#261](https://github.com/Smolmig/cwl_planer/pull/261). Automatische Browser-, Versions- und Unit-Tests sind Freigabebedingung. Eine echte Besitzer-/Vize-/Beobachter-Abnahme auf mobilen Geräten bleibt unabhängig von der CI relevant und ist in [#213](https://github.com/Smolmig/cwl_planer/issues/213) dokumentiert.
