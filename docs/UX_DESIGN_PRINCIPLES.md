# CWL Planer – dauerhafte UI/UX-Leitlinien

**Status:** Verbindlicher Projektstandard für neue Features, Änderungen und Reviews. Stand: 04.11.2026.
**Gilt für:** gesamte Cloud-App (Plan, Mitglieder, Einsätze, Statistik, Mehr, Konto, CWL-Saison & Archiv), lokale Offline-PWA, Smartphone und Desktop, Gold-/Dark-/Light-Themes. Abweichungen nur mit bewusstem und dokumentiertem Grund.

## Der Merksatz

> **Zeige das Wichtige zuerst, gruppiere mit Abstand statt mit Kästen, und ändere niemals ungefragt das, womit jemand gerade arbeitet.**

## 1. Informationsarchitektur & Navigation

- Täglich relevante Aktionen und aktuelle CWL-Informationen gehören in den zugehörigen Haupt-Workflow. Seltene Verwaltung, historische Daten, Import/Export und Kontoeinstellungen gehören unter „Mehr“.
- Ein Feature hat **einen primären Einstieg**; Duplikate in mehreren Menüs nur bei echtem, belegbarem Bedarf. Beispiel: aktuelle CWL-Saison unter „Plan“, alte Saisons unter „Mehr → CWL-Archiv“.
- Haupttabs bleiben stabil; Unterseiten führen mit einem klaren Zurück-Ziel dorthin zurück, von wo sie sinnvoll geöffnet wurden. Keine unerwarteten Sprünge im Scrollbereich.
- Relevante Statuswerte (z. B. aktiver Tag, tatsächlich spielende Teilnehmer, Datenstand) sichtbar und verständlich, nicht hinter generischen „Aktionen“ verstecken.

## 2. Visuelle Hierarchie: Flächen statt Kartenstapel

- **Standard für lange, gleichartige Daten: Liste, Tabelle, Zeilen + Trennlinien.** Keine Karte um jede Zeile. Nutze großzügige Abstände, Überschriften, Schriftgewicht und wenige dezente Trennlinien für Hierarchie.
- **Karte nur dann**, wenn ein inhaltlich eigenständiges, gemischtes Objekt oder ein fokussierter Dashboard-KPI wirklich als Gruppe wirken soll. Vermeide insbesondere „Karte > Karte > Karte > Karte“ und einheitliche Rahmen für alles.
- Pro Seite möglichst nur **eine starke Container-Ebene**. Untergeordnete Runden/Teams/Spieler erhalten eher Zeilen und subtile Trenner; einzelne Highlights über schmale Akzente statt vollflächige Dekoration.
- Nutze das Gold-Theme als kontrollierten Akzent, nicht als überall sichtbare Einfassung. Klare Kontraste und Lesbarkeit in allen Themes sind wichtiger als Zierlinien oder Hintergründe.
- Maximal zwei bis drei sichtbare Hierarchieebenen in einer Ansicht; bei tieferem Detail besser eine Unteransicht/Disclosure verwenden.

### Einstellungs-Unterseiten: ein Rahmen genügt (05.11.2026)

- Desktop: Einstellungs-Unterseiten dürfen **einen gemeinsamen ruhigen Inhaltsrahmen** haben; innere Gruppen mit Weißraum oder feinen Trennlinien, nicht mit weiteren Karten.
- Smartphone: Dieselben Inhalte **ohne äußeren Rahmen**, mit klaren Überschriften, guter Lesbarkeit und ausreichend großen Touch-Flächen.
- Gold und Cyberpunk dürfen responsive Regeln nicht durch alte Theme-Spezifität überschreiben. Versionshinweise sind normale Inhalte statt einer Karte in der Karte.
- Installationsanleitungen für iPhone, Android und Desktop jederzeit anwählbar, unabhängig vom besuchten Gerät; keine aufdringliche Installationsmeldung.

### CWL-Sternenziel und unverbindliche Empfehlungen (05.11.2026)

