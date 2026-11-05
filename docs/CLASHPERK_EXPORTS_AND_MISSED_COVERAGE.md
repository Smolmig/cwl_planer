# ClashPerk-Exporte: Welche helfen unseren CWL-Statistiken?

**Stand: 05.11.2026 · Datenprüfung read-only · keine Nutzer-/Spielerdaten aktualisiert.**

## 1. Der bereits importierte Datenbestand

Die frühere von United Fighters bereitgestellte Datei `United_Fighters_Statistik_50_Kriege_mit_CWL_Missed.json` wurde wiedergefunden. Sie enthält 50 Kriege (29 reguläre, 21 CWL), 1.139 individuelle Angriffe und 44 nachgewiesene Missed-Zeilen: **57 reguläre** plus **2 CWL** verpasste Angriffe. Die Daten wurden bereits in das clan-geschützte Statistikformat importiert; zusätzlich sind inzwischen zwei abgeschlossene API-Kriege (48 Angriffe) erfasst. Die gesamte aktive DB hat daher **52 Kriege, 1.187 Angriffe und 59 explizite Misses**.

Vom 05.11.2026 verifizierte Abdeckung:
- Reguläre CW: **30/30** Kriege bzgl. Missed vollständig auswertbar (29 vollständige Missed-Logs + 1 abgeschlossener vollständiger API-Krieg). **57 versäumte Angriffe exakt**.
- CWL: **1/22** Kriege bzgl. Missed vollständig auswertbar (aktuell vollständig archivierter API-Krieg). Bei 21 älteren CWL-Tagen ist ein lückenloser Missed-Nachweis nicht belegt. **Mindestens 2 CWL-Misses** sind belegt, nicht zwingend alle.
- Kombinierte Anzeige: **mindestens 59** verpasste Angriffe, nicht 59 als garantierter Gesamtwert. Normale CW-Misses bleiben unabhängig davon exakt.
- Die Spielerstatistik benutzt für Sterne/Hit-Rate nur tatsächlich ausgeführte Angriffe; Missed-Angriffe sind eine separate Zuverlässigkeitskennzahl.

## 2. Priorisierte Nachlieferungen

**P1 – 21 alte CWL-Kriegstage: finale tatsächliche Tagesaufstellungen plus Angriffsnachweise oder vollständige Tages-Missed-Logs.**

Am hilfreichsten: Für jeden CWL-Kriegstag Teamliste der 15/30 tatsächlichen Teilnehmer **mit Player-Tags**, Kriegs-ID/War-Tag bzw. Gegner + Startdatum, tatsächlich ausgeführte Angriffe und die nicht angreifenden Teilnehmer. Das erlaubt, die nicht genutzten Angriffe mit 1 möglichem Angriff pro Tag zu verifizieren. Nur die initiale CWL-Anmeldung mit 30–50 Spieler-Tags reicht dafür **nicht**.

Falls Discord auf deinem Server die beiden Logtypen aktiviert hat, sind sie dafür relevant:
- `CWL Missed Attacks Log`: tatsächliche Nicht-Angreifer eines abgeschlossenen CWL-Tages.
- `CWL Embed Log`, `CWL Lineup Change Log`: historische Kriegstagslisten und Änderungen (letztere **alleine** kein endgültiger Roster-Beleg).
ClashPerk dokumentiert die Einrichtung unter `/setup clan-logs`, die konkreten Optionen bitte im Discord-Slash-Menü prüfen. Wenn es **keinen rückwirkenden Log** gibt, kann eine Aktivierung heute vergangene Lücken **nicht** nachträglich beweisen.

**P2 – Original-Excel/Google-Sheet mit Angriffseinzelzeilen inklusive der Map-Positionen und Angriffsreihenfolge.**

Wenn der Export oder der Attack-Log die eigene Basisnummer und die Zielnummer liefert, kann man „Mirror“ = dieselbe Nummer verifizieren, statt Angriffe pauschal aufzuwerten. Zusätzlich wichtig: Angriff auf bereits vorangegriffene Basis (Cleanup), gleiches/höheres RH, 0–3 Sterne, Zerstörungsgrad, Spieler-/Ziel-Tags, CW/CWL, Startdatum. Viele Exporte enthalten Aggregatwerte statt dieser Einzelzeilen – das müssen wir am tatsächlichen Sheet prüfen. Auch zwei 3★-Angriffe gegen die gleiche schwache Basis dürfen nicht als gleich schwierige Benchmark gelten.

**P3 – Neue Spieler: Spielerseitige historische War-Ansicht über mehrere Clans.**

