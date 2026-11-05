# Produktentwurf: Spielerbewertung, Clan-Statistik und späterer CWL-Strategieplaner

**Stand:** 05.11.2026 · **Status: Ideen- und Forschungsentwurf, keine Umsetzung der Planungslogik.**
Dieses Dokument hält die Wünsche des Clanführers bewusst verständlich fest und wird mit neuen Ideen, Daten und Tests weiterentwickelt. Nicht alle Vorschläge sind bereits als sinnvoll bewiesen oder technisch umgesetzt.

## Die drei Bereiche sind bewusst verschieden

| Bereich | Kernfrage | Zeithorizont | Ausgabe |
|---|---|---|---|
| **Mitgliederliste – Aktuelle Spielerstärke** | Wer ist **jetzt** für die nächste CWL geeignet? | Schwerpunkt letzte Tage/Wochen, mit älterer Geschichte als schwacher Kontext | Kompakte nachvollziehbare Einschätzung, aktuelle Form, Datenqualität und Zuverlässigkeit |
| **Statistik-Tab – Clan-Analyse** | Was haben Spieler und Clan wirklich geleistet, **wie** und **gegen wen**? Wie hat sich das verändert? | Frei filterbar: einzelne Kriege, 7/30/90 Tage, CWL-Saisons, Monate, lange Geschichte | Umfangreiche Tabellen, Grafiken, vergleichende und zeitliche Analysen; auch dieselbe aktuelle Stärkeansicht optional |
| **CWL-Planer – spätere Strategievorschläge** | Welche Spieler passen unter den realen Regeln **an welchem Tag** zum Gegner? | Gegenwärtige Form + zukünftige Gegner + bestehende Pläne | Zunächst nur erklärte Vorschau mit Fairness-/Leistungsabwägungen; kein stilles Umschreiben |

Die Mitgliederliste soll **nicht** zum überladenen Statistik-Dashboard werden. Der Statistik-Tab darf dagegen inhaltlich richtig tief gehen. Dieselbe zugrundeliegende Datenbasis darf in den beiden Ansichten verschieden gewichtet werden. Rohwerte, vorläufige Stärke und Verlässlichkeit dürfen nicht miteinander verwechselt werden.

## 1. Aktuelle Spielerbewertung in der Mitgliederliste

### Wichtigster Grundsatz: Form kann einbrechen
- Beispiel: 60–90 Tage lang sehr starke Dreisterne-Ergebnisse, **aber seit 30 Tagen deutlich schlechter**. Eine gemischte 90-Tage-Quote darf diese aktuelle Schwäche nicht verstecken.
- Gründe können Aktivitätsabnahme, neues Rathaus, anderes Gegnerniveau, Balanceänderungen, Metawechsel, ungeeignete Armee oder bloße Zufallsschwankung sein. **Grund nie ohne Nachweis behaupten**.
- Darum mindestens zwei Zeitreihen betrachten: **jetzige Form / jüngste Entwicklung** und **bewährte frühere Stärke**. Bei einem deutlichen Formknick gesondert warnen („zuletzt schwächer“), nicht einen alten Durchschnitt als aktuelle Stärke ausgeben.
- Kandidaten für Forschungsvergleich: 7/14/21/30 Tage; exponentiell alternde 60–90-Tage-Historie als unterstützender Prior; Erkennung eines glaubhaften Formknicks, ohne einzelne schwache Kriege überzubewerten. Fenster/Gewichte **nicht** willkürlich festlegen, sondern rückblickend vergleichen.
- Möglichst offizielle Patch-/Balance-/Rathausänderungen in einer **versionierten Meta-Zeitlinie** berücksichtigen. Ein Patch ist nicht automatisch ein Leistungsabfall; nur belastbare Befunde dürfen ein Modell verändern.

