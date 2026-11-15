# Spielerform, CWL-Planung und späterer Verteidigungs-Analyzer

Stand: 15.11.2026. **Roadmap, keine stillschweigende Freigabe von Planner-Automatik.**

## Umgesetzt in PR #303 (v1.23.0, vor Freigabe)
- Spielerstatistik: übersichtliche Wahl zwischen Zeitraum und Anzahl letzter Kriege. Keine Kombination zweier impliziter Filterlimits.
- Spielerform: Gesamtform CW + CWL und reine CWL-Form mit derselben 65/35-Heuristik. Beide behalten explizite Kalenderfenster und dokumentierte Angriffs-/Missed-Nachweise.
- Mitglieder: letzter tatsächlich dokumentierter CWL-Durchgang. Nur wenn ein Spieler dort **keinen belegten Pflichtangriff / keine Missed-Evidenz** hat, dienen die fünf jüngsten normalen CWs als klar gekennzeichnete Ersatzbasis. Sichtbar: Formwert **oder** Leistung bei offener Zuverlässigkeit, gleich-RH-Stichprobe, Datengrundlage. Kein automatisches Update der Planaufstellung.
- CWL-Historie wird als Gruppe von Kriegstagen nach bekannten Runs statt nur nach Monat gruppiert (auch zwei CWLs in einem Kalendermonat). Rein lesend; RLS-Clangrenzen bleiben erhalten.

## Nächste Stufe: Spielerform v2 / Kalibrierung
1. **Evidenzqualität und Quellenabdeckung:** fehlende Missed-Logs nie als 0 verpasst; Spieler ohne gleich-RH-Angriffe nicht mit 0% ranken. Clan-/API-/Export-Quellen getrennt kennzeichnen.
2. **Rathausniveau und Meta:** Historisches RH pro Angriff, aktuelles API-RH mit Prüfzeitpunkt getrennt. Schwierigkeit, gerushtes RH, Mirror/Angriffsrolle, Map-Position erst verwenden, wenn die Daten wirklich verfügbar und identifiziert sind.
3. **Chronologischer Backtest:** Trainings- und Testzeiträume strikt trennen; vorhandene 65/35-Gewichtung mit tatsächlichen CW-/CWL-Ergebnissen vergleichen. Formwert ist bis dahin eine Heuristik **ohne vorhergesagte Erfolgswahrscheinlichkeit**.
4. **UI bei kleinen Stichproben:** Qualität und Angriffszahl immer zeigen; keine automatische schlechte Bewertung für neue oder lange pausierende Clanmitglieder.

## Intelligenter Live-Planer (zukünftig, eigener PR)
- Lesende Vorschläge aus CWL-Spielerform, Zuverlässigkeit, Spielzielen und aktiven Planungsregeln ableiten.
- Harte Regeln (Fix/Teilnahme/Einsatzziel/8-Sterne-Ziel/gesperrte Aufstellungen) bleiben bindend. Keine heimliche Änderung.
- Owner bestätigt konkrete Wechsel; Vize kann Vorschläge einreichen. Bei fehlender Datenabdeckung bleibt der Vorschlag ausdrücklich unsicher.
- Fair / Strategisch / Wettkampf als bewusste Modi erst nach Kalibrierung, Regressionen und verständlicher Hilfe.

## Clanburg-/Verteidigungs-Analyzer (Forschung, später)
- Nur verifizierbare Gegnerarmee-Informationen aus tatsächlich verfügbaren historischen Logs/Quellen erfassen. **Nicht** behaupten, die offizielle Clash-API liefere sicher jedes vollständige gegnerische Truppenlayout.
- Frühestens nach mehreren beobachteten Kriegstagen vorsichtige *Empfehlungen* zu Clanburg-Besetzungen. Datenstand/Grund/Unsicherheit pro Vorschlag anzeigen; manuelle Entscheidung bleibt notwendig.
- Unabhängige Quellenprüfung, Meta-Verfallsdatum, Schutz vor Überanpassung und Testdaten mit verschiedenen TH-/CWL-Größen.

## Definition of Done für spätere Arbeit
UX_DESIGN_PRINCIPLES.md, COPY_STYLE_GUIDE.md, deutsche/englische Texte (sobald vollständige Sprachumschaltung verfügbar), Hilfe, Changelog und Versionen aktualisieren; Desktop/320px-Mobile, CWL-Sonderfälle, RLS und chronologische Testabdeckung prüfen.
