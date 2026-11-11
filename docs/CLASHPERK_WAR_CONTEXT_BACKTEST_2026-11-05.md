# ClashPerk-Kontext-Backtest: Mirror, Angriffsziel und 30/90-Tage-Form

**Stand:** 05.11.2026 · **Status: reine Forschung**, kein Produktiv-Score, keine automatischen CWL-Rotationen, **keine Datenbankänderung**.

Verknüpft: [#88 Spielerbewertung](https://github.com/Smolmig/cwl_planer/issues/88), [#44 experimentelle Rotation](https://github.com/Smolmig/cwl_planer/issues/44) und [PR #92 Baseline-Backtest](https://github.com/Smolmig/cwl_planer/pull/92).

## Privat eingelesene Quelldaten

Vom Nutzer zur Verfügung gestellter ClashPerk-Export `Geronimo [Attack Log] 3.xlsx`. Analysiert **ausschließlich im privaten lokalen Arbeitskontext**; die Original-XLSX, Spielernamen und Player-Tags sind **nicht Teil dieses PRs**. `Attack Log 4` ist im größeren Export enthalten.

- Original: 4.333 Exportzeilen von beiden Teams; nach exakt übereinstimmenden Angriffsdubletten 4.125 verschiedene Ereignisse (208 entfernt). Oktober-CWL-Duplikate werden korrekt erkannt.
- Eigene Angriffe: 2.134 einschließlich neuerer Runden; für den Backtest bewusster historischer Cutoff **04.11.2026**.
- Bis einschließlich 04.11.2026: **98 Kriege, 2.117 eindeutige eigene Angriffe**, davon **1.773 gegen dieselbe Rathausstufe** (1.194 normale CWs, 579 CWL). Die beiden noch jüngeren Runden vom 05./06.11. sind absichtlich ausgeschlossen; die am 06.11. noch unvollständige Runde darf keine Bewertung beeinflussen.
- Große Zusatzinformationen: eigene und gegnerische Map-Position, Angreifer-/Ziel-RH, `Stars`, `New Stars`, Angriffsfolge, War-ID, Kriegsdatum. `New Stars < Stars` ist ein **Hinweis auf bereits auf der Basis erreichte Sterne, kein direkter Beleg, wer zuvor angegriffen hat**.
- Einschränkung: Angriffe/Spieler sind abhängig, Gegner-Basisausbau und exakte Truppenstrategie fehlen, Tracking ist nicht gleich Zufallsstichprobe.

**Offizieller Sonderfall – zweite Juni-CWL 2026:** Der ClashPerk-Export zeigt **04.–10.06.** und **19.–25.06.2026** als jeweils sieben 15v15-CWL-Kriege. Das ist **korrekt und kein Exportfehler**: Supercell kündigte für Juni 2026 ausdrücklich eine zweite Bonus-CWL ab **15. Juni** im Football-Fury-Event an; auch das traditionelle 15v15/30v30-Format war neben 11v11 möglich. Der Clanführer hat den besonderen zweiten CWL-Durchgang bestätigt (zeitlich als Juli erinnert; die Kriegsdaten selbst liegen im Juni). Die folgenden Analysen **enthalten grundsätzlich beide echten Juni-CWLs**. Der zusätzliche Ausschlusstest dient nur dazu, sicherzustellen, dass der außergewöhnliche Eventkalender das Ergebnis nicht allein erklärt. [Offizielle Supercell-Ankündigung](https://supercell.com/en/games/clashofclans/blog/news/anime-fury-returns-season-2-hits-different).

## Methode: ausschließlich chronologische Vorhersagen

- Jede Prognose für den jeweiligen Kriegstag beruht ausschließlich auf Angriffsereignissen **früherer Kalendertage**. Keine aktuellen War-Angriffe im Training, keine Zukunftsdaten oder Cross-War-Leakage desselben Tages.
- Bewertet werden später erfolgte **gleich-RH-Angriffe**, Ergebnis `3 Sterne` ja/nein. Keine Fake-0-Sterne für verpasste Angriffe.
- Alle Varianten werden auf exakt denselben späteren Angriffen verglichen; unabhängig unterschiedliche Anzahl von Vorhersagen **nicht** direkt gegeneinander halten.
- Brier-Fehler (kleiner besser), zusätzlich Log-Loss; alle Varianten erhalten eine vorsichtige 50-%-Prior mit vier Gewichtseinheiten (experimentell, nicht offiziell kalibriert). Zeitgewichtete 90 Tage: 30-Tage-Halbwertszeit, Kish-effektive Stichprobe.
- Exploratives 95-%-Intervall für die **Differenz** der Brier-Fehler: Resampling ganzer Kriege, nicht fälschlich einzelne Angriffe unabhängig ziehen. Kein verlässlicher Signifikanznachweis für neue Varianten, die anhand derselben Daten entworfen wurden.

### Baseline gegen letzten-7-Rohwert: identische 1.697 Folgeangriffe

| Modell | Brier (↓ besser) | Log-Loss (↓) |
| --- | ---: | ---: |
| Letzte 7 beliebige Angriffe (gesmoothed) | **0,2003** | 0,5888 |
| 90 Tage, gleiches RH, zeitgewichtet | **0,1942** | 0,5746 |

Brier-Verbesserung um **0,00615** (exploratives Kriegs-Cluster-Bootstrap-Intervall **+0,00155 bis +0,01058**). Eine reale, bessere Rückschau – jedoch **noch keine belastbare Live-Spielerstärke-Prognose**.

### Neue Kontextvarianten: jeweils paarig zur 90-Tage-Baseline

| Variante | Paarige spätere Angriffe | Standard 90 T Brier | Variante Brier | Bewertung |
| --- | ---: | ---: | ---: | --- |
| Nur aktuelle 30 Tage, gleich-RH | 1.681 | 0,1940 | 0,1967 | Schlechter |
| Gleiche eigene RH-Stufe wie beim Testangriff | 1.688 | 0,1945 | 0,1946 | Praktisch gleich |
| Nur exakte Mirror-Position | 1.667 | 0,1951 | 0,1993 | Schlechter |
| Nur Angriffe mit `New Stars = Stars` | 1.679 | 0,1937 | 0,1975 | Schlechter; Indikator ist kein sicherer First-Hit-Nachweis |
| Map-Distanz & bestehende Sterne nachgewichtet | 1.697 | 0,1942 | 0,1943 | Praktisch gleich |
| CWL-Angriffe stärker gewichtet | 1.697 | 0,1942 | 0,1942 | Praktisch gleich |
| Historische Clan-RH-Quote als Vorwissen | 1.697 | 0,1942 | 0,1955 | Eher schlechter |

**Wichtig:** Mirror ist eine Map-Position, **kein universelles Härtesiegel**. In normalen CWs sind Zielwahl und vorhandene Sterne systematisch verschieden; ausschließlich Mirror zu nehmen kostet nützliche Fälle und verschlechtert hier die spätere Vorhersage.

### CWL-spezifische Teilstichprobe

Auf denselben **577 späteren gleich-RH-CWL-Angriffen** mit beiden Vorhersagen:
- letzte 7 Angriffe: **Brier 0,1954**;
- 90 Tage gleiches RH: **Brier 0,1854**;
- höhere Gewichtung alter CWL-Angriffe: **0,1840**, Verbesserung nur **0,00142**; das 95-%-Intervall der Verbesserung enthält 0. Kein Nachweis für den produktiven Wechsel.

### Sensitivität: offizielle Juni-Bonus-CWL versuchsweise ausschließen

Nach Entfernen von sieben `cwl`-Kriegstagen 19.–25.06.2026 aus Training **und** Test:
- **91 Kriege, 2.012 Angriffe, 1.682 gleiche-RH-Angriffe**.
- Identische **1.605** später auswertbare Folgeangriffe: letzte 7 **0,1999** gegenüber 90 Tage gleiches RH **0,1933**. Verbesserung **0,00658**, Bootstrap-Intervall **+0,00230 bis +0,01118**.
- Nur Mirror: 0,1988 versus Standard 0,1943 (auf denselben 1.574 Fällen); Map-/CWL-Gewichtung bringen auf 1.605 Fällen weiterhin keinen gesicherten Vorteil.

Diese zusätzliche Probe ist kein unabhängig vorab festgelegter Holdout. Sie zeigt, dass das Kernergebnis **auch ohne die echte Sonder-CWL** erhalten bleibt; daraus folgt ausdrücklich **nicht**, dass die Bonus-CWL als fehlerhaft zu entfernen wäre.

## Produktentscheidung aus dieser Runde

1. **Produktive Statistik bleibt bei v1.15.5**, echte Angriffsquoten und transparente Stichproben wie zuletzt eingeführt. Der 0–100-Index bleibt ohne kalibrierte Spieler-Wahrscheinlichkeit. **Kein ungetesteter Score- oder Solver-Change.**
2. Mirror, Map-Distanz und `New Stars` sind **wertvolle Zusatzinformationen zum Einordnen und Erklären einzelner Angriffe**, aber aktuell **keine nachgewiesene Verbesserung für automatische Gewichtungen**. Besonders 0–3 Sterne/Mehrsterne und Cleanup nicht verwechseln.
3. Bei zukünftiger produktiver Erweiterung: optionale, klar belegte **Einzelangriffsdetails** (Ziel-RH, Map-Position, zusätzliche Sterne) nur mit korrekter Provenienz und Datenverfügbarkeit; historische DB enthält Map-Felder aktuell nicht. Eine Migration braucht gesonderte Prüfung.
4. **Nächster echter Abnahmetest:** zeitlich abgegrenzter, vorher festgelegter Holdout über weitere neue CWL-Tage oder andere Clans, plus Auswertung nach RH-Wechsel und Gegnerstärke. Vorher Gewichte nicht weiter an dieser Stichprobe optimieren.
5. **Juni-Sonder-CWL korrekt führen:** Beide Juni-CWL-Blöcke gehören zum offiziellen Spielgeschehen. Den zweiten im historischen Vergleich optional als **Bonus-CWL Juni 2026** kennzeichnen, statt ihn als Exportfehler oder reguläre Juli-Saison umzuetikettieren. Bei der Auswertung darf er als echter CWL-Angriff zählen; saisonbezogene Statistiken müssen mehrere CWL-Durchgänge in einem Kalendermonat getrennt halten.

## Reproduzierbarkeit (privat, ohne GitHub-Playerdaten)

`scripts/backtest-war-context.mjs` nimmt eine **privat normalisierte JSON-Datei** mit Angriffseinzelzeilen (siehe JSDoc). JSON kann per lokalem Parser aus den ClashPerk-Original-XLSX erzeugt werden, aber **nicht veröffentlichen**. Script dedupliziert identische Angriffe, verwirft gegnerische Zeilen und Daten nach dem konfigurierten `asOf`-Stichtag, trainiert strikt auf früheren Tagen und gibt nur Aggregate aus.

```bash
node scripts/backtest-war-context.mjs /privat/pfad/clashperk-war-context.json
```

`tests/backtest-war-context.test.cjs` prüft mit künstlichen Spieler-Tags identische/kollidierende Duplikate, Zeittrennung, gleiches RH, Map-/Sterne-Kontext, paarigen Vergleich und deterministische Bootstrap-Intervalle.

## Quellen zum Fachmodell

- Supercell: [Week of Wars](https://support.supercell.com/clash-of-clans/en/articles/cwl-week-of-wars.html) – ein Angriff pro tatsächlichem CWL-Teilnehmer, Map-Position ist nach Verteidigungsstärke angeordnet.
- Supercell: [About CWL](https://support.supercell.com/clash-of-clans/en/articles/about-cwl-3.html) – monatliche CWL-Struktur und 15v15/30v30.
- Brier-Score-Methodik: https://pmc.ncbi.nlm.nih.gov/articles/PMC12818272/ – identische Teststichprobe, Unsicherheitsintervalle, keine vorschnellen Interpretationen.

**Wichtig:** Aggregierte Ergebnisse wurden ausschließlich aus privaten Exportdaten berechnet. Weder GitHub-Code noch Forschungsbericht enthalten Namen, Spieler-IDs, historische Listen oder ungeschützte Clan-Daten.
