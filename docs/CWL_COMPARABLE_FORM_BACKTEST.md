# Chronologischer Modellvergleich – CWL-Spielerform (Forschungsstufe)

Stand: 05.11.2026. **Nur lokales Analysewerkzeug, keine Live-App-Funktion.**
Bezieht sich auf [Issue #88](https://github.com/Smolmig/cwl_planer/issues/88) und den späteren optionalen CWL-Experimentmodus [#44](https://github.com/Smolmig/cwl_planer/issues/44).

## Zweck

Vergleicht auf *späteren* gleich-RH-Angriffen die Basisansätze:

- `last7`: die letzten sieben bekannten vergangenen Angriffe des Spielers, ungeachtet des Gegner-RH (ähnlich der alten Kartenlogik).
- `recent30`: maximal 30 Tage alte Angriffe gegen dasselbe RH.
- `weighted90`: maximal 90 Tage alte Angriffe gegen dasselbe RH mit 30-Tage-Halbwertszeit.
- `cwl90`: gleich-RH-Angriffe aus CWL innerhalb von 90 Tagen als getrennte Kontrollgruppe.

Alle Ansätze bekommen denselben transparenten neutralen Laplace-Prior (50 % mit Gewicht 4), damit eine Probe von 1/1 nicht als sichere 100-%-Prognose missverstanden wird. Der neue konservative **performanceIndex** aus der Live-App ist ein *Ranking-Index*, keine kalibrierte Wahrscheinlichkeit, und wird deshalb **nicht** als Brier-Wahrscheinlichkeit missbraucht.

**Strenge Chronologie:** Für die Vorhersage eines Krieges dürfen nur andere Kriege verwendet werden, die *vor seinem Start* begonnen haben. Gleichzeitige Kriege stehen auf derselben Testseite. Unfertige API-Kriege werden ignoriert. Fehlende RH-Werte sind kein gleichwertiger Zielangriff.

## Nutzung

Benötigt einen **privaten, lokal vorhandenen und überprüften** JSON-Export mit den bestehenden `wars`- und `attacks`-Arrays aus der Statistik, beispielsweise:

```json
{
  "wars": [{"war_key":"demo1","war_type":"normal","source":"import","started_at":"2026-09-01T10:00:00Z"}],
  "attacks": [{"war_key":"demo1","attacker_tag":"#2PYL","attacker_th":18,"defender_th":18,"stars":3}]
}
```

```bash
node scripts/backtest-comparable-form.mjs /pfad/zum/privaten-export.json
node --test tests/cwl-comparable-backtest.test.cjs
```

**Keine echten Clan-Exporte in GitHub hochladen.** Das Skript verändert den Export nicht und schreibt keine Datenbankdaten. Ausgegeben werden nur aggregierte Kennzahlen.

## Kennzahlen interpretieren

- `eligibleEqualThAttacks`: spätere Angriffe mit gesichert gleichem RH.
- `untrainedAttacks`: davon ohne irgendwelche verwertbaren Vorinformationen.
- `independent`: Abdeckung und Brier-/Log-Loss je Ansatz auf seiner jeweiligen Datenmenge. Diese Werte **nicht direkt gegeneinander** als Sieg/Niederlage vergleichen.
- `commonSample`: **dieselben späteren Angriffe** für Last-7, 30-Tage- und 90-Tage-Modell; nur diese Scores sind ein fairer direkter Vergleich.
- `commonSampleSize`: wichtige Stichprobengröße. Kleine Samples und fehlende Kriege erlauben keine robusten Aussagen.

Brier kleiner = bessere mittlere quadratische Abweichung, Log-Loss kleiner = bessere Vorhersage in diesem historischen Test. Kalibrierung über Zeit, mehrere Clans, RH- und Meta-Wechsel und Unsicherheit müssen zusätzlich geprüft werden.

## Erste read-only Auswertung: United Fighters, 05.11.2026

Eine separate aggregierte Gegenprüfung auf dem vorhandenen Supabase-Statistikbestand (ohne Datenänderung) lieferte **52 Kriege, 1.187 Angriffe**, davon 1.004 spätere Angriffe gegen dasselbe RH. Bei 41 davon lagen keine historischen Vergleichswerte vor. Die drei Hauptmodelle konnten für **951 exakt gleiche Testangriffe** ausgewertet werden.

| Modell | Brier (951 identische Testangriffe) | Log-Loss |
| --- | ---: | ---: |
| Last 7 | 0,1990 | 0,5864 |
| 30 Tage, gleiches RH | 0,1963 | 0,5801 |
| 90 Tage, gleiches RH, zeitgewichtet | **0,1943** | **0,5751** |

Für die **279 CWL-Angriffe** innerhalb derselben gemeinsamen Testauswahl lauten die Brier-Werte 0,1950 / 0,1894 / **0,1848**. Der Effekt ist im historischen Sample klein, und die Testangriffe sind nach Spieler/Krieg korreliert. **Das ist keine statistische Signifikanz, keine kalibrierte Erfolgswahrscheinlichkeit und keine automatische Spieler-Rangfolge.** Weitere zeitgetrennte Testperioden, Konfidenzprüfung und Datenvalidierung stehen noch aus. Auch dieses Ergebnis darf nicht zur stillen Anpassung des Live-CWL-Solvers verwendet werden.

## Bekannte Grenzen & nächste Schritte

- Gleiche Rathausstufe heißt **nicht** gleich schwere Base. Mirror, Cleanup/First-Hit, Angriffszeitpunkt und historischen Map-Kontext kennen wir nicht sicher.
- Datenquellen können unvollständig sein; doppelte oder fehlerhafte Zeilen müssen **vorher** geprüft werden. Dieses Skript ist kein Import-Cleaner.
- Wegen unvollständiger alter CWL-Logs sind Aussagen über *Zuverlässigkeit* separat und nur auf vollständige Kriege zu stützen.
- Ein einzelner Clan, kleine historische Samples und wechselnde Metas können zu instabilen Ergebnissen führen.
- Vor jeder UI-Ranglisten- oder Auto-Rotationsentscheidung: Originaldaten validieren, echten Export lokal testen, Ergebnisse gegen weitere historische Zeitfenster prüfen, Modellgewichte nicht am Testsatz optimieren.
