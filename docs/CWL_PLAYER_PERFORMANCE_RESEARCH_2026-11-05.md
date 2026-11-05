# CWL-Spielerleistung & adaptive Rotation — Forschungs- und Umsetzungskonzept

**Stand:** 05.11.2026 · **Status:** belastbare Recherche und technischer Entwurf, **keine produktive Änderung der Spielerwerte oder CWL-Verteilung**.  
**Verwandt:** GitHub-Issue #44 (experimentelle Rotation), #46 (UI/UX); Code: cwl-stats-core.mjs, cwl-stats.mjs, cwl-planning-core.js, cwl-medal-goals.mjs.

## 1. Produktziel und Trennlinie

Zwei verschiedene Fragen beantworten:
1. **Leistung:** Wie wahrscheinlich liefert dieser Spieler **jetzt** gegen eine vergleichbar starke Basis 1, 2 oder 3 Sterne, und wie sicher ist unsere Schätzung?
2. **Verteilung:** Welche 15 Spieler sind pro Tag unter Gegnerstärke, Verfügbarkeit und tatsächlicher CWL-Entwicklung sinnvoll — bei auswählbarer Gewichtung von Wettbewerbsstärke, Sternen-/Medaillen-Fairness sowie Angriffschancen für Ressourcen und Erze?

Eine hohe Dreierquote allein ist keine Spielerstärke; hohe Gesamt-Kriegssterne aus dem Profil und aktuelle Ranked-Liga sind lediglich schwache Zusatzsignale. **Missed Attacks sind Zuverlässigkeit**, keine nachträglich fingierten 0★-Angriffe.

**Nicht in dieser Version implementieren:** neue Spielerbewertung, Score-Rangliste, automatische Solver-Änderung, neue Datenbank-Migration oder Zugriff auf Drittanbieter ohne geprüfte Erlaubnis/Export.

## 2. Gemessene Ist-Daten — United Fighters

Am 05.11.2026 wurden nur aggregierte, lesende Queries in der bereits verbundenen Statistik-DB ausgeführt, ohne Spielerprofile zu ändern:

| War-Typ | Quelle | Kriege | Einzelangriffe | 3★ / gleiches RH |
| --- | --- | ---: | ---: | ---: |
| CWL | Historienimport | 21 | 313 | in Gesamtsumme unten |
| CWL | API, abgeschlossen | 1 | 15 | in Gesamtsumme unten |
| Normaler CW | Historienimport | 29 | 826 | in Gesamtsumme unten |
| Normaler CW | API, abgeschlossen | 1 | 33 | in Gesamtsumme unten |
| **Gesamt** | | **52** | **1.187** | |

* 43 unterschiedliche **historisch erfasste** Player-Tags (nicht 43 aktuelle Clanmitglieder). Median 18 Angriffe je historischem Tag, Durchschnitt 27,6.
* 25/43 haben in 30 Tagen >=7 erfasste Angriffe; 22/43 haben >=7 **gleich-RH**-Angriffe in 30 Tagen.
* 19/43 haben >=15 gleich-RH-Angriffe in 60 Tagen; 18/43 haben >=7 CWL-Angriffe in 90 Tagen. 14/43 haben weniger als 4 Angriffe in 30 Tagen, 9/43 ihren jüngsten Eintrag vor mehr als 30 Tagen.
* 59 nachgewiesene verpasste Angriffe in 44 Datensätzen: 57 aus normalen Kriegen (42 Datensätze), 2 aus CWL (2 Datensätze). Bei 29 importierten normalen Kriegen wird der Missed-Log als vollständig gekennzeichnet; aus 21 importierten CWL-Tagen existiert keine automatisch vollständige Missed-Log-Abdeckung.
* Vergleich per 05.11.2026:
  * **CW, niedrigeres Gegner-RH:** 67 Angriffe, 88,1 % Dreier, 2,87 Ø Sterne.
  * **CW, gleiches RH:** 704 Angriffe, 68,2 % Dreier, 2,58 Ø Sterne.
  * **CWL, gleiches RH:** 300 Angriffe, 61,3 % Dreier, 2,56 Ø Sterne.
  * **CWL, niedrigeres RH:** nur 21 Angriffe, 100 % Dreier — so kleine, selektierte Gruppen sind **keine** gültigen Skill-Benchmarks.