### Welche Signale grundsätzlich prüfen?
1. **Angriffsergebnis:** 0/1/2/3 Sterne, Durchschnitt, echte zusätzlich gewonnene Sterne, Zerstörung, Zeitpunkt und War-Typ.
2. **Schwierigkeit des Gegners:** eigenes und gegnerisches RH **zum Angriffszeitpunkt**, auch RH niedriger/gleich/höher; Map-Positionen (Mirror, weiter oben/unten), gegnerische Defensivstärke nur wenn belegt. Mirror-Position allein ist kein Qualitätsbeweis.
3. **Angriffskontext:** CWL versus normaler CW, First-Hit versus Cleanup nur bei gesichertem Angriffspfad, Anzahl und Reihenfolge der Angriffsmöglichkeiten; eigene und gegnerische Basisnummern.
4. **Belastbarkeit:** genug **vergleichbare, aktuelle Angriffe**? 2/2-Dreier sind nicht so aussagekräftig wie 40/60; Unsicherheit sichtbar machen.
5. **Zuverlässigkeit als separate Achse:** nachweislich vergessene Angriffe geteilt durch belegte eigene Angriffsmöglichkeiten, nur bei vollständigem Tagesroster; nicht als erfundene Null-Sterne-Attacken zählen.
6. **Spielerprofil als ergänzendes Signal:** gesamthaft verdiente Kriegssterne, aktuelle Ranked-Liga (z. B. Legende II), Rathausstufe, Erfahrung, möglicherweise Helden/Ausrüstung, Aktivität – **nur**, soweit Clash API/zulässige Exporte dies wirklich hergeben, mit Zeitstempel und Verfügbarkeit. Liga und Lifetime-Stars sind nicht gleich CWL-Erfolg; nicht übergewichten.
7. **Abstieg, Aufstieg, Wiedereinstieg, Neuzugänge:** bei RH-Upgrade/Metawechsel ältere Erfolge nicht blind übertragen. Wenige oder keine Daten -> „noch nicht zuverlässig einschätzbar“, nicht automatisch schlecht.

### Vorschlag für die visuelle Mitgliederkarte (noch kein Designbeschluss)
- Primär **Aktuelle Form** als verständliche Einordnung (nicht bloß eine scheinexakte Prozentzahl).
- Dezent **Trend** („steigend“, „stabil“, „zuletzt schwächer“, „nicht genug Belege“) + Grundlage („x passende Angriffe / Zeitraum“).
- **Zuverlässigkeit** als eigener Wert oder eigenes kleines Signal; nie heimlich mit Trefferquote vermischen.
- Tippen auf Info: die relevanten Ergebnisse, Gegner-RH, Tagespositionen, CW/CWL, Zeitverlauf und warum die vorläufige Einordnung zustande kam.
- Die 0–100-Stärkebewertung ist **noch nicht entschieden**. Ob Score, Klassen, Unsicherheitsband oder Kombination die ehrlichste und nützlichste Darstellung ist, erst nach Datenanalyse und UX-Vergleich festlegen.

## 2. Statistik-Tab: bewusst ein umfassendes Analysewerkzeug

Der Statistik-Tab soll **viel mehr** können als „x Angriffe, y Dreier“. Nicht nur auf kurzfristige CWL-Planung reduzieren. Ziele:
- **Spielervergleich:** wer ist aktuell stark, wer langfristig erfolgreich, wie unterschiedlich ist ihre Datenbasis, bei welchen RH-Klassen und welchem CW/CWL-Typ?
- **Clankennzahlen und Vergangenheit:** Trefferquoten, Sterne, Zerstörung, Angriffserfüllung, Gesamtentwicklung pro Saison/Monat, Clan-Historie, Fortschritte/Einbrüche, Unterschiede zwischen Gegnerarten.
- **Kontext statt Schönfärberei:** Vergleiche nach **eigenem RH / niedrigerem RH / gleichem RH / höherem RH**, CW vs. CWL, Map-Position/Mirror, tatsächlicher Mehr-Sterne-Beitrag, Erst-/Folgeangriff sofern belegt.
- **Zeitvergleich:** letzte 7/30/90 Tage gegen frühere Perioden; alte und neue Meta; Trendbrüche; ggf. Jahre/Saisons nebeneinander.
- **Zuverlässigkeit und Datengüte:** Angriff erfüllt / verpasst nur mit echtem Nenner; Datenlücken pro Quelle klar ausgewiesen. Nie `0` aus fehlender Historie erfinden.
- **Interaktive Auswertung:** auswählbare Kennzahlen, Filter für Kriegsart, Zeitraum, RH-Klassen und Spieler; sortierbare Tabellen; einfache sinnvolle Diagramme. Detailtiefe auf Wunsch, nicht alles in einer überfüllten Startansicht.

**Besonders wichtiges Referenzbeispiel** aus der bisherigen Nutzerreaktion:

| Beispiel-Tabelle (nur Formatidee, keine aktuellen neuen Messwerte) | 3★-Quote | Angriffe | Ø Sterne |
|---|---:|---:|---:|
| CW gegen niedrigeres RH | … | … | … |
| CW gegen gleiches RH | … | … | … |
| CW gegen höheres RH | … | … | … |
| CWL gegen niedrigeres RH | … | … | … |
| CWL gegen gleiches RH | … | … | … |
| CWL gegen höheres RH | … | … | … |

Diese Kreuztabelle **RH-Klasse × Kriegstyp** war dem Nutzer besonders wichtig und soll als wiederkehrendes UX-/Datenanalyse-Muster dienen. Dazu sinnvoll: Zeitreihen je Spieler/Clan, kleine Mehrfachdiagramme, Gegnervergleich, Verteilungsdiagramm für 0–3 Sterne und transparente Fallzahlen; keine Charts allein als Dekoration. Null-Fallzahlen mit „keine Daten“, nicht 0 % anzeigen. Ergebnisse kleiner oder selektiver Gruppen mit klarer Einordnung und Unsicherheit versehen.

