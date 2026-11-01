# Changelog

Alle **neuen** veröffentlichten Versionen ab v1.0.0 werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) mit Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).
Die älteren Originalbezeichnungen und die vollständige Rückblick-Tabelle stehen in [VERSIONING.md](VERSIONING.md); die ursprünglichen detaillierten Notizen in [README.txt](README.txt).

## [Unreleased]

Keine offenen Änderungen für die nächste Version eingetragen.

## [1.3.8] - 2026-11-01

### Verbessert
- Cloud-Aktionen (Clan verlassen/löschen, Rollen ändern, Einladungen, Sicherungen und Statistik-Import) verwenden die vorhandenen App-Dialoge statt fremder Browser-Popups.
- Gefährliche Aktionen werden deutlich bezeichnet und bleiben durch bewusste Bestätigung geschützt.
- Statistikbeschriftungen vereinheitlicht: „3★-Quote“ und „Nicht genutzt“ statt gemischter technischer Begriffe.
- Hilfe und Nutzertexte dem tatsächlichen Cloud-Stand angepasst; interne Revisionen und Backup-Technik aus den Hauptmeldungen entfernt.
- Keine Änderung an CWL-Berechnung, Datenformat 9, Rollen-/Zugriffsrechten oder Supabase-Daten.

## Frühe Entwicklungsnotizen (historisch)

### In Entwicklung (damaliger Stand)
- Gemeinsamer Cloud-Modus und Clanmitgliederabgleich (v1.1.0 Alpha).
- v1.1.0-alpha.2: API-Berechtigungsfix beim Mitgliederimport, klare Clannavigation, Mitgliederimport als Hauptaktion und NEW-/Austritts-Kennzeichnung.
- v1.1.0-alpha.3: Bereinigte Gast-Mitgliederansicht, erster API-Import ohne massenhafte NEU-Badges, Namensstift, sichtbare Mehrfachauswahl mit Fertig, Clash-Reihenfolge, reaktionsschnellere Tagwechsel, 100 automatisch aktualisierte Änderungsereignisse und Cloud-Hilfe.
- v1.1.0-alpha.4: sichtbar anklickbare Stifte für Spielernamen, gleich hohe Sortier- und Mehrfachauswahlbuttons, klar bezeichnete eigene/geteilte Clans, ungefährer Aktivitätsstatus, sicherer Clan-Austritt bzw. bestätigtes Löschen, Rückmeldung nach Cloud-Aktualisierung und automatische Versionsprüfung.
- v1.1.0-alpha.5: Kleine Änderungsmeldungen mit Namen, automatischer Cloud-Abgleich mit Rückfallprüfung, bestätigtes Löschen archivierter CWLs und sofortige Update-Prüfung beim Öffnen/Interagieren. Neuigkeiten der letzten Version direkt bei der App-Version.
- v1.1.0-alpha.6: Zugriffsübersicht mit angenommenen Einladungen und Rollen, Ingame-Namenpflicht beim Beitritt, Einladungen durch Vize, Kopiermeldung und sichere Behandlung ausgeschiedener Spieler in CWL-Aufstellungen.
- v1.1.0-alpha.7: Rechte von Vizes/Beobachtern ändern, Zugänge entfernen, offene Einladungen zurückziehen, Mitgliederabgleich direkt in der Liste, sichtbare Dabei-/Fix-Schalter, klarere Auswahl/Filter und kompakte Release-Hinweise; Passwortwiederherstellung per E-Mail.
- v1.1.0-alpha.8: Namensstift funktioniert auch nach Suche/Filterwechsel; FIX optisch neutral statt rot; beruhigte Focus-Ränder; mobil reparierte Gast-Kopfzeile; Passwort-Reset im eigenen Dialog und offene Einladungen direkt bei Personen mit Zugriff.
- v1.1.0-alpha.9: Automatische Cloud-Sicherungspunkte (max. 24), Besitzer-Wiederherstellung und JSON-Download, täglicher verschlüsselter externer Sicherungsworkflow (nach GitHub-Secrets-Einrichtung), weniger lokale Schreibzugriffe und optimierte Spielersortierung.
- v1.0.2: Wartungspatch für die stabile Offline-PWA – unverändertes Datenformat v9, redundante lokale Schreibvorgänge reduziert und gleichbleibender CWL-Algorithmus mit effizienterem Sortierindex.