Unbereinigte CW-/CWL-Quoten sind also **sichtbar verzerrbar**. Die 6,9 Prozentpunkte Differenz zwischen gleich-RH-CW und gleich-RH-CWL belegen **keinen kausalen** Ligadruckeffekt: Gegner-Auswahl, Basequalität, Meta und Stichproben können mitwirken.

## 3. Tatsächlich vorhandene Felder und wichtige Lücken

Die aktuelle Architektur kann bereits:
- War-Typ (normal/CWL), War-Start, Gegnerclan, Teamgröße, Quelle (Import/API), abgeschlossener Status und teils komplette Kriegsaufstellung speichern.
- Je Angriff: Player-Tag, Angriffsreihenfolge, Angreifer-/Gegner-RH, Defender-Tag, 0–3 Sterne, Zerstörung in Prozent.
- Bekannte Missed-Events je Clan, War und Spieler speichern. Bei komplettem, abgeschlossenem API-Roster kann man nicht genutzte Angriffe korrekt erkennen; sonst nur bewiesene Mindestwerte aus expliziten Logs.
- Gesamtstatistiken über bis zu 50 normale Kriege plus CWL-Saisons; Mitgliederkarten nutzen aktuell in computeRecentAttackStats() strikt **sieben letzte Angriffe**, unabhängig von RH-Differenz, CW/CWL und Map-/Mirror-Paarung.
- Die aktuell bestehenden sieben Angriffe sind **nicht** die Datenbankgrenze, sondern nur die Auswahlgrenze der Karten.

Heute **nicht** historisch gespeichert:
- Angreifer- und Verteidiger-**Map-Positionen** zur sauberen Prüfung von „gegenüber/Mirror“. Das Backend sanitisiert sie aus aktuellen API-Wars derzeit weg.
- Verlässliches „First Hit vs. Clean-up“ für historische Fremdimporte ohne bestätigte vollständige Attack-Order und Defender-Zuordnung. Doppelte Treffer auf dieselbe Base können unter Bedingungen erschlossen werden, aber der historische Datenvertrag garantiert das nicht.
- Snapshot der damaligen gegnerischen **Baseausbaustufe, Crafted Defenses und Verteidigungsstärke**, belastbare Helden-/Ausrüstungsstände bei jedem Angriff, Angriffsarmee/Meta und individuelle reale Attack-Zeitstempel.
- Vollständiger CWL-Missed-Log aller historischen Kriege. **Nicht sichtbarer Angriff** ist daher nicht immer ein bewiesener **vergessener Angriff**.

### Technischer Ausbauschritt (später, additiv)

Bei zukünftigen offiziellen API-War-Snapshots mitnehmen, wenn API-Feld vorhanden:
- mapPosition von Angreifer und Ziel, Attack-Order als originaler globaler Wert, War-Start/Ende, attacksPerMember, vollständige Roster-Tags, Gegner-RH.
- firstHit/cleanUp nur aus bestätigter chronologischer Attack-Folge ableiten (sonst unbekannt).
- War-Finalität, Provenienz/Importzeitpunkt, Abdeckungsgrad, Metaversion und TH zur **Zeit des Angriffs** sichern.
- Keine nachträgliche Umdeutung unbekannter Felder als 0, kein Rückschreiben in v9-Planerprofil; neue Felder nullable, separate getestete Migration + RLS-Prüfung.

**Spannender Hinweis aus Supercell:** Die Reihenfolge auf der Kriegsmap ist von der Verteidigungsstärke beeinflusst. Das hilft als **grober Proxy**, ersetzt jedoch nicht den konkreten Ausbaustand. Die gegnerischen Basen sind vor dem Battle Day nicht sichtbar; ein Planer kann für zukünftige Tage nicht behaupten, schon exakt die Angriffsschwierigkeit zu kennen.

## 4. Neue Bewertung: zwei klar erklärte Zeithorizonte

