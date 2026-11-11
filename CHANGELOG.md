# Changelog

Alle **neuen** veröffentlichten Versionen ab v1.0.0 werden hier dokumentiert.
Format: [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) mit Versionierung nach [Semantic Versioning](https://semver.org/lang/de/).
Die älteren Originalbezeichnungen und die vollständige Rückblick-Tabelle stehen in [VERSIONING.md](VERSIONING.md); die ursprünglichen detaillierten Notizen in [README.txt](README.txt).

## [Unreleased]

### P0 #104 – Collector-Scheduler und vollständige Clanlisten (Infrastruktur, kein Cloud-App-Release)
- GitHub-`schedule` erhält zwei off-peak Startchancen je Stunde (`:17`/`:47` UTC, best effort) statt einer. Die bestehenden kurzlebigen GitHub-OIDC-Identitäts-/Signaturprüfungen, die exakte Workflow-Identität und der Scheduler-Mutex bleiben unverändert. Ein Workflow-Datei-Push löst einen signierten Funktionstest aus.
- Fehler beim vollständigen Clanlisten-Abruf werden nicht mehr als Vollerfolg maskiert: getrennte aggregierte, sicher klassifizierte Fehlergründe statt Clan- oder Spielerdaten; 503 und fehlschlagender GitHub-Job bei unvollständiger Clanzeit-/Spenden-Beobachtung. Erfasste Kriegsdaten bleiben erhalten; fehlende Historie/Angriffe werden nicht rückwirkend erfunden.
- Help-Text unverändert geprüft: keine UI- oder Nutzerregeländerung. Bei ausbleibenden GitHub-Schedule-Events weiterhin keine Garantie regelmäßiger Läufe; das ist nur Risikoreduktion und bessere Überwachung.


## [1.16.72] - 2026-11-11

### Serverseitige Planzyklus-Prüfung für Freigabe und Vize-Vorschläge (#37)
- **Verbindliche Zykluskennung:** Freigabe, Wiederöffnung, neue CWL, Vorschläge sowie Annehmen/Ablehnen/Zurückziehen nennen die zuvor gelesene `cycle_id` und `season`. Supabase prüft beide Werte unter derselben Zeilensperre wie die Mutation. Ein alter Tab kann nach dem Wechsel nicht in den neuen Zyklus schreiben.
- **Belegtes Saisonende:** Das Backend prüft ausschließlich die servicegeschützten Clash-Gruppenarchive. Wenn der eigene letzte CWL-Krieg dort tatsächlich als `warEnded` belegt ist, werden Freigaben/Vorschläge gesperrt. Eine unvollständige 6/7-Saison **ohne** verifizierten letzten Krieg bleibt ungewiss und wird nicht anhand des Datums als beendet erklärt.
- **Sichere Einführung:** Neue `*_checked`-RPCs sind als additive Migration vorgesehen; alte ungeschützte RPC-Berechtigungen werden **erst nach aktualisiertem Client und geprüftem Deployment** separat widerrufen. Bis zur Abschaltung der Legacy-Endpunkte ist die serverseitige Absicherung ausdrücklich **noch nicht vollständig aktiv**. Alte Tabs müssen danach aktualisiert werden.
- **Keine Datenumschreibung:** Gespielte Tage, Vorschlagshistorie, Clanrollen, Offline-PWA, Solver und Archive bleiben unangetastet; der Owner-offline-Saisonwechsel und vollständige 6/7-Verifikation bleiben #227.
- Hilfe, Changelog, Release-History, aktuelle Settings-Hinweise und Tests aktualisiert; echte Mehrgeräte-/Rollen-UAT #213 noch offen.

## [1.16.71] - 2026-11-11

### Planfreigabe nach der CWL vorübergehend ausblenden (#37, #227)
- Wenn die bestehende Clash-Erkennung die CWL als beendet oder die CWL-Pause als bestätigt kennzeichnet, zeigt „Mitglieder“ statt des alten Freigabe-Buttons einen dezenten Hinweis. Dasselbe Signal wird bereits für den Einsätze-Tab verwendet.
- Bereits geöffnete Freigabe-Details werden geschlossen; vor Freigabe, Einreichen und Entscheidung über Vorschläge prüft der Cloud-Client den bestätigten Zustand noch einmal. Bei der nächsten neuen, planbaren CWL-Vorbereitung stehen die Aktionen wieder bereit.
- Hilfe, aktuelle Update-Notiz, öffentlicher Verlauf, Browser-Cache und Rollen-/Saison-Tests angepasst. Keine Änderung an Planberechnung, gespielten Einsätzen, archivierten Daten, Cloud-Profilen, RLS oder Supabase-RPCs.
- **Offen:** serverseitige Zyklus-/Saisonprüfung gegen direkt gesendete oder verspätete RPCs und autonome Eröffnung der nächsten Saison (#227), historische Einsatzansicht (#187) und echte Geräte-/Rollenabnahme (#213).

## [1.16.70] - 2026-11-11

### Einsätze zwischen den CWLs: alte Saison nicht als aktuell darstellen (#187)
- **Nur bestätigte Saisonphasen:** Wenn die bestehende Clash-/CWL-Lifecycle-Anzeige bereits `postseason`, `transition` oder eine bestätigte CWL-Pause meldet, ist im Tab `Einsätze` nicht mehr die alte Verteilung mit Fortschrittsbalken, 8★-Stand und Filtern sichtbar, sondern „Aktuell keine CWL-Einsätze“ und ein direkter Link zum CWL-Archiv. Die Saison-Erkennung selbst bleibt unverändert.
- **Neue CWL vor Tag 1:** Wenn die bestätigte nächste Planung beginnt, blendet die vorhandene Lifecycle-Klasse die laufende Einsatzübersicht wieder ein. Während der CWL gelten alle bisherigen Filter und Berechnungen.
- **Keine Daten- oder Planänderungen:** Alte Lock-/Planungs-/Kriegsdaten bleiben unverändert gespeichert; bestehende Planarchive und Gruppenergebnisse bleiben einzeln lesbar. Für unklare oder veraltete Clash-API-Daten wird kein Ende erfunden. Gast-/Offline-PWA bleibt unverändert.
- **Hilfe und Update-Verlauf** ergänzt; mobile Browser-, Viewer-, Clanwechsel-, Live-/Offseason- und Navigations-Regressionen hinzugefügt.
- **Offen:** Vollständige read-only historische Einsatzmatrix mit belegten Sternen/Zielen, serverseitige Cycle-Grenzen und Planfreigabe nach CWL-Ende gemäß #187/#37/#227; echte Owner/Vize/Viewer-Abnahme #213.

## [1.16.69] - 2026-11-11

### Mehr, CWL-Archiv und Clan & Konto verständlicher (#226)
- **Mehr:** Kürzere Menübeschreibungen für Clan, Archiv, Clanverwaltung und JSON-Sicherungen. Bestehende Unterseiten und Aktionen bleiben an Ort und Stelle.
- **CWL-Archiv:** Gruppenergebnisse aus Clash klar von **archivierten CWL-Plänen** (Aufstellungen und Einsätze) getrennt; aussagekräftige Leer- und Ladehinweise. Der Gruppenstand ist kein Archiv einzelner Angriffsstatistiken. Fehlende archivierte Pläne sind nicht gleichbedeutend mit fehlenden Gruppenständen. Archivzeilen und Löschhinweis nennen die tatsächliche Datenart und die Notwendigkeit einer vorherigen JSON-Sicherung.
- **Clan & Konto:** Eindeutigere Schaltflächen für Abmeldung und Prüfung des gemeinsamen Planstands. App-Rollen (Beobachter / Vize / Besitzer) und ihre Trennung von Ingame-Rängen verständlicher erklärt. Wiederherstellbare Cloud-Planstände von lokalen JSON-Dateien abgegrenzt; Sicherungsstände enthalten nicht Statistik/Konten/Rollen. Kein Zugriff verändert.
- **Einstellungen:** Beobachtern wird bei den CWL-Regeln ein Lesemodus-Hinweis angezeigt. Bestehende Rollenprüfung und deaktivierte Schreibaktionen bleiben unverändert.
- **Hilfe**, öffentliche Update-History, „Neu in …“, Release-Version, Cache-Parameter und Regressionstests synchronisiert.
- **Keine Änderung** an Berechtigungen (Supabase/RLS), Benutzer-/Clan-Daten, API, Solver, Import-/Export-Logik, Backup-Schema, Archivierungsmechanik oder Offline-PWA. Echte Owner-/Vize-/Viewer-Abnahme auf iOS/Android #213 bleibt offen.

## [1.16.68] - 2026-11-11

### Statistik: Vergleiche und Kriegsverlauf verständlicher (#226)
- **Vergleiche:** Einfache Erläuterung zum gewählten Kriegsumfang. Eine leere Auswahl bzw. abgeschlossene Kriege ohne erfasste Angriffe werden als fehlende Daten statt als 0-%-Quote dargestellt; der direkte Spielervergleich erklärt die Voraussetzung zweier Spieler mit belegten Angriffen.
- **Verlauf & Kriege:** „KW 12/26“ als Kalenderwoche 12 im Jahr 2026 erklärt; letzte 30/90/180/365 Tage einheitlich beschriftet; klar benannte Wochen-/Tages-/Monatsansicht. Erfasste Angriffszahlen, Achsenlücken und leere Zeiträume besser erläutert. In der Kriegsliste heißt die Sternsumme ausdrücklich „erfasste Sterne“, damit niemand sie mit dem offiziellen Kriegsergebnis verwechselt; gefilterte Leeransichten bieten eine klare Handlung.
- **Hilfe:** Datengrundlage für Vergleiche, unabhängige Filter, 3★-Quote und Ø Sterne pro Angriff, Kalenderwochen und Sternsumme erklärt.
- Öffentlicher Update-Verlauf, aktueller Einstellungs-Changelog, Cloud-Version und Cache-Busting mitgepflegt; zusätzliche Regressionen für Copy-/Leerdatenfälle.
- **Unverändert:** Werteberechnungen, Quell-/Verifizierungsregeln, Auswahl-/Filtersemantik, Auth/RLS, Cloud-Daten und Offline-PWA. Echte Mobile-/Rollen-UAT #213 bleibt ausstehend.

## [1.16.67] - 2026-11-11

### Einsätze und Mitglieder: Klartext bei der Planung (#226)
- **Mitglieder:** Einfacherer Einstiegstext, eindeutige Hinweise zum Clash-Abgleich bei leerer Liste, verständlichere Sortierung der letzten sieben Angriffe und kürzere Statushinweise. Die Tagesregeln zeigen jetzt ausdrücklich „Tagesregeln anzeigen“ bzw. „Tagesregeln schließen“ mit Richtungspfeil.
- **Einsätze:** Sortierung nach „Offene Einsätze“, „Abstand zu 8★“ und „Ausgeführte Angriffe“ statt ungeklärter AG-Kürzel. „3/4“ ist als „Im Plan: 3/4 Einsätze“ bzw. „Ziel: 3/4 Einsätze“ klar zugeordnet. Freie Tage heißen „Tage verfügbar“ statt „Tage ohne RAUS“; Tooltip und Legende erklären die belegten Angriffe in Alltagssprache.
- **Hilfe:** Einsatzfilter inklusive kombinierbarer Chips, bestätigten Zielen und unvollständigen CWL-Daten ohne privaten Beispielnamen erläutert; Datenbasis aktuelle CWL versus letzte sieben CW-/CWL-Angriffe sauber unterschieden.
- Version v1.16.67, App-Hinweis unter Design & Aktualisierung, öffentlicher Update-Verlauf, Cache-Parameter und Regressionstests synchronisiert.
- **Keine Änderung** an Filter-/Planungsalgorithmus, Einsatz-/Sterneberechnung, Cloud-Daten, Berechtigungen, API, Datenbank oder Offline-PWA. Echte Geräte-/Owner-/Viewer-Prüfung #213 bleibt ausstehend.

## [1.16.66] - 2026-11-11

### Öffentlicher Update-Verlauf für alle Nutzer
- **Mehr → Update-Verlauf:** Neue lesbare Unterseite mit der gesamten dokumentierten Historie von v1.0.0 bis zum aktuellen Stand, nach tatsächlichem Cloud-Veröffentlichungsdatum gruppiert und mit Themen-/Versionssuche. Die ältere Entwicklungszeit vor v1.0.0 ist als eigene, ehrlich datierte Meilenstein-Gruppe enthalten (ohne erfundene Einzeldaten).
- **Verständlich statt Entwicklersprache:** 124 kurze, redaktionell formulierte Einträge, wichtige Neuerungen mit ergänzendem Satz. Gruppen sind aufklappbar, damit auch die vielen kleinen Updates lesbar bleiben. Keine technische Roh-Changelog-Textwand in der App.
- **Einstieg:** Eigene Seite unter Mehr sowie „Alle Updates ansehen“ beim bisherigen Hinweis zur neuesten Version unter Design & Aktualisierung. Bestehender aktueller Changelog bleibt; Hilfe erläutert den neuen Verlauf.
- **Technik:** Statisches, nur beim Öffnen geladenes Cloud-Modul; keine Datenbank, keinen Login, keinen zusätzlichen Start-Request und keine Veränderung der Offline-PWA. Cloud-Service-Worker behandelt das Modul als online-only. Version/Cache und Regressionen mitgepflegt.
- **Pflegepflicht:** Bei jedem künftigen App-Release einen klaren Eintrag in `cloud-release-history.mjs` ergänzen; Regression prüft, dass die angezeigte aktuelle Version und die Cloud-Version übereinstimmen. Echte mobile Owner-/Viewer-Abnahme #213 steht weiter aus.

## [1.16.65] - 2026-11-11

### Clanverwaltung: Vorschläge verstehen und selbst entscheiden (#226)
- **Mehr → Clanverwaltung:** „Ränge prüfen“ mit kurzen Bezeichnungen für Regeln, offene Hinweise und gesicherte Clanzeit. Die langen Methoden- und Datenlückenhinweise stehen in einem vorhandenen, schlanken Aufklappbereich und in der Hilfe.
- **Manuelle Entscheidungen:** „Als geprüft markieren“ statt „Quittieren“; „Vorschlag ausblenden“ statt „Ausnahme“; nachvollziehbare Zustände „Geprüft“ / „Ausgeblendet“ sowie „Wieder anzeigen“ / „Prüfung wieder öffnen“. Ausschließlich bestehende, pro Spieler/Clan gespeicherte Review-Zustände; keine neue Aktion oder andere Wirkung.
- **Kriterien und Datenstand:** Klare Eingabefelder für belegte Zeit/Angriffe/Spenden, eigene Nachweise und die letzte Clash-Prüfung. Unbekannt bleibt unbekannt; App-Owner-Rolle und Ingame-Rang bleiben getrennt.
- Version/Cache, Releasehinweise, Hilfe, Copy-Checkliste und Tests aktualisiert. Keine Änderung an Bewertungsformeln, Endpoints, DB, Collector, ACL/RLS, Plan, Rollen, Clash-Rängen oder Offline-PWA. Echte Mobile-Owner-Abnahme #213 bleibt offen; übriges Textaudit #226 folgt in kleinen weiteren Paketen.

## [1.16.64] - 2026-11-11

### Verständlichere Statistiktexte – erster Teil des App-Audits #226
- **Überblick und Spielerstatistik:** Formulierungen zur Kriegsgrundlage und Auswahl vereinfacht; detaillierte Berechnungsfragen bleiben in den vorhandenen aufklappbaren Erklärungen.
- **Spielerform:** Sortierungen heißen nun „Angriffsmenge & 3★-Quote“, „3★-Quote (auch bei wenigen Angriffen)“ und „Angriffe auf gleiches RH“. Die Zusammenfassung nennt auswertbare statt technisch klingender Teilmengen; die geringe Aussagekraft einzelner Angriffe bleibt ausdrücklich klar.
- **Automatische Erfassung:** Erfolgs-, Fehler- und Verzögerungsmeldungen verwenden Alltagssprache, nennen weiterhin die nachgewiesene Aktualität und versprechen keine bereits abgeschlossenen laufenden Kriege.
- Bestehende Hilfe ergänzt, Textstandard und offene Tab-Prioritäten in `docs/COPY_STYLE_GUIDE.md` festgehalten. Regressionen für neue Texte, historische Daten/Filter/Warnungen und Mobile bleiben aktiv. **Keine Änderung** an Erfassungsintervallen, Rohdaten, Quoten, Berechnungen, Cloud-/Clash-Rollen, API, DB, Solver oder Offline-PWA. Echte iOS-/Android-/Owner-Abnahme #213 bleibt offen.

## [1.16.63] - 2026-11-11

### Cloudstart: erst den richtigen Clan zeigen, Routine-Refresh nicht flackern lassen
- **Nur bei gespeicherter Cloud-Anmeldung** wird die anfängliche lokale Gastansicht verdeckt. Ein dezenter Ladebildschirm bleibt bis zum geladenen Clanprofil und dem ersten Clash-/CWL-Status (Erfolg oder Fehler) sichtbar. Keine Änderung an der Offline-/Gastnutzung; ohne eingeloggte Session ist die lokale Ansicht sofort erreichbar.
- Falls die Anmeldung oder API hängt, gibt der Startschutz nach **12 Sekunden** die vorhandene App frei; keine ewige Warteansicht. Keine verlängerten Cloud-Auth-Sitzungen, neue Datenbanken oder versteckte Profil-Speicherung.
- **Normaler CW:** Wenn die API beim Polling dieselben Daten zurückliefert, bleibt die bestehende Team-/Angriffs-DOM erhalten. Manuell geöffnete Listen, Fokus und Scrollposition springen nicht durch unnötiges Neuerzeugen; bei **echten** neuen Angriffen wird die Ansicht weiter aktualisiert.
- Einstiegshilfe, Sync-Hilfe, Versionsreferenzen und synthetische Regressionstests aktualisiert. Keine Änderungen an Server-Collector, Spielerdaten, Statistiken, Solver, CWL-Zyklus/RLS oder separater Offline-PWA.
- Weiter offen für späteres Fine-Tuning: echtes iOS-/Android-Startup-Timing, mehrstufige Teil-Refreshes außerhalb des Live-CW, gezielte Performance-Messungen und optionale inkrementelle DOM-Aktualisierung. Kein riskanter Komplettumbau.

## [1.16.62] - 2026-11-11

### Normaler Clankrieg: erster und zweiter Angriff auf einen Blick
- In der aufklappbaren eigenen und gegnerischen Aufstellung erscheinen die **einzelnen Angriffe zusammen unter dem jeweiligen Spieler** als **„1. Angriff“ / „2. Angriff“** mit Sternen, Zerstörung und Ziel. Der Zähler zeigt weiter 0/2, 1/2 oder 2/2.
- Wenn Clash eine gültige Angriffsreihenfolge meldet, sortieren wir die beiden Angriffe danach; ohne vollständige Reihenfolgen-Information bleibt die übermittelte Reihenfolge unverändert. Keine erfundene Zeitfolge.
- Kleine Textvereinfachungen im CW-Dashboard, gut lesbare mobile Angriffszeilen ohne weitere Karten, aktualisierter Plan-Hilfetext; fehlende API-Angriffe sind **keine** nachgewiesenen Fehlangriffe. Kein Eingriff in CWL-Plan, Statistik, API-Proxy, Supabase oder Offline-PWA.
- Regression für 1/2 → 2/2, Reihenfolge und fehlende Reihenfolgendaten. Erster kleiner Umsetzungsschritt des appweiten Textaudits #226; übrige Tabs bleiben offen.

## [1.16.61] - 2026-11-11

### Plan-Startseite: Live-CW zuerst, letzte CWL kompakt, neue CWL automatisch
- **Nach der CWL:** Die bisherigen Resultate stehen in einer einzigen ruhigen, aufklappbaren Gruppe mit **Kriegstage / Tabelle / Spieler**. Lange Entwickler-Erklärungen wurden vereinfacht; ausführliche Wertungs- und Datenhinweise sind über kleine aufklappbare Erklärungen bzw. Hilfe zugänglich. Gewählter Reiter und geöffnete Ansicht bleiben beim Live-Refresh erhalten.
- **Vorbereitung eines normalen CW:** Letzte CWL bleibt aufgeklappt, darunter folgt die aktuelle gegnerische Aufstellung. **Bei Beginn des Kampftags:** Live-CW mit Sternen, Zerstörungs-Prozenten, Angriffszahlen und beiden Clans nach ganz oben; CWL-Rückblick klappt genau einmal ein, kann aber manuell geöffnet und offen gehalten werden.
- **Mehr Live-CW-Daten:** 3★-Angriffe, durchschnittliche dokumentierte Angriffszerstörung (ausdrücklich nicht die Kriegs-Gesamtzerstörung), **Top-Angriff** nach echten Einzelangriffen (keine offizielle heroische Clash-Auszeichnung), letzte Angriffe nach offiziell gemeldeter Reihenfolge, Dauer, Kartenpositionen, beide Aufstellungen und Ziele. Kein Replaysupport und keine erfundenen API-Felder. Sieger bleibt bis Kriegsende offen; bei gleichen Sternen ist der echte Kriegszerstörungswert maßgeblich.
- **Cloud + verknüpfter Clash-Clan:** Den manuellen „Neue CWL starten“-Button vollständig entfernen. Sobald die API eine neue Saison meldet, archiviert ein berechtigter Cloud-Owner zuerst die vorherige Saison **auch bei 6/7** mit echtem Teilstand; nach erfolgreicher Cloud-Speicherung und sicherem neuem Planzyklus erscheint automatisch der neue CWL-Plan. Es werden keine unbekannten Kriegstage nachgetragen; bei Speicher-/Berechtigungsproblemen bleibt die alte Planung geschützt. Offline-/Gastvariante bleibt manuell. Für schon eingeloggte Nicht-Owner ist weiterhin der erfolgreiche Owner-Zyklus notwendig, bevor gemeinsame Planlocks umgestellt werden.
- Alle sichtbaren Bezeichnungen und die Hilfe für diese Plan-Ansicht nach UX-Prinzipien überarbeitet. Weiterer appweiter sprachlicher Audit der übrigen Tabs bleibt als eigener Backlog nötig; internationale Sprachpflege #177 unverändert.
- Regression für 6/7-/7/7-Automatik, Owner/Cloudfehler, Tab-/Disclosure-Persistenz, reale Normal-War-Fakten, 320/390/430/1280 px und Gold-/Dunkel-/Hell-Theme. Keine Migration, kein Solver- oder Sanktions-Write.

## [1.16.60] - 2026-11-11

### CWL-Abschluss-Hotfix: Bereits archivierte Saisons nur einmal sichern
- Nach automatischer 7/7-Archivierung führt „Neue CWL starten“ keine zweite Kopie derselben Cloud-Saison mehr an. Vor dem tatsächlichen Commit wird erneut nach einem saisonidentischen Archiv gesucht (auch wenn es während des Bestätigungsdialogs angelegt wurde).
- Scheitert die Cloud-Freigabe des neuen Planzyklus, wird eine gerade erzeugte, noch nicht sicher gespeicherte Archivkopie zurückgenommen; der bisherige gespielte Plan bleibt unberührt. Nach einem Clan-/Profilwechsel während der Bestätigung oder Cloud-Antwort wird nicht versehentlich ein fremder Plan zurückgesetzt.
- Hilfe, Regressionstest und Cloud-Cache-Version gemeinsam aktualisiert; keine Datenbank-Migration, Änderung am Solver, API-Provenienz oder automatischen Sanktionen.

## [1.16.59] - 2026-11-10

### CWL-Saisonende: Plan-Rückblick statt verschwundener Liga, normale CW zwischen Ligen
- Die Cloud-Planseite wechselt nach dem bestätigten Ende der Liga zu einem **inline** Saisonrückblick mit bekannter Gruppentabelle, Ergebnissen aller sieben Tage und Spielerwerten, unter Verwendung der vorhandenen Saisonanzeige. Der bisherige Saison-Button und die leeren Aufstellungs-Karten werden dann ausgeblendet, ohne den alten Plan zu löschen.
- Ein `notInWar` der Clash-Ligagruppe ist **kein** belegter letzter Krieg: 6/7 bleibt ausdrücklich **„Abschluss offen“** statt 7/7 oder fälschlich „CWL läuft“. Offizielle bereits archivierte Clan-/Tag-7-Kriegstags-Tags werden bei API-Ende einmal gezielt am offiziellen War-Endpunkt nachgeprüft. Ausschließlich vollständige, tatsächlich beendete und clanidentische Ergebnisse dürfen Tag 7 vervollständigen.
- Nach einer **nachweislich abgeschlossenen 7/7-API-CWL** archiviert der berechtigte Cloud-Owner den bisherigen Plan bei einem frischen Abruf idempotent. Eine neu erkannte CWL setzt die Planung erst nach gesicherter Archivierung, Cloud-Synchronisation und neuem Planzyklus zurück. Nicht abgeschlossene oder manuelle Tage bleiben geschützt.
- Zwischen Ligen erscheinen die **normalen Clan Wars auf „Plan“** (nicht mehr unter Einsätze): Namen/Wappen, War-Sterne, Zerstörung, Status/Zeiten, Angriffe beider Clans und ausklappbare Aufstellungen mit Angriffszielen. Kein falscher verpasster Angriff und keine Sanktion.
- Offline-PWA bleibt manuell. Die Automation läuft bei berechtigtem Cloud-Browser-Abgleich, nicht als behaupteter permanenter Hintergrund-Prozess. Gegenwärtige Kriegs-/CWL-Archivdaten werden nicht destruktiv migriert.
- Hilfe/Releasehinweise aktualisiert. Offene Nachweise: echte betroffene Supercell-Tag-7-Abfrage, Edge-Deployment, Main-CI, Pages, Release, iOS-/Android-Owner-UAT #213, vollumfängliches Backup #178 und spätere serverseitige Lifecycle-Cron-Automation.

## [1.16.58] - 2026-11-10

### Clanverwaltung #183 – manuelle Prüfhinweise quittieren und Ausnahmen
- Unter **Mehr → Clanverwaltung** können berechtigte Cloud-Clan-Owner **tatsächlich qualifizierte** Vorschläge für Leistung, Treue oder früheren Ältestenrang einzeln **quittieren**, als bewusste **Ausnahme** markieren oder **erneut öffnen**. Keine Bearbeitung von Datenlücken, kein Nachfragen bei nicht bestätigten Sachverhalten.
- Quittierung gilt für den zugrundeliegenden Grenzwert-/API-Nachweisstand; ein normaler 30-Minuten-Collector-Lauf öffnet ihn nicht erneut. Neue Angriffs-/Spendenbelege, Regeländerung oder neuer bestätigter Aufenthalt öffnen einen neuen relevanten Prüfhinweis. **Ausnahmen bleiben**, bis der Owner sie aufhebt.
- Ergebnisse sind **nur im jeweiligen App-/Clash-Clan sichtbar** (separate Player-/Fall-Schlüssel), per Owner-RLS und Clanverknüpfung gesperrt, beim Speichern revisionsgeprüft. Keine fremden Notizen, kein globaler Player-Status (#212).
- Die kompakte Aktionszeile speichert direkt ohne erneuten Clash-API-Abruf, verändert weder Clan-/Planprofile noch Spielränge, Archive oder Solver. Hilfe, Versionshinweise und mobile/Desktop-Regression ergänzt.
- **Offen:** append-only Decision-Audit, Kommentar-/Entschuldigungsworkflow für erst belastbar belegte Missed-Angriffe, vollständiges App-Backup #178 inklusive Entscheidungen, reale Owner-/iOS-/Android- und CWL-UAT #213. Keine automatischen Sanktionen.

## [1.16.57] - 2026-11-10

### Clanverwaltung #183 – freiwillige Treueprüfung auf echten Beobachtungen
- Der Owner kann pro verknüpftem Cloud-Clan einen **standardmäßig ausgeschalteten Treuepfad** aktivieren. Einstellbar sind bestätigte Mitgliedschaftstage (60), positive beobachtete Spendenzuwächse (50), unterschiedliche Spendentage (3) und Zeitraum (30 Tage), unabhängig von CW-/CWL-Angriffspflicht. Zusätzlich muss ein frischer belegter Spendenzuwachs in den letzten 14 Tagen vorliegen.
- Reine **„Treue: Beförderung prüfen“**-Empfehlung bei vollständigen, frischen Nachweisen. Keine Empfehlung bei fehlendem Rückkehr-Protokoll, 24 Stunden altem Clan-Snapshot oder widersprüchlichen Spendenereignissen. Mögliche Abwesenheit über der einstellbaren 10-Tage-Grenze wird **nur zur manuellen Qualifikationsprüfung** markiert – historische bestätigte Clanzeit niemals zurückgesetzt.
- Eigentümer-RLS-geschütztes SECURITY-INVOKER-Datenaggregat verknüpft nur die eigenen Clash-/App-Clan-Beobachtungen; keine Rohdaten anderer Benutzer, keine 0-Angriffe aus API-Lücken, keine Online-/Offline-Vermutung. Kein Ingame-Rang-/Kick-/CWL-Plan-Write.
- Die Hilfe erklärt Nachweisqualität, fehlende Historie, getrennte CW-Verstöße und das optionale Treue-Regelwerk. Regressionen inkl. 7-/11-Tage-Rückkehrfällen, Rollen, CAS, Mobile und Gold-/Dark-/Light-Themes; Bestandsdaten/Offline-PWA unverändert. Neue Regeln bleiben Teil des noch ausstehenden vollständigen App-Backups #178.

## [1.16.56] - 2026-11-10

### Clanverwaltung #183 – erste einstellbare Beförderungskriterien pro Cloud-Clan
- Unter **Mehr → Clanverwaltung** erhält nur der berechtigte App-Clan-Besitzer eine kompakte, standardmäßig eingeklappte Kriterienansicht. Für den Leistungspfad sind **14 nachweislich anwesende Clantage**, **mindestens 10 bewertbare Angriffe**, **80 % Dreierquote** und ein **14-Tage-Angriffsfenster** die anpassbaren Startwerte. Einstellungen werden pro App-Clan mit Besitzer-RLS, Wertebereichen und revisionsgeprüftem Speichern abgelegt – kein Plan- oder Profilwrite.
- Nur **abgeschlossene API-Archiv-Kriege aus genau diesem App-Clan** liefern den aktuellen Angriffsnachweis. Vorläufige/Import-/fremde Clan-Daten bleiben draußen; Doppelabfragen zählen durch Angriffs-PK nicht mehrfach. Fehlende Nachweise sind **keine 0★-Angriffe**; 1/1 100 % ist keine Stichprobe. Erfolgsfälle ergeben ausschließlich **„Beförderung prüfen“**, nie einen automatischen Clash-Rangwechsel.
- Aktuelle Ingame-Rolle „Mitglied“ und frische, konservativ bestätigte Clanzeit sind nötig. Elder/CoLeader/Leader bleiben ausgeschlossen; Rückkehr als ehemaliger Elder wird separat angezeigt. Fehlende/alte Quellen blockieren Empfehlungen. Der Archiv-Quellwert „api“ ist allein kein kryptografischer Nachweis unveränderter Rohdaten, deshalb ist jede Entscheidung manuell zu prüfen.
- **60-Tage-Treuepfad** und **10-Tage-Abwesenheits-Reset (oder nie)** sind bereits als künftige Clanregeln speicherbar, werden aber mangels verlässlicher Langzeit-/Aktivitäts-/Aufenthalts-Evidenz **noch nicht angewendet**. Kein Online-Tracker, keine automatische Strafe, keine neu freigegebene Cross-Tenant-Statistik. Sicheres globales Sharing ist #212; vollständiges Backup einschließlich dieser neuen Clanregeln ist Teil von #178.
- Hilfe geprüft und im selben Update aktualisiert; Regression für Owner-RLS, Grenzwerte, API-Quellen, 8/10, 1/1, Rollen-/Clanwechsel, mobile Breiten und Theme-Konsistenz.

## [1.16.55] - 2026-11-10

### Clanverwaltung #183 – Spenden-Nachweis und Rang vor Rückkehr
- Der signierte Collector erfasst in **einer atomaren, rein servicegeschützten Clan-Roster-Beobachtung** neben belegter Mitgliedschaft den zuletzt in Clash beobachteten Rang. Bei sicher erfasstem Austritt bleibt der frühere Rang samt Beobachtungszeit erhalten; erst eine belegte Rückkehr als Mitglied nach früherem Ältestenrang ergibt einen **manuellen** Hinweis zur Wiederherstellungsprüfung. Keine automatischen Clash-Änderungen; unbemerkte Kurzwechsel und unbekannte Vergangenheit bleiben unbekannt.
- Spenden der **aktuellen Saison** erscheinen in der Owner-Ansicht. Nur ein **positiver Spendengegenstands-Zähleranstieg zwischen zwei vollständigen, höchstens drei Stunden entfernten Snapshots bei nachgewiesener Anwesenheit** erzeugt ein Aktivitätssignal. Erstwerte, negative Zähler/Saisonresets, Abwesenheiten und lange Cron-Lücken sind kein Nachweis. **Kein Last-Login- oder Offline-Wert** und keine daraus abgeleitete Strafe.
- Bestehende Tenant-/Owner-RLS und Service-only-RPC geschützt. Hilfe/Changelog/Regression aktualisiert, keine Plan-, Solver-, War-Statistik- oder Offline-PWA-Mutation. Individuelle Beförderungs-/Degradierungsregeln, andere API-Aktivitätssignale und Benachrichtigungszentrale bleiben separat offen.


## [1.16.54] - 2026-11-10

### #183 – Mitgliedschaft nur nach beobachteten Clanlisten
- Der signiert gestartete Hintergrund-Collector prüft zusätzlich je verknüpftem Clan die **vollständige Clash-Mitgliederliste** (bis 50 Mitglieder) und sichert tenantgetrennt den aktuellen Anwesenheitsstatus, die erste Beobachtung, die letzte Beobachtung, Wiederbeitritte und **bestätigte Mitgliedschaftssekunden**. Bei Austritt bleibt die bisherige bestätigte Zeit erhalten, bei Rückkehr läuft sie weiter. Spieler werden mit stabilem Player-Tag zugeordnet. Das ist ein eigenes Datensystem und verändert niemals CWL-Pläne oder die Ingame-Ränge.
- Zeit wird konservativ **nur zwischen zwei vollständigen Snapshots, in denen der Spieler anwesend ist, mit maximal 3 Stunden Abstand** addiert. Ein fehlgeschlagener, unvollständiger oder paginierter Abruf schreibt nichts; keine rückwirkende Berechnung aus Kriegen, keine vermutete Eintrittszeit. Mehrstunden-Ausfälle des GitHub-Crons verursachen also bewusst Unterzählung statt erfundene Sicherheit.
- Der Owner kann unter Mehr → Clanverwaltung die bis dahin bestätigte Zeit und Beobachtungswarnungen neben dem aktuellen Ingame-Rang lesen. Eigene RLS-Tabelle, Owner-SELECT und ausschließlich Service-Rollen-RPC für atomare komplette Clanlisten. Andere Clanmitglieder können diese Daten nicht lesen und Browser können keine Zeit erfinden. Noch keine 14-Tage-Freigabe, Rang-/Kick-Empfehlungen, Offline-Urteile oder Leistungsbewertung; das folgt erst mit separater Konfiguration und Beweisprüfung.
- Hilfeseite aktualisiert, Collector-Validierung und Sicherheits-/Domainregression ergänzt. Keine Änderungen an Solver, Rollenverwaltung, CWL-Daten, Cloud-Profil, Offline-PWA oder Live-Clash.



## [1.16.53] - 2026-11-10

### Clanverwaltung #183 – erste sichere Rangübersicht
- Unter **Mehr → Clanverwaltung** gibt es für den **Cloud-Clanbesitzer** einen eigenen, kompakten, **rein lesenden** Einstieg: Aktuelle Clash-Mitgliederliste und API-Rang abfragen; `admin`/ `elder` als Ältester zuordnen, `member` als Mitglied. App-Rollen Owner/Editor/Viewer werden niemals mit Ingame-Rängen vermischt. **Vize/Clanführer** werden vollständig aus der individuellen Rangprüfliste ausgeschlossen.
- Der neue Abruf erfolgt ausdrücklich über den vorhandenen autorisierten `coc-clan-members`-Endpunkt mit Clan-/Session-/Owner-Gültigkeitsprüfung. Er benutzt **nicht** den schreibenden Mitgliederabgleich und speichert keine temporären Roster-, Profil-, Rang- oder Mitgliedschaftsdaten. Beim Clanwechsel oder Rollenverlust werden alte Ergebnisse entfernt; unvollständige/duplizierte Tags verhindern die gesamte Auswertung.
- **Datenlage ehrlich:** Clash bietet weder historische Join-/Return-Zeiten noch letzten Login. Die erste Stufe zeigt daher **keine** unbelegten 14-Tage-Empfehlungen, 3-Tage-Inaktivitätsurteile, Leistungsabwertungen, Beförderungs-/Kick-Vorschläge oder Aktionsbuttons. 14 kumulierte Tage samt Austrittspausen, belegte CW-/CWL-Stichproben, Missed-Ausnahmen, Owner-Regeln und auditierte Entscheidungen sind **weitere getrennte Phasen** von #183.
- Browser-/Pure-Test für Clash-Rollen inkl. `admin`-Alias, API-Unsicherheit, Owner-Gate, Clanwechsel während eines laufenden Abrufs, Vize/Leader-Ausschluss, keine Writes sowie responsives Gold/Dark/Light. Hilfeseite im selben PR aktualisiert; Cloud-Version und Cache-Referenzen synchron. Keine DB-/RLS-/Edge-/Solver-/Offline-PWA-Mutation.
- **Offiziell veröffentlicht:** [PR #202](https://github.com/Smolmig/cwl_planer/pull/202) Squash `cc73e46fccc0f6fa410a173428fce39351024e2f`; [PR-CI 42771737334](https://github.com/Smolmig/cwl_planer/actions/runs/42771737334) **568/568**, [Main-CI 42772023746](https://github.com/Smolmig/cwl_planer/actions/runs/42772023746), [Pages 42772023468](https://github.com/Smolmig/cwl_planer/actions/runs/42772023468), [Release-Workflow 42772176609](https://github.com/Smolmig/cwl_planer/actions/runs/42772176609) und [GitHub Release v1.16.53](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.53) erfolgreich. Echte Safari-/Android-/Clash-Rang-Sichtprüfung bleibt offen.


## [1.16.52] - 2026-11-09

### Einsätze #187 – echter 3/4-Fix und additive Filterchips
- **Bug anhand der Mobil-Screenshots reproduziert:** `Ziel offen` zeigte `0 von 19`, obwohl Jamie und Pro_Gamer jeweils **3 tatsächlich ausgeführte AG, eine offene geplante AG und 4 insgesamt vorgesehene** hatten. Vorher prüfte der Filter ausschließlich ein explizites `member.targetDays`, während „Automatisch“ (`null`) trotz existierender Planbelegung aus beiden Zielgruppen herausfiel.
- **Korrektur (rein lesend):** Ein vom Nutzer ausdrücklich gesetztes Einsatzziel bleibt maßgeblich. Ohne solches Ziel wird die **aktuell im Plan vorgesehene Anzahl** `lastPlan / currentCwlDisplayProgress().total` als dynamischer Vergleich verwendet, solange eindeutige echte CWL-Angriffsbelege vorliegen. Jamie / Pro_Gamer: `Plan 3/4 AG · offen`, nach belegtem viertem Angriff `Plan 4/4 AG · erledigt`; 1/5 ist offen, 5/5 erledigt. Keine dauerhafte Umschreibung von `targetDays`, kein Spielerprofil-/Solver-Update. Spieler ohne belastbares Plansoll oder eindeutigen Tag bleiben unbekannt.
- **Gewünschtes Shop-Filtermuster:** `＋ Filter` öffnet die Liste „Rotierende Spieler“, „Ziel offen“, „Ziel erreicht“, „8 Sterne offen“, „8 Sterne erreicht“. Jeder aktive Filter erscheint als sichtbarer Chip mit eigenem × zum Entfernen. Mehrere verschiedene Dimensionen werden per UND kombiniert und **nebeneinander ergänzt**, statt drei permanente Dropdowns zu belegen. Neue Auswahl derselben Dimension ersetzt den bisherigen Chip. Sortierung bleibt separat. Suche, kleines Reset, mobile Tastatur-/Escape-/Outside-Klick-Unterstützung.
- **8-Sterne-Begriffe bewusst übernommen:** `8 Sterne offen` / `8 Sterne erreicht` (nicht „fehlen“). Offen wird nur für einen belegten noch-nicht-erreichten Stand angezeigt; alte/unvollständige Datensätze bleiben `unknown` und werden nicht zu 0 Sternen umgedeutet. 8★ bleibt unabhängig vom Einsatzfortschritt.
- Zusätzliche Unit-Tests mit Jamie/Pro_Gamer, dynamischem 1/5↔5/5 und ausdrücklich fixem 5er-Ziel, plus Playwright-Test für Chips hinzufügen/ersetzen/entfernen/Reset/Tastatur und 320/390/430px in Gold/Dark/Light. Hilfeseite, Changelog, README, aktives Handoff und Release-Version synchron. **Keine** DB-/RLS-/Clash-/Solver-/Offline-PWA-Mutation.
- **Offiziell veröffentlicht:** [PR #199](https://github.com/Smolmig/cwl_planer/pull/199) Squash `3e2c235981a5915723025af6540559d540e6eb7d`; [PR-CI 42715841656](https://github.com/Smolmig/cwl_planer/actions/runs/42715841656) **558/558**, [Main-CI 42716237661](https://github.com/Smolmig/cwl_planer/actions/runs/42716237661), [Pages 42716237897](https://github.com/Smolmig/cwl_planer/actions/runs/42716237897), [Release-Workflow 42716462805](https://github.com/Smolmig/cwl_planer/actions/runs/42716462805) und [offizieller Release v1.16.52](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.52) erfolgreich. Echte Mobil-/Clash-Daten-Ansicht weiterhin manuell zu bestätigen.


## [1.16.51] - 2026-11-09

### Einsätze #187: kompakte Filter nach direktem UX-Feedback
- Der gemeinsame Cloud-Einsätze-Tab zeigt **nur drei Filter**: `Alle Spieler / Rotierende Spieler`, `Alle Ziele / Ziel offen / Ziel erreicht`, `Alle 8★ / 8★ offen / 8★ erreicht`. Die separate große Beschriftungszeile, zusätzliche Fix-/Automatisch-/Plan-erledigt-/Unklar-Auswahl und der zweite allgemeine Cloud-Statusfilter fallen aus der sichtbaren Cloud-Oberfläche weg. Suche und Zurücksetzen bleiben klein und auffindbar.
- Die Sortierung behält offene Angriffe, bis 8 fehlende Sterne, aktuelle CWL-3★-Quote/Ø, belegte Angriffszahl und Name; **„Rest zum festen Ziel“ entfernt**, weil semantisch unklar. Player-Zeilen zeigen bei individuellem Ziel kompakt z. B. `Ziel 3/4 AG · offen`, nach dem vierten belegten Angriff `Ziel 4/4 AG · erreicht` (analog `1/5`, `5/5`).
- Ein geplanter oder bereits in Clash fixierter CWL-Einsatz zählt weiterhin **nicht** als ausgeführter Angriff. Spieler ohne exakte Zielvorgabe („Automatisch“) oder ohne eindeutige Angriffszuordnung werden nicht irrtümlich als Ziel offen/erreicht gewertet. Für 8★ offen zählt nur ein aktuell belegbarer Stand; unbekannte/alte Angaben bleiben außerhalb beider gefilterten Gruppen.
- Die drei kleinen Selects und der Sortier-Select werden unter 760px zweispaltig angeordnet, Desktop einzeilig; auf schmalen Geräten kein unnötiger zweiter allgemeiner Statusfilter. Kein Eingriff in Pläne, Solver, Cloud-Daten, RLS oder Offline-PWA. Hilfe und neue responsive Browser-Regression für 320/390/430px Arena/Gold, Dark, Light im gleichen Update.
- **Offiziell veröffentlicht:** [PR #197](https://github.com/Smolmig/cwl_planer/pull/197) Squash `0e3dc3a9ccd3e59a817a415fe3f894d9a23238a6`; [PR-CI 42708655769](https://github.com/Smolmig/cwl_planer/actions/runs/42708655769) **553/553**, [Main-CI 42709004539](https://github.com/Smolmig/cwl_planer/actions/runs/42709004539), [Pages 42709002785](https://github.com/Smolmig/cwl_planer/actions/runs/42709002785), [Release-Workflow 42709315753](https://github.com/Smolmig/cwl_planer/actions/runs/42709315753) und [GitHub Release v1.16.51](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.51) erfolgreich. Echte Geräte-/Clash-Daten-Abnahme offen.


## [1.16.50] - 2026-11-09

### Einsätze #187: Rotation, individuelle Ziele und 8★ sicher kombinieren
- In der **Einsatzverteilung** lassen sich die bestehende Suche/Statusauswahl jetzt unabhängig mit **Nur Rotation/Fix**, **festes Ziel erreicht/noch offen/vorgesehene AG ausgeführt/Automatisch** und **8★ erreicht/offen/unklar** per UND kombinieren. Alle Einstellungen lassen sich gemeinsam zurücksetzen; Trefferanzeige n von N und verständlicher Leerzustand.
- Sortierung nach verbleibenden **belegten** Angriffen bis zum *festen* Einsatzziel (fehlende Ziele zuletzt), noch geplanten AG, verbleibenden CWL-Sternen, aktuellem CWL-3★-Anteil / Ø Sterne / Angriffszahl und Namen. Die laufenden CWL-Werte werden mit Stichprobe angezeigt und **nicht** als Stärkeprognose bewertet.
- Nur eindeutige tatsächlich ausgeführte CWL-Angriffe aus #181 gelten als erledigt; ein Clash-fixierter oder lediglich geplanter Tag ist **kein Angriff**. Fixspieler und `targetDays=null` („Automatisch“) erhalten kein erfundenes festes Ziel. Unklare, doppelte oder veraltete Daten erzeugen keine sichere 8★-„noch offen“-Behauptung.
- Nur lesende UI-Auswahl; keine Änderung an Solver, Locks, Rollen, Clash, Supabase, Datenbank oder separater Offline-PWA. Hilfe und automatisierte Filter-/Sortier-/Quellen-/Mobile-Layout-Verträge im selben Patch.
- **Offiziell veröffentlicht:** [PR #195](https://github.com/Smolmig/cwl_planer/pull/195) Squash `b41ffa37a58e`; [PR-CI 42694806353](https://github.com/Smolmig/cwl_planer/actions/runs/42694806353) **554/554**, [Main-CI 42695121599](https://github.com/Smolmig/cwl_planer/actions/runs/42695121599), [Pages 42695120908](https://github.com/Smolmig/cwl_planer/actions/runs/42695120908), [Release-Workflow 42695365753](https://github.com/Smolmig/cwl_planer/actions/runs/42695365753) und [v1.16.50](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.50) erfolgreich. Echte Mobil-/Clash-Praxisabnahme noch offen.


## [1.16.49] - 2026-11-09

### CWL #184: bestätigte ältere Missed-Vorfälle bleiben erreichbar
- Vollständig bestätigte Missed-Ereignisse mehrerer CWL-Tage können jetzt über eine **kompakte Tagesauswahl** individuell geprüft werden. Ein jüngerer Fall oder eine letzte-Stunde-Erinnerung blendet ältere Vorfälle nicht mehr aus.
- Die letzte-Stunde-Warnung bleibt priorisiert; frühere Fälle sind davon getrennt über die bestehende Planprüfung, Owner-Entscheidungen und Audit-Historie erreichbar. Der gewählte Tag und sein geöffneter Bereich bleiben beim Refresh erhalten.
- Keine automatische Pause, keine neue SQL-/RLS-Migration, keine Solver-/Clash-Mutation. Bestehende Owner-/Collector-/Clash-/Einsatzziel-/8★-Sicherheitsprüfungen gelten unverändert. Browserregression erweitert und Hilfe aktualisiert.
- **Offiziell veröffentlicht:** [PR #193](https://github.com/Smolmig/cwl_planer/pull/193) Squash `4d0635c7a18f`; [PR-CI 42682089435](https://github.com/Smolmig/cwl_planer/actions/runs/42682089435) vollständig grün; [Main-CI 42682546092](https://github.com/Smolmig/cwl_planer/actions/runs/42682546092), [Pages 42682544922](https://github.com/Smolmig/cwl_planer/actions/runs/42682544922), [Release-Workflow 42682849540](https://github.com/Smolmig/cwl_planer/actions/runs/42682849540) und [offizieller Release v1.16.49](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.49) erfolgreich. Echte Clash-/iOS-/Android-Abnahme und produktiver Collector-Miss-Test weiterhin offen.


## [1.16.48] - 2026-11-09

### CWL #184 Phase 2b2b: vollständige Einsatzfolgen vor bestätigter Tagespause
- Die bestehende **einzeltägige, Owner-bestätigte AUTO→RAUS-Pause** erhält eine genauere, rein lesende Solver-Vorschau: zusätzlich zu geänderten Tagesaufstellungen zeigt sie **wer insgesamt weniger oder mehr geplante/fixierte Einsätze erhält** (vorher → nachher).
- Für teilnehmende **Rotationsspieler** wird die Spanne aus höchster und niedrigster geplanter Einsatzzahl vorher/nachher dargestellt. Nur Orientierung, **keine** automatische Fairness-/Leistungsbewertung oder Garantie; feste Einsatzziele und Verfügbarkeit können Unterschiede erklären. Nicht vollständige Solver-Zähler blockieren die Übernahme statt falsche Zahlen zu zeigen.
- Mobile/Owner-Bestätigung zeigt die Auswirkungen direkt vor der Freigabe; Hilfe wurde samt bisher veraltetem Missed-Review-Text korrigiert. Core-/Browserintegration und Version-/Cachevertrag regressionsgetestet.
- Unverändert: keine automatische Mehrtagepause, keine neuen Datenbankrechte oder Migrationen, keine stillen Solver-/Lock-/Clash-Mutationen, kein Push, Offline-PWA unangetastet.
- **Offiziell veröffentlicht:** [PR #191](https://github.com/Smolmig/cwl_planer/pull/191) als Squash `5cb80b2b6a91` gemergt; [PR-CI 42679576128](https://github.com/Smolmig/cwl_planer/actions/runs/42679576128) **543/543**, [Main-CI 42679873701](https://github.com/Smolmig/cwl_planer/actions/runs/42679873701), [Pages 42679871057](https://github.com/Smolmig/cwl_planer/actions/runs/42679871057), [Release-Workflow 42680186048](https://github.com/Smolmig/cwl_planer/actions/runs/42680186048) und [offizielles v1.16.48](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.48) erfolgreich. Echte Clash-/iOS-/Android-Abnahme bleibt ausstehend; keine bestätigten produktiven CWL-Miss-Fälle für E2E-Prüfung.

## [1.16.47] - 2026-11-09

### CWL #184 Phase 2b2a: verbindliche Owner-Tagespause mit Schutzprüfung
- Nach einem **vom Collector bestätigten** CWL-Miss und der separaten Owner-Entscheidung „Pause prüfen“ kann der Owner **genau einen zukünftigen Kriegstag im Status Vorbereitung** für diesen Spieler im Plan auf RAUS setzen. Erforderlich: frischer Clash-Abgleich, plausibler War-Key, mindestens 30 Minuten bis Kampfbeginn und weiterhin unveränderte Cloud-Revision.
- Die reine Vorprüfung zeigt jeden tatsächlichen Aufstellungswechsel über den bestehenden Solver. Sie verweigert die Aktion bei Fix/MUSS/exakten Einsatzzielen, vorhandenen Sperren, laufenden/beendeten Konflikten, fehlenden Tags/Rosters, nicht voll besetzten Lineups oder neuem rechnerischem **8★-Risiko**. Frühere Clash-Rosters werden nur temporär im Solver als geschützt behandelt; **keine gespielt-Markierung**.
- Nur nach ausdrücklicher Bestätigung aktualisiert die spezialisierte Owner-RPC **eine** AUTO-Tagesregel zu RAUS und hängt eine append-only `applied_pause`-Entscheidung mit Zieltag im **selben Datenbankvorgang** an. Sie validiert Owner-Rolle, belegten Collector-Miss, vorangehende `review_pause`-Entscheidung, aktuelle Saison/War-Tag, Vorbereitung, Startzeitpuffer, unveränderbare Profilrevision und Player-Tag. Keine vom Browser gesendeten Komplettprofile.
- Nach erfolgreichem Speichern wird der Cloud-Plan neu geladen. **Clash-Aufstellung muss im Spiel manuell geändert werden.** Kein automatischer CWL-Restausschluss; weitere Tage jeweils separat prüfen. Keine Änderung an Offline-PWA, automatischen Angriffsdaten oder Push.
- Hilfe, Mobile-Layout, Core-/SQL- und Integrationstests ergänzt.
- **Offiziell veröffentlicht:** [PR #190](https://github.com/Smolmig/cwl_planer/pull/190) Squash `b672cc693695`; [PR-CI 42676817622](https://github.com/Smolmig/cwl_planer/actions/runs/42676817622) **542/542**, [Main-CI 42677245385](https://github.com/Smolmig/cwl_planer/actions/runs/42677245385), [Pages 42677243344](https://github.com/Smolmig/cwl_planer/actions/runs/42677243344), [Release-Workflow 42677540237](https://github.com/Smolmig/cwl_planer/actions/runs/42677540237) und [offizielles v1.16.47](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.47) erfolgreich. Supabase-Migrationen `20261109192000_cwl_apply_verified_missed_pause.sql` und `20261109192100_cwl_apply_verified_missed_pause_lock_order.sql` angewendet; SQL-Syntax-Fehlversuch zuvor vollständig zurückgerollt (kein partieller DB-Zustand). Nachweisbar: EXECUTE für `authenticated`, nicht für `anon`; Owner/Collector/CAS-Gates, Audit-RLS und read-only vorher begonnene Tage; SQL-Aufruf ohne Ownerberechtigung verweigert. Die zusätzliche Security-Advisor-Meldung zur **bewusst autorisierten SECURITY-DEFINER-RPC** wird als überprüfbarer Sicherheitspunkt fortgeführt. Die echte Clash-/iOS-/Android-Abnahme ist weiterhin offen, da beim DB-Abgleich **0 vollständig belegte CWL-Missed-Fälle** vorlagen.


## [1.16.46] - 2026-11-09

### CWL #184 Phase 2b1: Owner-Entscheidungen mit Clan-Audit
- **Nur Owner** können nach einem vom Statistik-Collector vollständig nachgewiesenen CWL-Miss pro Player-Tag „Entschuldigung akzeptiert“, „Später prüfen“ oder „Pause prüfen“ mit optionaler Begründung (max. 300 Zeichen) dokumentieren.
- Die bestätigten, **unveränderlichen Ereignisse** haben serverseitige Akteurs-ID und Zeitstempel und können von allen berechtigten Mitgliedern **ihres** App-Clans gelesen werden. Ein neuer Beschluss ergänzt den bestehenden Verlauf, statt frühere Entscheidungen zu löschen.
- Datenbank schützt Inserts per RLS: aktuelle Owner-Rolle, exakter Clan, CWL-Saison/-Tag/War-Key, abgeschlossener durch API erfasster Krieg mit vollständiger Missed-Abdeckung und belegtes fehlendes Angriffsergebnis. Fehlt einer dieser Nachweise, wird die Entscheidung abgewiesen.
- App blendet Owner-Aktionen am bestätigten Fall ein, zeigt die jüngste Entscheidung sowie frühere Einträge aufklappbar an und prüft vor dem Schreiben Rolle/Cloud-Stand. Vize und Viewer haben ausschließlich Leserechte.
- **Keine automatische Pause / Übernahme in den Solver**, keine Änderung an der CWL-Aufstellung, keine Missed-Korrektur und kein Push; echte manuelle Umbesetzung mit gesondertem Rollen-/8★-/Einsatzziel-Check bleibt ein späterer Schritt.
- Hilfeseite/Gold-/Mobile-Komponenten und Regression angepasst. **Offiziell veröffentlicht:** PR [#189](https://github.com/Smolmig/cwl_planer/pull/189) Squash `90b40c55935e`; [PR-CI 42663836586](https://github.com/Smolmig/cwl_planer/actions/runs/42663836586) **537/537**, [Main-CI 42664450696](https://github.com/Smolmig/cwl_planer/actions/runs/42664450696), [Pages 42664450077](https://github.com/Smolmig/cwl_planer/actions/runs/42664450077), [Release-Workflow 42664750270](https://github.com/Smolmig/cwl_planer/actions/runs/42664750270), [offizieller Release v1.16.46](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.46) erfolgreich. Additive Supabase-Migration `cwl_missed_owner_decisions` erfolgreich angewendet und Rechte überprüft (Owner-INSERT, Clan-SELECT, kein UPDATE/DELETE, serverseitige Actor-/Zeitspalten). Bei der Abnahme waren **0 vollständig belegte API-CWL-Misses** in der Produktivdatenbank erfasst; echte Entscheidungs-E2E-Abnahme mit künftigem Beleg bleibt offen.


## [1.16.45] - 2026-11-09

### CWL #184 Phase 2a: nachvollziehbare Missed-Einsatzprüfung
- Nach einem fachlich belegten **beendeten** CWL-Krieg führt der Planer fehlende eigene Angriffe über **Player-Tag, Clan, Saison, Tag und War-Key** auf. Fehlende bzw. defekte Angriff-Logs werden nicht als verpasst bewertet.
- In einem optional aufklappbaren Bereich lassen sich die **später geplanten Einsätze desselben Spielers** überprüfen. Offene Vorbereitung/noch nicht begonnene Tage bleiben lediglich eine Prüfidee, nicht ein automatischer Wechsel.
- **Geschützt** bleiben bereits beendete bzw. laufende Clash-Aufstellungen, gespeicherte Plan-Locks, unklare Daten und eine nicht eindeutig berechenbare Planung. Fix-/MUSS-Tage und exakte Einsatzziele sind als Kontext sichtbar; 8★-Bonus und möglicher Ersatz müssen vor einer Entscheidung gesondert geprüft werden.
- Die Ansicht ist strikt **read-only**: kein Spieler wird pausiert, entfernt oder umgeplant, keine neue Datenbank/Audit-Entscheidung und kein automatischer Plan-Update. Aufklappzustand beim Refresh erhalten, Hilfe und Regressionen ergänzt.
- **Offen:** echtes Owner-Review mit „übernehmen/entschuldigen/später“ und tenantgeschütztem Shared Audit, sichere Konfliktprüfung und Live-/Safari-/Android-Abnahme.
- **Offiziell veröffentlicht:** [PR #188](https://github.com/Smolmig/cwl_planer/pull/188) Squash `33b127e5074abb`, [PR-CI 42650169375](https://github.com/Smolmig/cwl_planer/actions/runs/42650169375) **535/535**, [Main-CI 42650516778](https://github.com/Smolmig/cwl_planer/actions/runs/42650516778), [Pages 42650516172](https://github.com/Smolmig/cwl_planer/actions/runs/42650516172), [Release-Workflow 42650808819](https://github.com/Smolmig/cwl_planer/actions/runs/42650808819), [v1.16.45](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.45) erfolgreich.


## [1.16.44] - 2026-11-09

### CWL #184 Phase 1: letzte Stunde, lokale Erinnerungsquittierung
- Die bestehende CWL-Warnung ist auf das 60-Minuten-Fenster, gültigen War-Key und vollständiges Spieler-Roster beschränkt. Fehlende oder unbrauchbare Angriffslisten sind *unbekannt*, nicht automatisch verpasst.
- Clanführung kann die Erinnerung auf **diesem Gerät** mit Zeitstempel quittieren; bei einer veränderten Gruppe noch offener Spieler erscheint eine neue Erinnerung. Viewer sehen den Hinweis, ändern ihn aber nicht. Keine geteilte Audit-Quittierung; diese bleibt für Phase 2 offen.
- Bei veralteten API-Daten erscheint nur ein neutraler Prüfhinweis ohne Behauptung verpasster Angriffe. Kein Push bei geschlossener App.
- Mobile Aktionszeile, Hilfeseite und Regressionstests aktualisiert. Unverändert: Plan-Solver, CWL-Locks, Datenbank, Rollen und Offline-PWA. Reale Geräteabnahme offen.
- **Release-Nachweise:** [PR #186](https://github.com/Smolmig/cwl_planer/pull/186) gemergt als `a846da0d3dc0`; [PR-CI 42610179739](https://github.com/Smolmig/cwl_planer/actions/runs/42610179739) **532/532**, [Main-CI 42610521496](https://github.com/Smolmig/cwl_planer/actions/runs/42610521496), [Pages 42610521083](https://github.com/Smolmig/cwl_planer/actions/runs/42610521083), [Release-Workflow 42610688919](https://github.com/Smolmig/cwl_planer/actions/runs/42610688919), [offizieller Release v1.16.44](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.44) erfolgreich.

## [1.16.43] - 2026-11-09

### CWL #181: belegte Angriffe statt abgeschlossener Tage als Ausführungsfortschritt
- **Root Cause:** `getPlayedAttackResults` enthielt bisher ausschließlich `warEnded`-Resultate; Plan-Tiles und Einsatzbalken zeigten zudem nur `state.locks[].locked` als „gespielt“. Ein laufender vierter Angriff erschien daher nach drei abgeschlossenen Tagen noch als „3 gespielt · 1 geplant“.
- **Anzeige:** Reine, nach aktuellem Clan, Saison, Tag und stabilem Player-Tag abgeleitete Projektion: grün **Ausgeführt** = nachweislicher Angriff; Gold **Offen** = noch nicht ausgeführter, nicht abgeschlossener geplanter Einsatz. Bereits abgeschlossene Tage ohne belegtes Ergebnis sind **ungeklärt**, nicht fiktiv ausgeführt. In Plan-Tiles, Einsätze-Zahlen/Balken/Filtern und aufgeklappten Spieler-Tagen dieselbe Basis; Kriegsabschluss weiter getrennt.
- **CWL-Leistung:** Ausschließlich im Tab Einsätze kompakt **3★-Quote (Dreier/belegte AG)** und **Ø tatsächlich erkämpfte Sterne/AG** mit Fallzahl; fehlende Daten ohne 0-%-Scheindaten. Kumuliertes 8★-Ziel bleibt davon fachlich getrennt. Ergebniseinträge während `inWar` werden sichtbar, auch gültige 0★ und Prozentwerte mit Nachkommastellen; ungenutzte Angriffe gelten erst nach `warEnded` als verpasst.
- **Aktualisierung:** Neue Clash-Ergebnisse aktualisieren Plan-Tiles und Einsatzverteilung ohne Solver- oder Lock-Mutation. Offene Details, Fokus und sichtbarer Spieler bleiben bei laufenden Cloud-Updates erhalten.
- **Regression:** Neuer Browser-Test mit mishix (3 abgeschlossene Tage + vierter Angriff bereits erfolgt) und zweitem Spieler, 320/390/430/1366px Arena/Dark/Light, plus Unit-Regression für `inWar`/0★/späte Abwesenheit und Clan/Saison-Schutz. Changelog, Hilfeseite und Projektübergabe im selben Update aktualisiert.
- **Grenze:** Keine Änderungen an Planungsmodi, Solver, gespeicherten Tages-Locks, Cloud-DB/RLS/Auth/Edge, historischer Statistik oder Offline-PWA. Echte Geräteabnahme und realer Einzeldatensatz mishix weiterhin separat; CI und Release inzwischen nachgewiesen.
- **Release-Nachweise:** [PR #185](https://github.com/Smolmig/cwl_planer/pull/185) gemergt als `f3d82174f140`; [PR-CI 42600867611](https://github.com/Smolmig/cwl_planer/actions/runs/42600867611), [Main-CI 42601126972](https://github.com/Smolmig/cwl_planer/actions/runs/42601126972), [Pages 42601126816](https://github.com/Smolmig/cwl_planer/actions/runs/42601126816), [Release 42601341426](https://github.com/Smolmig/cwl_planer/actions/runs/42601341426), [offizielles v1.16.43](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.43) erfolgreich.

## [1.16.42] - 2026-11-09

### Cloud: Arena/Gold als Farbschema für neue Nutzer
- **Wunsch:** Neue Nutzer ohne gespeicherte Farbschema-Auswahl sollen statt Dunkel standardmäßig das Arena-Theme in Anthrazit/Gold sehen. Vorher gespeicherte Auswahl bleibt unangetastet.
- **Fix:** Initiales HTML-Theme und Browser-Themenfarbe Gold, Arena in der bestehenden Design-Auswahl als Standard markiert, die normalen und Fehler-Fallbacks für lokale UI-Einstellungen auf Arena gesetzt. Bereits gespeicherte Dark-/Light-/System-/Cyber- und Arena-Präferenzen werden weiterhin respektiert; keine Datenmigration.
- **Regression:** Neuer Browser-Test unter 320/390/430/1366 px für einen frischen Cloud-Aufruf, gespeicherte Dunkel-Präferenz, Themewechsel mit Reload, fehlerhafte Einstellungen, explizites Systemfarbschema und unveränderte Offline-PWA. [PR #179](https://github.com/Smolmig/cwl_planer/pull/179) gemergt als `755e1d241131`; [PR-CI 42587244106](https://github.com/Smolmig/cwl_planer/actions/runs/42587244106) und [Main-CI 42587565761](https://github.com/Smolmig/cwl_planer/actions/runs/42587565761) jeweils **527/527**, [Pages 42587565164](https://github.com/Smolmig/cwl_planer/actions/runs/42587565164), [Release-Workflow 42587821595](https://github.com/Smolmig/cwl_planer/actions/runs/42587821595) und [v1.16.42](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.42) erfolgreich. Frühere Testannahme für unmittelbare OS-Systemfarbumschaltung korrigiert (nach Reload geprüft). Bestehendes Theme wird vor dem ersten CSS-Laden berücksichtigt.
- **Hilfeprüfung:** Die Hilfe beschreibt CWL-Funktionen unverändert korrekt; das neue Standard-Farbschema ist direkt in Design & Aktualisierung sichtbar, keine weitere Help-Karte nötig.
- **Nicht-Ziele:** CWL-/Planungslogik, Statistiken, Supabase-Daten/Auth/RLS/Edge, Collector und separate Offline-PWA bleiben unverändert.

## [1.16.41] - 2026-11-09

### Statistik: Einzahl bei einem Krieg/Angriff (#114/#46)
- **Befund:** „Alle 1 abgeschlossenen normalen CWs“, „1 ausgewählte Kriege“, „1 Angriffe“ im Überblick, CWL-Umfang, Trend-Tooltip/-Tabelle sowie Spieler-/Kriegdetails.
- **Fix:** Korrekte Einzahl nur in bestehenden Texten; alle Werte, Quoten, Filter und CWL-Aufstellungen unverändert.
- **Tests:** Synthetischer Chromium-Viewer-Fall mit genau einem beendeten CW/Angriff und CWL-Tag/Angriff; 320/390/430/1366px Arena/Dark/Light. Cache-/Release-Verträge aktualisiert. [PR #174](https://github.com/Smolmig/cwl_planer/pull/174) gemergt als `68e7482a4a5b`; PR-CI 42583057065 und Main-CI 42583298284 je **526/526**, GitHub Pages 42583297754, Release-Workflow 42583490544 und [v1.16.41](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.41) erfolgreich.
- **Grenze:** Kein produktiver DB-/Auth-/RLS-/Edge-/Collector-/CWL-Solver-/Offline-PWA-Eingriff.

## [1.16.40] - 2026-11-09

### Statistik-Ladestatus unterscheidet abgeschlossene und unbestätigte Kriege (#114/#46)
- **Befund:** Nach einem erfolgreichen DB-Lesezugriff stand „Statistik aktuell“, obwohl die automatische Datenerfassung verspätet sein kann. Der Zähler enthielt auch noch nicht bestätigte Kriege. Der leere Zustand empfahl auch Beobachtern einen nicht erlaubten Import. Die Erfolgsmeldung gemischter CW-/CWL-Importe sagte nur „CW-Statistik“.
- **Fix:** Bestehende Statuszeile meldet „Historie geladen“, zählt nur wirklich bestätigte abgeschlossene Kriege und nennt weitere nicht bestätigte Einträge separat. Keine Schein-Aktualität. Leere Ansichten sind neutral. Der separate Collector-Zeitstempel bleibt zuständig für tatsächliche Aktualität. Nach Import lautet der Toast „Kriegsstatistik importiert“.
- **Tests:** Neue pure Falltests für Einzahl/Mehrzahl, null, nur unbestätigt und gemischte Daten; bestehender Chromium-Viewer-Browsertest (320/390/430/1366px, Gold/Dark/Light) prüft die Statuszeile aus zwei abgeschlossenen und zwei vorläufigen Kriegen. Erster PR-CI 42580475393: 513/526 mit 13 noch auf v1.16.39 fixierten Versionsprüfungen, danach synchronisiert. Finaler PR-CI 42580980017 **526/526**, Main-CI 42581295046 **526/526**, Pages 42581294634, Release-Workflow 42581460764 und [v1.16.40](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.40) erfolgreich ([PR #172](https://github.com/Smolmig/cwl_planer/pull/172), Squash `66bf667dec55`).
- **Grenze:** Keine Datenbank-, Collector-, Auth-/RLS-/Edge-, CWL-Plan-/Solver-, Angriffsdaten-, Quoten- oder Offline-PWA-Änderung; echte iOS-/Samsung-Abnahme ausstehend.

## [1.16.39] - 2026-11-09

### Spielerstatistik: Namen tatsächlich alphabetisch sortieren (#114)
- **Befund:** Im Statistik-Reiter „Spielerstatistik“ zeigte das Dropdown „Name“, doch `ascending=false` wurde beim Wechsel auf „Name“ nie geändert. Weil der allgemeine Zahlen-Komparator auch Zeichenketten mit umgekehrtem Vorzeichen verglich, kamen Spielernamen tatsächlich in Z–A statt A–Z; die separate Spielerform bietet dagegen ausdrücklich „Spielername (A–Z)“ an.
- **Fix:** Eindeutige Dropdown-Beschriftung „Name (A–Z)“ und nur für `order==="name"` natürliche deutsche alphabetische Reihenfolge. Die Kennzahlen 3★-Quote, Angriffe, Ø Sterne und belegte Ausfälle bleiben absteigend; der unveränderliche `ascending`-Restzustand entfällt. Die bereits seit v1.16.36 aktiven aktuellen Clannamen werden weiterhin ausschließlich für Anzeige und Sortierung projiziert.
- **Absicherung:** Erweiterung von `tests/cloud-stats-current-roster-names.test.cjs` um explizite Z–A-Falle (aktuell umbenannter Spieler gegenüber ehemaligem Spieler), Auswahl „Name (A–Z)“, Gegenprüfung der weiterhin absteigenden Quoten und Viewer-Browserfälle bei 320/390/430/1366 px in Gold/Dark/Light. Veränderte Versionsreferenzen/Cache-Tests auf v1.16.39 synchronisiert.
- **Sicherheitsgrenze:** Keine Veränderung der gespeicherten historischen Spielernamen, Statistiken, Kriegsfilter, CWL-Planung, produktiven Supabase-Daten, Auth/RLS/Edge oder Offline-PWA. [PR #170](https://github.com/Smolmig/cwl_planer/pull/170) Squash `d79292a9b1af1820622e777b5acf7bf37df75d99`; [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42577858236) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42578093279) jeweils **525/525 Tests erfolgreich**, [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42578092724), [Release-Workflow](https://github.com/Smolmig/cwl_planer/actions/runs/42578270170) und [offizieller Release v1.16.39](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.39) erfolgreich. Reale Safari-/Android-Abnahme bleibt ausstehend.


## [1.16.38] - 2026-11-09

### Hilfe: Einsatzverteilung und Mitgliedereinstieg passen zur aktuellen App (#46/#114)
- **Befund:** Die integrierte Hilfe erklärte noch „G“ und „P“ als Status, obwohl die Einsatzübersicht schon seit v1.15.7 die Wörter „Gespielt“, „Geplant“ und „Gesamt“ verwendet. Die Anzeige „6/7 Tage ohne RAUS“ sowie das Aufklappen einzelner Kriegstage wurden nicht erklärt. Einstiegsschritt 1 suggerierte nur manuelles Hinzufügen, obwohl Cloud-Clans Spieler aus Clash übernehmen können.
- **Änderung:** Hilfe beschreibt die realen Beschriftungen, unterscheidet Tage ohne Ausschluss ausdrücklich vom Einsatzsoll, weist auf konkrete Tage (gespielt, geplant, in Clash fix) und die nicht garantierte 8★-Orientierung bei vorhandenen Daten hin. Startschritt unterscheidet gemeinsamen Clan-Abgleich und manuellen Gastmodus. Keine zusätzlichen Karten, Buttons oder Änderungen an der Einsätze-Ansicht.
- **Abdeckung:** Neuer Browsertest in `tests/cloud-more-help-subpage.test.cjs` kontrolliert die tatsächliche Hilfeseite unter „Mehr“ bei 320/390/430/1366px, Gold/Dark/Light, Viewer, sichtbaren Wörtern, veraltete Abkürzungen, Layout und Rückweg. Version-/Cache-Vertrag auf v1.16.38.
- **Grenze / Veröffentlichung:** Ausschließlich sichtbare Hilfetexte und Release-Metadaten; keine Änderung an Einsätzen, Tagesregeln, CWL-Solver, Angriffsdaten, Cloud-/Auth-/DB-/RLS-Funktionen oder Offline-PWA. [PR #168](https://github.com/Smolmig/cwl_planer/pull/168) Squash `262782fc819f520823152283801a87c21e90602d`; [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42575024880) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42575272277) je **525/525 Tests grün**, [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42575271878), [Release-Workflow](https://github.com/Smolmig/cwl_planer/actions/runs/42575403901) und [v1.16.38 Release](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.38) erfolgreich.


## [1.16.37] - 2026-11-09

### Installationshilfe für Clanmitglieder verständlicher (#46/#114)
- **Befund:** Unter „Mehr → App installieren“ verwies die Hilfe mit „cloud-app.html“ und „Offline-PWA“ auf technische Begriffe, statt den Unterschied zwischen dem gemeinsamen Cloud-Planer und einer versehentlich gespeicherten älteren lokalen Ansicht an den tatsächlichen Funktionen zu erklären. Genau dieser Fehlerfall hatte zuvor bei Android dazu geführt, dass die installierte App keine Clan-Anmeldung zeigte.
- **Korrektur:** Deutlicher Hinweis auf die vollständige gemeinsame App mit „Clan & Konto“ und „Statistik“; alle Geräteschritte sprechen vom gemeinsamen CWL-Planer. Ein dezenter, standardmäßig geschlossener Abschnitt „Installierte App ohne Anmeldung oder Statistik?“ beschreibt die Wiederherstellung über das erneute Hinzufügen der richtigen Startbildschirm-Verknüpfung. Keine Pop-ups oder zusätzliche Karte; Bedienbarkeit per Tastatur und auf schmalen Geräten.
- **Absicherung:** Browserregression zur Installationshilfe prüft iPhone/Android sowie den neuen Troubleshooting-Abschnitt als Viewer auf 320/390/430/1366 px in Gold/Dark/Light, Touchfläche, Hilfetext und kein horizontales Überlaufen. Release-/Versionstests mit synchronisierten Cache-Parametern. Keine Änderung an Manifest/Service Worker, Cloud-/Offline-Installationstechnik, Cloud-Daten, Auth/RLS, Statistikberechnung oder CWL-Solver.
- **Veröffentlichung:** [PR #166](https://github.com/Smolmig/cwl_planer/pull/166) Squash `4e4945fdd2fe2df9719783012deeb2d55359b4ab`, [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42572879637) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42573143409) jeweils **524/524 erfolgreich**; [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42573143108), [Release-Workflow](https://github.com/Smolmig/cwl_planer/actions/runs/42573273563) und [offizieller Release v1.16.37](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.37) erfolgreich. Reale iPhone-/Android-Praxisabnahme weiterhin ausstehend.

## [1.16.36] - 2026-11-09

### Aktuelle Spielernamen in Statistik, Spielerform und Duellen einheitlich
- **Befund (#114/#110):** Die Formliste nutzt bereits den aktuellen Namen des Cloud-Clankaders. Freie Spielerstatistik und Duell-Auswahl zeigten denselben Spieler noch mit dem historischen Namen des gespeicherten Angriffs, wodurch Suchergebnis und Sortierung bei Clan-Namenswechseln irreführend werden.
- **Fix:** Aktuelle berechtigte Kadernamen ausschließlich zur Anzeige, Suche und alphabetischen Sortierung der freien Spielerstatistik sowie bei Duell-Dropdowns und Duellkarten verwenden. Ehemalige Clankameraden behalten ihre dokumentierten Namen. Historische `attacker_name`-Werte, Identitäten, Quoten und Datenbank bleiben unverändert.
- **Regression/Sicherheit:** Chromium-Test für aktiven und ehemaligen Spieler, Umbenennung im selben Clan, Statistik/Spielerform/Duell, Suche und Viewer auf 320/390/430/1366 px Gold/Dark/Light; Rollen, Solver, Cloud-DB/Edge/Auth/RLS und Offline-PWA unverändert. [PR #164](https://github.com/Smolmig/cwl_planer/pull/164) Squash `4ba46374a3d5`, [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42536945903) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42565739761) jeweils **523/523 Tests grün**; [GitHub Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42565738945), [Release-Workflow](https://github.com/Smolmig/cwl_planer/actions/runs/42565907016) und [offizieller Release v1.16.36](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.36) erfolgreich. Reale Safari-/Android-Geräteabnahme separat offen.


## [1.16.35] - 2026-11-09

### Spielerstatistik: abgeschlossene CW-Auswahl und Null-Daten-Zeiträume
- **Befund (#114/#110):** „Nur CW / Alle CWs“ führte zu „Bis zu all“ und zur Gesamtzahl inklusive unfertiger API-Kriege, während die ausgewerteten Angriffe diese zurecht ausschlossen. Bei 0 ausgewählten abgeschlossenen Kriegen erschienen unverständliche Datumsstriche.
- **Gezielter UI-Fix:** Zähler, Begrenzungstexte und ausgewählte Datenbasis einheitlich aus `describeWarSelection` (abgeschlossene Kriege) ableiten; Einzahl bei einem Angriff. Bei noch leerer Auswahl neutralen Leerzustand statt 0-%-Werten oder Datums-Platzhaltern zeigen. CW/CWL-Filter und unabhängige Form-/Vergleichsauswertung unverändert.
- **Regression/Abnahme:** `tests/cloud-stats-finalized-scope-empty.test.cjs` mit abgeschlossenen/noch laufenden CW/CWL-Kriegen, All/Last-1/0-Filtern, Viewer, Arena/Dark/Light, 320/390/430/1366 px. [PR #163](https://github.com/Smolmig/cwl_planer/pull/163) gemergt als `16e3da72a4`, [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42536408138) **522/522 grün**, [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42536612819), [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42536612370) und [offizielle v1.16.35](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.35) erfolgreich. Keine produktiven DB-, Auth/RLS-, Edge-, CWL-Solver-, Plan- oder Offline-PWA-Änderungen.


## [1.16.34] - 2026-11-09

### Spielerform: Aktuelle Clanmitglieder trotz fehlender Angriffshistorie sichtbar
- **Befund (#114/#110):** Die Formliste entstand nur aus vorhandenen Angriffen und blendete aktive Mitglieder ohne gespeicherten Angriff vollständig aus. Historische Namen konnten aktuelle Profilnamen überlagern. Ein Same-Clan-Datenupdate konnte die Leseposition in einer langen Liste verschieben.
- **Korrektur:** Aktuelle Clan-Tags mit Namen aus dem bereits ausgewählten Cloud-Profil als neutrale Einträge aufnehmen; bei fehlender gleich-RH-Auswertung ausdrücklich **„Keine Daten“** und **keine belegte 3★-Quote**, niemals fingierte 0 %, 0/0 oder einen verpassten Angriff. Ehemalige Spieler aus dokumentierter Historie bleiben unterscheidbar. Kleinere verständliche Form-/Suchtexte, Zeilennummer statt Scheinplatzierung; Scrollanker nur bei Hintergrund-Reload desselben Clans. Auf Clanwechsel alte Spielerform unmittelbar leeren.
- **Test & Sicherheit:** Neuer Pure-/Chromium-Test für gültige/current/ehemalige Tags, Namen, unbekannte RH, nicht-finalisierte Angriffe, 30-/90-Tage-Fenster, mobile Viewer-UI (320/390/430/1366 px in Arena/Dark/Light), Suche, längere Scrollliste, Nachladen und Clanwechsel. [PR #162](https://github.com/Smolmig/cwl_planer/pull/162) gemergt als `1fa8e8b45d`; [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42535196946) **521/521 Tests**, [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42535345901), [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42535344887) und [offizielle v1.16.34](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.34) erfolgreich. Keine Änderung an echten Angriffswerten, CWL-Solver, Cloud-Profilformat, produktiver Supabase/RLS/Auth/Edge, Rollen oder Offline-PWA.


## [1.16.33] - 2026-11-08

### Statistik > Verlauf & Kriege: österreichische Datumsbeschriftung
- **Nutzerbefund (#114/#110, 08.11.):** Unter dem Verlaufsdiagramm standen abgeschnittene ISO-Datumswerte, z. B. `11-03` bzw. `2026-11`, die wie ein englisches Datumsformat aussehen und nicht eindeutig als Tag/Monat/Jahr bzw. Kalenderwoche zu lesen sind. Die Statistikberechnung war davon unberührt.
- **Gezielter Fix:** Reine Formatfunktion `formatTrendPeriod()` für die sichtbare Diagrammachse: Tage `03.11.26`, Wochen `KW 45/26` nach ISO-Kalenderwochenjahr (inkl. Jahreswechsel), Monate `Nov 26`. Punkt-Tooltips und aufklappbare Verlaufstabelle erhalten die ausgeschriebene eindeutige Variante (z. B. `KW 45/2026 (ab 02.11.2026)`). Gespeicherte UTC-Buckets, Abstände, Datenpunkte, Filter und 3★-Quoten bleiben unverändert.
- **Regression/Release nachgewiesen:** Pure- und Chromium-Browsertests für Tages-/Wochen-/Monatsansicht, Monats- und ISO-Jahreswechsel, Gold/Dark/Light, 320/390/430/1366px, Viewer, Quoten und Tabellenzustand. [PR #161](https://github.com/Smolmig/cwl_planer/pull/161) Squash `598797b7`, [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42530748174) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42530925325) jeweils **519/519 grün**; [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42530924911), [Release-Workflow](https://github.com/Smolmig/cwl_planer/actions/runs/42531053338) und [Release v1.16.33](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.33) erfolgreich. Keine produktiven DB-/Auth-/RLS-/Edge-/CWL-Planer-/Offline-PWA-Änderungen; echte Geräteabnahme ausständig.


## [1.16.32] - 2026-11-08

### Statistik > Vergleiche: Rathaus-Details bei Realtime-Refresh stabil
- **Befund (#114/#110):** Die geöffnete Auswertung „Weitere Rathaus-Kombinationen und Sternverteilungen“ blieb nach Datenabgleich zwar offen, jedoch wurde der native `<summary>` neu aufgebaut und verlor Tastaturfokus/Leseposition. Das danebenliegende Spielerduell besaß bereits eine passende Absicherung.
- **Gezielter Fix:** `renderMatchups()` verwendet denselben Fokus-/Scroll-Helfer wie das Spielerduell, aber mit eigenem Clan-/Versionsstand und Reset bei Clanwechsel. Bildschirmposition nur bei echtem same-clan-Reload verankern, nicht bei bewusstem CW/CWL-/Zeitfilterwechsel. Keine Rechen-/Daten-/Filteränderung.
- **Regression/Release bestätigt:** Browserregression Gold/Dark/Light, Viewer, 320/390/430/699/1366 px mit neuen Angriffsdaten, Fokus, Open-State, Leseposition, Filter, keine Überläufe. [PR #160](https://github.com/Smolmig/cwl_planer/pull/160) (Squash `2fd2e661`), [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42529583635) und [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42529737537) jeweils **517/517 grün**, [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42529736839) und [Release v1.16.32](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.32) erfolgreich. Echte Mobilgeräteabnahme offen. Kein Eingriff in CWL-Solver, produktive Clan-Daten, Supabase DB/Auth/RLS/Edge oder Offline-PWA.


## [1.16.31] - 2026-11-08

### Mitglieder: Fokus und Bildschirmposition bei Live-Updates
- **Befund (#46):** Realtime-Neuaufbau der Mitgliederliste stellte den Fokus des Namens-Bearbeiten-Buttons nicht wieder her. Bei einer aktiven Bedienung im Zweispaltenraster konnte ein anderer Spieler als Scroll-Anker gewählt werden.
- **Fix:** `renderMembers()` stellt den Fokus von `.member-name-edit` und den übrigen erkannten Controls wieder her. Nur bei echten Refreshs nutzt es den fokussierten sichtbaren Spieler als vorrangigen Scroll-Anker, ansonsten die vorhandene sichtbare Zeile. Kein doppelter Scrollausgleich; absichtliches Suchen/Sortieren wird nicht verankert.
- **Regression und Release:** Chromium Gold/Dark/Light, Viewer, 320/390/430/699/1366 px, neuer Spieler oberhalb einer offenen Karte, Fokus/Filter/Position. [PR #159](https://github.com/Smolmig/cwl_planer/pull/159) (Squash `6b1a0bc4`) mit [PR-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42527532685) **516/516 grün**, [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42527705189) **516/516 grün**, [GitHub Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42527704845) und [offizieller Release v1.16.31](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.31) erfolgreich. Echte iOS-/Android-Geräteabnahme offen. Keine Änderungen an CWL-Solver, Mitgliedsdaten, Supabase/Edge/Auth/RLS oder Offline-PWA.


## [1.16.30] - 2026-11-08

### Mitglieder: mobile Suche und Spielerdetails besser bedienen
- **CSS-Befund (#46):** Kurz-Landscape-Ansichten verkleinerten Such- und Filterfelder auf 34px, auf schmalen Ansichten konkurrierten Suche, Filter und Trefferzahl in einer Zeile. Auch Hilfe-Controls waren klein.
- **Gezielter Patch:** Mindestens 44px für Mitgliedersuche, Statusfilter und Hilfe; mobil zwei Spalten und Trefferzahl darunter, Eingaben mit 16px Text. Bearbeiten erhält `aria-controls` auf den eigenen stabilen Spielerbereich.
- **Regression & Release:** Chromium bei 320/390/430/699/820-Landscape/1366px in Arena/Dark/Light und Beobachterrolle. Vorheriger PR-Lauf 504/514 ausschließlich wegen veralteter Test-Versionsregexe; korrigierter [PR #158](https://github.com/Smolmig/cwl_planer/pull/158) **514/514**, [Main-CI](https://github.com/Smolmig/cwl_planer/actions/runs/42493552329) **514/514**, [Pages](https://github.com/Smolmig/cwl_planer/actions/runs/42493551733) und [offizieller Release v1.16.30](https://github.com/Smolmig/cwl_planer/releases/tag/v1.16.30) erfolgreich. Keine Daten-/Solver-/Auth-/RLS-/Edge-/Offline-PWA-Änderung. Reale Mobilgeräte offen.


## [1.16.29] - 2026-11-08

### Einsätze: Spielertage verständlich öffnen und schließen
- **Befund (#46):** In `renderSummary()` blieb die Text-/Tooltip-Beschriftung des geöffneten Spielers „Einsatztage für … anzeigen“, obwohl die Tage bereits offen waren. Der Button hatte zwar `aria-expanded`, aber keine Zuordnung zur tatsächlich geöffneten Tageszeile. Nur auf sehr schmalen **Hochformat**-Smartphones war die Mindest-Touchhöhe 44 px; bei breiteren Mobilgeräten und Querformat griff diese Regel nicht.
- **Gezielter UI-Fix:** Text und zugänglicher Name wechseln korrekt zwischen „Einsatztage … anzeigen/schließen“. Bei ausgeklapptem Zustand referenziert der Button per `aria-controls` den vorhandenen, eindeutig benannten Tagesbereich; bei geschlossenem Zustand gibt es keinen nicht existierenden Zielverweis. Auf allen mobilen Breiten bis einschließlich 699 px mindestens 44 px Touchhöhe. Kein zusätzlicher Karte-/Icon-Ballast und keine Änderung an den Einsatzdaten.
- **Regression und Veröffentlichung:** Neuer synthetischer Chromium-Test mit **echtem `renderSummary()`** bei 320/390/430/600/699/768/1366 px und Arena/Dark/Light, Beobachterrolle, Klick/Enter, Fokus, korrekt verknüpftem Tagesbereich, Filterbedienung und unverändertem Planobjekt. **PR- und Main-CI jeweils 512/512 grün**, PR #157 gemergt, GitHub Pages und offizieller Release v1.16.29 erfolgreich. Echte iOS-Safari-/Android-Geräteabnahme bleibt separat offen.
- **Unverändert:** Planungssolver, 8★-Medallogik, Spielerstatistik, Datenbankschema, Supabase/Auth/RLS, Rollen und separate Offline-PWA.


## [1.16.28] - 2026-11-08

### Verlauf & Kriege: mobil lesbare Zeiträume, Tabellen und Kriegskarten
- **Codebefund (#114/#46):** Der vorhandene `stats-war-history-scroll`-Container der Zeitverlaufstabelle hatte kein eigenes Scroll-CSS; drei Spalten mit „Quote (N Angriffe)“ und 10-px-Tabellenköpfen konnten bei schmalen Displays zusammengedrückt/umgebrochen werden. Die Kriegskarten und Angreifer-/Gegnerzeilen verwendeten auch auf 320 px ein nebeneinanderliegendes Flexlayout; lange Namen drohten unlesbar zu werden.
- **UI-Patch:** Tabellenregion darf separat horizontal scrollen, mit Tastaturfokus, Region-Beschreibung und Spalten-`scope`; die Tabelle bleibt mindestens 420 px breit, hat 12-px-Köpfe und tabellarische Ziffern. Die Seite selbst scrollt nicht seitlich. Kriegskarten bis 550 px nutzen eine ruhige einspaltige Reihenfolge: Krieg/Gegner, Angriffssumme, darunter beim Öffnen Angreifer und Ergebnis. Lange Namen brechen in allen Viewports um.
- **Reload-Kontext:** Bei einem echten Daten-Refresh im selben Clan bleiben geöffnete Tabelle, horizontaler Scrollabstand und Fokus auf der scrollbaren Region erhalten. Bewusst geänderte Filter bleiben davon unabhängig; die bestehenden Scroll-/Fokus-Anker der Kriegsdetails bleiben bestehen.
- **Tests & Release:** Neuer synthetischer Chromium-Regressionstest für 320/375/390/430/550/720/1366 px, Arena/Dark/Light, Viewer, lange ungetrennte Namen, Diagramm/Filter, Tabelle/Region, Touchflächen, Scrollposition, offene Kriegskarte und Fokus nach Reload. Erster PR-Lauf 509/510 (neuer Test nahm fälschlich Listenposition statt Spieleridentität an), korrigiert auf **PR-/Main-CI jeweils 510/510 grün**. PR #156 gemergt, GitHub Pages und offizieller Release v1.16.28 erfolgreich. Echte iOS-Safari-/Android-Gerätetests bleiben ausstehend. Keine Änderung an Kriegsdaten, Statistikmethodik, Plan/Solver, Rollen/Auth/RLS, Supabase/Edge oder Offline-PWA.


## [1.16.27] - 2026-11-08

### Vergleiche: CW/CWL-Zahlen eindeutig Spieler A und B zuordnen
- **Codebefund:** Im direkten Zweispieler-Vergleich fehlten über den CW/CWL-Zahlen eigene Spaltenüberschriften. Bei schmalen Smartphones oder vielen Zeilen war unklar, welcher Prozent- und Angriffsanteil zu welchem ausgewählten Spieler gehört. Die darüberliegenden Namen allein lösten die Zuordnung nicht dauerhaft.
- **UI-Korrektur:** Beide bestehenden Spielerköpfe erhalten eine dezente „Spieler A/B“-Kennzeichnung. Eine einfache dreispaltige Überschrift („Kriegsart / Spieler A / Spieler B“) steht über den zwei **unveränderten** CW/CWL-Zahlenzeilen; die Überschrift benutzt mobil exakt dieselbe Grid-Geometrie wie die Werte. Die konkreten Angriffszeilen haben für Screenreader zusätzlich eindeutige beschreibende Labels. Die bisher redundante Einleitungszeile entfällt.
- **Browserregression & Veröffentlichung:** Synthetische Normal-CW-/CWL-Angriffe, zwei Spieler mit langen Namen, Viewports 320/375/390/430/720/1366 px, Arena/Dark/Light, Beobachter, sichtbare und zugängliche A/B-Spalten, korrekte Rasterausrichtung, kein horizontaler Seitenscroll, mindestens 44 px für beide Detail-Summaries, Offen-/Fokuszustand nach Datenaktualisierung. **PR #155 und Main-CI jeweils 509/509 Tests grün**, GitHub Pages und offizieller Release v1.16.27 erfolgreich. Keine echte Safari-/Android-Geräteabnahme behauptet.
- **Grenzen:** Keine Änderungen an 3★-Quoten, Angriffszahlen, Spielerwahl-/Vergleichsfiltern, CWL-Plan, Solver, Supabase, Edge/RLS/Auth/Rollen, Rohdaten oder separater Offline-PWA.


## [1.16.26] - 2026-11-08

### Spielerform: lesbare Steuerelemente und kurze Einordnung
- **Befund:** Die drei Zeitraum-Tasten in der Spielerform wurden bis 375 px ausdrücklich auf **11 px** verkleinert. Die Form- und Vergleichsfilter hatten nur **43 px Mindesthöhe**. Zusätzlich wiederholte der dynamische Einordnungstext die langen Sortiergruppen und Fachmethodik, obwohl eine aufklappbare Erklärung existiert.
- **Änderung:** Im mobilen Format (bis 720 px) bleiben die Zeitraumstasten bei **mindestens 13 px** Beschriftung und **12 px** Zusatzzeile, mit Platz für Umbruch und mindestens 64 px Höhe. Die Form- und Vergleichsfelder haben mindestens **44 px**. Die Formhinweise nennen weiterhin Zeitraum, Anzahl tatsächlich belegter gleich-RH-Spieler, Sortierbasis und ausdrücklich, dass Listenplätze keine Stärkerangliste sind; Details bleiben unter „Wie wird Spielerform berechnet?“ vollständig erhalten.
- **Regression:** Chromium bei 320/375/390/430/720/820/1366 px, Arena/Dark/Light, Viewer, Fokus, aktive Formzeitfenster, neue formbezogene Hinweise, Felder-/Buttongrößen, Wiederladen und kein horizontaler Überlauf. Erster PR-CI 507/508 (alte feste Textprüfung), nach angepasster Textprüfung **PR- und Main-CI 508/508 grün**. PR #154 gemergt, GitHub Pages und offizieller Release erfolgreich. Echte Safari-/Android-Abnahme bleibt ausstehend. Keine Veränderung an Statistikberechnung, Stichproben, CWL-Plan, Datenbank, Edge, Rollen oder Offline-PWA.


## [1.16.25] - 2026-11-08

### Statistik-Navigation auf Smartphones ohne verwaisten fünften Tab
- Bei **fünf Statistikbereichen** erzeugte das mobile 2-Spalten-Raster drei Reihen, davon eine alleinstehende Schaltfläche. Bis 720 px nutzt der Statistik-Tab jetzt zwei ausgewogene Reihen: drei wichtige Einstiege und darunter zwei gleich breite zusätzliche Bereiche. Über 720 px bleiben alle fünf Tabs nebeneinander.
- Mobil hat jede Statistik-Schaltfläche mindestens **44 px Touchhöhe** (statt 43 px), lange Titel können bei 320 px sauber umbrechen. Die vorhandenen Gold-/Dark-/Light-Kontraste und der aktive Zustand bleiben erhalten.
- Neue Chromium-Browserregression für **320/375/390/430/720/820/1366 px**, drei Themes, Viewer-Rolle, Tab-/Panel-Zuordnung, Tastaturfokus, aktive Auswahl nach Reload, vollständige Trefferflächen und keinen horizontalen Überlauf. Echte iPhone-Safari-/Android-Abnahme bleibt ausstehend.
- **Keine** Änderungen an statistischen Berechnungen, CWL-Planung, Cloud-Daten/RLS, Rollen, Auth, Edge oder Offline-PWA.


## [1.16.24] - 2026-11-08

### Statistik-UX: Sekundäre Hinweise nur bei Bedarf
- **Clanüberblick:** Kennzahlen, CW/CWL-Abdeckung und Datenumfang sofort sichtbar; die längere saisonale Einordnung hinter „Mehr zur Datenbasis“ (natives Disclosure, mindestens 44 px Touchhöhe). Der geöffnete Zustand bleibt beim Daten-Reload erhalten, ein leerer oder abgemeldeter Clan zeigt keine alten Details.
- **Datenqualität unverändert:** Der Hinweis zu „mind.“/„k. A.“ ist kürzer, unbekannte Ausfälle bleiben unbekannt. Die Diagrammlegende erklärt CW/CWL-Formen und Datenlücken statt der Theme-Farbe.
- **Tests/Grenzen:** Erweiterte Browserregression für 320/390/430/1366 px, Gold/Dark/Light und Viewer, inklusive Aufklappzustand nach Reload. Reale Safari-/Android-Abnahme weiterhin offen; keine Änderung an Auswertung, CWL-Solver, Supabase, Auth/RLS, Rollen oder Offline-PWA.


## [1.16.23] - 2026-11-08

### Statistik: Details und Leseposition bei Live-Datenaktualisierung erhalten
- **Vergleiche:** Das geöffnete „Sternverteilung und weitere Angriffsdaten“-Detail wird nicht versehentlich geschlossen; falls die Tastatur gerade dessen Zusammenfassung fokussiert, wird der Fokus nach dem Neurendern wiederhergestellt. Die gewählten Spieler und Kriegsfilter bleiben bestehen.
- **Verlauf & Kriege:** Die aufgeklappte Zeitverlaufstabelle erhält Fokus und relative Position bei neuen Daten. Für die einzelnen Kriege wird der **erste sichtbare Krieg anhand seines stabilen War-Keys** als Scroll-Anker verwendet; neu eingefügte Kriege darüber verschieben die Leseposition nicht. Geöffnete Kriegstage und Fokus auf deren Zusammenfassung bleiben erhalten.
- **Nur bei echten Daten-Reloads:** Keine erzwungene Scrollkorrektur beim bewussten Ändern von Zeitraum, Kriegsart, Kennzahl oder Spielerwahl; keine Wiederherstellung alter Clan-Daten nach einem Reset. Mobile und Desktop in 320/390/430/1366 px, Gold/Light/Dark und Viewer-Rolle im Chromium-Browser mit künstlichen Angriffen geprüft.
- **Nicht verändert:** CWL-Solver/Plan, Import/Rohdaten, Supabase-DB/Edge, Rollen/Authentifizierung, Offline-PWA. Ein echter iOS-Safari-/Android-Gerätetest bleibt separat offen.


## [1.16.22] - 2026-11-08

### Statistik-UX: ehrlicher Überblick und stabiler Lesekontext
- **Datengrundlage richtig beschrieben:** Der Clanüberblick nutzt **alle** gespeicherten abgeschlossenen CWs und CWL-Kriegstage. Die Auswahl unter „Spielerstatistik“ bleibt absichtlich unabhängig und darf nicht mehr als Filter des Clanüberblicks beschrieben werden.
- **Kontext bei Datenaktualisierung:** Wenn die neu geladene Spielerstatistik tatsächlich andere Zeilen enthält, bleiben aufgeklappte Spieler-Details, der fokussierte Detail-Button und der erste sichtbare Spieler anhand des Player-Tags erhalten. Ein bewusst geänderter Such-/Sortierfilter wird **nicht** auf die alte Scrollposition zurückgezwungen.
- **Sprachliche Konsistenz:** Sinnvolle Singularformen („1 normaler CW“, „1 CWL-Kriegstag“, „1 Krieg vollständig erfasst“); keine leere „Ausfälle:“-Zeile bei noch nicht gespeicherten Kriegen. Spieler-Details erklären, dass selbst eine vollständige CWL-Aufstellung ohne bestätigten Missed-Endnachweis keine exakten versäumten Angriffe belegt.
- **Abnahme:** Synthetische Browser-Regression für Gold/Light/Dark und 320/390/430/1366 px, CW/CWL-Filterisolation, Viewer-Rolle, spielerbezogenen Fokus/Scroll-Anker bei neu einsortierten Angriffen und Löschung der privaten Spielerzeilen bei Reset.
- **Sicherheitsgrenze:** Kein Zugriff auf produktive Supabase-Daten, keine Tabellen- oder Historienänderung, keine Anpassung an Cloud-Auth, Planungsalgorithmus, CWL-Aufstellungen, Offline-PWA oder Collector.


## [1.16.21] - 2026-11-08

### Datenintegrität: CWL-Missed nur mit tatsächlich bestätigtem Endnachweis
- **Fehler behoben:** Eine finale CWL-Aufstellung (`roster_tags` vollständig) ohne bestätigtes `missed_log_complete=true` darf aus fehlenden gespeicherten Angriffen keine angeblich „verpassten“ Angriffe ableiten. Historische 15/15-, 14/15- und 13/15-API-Kriege bleiben diesbezüglich **unbekannt**, statt fälschlich als vollständig oder mit geschätzten Ausfällen aufzutauchen.
- **Belegte Fakten bleiben sichtbar:** Echte abgelegte Angriffe, Sterne und 3★-Quote unverändert. Explizit bestätigte vollständige CWL-Missed-Logs ergeben weiterhin exakte Werte; einzelne belegte Ausfälle bleiben bei unvollständigem CWL-Log als **Untergrenze („mind.“)** sichtbar. Die bestehende normale CW-Auswertung bleibt eigenständig.
- **Begriffe:** Statistik-KPI heißt nun durchgehend **„3★-Quote“**. Bei unbekannter Datenlage erklärt die Spielerstatistik, warum eine CWL-Aufstellung allein keinen versäumten Angriff beweist.
- **Sicherheit:** Keine Änderung an CWL-Solver, geplanten Einsätzen, Spielerdaten, Importformat, Rollen, RLS, Live-DB, GitHub-Collector oder Offline-PWA. Regressionen prüfen gemischte CW/CWL-Kriege und belegte versus unbekannte Ausfälle.


## [1.16.20] - 2026-11-07

### Statistik: Rathaus-Vergleiche folgen der Kriegsart
- **Fokus:** Bei `Nur CW` werden niedrigere, gleiche und höhere Gegner-RH im normalen Clan-Krieg angezeigt; bei `Nur CWL` die entsprechenden CWL-Werte. Bei `CW und CWL` bleiben die bisherigen drei direkten Vergleichsspalten erhalten.
- **Details:** Aufgeklappte Kombinationen enthalten nur die ausgewählte Kriegsart. Wechseln des Kriegsartfilters schließt das bereits geöffnete Detail nicht; Zeit- und freie Spielerstatistikfilter bleiben unabhängig.
- **Datenqualität:** Keine Angriffe bedeutet weiterhin keine Daten (kein falsches 0 %), Quoten zeigen echte Dreier und Angriffszahlen. Keine neuen Erfolgsprognosen.
- **Regression:** Echter Chromium-Test auf 320/390/1366 px in Gold/Hell/Dunkel mit allen Filterzuständen, Filterisolation und erhaltener Detailöffnung. Keine Änderung an CWL-Solver, Supabase, RLS, Rollen, Rohdaten oder Offline-PWA.
- **Übergabe:** Laufender, versionierter Entwicklungsstand unter [docs/ACTIVE_PROJECT_HANDOFF.md](docs/ACTIVE_PROJECT_HANDOFF.md).

## [1.16.19] - 2026-11-07

### Mitglieder: Tagesregeln bei Cloud-Refresh stabil bedienen
- **Bearbeitung:** Bei einem Realtime-/Cloud-Abgleich desselben Clans werden die offene Spielerkarte, die offenen Tagesregeln und der Fokus auf dem gerade bearbeiteten T1–T7-Regelbutton wiederhergestellt.
- **Position:** Die aktive Regel bleibt im sichtbaren Bereich an derselben Stelle, unabhängig von browserinterner Scroll-Verankerung.
- **Tests:** Echte Chromium-Refresh-Regression auf 320/390/1366 px. Keine Änderung an CWL-Planungslogik, Stammdaten, Rollen, Supabase oder Offline-PWA.


## [1.16.18] - 2026-11-07

### Clash-Chat: Erwähnungen und mobiler Aufstellungsabgleich
- **Erwähnungen:** Bei der Rein-Liste wird zwischen Spielern kein Komma mehr gesetzt: `@Tommy @Suminizer` statt `@Tommy, @Suminizer`. Der kurze Clash-Kopiertext, die Spielerreihenfolge und die Namen bleiben erhalten. Raus-Namen dürfen weiterhin Kommas als normale Trennung haben.
- **Mobile Darstellung:** „Details in Aufstellung · Stand“, bereits durchgeführte Wechsel und „Wechseltext kopieren“ sind getrennte Zeilen. Der Button nutzt auf schmalen Displays die volle verfügbare Breite; Desktop bleibt kompakt.
- **Regression:** Tests für kopierbare tatsächlich erfolgte Wechsel, `@`-Namen ohne Satzzeichen, separate DOM-Zeilen und responsive Geometrie im Gold-, Dark- und Light-Theme. Keine Änderung an Solver, Saison, Supabase, Spielerrollen oder separater Offline-PWA.


## [1.16.17] - 2026-11-07

### CWL: Wechseltext auch nach erledigten Wechseln kopieren
- **Clash-Abgleich:** In der Vorbereitung bleibt der Kopierbutton auch bei „Aufstellung stimmt mit Clash überein“ verfügbar, wenn der bestätigte Vortag andere Spieler enthält. Die Meldung basiert auf beiden echten Clash-Aufstellungen, nicht auf einer hypothetischen Rotation.
- **Clanchat:** Ein `@` vor jedem neu eingeplanten Spieler im kompakten Rein-/Raus-Text. Der Clash-Chat selbst bestimmt, ob eingefügtes `@Name` als echte Erwähnung erkannt wird.
- **Gesamtplan:** Die separate Kopierfunktion ist ausdrücklich als „Gesamtplan kopieren“ bezeichnet und gliedert sieben Kriegstage samt Spielernamen klar; nicht als Clash-Chat-Kurztext gedacht.
- **Sicherheit:** Kein Datenbank-/Solver-/Rollen-Eingriff, keine Mutation von Live-Kriegen und keine Änderung an der Offline-PWA. Versions-/Modul-Caches für die Cloud aktualisiert.


## [1.16.16] - 2026-11-07

### Mitglieder: klare 3★-Quote, Gleichstand fairer sortiert
- **Einheitlicher Name:** In der Mitgliederübersicht und ihren Hilfen, kompakten Plan-Spielerkarten sowie CWL-Aktuell-Hinweisen heißt dieselbe Kennzahl durchgehend **3★-Quote**; bisherige Schreibweisen „3★-Hit-Rate“ und „3★-Hitrate“ entfernt.
- **Sortierung präzisiert:** Die optionale Sortierung „3★-Quote (roh, bis 7 AG)“ zeigt weiterhin die tatsächlich beobachtete Quote; bei gleicher gerundeter Quote stehen Spieler mit mehr belegten Angriffen davor. 7/7 und 1/1 sind damit kein alphabetischer Gleichstand mehr. **Keine** neue Gewichtung, Skill-Prognose oder automatische Rangliste: Unterschiede wie 1/1 (100 %) und 6/7 (86 %) bleiben ausdrücklich rohe Quoten, kein Stärkevergleich.
- **Regression:** Beispielhafte Sortierung kleiner/großer Stichproben; identische CW/CWL-Statistikberechnung, Planungslogik, Aufstellungen, Cloud-Rollen, Backend und Offline-PWA. Cloud-Cache-Version synchronisiert.

## [1.16.15] - 2026-11-06

### Spielerduelle und Vergleichsübersicht aufgeräumt
- **Spielerduelle:** Zwei Spieler, ihre tatsächlichen 3★-Quoten und Fallzahlen stehen nebeneinander; darunter zwei ausgerichtete Zeilen für normalen CW und CWL. Keine zweite ständig sichtbare Diagrammwand.
- **Datenlage:** Qualitative Einordnung der Angriffszahl (Wenige Daten, Erste Tendenz, Mehr Vergleichsdaten), keine automatische Sieger-/Stärkeentscheidung bei 2/2 vs. 30/33.
- **Optionale Details:** Gemeinsame, aufklappbare Sternverteilung mit Ø Sternen, Kriegsanzahl und Datum; der geöffnete Zustand bleibt beim Wechsel des RH-Filters.
- **Rathaus-Vergleich:** Die drei Hauptbalken zeigen jetzt zusätzlich Dreieranzahl / Gesamtangriffe; sehr kleine Stichproben sind kenntlich.
- **Bewahrter Hotfix:** Einsätze-Spielertage mit vorhandenen CWL-Angriffen bleiben nach v1.16.14 aufklappbar. GitHub-Testumgebung bleibt auf Ubuntu 24.04 gepinnt.
- **Unverändert:** Angriffsstatistik-Berechnungen, Cloud-Plan, Solver, RLS, Backend, Rollen und lokale Offline-PWA.


## [1.16.14] - 2026-11-06

### Einsätze: Spieler-Detailansicht wieder erreichbar
- **Hotfix:** Die Aufklappansicht zu gespielten und geplanten Kriegstagen in „Einsätze“ löste bei vorhandenen Clash-Angriffsergebnissen einen JavaScript-Fehler aus (Spieler-Tag im Tagesrendering nicht gebunden). Spieler-Tag wird wieder pro Anzeigezeile korrekt ermittelt; Sterne und Prozentwerte sind dem gewählten Spieler zugeordnet.
- **Regression:** Ein Browserklick mit bereits gespieltem CWL-Tag und vorhandenen 3★/100%-Angriffsdaten öffnet und schließt die Tage auf Mobil und Desktop.
- **Unverändert:** CWL-Solver, Tagesaufstellungen, Spielerdaten, Angriffshistorie, Rollen, Freigaben, API, Datenbank und Offline-App.


## [1.16.13] - 2026-11-06

### Kriegsverlauf mit echten Zeitabständen und sichtbaren Datenlücken
- **Verlauf & Kriege:** CW-/CWL-Kreise und -Rauten erhalten eine echte UTC-Kalenderachse statt gleichmäßig verteilter beobachteter Zeitpunkte. Große Lücken zwischen dokumentierten Kriegswochen erscheinen auch geometrisch groß.
- **Fehlende Beobachtungen:** Zwischen unverbundenen Zeiträumen kleine Achsenbruch-Markierungen und ein verständlicher Hinweis zur Anzahl nicht dokumentierter Wochen/Tage/Monate; keine interpolierten 0-%-Werte oder Linien über unbeobachtete Wochen.
- **Verschiedene Kriegsarten:** CW und CWL bleiben eigenständige Kurven; ein CW-Wert wird nicht durch eine reine CWL-Woche hindurch verbunden.
- **Technisch:** Neue reine Layoutfunktion mit Tests für unregelmäßige Wochen, Monatswechsel, Schalttage, Einzelpunkte, Statistik-Quellen und Gold-/Dark-Responsivität.
- **Unverändert:** Kriegs-/Angriffsdaten, Statistikkernberechnungen, Filterzustände, CWL-Solver, Supabase, Rollen, Offline-PWA.


## [1.16.12] - 2026-11-06

### Spielerform nachvollziehbar und stichprobenbewusst sortieren
- **Spielerform:** Standardsortierung „Datenbasis & 3★-Quote“ verwendet die bestehenden Stichprobenklassen ab 15, 6–14, 1–5 und 0 dokumentierten gleich-RH-Angriffen; innerhalb einer Klasse nach roher 3★-Quote. 2/2 Dreier stehen damit nicht mehr allein wegen 100 % vor einer umfangreichen Datenlage.
- **Wahlfreiheit:** Die reine 3★-Quote (roh), Angriffsanzahl und Name bleiben explizite Sortiermöglichkeiten. Listenpositionen sind keine Spielstärkeränge; Angriffszahlen und Quelle/Zeitraum bleiben sichtbar.
- **Keine neue Leistungsformel:** Kein geheimer Skill-Score, keine Änderung an Angriffsdaten, Formfenstern (30/90/180 Tage), Solver oder Cloud-Speicherung.
- **Regression:** Sortierung bei ungleichen Stichproben, 0 Daten, Zeitfensterwechsel, Rohquote und unveränderter Quellreihenfolge automatisiert geprüft.


## [1.16.11] - 2026-11-06

### Automatische Statistikerfassung verständlich überwachen
- **Statistik:** Der letzte erfolgreiche Server-Abgleich wird nur dann als aktuell beschrieben, wenn er höchstens drei Stunden zurückliegt. Andernfalls steht dezent „möglicherweise verspätet“, statt alte Daten als verlässlich frisch erscheinen zu lassen.
- **Fehler:** Fehlgeschlagener letzter Sammellauf hat Vorrang vor einem früheren Erfolg; interne API-Fehlerklassen und Identitäten werden nicht in der UI offengelegt.
- **Kriegsstatus:** Laufende Runden werden weiterhin ausdrücklich als vorläufig bezeichnet; importierte oder fehlende Angriffe nicht als Nullwerte interpretieren.
- **Unverändert:** Planer/Solver, Rollen, Datenbank, Edge-Collector-Berechtigungen, gespeicherte Statistiken und separate Offline-PWA.


## [1.16.10] - 2026-11-06

### Mobile CWL-Navigation und Kartenhierarchie korrigiert
- **Gold/alle Mobil-Themes:** Die Kriegstage werden nicht mehr per sticky über Spielerkarten gelegt, sondern bleiben als zusammengehörige Tagesnavigation im normalen Seitenfluss. Die frei schwebende mobile Beschriftung entfällt; die semantische ARIA-Beschriftung bleibt.
- **Plan-Spielerkarten:** Aktuelle Form auf eine leichte Nebeninfo wie „3★ 86 % · 7 AG“ verkürzt. Name und Rathaus sind wieder die Hauptinformationen; gespielt/geplant bleibt klein. Vollständige Datenbasis und CWL-Abdeckung sind als Titel/ARIA zugänglich, tiefergehende Analysen im Mitglieder-/Statistikbereich.
- **Mitglieder-Freigabe:** Der vorhandene „Freigabe verwalten“-Button öffnet und schließt die echten Freigabe-/Vize-Vorschlagsaktionen; kein isolierter „Schließen“-Button, kein Scrollsprung, keine zweite Trennlinie oder doppelte Erklärung.
- **Nicht geändert:** Planungsalgorithmus, CWL-Sperr-/Vorschlagsregeln, Live-Angriffe, historische Statistikberechnung, Datenbank oder lokale Offline-PWA. Neue Regressionstests überprüfen mobile Layouts, Kompaktheit und die Schließen-Aktion.


## [1.16.9] - 2026-11-06

### Mobile Übersicht und Freigaben aufgeräumt
- **Gold-Theme:** Kein eigener dunkler Rechteck-/Verlaufshintergrund mehr hinter den sieben Kriegstagen; transparente Tagesnavigation statt weiterer visueller Ebene.
- **Planfreigabe:** Integrierte, unaufdringliche Statuszeile ohne zusätzliche Button-Karte. Auf der Mitgliederseite erscheinen dieselben Aktionen und Vorschläge ohne Kartenstapel und ohne doppelten Freigabetitel; die Tastatur-Fokussierung geht nicht in ein verborgenes Summary.
- **CWL-Leistung:** Zusätzliche 3★-Hitrate der laufenden CWL aus den kompakten Plan-Spielerchips und der Einsatzübersicht entfernt. Die letzten gespeicherten sieben Angriffe inkl. Quellenhinweis sowie die 8★-Information und detaillierte Statistik bleiben unverändert verfügbar.
- **Unverändert:** CWL-Solver, gespielte Aufstellungen, API/Statistik-Daten, Cloud-Freigaben, RLS und Offline-PWA. Collector #104 separat weiterhin ungeklärt.


## [1.16.8] - 2026-11-06

### Transparente CWL-Hitrate und ruhige Oberflächen
- **Plan + Einsätze:** derselbe 3★-Hitrate-Text aus bestätigten abgeschlossenen CWL-Tagen (x Dreisterne / y Angriffe). Auch für einen einzelnen Angriff kein Sonderformat mehr. Keine Angriffsdaten = keine künstliche 0%-Quote.
- **Letzte sieben gespeicherte CW-/CWL-Angriffe:** weiterhin dieselbe berechnete Kurzform; jetzt steht zusätzlich, wie viele Angriffe aus dem aktuellen CWL-Monat enthalten sind. Live-Angriffe und persistierte Historie bleiben sauber getrennt.
- **Mitglieder:** „Freigabe verwalten“ öffnet dieselben bewährten Planfreigabe- und Vorschlagsaktionen auf der Mitgliederseite, kein Tab-Wechsel.
- **Plan-UI:** echter Chevron statt rohem Textzeichen. Freigabe erscheint als kompakter, leicht aufklappbarer Bereich. Gold-Mobil: die sticky Tagesnavigation blendet den Hintergrund sanft aus statt harte Flächen zu erzeugen.
- **Statistik:** doppelte Warnung „wenige Angriffe“ in Spielerform korrigiert. Sternverteilung hat eine lesbare farbcodierte Legende mit der jeweiligen Anzahl. CW-Historie zeigt 15 vs. 15 etc., exakte Zahl dokumentierter Angriffe und markiert importierte Kriege ohne bestätigte Vollständigkeit.
- Keine Änderung am CWL-Solver, an API-Angriffsergebnissen, an den archivierten Kriegen oder an der Offline-PWA.


## [1.16.7] - 2026-11-06

### Freigabe und Vorschläge dezent, verständlich und rollenabhängig
- **Plan:** Statt einer dominanten Freigabe-Karte eine ruhige Statuszeile mit aufklappbaren Freigabe-Aktionen. Nur beim Clanführer werden offene Vize-Vorschläge als deutlich erkennbare Anzahl hervorgehoben; die Liste wird beim periodischen Refresh nicht ohne Änderungen neu aufgebaut.
- **Mitglieder:** Die jeweilige Rolle und Wirkung von Änderungen ist direkt sichtbar. Bei gesperrtem Plan können Vize ihre Bearbeitungen direkt **im Mitglieder-Tab als Vorschlag einreichen** (kein fälschliches „gespeichert“). Clanführer sehen auch hier den Einstieg zu Freigabe und ausstehenden Vorschlägen.
- **Prüfung:** Vorschläge zeigen beim Clanführer den Anzeigenamen des Vize, den Zeitpunkt und die konkreten Änderungen. Auch Änderungen an Notizen und Namen werden im Vergleich berücksichtigt.
- **Beobachter:** Die Mitgliederliste bleibt als **lesbare Kaderinformation** zugänglich; Suche, Sortierung, Teilnahme/Fix-Anzeige, Tagesregeln und Info-Details bleiben sichtbar. Editierfelder und Änderungsaktionen werden ausgeblendet, nicht als gesamte graue Liste dargestellt. Weder Vorschlagseinreichung noch Freigabe wird angezeigt.
- **Sicherheit:** Die vorhandene serverseitige Sperre und Genehmigung bleiben unverändert. Keine Änderung am Solver, Profilformat oder an der lokalen Offline-PWA; keine neue Datenbankmigration.


## [1.16.6] - 2026-11-06

### CWL-Aufstellungswechsel als Overlay, Einsätze vereinfacht
- Die tatsächlichen Clash-Spieler in der bisherigen 15er-Aufstellung nutzen nun denselben vollständigen Spieler-Chip-Renderer wie die geplanten Spieler (RH, FIX, aktuelle CWL-Quote, letzte 7 Angriffe und Einsätze). Auch ein auszuwechselnder Spieler verliert beim roten Hervorheben keine Informationen.
- Tippen auf den rot markierten Spieler öffnet eine **schwebende grüne Einwechselkarte** direkt an dieser Position. Sie ist dieselbe Kartengröße/-struktur, liegt außerhalb des Rasters, verschiebt keine Spieler und kann mit Escape, erneutem Tippen, Schließen oder Außentippen geschlossen werden. Bei Live-Refresh wird der geöffnete Zustand bei gültigem Abgleich wiederhergestellt.
- Die zusätzliche **Form**-Zeile in `Einsätze` war nur eine Dublette der Kurzfrist-Quote aus bis zu 7 Angriffsresultaten. Sie wurde entfernt; bestehende 8★-Bewertung, tatsächlich erspielte CWL-Sterne und CWL-3★-Quote bleiben erhalten.
- Nach Laden der Statistik aktualisiert sich auch die Einsatzübersicht und nicht nur Plan/Mitglieder.
- Erster dezenter Overlay-Übergang unter Beachtung von `prefers-reduced-motion`. Ein appweites Motion-System wird getrennt in Issue #118 geplant.
- Keine Änderung an Planer-Solver, Cloud-Profilformat, bestehenden Einladungen, Kampfstatistik-Berechnung oder Offline-PWA.


## [1.16.5] - 2026-11-06

### Cloud-Einladungen wiederholt kopierbar
- Neu erstellte **Gruppenlinks und Einmal-Einladungen** haben unter „Clan & Konto → Aktive Einladungslinks“ eine direkte Aktion **„Link kopieren“**. Der Link muss nicht neu erstellt werden.
- Berechtigungssicher: Nur der Clanbesitzer oder der erstellende Vize können einen aktiven Link erneut abrufen; die allgemeinen Listen liefern **keine Einladungscodes** aus. Die Codes werden ausschließlich in einer gesperrten privaten Datenbanktabelle abgelegt.
- Bereits vorhandene Einladungen mit ausschließlich gehashtem Code bleiben unverändert gültig, können aber nicht nachträglich aus dem Hash rekonstruiert werden. Die Oberfläche erklärt diesen Sonderfall beim Kopierversuch.
- Keine Änderung an Kader, CWL-Plan, Statistik, bestehenden Einladungen, lokalen Profilen oder Offline-PWA. Migration `20261106134441_cwl_invite_copy_secure.sql` ist in Supabase angewendet.


## [1.16.4] - 2026-11-06

### Plan und Einsätze: sichtbarer Aufstellungswechsel und 8★-Fortschritt
- In der bestehenden aufklappbaren Tagesaufstellung wird bei frisch bestätigter Vorbereitung **die tatsächliche Clash-Aufstellung** gezeigt. Rote Spieler im selben Raster lassen sich antippen und zeigen die vorgesehenen Einwechselkandidaten, ohne unbelegte feste Tauschpaare. Fällt der sichere API-Abgleich weg, wird wieder der unveränderte Plan angezeigt.
- Der frühere Überblick mit **Raus-/Rein-Namen** und die Kopieraktion stehen wieder oberhalb der Spielerkarte.
- iPhone: die sieben Tagesreiter bleiben beim Scrollen unterhalb der tatsächlichen Kopfleistenhöhe sichtbar, statt von der Kopfzeile verdeckt zu werden.
- Fehlerkorrektur: Bereits bereinigte CWL-Snapshots wurden für das Medaillenziel ein zweites Mal wie rohe API-Daten bereinigt; dadurch waren die 8★-Zeilen leer. Jetzt werden vorhandene, belegte Kriegsangriffe wieder ausgewertet, unsichere Daten weiterhin gekennzeichnet.
- Im Plan sind **aktuelle CWL-3★-Quote aus belegten abgeschlossenen Kriegstagen** und die **unverändert berechnete 3★-Quote aus den letzten sieben CW/CWL-Angriffen** getrennt beschriftet. Keine Änderung an Stärke-/Formwerten, Verteilung, Datenbank oder lokaler Offline-PWA.


## [1.16.3] - 2026-11-06

### CWL-Plan: originale Aufstellung und Bedienung wiederhergestellt
- Behebt die Regression aus v1.16.2, die den gewohnten Button „Aufstellung aufklappen“ mitsamt der geplanten Teamliste versteckte, sobald eine vollständige Clash-Vorbereitung geladen war.
- Der ursprüngliche Plan bleibt unabhängig vom API-Status aufklappbar. Direkte und knappe Markierungen in der Planliste: „Bereits in Clash“, „In Clash aufnehmen“ und unter der Aufstellung „Aus Clash nehmen“; Einwechselkandidaten in einer kleinen, gezielt aufklappbaren Gruppeninformation. Ein einzelner auszuwechselnder Spieler wird bei mehreren Kandidaten nicht fälschlich als fixes 1:1-Paar dargestellt.
- Die separate Clash-Teamansicht zeigt wieder nur die Basisdaten, nicht an jedem Kriegstag erneut 8★-Zähler und Spielerform.
- Die 8★-Gesamtbetrachtung und unverbindliche Einwechselreserve stehen bei **Einsätze**; der **Plan** fokussiert auf Kriegsstand, Gegner und den nächsten Aufstellungswechsel.
- Fehlende, unvollständige oder veraltete Clash-Daten dürfen keine aktionsfähigen Wechselhinweise erzeugen. Kein neues Verteilungs-/Bewertungsmodell.
- Tests decken die erhaltene Aufklappfunktion sowie passende, abweichende und veraltete Clash-Aufstellungen ab. Cloud- und Auth-Schema sowie Offline-PWA unverändert.


## [1.16.2] - 2026-11-06

### CWL-Plan ohne doppelte Teamliste
- Der zusätzliche vollständige Clash-Kader aus v1.16.1 wurde entfernt. Die bisherige aufklappbare Ansicht „Unser Team“ zeigt in der Vorbereitung direkt den tatsächlichen Clash-Kader, markiert auszuwechselnde Spieler und bietet beim Antippen die geplanten Einwechselkandidaten samt RH/8★ und aktueller Spielerform.
- Ein eigener kompakter Abgleich bleibt erhalten; eine zweite Namensliste wird nur auf ausdrücklichen Wunsch aufgeklappt. Bei veralteten oder fehlenden API-Daten keine aktionsfähige Wechselmarkierung; die geplante Aufstellung bleibt sichtbar.
- In **Einsätze** stehen bestätigte 0–3★-Ergebnisse (ggf. Zerstörungsgrad) an bereits gespielten Kriegstagen. Bei sicher dokumentiert ausgelassenem Angriff steht „kein Angriff“, bei unbekanntem API-Stand kein erfundenes Ergebnis. Die laufende CWL-3★-Quote zeigt ihre Anzahl an Angriffen.

### Statistiken verständlicher
- **Spielerform:** 3★-Quote standardmäßig absteigend, nummerierte angezeigte Reihenfolge und konkrete Erklärung für „Angriffe gegen gleiches Rathaus“ und geringe Stichproben. Eine Platznummer ist keine absolute Rangliste nach Spielerstärke.
- **Vergleiche:** Drei hochkantige Balken nebeneinander zeigen CW gegen niedrigeres RH, CW gegen gleiches RH und CWL gegen gleiches RH. Unterschiedliche Angriffsanzahlen werden ausgewiesen. Umfangreiche Rathaus-Kombinationen und Sternverteilungen bleiben aufklappbar.
- **Verlauf:** Erklärungen für einzelne Punkte bei Datenlücken und verständliche Angriffsanzahl statt interner Kürzel. Entwicklungsbegriffe wurden aus entsprechenden Nutzerhinweisen entfernt.
- Fortsetzung: Gesamte Text-/UI-Revision und weitergehende Verbesserung des Kriegsverlaufs bleiben getrennte Folgeaufgaben.
- Gespeicherte CWL-Profile, Solver, Datenbank, Supabase-Authentifizierung und lokale Offline-PWA wurden nicht verändert.


## [1.16.1] - 2026-11-06

### CWL-Plan und Einsätze: tatsächliche Aufstellung, Medaillenziel und Reserve
- **Einsätze:** belegter 8★-Fortschritt je Spieler direkt bei der Einsatzverteilung, inklusive gespielter/geplanter Einsätze und davon getrennt die letzte 3★-Form mit Stichprobe. Bei fehlenden oder gespeicherten API-Daten keine vermeintlich frischen Ergebnisse.
- **CWL-Tag:** tatsächlich in Clash erfasste Aufstellung mit klaren Hinweisen „Wechsel: raus“ und „Geplant rein“, dazu RH, aktuelle CWL-Sterne und jüngste Angriffsform. Es gibt keine automatische Änderung in Clash.
- **Tag-7-Reserve:** Wer insgesamt nur drei Einsätze erhält, soll seinen dritten nach Möglichkeit bis Tag 6 abschließen. Der Planer tauscht ausschließlich frei verschiebbare Einsatztage und bevorzugt mindestens viermal eingeplante Spieler für Tag 7. Fix, MUSS, RAUS, exakte Ziele und abgeschlossene/fixierte Kriegstage bleiben verbindlich. Nur ein zukünftiger, expliziter manueller Regelwechsel kann einen vierten Einsatz hinzufügen.
- **API-Robustheit:** Kurzzeitige 429/5xx-Antworten des Clanmitglieder-Proxys werden genau einmal wiederholt; auf Fehler folgen weder Mitgliederverlust noch automatische Übernahme eines unvollständigen Rosters.
- **Technisch:** Kein Datenbankschema-Update, keine Änderung an Cloudprofilen, Statistikmethodik oder Offline-PWA. Browser-Cache-Identität Cloud v1.16.1.


## [1.16.0] - 2026-11-06

### Statistik 3.0: eigenständige Auswertungen statt verschachtelter Zeitfilter
- **Klare Bereiche:** Überblick, Spielerstatistik, Spielerform, Vergleiche und Verlauf & Kriege. Jede Ansicht hat ihre eigene fachlich passende Filterkonfiguration. Die freie Kriegsanzahl wirkt nicht mehr still auf 30/90/180-Tage-Form, Spielervergleiche oder Verlauf.
- **Rohdaten verständlich:** Standard `Alle verfügbaren CWs` statt einer irreführenden 50-CW-Obergrenze, tatsächlicher ausgewerteter/gespeicherter Umfang direkt an der Tabelle sichtbar. Keine Form-Rangfolge oder versteckte „letzte zehn Kriege“ mehr innerhalb der Spielerstatistik.
- **Spielerform:** Separate feste 30-, 90- und 180-Kalendertage-Fenster aus allen verfügbaren Clan-Kriegen; nur Angriffe auf gleiches RH, Stichprobengröße, CW/CWL-Zahlen und ausgeschlossene Angriffe anderer/unbekannter RH-Kategorien separat. Keine Daten ≠ 0 %.
- **Vergleiche:** Eigene Kriegsart-/Datumswahl, Spielerduell und Gegner-RH-Gruppen mit Prozentbalken, 0/1/2/3-Sterne-Verteilung, Anzahl tatsächlicher Angriffe und CW/CWL-Anteilen.
- **Verlauf:** Wochen als Standard, eigene Zeitraumwahl, optionale Tage/Monate, deutlich mehr Punkte und zugängliche Zeitreihentabelle. Keine Verbindungen über lange Datenlücken, CW/CWL durch Kreise/Rauten und Theme-Tokens statt hart codierter Farbnamen unterschieden.
- **Desktop:** Größere Spielerzeilen, lesbare Schrift und breitere Spalten, auf Mobil weiterhin platzsparend. Keine Änderung am Planer, Supabase-Schema, historischen Kriegsdaten, Clanfreigaben oder Offline-PWA.
- **Tests:** Erfassungsfenster, unabhängige Queries, fehlende RH-Daten, kleine Stichproben, WCAG-freundliche Legenden, fünf Bereiche im Browser (320/390/1366 px) und bestehende Planungsregressionen.


## [1.15.9] - 2026-11-06

### Automatische Erfassung abgeschlossener CWs und CWL-Tage
- **Unabhängig vom Browser:** Geschützter Server-Abgleich über GitHub Actions alle zwei Stunden; alle mit der App verknüpften Clash-Clan-Tags werden berücksichtigt, auch getrennt konfigurierte App-Clans mit identischem Clash-Tag.
- **Keine langlebigen GitHub-Zugangsdaten:** Kurzlebiger GitHub-OIDC-JWT mit strikter Signaturprüfung und Bindung an Repo-ID, Hauptbranch, exakten Workflow und Service-Ziel. Clash-API- und Supabase-Service-Rollen-Schlüssel liegen weiterhin nur im Edge-Server.
- **Ausfallsicherer:** Spielende Kriege gehen erst als `finalized=true` in die Statistik ein. Während laufender Kriege bleiben mögliche Angriffe als vorläufige Daten erhalten. Normaler CW und CWL werden voneinander unterschieden, Angriffe über bestehende Primärschlüssel ohne Duplikate übernommen; unvollständige API-Daten lösen keine fiktiven 0-/3-Sterne-Werte aus.
- **Status:** Je Cloud-Clan sind letzter erfolgreicher Server-Abgleich und mögliche Datenabrufprobleme sichtbar. Lesen bleibt durch bestehende private Clanrechte geschützt; der Collector kann keine CWL-Planungen ändern.
- **Grenzen:** Das regelmäßige Abrufintervall ist keine Garantie, wenn Clash eine längst verschwundene Kriegshistorie nicht mehr ausliefert. Für solche Lücken ist ein geprüfter ClashPerk-Nachimport vorgesehen. Clanübergreifende Spieleranalysen erfordern weiterhin explizite, gesonderte Freigaben (#103).


## [1.15.8] - 2026-11-06

### Datengestützte Statistik: echte CWL-Durchgänge, Spielerduelle und Verlauf
- **CWL-Durchgänge:** Bisherige Monatsgruppierung durch Gruppierung abgeschlossener CWL-Kriegstage nach echtem Zeitabstand (maximal 7 Tage / bis 4 Tage Lücke) ersetzt. Damit bleiben die beiden belegten Juni-2026-Ligen getrennt, ebenso können 7 Tage über eine Monatsgrenze reichen. Durchgänge ohne offizielle Gruppenkennung werden ausdrücklich als zeitlich zugeordnet ausgewiesen – Datenlücken sind weiterhin möglich.
- **Direkter Spielervergleich:** Zwei Spieler nebeneinander, mit denselben aktuell gewählten Kriegen, CW/CWL getrennt, Trefferquote, Sterne und Angriffsanzahl; optional nur gleiche Rathausstufe. Keine automatische Spielerbewertung oder Aufstellung.
- **Verlauf:** Echte zeitliche Serien nach Monat oder Woche für 3★-Rate und Ø Sterne je Angriff; normale CWs/CWL getrennt, visuelle Punkte mit Fallzahlen und vollständige barrierearme Tabelle. Fehlende Perioden gelten nicht als 0 %.
- **Keine Datenmigration:** Ältere private ClashPerk-Exporte wurden nicht automatisch importiert. Hintergrundsammlung ohne App-Besuche und freiwillige Mehrclan-Statistikfreigaben sind eigene Sicherheits-/Infrastruktur-Arbeitspakete (#104/#103), keine stillen Freigaben. Alle CWL-Pläne, Cloudprofile/RLS und Offline-PWA unverändert.
- **Regressionen:** Getrennte Juni-Ligen, Cross-Month-CWL, unvollständige Saisons, identisch gefilterte Spielerduelle und Zeitreihen, Browsertests für 320/390/1366px.


## [1.15.7] - 2026-11-05

### Statistikbereich und Klarheit der Einsatzübersicht
- **Vier Statistikbereiche:** Überblick, Spieler, Vergleiche sowie Verlauf & Kriege. Die bestehenden Einzelkriegsdaten bleiben abrufbar; eine erste RH-Differenz-Tabelle zeigt getrennte echte CW-/CWL-Angriffe, Dreierquote, Ø Sterne und die Fallzahlen je gleich/niedriger/höher/unbekanntem Gegner-RH.
- **Datenumfang statt kryptischer Filter:** Standardmäßig alle erfassten CWL-Monate statt nur der letzten drei. Auswahl zeigt vorhandene/ausgewertete CWs und CWL-Monate; Spieler- und 90-Tage-Formkennzahlen erklären ihren Bezug zum gewählten Umfang.
- **Spielerliste nummeriert:** Positionen sind lediglich die aktuell gewählte Tabellenreihenfolge, keine allgemeingültigen Stärkeränge. Details verdeutlichen, dass die letzten zehn Kriege aus der vorausgewählten gemischten Kriegsliste stammen.
- **Einsätze:** Die Verfügbarkeit wird als Anzahl Tage ohne RAUS-Regel ausgedrückt. Das unklare alte Feld „3★ ?“ entfällt ausschließlich aus der Einsatzübersicht; gespielt, geplant und gesamt sind ausgeschrieben.
- **Keine Datenmigration:** Cloud-Profile und aktuelle CWL-Aufstellungen, Supabase, Planungskern und Offline-PWA unverändert. Die zwei Juni-CWL-Durchgänge in privaten ClashPerk-Forschungsdaten sind noch nicht produktiv importiert; eigene Identität der Bonusliga wird vor dem Import gesondert geprüft.


## [1.15.6] - 2026-11-05

### Fairer Tageswechsel ohne Bedienverlust
- **Gezieltes RAUS ausgleichen:** Wer bei `Automatisch` bewusst an einem offenen Kriegstag ausgeschlossen wird, bekommt beim Verteilen der übrigen Tagesplätze eine kleine weiche Ausgleichspriorität. Dadurch kann ein bisher vorgesehener vierter Einsatz auf einen anderen Tag rücken (Praxisfall Jamie). Keine Garantie bei knappen Plätzen und kein neues hartes Einsatzziel.
- **Grenzen bleiben verbindlich:** Kein Ausgleich über gesperrte/gestartete Tage oder `RAUS` hinweg. `MUSS`, `Fix`, explizite Einsatzziele, Rollen und Profil-Datenformat v9 bleiben unberührt.
- **Mitgliederkarten stabil:** AUTO/MUSS/RAUS aktualisiert sofort den einzelnen Button und berechnet den Plan neu, ohne die gesamte Mitgliedertabelle aufzubauen; offene Karte, Tagesregeln, Fokus und Scrollposition bleiben erhalten.
- **Regressionen:** Read-only Vergleich des realen Jamie-Falls, synthetische 19er-/15-Plätze-Tests, exakte Einsatzziele, Sperren, keine verfügbaren Ausweichtage, Mobil- und Desktop-Browserprüfung. Keine neue Supabase-Migration; Offline-PWA bleibt v1.0.2.


Weitere Unterseiten unter „Mehr“, die experimentelle statistikgestützte Einteilung und praktische iPhone-Abnahmen folgen separat (#46, #44).

## [1.15.5] - 2026-11-05

### Statistik & Datentransparenz
- **Einfache Erklärung statt irreführender Rangliste:** 2/2-Angriffe mit 100 % sind nicht dasselbe wie 40/60; 0–100-Formpunktzahl, technische n_eff-Hinweise und die vorläufige „Beste Form“-Auszeichnung aus der Hauptansicht entfernt.
- **Angriffe gegen gleiches RH:** 30-Tage-Dreierquote, 90-Tage-Trend, Anzahl der Vergleichsangriffe, CW-/CWL-Quellanteile und Datenqualität als übersichtliche Listenzeilen. Methodik (Wilson und zeitgewichtete Stichprobe) nur auf Wunsch.
- **Mobil besser:** Statt gequetschter Vier-Spalten-Tabelle Spielername und verständlich beschriftete Kennzahlen mit eigener Vergleichszeile; Desktop-Tabelle bleibt kompakt.
- **Keine Leistungsabwertung nach Rohquote:** keine Rot-/Grün-Einfärbung als scheinbare Stärkeaussage. Vorläufiger Vergleich dient ausschließlich der Anzeige/Sortierung und verändert den CWL-Solver nicht.
- **CWL-Historie:** Sichtbarer, aber optionaler ClashPerk-Hinweis nur bei unvollständiger CWL-Abdeckung; gesonderter Anfrageplan für 21 historische Kriegstage aus August–Oktober 2026.
- **Sicher:** Datenformat 9, Cloud-Profile, Supabase, Rollen, gespielte Kriege, CWL-Aufstellungen, Archiv und Offline-PWA unverändert.

## [1.15.4] - 2026-11-05

### Mobile Einsatzverteilung
- **Besser bedienbar:** Suche und Filter auf Smartphones bis 470 px einzeln und in voller Breite; ausreichend große Touch-Flächen, lesbare Schaltflächen.
- **Weniger Kastenoptik:** Einsatzzeilen mobil als klare Liste mit feinen Trennlinien statt einzelner gerahmter Karten; Spielername und Meta besser lesbar.
- **Regressionen:** 320/390/430 px, alle fünf Themes sowie Tablet-/Desktop-Kontrolle automatisiert geprüft.
- **Keine Datenänderung:** CWL-Planer, Cloud-Konten, Profile, Rollen, Historie, API, Supabase und Offline-PWA bleiben unverändert.

## [1.15.3] - 2026-11-05

### Spielerstatistik: vergleichbare aktuelle Form ohne falsche Genauigkeit
- **30 Tage:** Im Statistik-Tab eine ausklappbare Vergleichsansicht mit beobachteter 3★-Quote, Ø Sternen und **Anzahl der Angriffe auf dasselbe Rathauslevel**. Erst 2–3 Messpunkte ergeben noch keine belastbare Stärke.
- **90 Tage:** Ältere gleich-RH-Angriffe bleiben mit einer ausgewiesenen **Zeitgewichtung (30-Tage-Halbwertszeit)** sichtbar. Effektive Stichprobe und Datenqualität werden angezeigt; das ist ein beschreibender Wert, keine Erfolgsprognose.
- **CWL gegen normale CWs:** Ausgewählte gleichwertige Angriffe werden nach Kriegsart und Quellherkunft getrennt. Niedrigere/höhere/fehlende Rathausstufen zählen **nicht** in die Vergleichsquote; deren Anzahl wird erklärt.
- **Ehrliche Lücken:** Ob ein Angriff auf sein Gegenüber, gegen eine gerushte Basis oder als Cleanup erfolgte, ist für ältere Daten **nicht zuverlässig belegt** und wird nicht behauptet.
- **Mitglieder:** Der Hilfetext erläutert zusätzlich die neue Form. Die bisherigen sieben letzten Angriffe und deren Sortierung bleiben solange unverändert, bis die Alternative chronologisch nachweislich besser ist.
- **Importdialog:** Ein Import mit 44 Missed-Datensätzen und 59 verpassten Angriffen zeigt jetzt korrekt **59 tatsächliche versäumte Angriffe (44 Einträge)**.
- **CWL-Angriffsprüfung:** In der letzten Stunde vor einem aktiven CWL-Kriegsende zeigt die App **noch offene Angriffe** als Hinweis. Erst nach vollständig bestätigtem Kriegsende nennt sie **tatsächlich verpasste** Angriffe und erinnert daran, die nächste Aufstellung bewusst in Clash zu prüfen. Wer kurz vor Ende angreift, verschwindet nach dem nächsten erfolgreichen API-Abgleich aus dem Hinweis. **Keine automatische Pause, kein Raus aus der Aufstellung, keine Änderung der Tagesregeln.**
- **Grenze:** Hinweise nur bei frischen Clash-Daten, während die Web-App aktiv genutzt wird; 5-Minuten-Aktualisierung ist keine garantierte Sofort- oder Hintergrundbenachrichtigung.
- **Datenschutz:** Nur lesende Analyse, keine Supabase-Migration, keine Änderung an Clanprofilen, CWL-Solver, Aufstellungen oder Offline-PWA.

## [1.15.2] - 2026-11-05

### Vergessene Angriffe eindeutig erklären
- **Kriegsarten separat:** Statistik zeigt belegte CW- und CWL-Misses einschließlich der Zahl vollständig erfasster Kriege. Beispiel United Fighters: 30/30 normale CWs vollständig, 1/22 CWL-Kriegstage vollständig, zwei weitere explizit bekannte historische CWL-Misses.
- **Spielerzeilen:** Sichtbare CW-/CWL-Unterwerte im kombinierten Modus. Wenn ältere CWL-Aufstellungen unvollständig sind, wird nicht fälschlich „0 verpasst“ angezeigt. „mind.“ bleibt die nachgewiesene Mindestzahl, „k. A.“ steht für fehlende Vollständigkeit.
- **Sortierung:** „Verpasst“ berücksichtigt bei lückenhafter Datenabdeckung nachgewiesene Missed-Angriffe statt lauter `null`-Werte.
- **Quellenkontrolle:** ClashPerk-Exportguide erläutert relevante Original-Kriegsdaten, CWL-Missed-Logs, tatsächliche Lineups, neue Spieler, Mirror/Map-Positionen und wie Datenlücken geschlossen werden könnten.
- **Sicher:** Keine Änderungen an bestehenden Supabase-Tabellen/Daten, Clanprofilen, CWL-Solver, Sterne-/HitRate-Kennzahlen, Offline-PWA oder Archiv.

## [1.15.1] - 2026-11-05

### Mobiler Zurück-Button und Forschungsgrundlage für bessere Leistungsstatistik
- **Mehr → Clan & Konto:** Der Zurück-Button liegt auf kleinen Displays wieder rechts oben, wie vom Clan-Owner bevorzugt. Mindesthöhe 44 px; Titel und Rückweg bleiben getrennt.
- **Recherche:** Bisherige CW-/CWL-Historie, Datenqualität, 7-Angriff-Grenze, gleiche Rathausstufe, echte Mirror-Angriffe, CWL-Gewichtung, Zeitfenster, ClashPerk-Kriegshistorie, verpasste Angriffe und zuverlässige Stärke-/Fairness-Prognosen systematisch analysiert.
- **Sicher:** Keine Änderung an angezeigten Spielerquoten, laufenden CWL-Plänen, Medailenhinweisen, Datenbank, Rollen, Cloud-/Offline-PWA-IDs oder API-Zugriffen. Erst nach Backtests schrittweise neue Kennzahlen.

## [1.15.0] - 2026-11-05

### 8-Sterne-Ziel für reguläre CWL-Ligamedaillen und mobiles Zurück
- **Regel:** 8 eigene Kriegssterne in einer CWL-Saison schalten 100 % des regulären, platzierungsabhängigen Ligamedaillenanteils frei. Das ist **nicht** der freiwillige Anführerbonus.
- **Plan:** Bei laufenden CWL-Kriegen zeigt eine aufklappbare, reine Lese-Übersicht die nachgewiesenen Einzelangriffssterne, die verbliebenen geplanten Angriffe und eine vorsichtige Erreichbarkeit.
- **Datenqualität:** Mehrfach angegriffene Ziele ohne eindeutig bekannte Angriffsreihenfolge werden nicht fälschlich als sichere Sterne gezählt. Fehlende Kriegstage/Manuell-Locks werden kenntlich gemacht; keine erfundenen Erfolgschancen oder automatischen Umbuchungen.
- **Prüfidee:** Wenn ein flexibler Rotationsspieler 8★ bereits sicher hat und ein anderer mit seinem aktuellen Plan selbst im Idealfall nicht mehr an 8★ kommt, kann ein Austausch für einen von Clash bestätigten Vorbereitungstag vorgeschlagen werden – strikt lesend und ohne Fix-/MUSS-/RAUS-/Einsatzziel-Verletzung.
- **Mehr → Clan & Konto:** Der Zurück-Button steht auf Handys wie in anderen Unterseiten unter der Überschrift links.
- Standardplaner, CWL-Datenformat v9, Cloudrechte, Supabase, Offline-PWA und bestehende Aufstellungen unverändert. Weitergehende Statistik-/Leistungsoptimierung ist ein separat geprüftes Experiment (#44).

## [1.14.8] - 2026-11-05

### Button-Typografie und mobile Bedienflächen
- Auf kleinen Smartphones nutzt die Hauptnavigation jetzt mindestens 11 statt teils 9 px; ab 376 px 12 px und mindestens 46 px Höhe.
- Text-Aktionen in CWL-Plan, Tagesaktionen, Mitgliederverwaltung, Saison und Hauptdialogen: 13 px mit lesbarer Zeilenhöhe und Umbruch bei langen Bezeichnungen; wichtige Touch-Ziele mindestens 44 px.
- Auf Desktop erhält die sekundäre Aktionsschrift eine konsistente Mindestgröße von 13 px. Kleine Status-Badges, reine Icon-Tasten und der bewusst kompakte Handy-Querformat-Modus werden nicht pauschal vergrößert.
- Browser-Regressionen auf 320/390/430/1366 px, Gold/Cyberpunk/Hell/Dunkel; keine Änderungen an Cloud-Daten, Offline-PWA, Supabase, CWL-Solver oder Rollen.

## [1.14.7] - 2026-11-05

### Einstellungen und Installationsanleitungen
- **Desktop:** Ein einzelner dezenter Inhaltsrahmen statt mehrfach verschachtelter Karten für CWL-Grunddaten, Design, Backups und lokale Profile.
- **Smartphone:** Rahmenlose, mit Abstand und Trennlinien gegliederte Abschnitte; Gold, Cyberpunk und die übrigen Themes konsistent.
- **Versionshinweise:** Keine zusätzliche umrandete Box innerhalb der Einstellungen.
- **App installieren:** iPhone/iPad, Android und Desktop sind als Hilfe direkt auswählbar, unabhängig vom aktuellen Endgerät. Native Android-Installationsangebote bleiben unverändert.
- Unveränderte CWL-Berechnung, Cloud-Start-URL, Supabase, Spielerprofile und Offline-PWA.

## [1.14.6] - 2026-11-04

### Einheitliches Logo für PWA und geteilte Links

- Goldene Schild-/Haken-Marke aus brand-mark.svg als gemeinsame Quelle für Cloud und separate Offline-PWA.
- Neue PNG-App-Icons (192/512), Safari-Home-Screen, Favicon und große 1200×630-Linkvorschau; Open Graph/Twitter Meta-Tags.
- Versionierte neue Bilddateinamen und aktualisierte Offline-Icon-Dateien bei unverändertem Cache-Namespace; kein Eingriff in Profildaten, Cloud-Login, Solver, Supabase oder die Cloud-Installations-ID.
- Dialog-Backdrop schützt Textauswahl: Loslassen außerhalb nach Beginn innerhalb schließt modale Fenster nicht mehr; absichtliche Taps auf den Außenbereich bleiben möglich.
- Bestehende Home-Screen-Symbole können wegen iOS-/Android-Caches ein erneutes Hinzufügen benötigen; native Link-Previews können serverseitig zwischengespeichert sein.


## [1.14.5] - 2026-11-04

### Mobile App-Installation auffindbar, CWL-Wechsel klar bezeichnet
- **Cloud-App installieren:** Eine eigenständige Seite unter „Mehr“ erklärt iPhone/iPad (Safari → Teilen → Zum Home-Bildschirm hinzufügen → Als Web-App öffnen), Android-Browser und Desktop. Browser-eigene Android-Installationsaufforderungen werden nicht abgefangen.
- **Kein Installations-Popup:** Für iOS erscheint höchstens innerhalb von „Mehr“ ein kleiner Hinweis, der dauerhaft lokal ausblendbar ist. Im bereits installierten Stand wird er nicht angezeigt; die Anleitung bleibt bei Bedarf zugänglich.
- **Wortlaut CWL:** Statt „Aus Clash raus“ / „In Clash rein“ heißen die Gruppen jetzt „Aus der Kriegsaufstellung nehmen“ / „In die Kriegsaufstellung aufnehmen“. Die Kopieraktion heißt „Aufstellungswechsel kopieren“; der kompakte einzeilige Chat-Text `Raus: ... - Rein: ...` bleibt unverändert.
- Regressionen für iOS-/Android-Browser, installierte Ansicht, Hinweisunterdrückung und die CWL-Gruppenbeschriftung. Reale Safari-/Firefox-Geräteabnahme bleibt separat.
- Keine Cloud-API-, Datenformat-/Rollen-, Supabase- oder Solver-Änderung; separate Offline-PWA bleibt v1.0.2.

## [1.14.4] - 2026-11-04

### Android-PWA-Installation startet wieder die Cloud-App
- **Ursache behoben:** Die Cloud-Seite verwendete irrtümlich das Offline-PWA-Manifest mit `start_url: "./"`. Die Installation von `cloud-app.html` führte so zur lokalen Startseite `index.html` ohne Konto-Anmeldung und Cloud-Tabs.
- **Getrennte Apps:** `cloud-app.html` verweist auf das neue `cloud-manifest.webmanifest` mit eindeutiger `id` und `start_url` `./cloud-app.html`; kurzer Android-Name „CWL Cloud“. Der Offline-Planer behält sein bisheriges Manifest und seinen Service-Worker-Cache.
- **Bestehende falsche Verknüpfung:** Sie bleibt lokal, bis sie manuell vom Startbildschirm entfernt und die Cloud-App erneut installiert wird. Vor dem Löschen einer möglicherweise genutzten Offline-App bei Bedarf deren JSON-Backup exportieren.
- Automatisierter Android-Chromium-Test prüft getrennte Manifest-IDs, korrekten Start, Cloud-Konto-Einstieg und Unversehrtheit der Offline-PWA.
- Keine Supabase-Migration, keine Änderung der Clanprofile, Cloud-API, Rollen, CWL-Planung oder Offline-PWA v1.0.2.

## [1.14.3] - 2026-11-04

### Scrollposition und UI-Kontext beim Cloud-Abgleich
- **Mitglieder:** Während eines automatischen Abgleichs desselben Clans bleibt der zuvor sichtbare Spieler über seine stabile ID am selben Punkt im Viewport. Eine davor eingefügte Karte oder ein neu sortiertes DOM zieht den Bildschirm nicht mehr ungefragt mit.
- **Einstellungen:** Öffnen und Schließen des Einstellungen-Overlays bewahrt die Scrollposition der zugrunde liegenden Seite. Ein bewusster Tabwechsel navigiert weiterhin wie bisher.
- **Kontexttrennung:** Beim Clanwechsel und bei ausdrücklich gewählter Filterung/Sortierung wird kein alter Scroll-Anker übernommen.
- Automatisierter Browser-Test mit 76/77 Spielern bei 320, 390, 430 und 1366 px, der Desktop-Sidebar und der mobilen Bottom-Navigation. Echte iPhone-Safari- und schwache-PC-Abnahme stehen weiterhin aus.
- Keine Datenmigration, keine Änderung an Supabase, Planeralgorithmus, Account-/Clanrechten oder Offline-PWA.

## [1.14.2] - 2026-11-04

### Flüssigeres Scrollen in langen Listen (UI-Performance)
- **Mitglieder und Statistik:** Browser überspringt das Zeichnen von Listenzeilen außerhalb des sichtbaren Bereichs, unterstützt durch intrinsische Platzhalterhöhen. Im Gold-Theme werden aufwendige Einzelkartenschatten und der fixierte Verlaufshintergrund vermieden.
- **Statistik-Historie:** Zunächst nur Kriegskopfzeilen samt tatsächlich bekannten Sternen/Angriffszahlen. Einzelangriffe werden erst beim Öffnen eines Kriegs erzeugt; geöffnete Kriege bleiben nach erneutem Laden desselben Clans geöffnet.
- **Berechnungen:** Statistik-Suche und Sortierung verwenden identische bereits berechnete Werte erneut; unveränderte Spielerzeilen werden nicht erneut aufgebaut. Mitgliederkarten werden nicht bei jeder Statistikfilter-Interaktion neu gezeichnet.
- **Smartphone:** Größere Berührungsflächen für Spieleraktionen und Umbruch auf schmalen Displays.
- Automatisierte Playwright-Regression: 40 Kriege, 1.000 Angriffe, UI-Kontext und 320/390/1366px; echte Hardware-Abnahme am Arbeits-PC weiterhin empfohlen.
- Keine Veränderung an statistischen Formeln, CWL-Solver, Backend-/Cloud-Datenformat, Supabase oder separater Offline-PWA.

## [1.14.1] - 2026-11-04

### Cloud-Realtime ohne Verlust des Bedienzustands
- Der automatische Cloud-Profilabgleich unterscheidet Aktualisierungen **im selben Clan** von einem bewussten Clanwechsel. Dabei bleiben Suchtexte, Mitgliederfilter, geöffnete Spieler, Tagesregeln und der ausgewählte Kriegstag bestehen. Bei einem anderen Clan werden diese Zustände bewusst zurückgesetzt.
- Im Plan bleiben „Geplante Rotation (ohne Clash)“ und zusätzlich aufgeklappte Tageswarnungen auch nach einem Neuzeichnen geöffnet. Die geöffneten Details sind an Clan, Profil und Spieltag gebunden.
- Die Einsatzübersicht behält geöffnete Spieler-Einsatztage; relevante Buttons bekommen nach einem Hintergrund-Refresh ihren Tastaturfokus ohne Scrollsprung zurück. Gleiches gilt für die Mitgliederaktionen.
- Browser-Regressionen prüfen Smartphone-/Desktop-Breiten, gleichen versus anderen Clan, Filter, Offen-Zustände und Tastaturfokus.
- Keine Änderung an CWL-Solver, Clanrechten, Supabase-Tabellen, Cloud-Profilformat v9, historischen Aufstellungen und separater Offline-PWA v1.0.2.

## [1.14.0] - 2026-11-04

### „Mehr“ mit echten Unterseiten und besseren mobilen Aktionen
- **CWL-Regeln & Grunddaten**, **Design & Aktualisierung**, **Backup & Import** und **lokale Clanprofile** öffnen jetzt eigenständige Unterseiten mit Zurück zu „Mehr“, statt nur zum passenden Bereich des großen Einstellungsmodals zu scrollen.
- Alle bisherigen Formulare werden innerhalb der Unterseiten mit ihren bestehenden DOM-Knoten (nicht mit Kopien) wiederverwendet; beim Zurücknavigieren kommen sie an den ursprünglichen Platz. Bestehende Werte, Datei-Import-Handler, Einstellungen, Rollen und Plan-Sperren bleiben erhalten.
- Im Cloud-Modus führen die Clan-/Profilaktionen zur vorhandenen Seite „Clan & Konto“, und im Backup-Bereich gibt es einen Hinweis und direkten Zugang zu gemeinsamen Cloud-Sicherungen.
- Die Beobachter-Sperren gelten auch für die neuen Unterseiten. Navigation, Farbschema und erlaubte Exporte bleiben für Beobachter zugänglich.
- Unterseiten nutzen die UX-Leitlinie: ruhige Abschnitte mit Trennlinien, keine mehrfach geschachtelten Karten; responsive Button-Gruppen und große Touch-Flächen auf iPhones.
- Die separate Offline-PWA, der CWL-Planungsalgorithmus, Supabase, RLS, Cloud-Speicherformat und historische Archive bleiben unverändert.

### Als Nächstes
- App-weites Mobile-/Desktop-UX-Audit mit gezielten Button- und Kartenkorrekturen in allen Haupttabs/Unterseiten (Issue #46).
- Experimentelle leistungsbezogene CWL-Vorschau separat, nach Datengüte- und Solver-Regelprüfung (Issue #44).

## [1.13.0] - 2026-11-04

### Archiv bleibt beim Auto-Abgleich offen
- **CWL-Saison ausschließlich im Plan:** Der doppelte Eintrag unter „Mehr“ wurde entfernt; der Rückweg führt wieder zum Plan.
- **Mehr → CWL-Archiv:** Saison-, Runden- und Teamlisten behalten ihre geöffneten Zustände über automatische Clash-Aktualisierungen hinweg. Ein fachlicher Schlüssel (Saison/Tag/Team) statt DOM-Position verhindert unbeabsichtigtes Zuklappen.
- Ein bereits geladenes Archiv wird beim Hintergrundabruf nicht erst durch einen Ladebildschirm ersetzt. Bei einem kurzen Netzwerkfehler bleiben die angezeigten Daten und offenen Runden erhalten.
- Fokus auf einer aufgeklappten Überschrift wird nach dem Aktualisieren wiederhergestellt; Clanwechsel bleibt ein bewusster Kontextwechsel.
- **Weniger „Karten in Karten“:** Ruhigere visuelle Hierarchie durch Abschnittstitel, Abstände, Listenzeilen und Trennlinien. Nur echte selbstständige Bereiche bleiben als Karte abgesetzt.
- **Langfristige Design-Leitlinie:** `docs/UX_DESIGN_PRINCIPLES.md` sowie `AGENTS.md` dokumentieren verbindliche UI/UX-Grundsätze für die gesamte App und künftige Entwicklungsrunden.
- Keine Änderung an Supabase, RLS, CWL-Planung, Clan-Daten oder den gespeicherten Archiven.

## [1.12.0] - 2026-11-04

### Live-CWL im Plan und eigene Aufstellungen im Archiv
- **Plan → CWL-Saison ansehen:** Ein schlanker Einstieg in der Planung führt direkt zu Gruppe, Runden und Clan. Auf dem Rückweg geht es wieder zum Plan; aus „Mehr“ weiterhin zu „Mehr“. Beobachter können die Saison genauso öffnen.
- **Sternanzeige korrigiert:** In der vollständigen Gruppen-Rundenansicht wird die linke Punktzahl nun korrekt aus `clan.stars` gelesen. Ein tatsächlicher Zwischenstand 10 : 36 wird nicht mehr als „– : 36“ ausgegeben. Vorbereitung bleibt „– : –“.
- **CWL-Archiv im Detail:** Unter den Gruppenrunden können die tatsächlich eingesetzten eigenen Spieler einschließlich RH, Angriffen und Sternen ausgeklappt werden. Der zusätzliche, geschützte Server-Speicher `cwl_own_lineup_archives` archiviert vollständige Aufstellungen **ab Kriegsbeginn** und behält sie nach dem Saisonende.
- Nur der authentifizierte Clan-API-Proxy schreibt die Roster-Snapshots. Per RLS dürfen alle Clanmitglieder, auch Beobachter, ausschließlich lesen; kein Client kann Archiv-Ergebnisse verändern.
- Archiv-Trigger verhindert Austausch der Teilnehmerliste und Rückschritt von `warEnded` zu einem älteren Zwischenstand; nachträgliche weitere Angriffe und Sterne dürfen ergänzt, aber nicht reduziert werden.
- Bereits vorhandene manuelle Planarchive bleiben unverändert; wo ein altes Clash-Roster fehlt, wird eine archivierte Plan-Aufstellung **ausdrücklich unbestätigt** gekennzeichnet. Keine Datenmigration für Cloudprofile v9, keine Solver-/Tagesrotation- oder Offline-PWA-Änderung.

### Hinweis
- Nur Kriege mit einer vollständigen und von Clash bereits fixierten Mannschaft werden automatisch archiviert. Fehlende vergangene API-Saisons können nicht rückwirkend rekonstruiert werden.
- Die praktische iPhone-Prüfung der neuen Archivansicht und der Beobachterrolle bleibt nach dem Release offen.

## [1.11.0] - 2026-11-04

### Dauerhaftes CWL-Gruppenarchiv
- **Mehr → CWL-Archiv** enthält jetzt zwei getrennte Bereiche: die schon vorhandenen Aufstellungsarchive sowie die neu gespeicherten Gruppensaisons mit Tabellen und Runden.
- Beim vorhandenen geschützten Clash-Abruf wird das bereits sanitierte Gruppenobjekt serverseitig in einer eigenen `cwl_group_archives`-Tabelle pro Clan und Saison gesichert. Keine zusätzlichen Supercell-API-Aufrufe, keine fremden Spielerlisten und keine Änderungen am Planungsalgorithmus.
- Alle aktiven Clanmitglieder – einschließlich Beobachtern – können über Supabase-RLS lesen; Schreiben/Ändern/Löschen ist über den Browser nicht möglich. Die Serveranmeldung und die bisherige Clanmitgliedschaftsprüfung gelten weiterhin.
- Eine Datenbank-Triggerprüfung erhält bestätigte Kriege bei später eintreffenden alten Zwischenständen. Ebenso werden veraltete Angriffs-/Sternwerte eines laufenden Krieges nicht zurückgeschrieben.
- Ein Speicherfehler darf den Live-CWL-Abgleich nicht blockieren. Beim Clanwechsel werden verspätete Archivabfragen verworfen.
- Geteilte Gruppensaisons werden auch nach dem Ende der offiziellen API-Saison angezeigt. Vorhandene Planarchive und v9-Profile werden nicht migriert oder zurückgesetzt.

### Grenzen
- Ohne früheren erfolgreichen Gruppenabruf kann eine alte Saison nicht nachträglich als vollständig rekonstruiert werden. Fehlende Kriege bleiben gekennzeichnet.
- Der praktische Vergleich der Archivstände und der RLS-Ansicht auf einem realen iPhone steht nach der Veröffentlichung noch aus.

## [1.10.0] - 2026-11-04

### Vollständige CWL-Gruppe und Runden
- Der bestehende geschützte Supabase-Abruf lädt schon alle War-Tags der Gruppe. Dessen Antwort wird jetzt rein lesend um **kompakte Gruppenergebnisse** ergänzt, ohne zusätzliche Supercell-Anfragen oder fremde Spielerlisten im Browser.
- Unter „Mehr → CWL-Saison → Gruppe“ erscheinen alle verfügbaren Clans mit vorläufiger Rangfolge: bestätigte Kriegssterne, +10 Siege-Bonus **ausschließlich nach Kriegsende**, Siege sowie die aus den Kriegswerten berechnete Zerstörungssumme. Unbekannte Runden und Gleichstände werden sichtbar gekennzeichnet.
- „Runden“ zeigt pro Spieltag bis zu vier Paarungen samt Zuständen; eigene Begegnungen werden hervorgehoben. In der Vorbereitung keine vorgetäuschten 0:0-Endstände.
- Die bereits vorhandene Saison-/Clanansicht und das separate Archiv bleiben erhalten; bei alter Backend-Version zeigt die App weiter nur die bekannte reduzierte Ansicht.
- Der API-Proxy bleibt mit echtem Supabase-Nutzer und Clan-Mitgliedschaft autorisiert; Clash-Schlüssel bleiben serverseitig. Kein zusätzliches Datenbankschema, keine Änderungen am Solver, keine Profilmigration.

### Noch offen
- Die offizielle Platzierung kann bei fehlenden Spielpaarungen oder laufenden Kriegen abweichen. Sie wird deswegen als vorläufig bezeichnet.
- Vollständige historische Gruppentabellen nach Saisonende benötigen dauerhafte, autorisierte Snapshots und eine eigene Archiv-Phase.

## [1.9.0] - 2026-11-04

### CWL-Saison und Archiv – eigene Unterseiten unter Mehr
- Die vorhandenen Profile behalten ihre gespeicherten CWL-Archive; die Archivübersicht ist aus „Einsätze“ nach „Mehr → CWL-Archiv“ umgezogen. Kein Schema- oder Datenformatwechsel.
- „Mehr → CWL-Saison“ zeigt drei lesende Ansichten: Gruppe mit bisher bekannten gegnerischen Clans, Runden mit den eigenen maximal sieben Kriegen sowie Clan mit bekannten Spieler-Angriffsstatistiken aus gestarteten/beendeten CWL-Kriegen. Ohne ausreichende API-Daten werden Ergebnisse als unbekannt gekennzeichnet.
- Eine Rangliste für **alle acht Clans** ist derzeit bewusst **nicht** verfügbar: Dafür fehlen im bisher gespeicherten Cloud-Profil die übrigen Gruppenpaarungen. Der gesonderte, geschützte Serverabruf und saisonale Gruppensnapshots sind Phase 2 (#71).
- Team-/Spielernamen werden HTML-sicher ausgegeben, Wappen-URLs validiert. Beobachter dürfen vorhandene Archivdaten nur ansehen, nicht löschen. Mobile/desktop responsive, separate Zurück-Navigation und aktive „Mehr“-Navigation.
- Der bisherige `coc-cwl-status`-Abruf wird wiederverwendet, ohne einen neuen API-Request oder Hintergrundspeicherzugriff einzuführen. Nur bereits sichere, aktuelle Runden werden aus der frischen Sitzung angezeigt.

### Kompatibilität
- Cloud-Datenformat weiterhin v9. Keine Supabase-/RLS-/Edge-Function-Migration, keine Änderung am globalen CWL-Planungssolver, keine produktiven Profil-/Kriegswrites und kein Löschen alter Archive.
- Separate lokale Offline-PWA weiterhin v1.0.2.

## [1.8.2] - 2026-11-04

### CWL-Abgleich & mobile Bedienung
- Copy für Clash-Chat: eindeutigerer Button, einzeiliger Text mit einfachen Trennzeichen statt dekorativer Emojis/Mehrzeilenformatierung. Den Paste-Vorgang im Spiel bitte zusätzlich manuell prüfen; Clash-interne Einfügebeschränkungen sind nicht kontrollierbar.
- Teamkarten in der Vorbereitung: beide Statusangaben rechts gleich ausgerichtet; Button hat konsistenten Abstand zur Bewertung.
- Gold-/Arena-Theme: hinterlegte Fläche um die mobilen Kriegstage neutralisiert.
- Mobile Planübersicht: „Teilnehmer“ und „Fixspieler“ dauerhaft sichtbar; der übrige Bereich als „Übersicht & Aktionen“ benannt; Status laufender Kriege und theoretische Rotation verständlicher formuliert.

### Mitglieder & Statistik
- Notiz-Symbol bei Spielern mit kurzer Beschriftung.
- Ausgetretene Spieler in der Cloud erscheinen nicht mehr wie bearbeitbare aktive Kader-Mitglieder, sondern als schreibgeschützte Einträge mit sichtbarer Löschoption. Der gespeicherte Zustand bleibt bis zu einem expliziten Löschen erhalten und wird bei erneutem Clanbeitritt restauriert.
- Beobachter sehen die Mitgliederübersicht ohne Bearbeitungsaktionen und mit gedämpften Mitgliedskarten. Berechtigungen bleiben zusätzlich über die bestehenden Cloud-Rollen geschützt.
- Individuelle Durchschnittssterne erscheinen wieder unter der 3★-Hit-Rate in der Statistiktabelle; die Kennzahl wird aus bereits gespeicherten Angriffen berechnet.

### Kompatibilität
- Keine Datenbankmigration, keine produktiven Profil- oder CWL-Aufstellungsänderungen, keine Änderung am CWL-Algorithmus oder Clash-Backend. Cloud-Datenformat v9 und separate Offline-PWA v1.0.2 unverändert.

## [1.8.1] - 2026-11-03

### CWL-Aufstellungen und Wechsel
- Sobald Clash einen Krieg mit vollständiger, eindeutig zuordenbarer Mannschaft als laufend meldet, dient diese unveränderliche Aufstellung als feste Basis für die verbleibende CWL-Rotation. Geplante und tatsächlich eingesetzte Mitglieder werden nicht mehr verwechselt.
- „Aufstellung in Clash fix“ ist von „Krieg abgeschlossen/gespielt“ getrennt: laufende Kriege werden erst nach Kriegsende historisch bestätigt und in den gespielten Statistiken gezählt.
- Bei API-verknüpften Clans kommt die maßgebliche Rein-/Raus-Anweisung aus dem aktuellen Clash-Vorbereitungsabgleich. Ein neuer Kopierbutton übernimmt ausschließlich diese Wechsel beziehungsweise die Bestätigung, dass keine Wechsel nötig sind; gespeicherte oder unvollständige Daten dürfen keine aktuelle Anweisung vortäuschen.
- Die theoretische Plan-Rotation bleibt nur als eingeklappter, klar gekennzeichneter Zusatzvergleich zugänglich; der vollständige Plantext aus dem API-Modus enthält keine zweite widersprüchliche Wechselanweisung.
- Reproduzierter Echtfall United Fighters: Aufstellung Tag 1 in Clash fixiert – Tag 2 benötigt gegenüber Tag 1 **Suminizer/Raphtor raus** und **Luki/Tommy rein**, statt des bisherigen rein theoretischen Wechsels.

### Kompatibilität
- Reine Anzeige-/Planungs-Korrektur; produktive Profile und Datenbanktabellen werden nicht migriert oder zurückgesetzt. Keine Backend-/RLS-Änderung, Cloud-Datenformat weiterhin v9, separate Offline-PWA weiterhin v1.0.2.

## [1.8.0] - 2026-11-03

### CWL-Anzeige
- Eigene und gegnerische Clan-Aufstellung als gleichwertige, responsive Teamkarten mit jeweiligem Angriffsfortschritt und offiziellen Kriegssternen.
- Gegnerische Einzelangriffe einschließlich Sternen, Zerstörung, Rathausstufen und Zielauflösung; Vorbereitung bleibt ohne erfundene Angriffswerte.

### Stabilität und Bedienung
- Cloud-Abmeldung direkt im Konto-Menü, einschließlich Behandlung abgelaufener Sitzungen und Schutz für ungespeicherte Änderungen.
- Gastmodus: Mehrfachimport unabhängig von der Cloud-Anmeldung, Profilfenster im Vordergrund und zuverlässiges Umschalten zwischen Einzel- und Alle-Tage-Ansicht.
- Mobile Konflikthinweise und Tageswarnungen kompakter; verschwundenes weißes Clan-Steuerelement im lokalen Modus.

### Gestaltung
- Arena/Gold: große einheitliche Hauptüberschriften und ruhigerer Hintergrund ohne geometrisches Wasserzeichen.
- Kompakte Abschnittslabels in den übrigen Themes.

### Kompatibilität
- Cloud-Datenformat v9, CWL-Solver, Clash-Backend, Supabase/RLS und produktive Profile unverändert. Offline-PWA weiterhin v1.0.2.

## [1.7.0] - 2026-11-03

### Bedienung
- Hilfe und Clan & Konto als eigenständige responsive Unterseiten unter „Mehr“. Anmeldung, Registrierung, Passwort-Wiederherstellung und Einladungsannahme bleiben gesonderte Dialoge.
- Cloud-Kontoverwaltung mit bestehenden Rollen-/Einladungs-/Backup-Aktionen; automatische Versionswechsel pausieren während die Kontoseite offen ist.

### Mitglieder und Darstellung
- Karten, Tagesregeln und doppelte Namen ohne vollständiges Neuzeichnen der gesamten Mitgliederliste; Suche bündelt schnelle Eingaben und manuelle Reihenfolge wird effizienter ermittelt.
- Arena-/Gold-Theme mit ruhigeren Kartenflächen; Rathausbilder in Mitgliederliste und Statistik einheitlich, mit lesbarem RH-Fallback und CDN-Quelle.

### Kompatibilität
- Keine Änderung am CWL-Solver, API-/RLS-Berechtigungen oder Supabase-Schema. Cloud-Datenformat bleibt v9; die separate Offline-PWA bleibt v1.0.2.

## [1.6.0] - 2026-11-03

### CWL-Planung und Vorbereitung
- Globale Mehrtagesplanung mit exakten Einsatzzielen und drei Rotationsstufen; ältere Prioritäten bleiben konservativ erhalten.
- Die vorläufige Clash-Aufstellung eines freigegebenen Kriegstags kann mit der Empfehlung verglichen werden. Die App nennt Wechsel, ohne den Plan automatisch umzuschreiben.
- Eigene und gegnerische Mitglieder mit Rathaus und Player-Tag lassen sich in der Vorbereitung aufklappen. Unvollständige oder gespeicherte Daten werden nicht als bestätigte Aufstellung ausgegeben.

### Mitglieder, Sicherheit und Bedienung
- Spielernotizen, sichere Wiederaufnahme nach Austritt und API-geführte schreibgeschützte Stammdaten im Normalmodus.
- Manuelle Notfallbearbeitung nach Clash-API-Ausfall nur ausdrücklich; späterer API-Abgleich erfordert Bestätigung.
- Schutz gegen verspätete API-Antworten und Cloud-Revisionskonflikte; integrierter Seitenleisten-Schalter auf Desktop.
- Datenformat bleibt v9, separate Offline-PWA v1.0.2; keine Supabase-Datenbankmigration.

## [1.5.2] - 2026-11-03

### Clanwechsel & Kopfbereich
- In-App-Clanauswahl auf Desktop und Mobil: Auswahl nur vormerken, erst mit „Wechseln“ bestätigen; „Abbrechen“ und „Clan & Konto“ direkt erreichbar.
- Mobile Kopfzeile: aktiver Clan steht unterhalb des Logos; kleineres, einheitliches Chevron.
- Desktop: dezenter Einklapp-Button auf der Seitenleistenkante und kompakter Stift neben Mitgliedernamen.

### Mitglieder
- Mobile Rathausdarstellung und Abstände zu Dabei/Fix verbessert.
- Überflüssige Hinweise „3★-Werte aus Statistik“ und „Fix: alle verfügbaren Tage“ auf Mobilgeräten ausgeblendet.
- Keine Supabase-Migration; CWL-Planungslogik und Clan-Daten bleiben unberührt.

## [1.5.1] - 2026-11-03

### Navigation und Clanwechsel
- Im Cloud-Modus kann der aktive Clan direkt über den Clannamen im Kopfbereich gewechselt werden; die vorhandene Cloud-Speicher- und Berechtigungslogik bleibt unverändert.
- PC: Doppelte CWL-Planer-Kopfmarke entfernt; Seitenleiste optional auf reine Symbole einklappbar, Präferenz bleibt lokal gespeichert.
- Clankonto bleibt über die Clanauswahl verwaltbar. Login für nicht angemeldete Nutzer bleibt unverändert.
- Keine Migration und keine Änderung produktiver Supabase-Daten.

## [1.5.0] - 2026-11-03

### Adaptive Navigation
- Desktop ab 1100 px: dauerhaft sichtbare linke Seitenleiste und deutlich breiterer Arbeitsbereich statt schmaler 920-px-Hauptspalte und unten feststehender Navigation.
- Mobil bleibt die Bottom-Navigation; „Mehr“ führt zu Clan & Konto, CWL-Archiv, Regeln/Grunddaten, Darstellung, Backups, lokalen Profilen und Hilfe. Vorhandene Einstellungsformulare werden weiterverwendet, nicht dupliziert.
- Neues Schildsymbol und vektorbasiertes Browser-Favicon; die Kopfzeile passt das Logo farblich an das aktive Theme an.
- Arena: dezente Hintergrundgestaltung des Plan-Kopfbereichs und flachere Clan-/Kontoverwaltung statt ineinander verschachtelter kontrastreicher Kästen.
- Kriegstage mit klareren Zuständen; kleine Rathausbilder in Mitglieder- und Plan-Karten ohne Verlust der RH-Zahl.

### Bedienung
- Enter in der Cloud-Anmeldung sowie beim Einladungslogin löst „Anmelden“ aus.
- Ziehen einer Textmarkierung aus dem Konto-Dialog schließt ihn nicht; nur gezielter Tap direkt auf den Hintergrund oder „Schließen“.
- 3★-Mehrfachbearbeitung im Cloud-Planer verborgen; die echte, gesicherte Angriffshistorie bleibt maßgeblich.

### Nächste Idee
- Dokumentierter, standardmäßig **inaktiver** experimenteller Stärkevorschlag auf Basis geglätteter 3★-Quoten, Ø Sterne und Konfidenz unter Einhaltung harter CWL-Regeln, siehe docs/EXPERIMENTAL_ATTACK_STRENGTH_PLANNING.md.

## [1.4.9] - 2026-11-03

### Darstellung
- Arena übernimmt jetzt auch Karten, Modale, Dialoge, Spieler-/Statistikübersichten, Formulare, Navigation und Buttons mit dunklen Oberflächen sowie warmen Goldakzenten.
- Insbesondere der aktive Mitgliederabgleich ist klar als ausführbare Aktion statt wie ausgegraut erkennbar. Echte Sperren behalten eine unterscheidbare deaktivierte Darstellung.
- Namen in Mitgliederzeilen sind im Normalzustand Text statt flexibel wachsender Eingabefelder. Der Stift sitzt stets unmittelbar daneben; zum Bearbeiten erscheint ein Eingabefeld.
- Hilfe zu einzelnen Spielern in die rechte untere Ecke des Bearbeitungsbereichs verschoben.

### Zusammenarbeit
- Änderungshistorie zeigt aufklappbare konkrete Feldänderungen inklusive Vorher/Nachher und betroffenen Tagen. Rein technische Zeitstempel-Ereignisse werden ausgeblendet.
- Die Audit-Funktion erfasst nun zusätzlich CWL-Live-Abgleich, Mitgliederarchivierung, Änderungen am Clannamen und betroffene Tagesziele.
- Alte Ereignisse ohne gespeicherte Felddaten werden ehrlich als nicht rekonstruierbar markiert.

## [1.4.8] - 2026-11-02

### Mitglieder & Statistik
- Bei Spielern mit tatsächlichen Angriffsdaten entfällt die zusätzliche manuelle 3★-Stärkewahl. Ohne Daten bleibt die manuelle Einschätzung möglich.
- Die Spielerhilfe beschreibt Eingaben und die Quelle der persönlichen Hit-Rate/Ø Sterne: bis zu sieben tatsächlich erfasste Angriffe aus CW/CWL, Import/API, Anzahl Dreier und Sternsumme.
- Fixspieler sehen statt eines deaktivierten Einsatzziels eine eindeutige Kennzeichnung.
- In der Planansicht stehen 3★-Rate und gespielte/geplante Einsätze statt „7 Angriffe max.“.

### Ansicht & Zusammenarbeit
- Kompakte Einsatzbalken unterscheiden bereits gespielte und noch geplante Tage.
- Arena-Farbschema auf Basis des anthrazit-goldenen Beispiels, unabhängig von vorhandenen Themes.
- Aktiver Clan direkt in der Kopfzeile; Auto-Synchronisierung als kleines grünes Symbol mit Erklärung der unterschiedlichen Intervalle.
- Eine Cloud-Konfliktmeldung bietet direkt die Änderungen samt Ein-Klick-Aktion zum Neuladen (mit Schutz ungespeicherter Änderungen).
- Änderungsprotokoll protokolliert zusätzlich Einsatzziele und konkrete CWL-Konfigurationsänderungen.

## [1.4.7] - 2026-11-02

### Nachbesserung Planfreigabe
- Bei Vize-Vorschlägen werden die geschützten gespielten Aufstellungen und Archive exakt aus der Cloud-Version übernommen, sodass eine lokale Altdaten-Normalisierung keine berechtigten Vorschläge zurückweist.
- Destruktive und historische Aktionen im freigegebenen Vize-Modus gesperrt; normale Regeln bleiben als Vorschlag bearbeitbar.

## [1.4.6] - 2026-11-02

### Planfreigabe & Vize-Vorschläge
- Owner kann den gemeinsamen CWL-Plan freigeben und wieder zur Bearbeitung öffnen. Die Freigabe ist saisonabhängig und endet automatisch im folgenden Kalendermonat bzw. beim Neustart einer CWL.
- Vize können Änderungen am freigegebenen Plan als Vorschlag einreichen, erhalten Rückmeldung zu Annahme/Ablehnung und können ausstehende eigene Vorschläge zurückziehen.
- Offene Vorschläge mit Vorher/Nachher-Angaben; die Annahme durch den Clanführer aktualisiert den Plan nur bei unveränderter Basisrevision.
- Supabase-RLS und serverseitiger Schreibschutz verhindern direkte Änderungen von Vize während der Freigabe. Bestätigte Kriegstage und Archive dürfen durch Vorschläge nicht überschrieben werden.

## [1.4.5] - 2026-11-02

### Planung & Bedienung
- Pro Spieler lassen sich gewünschte Einsätze 1–7 festlegen; der Planer berücksichtigt diese Ziele bei der automatischen Rotation, gespielte Tage zählen mit. Fix und MUSS haben Vorrang; unerreichbare Zielwerte werden als Warnung gezeigt.
- Erst-ab/Raus-ab aus der Mitgliederoberfläche entfernt und beim Laden früherer Profile in direkte RAUS-Tagesregeln überführt.
- Pfeile für die eigene Mitgliederreihenfolge sind ohne Öffnen der Bearbeitung erreichbar.
- Die Cloud merkt sich den zuletzt ausgewählten Clan je Account und Gerät.
- Rathausverteilung im CWL-Gegnerfeld ausdrücklich als Gegner-Aufstellung beschriftet.
- Button zum manuellen Tagesabschluss als Rückfalloption erklärt; API-Abschluss mit tatsächlicher Aufstellung bleibt aktiv.
- Einheitlichere Höhen, Abstände und Beschriftungen der oberen Aktionen.

## [1.4.4] - 2026-11-02

### Mitglieder & Statistik
- Mitglieder im Cloud-Modus nach Ø Sternen der jeweils letzten sieben erfassten Angriffe sortieren; Spieler ohne Daten stehen unten.
- Die 3★-Hit-Rate der Mitgliederkarten nutzt nun dieselben letzten sieben Angriffe wie die bereits vorhandene Ø-Sterne-Anzeige. Der Statistik-Tab bleibt bewusst nach ausgewähltem Krieg-/Saisonzeitraum auswertbar.
- In der Einsatzverteilung lassen sich die einzelnen Tage eines Spielers per Klick aufklappen.

### Darstellung & CWL
- Die App-Versionshinweise haben am Desktop die ganze Breite unterhalb des Farbschemas.
- Nach dem Neuaufbau der Plan-Karten werden vorhandene Gegner- und CWL-Live-Daten sofort erneut eingehängt, ohne auf einen API-Refresh zu warten.
- Fehlt der Status einer Runde, bleibt das CWL-Element statt eines Renderfehlers verfügbar.

## [1.4.3] - 2026-11-02

### CWL & Mitgliederabgleich
- Ausgetretene Spieler in geplanten Aufstellungen lassen sich eindeutig weiter einplanen oder aus allen noch offenen Kriegstagen nehmen. Bereits gespielte Aufstellungen und Spielerhistorie bleiben gespeichert.
- CWL-API: Temporäre Upstream-Fehler werden begrenzt erneut versucht; einzelne fehlerhafte Kriegstagsabfragen können die verfügbare CWL-Gruppe nicht mehr vollständig blockieren. Vorhandene, passende CWL-Details bleiben bei Teilfehlern erhalten und bestätigte Kriegstage werden nicht überschrieben.
- Der CWL-Abruf unterscheidet verständlich zwischen fehlenden Berechtigungen, vorübergehend nicht verfügbaren Kriegsdetails und allgemeinen Verbindungsproblemen. Der manuelle Plan bleibt erhalten.

## [1.4.2] - 2026-11-01

### Einladungen
- Einladungslinks öffnen ein eigenes, mobilfreundliches Beitrittsfenster mit dem Namen des Planers, der eingeladenen Rolle und dem Ablaufdatum.
- Bestehende Konten sehen nach Möglichkeit ihren bisherigen Anzeigenamen vorausgefüllt und treten erst nach ausdrücklichem Klick auf „Beitreten“ bei.
- Anmeldung und Registrierung erfolgen direkt aus der Einladung; die Einladung bleibt auch über die E-Mail-Bestätigung erhalten.
- Abgelaufene, widerrufene oder ungültige Einladungen erhalten eine eindeutige Meldung statt eines versteckten Formulars in „Clan & Konto“.
- Eine stark eingeschränkte, nur lesende Vorschaufunktion liefert ausschließlich Planername, Rolle und Gültigkeit zu einem gültigen, zufälligen Token.

## [1.4.1] - 2026-11-01

### Mitglieder
- 3★-Hit-Rate ausdrücklich beschriftet. Der durchschnittliche Sternwert verwendet nur die letzten sieben gespeicherten einzelnen Angriffe (oder entsprechend weniger, wenn noch nicht sieben vorliegen).
- Der zugrunde liegende Zeitraum wird verständlich angezeigt; technische Kürzel wie „P0“ entfallen in der kompakten Cloud-Mitgliederansicht. Priorität bleibt über „Bearbeiten“ verfügbar.
- Die ausführliche Clan-Statistik bleibt vom neuen gleitenden Sterneschnitt unberührt.

### Einstellungen
- Alle Einstellungsbereiche teilen sich jetzt ein einziges Fenster mit gemeinsamer Oberfläche, Scrollbereich und feststehender Kopfzeile.
- Redundante Überschriften und Kartenabstände entfernt. Die Hilfe- und Offline-Funktionen bleiben vorhanden.

## [1.4.0] - 2026-11-01

### Oberfläche und Statistik
- Einstellungen öffnen als eigenständiger Dialog wie „Clan & Konto“; Begrifflichkeiten für Nutzer vereinfacht und Hilfe aktualisiert.
- Statistik zeigt jetzt Sterne pro Angriff im Durchschnitt, einzelne Ergebnisse für die Auswahl „1 CW“ und einen aufklappbaren Kriegsverlauf je Gegner und Datum.
- Verpasste Angriffe mit unvollständigen historischen Daten werden als Mindestzahl ausgewiesen, statt eine exakte Zahl vorzutäuschen.
- Mitglieder im Cloud-Modus zeigen echte 3★-Hit-Rate und durchschnittliche Sterne; die manuelle Stärke bleibt nur im lokalen Offline-Planer.
- Rathausfilter präzisiert und Bearbeitungsstift neben den Spielernamen gerückt.

### Zusammenarbeit
- Opt-in/Opt-out für automatischen Clash-Mitgliederabgleich, mit manuellem Knopf. Bereits geplante ausgetretene Spieler benötigen weiterhin eine Entscheidung.
- Zugriff entziehen unterscheidet sich von dauerhafter Sperre. Alte Einladungen werden beim Entfernen unwirksam; neue Links können eine entfernte Person erneut aufnehmen. Dauerhafte Sperren bleiben bis zur Freigabe erhalten.
- Online-Status beschreibt aktive Nutzer des gemeinsamen Planers, nicht aktive Clash-Spieler.
- Gefährliches Löschen des gesamten gemeinsamen Planers in den erweiterten Bereich verlegt.

### Datensicherheit
- Automatische Wiederherstellungspunkte auf maximal fünf Versionen pro Planer begrenzt. Vollständige externe Sicherungen und Kriegsstatistiken bleiben unabhängig.

## [1.3.9] - 2026-11-01

### Statistik und Navigation
- Normale CWs (1, 2, 3, 5, 10, 25 oder 50) und CWL-Saisons (1, 2, 3 oder alle) unabhängig im platzsparenden Zeitraum-Menü wählen. Die gemeinsame Statistik berücksichtigt beide Werte.
- 3★-Hit-Rate und verpasste Angriffe präzise benannt; verpasst heißt nicht zwingend vergessen. Rathausbilder mit Text-Fallback in der Spielerliste.
- Kompakter Zugriff auf Clan & Konto ohne abgeschnittene Clannamen am Smartphone.

### Gruppenlinks und Rechte
- Einladungslinks für beliebig viele Beitritte: Laufzeit 24 Stunden, sieben Tage oder unbegrenzt bis zum Widerruf; Einmal-Links bleiben verfügbar.
- Besitzer verwalten alle Links und Mitglieder. Vizes verwalten eigene Links und dürfen Beobachter entfernen, nicht Besitzer oder andere Vizes.
- Entfernte Mitglieder werden bis zur expliziten Freigabe für neue Beitritte gesperrt – auch über noch aktive Links. Freigaben folgen derselben Rechtehierarchie.
- Einladungen überstehen Registrierung und E-Mail-Bestätigung (bei Rückkehr auf denselben Website-Ursprung).

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