**Weitere Forschung:** professionellen Analyse-Dashboards, Clankrieg-Tools und Sport-/Performance-Analytics ansehen; herausfinden, welche Visualisierungen Entscheidungsfragen tatsächlich beantworten. Erst informative Reihenfolgen/Interaktionen konzipieren, dann UI bauen.

## 3. Planung: drei zukünftige Strategieprofile, ausdrücklich noch Ideen

**Aktuell nicht implementieren oder am bestehenden Solver drehen.** Der jetzige Planer bleibt unverändert. Langfristig vorstellen:

- **Fair:** 8-Sterne-Ziel, echte Teilnahmemöglichkeiten und faire Rotation stehen im Zentrum. **Auch hier** stärkere Spieler möglichst zu passend schwierigen Gegnern einteilen, ohne Fairness zu verdrängen.
- **Strategisch** *(Arbeitsname, später gemeinsam finalisieren)*: Spieltags- und Gegnerstärke im Vordergrund, 8-Sterne-Chancen bleiben ein bewusstes Nebenziel, sind aber keine harte Optimierungspriorität. Starke Gegner an den wichtigen späteren Tagen -> passende starke Spieler einplanen.
- **Wettkampf** *(Arbeitsname)*: bestmögliche Clan-Wettbewerbsstärke, geringer Wert auf ausgeglichene Rotation. Topspieler können an sehr vielen Tagen spielen; der Algorithmus darf – soweit **nicht ausdrücklich manuell vorgegeben** – in einem **separat bestätigten Vorschlag** selbst bestimmen, wer dauerhaft gesetzt ist.

**Unveränderliche Regeln in jeder denkbaren Version:** bereits gespielte/gestartete Tage, bestätigte Aufstellungen, Berechtigungen und manuelle Vorgaben nie still ändern. Für einen zukünftigen Wettkampfmodus muss die Unterscheidung zwischen **manuell gesetztem Fix**, **automatisch vorgeschlagenem Setzen**, **hartem Einsatzziel** und **optionalem Fairnessziel** erst sauber entworfen werden. Ein Nutzer darf Moduswechsel nie als verdeckte Überschreibung erleben.

Der Planer sollte für jeden Tag den Gegner (Rathausmix, belegte Stärke, unbekannte Werte) und unsere aktuell verfügbaren Spieler berücksichtigen. **Er wählt zunächst Teamaufstellungen, nicht fiktive gesicherte Angriffsziele.** Keine unbelegten exakten Sieg- oder Dreisterne-Chancen. Vor einer Anwendung nur **Vergleichsvorschau**, Begründung, Härte-/Fairness-Abweichungen und explizite Bestätigung.

## 4. Iterativer Entwicklungs- und Kommunikationsmodus

- Diese Fassung ist **ein Grundentwurf**, keine vollständige endgültige Spezifikation. Neue Gedanken des Nutzers laufend einordnen, Widersprüche aktiv erkennen, Hypothesen recherchieren und nachvollziehbar einarbeiten.
- GitHub-Details, Rohdatenverträge, Formeln, Tests und PR-Verwaltung sind **Verantwortung des Assistenten**. Der Nutzer soll GitHub **nicht verstehen oder selbst pflegen müssen**.
- Rückmeldungen im Chat **normalsprachlich und dosiert**: `Was haben wir gelernt?`, `Was ist die Auswirkung für Mitgliederliste/Statistik/Planung?`, `Was wurde tatsächlich geändert und was bleibt Idee?`. Nicht jede technische Datei oder Formel ausbreiten.
- Realistische Trennung: **Idee**, **in Daten geprüft**, **als Prototyp getestet**, **freigegeben**, **live**. Vor der Veröffentlichung von automatischen Spielerbewertungen oder Planungsänderungen echte historische Holdout-Tests, Datenqualitätsnachweise und Abnahme.
- ClashPerk-Exporte sind auf Anfrage verfügbar. Fehlen Daten, **konkret Zeitraum/Felder/Export** erfragen und nicht annehmen, dass sie dauerhaft fehlen.
- Projektgrundsatz: „Zeige das Wichtige zuerst, gruppiere mit Abstand statt mit Kästen, und ändere niemals ungefragt das, womit jemand gerade arbeitet.“

**Diesen Entwurf insbesondere mit GitHub #88 (Spielerbewertung) und #44 (CWL-Strategieprofile) verknüpfen. Keine Änderungen an App, Datenbank, UI oder Solver durch diese Dokumentation.**
