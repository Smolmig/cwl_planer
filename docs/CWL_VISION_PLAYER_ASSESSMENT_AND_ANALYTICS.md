# CWL Planer – Spielerwert, Statistik-Labor und Planungsmodi (lebender Entwurf)

> **Stand 05.11.2026 · Konzept / Ideenspeicher, kein Feature-Release.**
> Dieses Dokument wächst mit unseren Gesprächen. Die unten vorgeschlagenen Kennzahlen, Begriffe und Algorithmen sind **nicht final**. **Die bestehende Planungslogik bleibt unverändert.**
> Verknüpfung: [#88 Spielerwert](https://github.com/Smolmig/cwl_planer/issues/88), [#96 Statistik-Tab](https://github.com/Smolmig/cwl_planer/issues/96), [#44 Planungsmodi](https://github.com/Smolmig/cwl_planer/issues/44), [#46 UX](https://github.com/Smolmig/cwl_planer/issues/46).

## Die drei bewusst getrennten Baustellen

| Ort | Job des Features | Relevanter Zeithorizont | Was es **nicht** ist |
| --- | --- | --- | --- |
| **Mitgliederliste: Spielerbewertung** | Auf einen Blick wissen: Wie gut und einsatzfähig ist der Spieler **jetzt** für eine bevorstehende CWL, wie sicher sind wir uns, wie zuverlässig greift er an? | **jüngste 7/14/30 Tage und die letzten relevanten Kriege** dominieren; 31–90 Tage als historisches Zusatzsignal | Kein Archiv-Dashboard, keine bloße Lifetime-Hitrate, kein unkalibrierter Pseudo-Score |
| **Statistiken: Clan-Analysezentrum** | Umfangreiche, interessant anzusehende und vergleichbare Fakten über Spieler, Gegner, Angriffe, Kriege, CWL-Saisons und Clanentwicklung; gern auch Spielstärke und historische Stärke als separater Vergleich | **frei wählbar**: letzte Kriege, 7/14/30/90 Tage, Saison, 180 Tage, alle tatsächlich vorhandenen Daten | Nicht nur eine Rangliste, nicht nur dieselbe Mitgliederkarte in groß |
| **Plan: Zielmodus und Gegnerstrategie** | In Zukunft aus den belegten Spielerinformationen gezielt sieben Tage zusammenstellen, mit verschiedenen Prioritäten | aktuelle Form + bekannte Gegner der **konkreten CWL-Tage** | **Heute keine Änderung an Solver, Aufstellungen, Fix-Flags oder Cloud-Daten** |

**Produktkommunikation:** Der Nutzer wünscht kurze, alltagstaugliche Zwischenstände und sichtbare Ergebnisse. GitHub-Strukturen, mathematische Prüfungen und Code sind Aufgabe des Assistenten; nicht ungefragt damit überfrachten. Gute kreative Vorschläge zeigen und diskutieren, aber keinen finalen Entwurf vorschnell als beschlossen behandeln.

## A. Mitgliederliste – ehrlicher aktueller Spielerwert

### Zielgefühl
Ein kurzer verständlicher Indikator wie „Aktuelle Stärke: sehr gut / gut / mittel / unsicher“ oder ein später validierter Wert; daneben „Form steigend / stabil / fallend / unklar“ und **„Zuverlässigkeit“ getrennt**. Diese Labels sind **Designmöglichkeiten**, noch keine formelbasierte Implementierung.

**Kernkonflikt des Nutzers:** Spieler A machte vor 31–90 Tagen fast nur Dreier, spielt aber seit 30 Tagen schlecht. Spieler B ist aktuell stark. Bei ansonsten vergleichbaren Gegnern muss B **für die nächste CWL** höher stehen können als A. Ein gleichmäßig gewichteter 90-Tage-Wert reicht nicht; sogar ein 90-Tage-Abklingmodell muss im kurzen Fenster auf *Trendbruch* und Metaänderung geprüft werden.

### Faktoren und reale Grenzen
- **Primär:** ausgeführte Angriffe, Sterne 0/1/2/3, Ø Sterne, 3★-Quote, **Zeitpunkt**, Anzahl der Fälle, eigenes Rathaus **zum Angriff**, Ziel-RH, Gegnerstärke, CW/CWL und Kriegsbedingungen.
- **Kontext:** Angreifer-/Zielposition, Mirror / höheres / tieferes Ziel auf der Kriegsmap, wirklich erste Attacke oder Cleanup, zusätzliche neu gewonnene Sterne. Map-Position ist kein absoluter Base-Stärkewert, `New Stars = Stars` beweist nicht automatisch den First Hit.
- **Prognose der nächsten CWL:** zuletzt 7/14/30 Tage in mehreren Varianten **gegen 90 Tage historisch backtesten**. Bei starkem Leistungsbruch das aktuelle Signal priorisieren, aber nicht nach ein bis zwei schlechten Angriffen künstlich jemanden „abstürzen“ lassen; Unsicherheit direkt benennen.
- **Meta-/Patch-Epochen:** Balance-Nerfs/Buffs, Angriffsmethoden, Spezial-Events, neuer RH-Stand/Equipment und eventuelle RH19+; nicht pauschal alle Spieler nach einem Patch gleich behandeln. Ohne belegte Armee/Meta kein erdachter Skillverlust.
- **Zuverlässigkeit:** Nichtnutzung eines **nachweisbar möglichen** Angriffs / tatsächlich mögliche Angriffe in abgeschlossenen, vollständig erfassten Kriegen. Nicht aufgestellter CWL-Spieler = kein Missed. Missed separat, nicht als 0-Sterne-„Leistung“.
- **Profil/Erfahrung als Ergänzung:** lifetime Kriegssterne, Ranked-Liga (z. B. Legend II), Trophy/Ranked-Verlauf, RH-/Helden-/Equipment-/Truppenstände, Aktivität. **Geringerer Einfluss als nachgewiesene, aktuelle CWL-/CW-Angriffe.** Legend II ist ein Indiz und kein Beweis eines starken CWL-Angriffs; Inaktivität kann League-Status verzerren.
- **Cold Start:** Neuer Spieler ohne Historie bekommt einen neutralen, als unsicher gekennzeichneten Vergleich, nicht eine erfundene Quote. Historie aus vorherigem Clan nur sauber über **Player-Tag** zuordnen.
- **Daten:** Supercell-API + bereits erfasste Statistiken + freiwillig bereitgestellte ClashPerk-Exporte. Speichern von Map-Position/Ranked/Profilhistorie ggf. später additiv und erst nach Privatsphäre-/RLS- und API-Prüfung. Kein blindes Scraping.

**Erst später testbare technische Optionen:** Kurzfristiger Sternvektor 0/1/2/3, Bayes-Glättung, Drift-/Change-Point-Erkennung, 7/14/21/30-Tage-Halbwertszeiten und aktuelle vs. historische Stärkenkomponente; gruppierte Unsicherheitsintervalle. Solche Modelle dürfen keine „garantierte Chance“ behaupten und sind vor produktiver Anwendung chronologisch auf **späteren** Kriegen zu testen.

## B. Statistik-Tab – ein richtiges Clan-Labor

**Besonders geliebtes Vorbild aus unserem Chat:** Die **Vergleichstabelle der 3★-Quoten nach Gegner-RH-Klasse**, getrennt nach CW und CWL, war ausdrücklich eines der interessantesten Ergebnisse. Genau solche Entdeckungen sollen künftig **in der App selbst** jederzeit möglich sein. Nicht nur „Spieler X: 72 %“.

### Vorläufige Analysebereiche – nicht alles auf einen Bildschirm stopfen

1. **Überblick:** CW/CWL insgesamt, Angriffe, 0★/1★/2★/3★ als Verteilung, Ø Sterne, % Dreier, Angriffe tatsächlich verwendet, vollständige Missed-Abdeckung, Datenspanne. Kleine Trendhinweise.
2. **Gegner & Angriffsschwierigkeit:** Einfache *pivotartige* Tabelle: Zeilen **niedrigeres RH / gleiches RH / höheres RH** (optional konkretes RH), Spalten **normaler CW / CWL / Gesamt**, Kennzahl umstellbar 3★-Quote / Ø Sterne / Anzahl Angriffe / Zerstörung. **Jede Prozentzahl mit n**. Sonder-CWL, gleiche Spielerzahl, Map-Positionen/Mirror/Dip, Zielstärke später nur bei Daten.
3. **Trends & Zeitreise:** Wie veränderten sich Clan- und Spieler-Hitrates, RH-Klassen, Sternverteilungen, Misses, CWL-Erfolge über Wochen/Monate/Saisons? Auch Vor-/Nach-Metaänderungen, falls belegt. Visualisierung als Linie mit klaren Datenlücken.
4. **Spielervergleich:** Mehrere Clanmitglieder nebeneinander, **gleiche Filter und vergleichbare Angriffsschwierigkeit**, kurzfristiger Verlauf vs. langfristiger Vergleich, Zuverlässigkeit als eigene Kennzahl. Auf Wunsch aktuelle Mitglieder-Spielstärke **zusätzlich** – aber die Analyse ist unabhängig vom Score.
5. **CWL- & Kriegsarchiv:** Saison für Saison, ggf. Vergleich besonderer Saisons; Kriegsgegner, Tages-RH-Verteilung, eigene/generische Angriffe, wirklich eingeplante 15/30, Wechsel und Starverteilung. Beide echten Juni-2026-CWL-Durchgänge sauber getrennt behandeln.
6. **Tiefer eintauchen:** Clan → Spieler → Krieg → Einzelangriff; Filter nach Zeitraum, Kriegstyp, Spieler, RH, Ziel-RH, RH-Differenz, Sieg/Niederlage, Gegner, Map/First-Hit nur soweit belegbar. CSV-/Excel-Export zu einem späteren Zeitpunkt prüfen.

### Beispiel: genau die Art Statistik, die wir ausbauen wollen

Die konkrete **RH-Klasse × Kriegstyp**-Tabelle soll als wiederkehrender Analysebaustein dienen – **keine** künstlichen Zahlen in diesem Entwurf:

| Filtergruppe | 3★-Quote | Angriffe | Ø Sterne |
| --- | ---: | ---: | ---: |
| CW gegen **niedrigeres** RH | – | – | – |
| CW gegen **gleiches** RH | – | – | – |
| CW gegen **höheres** RH | – | – | – |
| CWL gegen **niedrigeres** RH | – | – | – |
| CWL gegen **gleiches** RH | – | – | – |
| CWL gegen **höheres** RH | – | – | – |

Dieser Aufbau kann später nach *Spieler, Clan, RH-Stufe, Zeitraum, Saison, Gegner oder Map-Position* gefiltert und als gruppiertes Balkendiagramm gezeigt werden. Leere Gruppen müssen „keine Daten“ ausgeben, niemals irreführend 0 %.

### Darstellungsideen

- **Standardeinstellung sofort verständlich.** Zunächst Überblick plus ein bis zwei schöne, aussagekräftige Vergleiche. Nicht 30 Regler, sieben Kartenstapel oder eine endlose Tabelle am Handy.
- **Tabelle ↔ Diagramm** für denselben Auswertungssatz, wenn der Diagrammtyp sinnvoll ist: gruppierte Balken für RH/CW/CWL-Vergleiche, Linien für Zeitverläufe, gestapelte Balken für Sternverteilungen. Keine Tortendiagramme nur der Optik wegen.
- Tippen auf Tabellenzelle oder Balken öffnet die **relevanten Spieler/Kriege/Angriffe** (Drill-down), mit Zurücknavigation und beibehaltenen Filtern/Scroll. Viele Fälle als sortier-/filterbare Tabelle; iPhone ebenso gut lesbar wie Desktop.
- **Zeitfilter** (z. B. 7/30/90 Tage, drei CWLs, alle), **Kriegstyp**, RH-Kontext und Spieler zentral; zusätzliche Dimensionen über „Weitere Filter“. Aktive Filter immer sichtbar und einfach zurücksetzbar.
- Fakten sind Fakten, Modellwerte sind Schätzungen. **Quellabdeckung und Stichprobengröße direkt am Ergebnis**, bei dünner/fehlender Datengrundlage sichtbar. ONS empfiehlt Unsicherheitsbänder genau dann, wenn sie die Interpretation ändern, nicht überall als Lärm.
- Bei Clanvergleichen auf gleiche Kriegs- und Spielerbasis achten (keine 2/2-Hitrate über 50/70 stellen), Vergleichbarkeit der Gegner ausweisen.

### Marktrecherche als Inspiration, nicht als fremde Scoreformel

- [ClashSync](https://clashsync.com/clash-of-clans-player-analytics) bietet u. a. star usage / Misses / Reliabilität und Zeiträume.
- [Clanalyze](https://clanalyze.com/) zeigt CWL-Rückblicke, Kriege, Sterne, Zerstörung, individuelle/Clan-Benchmarks und Stärke-Indizes.
- [Warkeep](https://warkeep.com/) fokussiert Langzeithistorie, Spielerentwicklung und Clantrends.
- [War Report](https://warreport.app/about/docs/features/clan_war_league/) führt Tagesaufstellungen, Gruppenstände und historische CWL-Saisonleistungen.
- [NN/g](https://www.nngroup.com/articles/data-tables/): Finden, Filtern und direkte Vergleiche sind zentrale Daten-Tabellenaufgaben; gut sichtbare Filter und Spalten sind essenziell.
- [ONS](https://service-manual.ons.gov.uk/data-visualisation/guidance/showing-uncertainty-in-charts): Unsicherheit klar vermitteln, kleine Fallzahlen nicht überdehnen.

## C. Planung – drei **Zielrichtungen**, keine aktuelle Umsetzung

- **Fair**: bekannte faire Rotation, viele Einsatzchancen, möglichst vielen 8★ ermöglichen; **trotzdem** stärkere passende Angreifer auf schwierigere Gegner/Tage setzen, soweit die Fairness es erlaubt.
- **Strategisch** (Arbeitstitel): Team- und Gegnerstärke je Tag wichtiger, voraussichtlich stärkere Gegner mit besseren Leuten abdecken; Rotation/8★ nicht vergessen, aber nachrangig.
- **Wettkampf** (Arbeitstitel): möglichst beste Kader an jedem möglichen Tag, wenig Rotation, vom **Simulator** vorgeschlagene Stammspieler. Erst nach bewusster Zustimmung übernehmen; nicht heimlich `fixed`-Flags verändern.
- Jeder Modus: **bereits gespielte/begonnene/gesperrte Tage, MUSS/RAUS, Verfügbarkeit, tatsächlich manuell fixierte Spieler, ausdrücklich gesetzte Einsatzziele** bleiben verbindlich. Wettkampf darf die Vorgaben nicht einfach ignorieren; falls andere Ziele sinnvoll sind, expliziter, verständlicher Änderungsvorschlag.
- **Keine Live-Implementierung, kein Solver-Tuning, kein Modus-Button in der App, kein automatischer Cloud-Write** in dieser Runde. Erst gemeinsam Konzept und verlässliche Datenlage schärfen. Danach schreibfreie Vergleichs-Simulation.

## D. Phasen und Entscheidungsfragen

**Phase 0 jetzt – sammeln, trennen, untersuchen:** Nutzerideen unter diesen drei Schienen weiterführen; Datenverfügbarkeit und vorhandene Mathe-Backtests inventarisieren. Kein Umbau.

**Phase 1 – Statistik-Tab aufwerten (späterer eigener Plan):** Zunächst die gut verständliche **RH-/CWL-Vergleichstabelle** mit möglichen Ansichten; n, gleiche Filter und echte Datengüte. Danach Zeitreihen und Spielerduelle. Benutzeroberfläche anhand konkreter Daten testen.

**Phase 2 – Spielerform-Modell validieren:** Szenario „vor 90 Tagen stark, 30 Tage schlecht“ und Meta-/RH-Wechsel gezielt an rückblickenden Daten prüfen; kurze/gewichtete Fenster vergleichen, Unsicherheitsregel. Erst nach belegtem Vorteil sichtbaren Spielerwert vorschlagen.

**Phase 3 – Gegnerorientierte Simulationsmodi:** Ohne Planänderung drei Vorschläge Fair / Strategisch / Wettkampf an echten vergangenen CWLs testen. Day-Assignments, 8★-Erreichbarkeit, Gegner-RH, Erklärbarkeit und Konflikte vergleichen. Freigabe/Akzeptanz durch Nutzer.

**Noch offen/absichtlich nicht festgelegt:** genaue Formeln, Zeitgewichte, Definition „stark“, Gestalt des Spielerwerts, Dashboard-Tab-Namen, Gegnerstärkeschätzung, automatische Fixrolle, Gewichtung Medaillen/Siege/Erze. Nicht mit unbelegten Zahlen zu früh festnageln.

## User-Feedback-Regel

Beim nächsten Nutzerimpuls zum Thema: Ideen **inhaltlich sinnvoll einer dieser drei Schienen zuordnen** und Widersprüche explizit prüfen. Nur die wichtigen Produktentscheidungen kurz in normalen Worten erklären. GitHub-Code/Backlog nicht dem Nutzer aufbürden. Grundentwurf iterativ schärfen, keine einseitige Vollimplementierung.

*Es gilt weiterhin „Zeige das Wichtige zuerst, gruppiere mit Abstand statt mit Kästen, und ändere niemals ungefragt das, womit jemand gerade arbeitet.“*


---

## E. Forschungsabgleich und nächster überprüfbarer Schritt (05.11.2026)

**Status: Konzeptfortschritt, nicht freigegebene Modell-/Produktimplementierung.** Die Erkenntnisse aus den offenen Drafts [#92](https://github.com/Smolmig/cwl_planer/pull/92) und [#95](https://github.com/Smolmig/cwl_planer/pull/95) sind hier bewusst in konkrete Forschungsfragen übersetzt. Originaldaten bleiben privat; das öffentliche Repository enthält nur Aggregate und synthetische Tests.

### E1. Was die Quellen *wirklich* hergeben

| Bestand / Quelle | Verifiziert | Einschränkung / Verwendung |
| --- | --- | --- |
| Bisheriger Live-Statistikbestand, dokumentierter Abgleich | 52 Kriege, 1.187 ausgeführte Angriffe, 43 historisch erfasste Player-Tags (nicht gleichzeitig aktive Mitglieder) | CW/CWL-/RH-Tabellen möglich; **nicht** mit überlappenden ClashPerk-Logs unbesehen addieren. |
| Größerer **privater** ClashPerk-Attack-Log | 4.333 rohe Zeilen beider Clans → 4.125 eindeutige Ereignisse nach 208 Duplikaten; bei Stichtag 04.11. 98 Kriege / 2.117 eindeutige eigene Angriffe / 1.773 gleich-RH-Angriffe | Bei Analyse eigenen Clan, War-ID, Player-Tag und Angriff eindeutig deduplizieren; historische Map-Position und *New Stars* vorhanden, aber Base-Ausbau/Armee und sicherer First-Hit fehlen. Nicht still produktiv importieren. |
| 21 historische CWL-Tage Aug–Okt 2026, [#90](https://github.com/Smolmig/cwl_planer/issues/90) **geschlossen** | Nutzerfreigegebener Metadaten-Backfill bereits durchgeführt: 21/21 abgeschlossene Tage, jeweils 15 belegte Teilnehmer, zusammen 313 Angriffe, 807 Sterne, 2 schon bekannte Misses; nur Roster-/Vollständigkeits-/Finalisierungsmetadaten aktualisiert | Ältere Textstellen in #88 oder \`docs/CLASHPERK_EXPORTS_AND_MISSED_COVERAGE.md\` mit „1/22 CWL vollständig“ beschreiben den **Stand vor dem Backfill**. Die zwei neueren November-API-Tage wurden **nicht** verändert; Vollständigkeit nicht allein aus Tagesabschluss oder alter Dokumentation folgern. Bei späterem Statistikdesign die aktuelle DB-Abdeckung erneut **read-only** kontrollieren. |
| Zwei Juni-CWL-Durchgänge 04.–10. und 19.–25.06.2026 | Beide als echte CWLs erkannt; zweiter Durchgang offizielle Bonus-CWL | Saisons über War-/Durchgangsidentität, **nicht** nur \`YYYY-MM\` identifizieren; optional separat anzeigen und in Sensitivitätsanalysen filtern. |

**Bisheriger Modellvergleich (explorativ):** Im umfassenderen ClashPerk-Backtest auf denselben 1.697 späteren Angriffen erreichten „letzte 7“ Brier **0,2003**, zeitgewichtete 90 Tage gegen gleiches RH **0,1942**. Nur Mirror **0,1993** statt 90-Tage-Baseline **0,1951** (jeweils dieselben 1.667 Fälle); Map-/New-Stars-/CWL-Gewichte brachten keinen abgesicherten Mehrwert. Ein aggregierter 90-Tage-Ansatz ist damit ein sinnvoller **Forschungs-Baselinekandidat**, aber **keine** bestätigte aktuelle Formbewertung und keine Freigabe für produktive Rotation. Erstangriff/Cleanup und gerushte Zielbases sind nicht zuverlässig kodiert.

### E2. Nächste Studie: *Echte Formeinbrüche erkennen*, ohne Alarm aus 1–2 Angriffen

**Vorab festzulegende Forschungsfrage:** Erkennt eine robuste Kurzfrist-Komponente nachweisbare aktuelle Leistungsverschlechterungen schneller als die reine 90-Tage-Baseline, **ohne** bei normalen Zufallsschwankungen zu viele falsche Formabstürze auszulösen?

1. **Baseline einfrieren:** 90 Tage, gleiches Gegner-RH, 30-Tage-Halbwertszeit, konsistente Glättung. Bestehende letzte-7-Variante bleibt Kontrollwert; keine anhand des Holdouts nachträglich gewählten Gewichtungen.
2. **Nur wenige Konkurrenten vorher definieren:** (a) 90-Tage-Baseline + vorsichtig zur Fallzahl geschrumpfte 14-/30-Tage-Abweichung; (b) 90-Tage-Baseline + zeitlich begrenzter Drift-/Regimewechsel-Hinweis; (c) reiner 30-Tage-Gleich-RH-Kandidat als Negativkontrolle. Vorab Fallzahl-/Trendbruchregeln und Schwellen als *Testparameter*, nicht als Produktentscheidung, dokumentieren.
3. **Kontexte schichten statt blind multiplizieren:** eigene RH-Stufe *zum Angriff*, Gegner-RH bzw. RH-Differenz, normaler CW vs. CWL, War-Datum, dokumentierte Meta-/Balance-Epoche. Mirror/Map und New Stars nur als **erklärende Subgruppen**, solange kein unabhängiger prädiktiver Mehrwert bewiesen ist. Ranked-Liga und Lifetime-Kriegssterne nur als separat getestete, schwache Cold-Start-Hinweise; Ranked wird auch von Verteidigung und Aktivität beeinflusst ([Supercell Ranked](https://support.supercell.com/clash-of-clans/en/articles/ranked-leagues-4.html)).
4. **Chronologischer Test:** Trainingsdaten ausschließlich aus **früheren abgeschlossenen Kriegstagen**; identischer Holdout für alle Varianten, aktuelle/unfertige War-Tage nicht einbeziehen. Zuerst rückwirkende bekannte Einbruchfälle mit vorab definierten Regeln untersuchen, dann neuere **noch unbenutzte** Saisons / andere Clans als unabhängigen Holdout reservieren. Nicht wiederholt am Holdout feintunen.
5. **Ausgabe und Gate:** auf identischen späteren Angriffen Brier, Log-Loss, Kalibrierung, Abdeckung, Gruppen nach CW/CWL und RH, Zahl **falscher Trendalarme**, Reaktionsverzug bei nachvollziehbaren Einbrüchen, Unsicherheit mit kriegs-/spielerbezogenen Clustern. Falls die Kurzfrist-Komponente nicht stabil gewinnt: Baseline behalten, „Form unklar“ statt erfundenem Abwärtspfeil. Bei wenig Daten keine erzwungene Platzierung.
6. **Zuverlässigkeit getrennt auswerten:** belegte nicht genutzte Angriffe ÷ belegte Angriffsmöglichkeiten (CWL: nur tatsächlich im Tageskader stehende Spieler; CW: tatsächliche Angriffsrechte), auf vollständigen abgeschlossenen Kriegen. Kein Missed als 0★, keine pauschale Saisonstrafe, keine automatische Pause nach verpasstem Angriff.

**Besonders wichtig:** Vergleichbarkeit bedeutet nicht „gleiches RH = gleich schwere Basis“. Eine RH-18-/18-Quote ist **beobachtet unter tatsächlich gewählten Zielen**; sie misst nicht, wie derselbe Spieler gegen eine zufällige oder beliebig starke RH-18-Basis abschneiden würde. Schon die Auswahl der Angriffspartner erzeugt Verzerrung.

### E3. Statistik-Tab: erste *konkret prüfbare* Konzeptausbaustufe

**Beispiel für den ersten sichtbaren Analyseweg:** Statistik → **Angriffe vergleichen** → gemeinsame Zeitspanne festlegen → Tabelle „Gegner-RH niedriger / gleich / höher“ × „CW / CWL“ → Wert **3★-Quote / Ø Sterne / n** umschalten → Zelle öffnen und belegte Einzelangriffe sehen. Dieselbe Filterung kann als gruppiertes Balkendiagramm dargestellt werden. In jeder Zelle: **n**, Zeitraum, Quelle; „keine Daten“ statt 0 %. CWL-Sonderdurchgänge separat an-/abwählbar.

Zunächst als eigenständige, nützliche Module **ohne** neuen Bewertungsscore:
- **Clanüberblick:** Angriffe 0/1/2/3★, Ø Sterne, dokumentierte Angriffsmöglichkeiten und bestätigte Misses, Abdeckung.
- **Gegner & RH:** CW/CWL × RH-Differenz; später konkrete RH-Stufen und Map-/New-Stars-Kontext, sofern vollständig belegbar.
- **Entwicklung:** Zeitreihe der 3★-Quote **mit n pro Punkt**, gleitenden Zeiträumen, RH-Mix und erkannter Datenlücke statt scheinbar glatter Linie; dokumentierte Update-/Meta-Marker nur mit Beleg.
- **Spielervergleich:** zwei oder mehr Spieler, dieselbe Datums-/CW-/CWL-/RH-Filterung, gleiche Fallzahl- und Unsicherheitsregeln, aktuelle Form und Zuverlässigkeit optional getrennt zuschaltbar.
- **Saisonarchiv:** CWL-Durchgang/War-Key, Gegner- und eigene Tagesaufstellungen nur aus belegten Snapshots; Juni-Bonus-CWL sauber separat; „in CWL angemeldet“ ist nicht „an Tag X aufgestellt“.

**UI-Prototyp ausschließlich als Konzept:** kompakter Standardüberblick + Segment „Vergleiche“ / „Verlauf“, Filterleiste mit **Zeitraum** und **Kriegstyp**, Rest unter „Weitere Filter“. Desktop kompakte Vergleichstabelle, Mobil zeilen-/spaltenoptimiert mit innerhalb der Tabelle horizontaler Navigation statt Seitenscroll. Drill-down bewahrt Filter, Auswahl, offene Bereiche und Scrollposition bei Auto-Refresh. Maximal eine übergeordnete Containerebene, wenige Trennlinien statt Kartenstapel. Datenqualität im Klartext („wenig Vergleichsangriffe“), Methodik optional in Details. Ergonomie und statistische Zurückhaltung an [NN/g Daten-Tabellen](https://www.nngroup.com/articles/data-tables/) und [ONS Unsicherheit](https://service-manual.ons.gov.uk/data-visualisation/guidance/showing-uncertainty-in-charts/) ausrichten.

**Abnahmebeispiele vor UI-Code:** 2/2 ≠ 40/60; RH18 gegen RH17 ≠ RH18; mehrere CWLs in einem Juni; 0 aus fehlender Messung ≠ belegte 0; ein Spieler ohne Kriegsaufstellung kann keinen CWL-Miss haben; CWL-Attacke mit 2★ bei zuvor 1★ ist kein garantierter Erstangriff.

### E4. Spätere Simulationsmodi: gemeinsame Grenze, unterschiedliches *Ziel*

| Modus (Arbeitstitel) | Was zuerst optimiert wird | Was sichtbar gegengeprüft werden muss |
| --- | --- | --- |
| **Fair** (bestehender Standard bleibt unangetastet) | Einsatzchancen, explizite Ziele, möglichst viele erreichbare **8★-Medailenziele**; Stärke situativ, nicht ignoriert | Rotation, verbleibende Chancen, reale bisherige Sterne, begrenzte Gegnerinformation |
| **Strategisch** | Tageskader mit passender eigener RH-/Angriffsstärke relativ zum **nachweisbaren** gegnerischen RH-Mix; Ressourcen für schwierige Tage reservieren | Fairnessabweichung, 8★-Chancen, Datenunsicherheit und warum ein Tauschtag sinnvoll sein *könnte* |
| **Wettkampf** | möglichst starke verfügbare Tageskader, tendenziell mehr Wiederholung guter Spieler | aktive manuelle Fix-/Einsatzziele bleiben verbindlich, automatische Fixspieler nur als **unverbindlicher Vorschlag**, nicht als Datenmutation |

**In allen Modi:** Fix/MUSS/RAUS, exakte Einsatzziele, Verfügbarkeiten, gespielte/gestartete Tage, bestätigte Clash-Aufstellungen und Owner-/Vize-Freigaben haben Vorrang. Vor dem Kampf sind Gegner-RH-/Roster-Mixe allenfalls ein Proxy, **keine** garantierte konkrete Gegnerbasis oder Angriffszuteilung. Acht Sterne sind ein individuelles, nicht garantiertes Ziel; bei 6★ reicht ein weiterer **2★**-Angriff. Keine ungeprüften Siegwahrscheinlichkeiten/Erz-Prognosen, keine unbeabsichtigten Cloud-Writes. Erst **read-only Shadow-Simulation** mit Standard-vs.-Alternativen-Diff und transparenten Fairnesskonflikten, ausdrücklich **nicht jetzt**.

### E5. Bewusster GitHub-/Release-Abgleich

- **Live laut \`main/cloud-version.json\`: v1.15.5.** Weder dieser Entwurf noch PR #92/#95/#97 sind live oder für einen automatischen Merge vorgesehen.
- **Offene Themen:** #44 Moduskonzept, #46 umfassende UX-/Cross-Device-Praxisabnahme, #49 teils historischer Alt-Backlog, #71 CWL-Saison-/Archiv-Praxistest, #88 Form-Forschung, #96 Statistik-Labor.
- **Offene Draft-PRs:** #92 / #95 / #97 aktive Forschung/Konzeptarbeit; **#45 / #63 / #66** ältere UI-Entwicklungsstände, vor jeder weiteren Integration auf bereits veröffentlichte Nachfolge-PRs prüfen, **nicht blind mergen**.
- **#90 ist bereits geschlossen** nach verifiziertem, abgesichertem, nutzerfreigegebenem 21-Tage-Metadaten-Backfill. Ältere Export-/UX-/Issue-Texte sind historische Momentaufnahmen und sollten bei einem späteren **separat geprüften** Dokumentations-Cleanup aktualisiert werden. Änderungen an aktuellen Produktionsdaten oder Solver sind kein Teil davon.
- **Weitere offene Qualität:** reelle Safari-/Android-/Desktop-/Rollenabnahme, PWA-Installationen, Echtzeit-Refresh ohne Verlust von Fokus/Scroll, UI-Texte, Gold-/Dark-/Light-/Cyber-Kontrast, langsame PCs, historische Saisons, keine inaktive Button-Leiche und keine „Karte in Karte“-Ansichten. Maßgeblich: [docs/UX_DESIGN_PRINCIPLES.md](https://github.com/Smolmig/cwl_planer/blob/main/docs/UX_DESIGN_PRINCIPLES.md).

**Nächster konkreter Forschungs-Deliverable:** vorab definierte *Formbruch-Testmatrix* und Datenqualitäts-/Provenienz-Audit als reine read-only Untersuchung, erst danach UI-Mock und spätere Implementierungs-PR. **Keine aktuelle Planungslogik ändern.**



## F. Live-DB-Abgleich nach historischem Backfill (read-only, 05.11.2026)

**Abfrage direkt auf dem verbundenen Supabase-Projekt; ausschließlich \`SELECT\`, keine Datenänderung.** Dieser aktuelle Snapshot ersetzt für eine neue Datenauswertung die **historischen** 52/1.187-Angaben aus Forschung #92 und v1.15.5, ohne deren alten Backtest rückwirkend umzuschreiben.

| Bereich | Aktuell direkt aus der DB | Abdeckungsnotiz |
| --- | --- | --- |
| Alle \`cwl_stat_wars\` / \`cwl_stat_attacks\` | **54 Kriege / 1.217 Einzelangriffe** | CW 30 Kriege / 859 Angriffe; CWL 24 Tage / 358 Angriffe. |
| CWL historisch importiert (Aug–Okt) | **21 Tage, 315 Plätze, 313 eigene Angriffe + 2 bekannte Misses** | Alle 21 \`finalized=true\`, \`missed_log_complete=true\`, je 15 tatsächliche Tags im Roster. |
| CWL API (November) | **3 Tage, 45 Plätze, 45 eindeutige Angreifer, 0 offene Slots** | Alle 3 \`finalized=true\`, \`roster_tags\` je 15, aber \`missed_log_complete\` **nicht ausdrücklich true**. Daher technische Flag-Abdeckung **21/24**, während anhand der gespeicherten, vollständigen Roster und Einzelangriffe die **24/24 Tage** slotbilanziell belegbar sind. Diese beiden Bedeutungen nicht verwechseln. |
| Normale CW | 29 importierte Kriege mit nachgewiesen vollständigen Missed-Logs, 1 finalisierter API-Krieg mit Roster/Angriffen | Die API-Zeile hat kein explizites \`missed_log_complete=true\`. Für echte Zuverlässigkeitsquoten Abdeckung pro Krieg und Angriffsrecht prüfen, nicht Flag und Bilanzen unterschiedlicher Formate still vermischen. |
| Missed-Einträge | **59 dokumentierte ausgelassene Angriffe** (57 CW, 2 CWL) | Bei nachweislich vollständigen Kriegstagen sind 0 Misses belegbar, bei ungesichertem Roster bleibt 0 unbekannt. |

**Zusätzliche Integritätschecks:** In der CWL stimmen für jede der 24 finalisierten Runden \`Anzahl eindeutiger Angreifer + dokumentierte Misses = Teamgröße\` und \`Anzahl Roster-Tags = Teamgröße\`. Keine mehrfachen eigenen Angriffszeilen pro Spieler/Tag; **0** CWL-Angreifer oder dokumentierte Missed-Tags außerhalb des jeweiligen Rosters; **0** CWL-Angriffe ohne Attack-Order. Diese Nachweise beziehen sich auf den **jetzigen Datenbanksnapshot** und dürfen nicht mit historischer Spielerqualität, Gegnerausbaustufe oder tatsächlich nicht aufgezeichneten First-Hits gleichgesetzt werden.

**Konsequenz für die spätere App:** Unterschiedliche Vollständigkeitssignale (\`missed_log_complete\` vs. finale Roster-/Slotbilanz) zuerst semantisch vereinheitlichen und testen; keine jetzige Schema- oder Statistik-Änderung. Der zusätzliche November-Datenstand verlangt einen **neuen** read-only Datenexport für den nächsten chronologischen Vergleich; die 98-Kriege-ClashPerk-Forschung und 52-Kriege-Baseline behalten ihren eigenen eingefrorenen Stichtag. Das öffentliche Dokument enthält **keine Player-Tags, Einzelangriffslisten oder private Exporte**.
