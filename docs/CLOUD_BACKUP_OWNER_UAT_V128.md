# Cloud v1.28.0 – praktische Besitzer-Abnahme: vollständiges Backup & Restore

**Status:** technische CI-/Staging-Abnahme für PR #339 abgeschlossen; **echte Geräte- und Original-Datei-Roundtrips weiterhin offen** (Issue [#213](https://github.com/Smolmig/cwl_planer/issues/213), Produktkriterium [#178](https://github.com/Smolmig/cwl_planer/issues/178)).

**Ziel:** Den sichtbaren Workflow **Mehr → Backup & Import** auf Desktop, iPhone/Safari/PWA und Android verifizieren, ohne jemals den produktiven Originalclan, aktive Kriege oder den gültigen CWL-Plan zu überschreiben.

## Vorbereitung – vor jedem Schreibtest

- Verwende die öffentliche Cloud-App in **v1.28.0** (Mehr → Design & Aktualisierung). Stelle sicher, dass du als **Besitzer** des Originalclans eingeloggt bist; der Test mit Vize/Beobachter erfolgt separat und bleibt *read-only*.
- Lege eine eindeutige Testkennung und einen Zeitstempel fest, z. B. `BACKUP-UAT-2026-11-22`. Halte den echten Originalclan, seine aktuelle Planrevision, vorhandene Kriege und Stats **vor dem Test** als Vergleich fest. Keine aktive CWL umplanen!
- Für **nur einen positiven Restore**: Erstelle über **Clan & Konto → Clan hinzufügen** *einen neuen, bisher unbenutzten Ersatzclan mit demselben Clash-Tag* unter deinem eigenen Konto. Der neue Eintrag hat zwingend eine andere interne App-Clan-ID. Nutze ausschließlich diesen Test-Ersatzclan als Wiederherstellungsziel. Keinen weiteren aktiven Clan auswählen.
- Für den Mehrclan-Test sind zwei *ursprüngliche* Besitzerclans und **zwei unterschiedliche neue, leere** ownerberechtigte Ersatzclans mit jeweils passenden Clash-Tags erforderlich. Ohne diese Voraussetzung **nicht erzwingen** – Ergebnis `Nicht testbar` oder `Später`.
- Exportdateien enthalten potenziell private Mitgliederdaten und historische Entscheidungen. **Nicht** in öffentliche GitHub-Issues/Discord-Channels oder unverschlüsselte Screenshots hochladen. Screenshots anonymisieren (Clan-Tags, E-Mail-Adressen, Spieler und Datenbank-IDs).

## Ausfüllbares Testprotokoll

Status pro Zeile: `Offen`, `OK`, `Fehler`, `Nicht testbar`, `Später`. Für Fehler: Datum, Browser/OS, Geräteklasse/Displaybreite, Gold/Dark/Light, Schritte, erwartetes/tatsächliches Ergebnis, Screenshot/Screenrecording (anonymisiert) und ggf. Issue-Link erfassen.