### A. Aktuelle Form (Mitgliederkarte)
- Kandidaten aus **30 Tagen** in erster Linie, mit weich auslaufendem Gewicht bei älteren Angriffen bis **90 Tage** als Rückfallebene. Bei Meta-Wechsel oder RH-Upgrade die bisherige Historie sichtbar als andere Vergleichsgruppe führen.
- Normal-CW nur dann stark berücksichtigen, wenn **gleiches oder höheres RH** und möglichst Mirror/First Hit belegt sind. Deutlich leichtere Gegner niemals mit demselben Gewicht wie ein ebenbürtiges Match zählen.
- CWL gegen gleichwertige RH ebenfalls stark berücksichtigen. CWL ist tendenziell kompetitiver, aber der numerische Zusatzfaktor soll **erst durch Backtests** kalibriert werden (z. B. Kandidaten 1,0 / 1,1 / 1,25).
- Alle restlichen Angriffe für die **Detailhistorie** behalten; nicht in einen überzeugend wirkenden „bereinigten Wert“ hineinrechnen, wenn die Vergleichbarkeit fehlt.

### B. Belastbare Stärke (für Simulation)
- Zeitfenster bis 90 Tage (bei Bedarf älter als schwacher Prior); Halbwertszeit als Testparameter etwa 21/30/45 Tage.
- Jede Attacke trägt bekannte Eigenschaften: CW/CWL, eigene RH-Stufe zur Kampfzeit, Ziel-RH, relative Map-Position, Erstangriff, Jahr/Meta-Zeitpunkt, Ergebnis.
- Mathematischer Versuchsansatz: Zeitgewicht w = 2^(-Alter_in_Tagen / Halbwertszeit) × Kontextgewicht. **Kontextgewichte erst durch historische Validierung festlegen**, nicht als „offizielle“ Werte verkaufen.
- Effektive Stichprobe: n_eff = (Summe w)^2 / Summe(w²). Sie zeigt, wie viel Information die gewichtet betrachteten Angriffe tatsächlich liefern. Eine lange Historie mit vielen alten/leichteren Angriffen soll keine falsche Genauigkeit suggerieren.
- Auswertungsziel als **Verteilung** der Sterne 0/1/2/3 (mit Glättung/Partial Pooling nach Rathausklasse), nicht nur P(3★). Separate Ø Sterne und 3★-Quote können aus diesem Modell abgeleitet oder zusätzlich roh angezeigt werden.
- Bayes-/hierarchische Glättung auf Clan-/RH-Gruppen mit Unsicherheitsband; 1/1 3★ ist kein „100 % sicherer“ Spieler. Kleine Stichprobe stets als unsicher markieren.
- Empfohlene Testschwellen für Konfidenz, **keine Produktivregeln vor Backtest**: n_eff < 5 wenig Daten; 5–11 erste Tendenz; 12–24 mittlere Grundlage; ab 25 brauchbarer — abhängig von Datenalter und Vergleichbarkeit.

### C. Zuverlässigkeit separat
- Vollständiges, abgeschlossenes Roster beweist erlaubte Angriffe (normal CW meist 2, CWL 1); nur dann verlässlich ungenutzte Angriffe als „missed“ zählen.
- Historische ClashPerk-Missed-Logs belegen einzelne Versäumnisse; unvollständige Abdeckung darf **niemals** als 0 Misses ausgegeben werden.
- Denominator = ausschließlich **nachweisbar verfügbare** Angriffe, nicht alle möglichen Kriege oder alle Clanmitglieder. Nicht eingeplante CWL-Mitglieder haben 0 verfügbare Angriffe, nicht 1 verpassten.
- Anzeige „Zuverlässigkeit“, Datengüte, Nachweiszeitraum getrennt von 3★-Rate, Ø Sternen und Angriffsstärke. In Zukunft möglicher kleiner Soft-Faktor bei Simulationsmodus, niemals eine erfundene 0★-Attacke.

## 5. UX-Vorschlag für die Mitgliederliste

Bestehende Kennzahlen **nicht abrupt ersetzen**. Nach Validierung:
- Hauptzeile: „3★-Quote – vergleichbare Gegner · letzter Zeitraum“ und „Ø Sterne“ mit Kontextinfo.
- Darunter dezent: „n_eff X · CWL Y / CW Z · letzter Angriff DD.MM. · Datengüte hoch/mittel/gering“.
- Info-Ansicht: **Aktuelle Form**, **Langfristige Stärke**, **Zuverlässigkeit** als drei verständliche Abschnitte, plus visuelle Chronologie der letzten 7 Angriffe **als Beispiele, nicht als gesamte statistische Basis**.
- Detailansicht zeigt Filterregeln: gleiches RH, erste/weitere Attacke, CWL-Faktor, ignorierte leichtere Gegner, Herkunft aus API/ClashPerk-Import.
- Keine 100-%-Farben bei ein oder zwei Treffern, keine 0-%-Defaultwerte für unbekannte Daten, keine undokumentierten „KI-Skillpunkte“.