ClashPerk bietet öffentliche Spieler-Kriegshistorien mit Attacken, gegnerischen Rathäusern und früheren Clanwechseln (historische Verfügbarkeit abhängig von Tracking). Link oder exportierbare Tabelle je **Player-Tag**, nicht nur der wechselbare Name. Über diesen Link lassen sich Daten aus vorherigen Clans fachlich prüfen. Keine bestätigte frei nutzbare Bulk-API; nicht ohne Prüfung der Nutzungsbedingungen scrapen.

**P4 – Datenergänzung mit niedrigem Mehrwert für das Missed-Problem:**
- Ein erneuter Export der **gleichen letzten 50 Kriege** ohne erweiterte Teilnehmerliste bringt voraussichtlich wenig.
- Ein **CWL-Roster-/Anmelde-Export** allein beweist **keine Teilnahme in den tatsächlichen Kriegstagen**. Er ist aber nützlich, um Spieler-Tags, Aussteiger und den geplanten Pool zu kontrollieren.
- Aktivitäten/Last Seen, Ranked-Liga und Profil-Kriegssterne sind höchstens schwache Zusatzinformationen zur späteren Leistungsbewertung, kein Ersatz für echte Angriffseinzelzeilen.

## 3. Aktuelle Exportmöglichkeiten – was bestätigt ist

- Die ClashPerk-Website bewirbt „Advanced Data Exports“ von **Rosters, Season War Stats und Member Data nach Google Sheets**.
- Offiziell dokumentiert ist `/export rosters category: WAR or CWL` mit Player-Tag, Clan, RH, War Preference, Gruppen, Combined Heroes. Die Web-/Sheet-Ausgabe lässt sich herunterladen.
- `/export wars` und `/export cwl` sind in älteren Community-Anleitungen beschrieben und vermutlich relevant für die bereits gelieferte Datei, aber **die heutigen Slash-Unterbefehle und Export-Spalten wurden nicht aktuell offiziell verifiziert**. Im Discord-Kanal `/export` tippen und **nur die tatsächlich angebotenen Optionen verwenden**; lieber den Unterbefehls-Screenshot/Export schicken als einen erfundenen Befehl zu übernehmen.
- ClashPerk-Logs für reguläre CW-Misses, CWL-Misses, CWL-Embed und Lineup-Changes sind offiziell dokumentiert. Einzelne Historien stehen auf der ClashPerk-Webseite zur Verfügung; nicht alles davon muss als CSV exportierbar sein.
- Eine andere, optional zu prüfende Quelle ist die dokumentierte ClashKing-API mit historischen War-Endpunkten und Exportfunktionen. Eine direkte Integration erfordert Nutzungs-/Rate-Limit-/Datenschutzprüfung und fachliche Provenienz.

## 4. Sicherer Nachimport

1. Zuerst im getrennten Testkontext Originaltabelle, Gegner-Tag/Datum, Kriegs-ID und Player-Tags abgleichen. Keine E-Mail-/Discord-Namen für die Identifikation.
2. Nur eindeutig denselben Kriegen zugeordnete Daten in die bestehenden Einträge ergänzen. Keine Doppelimporte, keine automatische Zusammenführung über Spielernamen.
3. `missed_log_complete=true` nur setzen, wenn nachgewiesen **alle** Spieler und Missed-Ereignisse des jeweiligen abgeschlossenen Krieges erfasst wurden. Ein leerer einzelner CWL-Missed-Log ohne belegte Vollständigkeit ist **kein** Beweis für null Misses.
4. Vor Produktionsimport zählen: Anzahl eindeutig gematchter War-Keys, Player-Tags, fehlende/mehrdeutige Zeilen, betroffene CWL-Kriege, bisherige Mindestwerte und erwartete Verbesserung der Datenabdeckung. Vorher Daten sichern, dann nur bei Freigabe aktualisieren.
5. Keinesfalls den CWL-Plan oder die Cloud-Profile durch einen Statistikimport verändern.

## Links und Quellen
- ClashPerk [Website](https://clashperk.com/) und [Logs-Dokumentation](https://docs.clashperk.com/features/logs).
- ClashPerk [Exporting Rosters](https://docs.clashperk.com/features/rosters/exporting-rosters).
- ClashPerk [FAQ / API-Erfassungsintervalle](https://docs.clashperk.com/faq).
- Beispiel [öffentliche Spieler-Kriegshistorie](https://clashperk.com/web/players/%23V0R9YQGU/wars).
- Community-Hinweis zu historischen `/export wars` und `/export cwl`: https://www.reddit.com/r/ClashOfClans/comments/1e8t8t5/
