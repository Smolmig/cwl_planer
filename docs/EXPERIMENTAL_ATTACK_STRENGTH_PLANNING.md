# Experiment: CWL-Einteilung mit echten Angriffsdaten

**Status:** Konzept (nicht produktiv aktivieren) · 03.11.2026

## Zusatz: Fairness nach 8-Sterne-Medailenziel (05.11.2026)

Ziel ist die Wahrscheinlichkeit zu erhöhen, dass **möglichst viele angemeldete Spieler mindestens acht eigene Kriegssterne erreichen**. Das betrifft den regulären Ligamedaillenanteil, **nicht** den gesonderten Anführerbonus. Ein Spieler mit bereits acht sicheren Sternen kann eher einen künftigen optionalen Einsatz abgeben als jemand, der bei sechs Sternen und wenig Zukunftskapazität noch eine zusätzliche Chance benötigt.

**Produktive Basis ab v1.15.0:** reine Lese-Übersicht zu nachgewiesenen Sternen, geplanten Restangriffen und mathematisch maximal erreichbarem Sternenziel. Unverbindliche Wechselidee nur bei gesicherter Datenlage und ohne Verletzung offensichtlicher fester Regeln. Keine Änderung an Solver, Plänen oder Rollen.

**Nächste experimentelle Stufe (noch nicht aktiviert):**
1. Statistiken mit belastbarer Stichprobe und Gegner-RH auf die *Chance*, weitere Sterne zu erzielen, prüfen. Zwei Zweisterne-Angriffe erlauben keine präzise Aussage über den dritten; Datenqualität/Verfügbarkeit sichtbar machen.
2. Eigene Angriffe mit gleicher oder höherer Rathausstufe getrennt von leichteren Gegnern betrachten; konservativ glätten und fehlende Daten neutral behandeln.
3. Alternativpläne anhand Anzahl Spieler mit voraussichtlich 8★, Fairness-Spanne, Clan-Kampfstärke und geänderter Tage vergleichen. Immer zuerst harte Vorgaben erfüllen.
4. Keine automatischen Änderungen; Rollen und Planfreigaben weiter beachten. Für den Übergang von reiner Anzeige zu Simulation/Übernahme braucht es Backtests über mehrere vollständige CWL-Saisons.

## Ausgangspunkt
Der bisherige Planer verteilt verfügbare Spieler anhand von Fix/MUSS/RAUS, Einsatzzielen, Anzahl bisheriger Einsätze und Priorität. Er kennt letzte 7 Angriffe, 3★-Hit-Rate und Ø Sterne. Eine rohe Sortierung nach Hit-Rate wäre bei wenigen Angriffen irreführend und könnte die Fairness verschlechtern.

## Datenqualität vor jeder Empfehlung
- Nur erfasste Einzelangriffe aus normalen CWs und CWL verwenden. Quelle (API oder historischer Import) und Anzahl nennen. Doppelte Treffer anhand war_key + attacker_tag + attack_order verhindern.
- Bis zu sieben Angriffe sind **für die Anzeige** okay, für eine Stärkebewertung aber wenig. Optional 20–30 Angriffe / Trend als experimentelles Fenster gegentesten.
- Hit-Rate = 3★-Angriffe / ausgeführte Angriffe; Ø Sterne = Sternsumme / ausgeführte Angriffe. Nicht ausgeführte Angriffe getrennt als Zuverlässigkeit betrachten (nur bei vollständigen Logs).
- Kontext: eigenes RH, Verteidiger-RH, CW/CWL, kleine Stichproben, Datumsalter. Dreier gegen niedrigeres RH nicht wie Dreier gegen gleiches oder höheres RH gewichten.
- Keine Statistik: subjektive Einschätzung oder Neutralwert ausdrücklich als Fallback markieren, nie als echte 3★-Quote ausgeben.
- Unter vier Angriffen keine individuelle datenbasierte Empfehlung. Bei vier bis sieben nur niedrige Konfidenz.

## Bewertungsmodell für eine Simulation
1. Rohwerte bleiben getrennt sichtbar: 3★-Rate, Ø Sterne, Angriffszahl, Gegner-RH, Rate gegen gleiches/höheres RH.
2. Rohe Hit-Rate mit einem Prior (z. B. Beta(2,2)) glätten: p_3star = (dreier + 2) / (angriffe + 4). So erscheinen ein Dreier aus einem Angriff nicht als sichere 100 %.
3. Normierter Sterneschnitt = avg_stars/3. Versuchsgewichtung: 0,55 × p_3star + 0,45 × Sterneschnitt. Die Gewichte werden validiert, nicht als objektive Stärke präsentiert.
4. Konfidenz anhand der Samplegröße einschätzen, optional zum Clanschnitt zurückziehen. Stärke bleibt **weich**, hinter Fix/MUSS/RAUS, gespielten Tagen und Einsatzzielen.
5. Zwei Strategien vergleichen: **Ausgeglichen** verteilt Stärke über die Woche. **Gegnerorientiert** nutzt zuverlässige Gegner-RH-/Kriegstagsdaten, wenn vorhanden.
6. Nach der bestehenden Greedy-Verteilung optional lokal zwei Spieler zwischen Tagen tauschen, ohne harte Regeln, Ziele oder gespielte Tage zu verletzen.

## Vorgeschlagene Oberfläche
- Später in „Mehr → CWL-Regeln“ Schalter „Experimentelle Stärkeverteilung testen“, **standardmäßig aus**.
- Vor Anwenden: „Aktueller Plan“ gegen „Stärkevorschlag“, Veränderungen je Spieler/Tag, Fairness-Spanne, Ziele, Rathaus-Mix und Konfidenz erläutern.
- Nichts automatisch überschreiben. Clanführer bestätigt; Vize kann bei freigegebenem Plan nur einen Vorschlag einreichen.
- Kein Rückschreiben des experimentellen Scores in tatsächliche Statistiken.
- Mobile Vorschau als umschaltbare Karte statt parallelen Tabellen.

## Testkriterien vor Veröffentlichung
- Fix/MUSS/RAUS, Einsatzziel 2–4, fast volle Mannschaft, 0–7 gespielte Tage, unvereinbare Vorgaben, Spieler mit 0–3 Angriffen.
- Backtest auf vollständig erfassten alten CWLs: Fairness, Tagesstärke, Regelverstöße; ohne unbegründete Siegprognosen.
- Import-/API-Dubletten, ältere oder abweichende RH-Level, Gegner mit niedrigerem RH.
- Vorschau ist lokal und schreibfrei; keine zusätzlichen Supabase-Änderungen.

**Entscheidung:** Der heutige faire Planer bleibt Standard. Datenbasierte Stärke ist zunächst eine transparente, abschaltbare Experiment-Option.