## 6. Neu beigetretene Spieler — Cold Start

Recherchiert:
- ClashPerk zeigt auf **öffentlichen Spieler-Kriegshistorien** bis zu 6 Monate aus mehreren Clans mit CW-/CWL-Typ, TH-Ziel, Map-Nummer, Zerstörung und teils Missed-Angriffen. Das ist **gesammeltes Drittanbieterarchiv**, nicht rückwirkend neu abrufbar aus der aktuellen offiziellen Spieler-API.
- Welche Spieler/Historien abgedeckt sind, hängt von vorheriger Datenerfassung ab; nicht jeder Spieler kann so ergänzt werden.
- ClashPerk bietet dokumentierte Discord-Logs (War, CWL, Missed, Lineup) und auf seiner Website Exporte für Kriegsstatistiken/Roster an; **eine dokumentierte und frei nutzbare API zum automatischen Einzelattacken-Bulkimport ist damit noch nicht bestätigt**.
- **Sichere Reihenfolge:** Exportfunktion/CSV/Sheets/JSON prüfen → Spalten/Originaltage/Dubletten zeigen → Vorschau mit Quelle/Abdeckung → nach ausdrücklicher Zustimmung importieren. Kein ungeprüftes Scraping oder stiller Drittanbieter-Abruf; Nutzungsrechte/Rate-Limits klären.
- Die öffentliche Kriegshistorie enthält auch Spieler aus **anderen Clans** und ist deshalb besonders hilfreich bei Neuzugängen; nur mit korrekten Tags verbinden, nicht mit dem wechselbaren Spielernamen.
- Optionale Alternative für weitere Prüfungen: ClashKing-API dokumentiert War-Attack-/War-Stats-Endpunkte. Nutzungsbedingungen, Datenabdeckung und Authentifizierung vorher technisch und rechtlich prüfen; keine Gleichsetzung mit offiziellen Supercell-Daten.

Wenn **keine historischen Angriffe** verfügbar sind:
- Rathaus/Helden/Truppen/Ausrüstung (nur wenn zuverlässig verfügbar), aktuelle Ranked-Liga, langfristige Kriegssterne, Spielaktivität/letzte Seen höchstens als **weiche Prior-Information** behandeln.
- Die 2026er Ranked-Liga ist ein offizieller Indikator für Ranked-Skill, **nicht** automatisch CWL-Stärke. Spielmodus/Meta, aktive Angriffe, freiwillige Teilnahme und eigener Farm-Fokus beeinflussen sie.
- Keine sichere Einstufung eines neuen Spielers nur aus Rang, Helden oder War Stars. Besser: „wenig Vergleichsdaten“, nach 2–5 echten passenden Angriffen die Schätzung sukzessive aktualisieren.

## 7. Tieferer experimenteller CWL-Planer: Ergebnis statt bloßer Sternequote

### Harte Regeln unverändert
- 15 Plätze pro Tag nur als aktuelle Beispielgröße (technisch slots aus Clan-Konfiguration); 7 Tage, Fix/MUSS/RAUS, Verfügbarkeit, genaue Einsatzziele und historische/gestartete Kriege sind **harte Constraints**.
- Kein Umstellen bereits gestarteter Kriege; nur Vorschau, Clanführung entscheidet. Vize/Viewer gemäß vorhandener Rollen-/Review-Regel.
- Wenn genaue Einsatzziele eine fairere Lösung verhindern, **Konflikt anzeigen und bewusste Änderungsoption anbieten**, nie Vorgaben heimlich aufweichen.