- **8 Sterne** sind die offizielle Grenze für die **volle reguläre Ligamedaillen-Belohnung**, nicht für den zusätzlich verteilten Anführerbonus.
- Im Live-Plan nur aus den tatsächlichen, aktuellen CWL-Angriffen abgeleitete Sterne zeigen; fehlende, doppelte oder alte Daten nicht als 0 oder garantiert interpretieren. Mehrfach angegriffene Gegnerbasen ohne sichere Zuordnung als Unsicherheit behandeln.
- Künftige Einsätze ermöglichen maximal drei weitere Sterne je Angriff, keine sichere Prognose. Konkrete Tauschtage nur bei von Clash bestätigter Vorbereitung zeigen; bei unbekanntem Kriegstag keine scheinbar ausführbare Wechselanweisung. Für exakte Einsatzziele, Fix, Muss, Raus, gespielte und laufende Kriege **keine Änderung oder Vorschläge gegen harte Regeln**.
- Sternenziel-Hinweise bleiben **read-only** und erhalten geöffneten Zustand bei Live-Refresh. Automatische Umverteilung, Stärkeprofile und Ziel-RH-Prognosen nur im separat getesteten Experiment.
- Zurück-Schaltflächen für Unterseiten von „Mehr“ auch unter **Clan & Konto** auf Smartphone unterhalb der Überschrift links und mit mindestens 44 px Touchfläche anordnen.

## 3. Verhalten und Aktualisierungen: Kontext erhalten (HARTE REGEL)

- **Auto-Refresh darf niemals geöffnete Bereiche schließen.** Bewahre expandierte Saison-, Runden-, Team-, Filter- und Einstellungsbereiche mit **stabilen fachlichen Schlüsseln** (Clan + Saison + Tag + Spieler bzw. vergleichbare ID).
- Während einer Aktualisierung dürfen **Scrollposition, Fokus, Auswahl, eingegebene Formulare, aktive Tabs, Suchtext und offene Menüs** nicht ohne notwendige Benutzeraktion verloren gehen. Kein Ganzseiten-Reset nur für einen neuen API-Wert.
- Bei Live-Updates **inkrementell DOM/Knoten aktualisieren**; wenn ein Rerender unumgänglich ist: vorher UI-State sichern, nachher synchron wiederherstellen. Kein flackernder „Lädt …“-Ersatz für bereits sichtbare Inhalte. Eine dezente `zuletzt aktualisiert`-Angabe reicht meistens.
- Bei bewusstem Clanwechsel/Saisonwechsel darf der sichtbare Kontext kontrolliert zurückgesetzt werden, aber fremde alte asynchrone Antworten dürfen niemals im neuen Clan erscheinen.
- Abgeschlossene CWL-Kriege, tatsächlich gestartete Tagesaufstellungen und bereits bestätigte Daten sind nicht von vorläufigen API-Antworten zu überschreiben. Quellen/Zustände sauber trennen.
- Nicht automatisch im Hintergrund navigieren oder Scrollposition zurücksetzen. Bei laufender Interaktion **keine überraschenden Strukturänderungen**.
- Beim Austausch langer Listen den sichtbaren Datensatz über eine **stabile ID als Scroll-Anker** erhalten (nicht pauschal dieselbe Pixelposition oder automatisch die erste Zeile anzeigen). Nur für echte Hintergrund-Updates; bewusste Filter/Sortierung darf das Ergebnis passend neu positionieren.
- Ein Overlay wie die Einstellungen darf beim Öffnen und Schließen die Scrollposition des darunterliegenden Haupttabs nicht verändern. Mobile Bottom-Navigation und Desktop-Sidebar geometrisch unterscheiden.

## 4. Progressive Offenlegung mit Gedächtnis

- Die zuerst sichtbare Zeile beantwortet den primären Bedarf (z. B. Runde, Gegner, Sterne, Status). Details wie einzelne Spieler und Angriffe nur bei explizitem Aufklappen.
- Zusammenklappbare Bereiche haben verständliche Labels, passende Chevron-Drehrichtung, ausreichend große Touch-Flächen und Tastaturfokus. **Geöffnet bleibt geöffnet** bis der Nutzer es selbst schließt oder bewusst die Datengrundlage wechselt.
- Wenn möglich offene Unterbereiche (z. B. Team in Runde 1) auch bei Refresh erhalten. Beim nächsten aktiven Aufruf kann Zustand innerhalb der laufenden Ansicht beibehalten werden; persistente Speicherung nur, wenn explizit sinnvoll.

## Installierbarkeit und Startziel (Cloud / Offline strikt trennen)