## [1.0.1] - 2026-10-30

### Behoben
- Service-Worker verwechselt ergänzende HTML-Seiten nicht mehr mit dem lokalen Offline-Fallback der Haupt-App. Datenformat und lokale Profile unverändert.

### Geplant
- Gemeinsame, geschützte Clanprofile mit Supabase, Benutzerrollen und Synchronisierung.
- Optionaler Mitgliederabgleich über die offizielle Clash-of-Clans-API.

Die geplanten Punkte sind noch nicht Bestandteil der veröffentlichten Anwendung.

## [1.0.0] - 2026-10-29

### Geändert
- Einheitliche SemVer-App-Versionsnummer anstelle der historisch gewachsenen Kennungen v1–v9.6.1.
- PWA-Cache-Kennung an die neue Versionsnummer angepasst.
- Historische Versionszuordnung und künftig verbindliche Release-Regeln dokumentiert.
- Versions-/Datenkompatibilität durch einen Regressionstest abgesichert.

### Unverändert
- Sämtliche Funktionen des zuvor veröffentlichten v9.6.1-Standes (inklusive iPhone-Statusleisten-Hotfix).
- Datenformat `9`, Speicherkeys, Profile, CWL-Archive, Backup- und Wiederherstellungsverhalten.
- Offline-Fallback, bestehende Benutzeroberfläche und Planungslogik.

## Frühere Stände (Legacy)
- `v9.6.1` – iPhone-PWA-Statusleisten-Hotfix, letzter Stand vor der SemVer-Umstellung.
- `v9.6.0` – Fairness-/Historien- und UX-Release; enthält die vorherigen v9.5-Entwicklungsänderungen.
- `v1` bis `v9.4.2` – historische Entwicklungsmeilensteine; Details und rückblickende Zuordnung: [VERSIONING.md](VERSIONING.md).


## v1.2.0 – 31.10.2026 · Offizielle Cloud-Version mit optionalen CWL-Livedaten

