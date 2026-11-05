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
