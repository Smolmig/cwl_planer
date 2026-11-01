# ARENA WEEKVIEW – Testversion
Stand: 01.11.2026 · **Branch** `preview/arena-weekview-test` · **Live-Version `main` bleibt unverändert.**

## Direkt ausprobieren
[Web-Testversion](https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/index.html)

Die Testseite wird über einen externen HTML-Proxy bereitgestellt. Dort erscheint gegebenenfalls zuerst eine Sicherheitsbestätigung. Die Testseite läuft unter einer **anderen Web-Domain als GitHub Pages**, deshalb teilt sie keinen lokalen Browser-Datenstand mit der Live-App. Sie ist keine offiziell eigenständige Hosting-Umgebung. Für Tests mit vertraulichen Daten empfiehlt sich ein selbst gestarteter lokaler Webserver.

[Kompletten Branch als ZIP herunterladen](https://github.com/Smolmig/cwl_planer/archive/refs/heads/preview/arena-weekview-test.zip)

## Technische Umsetzung
- Produktive `index.html` unverändert als Kern beibehalten. Im Testbranch sind lediglich ein CSS-Link und ein JS-Link ergänzt.
- `arena-theme.css`: ARENA WEEKVIEW mit Dunkel/Hell, Goldakzent, responsive 7-Tage-Karten, schneller Mobilansicht, einheitlichen Cards/Modalen.
- `arena-shell.js`: 4. Navigationsbereich **Mehr**, Clans/Archive/Grunddaten/Backup dorthin versetzt, mobile Wochenleiste, Text und Status am echten Datenmodell, Hell/Dunkel-Schnellschalter.
- Keine Änderung an `calculatePlan()`, `renderMembers()`, `renderSummary()`, Profildatenformat, Import-/Exportlogik, Archive, Schlossregeln oder Service-Worker-Datei.
- Alte Farbschemata werden nur in dieser Testoberfläche auf Dunkel/Hell abgebildet. Andere Benutzer-Einstellungen sind unverändert.
- Bei Aufruf über raw.githack wird der Service Worker wie bereits im Quellcode vorgesehen **nicht** registriert. Offline-/Installationsverhalten daher separat unter localhost testen.

## Vor dem Test
1. Auf der **Live-App** zuerst unter Backup ein **vollständiges JSON-Backup** aller Clans erstellen.
2. Die Testversion öffnen und zunächst mit Testspielern ausprobieren.
3. Bei Bedarf das eben erstellte Backup **nur in die Testversion** importieren. Live-Daten werden dadurch nicht verändert.
4. Einen eigenen Testplan durchspielen. Für paralleles Live-/Testarbeiten die zwei Domains nicht verwechseln (TESTVERSION im Kopf).
5. Vor Freigabe die folgenden Szenarien mit den gleichen Startdaten in alter und neuer App vergleichen.

## Funktionale Abnahme – noch von Clanleitung zu testen
- [ ] Neues Profil erstellen, umbenennen, duplizieren, wechseln und sicher löschen.
- [ ] Einen Spieler hinzufügen, mehrere gleichzeitig importieren, Duplikate erkennen.
- [ ] Bei Spielern Teilnahme, Fix, Priorität 0–5, RH 3–20, 3★, Player-Tag einstellen.
- [ ] Erst ab / Raus ab prüfen – inklusive Grenztagen.
- [ ] AUTO / MUSS / RAUS über alle 7 Tage setzen.
- [ ] Tagesziele für RH und 3★ ändern; den berechneten Plan mit der Live-App vergleichen.
- [ ] CWL mit 15 Spielern, 30 Spielern und individueller Größe bis 50 planen.
- [ ] Eine CWL mit weniger als 7 Kriegstagen planen (1–7).
- [ ] Einzelansicht und Alle-Tage-Ansicht umschalten, alle Tage auf Mobil erreichen.
- [ ] Ein Line-up bearbeiten, Tag als gespielt speichern und erneut öffnen.
- [ ] Sperr- und Entsperrlogik, Reihenfolge der Kriegstage sowie Warnhinweise prüfen.
- [ ] Rein/Raus und Gesamten Plan kopieren; kopierte Texte vergleichen.
- [ ] Mitgliedersuche, Filter, Sortierung, manuelle Reihenfolge prüfen.
- [ ] Mehrfachauswahl: Dabei/Pause, Fix, Prio, RH, 3★, Löschen und Bestätigung.
- [ ] Analyse: Einsätze, Rotation/Fairness und Filter prüfen.
- [ ] Archiv anlegen, vergangene CWL schreibgeschützt ansehen.
- [ ] Einzelprofil- und Komplettbackup exportieren, JSON unverändert wieder importieren.
- [ ] Nach Browser-Reload alle Änderungen unverändert erhalten.
- [ ] Fehlender Speicherplatz / Recovery-Banner anhand einer Testumgebung prüfen.
- [ ] Hell-/Dunkelmodus auf Smartphone und Desktop; Alttheme-Abbildung.
- [ ] Offline/PWA/Update **lokal** unter isoliertem localhost/HTTPS testen.
- [ ] iPhone Safari (PWA und Browser), Android Chrome, Desktop-Chrome/Firefox/Edge.
- [ ] Kein verdeckter Save-/Abbrechen-Button, keine horizontalen Überläufe, gut lesbare Statusfarben.

## Bisherige Prüfung
**Bestanden:**
- Quelltextvergleich: die komplette bisherige Core-App ist im Testbranch bytegenau erhalten (nur zwei Asset-Einbindungen ergänzt).
- Alle vorhandenen statischen Element-IDs und Funktionen sind im Kern weiterhin enthalten.
- Service Worker und Datenformat wurden nicht verändert.
- Syntaxprüfung der neuen JS-Schicht.
- Browser-Smoketest einer DOM-nahen Testfixture bei 320/390/768/1024/1440 px: Navigation, Tageswahl, Themenwechsel, keine JS-Fehler und kein horizontaler Überlauf.

**Noch nicht bewiesen:** Die oben aufgeführte vollständige Regression aller Businessfunktionen im echten Browser mit einem realen Clan-Datensatz und tatsächlicher PWA-/Offline-Installation. Das ist der Zweck dieser Testversion.

## Sicherheit und Rollout
- `main` nicht verändern und den Testbranch nicht automatisch mergen.
- Vor Freigabe vorhandene Backups und Rechen-Ergebnisse mit identischen Testdaten vergleichen.
- Nach Korrekturen erneut die Kernfunktionen prüfen.
- Erst nach positiver Abnahme den Code für einen gesonderten Live-Rollout vorbereiten.
