CLOUD-RELEASE 09.11.2026 (v1.16.43 offiziell; PR #185 Squash f3d82174f140, PR-CI 42600867611, Main-CI 42601126972, Pages 42601126816, Release-Workflow 42601341426 und GitHub Release v1.16.43 erfolgreich): CWL #181 zeigt belegte Angriffe im laufenden Krieg in Plan-Tiles und Einsatzverteilung, aktuelle CWL-3★-Quote/Ø Sterne mit n und Tagesergebnisse. 0★ bleibt nur bei Beleg 0★, Unbekanntes bleibt ungeklärt. Hilfe angepasst, Browser-/Core-Tests grün. Echte mishix-/Mobile-Abnahme offen. Kein Solver/Lock/Datenbank/Auth/RLS/Edge/Offline-Eingriff.
CLOUD-RELEASE 09.11.2026 (v1.16.42 offiziell; PR #179 Squash 755e1d241131, PR-CI 42587244106 und Main-CI 42587565761 je 527/527, Pages 42587565164, Release-Workflow 42587821595 und GitHub Release v1.16.42 erfolgreich): Arena/Gold ist Standard für neue Cloud-Nutzer ohne gespeicherte Theme-Auswahl; bestehende Einstellungen bleiben erhalten. Neuer Browser-Test für Speichern, Reload, Systemmodus und defekte UI-Einstellungen. Hilfe geprüft; Offline-PWA, CWL/Statistik/Solver und Supabase/Auth/RLS/Edge unverändert.
CLOUD-RELEASE 09.11.2026 (v1.16.41 offiziell, PR #174 Squash 68e7482a4a5b, PR-CI 42583057065 und Main-CI 42583298284 je 526/526, Pages 42583297754 und Release-Workflow 42583490544 erfolgreich): Statistik korrigiert Einzahl bei einem Krieg oder Angriff in Übersicht, Verlauf und Details. Daten, Quoten, Filter, Solver, Supabase/Auth/RLS/Edge und Offline-PWA bleiben unverändert.
CLOUD-RELEASE 09.11.2026 (v1.16.40 offiziell, PR #172 Squash 66bf667dec55, PR-CI 42580980017 und Main-CI 42581295046 je 526/526 Tests, Pages 42581294634 und Release-Workflow 42581460764 erfolgreich): Statistik-Ladestatus unterscheidet abgeschlossene und noch unbestätigte Kriege; keine unbelegte Behauptung „Statistik aktuell“. Neutraler Leerstand für alle Rollen und CW/CWL-Importmeldung. Pure und Chromium-Regression vorbereitet; keine Änderung an Daten, CWL-Plan/Solver, Supabase/Auth/RLS/Edge oder Offline-PWA.
CLOUD-RELEASE 09.11.2026 (v1.16.39, PR #170 Squash d79292a9b1af, PR-/Main-CI je 525/525 Tests, Pages und offizieller Release erfolgreich): Spielerstatistik sortiert bei „Name (A–Z)“ nun wirklich alphabetisch, auch nach Clan-Namenswechsel; numerische Sortierungen bleiben absteigend. Browserregression mit aktivem/ehemaligem Spieler bei 320/390/430/1366px und Gold/Dark/Light, aktuelle Clannamen und historische Angriffsnamen weiterhin getrennt. Keine Änderung an Ergebnissen, Plan/Solver, DB, Auth/RLS, Edge oder Offline-PWA. Reale iPhone-/Android-Abnahme offen.
CLOUD-RELEASE 09.11.2026 (v1.16.38, PR #168 Squash 262782fc819f, PR-/Main-CI je 525/525 Tests, Pages und offizieller Release erfolgreich): Hilfe erklärt Einsatzverteilung anhand realer Statuslabels Gespielt/Geplant/Gesamt statt G/P, Tage ohne RAUS als Verfügbarkeit statt Einsatzziel und das Öffnen konkreter Spielertage mit ggf. 8★-Hinweis. Einstieg unterscheidet Clash-Abgleich im gemeinsamen Clan von manuellem Gastmodus. Help-Viewer-Regression 320/390/430/1366px Gold/Dark/Light. Keine Änderung an Solver, Statistik, Auth/RLS, produktiven Daten oder Offline-PWA. Echte Safari-/Android-Abnahme ausstehend.
CLOUD-RELEASE 09.11.2026 (v1.16.37, PR #166 Squash 4e4945fdd2fe, PR-/Main-CI jeweils 524/524 Tests, Pages und offizieller Release erfolgreich): Unter Mehr > App installieren werden die richtige gemeinsame App mit Clan-Anmeldung/Statistik und die Wiederherstellung einer alten Verknüpfung ohne diese Funktionen verständlich beschrieben; dezente ausklappbare Hilfe, mobile/desktop Viewer-Regression. Keine Änderung an PWA-Manifest/Service Worker, Cloud-/Offline-Daten, Solver oder Auth/RLS. Reale Safari-/Android-Abnahme ausstehend.
CLOUD-RELEASE 09.11.2026 (v1.16.36, PR #164 gemergt, PR-/Main-CI je 523/523 Tests, Pages und offizieller Release erfolgreich): Spielerstatistik und Duelle zeigen für aktuell gemeldete Clankameraden den aktuellen Cloud-Kadernamen statt alter Angriffsnamen. Suche/Sortierung und Spielerform werden konsistent; ehemalige Spieler behalten historische Namen. Reine UI-Projektion, keine Historien- oder DB-Migration, keine Quoten-, Solver-, Auth/RLS-/Edge- oder Offline-PWA-Änderung. Reale iPhone-/Android-Abnahme offen.
CLOUD-RELEASE 09.11.2026 (v1.16.35, PR #163 gemergt, 522/522 PR-Tests, Main-CI, Pages und offizieller Release erfolgreich): Freie Spielerstatistik zeigt nur abgeschlossene CWs/CWL-Tage in Umfang und Kriegsmenge, bei „Alle“ keine technische „Bis zu all“-Angabe, keine laufenden API-Kriege im Nenner und bei fehlender Historie verständlichen Leerzustand. Filter-/Angriffsdaten, andere Analyse-Tabs, Solver und Offline-PWA unverändert. Reale Geräteabnahme offen.
CLOUD-RELEASE 09.11.2026 (v1.16.34, PR #162 gemergt; 521/521 PR-Tests, Main-CI, Pages und Release erfolgreich): Spielerform listet auch aktuelle Spieler ohne gespeicherte Angriffe neutral als „Keine Daten“, nicht 0 % oder 0/0; aktuelle Namen vor historischen, RH-Datenlücken und Suchleerzustand klarer. Beim Same-Clan-Reload bleibt die sichtbare Spielerzeile stabil. Reine Frontend-Statistik/Lesekontext-Änderung, keine Änderung an CWL-Solver, produktiven Daten, Supabase/RLS/Auth/Edge oder Offline-PWA; reale Safari-/Android-Abnahme ausstehend.
CLOUD-RELEASE 08.11.2026 (v1.16.33, PR #161 gemergt, PR-/Main-CI je 519/519 erfolgreich, Pages und offizieller Release live): Statistik > Verlauf & Kriege zeigt jetzt österreichische, eindeutige Datums-/KW-/Monatsangaben (03.11.26, KW 45/26, Nov 26) statt technischer ISO-Teile; Tooltip und Tabelle enthalten vollständige Datumsangaben. ISO-KW-Jahreswechsel, Tag-/Wochen-/Monatsintervall und mobile Gold/Dark/Light-Viewer-UI mit synthetischen Tests geprüft. Keine Änderung an Zeitachsen-Abständen, Daten, Quoten, Spielerform, Solver, produktiver Supabase/Auth/RLS/Edge oder Offline-PWA; reale Geräteabnahme offen.
CLOUD-RELEASE 08.11.2026 (v1.16.32, PR #160 gemergt, PR-/Main-CI je 517/517 Tests grün, Pages und offizieller Release erfolgreich): Statistik > Vergleiche behält den Fokus und die Leseposition des geöffneten Rathaus-Details bei same-clan-Realtime-Datenupdates. Chromium-Regression Gold/Dark/Light, Viewer und 320/390/430/699/1366px inklusive veränderter Quote und ungestörtem Filterwechsel. Datenbasis, Spielerstärke, CWL-Planer/Solver und produktive Supabase/Auth/RLS/Edge/Offline-PWA unverändert. Reale iPhone-/Android-Abnahme offen.
CLOUD-RELEASE 08.11.2026 (v1.16.31, PR #159 gemergt, PR-/Main-CI jeweils 516/516 Tests grün, Pages und offizieller Release erfolgreich): Mitglieder-Refresh sichert den Fokus des Namens-Bearbeiten-Buttons und die Bildschirmposition des gerade bedienten Spielers, ansonsten den bestehenden stabilen Listenanker. Kein unerwünschtes Scroll-Ankern beim bewussten Suchen/Sortieren. Chromium-Regression Gold/Dark/Light und Viewer bei 320/390/430/699/1366 px. CWL-Plan, Statistik, Produktivdaten, Supabase/Auth/RLS, Edge und Offline-PWA unverändert; echte Mobilgerätetests ausstehend.
CLOUD-RELEASE 08.11.2026 (v1.16.30, PR #158 gemergt, PR-/Main-CI jeweils 514/514 grün, Pages und offizieller Release erfolgreich): Mitglieder-UX: Suche, Statusfilter und Hilfe mindestens 44px antippbar, auch im kurzen Landscape. Zwei Filterspalten plus Trefferzahl, iOS-Eingabefelder mindestens 16px Text. Bearbeiten verweist via aria-controls auf zugehörigen Spielerbereich. Chromium-Regression bei 320/390/430/699/820-Landscape/1366 px in Arena/Dark/Light inkl. Viewer. Keine Änderungen an CWL-Plan/Solver, produktiven Daten, Supabase/Auth/RLS oder Offline-PWA. Reale Safari-/Android-Abnahme ausstehend.
CLOUD-RELEASE 08.11.2026 (v1.16.29, PR #157 gemergt; PR-/Main-CI 512/512 grün, Pages und offizieller Release erfolgreich): Einsätze → Spielerdetails: Der Aus-/Einklapp-Button nennt beim geöffneten Zustand jetzt „Einsatztage … schließen“ statt irreführend „anzeigen“; sichtbare Einsatztage sind dem Button bei Offenstand per aria-controls eindeutig zugeordnet. Touchhöhe des Namensbuttons auf allen mobilen Breiten bis 699 px mindestens 44 px, statt nur auf <471 px im Hochformat. Chromium-Regression in Arena/Dark/Light bei 320/390/430/600/699/768/1366 px; Beobachterrolle, Fokus, Ein-/Ausklappen, Filter, Plan-Unversehrtheit. Nur UI: kein Eingriff in CWL-Planungslogik, produktive Daten, Supabase/Auth/RLS oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.28, PR #156 gemergt; PR- und Main-CI 510/510, Pages und offizieller Release erfolgreich): Statistik → Verlauf & Kriege: dreispaltige CW/CWL-Verlaufstabelle bleibt lesbar und bei 320–430 px nur innerhalb ihrer eigenen Region seitlich scrollbar, inklusive Tastaturfokus und horizontalem Scroll-Anker nach Hintergrundrefresh; 12px statt 10px Tabellenköpfe. Kriegskarten zeigen mobil erst Kriegs-/Gegnerdaten, darunter Angriffssummen; Einzelangriffe untereinander, keine gequetschten Namen. Browserregression 320/375/390/430/550/720/1366 px, Arena/Dark/Light, Viewer, Filter-Touchflächen, Namensumbruch, Refresh und kein Seitenscroll. Keine Änderung an CWL-Solver, Statistikberechnung, Datenbank, Auth oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.27, PR #155 gemergt; PR-/Main-CI 509/509 grün, Pages und offizieller Release erfolgreich): Statistik → Vergleiche ordnet die zwei Spielerkarten und CW/CWL-Werte ausdrücklich Spieler A/B zu. Dezente Spaltenüberschriften auf gleichem Raster wie die echten Angriffswerte; kein Kartenstapel und kein zusätzliches Diagramm. Zahlen bleiben exakt, Detailbereiche und Filterzustände beim Nachladen erhalten. Browserregression bei 320/375/390/430/720/1366 px in Gold/Dark/Light inkl. Viewer und langen Spielernamen. Keine Änderungen an Statistikauswertung, CWL-Plan/Solver, Supabase, Auth/RLS oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.26, PR #154 gemergt; PR- und Main-CI 508/508, Pages und offizieller Release erfolgreich): Spielerform: Drei Zeitraum-Schaltflächen auf 320–720 px mit mindestens 13 px statt teilweise 11 px Beschriftung; lange Namen dürfen umbrechen, Zeitraumdetails mit 12 px. Form- und Vergleichsfilter mindestens 44 px statt 43 px, dynamische Methodik-/Sortierhinweise kürzer ohne die Datenqualität oder Kleinststichproben zu verbergen. Browserregression 320/375/390/430/720/820/1366 px in Arena/Dark/Light inklusive Viewer, Fokus, Formularzustände, Reload. Keine Änderung an Berechnungen, Plan/Solver, Supabase, Auth/RLS oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.25, PR #153 gemergt; PR-/Main-CI 508/508 Tests, Pages und offizieller Release erfolgreich): Statistik-Navigation auf Smartphone (bis 720 px) in zwei ausgewogenen Reihen mit drei und zwei Unterbereichen statt alleinstehendem fünften Tab. Alle Tab-Schaltflächen mindestens 44 px hoch, Umbruch bei langen Texten ohne Überlauf. Desktop weiterhin fünf gleich breite Tabs in einer Reihe. Browserregression für 320/375/390/430/720/820/1366 px in Gold/Dark/Light, Viewer und Filter-/Tabzustand. Keine Änderungen an Statistikmethodik, CWL-Solver, Supabase, Auth/RLS oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.24, PR #152 gemergt; PR- und Main-CI 507/507, Pages und offizieller Release erfolgreich): Statistik-Überblick zeigt Kennzahlen und Ausfallabdeckung zuerst; weitere Angaben zur Datenbasis lassen sich aufklappen und bleiben bei Reload offen. Hinweise zu unbekannten CWL-Ausfällen bleiben korrekt, sind aber kürzer. Verlaufslegende ohne technische Theme-Erklärung. Synthetische Chromium-Regression 320/390/430/1366 px, Gold/Light/Dark und Viewer-Rolle: 507/507 PR-Tests bestanden. Keine Änderungen an Statistikberechnung, CWL-Solver, Datenbank, Rollen oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.23): Bei einem Daten-Reload in Statistik → Vergleiche / Verlauf & Kriege bleiben das geöffnete Spielerduell, das aufgeklappte Zeitfenster und die sichtbare Kriegskarte samt Tastaturfokus stabil. Neue, oberhalb eingefügte Kriege verschieben nicht mehr ungewollt die Leseposition. Nur bei neuem Datensatz im selben Clan; absichtliches Filtern/Sortieren erhält keine künstliche Scroll-Sperre. 320/390/430/1366 px, Gold/Dark/Light und Viewer in synthetischer Browserregression geprüft. Keine Änderungen an Planungslogik, Supabase, Auth, Rollen, Daten oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.22): Statistik-Überblick beschreibt jetzt korrekt alle gespeicherten abgeschlossenen CWs/CWL-Tage statt fälschlich die Filter des eigenständigen Spielerstatistik-Tabs. Bei neuen Daten in der Spielerstatistik bleiben sichtbare Listenposition, Fokus und offene Spieler-Details erhalten, wenn neue Zeilen davor einsortiert werden; aktive Benutzersortierung/Suche arbeitet weiterhin normal. Einzahl/Mehrzahl bei Kriegs-/Ausfallzahlen bereinigt; Hinweise zu unbekannten CWL-Missed-Belegen korrekt. Browserregression Mobile/Desktop, Cloud v1.16.21-Datenintegritätsfix bleibt bestehen. Keine Änderung an Planungslogik, Auth, Rollen, Supabase, Rohdaten oder Offline-PWA.
CLOUD-RELEASE 08.11.2026 (v1.16.21): CWL-Missed-Datenqualität korrigiert. Eine vollständige 15er-Tagesaufstellung ohne bestätigten offiziellen Endkriegs-/Missed-Log reicht nicht mehr, um ungespeicherte Angriffe als versäumt oder die Ausfälle als vollständig zu markieren. 15/15, 14/15 und 13/15 bleiben bei fehlendem Gegenbeleg ausdrücklich unbekannt; bestätigte Missed-Logs und bisherige normale CW-Auswertung bleiben nutzbar. Statistik-KPI heißt einheitlich 3★-Quote. Keine Änderung an CWL-Plan, Angriffsdaten, Supabase, Rollen oder Offline-App.
CLOUD-RELEASE 07.11.2026 (v1.16.20): Statistik-Vergleiche folgen der gewählten Kriegsart: Nur CW / Nur CWL zeigen jeweils drei passende Gegner-RH-Kategorien statt einer leeren Spalte der ausgeschlossenen Kriegsart. Detailgruppen wechseln passend mit und bleiben beim Filterwechsel aufgeklappt. Read-only, keine Änderung an Planer, Datenbank oder Offline-App. Laufender Projekt- und Chat-Übergabestand: docs/ACTIVE_PROJECT_HANDOFF.md.
CLOUD-RELEASE 06.11.2026 (v1.16.6): Vollständige Clash-Spielerkarten auch bei roten Auswechselspielern, Einwechselspieler als grüne verankerte Overlay-Karten ohne Verschieben des Rasters. Einsätze zeigt CWL-Sterne, 8★-Fortschritt und CWL-3★-Quote ohne doppelte unfertige Form-Zeile. Die Statistik-Nachladung aktualisiert auch Einsätze. Appweites Motion-System separat vorgemerkt. CWL-Solver, Daten und Offline-PWA unverändert.
CLOUD-RELEASE 06.11.2026 (v1.16.5): Neu erstellte Gruppen- und Einmal-Einladungen lassen sich unter Clan & Konto → Aktive Einladungslinks jederzeit erneut kopieren, ohne einen weiteren Link anzulegen. Das erfolgt über einen privaten, rollenberechtigten Code-Abruf. Historische Hash-only-Links bleiben gültig, sind aber nicht rekonstruierbar. Keine Kader-/Solver-/Offline-PWA-Änderungen.
CLOUD-RELEASE 06.11.2026 (v1.16.4): CWL-Plan zeigt den tatsächlichen Clash-Abgleich direkt bei den Spielern samt Raus-/Rein-Namen und Kopieraktion. iPhone-Tagesreiter bleiben sichtbar. Einsätze zeigt wieder den sicheren 8★-Stand. Aktuelle CWL-Quote und letzte sieben CW/CWL-Angriffe sind eindeutig getrennt; keine Änderung an der Formbewertung.
CLOUD-RELEASE 06.11.2026 (v1.16.3): Ursprüngliche geplante Tagesaufstellung und ihr Aufklapp-Button im CWL-Plan wiederhergestellt. Die aktuelle Clash-Vorbereitung markiert direkt in der ursprünglichen Liste, wer bereits drin ist und wer hinein oder heraus muss. Keine doppelten großen Kaderlisten. Die Kriegsansicht konzentriert sich auf Gegner und Angriffsergebnisse; 8★-Stand und Reservehinweise sind bei Einsätze. Kein Eingriff in die Planungslogik, Cloud-Daten oder Offline-PWA.\nCLOUD-RELEASE 06.11.2026 (v1.16.2): Unter CWL-Plan gibt es statt der zweiten großen Spielerliste nur noch die bestehende aufklappbare Clash-Teamansicht. In der Vorbereitung werden Wechselkandidaten hervorgehoben, geplante Einwechselspieler bei Bedarf aufgeklappt. Bei fehlendem/frischem API-Beleg bleibt die bisherige Planung sichtbar; keine automatischen Tauschentscheidungen. In Einsätze sind bestätigte Tagessterne (oder tatsächlich verpasste Angriffe) und eine stichprobenbezogene laufende CWL-3★-Quote zu sehen. Spielerform: klare RH-Erklärung, Platznummern, höhere 3★-Quoten zuerst, Stichprobe; Vergleiche: drei senkrechte Balken als erster Blick, vollständige Details optional; Verlauf: Datenlücken verständlich. Keine Datenmigration, keine geänderten Einsatzziele/Locks, kein Offline-PWA-Update.\nCLOUD-RELEASE 06.11.2026 (v1.16.1): In Einsätzen stehen 8★-Fortschritt und separate jüngste Spielerform bei den jeweiligen Spielern; in der Tagesplanung sind die echte Clash-Aufstellung, Wechselmarkierungen und die geplanten Ersatzspieler mit Bewertungsdaten sichtbar. Der Planer verschiebt unter Einhaltung der bindenden MUSS/RAUS-, Fix- und Einsatzzielregeln möglichst alle drei Angriffe eines Drei-Einsatz-Spielers bis Tag 6, um Tag 7 als manuelle 8★-Reserve frei zu halten. API-Mitgliederabruf wiederholt vorübergehende 500/520/525/429-Fehler einmal, ohne die gespeicherten Mitglieder zu löschen. Keine Datenbank-/Cloudprofil-/Offline-PWA-Änderung.\nCLOUD-RELEASE 06.11.2026 (v1.16.0): Statistik 3.0 mit fünf eigenständigen Ansichten (Überblick, freie Spielerstatistik, unabhängige Spielerform, Vergleiche, Verlauf/Kriege). Die freie Kriegsmenge ist keine versteckte Einschränkung für Form, Duelle und Verlauf; Form über 30/90/180 Tage mit Datenqualität. Vergleiche mit Balken/Sternverteilung, Wochen-/Tages-/Monatstrends und Theme-sicheren Symbolen. Desktop-Tabellen großzügiger, Mobile responsive. Keine Änderung an Supabase, RLS, Planung, Cloudprofilen, Offline-PWA oder Auth-Collector.\nCLOUD-RELEASE 06.11.2026 (v1.15.9): Statistik wird durch einen geschützten GitHub-OIDC-Server-Job unabhängig von Appbesuchen alle zwei Stunden für alle verknüpften Clan-Tags abgeglichen; dabei nur bestätigte beendete CW/CWL-Kriege in der Leistungsauswertung, laufende Kriege werden vorläufig gespeichert. Im Statistik-Tab sind der letzte erfolgreiche Abgleich und mögliche Fehler sichtbar. Kein Import oder ungefragtes Mischen von fremden Clan-Daten, keine Planer-Änderung. Details: docs/AUTO_STATS_COLLECTOR.md.\nCLOUD-RELEASE 06.11.2026 (v1.15.8): Statistik erkennt eigenständige CWL-Durchgänge über den Tagesabstand statt nur Kalender-Monate, zeigt Wochen-/Monats-Verläufe für 3★-Quote und Ø Sterne getrennt nach CW/CWL mit klaren Stichprobenzahlen, und ermöglicht direkten Spieler-zu-Spieler-Vergleich anhand identischer Kriegs- und RH-Filter. Es gab keine Planer-/Cloud-Datenbank-/Profil-/Offline-Änderung. Hintergrund-Sammler und sichere Freigabe mit Zweit-/Fremdclans bleiben eigene Entwicklungsaufgaben (#104/#103); alte ClashPerk-Daten werden nicht ungeprüft importiert.
CLOUD-RELEASE 05.11.2026 (v1.15.7): Statistik erhält Unterbereiche Überblick / Spieler / Vergleiche / Verlauf & Kriege, eine erste echte RH-Level-Vergleichsauswertung CW und CWL, transparenten ausgewerteten Datenumfang statt missverständlicher 50 CWs + 3 CWLs und nummerierte Spielerzeilen. Die Einsatzübersicht zeigt verständliche Verfügbarkeit, gespielt/geplant/gesamt ohne 3★-Fragezeichen. Alle CWL-Monate standardmäßig berücksichtigt. Keine Datenbank-, Profil-, Planer- oder Offline-PWA-Änderung. Die historischen zusätzlichen Juni-/Juli-ClashPerk-Exporte sind noch nicht vollständig in der Live-Statistik importiert.\nCLOUD-RELEASE 05.11.2026 (v1.15.6): Eine manuelle Tagesregel (AUTO/MUSS/RAUS) aktualisiert den Plan, ohne die geöffnete Mitgliederkarte, den Regelbereich oder den Scrollkontext zu verlieren. Eine taktische RAUS-Regel an einem noch offenen Tag wird bei flexibler AUTO-Rotation, sofern Platz vorhanden, durch eine weiche Priorität auf anderen Tagen ausgeglichen; feste Ziele, MUSS, RAUS und bereits gestartete Kriege haben Vorrang. Alle Änderungen rein im Planer-Code, ohne Datenbankmigration oder Änderungen an Spielerprofilen.\nCLOUD-RELEASE 05.11.2026 (v1.15.5): Spielerstatistik übersichtlicher, nachvollziehbarere Formwerte nach 30/90 Tagen und belegter Stichprobe statt pseudoexaktem 0–100-Index; keine voreilige Auszeichnung des „besten“ Spielers. Auf Mobilgeräten klar beschriftete Kennzahlen in lesbaren Zeilen. Bei alten CWL-Lücken gezielte ClashPerk-Hilfe; 21 alte Kriegstage August–Oktober bleiben ohne vollständigen Nachweis. Rein lesend, keine Datenformatänderung, kein Umbau des Planers.
CLOUD-RELEASE 05.11.2026 (v1.15.4): Mobile Einsatzverteilung überarbeitet. Suche/Filter auf schmalen Smartphones einzeln und lesbarer, Einsätze als ruhige Zeilen mit Trennlinien statt eng gerahmter Karten. Desktop und CWL-Planungslogik unverändert, keinerlei Datenmigration. 
CLOUD-RELEASE 05.11.2026 (v1.15.3): Neuer aufklappbarer Vergleich der Spielerstärke aus 30-Tage-gleich-RH-Angriffen und 90-Tage zeitgewichteter gleich-RH-Form, getrennt nach CWL/CW und mit Datenqualität. Historische Mirror-Positionen und First-Hit-Status fehlen; keine falsche Sicherheit. Mitgliederkarte behält 7-Angriffs-Rohwerte bis zum Backtest. Die Importbestätigung nennt tatsächliche verpasste Angriffe statt nur Log-Zeilen. CWL Live zeigt offene Angriffe in der letzten Stunde vor Kriegsende und gesicherte Versäumnisse erst nach einem vollständigen, endgültigen Kriegsstand. Keine automatische saisonale Pause oder Änderung der nächsten Lineups; manuelle Clash-Aufstellung bleibt verbindlich. Datenqualitätsaudit read-only: 52 Kriege/1187 Attacken/59 belegt, keine widersprüchlichen Angriffszahlen oder 3★ ohne 100 %, 21 historische CWL-Tage weiter ohne vollständigen Missed-Nachweis.

CLOUD-RELEASE 05.11.2026 (v1.15.2): Statistik „Verpasst“ zeigt CW/CWL mit eigenständiger Datenabdeckung. Normal-CWs bleiben auch dann exakt, wenn importierte CWL-Missed-Logs lückenhaft sind; Spielerzeilen zeigen die Teilwerte. Fehlende CWL-Kriegsaufstellungen ergeben keine angeblich sichere 0 und Sortierung nutzt nachgewiesene Misses. Datenquelle/Exportoptionen unter docs/CLASHPERK_EXPORTS_AND_MISSED_COVERAGE.md. Keine DB-/Planer-/Spielerwertänderungen.

CLOUD-RELEASE 05.11.2026 (v1.15.1): Auf Wunsch Zurück-Button in Mehr > Clan & Konto auf dem Smartphone wieder rechts oben. Ausführliche technische und fachliche Recherche für statistische Spielerbewertung in docs/CWL_PLAYER_PERFORMANCE_RESEARCH_2026-11-05.md. Statistikberechnung/Solver, CWL-Live, Cloudprofile und Supabase bleiben unverändert.

CLOUD-RELEASE 05.11.2026 (v1.15.0): Mobil-Layout des Zurück-Buttons in Clan & Konto vereinheitlicht. Read-only 8★-Fortschritt in aktiver CWL, konservative Datenlückenbehandlung und unverbindliche Wechselhinweise für einen faireren regulären Ligamedaillenanteil; keine Änderungen am Solver oder Cloud-Datenformat.

CLOUD-RELEASE 05.11.2026 (v1.14.8): Button-Schriften in Handlungsbereichen vereinheitlicht (mobil i.d.R. 13px, Bottomnav 11–12px statt 9px), wichtige Touch-Flächen auf mindestens 44px erhöht. Desktop-Sekundäraktionen lesbarer; bewusst kompakte Icons, Tabellen/Badges und Landschaftsmodus bleiben erhalten. Keine Cloud-/CWL-Datenänderung.

CLOUD-RELEASE 05.11.2026 (v1.14.7): Einheitliche Einstellungsansichten (ein Desktop-Rahmen, offene Mobilabschnitte) in allen Themes; iPhone-, Android- und PC-Installationshinweise direkt auswählbar. Ohne Eingriff in CWL-/Cloud-Daten und Installationsidentitäten.

CLOUD-RELEASE 04.11.2026 (v1.14.6): Aktuelle Gold-Bildmarke für Home-Bildschirm, Manifest, Favicon und Teilen-Vorschau vereinheitlicht; getrennte Cloud-/Offline-Installations-IDs und Profilspeicher unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.5):
- Unter Mehr > App installieren steht eine plattformgerechte, manuell abrufbare
  Anleitung für Safari/iOS, Android und weitere Browser.
- iOS: nur ein unaufdringlicher Hinweis innerhalb von Mehr, lokal dauerhaft
  ausblendbar; keine neuen Pop-ups oder blockierten Android-Installationsprompts.
- CWL-Abgleich: „Aus der Kriegsaufstellung nehmen“ /
  „In die Kriegsaufstellung aufnehmen“. Kurzer Clash-Chat-Kopiertext bleibt.
- Cloud-Manifest/Installations-ID, v9-Datenformat, Rollen, Solver, Supabase,
  Offline-PWA v1.0.2 und vorhandene Cloud-Pläne unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.4):
- Android-Installation von cloud-app.html startet nun zuverlässig den Cloud-Planer
  mit Konto/Clan-Anmeldung, Einsätzen und Statistik statt der Offline-PWA.
- Eigenes cloud-manifest.webmanifest mit eindeutiger Cloud-App-ID und Start-URL.
- Lokale Offline-PWA (index.html / manifest.webmanifest) bleibt v1.0.2, unverändert.
- Bereits falsch installierte lokale Verknüpfungen müssen manuell ersetzt werden;
  vor Löschen eventuell lokaler Daten vorher JSON-Backup exportieren.
- Keine Cloud-API-, Solver- oder Supabase-Änderung; Datenformat v9 unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.3):
- Beim automatischen Cloud-Abgleich bleibt der sichtbare Spieler an seiner
  bisherigen Bildschirmposition, auch wenn davor Mitglieder eingefügt werden.
- Der Einstellungen-Dialog erhält den Scrollstand der darunterliegenden Ansicht
  beim Öffnen und Schließen; echter Tabwechsel verhält sich wie bisher.
- Smartphone- (320/390/430 px) und Desktop-Regression (1366 px) ergänzt.
- Cloud-Datenformat v9, Solver, Supabase und Offline-PWA unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.2):
- Lange Mitglieder-/Statistiklisten rendern sichtbare Zeilen effizienter;
  Gold-Theme ohne fixierten Hintergrund oder Einzelschatten je Spielerkarte.
- Kriegsverlauf erzeugt die Einzelangriffe erst beim Öffnen; Filter und
  Refresh behalten die geöffneten Kriege, Suche vermeidet Rechen-/DOM-Duplikate.
- Mobile Aktionen für Notizen, Reihenfolge und Bearbeiten besser erreichbar.
- Cloud-Datenformat v9, Planungslogik, RLS, Supabase und Offline-PWA unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.1):
- Hintergrund-Cloud-Abgleich bewahrt geöffnete Mitgliederkarten, Suche/Filter,
  gewählten Kriegstag, Plan-Rotationen und zusätzliche Tageswarnungen.
- Fokus auf Mitgliederaktionen und der Einsatzübersicht bleibt beim Neuzeichnen;
  erst ein bewusster Clanwechsel setzt die Ansicht zurück.
- Cloud-Datenformat v9, Rollen, Supabase, Solver und Offline-PWA unverändert.

CLOUD-RELEASE 04.11.2026 (v1.14.0):
- Mehr > CWL-Regeln / Design / Backup / lokale Clanprofile als echte,
  responsive Unterseiten mit Zurück-Navigation.
- Formularwerte und bereits gebundene Aktionen bleiben erhalten: dieselben
  DOM-Eingaben werden zwischen Unterseiten und Zahnrad-Einstellungen bewegt.
- Cloud-Modus: Profil-/Clanverwaltung über Clan & Konto; gemeinsame
  Cloud-Sicherungen direkt aus Backup & Import erreichbar.
- Viewer-Rollen bleiben schreibgeschützt, mobile Buttons mind. 44 px hoch.
- Kein Supabase-Eingriff, kein Reset, keine Änderung am Solver oder
  an der separaten Offline-PWA. Ganzheitlicher UI-Review: Issue #46.

CLOUD-RELEASE 04.11.2026 (v1.13.0):
- CWL-Saison nur noch direkt aus Plan, nicht doppelt unter Mehr.
- Archiv-Runden und Mannschaften schließen bei Live-/Auto-Abgleich nicht mehr.
- Abfragen lassen vorhandene Archiv-Inhalte während des Ladens sichtbar,
  erhalten aufgeklappte Abschnitte und verkraften kurzzeitige Netzfehler.
- Gold-/Dark-/Light-kompatible Listen und Trennlinien statt Kartenstapel.
- Dauerhafte appweite UX-Vorgaben: docs/UX_DESIGN_PRINCIPLES.md und AGENTS.md.
- Keine Cloud-Migration, keine Solver-/Plan-/Archiv-Datenänderung.

CLOUD-RELEASE 04.11.2026 (v1.12.0):
- Aktuelle CWL-Saison aus dem Plan per Direktlink erreichbar, ohne
  Planübersicht und Kriegstag-Schalter zu überladen.
- Korrekte linke Kriegssterne in der vollständigen Gruppenansicht.
- Historisches Gruppenarchiv zeigt unter jedem Kriegstag das eigene Team
  mit Spielern, Rathausstufen, Angriffen und Sternen aus Clash.
- Eigene feste Aufstellungen werden ab Kriegsbeginn separat, geschützt
  und dauerhaft serverseitig gesichert; keine gegnerischen Mitglieder.
- Bestehende archivierte Pläne bleiben erhalten und können als ausdrücklich
  nicht Clash-verifizierter Fallback angezeigt werden.
- Kein Cloudprofil-Reset, keine Solver- oder Offline-PWA-Änderung.

CLOUD-RELEASE 04.11.2026 (v1.11.0):
- CWL-Gruppentabellen und alle bekannten Runden werden nach erfolgreichem
  Live-Abruf automatisch und dauerhaft pro Cloud-Clan und Saison gesichert.
- Mehr > CWL-Archiv zeigt die neue Gruppenhistorie und unverändert die
  bisherigen gespeicherten Aufstellungsarchive.
- Beobachter dürfen lesen, aber keine Archivdaten bearbeiten; bestätigte
  Kriegsergebnisse bleiben gegenüber älteren API-Zwischenständen geschützt.
- Kein zusätzliches Clash-API-Polling, kein Reset des Cloud-Profils und
  keine Änderung am Planungsalgorithmus oder der separaten Offline-PWA.
- Datenbankschema: cwl_group_archives (RLS), Edge coc-cwl-status;
  Details: CHANGELOG.md.

CLOUD-RELEASE 04.11.2026 (v1.10.0):
- Die CWL-Saison-Gruppe zeigt alle bekannten Clans mit vorläufiger Rangfolge,
  bestätigten Siegboni und Ergebnis-Zwischenständen.
- Alle bis zu vier Paarungen jeder CWL-Runde aus dem bereits vorhandenen
  Supabase-Clash-Abruf; unbekannte Kriege bleiben ausdrücklich unbestimmt.
- Keine zusätzlichen API-Calls, keine Speicherung fremder Spielerlisten,
  keine Datenbankmigration; separater Offline-Planer bleibt v1.0.2.
- Historische Gruppenstände folgen nach abgesicherter Snapshot-Speicherung.
  Details: CHANGELOG.md und docs/CWL_GROUP_PHASE2_2026-11.md.

CLOUD-RELEASE 04.11.2026 (v1.9.0):
- Mehr → CWL-Saison mit Gruppe (bekannte Gegner), Runden (eigene sieben
  Kriege) und Clan (echte Angriffe/Sterne/Ø soweit vorhanden).
- Mehr → CWL-Archiv ist nun eine eigene Unterseite; die vorhandenen
  Planungsarchive und die Wiederherstellungslogik bleiben unverändert.
- Vollständige acht-Clan-Gruppentabelle und historische CWL-Ranglisten
  benötigen einen separaten geschützten API- und Archiv-Ausbau (#71).
- Keine Datenmigration, keine Änderung an Supabase, dem Planungsalgorithmus
  oder der separaten Offline-PWA v1.0.2. Details: CHANGELOG.md.

CLOUD-RELEASE 04.11.2026 (v1.8.2):
- Mobiler CWL-Abgleich: kopierbarer, einzeiliger Rein/Raus-Klartext ohne Emojis,
  einheitliche Teamstatus-Anzeigen und passendere Anordnung der Aktionen.
- Teilnehmer und Fixspieler dauerhaft sichtbar; Gold-Tageskopf und Hinweise bereinigt.
- Ausgetretene Spieler schreibgeschützt, mit separater dauerhafter Löschoption,
  bisherige Einstellungen bleiben bis dahin für einen Wiedereintritt erhalten.
- Beobachter sehen einen schreibgeschützten Kader; Ø Sterne je Spieler wieder sichtbar.
- Separate Offline-PWA unverändert v1.0.2, Datenformat v9. Details: CHANGELOG.md.

CLOUD-RELEASE 03.11.2026 (v1.8.1):
- Cloud: Start eines Kriegstags fixiert die tatsächliche Clash-Aufstellung als
  Planungsbasis, auch solange der Krieg noch läuft. „Gespielt“ erst nach Kriegsende.
- API-Wechselabgleich ist die primäre Handlungsanweisung für die Vorbereitung.
  Theoretisches Rein/Raus bleibt im API-Modus nur optional eingeklappt sichtbar.
- Neuer Kopiertext für geprüfte Clash-Wechsel; keine fingierten Wechsel bei
  gespeicherten, nicht aktuellen oder unvollständigen Daten.
- Keine Cloud-Datenmigration, keine Änderungen an bestehenden Spielerprofilen;
  separate Offline-PWA weiterhin v1.0.2. Details: CHANGELOG.md.


CLOUD-RELEASE 03.11.2026 (v1.8.0):
- Gemeinsamer Cloud-Planer \`cloud-app.html\`: v1.8.0 (Cloud-Release mit beidseitiger CWL-Ansicht und geschützter gemeinsamer Planung).
- Separate installierbare lokale Offline-PWA \`index.html\`: weiterhin v1.0.2.
- Flexible CW/CWL-Statistik, 3★-Hit-Rate, verpasste Angriffe und geschützte Gruppenlinks mit Rollen, Laufzeit und Sperren.
- Cloud: vorläufige Tagesaufstellungen beider Clans, Wechselvorschläge gegenüber der
  empfohlenen Planung, Live-Angriffe/Sterne und sicherer Abschluss beendeter Kriege.
- Exakte Einsatzziele, Rotationsstufen, Spielernotizen und geschützte Wiedereintritte
  ohne neue Datenbankmigration. Vorläufige Clash-Aufstellungen ändern den Plan nicht.
- Ohne aktive CWL oder bei API-Ausfall bleibt die bisherige manuelle Planung verfügbar.
- Datenformat v9, Profile, lokale Schlüssel und Archivbestände bleiben kompatibel.
- Neues in v1.8.0: Team- und Gegnerangriffe, sicherer Logout, lokaler Gastmodus und konsistentere Arena-Gestaltung.
- Vollständige Details und technische Grenzen stehen in CHANGELOG.md und
  docs/RELEASE_V1.8.0.md.

Site: https://smolmig.github.io/cwl_planer/

AKTUELLE VERSIONIERUNG (seit v1.0.0):
- Die App nutzt Semantic Versioning (MAJOR.MINOR.PATCH). Cloud: aktuell v1.15.5;
  separate Offline-PWA: v1.0.2.
- Dieser README bewahrt die ursprünglichen Änderungsnotizen mit den damals verwendeten
  Versionsnummern (v1 bis v9.6.1) unverändert als historische Referenz.
- Die chronologische Zuordnung ab Projektbeginn, Release-Regeln und der Umgang mit
  Datenformat/Offline-Cache stehen in VERSIONING.md; neue Releases in CHANGELOG.md.
- Datenformat bleibt 9. Lokale Speicherschlüssel, alte Profile, Archive und Backups
  werden durch die Umstellung der App-Version nicht umbenannt oder zurückgesetzt.

Hinweise:
- Der Cloud-Planer benötigt Internet. Gemeinsame Clanprofile werden online synchronisiert.
- Die separate \`index.html\` speichert lokale Profile auf dem jeweiligen Gerät und
  kann nach dem ersten vollständigen Laden offline funktionieren.
- Für beide Modi stehen JSON-Backups zur Verfügung; lokale und Cloud-Daten bleiben getrennt.

Update v2: 
- iPhone Safe-Area oben korrigiert, damit Titel/Button nicht mehr mit Uhrzeit, Dynamic Island oder Statussymbolen überlappen.

Update v3:
- Tage/Sonderfall-Fenster bleibt nach Änderungen offen.
- Neuer Button „Aufstellung + Wechsel kopieren“ kopiert den kompletten 7-Tage-Plan.

Update v4:
- App startet für neue Nutzer mit leerer Mitgliederliste; vorhandene v1-v3-Daten werden automatisch übernommen.
- Profile/Clans hinzugefügt: erstellen, wechseln, kopieren, umbenennen und löschen.
- Reset leert das aktive Profil jetzt wirklich vollständig.
- Mehrfachauswahl für Mitglieder mit „Alle“, „Keine“, „Ausgewählte löschen“ und „Alle löschen“.
- Mehrere Mitglieder können auf einmal per Textliste eingefügt werden.
- CSV-Vorlage kann heruntergeladen, ausgefüllt und wieder importiert werden (Dabei/Fix/Priorität/Tag1-Tag7).
- Profil-Backup einzeln sowie Komplett-Backup aller Profile möglich.
- „Fehler melden“ öffnet direkt ein neues GitHub-Issue mit technischen Basisinfos, aber ohne Spielernamen.

Update v5:
- Mitgliederlisten-Vorlage vereinfacht: nur noch ein Spielername pro Zeile; Einstellungen erfolgen danach in der App.
- Vorlage verständlicher benannt und direkt in der Datei erklärt.
- Mitgliederliste kann jetzt auch direkt im Mitglieder-Tab importiert werden.
- Mehrfachauswahl erweitert: ausgewählte Mitglieder gemeinsam auf Dabei/Pause sowie Fix/Nicht-Fix setzen.
- „Erst ab Tag …“ und „Raus ab Tag …“ können kombiniert werden und die Auswahl bleibt sichtbar gespeichert.
- Profil-Auswahl enthält unten direkt „+ Neues Profil erstellen…“.
- Frische Nutzer starten weiterhin mit leerem Profil; vorhandene v4-Daten werden automatisch in v5 übernommen.

Update v6:
- Mitglieder-Tab visuell aufgeräumt und Aktionen klar nach Hinzufügen, Listenimport und Mehrfachbearbeitung benannt.
- „Mehrere Mitglieder“ erklärt jetzt ausdrücklich: ein Name pro Zeile, nach jedem Namen Enter drücken; erkannte Namen werden live gezählt.
- Mehrfachbearbeitung übersichtlicher gruppiert: Auswahl, CWL-Teilnahme, Fixstatus und Löschen.
- Buttons eindeutiger beschriftet (z. B. „Mitgliederliste importieren“, „CSV-Vorlage herunterladen“, „Mehrfach bearbeiten“).
- Mitgliederlisten-Vorlage weiter vereinfacht und als „CWL_Mitgliederliste_Eintragen.csv“ klarer benannt; sie enthält keine Beispielspieler mehr, die versehentlich importiert werden könnten.
- Doppelte Mitgliederlisten-Aktionen aus „Einstellungen & Daten“ entfernt; Import und Vorlage liegen jetzt nur noch dort, wo sie hingehören: im Mitglieder-Tab.
- Profil-Auswahl trennt vorhandene Profile sichtbar von „+ Neues Profil erstellen…“.
- Frische Nutzer starten weiterhin vollständig leer; bestehende v5-Daten werden automatisch übernommen.

Update v7:
- Mehrfachbearbeitung und Dark-Mode-Kontrast überarbeitet; helle Flächen mit schlecht lesbarer Schrift beseitigt.
- Hilfe-Funktion ergänzt und Begriffe direkt erklärt: Dabei, Fix, Prio, Rathaus, AUTO/MUSS/RAUS, Sonderfälle, Profile und gespeicherte Tage.
- Neu berechnen gibt jetzt eine kurze, selbst verschwindende Rückmeldung statt eines Popups.
- Am Ende der Mitgliederliste gibt es zusätzlich einen Button zum schnellen Hinzufügen eines neuen Mitglieds.
- Mitglieder-Vorlage lesbarer gemacht, mit UTF-8/BOM für Excel und klarer Schritt-für-Schritt-Anleitung; Datei heißt jetzt „CWL_Mitgliederliste_Vorlage.csv“.
- Mehrere-Mitglieder-Fenster verwendet neutrale Muster-Namen statt Clan-Mitglieder.
- Mehrfachbearbeitung klar von Hinzufügen/Import getrennt und um gemeinsames Setzen von Prio und Rathaus erweitert.
- Optionales Rathaus-Level pro Mitglied ergänzt.
- Mitglieder können nach Name, Rathaus, Priorität oder CWL-Teilnahme sortiert werden; in „Eigene Reihenfolge“ lassen sie sich mit ↑/↓ frei anordnen.
- Prioritätsauswahl verbreitert, damit nach der Auswahl sichtbar „Prio 0–5“ angezeigt wird.
- Bestehende v6-Daten werden automatisch übernommen; frische Nutzer starten weiterhin leer.

Update v8:
- Optionale 3★-Stärke pro Mitglied ergänzt: Oft 3★, Solide / teils 3★, Selten 3★, Normal kein 3★ oder Unbekannt.
- 3★-Stärke kann sortiert und per Mehrfachbearbeitung für mehrere Mitglieder gleichzeitig gesetzt werden.
- Pro Krieg können jetzt eigene Tagesziele für die gewünschte Rathaus-Verteilung und 3★-Stärke festgelegt werden.
- Tagesziele sind bewusst weich: Fix/MUSS/RAUS und gespeicherte Tage haben Vorrang; danach versucht der Planer RH-/Stärke-Ziele zu treffen und hält die übrige Rotation möglichst fair.
- Tageskarten zeigen Zielwerte und tatsächliche Erfüllung direkt an; RH und 3★-Einstufung werden auch bei den eingeplanten Spielern eingeblendet.
- Bestehende v7-Daten werden automatisch übernommen; neue Felder starten neutral (3★-Stärke unbekannt, keine Tagesziele).

Update v9:
- Live-CWL-Workflow überarbeitet: Tage werden chronologisch als GESPIELT bestätigt, das tatsächliche Line-up muss exakt der Kriegsgröße entsprechen und nur der zuletzt bestätigte Tag kann wieder entsperrt werden.
- Bereits gespielte Tage bleiben stabil; vergangene Tagesregeln sind gesperrt und spätere Änderungen berechnen nur offene Tage neu.
- Neue CWL / Planung zurücksetzen direkt im Plan-Tab. Laufende oder abgeschlossene CWLs werden vor dem Neustart als schreibgeschützter Snapshot archiviert.
- Spieler, die bereits an gespielten Tagen eingesetzt wurden, bleiben bei späterem Entfernen in Historie und Einsatz-Verteilung erhalten.
- Einsatz-Verteilung aufgewertet: Rotationsspanne direkt in der Planübersicht, weiterhin konkrete Einsatzanzahlen pro Spieler; Fairness-Badge nur als Zusatzsignal.
- Doppelte Clash-Spielernamen sind erlaubt. Namensdopplungen werden mit ! markiert; optionaler Player-Tag wird zur eindeutigen Zuordnung empfohlen.
- Profilnamen müssen eindeutig sein.
- Tagesziele klar als optionale Gegnerplanung beschrieben; unmögliche Ziele und Konflikte mit Fix/MUSS werden direkt markiert.
- Prio 0–5 praxisnäher erklärt; Mehrfachbearbeitung klarer geführt; RH-Auswahl auf RH3–RH20 angepasst.
- 15er/30er-CWL als schnelle Kriegsgrößen-Presets; individueller Wert bis 50 bleibt möglich.
- Neue leere Mitglieder werden nicht mehr dauerhaft angelegt; Namen dürfen nicht leer gespeichert werden.
- Kopiertexte klarer: gesamter CWL-Plan bzw. Wechseltext; GESPIELT/GEPLANT wird im Gesamttext unterschieden.
- Dark Mode bleibt Standard; Light Mode und Systemmodus können in den Einstellungen gewählt werden.
- Responsive Darstellung für Smartphones, Tablets und Desktop verbreitert/optimiert; optionale Kompaktansicht reduziert lange 30er-Pläne.
- PWA-Update verbessert: Navigation nutzt Network-first mit Offline-Fallback; App-Version und manueller Update-Button ergänzt.
- Backup-Wiederherstellung warnt vor dem Ersetzen aller Profile; Datenformat ist versioniert. Ein lokaler Recovery-Snapshot schützt zusätzlich vor beschädigten gespeicherten Daten.
- Grunddaten werden nach CWL-Start gesperrt, damit keine gemischten 15er/30er- oder Tageszustände entstehen.
- Diverse Dark-Mode-Kontrast-, Safe-Area-, Touch- und Toast-Verbesserungen.

Update v9.1:
- Kompaktansicht zeigt die Namen der Rein-/Raus-Wechsel weiterhin direkt an; nur die vollständige Aufstellung wird eingeklappt.
- Einzelne Mitglieder werden direkt inline im Mitglieder-Tab hinzugefügt; kein Browser-Popup mehr.
- Bei doppelten Spielernamen öffnet das ! direkt die Erklärung und das optionale Player-Tag-Feld. Player-Tags liegen nicht mehr versteckt unter „Tage & Verfügbarkeit“.
- AUTO / MUSS / RAUS sind nun deutlich farbcodiert (blau / grün / rot), gespielte Tage bleiben neutral gesperrt.
- Kleinere Theme-/Kontrastkorrekturen für Warntexte.


Update v9.2:
- Alle Browser-eigenen alert/confirm/prompt-Dialoge wurden durch app-eigene, nicht blockierende Aktionskarten ersetzt.
- Neues optionales Cyberpunk-Theme mit Neon-Akzenten, subtiler Grid-/Sweep-Animation und Reduced-Motion-Unterstützung. Dunkel bleibt Standard; Hell/System bleiben jederzeit auswählbar.
- Datenformat bleibt v9; vorhandene v9/v9.1-Profile und Archive werden unverändert weiterverwendet.

Update v9.3:
- Cyberpunk-Theme technisch entschlackt: keine dauerhaft laufende Grid-, Karten-Sweep- oder Button-Shimmer-Animation mehr; teure Mehrfach-Blur-Effekte entfernt. Der Neon-Look bleibt erhalten, Interaktionen nutzen nur leichte Hover-/Transform-Effekte.
- Neues optionales „Cyberpunk Hell“-Theme mit heller Cyan-/Magenta-Neon-Optik. Dunkel bleibt weiterhin das Standardtheme; alle Themes können jederzeit gewechselt werden.
- Datenformat bleibt v9; vorhandene Profile, Archive und Einstellungen werden unverändert weiterverwendet.


Update v9.4:
- Cyberpunk Dunkel und Cyberpunk Hell visuell deutlich eigenständiger: stärkere Cyan-/Magenta-Neonlinien, statisches Grid/Scanline-Finish, kantigere Panel-/Button-Geometrie, Mono-Typografie für UI-Akzente und klarere Neon-KPIs/Badges.
- Performance-Grundsatz aus v9.3 bleibt: keine dauerhaft laufenden Animationen, kein bewegtes Grid, kein Button-Shimmer und kein flächendeckender Backdrop-Blur.
- Datenformat bleibt v9; vorhandene Profile, Archive und Einstellungen bleiben kompatibel.


Update v9.4.1:
- Cyberpunk-Line-up-Akzente sind nicht mehr dekorativ nach Position verteilt. Alle normalen Spieler verwenden denselben Cyan-Akzent.
- Fixspieler sind im Tages-Line-up jetzt explizit mit einem „FIX“-Badge markiert; im Cyberpunk-Theme erhält nur ein tatsächlich als Fix gesetzter Spieler den Magenta-Akzent.
- Dadurch haben Farbakzente in der Aufstellung eine eindeutige Bedeutung statt zufällig zu wirken.
- Datenformat bleibt v9; vorhandene Profile und Archive bleiben kompatibel.

Update v9.4.2:
- Cyberpunk Hell: Toast-/Kopiermeldungen besitzen jetzt explizit eine dunkle Textfarbe auf hellem Hintergrund. Dadurch sind Meldungen wie „Wechseltext kopiert ✓“ wieder klar lesbar.
- Rein visueller Theme-Fix; Datenformat bleibt v9 und vorhandene Profile/Archive bleiben kompatibel.


Update v9.5.0:
- Mobile CWL-Planung: Tag 1–7 über kompakte Tageswahl aufrufen, statt sieben lange Aufstellungen untereinander durchzuscrollen. Der nächste noch offene Tag wird beim Laden standardmäßig angezeigt.
- Aufstellungen lassen sich am Handy bei Bedarf ein- und ausklappen; Wechsel „rein/raus“, Tagesstatus und Aktionen bleiben direkt sichtbar.
- Mobile Übersicht verkürzt: Grundkennzahlen und übergeordnete Aktionen können über „Aktionen“ aufgeklappt werden. Tablet und Desktop zeigen weiterhin die vollständige Übersicht.
- iPhone-Kopfbereich verschlankt: deckender Header, weniger optische Überlagerung und vereinfachte Statusleisten-Darstellung.
- Bestätigung des tatsächlichen Line-ups: auf Smartphones bildschirmfüllender Dialog mit eigenständig scrollender Spielerliste und dauerhaft sichtbaren Speichern-/Abbrechen-Buttons, inklusive iPhone-Safe-Area.
- Nach Bestätigung des aktuellen Kriegs wird mobil automatisch der nächste Tag ausgewählt. Entsperren zeigt wieder den betroffenen Tag.
- App-/Service-Worker-Version gemeinsam auf v9.5.0 aktualisiert.
- Reine UI-/Bedienungsänderung; Einteilungsalgorithmus und Datenformat v9 bleiben unverändert. Bestehende Profile, gespielte Kriege und Archive werden weiterverwendet.

v9.5.0 – Ergänzung Desktop-Tagesnavigation und Mitglieder-UX:
- Die Tagesleiste ist auch auf Tablet/Desktop sichtbar. Einzeltag und „Alle Tage“ können umgeschaltet werden; Desktop startet mit „Alle Tage“. Antippen eines Tages wechselt zur Einzeltag-Ansicht.
- Die Desktop-Ansichtspräferenz wird ausschließlich in den gerätespezifischen UI-Einstellungen gespeichert; am Smartphone bleibt die Einzeltag-Ansicht aktiv.
- Mitglieder-Tab kompakter: Schnellhilfe einklappbar, Filter nach Name/Player-Tag sowie Dabei/Pause/Fix.
- Jede Mitgliederkarte zeigt Spielername, Dabei/Fix sowie RH, Priorität und 3★-Stärke direkt. Selten benötigte Felder und Tagesregeln öffnen über „Bearbeiten“.
- Mehrfachauswahl „Sichtbare auswählen“ nimmt bei aktivem Filter nur sichtbare Spieler; eine Filterung sperrt vorsorglich den Button für das Löschen des vollständigen Kaders.
- Grundfunktionen (inkl. Member-Reihenfolge, Player-Tags, Regeln, CSV, Backups) und CWL-Einteilungsalgorithmus bleiben erhalten.

v9.5.0 – Mobile Mitgliederliste, zweiter UI-Durchgang:
- Für Smartphones (<700 px) wird die Mitgliederliste als platzsparende Zeilen mit Name, RH, 3★-Stärke, Prio sowie Dabei/Pause- und FIX-Kennzeichnung angezeigt.
- Dabei/Fix-Schalter, RH-/Stärke-/Prioritätsfelder und Tagesregeln werden beim jeweiligen Spieler erst nach „Bearbeiten“ eingeblendet. Am Handy ist jeweils nur ein Bearbeitungsbereich gleichzeitig offen.
- Die Aktionen Mitgliederimport und CSV-Vorlage sind am Handy hinter einem kleinen „Weitere Aktionen“-Menü erreichbar; die Hauptaktionen Hinzufügen/Mehrere bleiben direkt sichtbar.
- Sortier- und Suchleiste wurden auf Mobil verdichtet, die PC-Mitgliederansicht bleibt weitgehend unverändert.
- Keine Änderung der Berechnungslogik, Profile, Datenversion oder des lokalen Speicherschlüssels.

Update v9.6.0 (gemeinsamer Release-Kandidat, inklusive aller v9.5-UX-Änderungen):
- Fairere CWL-Rotation: bei freien Plätzen zuerst Spieler mit weniger bisherigen Einsätzen; bei Gleichstand erhalten Spieler mit weniger zukünftigen Einsatzgelegenheiten Vorrang. Erst danach wirken optionale RH-/3★-Tagesziele und Priorität. FIX/MUSS/RAUS und bereits gespielte Line-ups bleiben harte Regeln.
- Bereits bestätigte tatsächliche Aufstellungen werden für die folgenden Tage neu berücksichtigt. Erklärung der Tagesauswahl über ⓘ an jeder Tageskarte.
- Ab jetzt werden bestätigte Tagesaufstellungen zusammen mit Namen, RH, 3★-Stärke, Fixstatus und Player-Tags als Snapshots gespeichert. Änderungen im aktuellen Kader verändern diese gespielte Tageshistorie anschließend nicht mehr.
- Entfernte eingesetzte Spieler behalten ihren historischen Fixstatus; sie sind beim nachträglichen Korrigieren eines gespielten Line-ups wieder als Kandidaten verfügbar.
- CWL-Archive enthalten alle damaligen Teilnehmer, inklusive Spieler mit 0 Einsätzen, und speichern die verfügbaren historischen Line-up-Snapshots. Alte Archive bleiben lesbar; Daten, die vor diesem Update nie historisch gespeichert wurden, können nicht rückwirkend rekonstruiert werden.
- Einsatzübersicht: tatsächliche gespielte und zukünftige geplante Einsätze getrennt anzeigen. Rotationsspanne bleibt als unbereinigter Rohwert gekennzeichnet.
- Bei vollem/gesperrtem lokalen Speicher blockiert ein fehlgeschlagener Recovery-Snapshot nicht die primäre Speicherung. Misslingt die eigentliche Speicherung, pausieren weitere Schreibversuche und ein Notfall-JSON-Export sowie ein erneuter Speicherversuch werden angeboten.
- iPhone-Querformat (Landscape): niedrigerer Header und Bottom-Navigation, ein einzelner sichtbarer Kriegstag, flachere Tagesleiste und vollhöhenoptimierter Bestätigungsdialog. Mitgliedertab im Querformat kompakter.
- Lange Namen auf mobilen Geräten besser lesbar.
- Version und Service-Worker-Cache auf v9.6.0 angehoben. Datenformat bleibt v9, Speicher-Schlüssel bleibt cwl_planer_mobile_v9.
- Neue Node-Regressionsprüfungen in tests/plan-regression.test.cjs; GitHub Actions führt sie bei Branch-Änderungen/PRs aus. Lokal: node --test tests/*.test.cjs

Vor Freigabe zwingend am echten iPhone als Homescreen-PWA prüfen: Statusleisten-Fade, Landscape, Scrollen/Auswahl mit 15/30 Spielern, Speichern-Button und Offline/Update-Verhalten. Außerdem mit einem separaten Testprofil Fix/MUSS/RAUS, echte gespielte Tage, Korrektur von Tag 1, Archiv inkl. 0 Einsätzen und Backup-Wiederherstellung prüfen.
Wichtig: Bestehende Profile/Archive bleiben kompatibel, aber ohne Backup kein Browserwechsel oder Neuinstallieren der PWA durchführen.

Korrektur für den finalen v9.6.0-Release-Kandidaten (überschreibt frühere Beschreibungen von Tageszielen/Kompaktmodus):
- **Optionale Tagesziele entfernt**: Keine RH-/3★-Ziele mehr je Kriegstag. Der Planer nutzt sie auch dann nicht mehr, wenn sie aus alten Backups noch vorhanden sind. Solche Altwerte bleiben nur aus Gründen der Datenkompatibilität erhalten.
- **Spielerinformationen bleiben**: RH und manuelle 3★-Stärke sind Richtwerte für Mitglieder, Aufstellungen und Sortierung. Sie beeinflussen die automatische Einteilung nicht. Fairness, künftige Verfügbarkeit, Prio und MUSS/FIX/RAUS bleiben maßgeblich.
- **RH-Auswahl mobil über Raster**: Statt des unzugänglichen langen iOS-Dropdowns nun ein eigenes, in der Höhe begrenztes und scrollbar bleibendes Auswahlfenster. Reihenfolge RH19 bis RH3, Option ohne RH. Bei bereits gespeicherten RH20-Spielern bleibt RH20 als Legacy-Auswahl sichtbar und wird nicht überschrieben.
- **RH-Auswahl am Desktop** startet ebenfalls bei RH19 abwärts; Mehrfachbearbeitung entsprechend angepasst.
- **Normal-/Kompaktansicht-Schalter entfernt**. Am PC weiterhin Einzeltag/Alle Tage, am Handy die kompakte Tagesnavigation.
- **Mobile „Aufstellung anzeigen“ gilt für alle Kriegstage** und bleibt beim Tageswechsel aktiv, bis auf einem beliebigen Tag wieder „Aufstellung einklappen“ gedrückt wird.
- **Hilfe und Erklärung der Tagesaufstellung aktualisiert**; keine Referenz auf aktive optionale Tagesziele.
- Neue DOM-Regressionstests für RH-Auswahl, bestehende RH20-Spieler, gemeinsame Aufklappfunktion und entfernte Steuerelemente; insgesamt 16 automatische Tests.
- Live-Version main unverändert. Vor Veröffentlichung noch am echten iPhone in Safari und Homescreen-PWA testen.

v9.6.0 – Zusatzkorrekturen nach Praxistest (Desktop, Mitglieder-Picker, Einsatzübersicht, Landscape):
- Die gemeinsame Aktion „Aufstellung anzeigen/einklappen“ funktioniert nun auch am Desktop. Alle Kriegstage teilen sich denselben Aufklappzustand. Desktop beginnt mit sichtbaren Aufstellungen, Smartphone mit eingeklappten.
- RH, Priorität und 3★-Stärke verwenden auf Smartphones und in schmalen Querformatansichten denselben Auswahldialog mit großen Buttons. Der PC verwendet weiterhin durchgängig native Select-Controls.
- RH weiterhin RH19 abwärts, vorhandene RH20-Werte bleiben erhalten. Priorität 0–5 und alle 3★-Stärkestufen können im gleichen Dialogstil geändert werden.
- Einsatz-Verteilung als kompakte Einträge: G = tatsächlich gespielt, P = noch geplant, Gesamt = Summe. Suche nach Name/Tag und Filter Alle, 0 Einsätze, Bereits gespielt, Noch geplant, Fixspieler. Zwei Spalten auf größeren Bildschirmen, eine dichte Spalte im Smartphone-Hochformat.
- Im Smartphone-Querformat enthält die Mitgliederliste zwei Spalten, auch bei Breiten unter 1000px. Aufgeklappte Bearbeitungsfelder passen sich pro Karte an.
- Automatisierte DOM-Regressionstests decken Desktop-Aufklappen, Auswahl von Priorität und 3★, gefilterte Einsatzstatistik und Querformat-CSS ab.
- Datenformat unverändert v9, GitHub Pages main nicht geändert. Vorschau vor Release auf echtem iPhone prüfen.

v9.6.1 – iPhone Homescreen-PWA / Statusleisten-Korrektur:
- iOS 27 zeichnet bei installierten Web-Apps einen systemseitigen Blur im oberen Statusleistenbereich. Die App kann diesen Betriebssystemeffekt nicht vollständig abschalten.
- Für iPhone-Hochformat im installierten Standalone-Modus wird der Header gezielt um etwa 34 CSS-Pixel weiter nach unten gepolstert, damit Titel/Profil und Hilfe nicht mehr unter dem systemseitigen Verlauf stehen.
- Der Header bleibt deckend (Cyberpunk, Cyberpunk White, Dark und Light). Safari, Querformat, Android und Desktop bleiben von dieser Sonderregel unberührt.
- Die von WebKit als veraltet bezeichnete apple-mobile-web-app-status-bar-style-Metavorgabe und ihre dynamische Änderung wurden entfernt; die Theme-Color-Einstellung bleibt erhalten.
- App-Version und Offline-Cache v9.6.1; Datenformat v9, bestehende Profile und Backups unverändert.
- Nach dem Update auf einem bereits installierten iPhone Homescreen-App testen; iOS kann installierte Statusleisten-Eigenschaften unabhängig vom aktualisierten HTML zwischenspeichern. Keine Website-Daten löschen und die App nicht ohne vollständiges Backup entfernen.