- Cloud und lokale Offline-PWA sind **zwei unterschiedliche Installationsidentitäten**: Cloud-HTML verlinkt `cloud-manifest.webmanifest` mit `id` und `start_url` auf `./cloud-app.html`; lokales `index.html` verlinkt ausschließlich `manifest.webmanifest` mit `start_url: "./"`.
- Installations-Hinweise müssen klar sagen, welche Variante geöffnet wird. **Nicht** zwei HTML-Einstiege mit demselben Manifest verknüpfen. Android Chrome/Firefox Home-Screen-Verhalten testen.
- Bestehende installierte Startbildschirm-Icons ändern sich nicht automatisch bei einem Manifest-Fix; kein automatisches Entfernen des Offline-Caches oder fremder lokal gespeicherter Profile. Bei manueller Deinstallation vorher Backup empfehlen.
- **Installieren ohne Nerven:** Unter „Mehr“ jederzeit eine plattformgerechte Anleitung anbieten, statt auf jedem Seitenaufruf ein Popup zu erzwingen. iOS kann `beforeinstallprompt` nicht; Safari benutzt „Teilen → Zum Home-Bildschirm hinzufügen“. Kleine Hinweise nur in passendem Kontext und mit dauerhaft speicherbarer Ablehnung.
- Native installierbare Android-Browser-Prompts nicht durch ein eigenes `preventDefault()` unterdrücken. Bereits installierte App via `display-mode:standalone` bzw. `navigator.standalone` erkennen und Installationshinweis ausblenden.

## 5. Mobile zuerst, Desktop gezielt erweitern

- Smartphone zuerst testen: 320, 375/390, 430 px und iPhone Safari. Dazu Tablet/Browserspanne und 1366+ px Desktop.
- Kein horizontaler **Seitenscroll** durch Tabellen; breite Tabellen dürfen in ihrem eigenen Container horizontal scrollen. Lange Clannamen lesbar halten; Sterne/Zahlen mit tabellarischen Ziffern.
- Bedienelemente mit ausreichend großen Treffflächen (Richtwert rund 44 × 44 CSS-Pixel für wichtige Touch-Aktionen), erkennbarem aktivem Zustand und klaren Beschriftungen.
- Desktop nutzt verfügbaren Platz, z. B. Sidebar, sinnvoll breitere Spalten und weniger unnötige Karten; nicht einfach ein hochskaliertes Mobil-Layout.
- Animationen kurz, funktional und reduzierbar via `prefers-reduced-motion`. Kein ruckeliger Full-List-Rerender bei jedem Poll.
- **Low-End-Performance:** Lange Spieler- und Statistiklisten ohne teure Einzelkartenschatten, fixierte Verlaufshintergründe oder nicht notwendige Whole-List-Rerender; nur Elemente im sichtbaren Bereich zeichnen, wenn dies die Scrollposition nicht verschlechtert.
- Geschlossene Historien-/Detailbereiche erst beim aktiven Öffnen mit vielen Einträgen füllen; Filter und Live-Updates verwenden unveränderte DOM-Zeilen und Berechnungen möglichst wieder.
- Regressionen synthetisch in 320/390/1366px prüfen; reale schwache Büro-PCs und iPhone Safari bleiben ein separater Praxistest, nicht durch synthetische FPS-Versprechen ersetzen.

### Aktions-Typografie und Touch-Flächen (05.11.2026)

- Lesbare **Textschaltflächen** als Standard: mobile wichtige Aktionen ungefähr **13–14 CSS-px**, Hauptnavigation möglichst **11–12 CSS-px** statt unter 10 px; Desktop-Sekundäraktionen mindestens 13 px, sofern Platz vorhanden.
- Nicht einzelne Buttons auf 9–10 px schrumpfen, nur damit ein langer Text in eine Zeile passt: natürliche Mehrzeiligkeit, flexible Breite und `min-width:0` verwenden. Bei Bedarf zwei Reihen statt gequetschten Labels.
- Primäre Touch-Targets in Hauptabläufen ca. **44 CSS-px** hoch; bewusst kompakte Badge-/Info-/Icon-Elemente und kurze Querformat-Ansichten nicht pauschal aufblasen.
- Bei Anpassungen Nav-Labels, CWL-Tagesaktionen, Mitgliederaktionen und Statistik-Kontrollen zusammen prüfen (320/375/390/430 px; Gold, Cyberpunk, Hell/Dunkel) und Desktop-Sidebar unverändert funktional lassen.
- Typografie getrennt von dekorativen Zierelementen testen: nur tatsächlich klickbare Aktionsbeschriftungen priorisieren, nicht KPI-/Tabellen-/Statuswerte.