- **Freigabe:** Die bisherige gemeinsame Cloud-Basis aus v1.1.0-alpha.9 wird nach erfolgreichem Backup-/Restore-Test als regulärer Cloud-Modus geführt. Die separate Offline-PWA bleibt v1.0.2.
- **CWL-Gegner:** In der Cloud-Planansicht erscheinen bekannte Gegner pro Runde mit ihrer tatsächlichen Kriegsaufstellung und Rathaus-Verteilung. Unveröffentlichte Runden (z. B. API-War-Tag #0) bleiben als unbekannt gekennzeichnet.
- **Angriffe:** Für bekannte Kriege sind tatsächliche eigene Angriffe samt Ziel, Sternen und Zerstörung abrufbar. Daten werden nur angezeigt, sofern Supercell sie freigibt.
- **Tagesabschluss:** Beendete CWL-Kriege werden beim Cloud-Abgleich automatisch mit den tatsächlich beteiligten Spielern gespeichert, wenn Saison, Kriegs-Tag, Zeitstempel und vollständiges 15-/30-Spieler-Line-up passen. Bereits gespeicherte/manuelle Tage werden niemals ungefragt überschrieben. Folgetage werden mit der bisherigen Rotation neu berechnet.
- **Sicherheit:** API-Key nur in Supabase Edge Function, authentifizierte Clanmitgliedschaft erforderlich. Bei API-Ausfall, unsicherer Zuordnung oder fehlenden Daten bleibt der Plan unverändert.
- **Grenze:** Automatisches Nachziehen erfolgt, solange die Cloud-App geöffnet ist oder beim nächsten Öffnen. Ein unbeaufsichtigter serverseitiger CWL-Abschluss wurde nicht eingerichtet. Vor der nächsten realen CWL ist nur eine simulierte API-Regressionsprüfung möglich.
- **Kompatibilität:** Datenformat v9 und bestehender Speicherkey unverändert; bestehende Profile, gespielte Tage und Archive bleiben erhalten. Optionaler Cloud-Metadatenblock und Kriegs-Tag je API-Abschluss.


## v1.2.1 – 31.10.2026 · Live-Spielstand und Clanwappen

- Die Cloud-Tageskarten zeigen die **offiziellen Kriegssterne** als groß gesetztes Ergebnis zwischen beiden Clannamen und dem Wappen der jeweiligen Clans.
- Die offiziellen Wappen-URLs werden bevorzugt aus der Kriegsantwort, ersatzweise aus dem CWL-Ligagruppen-Eintrag bezogen. Nur HTTPS-Bilder der offiziellen `api-assets.clashofclans.com`-Badge-Pfade werden angenommen; fehlende oder nicht ladende Bilder erhalten ein neutrales Schild.
- Bei unbekannten Werten erscheint `–` statt einer erfundenen Null. Optionaler prozentualer Zerstörungswert macht Gleichstände nachvollziehbar.
- Scoreboard nutzt `clan.stars` / `opponent.stars`; es summiert **nicht** alle Einzelangriffe. Das entspricht dem tatsächlichen Kriegsstand.
- Die isolierte CWL-Simulation zeigt ebenfalls den Sternestand (z. B. 35:27 nach dem ersten vollständigen Tag), jedoch bewusst keine echten Clanbilder oder externen Downloads.
- Datenformat 9, bestehende Tagesabschlüsse, manuelle Planung, Offline-PWA und Supabase-Berechtigungen bleiben unverändert. Die Live-API-Integration muss mit einer realen CWL noch praktisch bestätigt werden.


## v1.2.2 – 31.10.2026 · Kompakte CWL-Angriffszeilen

- „Spieler und Angriffe anzeigen“ nutzt nun ein auf iPhone und Desktop gut lesbares Log-Layout: drei Sterne (gefüllt/leer), Prozent-Badge, Angreifer mit Rathausstufe, `vs`, Ziel mit Rathausstufe und Name.
- Während `inWar` erscheinen Spieler ohne Angriff ganz oben (Status „Angriff offen“); erledigte Angriffe folgen in ihrer Aufstellungsreihenfolge.
- Nach `warEnded` bleibt die tatsächliche Aufstellungsreihenfolge bestehen; fehlende Angriffe heißen „Kein Angriff erfasst“ statt eine nicht beobachtete Attacke zu behaupten.
- Während der Vorbereitung wird keine Angriffsleistung vorgetäuscht. Fehlende Zielinformationen sind explizit als unbekannt gekennzeichnet. Mehrere Angriffe eines Spielers werden als separate Zeilen angezeigt.
- Aufgeklappte Angriffsdaten bleiben bei Hintergrundaktualisierungen geöffnet. Alle Eingaben in UI-HTML werden weiterhin escaped und API-Daten vorher normalisiert.
- Nur UI-Änderung: Kein neuer API-Endpunkt, keine Änderung an der Supabase-Datenbank, keine Änderungen an Tagesabschluss, Rotation, Rein/Raus oder der eigenständigen Offline-PWA.


## v1.3.0 – 31.10.2026 · Clanstatistik mit historischem Import

- Neuer privater **Statistik**-Tab für gemeinsame Clanführung. Auf Mobilgeräten wie ClashPerk: Clan-Hit-Rate, erfasste Angriffe, verpasste Angriffe (nur wenn nachgewiesen), bester Spieler und sortierbare Spielerzeilen mit Rathaus, Hit Rate, Angriffe und Verpasst.
- Filter für **alle Kriege / normale Kriege / CWL**, **letzte 10/25/50** und **nur Angriffe auf gleich hohe oder höhere Rathäuser**; Spieler suchen und ehemalige Mitglieder ein-/ausblenden.
- Einmaliger JSON-Historienimport für den bereitgestellten ClashPerk-Excel-Export. Aus 50 Kriegen (29 normal, 21 CWL) werden nach Entdoppelung **1.139 eindeutige eigene Angriffe** (ursprünglich 1.244 Angriffseinträge) importierbar. Die Rohdaten werden nicht ins öffentliche Repository eingecheckt. Import nur durch Besitzer/Vize in den verknüpften Clan-Tag.
- Speicherung in separaten Postgres-Tabellen mit clanbezogener RLS, getrennt vom bestehenden v9-CWL-Plan und archivierten Rotationen.
- Zukünftige beendete normale Kriege und CWL-Runden werden bei geöffneter Cloud-App und API-Verfügbarkeit anhand echter Aufstellungen und Angriffe archiviert. Ohne laufende App kein garantierter 24/7-Historienserver; ältere Kriege müssen per Export nachgetragen werden.
- **Wichtige Datenlücke:** Der Excel-Angriffsexport enthält keine vollständigen historischen Kriegsaufstellungen. Individuell verpasste Angriffe können daraus nicht zuverlässig ermittelt werden und werden als „–“ angezeigt, niemals als erfundene Null.
- Offline-PWA v1.0.2 und Datenformat 9 bleiben unverändert.


## v1.3.1 – 31.10.2026 · Historische verpasste Angriffe

- Separater ClashPerk-`Missed Attacks`-Export analysiert: United Fighters 95 Zeilen (125 verpasste Angriffe über einen größeren Zeitraum); für die bereits importierbaren letzten 50 Kriege matchen 42 Missed-Einträge aus 22 regulären Kriegen mit 57 dokumentierten verpassten Angriffen.
- `UF 2` vollständig ausgeschlossen. Import ist anhand Clan-Tag, eindeutiger Kriegs-ID und Player-Tag validiert, idempotent und für Clanbesitzer/Vize.
- Neues RLS-geschütztes `cwl_stat_missed` und expliziter `missed_log_complete`-Schalter pro erfasstem normalen Krieg. Bestehender Statistik-Import bleibt kompatibel, der neue JSON-Import erweitert ihn.
- Filter „Normale CWs“ kann verpasste Angriffe aus dem vollständigen Missed-Export ausweisen, auch für Spieler ohne einzigen Angriff. Der Import umfasst ausschließlich reguläre Kriege; historische CWL-Fehlangriffe bleiben unbekannt.
- Bei gemischter Statistik zeigen wir `≥N` für nachgewiesene Fehlangriffe mit unvollständiger CWL-Abdeckung, sonst `–` statt irreführender Null. Die TH-Filterung beeinflusst die Hit Rate, nicht Missed.
- Keine Änderung am CWL-Plan, vorhandenen Locks, Cloud-Benutzern oder Datenformat v9. Erneutes Importieren aktualisiert dieselben war-/tagbasierten Datensätze und erzeugt keine Duplikate.


## v1.3.2 – 31.10.2026 · CWL-Missed-Nachtrag, Navigation & Logout

- Im zweiten Missed-Attacks-Export wurden **zwei verpasste CWL-Angriffe** gefunden, die zu den 50 bereits erfassten Kriegen gehören. Zusammen mit den 57 verpassten Angriffen normaler CWs sind **59 Fehlangriffe belegt**; historische CWL-Gesamtwerte bleiben mangels vollständiger Abdeckung ausdrücklich unbekannt.
- CWL-Missed-Einträge werden nun nach War-ID/Player-Tag akzeptiert, auch ohne Vollständigkeitskennzeichnung der CWL. Für gemischte Filter erscheinen belegte Untergrenzen (z. B. `≥59` über alle 50 Kriege), während 0 weiterhin nur bei tatsächlich nachgewiesener Abdeckung angezeigt wird.
- Die vier Cloud-Tabs **Plan, Mitglieder, Übersicht und Statistik** belegen am iPhone gemeinsam eine einzige Zeile mit vier gleich breiten Spalten; im Gastmodus bleiben die drei bisherigen Tabs.
- Beim Logout wird eine offene Statistikansicht sofort geschlossen und automatisch zum **Plan** gewechselt. Der Statistik-Tab wird ausgeblendet, bevor private Cloud-Daten zurückgesetzt werden.
- **Normale CWs** werden weiterhin über den separaten `currentwar`-Abruf nach Kriegsende in die Statistik übernommen, unabhängig vom CWL-Plan. Die normale Planung verändert sich dadurch nicht. Die automatisierte Erfassung erfolgt derzeit bei geöffneter/erneut geöffneter App und nur solange Supercell den Krieg noch ausliefert.
- Offline-PWA und Datenformat v9 unverändert. Weitere Unit- und Chromium-Regressionstests ergänzt.


## v1.3.3 – 31.10.2026 · Fix Statistik-Historienimport

- Behebt den Fehler `null value in column "missed_log_complete" violates not-null constraint` beim erstmaligen Import der 50-Kriege-JSON.
- Ursache: Der Importvalidator übernahm nur `true` und ließ explizites `false` bei CWL-Kriegen weg; der PostgREST-Bulk-Upsert erzeugte daraus `NULL` trotz SQL-Default.
- Jeder importierte Krieg trägt nun explizit `missed_log_complete: false` oder `true`. Zusätzlich normalisiert der Client den Wert direkt vor dem Upsert erneut auf einen echten Boolean. Vorhandene und ältere JSON-Importdateien bleiben verwendbar, es muss keine neue Datei erzeugt werden.
- Entfernt das überflüssige grüne `3★ Hit Rate`-Badge bei der Spieler-Tabelle. Hit Rate bleibt als Spaltenüberschrift und Kennzahl unverändert.
- Regressionstest für normale CWs, CWL mit `false` und fehlende Flags; keine Änderungen an Planung, Benutzerrechten, Datenformat v9 oder Kriegsaufstellungen.


## v1.3.4 – 31.10.2026 · CWL-Auswertungen nach Saisons statt Einzelkriegen

- Bisher bedeutete „CWL → Letzte 10“ **zehn einzelne CWL-Kriegstage**, nicht zehn Ligawettbewerbe. Da eine CWL regulär sieben Kriegstage umfasst, war das für Spieler über mehrere Saisons missverständlich.
- Die CWL-Statistik bietet jetzt explizit **Letzte 1 CWL / Letzte 2 CWLs / Letzte 3 CWLs / Alle CWLs**. Saisons werden nach dem UTC-Monat der gespeicherten CWL-Kriegstage gruppiert, unabhängig davon, ob eine Saison vollständig erfasst wurde.
- Direkt unter den vier KPI-Karten stehen die **ausgewählten CWL-Kriegstage**, die Zahl der berücksichtigten Saisons und die genaue Monatsabdeckung, beispielsweise „August 2026: 7 von 7 Kriegstagen gespeichert“.
- Für normale CWs und den Gesamtfilter bleibt „Letzte 10/25/50 Kriege“ erhalten, jedoch ausdrücklich mit dem Wort „Kriege“.
- Abgleich der privaten Historie von United Fighters: August 2026 (7), September (7), Oktober (7) = 21 CWL-Kriegstage. UF⚡Weiss hat in dieser Quelle 21 Angriffe in 21 Tagen und 21×3 Sterne; die vorherige Auswahl letzter 10 zeigte daher nur 10 davon.
- Keine Änderung der API, Speicherung, Sicherheit, Hit-Rate-Formel oder CWL-Planung. Datenformat v9 und Offline-PWA bleiben erhalten.


## v1.3.5 – 31.10.2026 · Clanübersicht, faire Statistik und Mitgliederabgleich

- **Aktueller Clankrieg:** Normale laufende CWs werden als kompakte, aufklappbare Karte im Tab „Übersicht“ angezeigt: Gegner, offizielle Kriegssterne, Kriegsgröße, Ende und genutzte/offene Angriffe. Keine zusätzliche Navigationsleiste, keine Vermischung mit der CWL-Einteilung. Ohne aktuellen normalen Krieg bleibt die Karte ausgeblendet.
- **Statistik-Rollfenster:** Standardmäßig letzte 50 normale CWs plus drei letzte CWL-Saisons; bei jedem neu archivierten normalen Krieg fällt der älteste aus der **Auswertung**, nicht aus der Datenbank (Sicherung vor Datenverlust). Normal-CW-Filter können weiterhin 10/25/50 Kriege anzeigen und CWL 1/2/3/alle Saisons. Nur tatsächlich ausgeführte Angriffe bestimmen die 3-Sterne-Quote; Nichtteilnahme senkt sie nicht.
- **Mitglieder aktualisieren:** Safari-TypeError durch den ungültigen Scroll-Parameter `scrollIntoView({behavior:"nearest"})` behoben (`behavior:"auto",block:"nearest"`). Verständliche Fehlermeldung für erneuten Abgleich ergänzt. Der API-Abruf erfolgt weiterhin erst nach Speicherung und prüft alle Änderungen vor Übernahme.
- **Texte überarbeitet:** Neuer Clanleiter erkennt nun Zweck und Bedeutung von Plan, Übersicht, Statistik und 3-Sterne-Quote; veraltete Hinweise zu fehlender automatischer Ergebnisübernahme sowie technische Release-/API-Formulierungen entfernt. Keine Änderungen an Gast-PWA, Datenformat 9 oder bestehendem CWL-Plan.
- **Einschränkung:** Normale CWs werden derzeit nur dann automatisch archiviert, wenn ein beendeter Krieg beim Cloud-Abgleich noch über die Clash-API verfügbar ist. Kein eigenständiger 24/7-Dienst.


## v1.3.6 – 31.10.2026 · Safari-Mitgliederabgleich und Cloud-Cache

- Safari zeigte trotz erfolgreichem HTTP-200-Abruf der Clash-Clanmitglieder weiterhin „Type error“, während derselbe Abgleich in einem anderen Browser gelang. Die Supabase-Edge-Logs bestätigen die erfolgreichen HTTP-POST-Antworten in Safari; **der genaue auslösende Browser-Schritt lässt sich ohne Safari-Fehlerstack nicht abschließend beweisen**.
- Konkreten Cache-Bug behoben: `cloud-app.html` v1.3.5 band `cloud-sync.mjs?v=1.3.4` ein, weshalb Safari eine veraltete Version aus dem vorhandenen Offline-Service-Worker-Cache laden konnte.
- Auf `v1.3.6` synchronisierte Modul-Versionskennungen und Cloud-Code/Cloud-Versionsdatei vom Cache-First-Verfahren ausgeschlossen. Die lokale Offline-PWA bleibt samt ihrem Cache-Namen unverändert; die neue Worker-Logik lädt Cloud-Code immer frisch.
- Der Clanmitgliederabgleich versucht bei einem Transport-/Fetch-Fehler des Supabase-JavaScript-SDKs einen **zweiten, rein lesenden** Aufruf mit dem vorhandenen Benutzer-JWT und dem öffentlichen Supabase-Schlüssel. Die bestehende, serverseitige Clanmitgliedschaftsprüfung bleibt aktiv; keine Berechtigungserweiterung.
- API-Antworten vor der Verarbeitung validiert. Der lokale Abgleich toleriert fehlende oder unvollständige Tages-Lineup-Felder und zeigt bei JavaScript-TypeError künftig den betroffenen Verarbeitungsschritt statt nur „Type error“.
- Tests für Cachekonsistenz, Safari-Transportfehler-Fallback, gültige/nicht gültige Daten und Vergleichsschritt. Die tatsächliche Safari-Nachprüfung mit bestehender Benutzer-Sitzung bleibt nach Veröffentlichung erforderlich.


## v1.3.7 – 31.10.2026 · Einstellungen über Zahnrad

- **Aufgeräumte Übersicht:** „Profile / Clans“ und „Einstellungen & Daten“ sind aus dem Tab „Übersicht“ ausgezogen. Dort bleiben ausschließlich Einsatzverteilung, vergangene CWLs und der aktuelle normale Clankrieg.
- Neues **Zahnrad direkt neben der Clan-Auswahl** in der oberen Leiste. Es öffnet eine eigene Einstellungsansicht (ohne fünften unteren Tab) mit den bisherigen Optionen für Profile, CWL-Grunddaten, Farbschema, Export/Backup, Wiederherstellung und Zurücksetzen.
- Im gemeinsamen Cloud-Clan findet man dort zusätzlich „Clan & Konto öffnen“, um wie bisher Clans, Zugriffsrechte, Einladungen, Cloud-Sicherungen und Anmeldedaten zu verwalten. Ohne Anmeldung sind die lokalen Profileinstellungen zugänglich.
- Die bestehenden Control-IDs und Speicheraktionen wurden **verschoben, nicht neu implementiert**. CWL-Aufstellungen, Cloud-Daten und das Speicherformat v9 bleiben unverändert.
- Neue UI-Regressionsprüfung für 320–1280 px, Navigation zwischen Zahnrad und unteren Tabs, Gast-/Cloud-Modus und vorhandene Steuerelemente.
- Viewer-Rechte gelten auch auf der neuen Einstellungsseite; Farbschema, Exporte und der Weg zum Konto bleiben zugänglich.