### Weiche Ziele und Trade-offs
1. **Wettkampfstärke:** erwartete Clan-Sterne und Zerstörung gegen die passende Gegner-RH-Verteilung; Risiko knapper Tagesniederlagen und Ergebnis der Ligagruppe.
2. **Medailen-Fairness:** Anzahl Spieler, die wahrscheinlich 8★ erreichen; bei 6★ und 1 verbleibendem Angriff zählt P(2★ **oder** 3★), nicht nur 3★-Rate. Für mehrere Restangriffe kann man aus der geschätzten 0–3-Sterne-Verteilung das **Sternensummen-Risiko** berechnen. Das Ergebnis sind **Wahrscheinlichkeiten mit Unsicherheitsband**, keine Garantien.
3. **Angriffschancen:** zusätzliche tatsächliche Einsätze für persönliche Loot- und mögliche Erz-Vorteile; Erze hängen zudem vom Kriegsresultat und Bonusbedingungen ab. Ein zusätzlicher geplanter Einsatz garantiert **keine** konkrete Erzmenge.
4. **Zuverlässigkeit:** Risiko eines nicht genutzten Angriffs aus vollständiger Evidenz, getrennt vom Spielergebnis.
5. **Rotationsfairness:** ausgeglichene Einsatzanzahl, persönliche Ziele und Erreichbarkeit des Medailenziels.

### Drei Einstiegspresets, erst in einer Simulation
- **Maximale Stärke:** Priorisiert Clan-Sieg/-Platzierung; sonstige Chancen als Nebenkriterium.
- **Ausgewogen:** Maximiert starke Chancen mit bewusstem Medailen-/Einsatz-Ausgleich.
- **Fair & Belohnungen:** Besseres Erreichen von 8★ und zusätzlichen Angriffschancen, solange ein einstellbares Mindestniveau für Clan-Stärke eingehalten wird.

Anschließend **Aggressivität** verstellbar (z. B. 0–100), aber als expliziter Trade-off. Keine magische Punktzahl; lieber **2–3 Pareto-Alternativen** mit Begründung: „+1 Spieler vermutlich am 8★-Ziel, dafür prognostizierter Sternespielraum weniger sicher“.

### Adaptive Planung je CWL-Tag
- Vor der Saison: nur Gegnerclans und verfügbare Rathausverteilungen (falls API-seitig vollständig), **keine erfundenen Basenstärken**.
- In der Vorbereitung: Gegner-Roster/TH-Info soweit verfügbar nutzen; Supercell stellt die **einzelnen gegnerischen Basen erst am Kampftag** bereit.
- Mit beginnendem Krieg: eigene tatsächliche Aufstellung ist fix. Nach jedem abgeschlossenen Krieg nur die **verbleibenden Tage** neu simulieren; persönliche CWL-Sterne, aktuelle Treffer und verpasste Angriffe aktualisieren.
- Empfohlene Spieler vs. Gegner auf **Tages-/Lineup-Ebene** modellieren; individuelle Ziele sind im Clanplaner bislang nicht bindend zugewiesen. Nicht so tun, als greife jeder automatisch sein Mirror an.
- Ein einzelner 0★-Ausreißer führt nicht zu einem radikalen Rankingsturz; Datenaktualität, effektive Stichprobe und Vertrauen sichtbar machen.
- Kontrolle vor Bestätigung: konkret „Tag 5: Person A heraus, Person B hinein“, *Warum*, 8★-Chance, Qualitätsbandbreite, Restziele, mögliches CWL-Stärkerisiko, welche Tagesvorgaben geprüft wurden.

## 8. Qualitäts- und Freigabeplan

1. **Stufe 0 – Datenvertrag/Erfassung:** vorhandene 1.187 Angriffe auswerten, Dubletten und Quellen verifizieren; zusätzlicher Map-/Attack-Kontext auf neuen API-Kriegen speichern; quellenspezifische Historie und Missed-Abdeckung importierbar machen. Kein UI-Score.
2. **Stufe 1 – Shadow Evaluation:** mehrere Modelle getrennt und deterministisch gegen unseren historischen Ist-Datensatz testen: letzte 7, 30 Tage gleich-RH, 90 Tage zeitgewichtet, CWL-only, kontextgewichtet. Ergebnis erst in Entwicklerdiagnostik.
3. **Stufe 2 – Backtest & Kalibrierung:** streng chronologisch trainieren und spätere Kriege voraussagen (keine Daten aus Zukunft); 3★-Prognose/erwartete Sterne mit Brier-/Log-Loss und Kalibrierungsdiagramm prüfen. Mehrere Saisons, Unterschiede nach TH/Meta/Clan, fehlende Daten und neue Spieler prüfen. Erst dann Gewichte festlegen.
4. **Stufe 3 – Transparente Mitgliederanzeige:** neue Form-/Verlässlichkeitswerte optional aktivieren, neben bisherigem Wert, erst nach tatsächlichem Vertrauensgewinn als Standard.
5. **Stufe 4 – CWL-Simulation:** Baseline gegen Maximum/Ausgewogen/Fair mit identischen harten Constraints und realistischen Datengüte-Hinweisen vergleichen; kein Speichern durch Öffnen oder Ändern von Einstellungen. Erst nach robusten Tests optional bestätigen.
6. **Stufe 5 – adaptiv:** nach abgeschlossenen Tageskriegen neu planen; Lock-/Review-, Rollen-, Reload-, Cloud-Konflikt-, Offline- und Mobiltests. Keine automatischen produktiven Änderungen ohne Freigabe.