## 6. Texte und Zustände

- Deutsche, kurze, klare Begriffe für Clanmitglieder ohne Entwicklerwissen. Benenne die **Wirkung** einer Aktion („Wechseltext kopieren“) statt generischer interner Begriffe („Abgleich kopieren“).
- Datenherkunft und Status sichtbar unterscheiden: „Clash · Aufstellung fix“, „Läuft“, „Vorbereitung“, „Archivierter Plan · nicht mit Clash bestätigt“.
- **Unbekannt ≠ 0**. Keine fiktiven Sterne, Platzierungen, Kriegsresultate oder Spielerleistungen.
- Gute Empty States mit Ursache und nächstem sinnvollen Schritt; keine Dauer-Fehlermeldung beim normalen Laden.
- Farben unterstützen die Bedeutung; nicht allein auf Grün/Rot/Gold verlassen. Status zusätzlich als Text.

## 7. Cloud, Sicherheit und Datenpflege

- Beobachter dürfen lesen, **nicht bearbeiten**; gesperrte Aktionen gar nicht anbieten oder eindeutig deaktivieren. Keine UI-Aktion auslösen, die nur wegen RLS mit Fehler scheitern kann.
- Keine ungeprüfte Datenmutation im Zuge eines reinen UI-Redesigns. Laufende CWL-Pläne, Fixspieler, Freigaben, Archive und Accountdaten sind tabu, sofern nicht ausdrücklich beauftragt.
- Auth, Clanwechsel, Speicherung, RLS und Automatik unabhängig testen. Reconnect/Refresh darf Nutzerinteraktionen nicht zurücksetzen.

## 8. Verbindliches UX-Review vor jedem Merge

1. **Warum ist dieses Element hier?** Operativer Inhalt versus Verwaltung; keine doppelten oder versteckten Einstiege ohne guten Grund.
2. **Ist der Rahmen nötig?** Wenn ein Abstand, Abschnittstitel oder Trenner genügt: Rahmen entfernen.
3. **Was passiert beim Live-Refresh?** Offene Details, Tab, Filter, Fokus und Scroll bewahren; Testfall mit geöffneter mehrstufiger Ansicht.
4. **Kann ein Beobachter dies sicher sehen?** Rollencheck, keine versteckten Schreibaktionen.
5. **Passt es auf 320–430 px und Desktop?** Keine abgeschnittenen Namen/Zahlen, sauberer Gold-/Dark-/Light-Kontrast.
6. **Versteht es jemand ohne App-Vorwissen?** Präzise Texte, verlässliche Zustandslabels, klares Feedback.
7. **Sind Daten und Planung geschützt?** Kein ungeplanter Reset, keine neuen Sync-Schreibfehler.
8. **Gibt es einen passenden Regressionstest?** Layout, Navigation, API-Zustände und UI-State nach Hintergrundrefresh.

## Referenzen und Herleitung

Dies sind praktische Designprinzipien für *unsere* App, kein wörtlicher Abdruck externer Richtlinien:

- Apple Human Interface Guidelines – [Lists and Tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables): textlastige Daten als scannbare Reihen/Tabellen, klare Hierarchie und Feedback.
- Apple Human Interface Guidelines – [Design](https://developer.apple.com/design/human-interface-guidelines): klare visuelle Hierarchie, plattformgerechte Bedienung.
- [Queensland Government Design System – Cards](https://www.design-system.health.qld.gov.au/components/card/tabs/overview): Karten für eigenständige Inhalte, nicht als Ersatz für geordnete Tabellen und zusammenhängende Texte.
- [Nielsen Norman Group – Accordions](https://www.nngroup.com/articles/accordions-on-desktop/): progressive Offenlegung bewusst und mit verständlicher Struktur einsetzen.

**Dieses Dokument ist bei jeder künftigen GitHub-/Supabase-/UI-Entwicklungsrunde vor dem Umbau zu berücksichtigen.**