| ID | Gerät / Rolle | Durchführung | Erwartetes sichtbares Ergebnis | Status |
|---|---|---|---|---|
| B01 | Desktop / Owner | `Mehr → Backup & Import` öffnen | Genau zwei Hauptaktionen „Backup herunterladen“ und „Backup wiederherstellen“. Kein lokaler Alt-Export in derselben Cloud-Oberfläche, keine doppelte Überschrift, kein abgeschnittener Inhalt | Offen |
| B02 | Desktop / Owner | Gold-Theme, 1366 px, nach unten scrollen; dann Dark und Light | Kontrast, Fokus, Buttons, Felder und Text sind lesbar; Scroll-/Navigation bleibt erhalten | Offen |
| B03 | iPhone Safari, anschließend PWA / Owner | App frisch öffnen, Mehr → Backup & Import; Ausgabe und Dateidialog prüfen | Oberflächenbreite 390/430 px ohne horizontales Scrollen; Hauptaktionen gut antippbar; echtes JSON landet nachvollziehbar in Dateien/Downloads | Offen |
| B04 | Android Chrome/PWA / Owner | Entsprechender Export und Datei-Picker | Kein unklarer Bildschirmwechsel; Dateiauswahl funktioniert, Status sagt klar, ob Sicherung heruntergeladen wurde | Offen |
| B05 | Desktop / Owner | „Alle eigenen Clans“ wählen und „Backup herunterladen“ | Eine JSON-Datei mit dem Original-Herkunftsbeleg und allen 17 erlaubten Bereichen je Clan wird erzeugt; Datum und Umfang plausibel, keine Kontopasswörter/API-Schlüssel | Offen |
| B06 | Desktop / Owner | „Nur aktuellen Clan“ wählen, Datei exportieren | Quelle und Clananzahl stimmen ausschließlich für den ausgewählten eigenen Clan. Nicht eigene/Vize-Clans werden nicht fälschlich mitgesichert | Offen |
| B07 | Desktop / Vize, Viewer | Mehr → Backup & Import öffnen | Kein Recht, vollständige Daten fremder Clans herunterzuladen oder zurückzuschreiben; beide Aktionen gesperrt und begründet, sofern keine anderen eigenen Clans bestehen | Offen |
| B08 | Desktop / Owner | Exportierte gültige Datei wieder auswählen, aber **noch keinen Zielclan** wählen | Zuerst schreibgeschützte Dateiinformationen mit Clannamen, Clash-Tag, Anzahl und ursprünglichem Serverbeleg. **Keine** Datenbankänderung | Offen |
| B09 | Desktop / Owner | Manipulierte/verkürzte JSON-Kopie auswählen, danach Datei ohne Serverbeleg | Deutliche Fehler-/Warnmeldung; keine grüne Restore-Vorschau und keinerlei Schreibmöglichkeit; niemals im Original testen | Offen |
| B10 | Desktop / Owner | Als Ziel den Originalclan, einen fremden oder einen bereits benutzten Clan suchen | Diese Ziele erscheinen nicht als gültige neue Ersatzclans oder werden spätestens serverseitig bei der Vorschau **ohne Änderung** abgewiesen | Offen |
| B11 | Desktop / Owner | **Neuen leeren Test-Ersatzclan gleicher Clash-Tag** wählen, „Wiederherstellung sicher prüfen“ | Übersicht mit tatsächlich prüfbarer Datenanzahl, 17 Bereichen, gesperrten Tagen und Archivinfos. Bis hier kein Write | Offen |
| B12 | Desktop / Owner | Vorschau öffnen, abbrechen oder Bestätigungswort absichtlich falsch tippen | „Abgebrochen“, keine importierten Daten, Original- und Ersatzclan unverändert | Offen |
| B13 | Desktop / Owner | Vorschau bestätigen und **nur für neuen Test-Ersatzclan** das exakte Bestätigungswort eingeben | Transaktion erfolgreich; Profile, alte Kriege, Angriffe, Sterne, CWL-Archive, Entscheidungen und gespielte/gesperrte Tage im neuen Clan einsehbar. Originalclan unverändert | Offen |
| B14 | Desktop / Owner | Gleiche Sicherung erneut auf denselben bereits benutzten Ersatzclan einspielen wollen | Wiederholter Import wird verweigert, keine Doppelstatistiken oder überschriebenen aktiven Daten | Offen |
| B15 | Desktop / Owner | Datei-Auswahl oder Vorschau starten und **vor Bestätigung** Clan wechseln bzw. abmelden | Auswahl/Vorschau wird verworfen; keine Daten eines alten Kontos/Clans bleiben in der neuen Ansicht sichtbar | Offen |
| B16 | Desktop / Owner | Mit zwei ursprünglichen eigenen Clans und zwei leeren Test-Ersatzclans eine Gesamt-Vorschau ausführen; zunächst abbrechen | Exakt zugeordnete unterschiedliche neue Ziele, keine Zielduplikate. Nur wenn sicher: atomarer Test-Restore; bei Fehler keines der Ziele teilweise verändert | Offen |
| B17 | Desktop/Handy / Owner | Backup-Sprache DE → EN → DE wechseln | **Backup-Bereich** übersetzt Buttons, Fehler und Bestätigungsdialoge; Sprache wirkt ohne verlorene Auswahl/unsicheren Bestätigungszustand. Ganze App-Übersetzung ist damit nicht abgenommen | Offen |
| B18 | Alle Geräte / Owner | `Hilfe → vollständiges Cloud-Backup` sowie `Mehr → Update-Verlauf` öffnen | DE/EN-Grenzen und Unterschied zu fünf alten **Plan-only**-Sicherungen korrekt erklärt. v1.28.0 ist als jüngster Eintrag vorhanden | Offen |
| B19 | Desktop / Owner | Vor und nach Test Import stichprobenartig Quellen vergleichen (Kriege, Angriffssternen, Member, Archiv, abgehakte Verwaltung) | Mehrere konkrete Werte stimmen im *Ersatzclan* exakt; keine plausibilitätslosen neuen Nutzerkonten oder erfundenen API-Quellen | Offen |

## Regeln für Teststopp

- **Sofort stoppen**, wenn der Restore eine aktive Original-Clan-ID, fremde Owner-Daten oder bereits bespielte CWL-Tage als Ziel zulässt; keine weiteren Schreibversuche.
- Bei einem erfolgreichen Download ohne bestätigten Datei-Speicherort auf iOS/Android: `Fehler` oder `Nicht testbar`, nie aus einem UI-Toast allein auf eine vorhandene Datei schließen.
- Nach Totalverlust eines gesamten Supabase-Projekts ist die Benutzerdatei **allein** kein Herkunftsbeweis; nur ein **nach der Ausstellung des Original-Receipts erfolgreich archiviertes** verschlüsseltes Betreiber-Backup mit alten Auth-Identitäten schafft diese Grundlage. Einen echten gehosteten Gesamt-Neuaufbau **nicht** im laufenden Produktivprojekt testen.
- Unbekannte Auth-Autoren dürfen nicht durch erfundene Nutzer ersetzt werden.

## Abnahmeabschluss

**Geprüfte Version:** v1.28.0  
**Testdatum / Zeitzone:** ______ (Europe/Vienna)  
**Owner-Rolle / Testclans (anonymisiert):** ______  
**iPhone / iOS / PWA-Version:** ______  
**Android / Browser / PWA-Version:** ______  
**Desktop / Browser-Version:** ______  
**Gold/Dark/Light:** ______  
**Erfolgreiche Prüfschritte:** ______ von 19  
**Nicht testbar / Später:** ______  
**Blocker / Issue-Links:** ______

**Freigabe:** Erst wenn der echte Geräte- und Besitzer-Roundtrip ohne kritische Findings nachgewiesen ist. Die automatisierte CI und synthetische PostgreSQL-17-Restore-Fixture können diesen Schluss **nicht** stellvertretend liefern.