**Wichtige Testfälle:** TH18 gegen TH17; gleiches TH aber gerushte Base; Cleanup nach vorherigem 2★; 1/1 und 7/7 Dreier; CWL vor 30 Tagen; neue Meta; Clanwechsel; Player-Tag gleich bei Namenswechsel; unvollständiger ClashPerk-Import; missed ohne Roster; 6★ + 1 Restangriff; 8★ + 2 Restangriffe; 3- vs. 4-Einsätze; exakte Einsatzziele; CWL in War; kein Zugriff auf Drittanbieter; 0 Supabase-Schreibzugriffe bei Vorschau.

## 9. Recherchequellen (05.11.2026)

- Offizielle CWL-War-League-Regeln und 8★/20–100%-Medailenanteil: https://support.supercell.com/clash-of-clans/de/articles/clan-war-leagues-rewards-2.html
- Offizielle CWL-Woche, Kartenreihenfolge nach Verteidigungsstärke und nicht sichtbare Basen vor Kampftag: https://support.supercell.com/clash-of-clans/en/articles/cwl-week-of-wars.html
- Kriegsloot und Erze (Auswirkung Sieg, Zerstörung): https://support.supercell.com/clash-of-clans/en/articles/clan-war-rewards-2.html
- Ranked-Ligen als separater Spielmodus/Skillindikator: https://support.supercell.com/clash-of-clans/en/articles/ranked-leagues-4.html
- ClashPerk: öffentliche Spieler-Kriegshistorie aus mehreren Clans, sechs Monate (Beispiel): https://clashperk.com/web/players/%23LY2JCPQU/wars
- ClashPerk FAQ zur Abfrage/Snapshot-Abdeckung und Last Seen: https://docs.clashperk.com/faq
- ClashPerk Logs und Missed-/CWL-Logs: https://docs.clashperk.com/features/logs
- ClashPerk Website zu Exporten/War-Statistik: https://clashperk.com/
- Alternative Drittanbieter-API: https://api.clashk.ing/swagger/index.html

**Schluss:** Weniger Daten würden oft weniger aussagen — aber „so viele wie möglich“ ohne Kontext würde die Quote verzerren. Die richtige Richtung lautet: **große, provenance-geprüfte Historie + vergleichbare Attacken + starker Zeitbezug + separat gemessene Zuverlässigkeit + sichtbar ausgewiesene Unsicherheit**. Das verbessert später nicht nur die Mitgliederkarte, sondern die adaptiven CWL-Vorschläge.

## 10. CWL versäumte Angriffe — Praxispräzisierung (05.11.2026)

**Keine automatische Sperre oder Auswechslung nach vermisstem Angriff.** Eine frühere Idee, einen Spieler für den Rest der CWL zu pausieren, wurde aus der Praxis ausdrücklich verworfen: ein Spieler kann selbst fünf Minuten vor Ende noch angreifen. Außerdem ist der tatsächliche Wechsel immer in Clash manuell vorzunehmen. Deshalb zunächst nur: ca. letzte Stunde **offen**, nach vollständig abgeschlossenem Krieg **nachgewiesen verpasst**, vor dem nächsten Krieg bewusst prüfen. Kein Unreliable-Score im Planer ohne valide, vollständige Quellen. Die App bietet keine garantierten Background-Push-Nachrichten; fehlende API-Freshness unterdrückt kurzfristige Wechselhinweise.
