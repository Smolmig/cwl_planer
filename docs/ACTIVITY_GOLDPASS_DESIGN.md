# Zeitraum-Goldpass (#351): Kriterien und API-Evidence

## Ziel
Eigenständige Verlosung neben der CWL-Verlosung (#180): frei wählbare Zeitfenster, Mindestbedingungen, optional Punkte/gewichtete Lose, nachvollziehbarer Fortschritt. Standardvorschlag: ein Los je qualifiziertem Teilnehmer. Keine fest vorgegebenen Leistungsgrenzen. Kein automatischer Kauf/Versand.

## Datenquellen
- Bestehende positive Clan-Spendendeltas, eigene belegte CW/CWL-Angriffe und verifizierte Fehlangriffe wiederverwenden. Kriege nach dokumentiertem Zeitbezug auswählen (z. B. Abschlussdatum, nur bei belegtem Abschluss); Importquelle ausdrücklich getrennt. Unvollständige Quoten nicht als null berechnen.
- Offizielle neue Player-Battlelog- und League-History-/Group-Endpunkte seit Juni 2026 in SDK/Dokumentationsspiegel dokumentiert. Vor produktivem Polling prüfen, ob der vorhandene API-Key/Proxy diese Endpunkte und die erwarteten Felder tatsächlich liefert. BattleLogEntry: battleType HOME_VILLAGE/RANKED/LEGEND, attack, battleTimestamp, stars, destructionPercentage, opponentPlayerTag (optional). Nicht aus attackWins ableiten. Keine Verteidigung als Angriff. Begrenztes rollierendes Log; Polling-Lücken, Überlauf und widersprüchliche Identität als unvollständig markieren, nicht rückwirkend extrapolieren. Persistente Deduplizierung und Beobachtungszeitraum nötig. Aktive Spieltage sind beobachtete Aktivität, kein letzter Login.
- Ranked: Angriffe, Sterne, Dreier, abgeschlossene Turniere, Aufstieg und Teilnahmequote anhand tatsächlich verfügbarer Angriffe je Liga/Turnier. Legend separat optional. Keine pauschale gleiche Mindestzahl für alle Ligen. Bei unvollständigem Nenner Quote unbekannt.
- Raidlog: tatsächliche Angriffe, attackLimit+bonusAttackLimit, Hauptstadtgold, abgeschlossene Wochenenden; fehlende Beobachtungen getrennt. Nicht automatisch sechs Angriffe verlangen.
- Clanspiele: Differenz von Games Champion zwischen zeitnahen Snapshots, accountweit; nicht mit direktem clanbezogenem Eventscore verwechseln. Keine Rekonstruktion fehlender Startwerte.
- Optionale weitere Kriterien: normale Heimatdorf-Angriffe, Sterne, aktive Tage, Beute-/Upgrade-Fortschritt erst nach Feld- und Abdeckungsprüfung. Keine wirtschaftliche Bevorzugung von Echtgeldkäufen.

## Manuelle Mitgliedsmerkmale
Clanprivat und über Player-Tag gebunden. Discord-Mitgliedschaft: ja/nein/unbekannt, dauerhaft. Reaktion/Abstimmung: ja/nein/unbekannt je benanntem Event, nicht als globale Markierung. Owner kann markieren/filtern; spätere Mehrfachauswahl. Nicht durch CWL-Saisonreset entfernen. Mehrfachaccounts explizit gruppieren (keine Identitätsableitung aus Namen). Keine automatische Discord-Abfrage ohne passende Verbindung/Einwilligung.

## Auswertungsregel
Einzelne Mindestanforderungen separat aktivierbar, AND als erster Modus. Vollständig beobachtet: erfüllt/nicht erfüllt; bestätigte Untergrenze >= Schwelle: erfüllt; sonst unbekannt, nicht automatisch ausgeschlossen. Unvollständige Prozentwerte grundsätzlich unbekannt. Veranstalter oder bewusst manuell ausgeschlossene Teilnehmer separat ausweisen. Ein Los je qualifiziertem Teilnehmer als erste Variante; alternative Gruppen/gewichtete Punkte optional in Folgepaket.

## Lieferumfang dieses PR
Pure JS-Normalisierung von Kampfprotokollen und Mindestanforderungen, Tests; keine Live-Abfragen, keine DB-Änderung, keine Mitgliedsmarkierungs-Oberfläche, keine persistente Kampagne oder Ziehung. Vor Live-Betrieb: read-only API-Probe, Collector-Budget und Speicherung, Mandantentrennung/RLS, Mitgliedsmerkmale, Kampagnen-UI und unveränderliche Ziehung, echte Staging-Abnahme.

## Quellen
- https://clashy.clashk.ing/en/stable/miscellaneous/changelog.html
- https://clashygo.clashk.ing/en/latest/api/clashy/
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/battlelog.md
- https://clashygo.clashk.ing/en/latest/api/raids/
