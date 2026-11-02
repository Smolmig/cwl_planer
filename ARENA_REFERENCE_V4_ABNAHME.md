# CWL ARENA WEEKVIEW – Originaltreue und Teststatus
Stand: 02.11.2026 · isolierter Branch `preview/arena-weekview-test`.

## Verbindliche Designquelle
Die vom Nutzer direkt bereitgestellte Datei **`overview(1).html`** und die vier Screenshots sind die visuelle Referenz – nicht die früheren farblich umgestalteten Cloud-Entwürfe. Die Referenz enthält echten HTML-/CSS-Quellcode für Plan, Kader, Analyse und Einstellungen. Die reine Vorlage ist eine Demo und enthält keine Cloud-/Planer-Logik.

## Aktueller Testzugang
[Neue ARENA-Cloud-Testoberfläche](https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-final-test.html)

**Die alten Preview-URLs leiten auf die aktuelle Seite weiter.** Neue Dateinamen und Cache-Buster reduzieren das Risiko, dass Safari ein früheres Layout lädt.

## Was tatsächlich umgesetzt wurde
1. **Header:** Kompaktes Logo „CWL / Planer“ + ARENA · WEEKVIEW, Staging-/Konto-Zugang und Hell/Dunkel. Der alte Cloud-Header wird im Test nicht mehr mit angezeigt.
2. **Woche:** Referenz-Hero „Sieben Tage. Ein starkes Team.“, Rathaus-Strichillustration, vier KPI-Karten, Status-Pill, horizontale 01–07-Karten.
3. **Tagesdetails:** Eigenständige Spielerzeilen und Teambericht aus `state`/`lastPlan`. Die ursprünglichen Tageskarten verbleiben zusammen mit Sperr-/Entsperr-, Ein-/Auswechsel- und Kopieraktionen unter „Erweiterte Tagesfunktionen“. Über die dortigen Buttons ist auf Mobil die Alle-Tage-Ansicht zugänglich.
4. **Mitglieder:** Einzeilige Kaderliste mit Nummer/Avatar/Name/RH/Status; Tippen öffnet **die bisherige** Mitgliederbearbeitung, nicht einen funktionslosen Demodialog. Zusätzliche Import-, Sortier- und Massenaktionen liegen in einem ausklappbaren Abschnitt.
5. **Analyse:** Balkendiagramm und Rotationskarte aus **echten** Planwerten. Ursprüngliche Detailfilter und Statistiken bleiben erreichbar.
6. **Einstellungen:** Die originale Übersicht mit zwei Karten („Clanprofile“ und „Planung & Daten“), je drei Menüzeilen. Jeder Eintrag öffnet eine Unterseite mit dem entsprechenden **originalen** Formular/Steuerelement. Cloud/Konto und weitere Optionen separat und dezent untergeordnet.
7. **Cloud:** Cloud-Tests verwenden unverändert den Cloud-App-Kern. `cloud-sync-arena.mjs` wird aber nur geladen, wenn eine **andere, explizit eingerichtete Supabase-Staging-Datenbank** vorhanden ist. Die Produktionsdatenbank wird hier nicht verbunden.

## Schutz vor Feature-Verlust
- `cloud-app.html`, `cloud-sync.mjs` und weitere `main`-Dateien sind nicht geändert.
- Der Quelltext der neuen HTML-Testseite ist bis auf die Test-Asset-Einbindungen, die eigene Staging-Konfiguration und das deaktivierte Test-Service-Worker-Registrieren identisch zum produktiven Cloud-App-Quelltext.
- Alle ursprünglichen statischen HTML-IDs sind erhalten. Interaktive Komponenten sind als zusätzliche UI-Schicht mit vorhandenen Handlern verknüpft.
- Die Referenzvorlage zeigt Demo-Spieler. In der Test-App werden die Karten stattdessen aus echten lokalen Planungsdaten erzeugt.

## Tatsächlich geprüfte Punkte
- [x] Originallayout aus der hochgeladenen HTML-Datei geladen und visuell verglichen.
- [x] HTML-Differenzprüfung gegen `main`, ursprüngliche IDs und Berechnungs-Code erhalten.
- [x] JavaScript Syntaxprüfung, CSS Parsing.
- [x] Browser-Smoke-Tests einer DOM-/Daten-Fixture auf 320/390/768/1024/1440 px: keine JS-Fehler, kein horizontales Überlaufen.
- [x] Fixture: Navigation in Plan/Mitglieder/Mehr, Tagesauswahl, Alle-Tage-Ansicht, Einstellungen-Unterseiten, Spieler-Detailöffnung.
- [ ] **Noch keine vollständige Browserintegration der echten 260-KB-Cloudseite** auf iPhone Safari/Android/Desktop bestätigt. Das Fixture-Testresultat ist kein vollständiger End-to-End-Test.
- [ ] Echtes Cloud-Login, Testclans, Rollen, Einladung, Synchronisierung, Konfliktbehandlung und Realtime mit getrenntem Supabase-Staging.
- [ ] Berechnungsregression mit 15/30/individuell und 1–7 Tagen, Tagesregeln, Fix/Priorität, Sperren/Entsperren, Warnungen, Archiv, Backups.
- [ ] Live-CWL, Clanabgleich, CW/CWL-Statistiken, Mehrfachbearbeitung, Offline/PWA und Speicher-/Recovery-Fälle.
- [ ] iOS-Tastatur, iPhone Safe-Areas, Drehung, lange Spieler-/Clannamen, Accessibility und Kontrast testen.

## Einschränkungen
**Die Vorschau ist noch keine verifizierte gemeinsame Cloud-Testumgebung.** Supabase Staging wurde nicht erstellt, weil das unter Umständen Compute-Kosten verursacht und eine ausdrückliche Freigabe benötigt. Vorher sind nur Darstellung und lokale Planungsabläufe testbar. Bitte keine produktiven Cloud-Zugänge als Staging verwenden.

## Nächste Freigabestufe
Screenshots auf dem Nutzer-iPhone ansehen und konkrete Abweichungen korrigieren, danach separate Staging-Instanz freigeben und Cloud-End-to-End-Regression durchführen. Merge nach `main` erst nach ausdrücklicher Abnahme.
