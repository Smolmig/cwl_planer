# ARENA WEEKVIEW – gefüllte Funktions-Sandbox

Stand 02.11.2026. **Nur im GitHub-Testbranch `preview/arena-weekview-test`.**

## Direkt ausprobieren

**[ARENA WEEKVIEW – vollständige Testansicht mit Beispieldaten](https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-sandbox.html)**

Die Seite lädt beim ersten Öffnen automatisch einen synthetischen Testclan mit fiktiven Namen. Alle regulären Eingaben erfolgen über die echte CWL-Planungsoberfläche und ihren ursprünglichen Algorithmus, nicht über den ursprünglichen visuellen Demo-Prototyp.

## Vorkonfigurierte Demodaten

- Profil „United Fighters · DEMO“: **49** synthetische Spieler, **45** davon nehmen teil, **8** Fixspieler.
- RH 15–19, 3★-Stärke, Prioritäten, Player-Tags, Erst-ab/Raus-ab, MUST/OUT-Tagesregeln.
- **7 Kriegstage à 15 Spieler**, davon die ersten zwei als gespielt gespeichert; übrige Tage werden mit Originalalgorithmus berechnet.
- Tagesziele für RH und 3★-Stärken.
- Eine vollständig gefüllte Test-CWL als **Archiv** (Oktober 2026).
- Synthetische historische **CW/CWL-Angriffe** (470 Einträge) nur für die Statistikvorschau. Filter CW/CWL, Suche, Hit-Rate, verpasste Angriffe, Sortierung.
- Die Einsatz-/Rotationsanalyse wird aus den tatsächlich berechneten Line-ups erzeugt, nicht aus simulierten Statistikwerten.
- Über „Demodaten zurücksetzen“ kann das fiktive Profil gezielt auf Ausgangsstand zurückgesetzt werden. **Achtung: überschreibt Änderungen in der Sandbox**, nicht die Live-App.

## Sicherer Speicherbereich

In `cloud-arena-sandbox.html` sind bewusst separate lokale Speicher-Keys gesetzt:
- `cwl_arena_sandbox_profile_v1`
- `cwl_arena_sandbox_recovery_v1`
- `cwl_arena_sandbox_ui_v1`

Es wird keine Migration aus den alten `cwl_planer_mobile_v*`-Keys versucht. Die Live-App unter `smolmig.github.io` wird dadurch nicht verändert. Auch unter der Preview-Domain gibt es durch die neuen Keys keine absichtliche Übernahme des früheren Teststandes.

## Welche Funktionen sind echt?

Der komplette bisherige Inline-Code der produktiven `cloud-app.html` ist weiterhin enthalten; nur externe Test-CSS/JS-Dateien, isolierte Speicher-Keys und die Staging-Cloud-Konfiguration wurden ergänzt. Originale Element-IDs und die CWL-Berechnung sind unverändert.

Echte Funktionen des lokalen Planers umfassen u. a.:
- Mitgliederverwaltung und -bearbeitung, RH, 3★, Fix, dabei, Prioritäten, Tagesregeln.
- Teilnehmer suchen, filtern, sortieren und mehrfach bearbeiten.
- 15/30/individuelle CWL, 1–7 Kriegstage, Tagesziele, Sperren und manuelle Aufstellung.
- Berechnungen für Rotation/Fairness, Ein-/Auswechslungen und Warnungen.
- Profile, Archive, JSON-Export/Import, Recovery- und Speicherfunktionen.

**Nur Demo:** Historische Angriffsstatistik, kein Zugriff auf die Clash-API, keine realen Spieler-/Kriegsergebnisse.

**Noch nicht voll testbar:** Cloud-Anmeldung, Cloud-Speicherung, Rollen, Einladungen, Clanabgleich, Live-CWL und echte CW/CWL-Statistik. Dafür benötigt die Vorschau eine gesonderte kostenpflichtig sein könnende Supabase-Staging-Instanz. Die Produktionsdatenbank wird explizit blockiert. Keine Staging-Instanz wurde erstellt.

## Behobener UI-Fehler

Ausgewählte Wochentagskarten werden beim Tippen und Hover nicht mehr um -2px verschoben. Die Wochenleiste erhält etwas vertikales Innenpadding. Geprüft per Chromium Fixture-Smoketest bei 320, 390, 768, 1024 und 1440 Pixeln: kein abgeschnittener Tag, kein horizontaler Seitenüberlauf und keine JavaScript-Fehler.

## Verifikation

- [x] JavaScript-Syntax der Testdaten geprüft und CSS ohne Parsing-Fehler.
- [x] Die Testseite enthält alle ursprünglichen HTML-Element-IDs der produktiven Cloud-App.
- [x] `calculatePlan()` und der ursprüngliche CWL-Kern weiterhin vorhanden.
- [x] Frische Demo: 49/45/8, zwei gespielte Tage, 1 Archiv, 470 simulierte Angriffe.
- [x] Fixture-Tests: Tageswechsel, 2 Einstellungsgruppen, Einstellungen-Unterseiten, Mitgliederliste, Analyse, Filter CW/CWL und Suche, 320–1440 px.
- [x] Live `main` unverändert.
- [ ] **Echter vollständiger Cloud-End-to-End-Test noch offen**. Fixture-Tests sind nicht gleich einem getesteten Cloud-Login.
- [ ] Regression aller Edit-/Import-/Export-/Sperr-/Backup-Fälle mit der gesamten echten Cloud-Anwendung noch offen.
- [ ] iOS Safari, Offline-/PWA-Installation, mehrere echte Nutzer und Realtime vor Live-Merge abnehmen.

## Schutzmaßnahmen

Nur dem Testbranch Dateien hinzufügen und niemals ohne explizite Freigabe in `main` mergen. Keine produktiven Clans, Auth-Daten oder Secrets als Testdaten verwenden. Für Cloud-Staging stets eigene Accounts/Clans verwenden. Bei Teamtests kenntlich machen, dass der **Sandbox-Demodatensatz nur im jeweiligen Browser** liegt.
