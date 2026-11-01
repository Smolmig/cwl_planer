# ARENA WEEKVIEW V2 – Cloud-Testoberfläche
Stand: 1. November 2026

## Einstieg
- **Cloud-ARENA-Preview:** https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-preview.html
- **Live unverändert:** https://smolmig.github.io/cwl_planer/cloud-app.html
- **Testbranch:** https://github.com/Smolmig/cwl_planer/tree/preview/arena-weekview-test

## Was geändert wurde
Eigene **Cloud**-Testoberfläche auf Basis der produktiven `cloud-app.html` (nicht mehr nur der Offline-App):
- Eigene Navigation Plan / Mitglieder / Analyse / Mehr und Zugang zu Clan-Statistik.
- Kompakte Hero-Fläche, sieben klar strukturierte Wochenkarten, reale Tageszahlen und Aufstellungen über den vorhandenen Planungsalgorithmus.
- Einstellungen neu gegliedert: Clan & Konto, Planung, Darstellung, Sicherungen, Weitere Optionen – bestehende Formulare und Handler wurden verschoben, nicht neu erfunden.
- Mitglieder- und Analysebereich optisch vereinheitlicht, Dialoge im ARENA-Design.
- Responsive Hell- und Dunkelmodus.

Relevante Dateien: `cloud-arena-preview.html`, `arena-cloud-v2.css`, `arena-cloud-v2.js`, `arena-cloud-loader.mjs`, `cloud-sync-arena.mjs`. Keine Datei auf `main` verändert.

## Sicherheitsgrenze
Der Test läuft auf einer **eigenen URL**. Die Testseite lädt keine produktive Supabase-Verbindung.
- `cloud-sync-arena.mjs` verwendet ausschließlich Laufzeitwerte der gesonderten Staging-URL und Publishable Key.
- Die Staging-Verbindung kann im Bereich **Mehr → Clan & Konto** hinterlegt werden.
- Die *produktive* Supabase-URL wird in UI und Loader ausgeschlossen.
- Ohne Staging-Verbindung können Oberfläche und lokale Planungsfunktionen ausprobiert werden. **Das ist noch kein vollständiger Cloud-Test**.
- Für echtes Mehrbenutzer-Testing wird ein eigener Supabase-Branch/Projekt benötigt; Supabase verlangt für die Anlage ggf. die Freigabe kostenpflichtiger Compute-Ressourcen. Kein Branch wurde erzeugt.

**Nicht** den Produktiv-Cloud-Zugang als Staging-Werte eintragen, keine Service-Role-Keys eingeben. Auf Staging neue Testkonten und Testclans verwenden. Auth-Redirect-URLs für die Vorschau erlauben und ggf. Edge Functions/Secrets von Staging kontrollieren.

## Verifikation
Codevergleiche:
- `cloud-app.html` auf `main` unverändert.
- Sämtliche bisherigen statischen Element-IDs in `cloud-arena-preview.html` erhalten.
- Kernfunktionen des lokalen CWL-Planers und Original-Cloud-Modul bleiben erhalten (Staging-Modul enthält lediglich umgestellte öffentliche Konfigurationswerte).
- JS-Syntax lokal geprüft.

**Noch offen:** Visuelle Regression der Cloud-Preview im echten Safari/Chrome, Login mit Staging, Cloud-Auto-Sync, gemeinsame Bearbeitung, Berechtigungen, Versionierung, Clan-Statistik, Live-CWL, Export/Restore, PWA und Einladungen. Lokales Browser-Testsystem verweigert Seitenaufruf; kein End-to-End-Erfolg behauptet.

## Abnahmeliste
- [ ] Mobil: keine Überschneidungen bei 320/390 px, Header und Bottomnav bleiben benutzbar.
- [ ] Wochenkarten erreichbar; aktiver Tag, Status, Anzahl, Einzeltag und alle Tage.
- [ ] Mitglieder: Suche, Filter, Regeln, Fix, Priorität, RH/3★, Import, Mehrfachbearbeitung.
- [ ] Cloud: Testbenutzer registrieren, anmelden, abmelden, Einladung und Rollen.
- [ ] Cloud: eigenen Testclan erstellen, Mitglieder via Clash synchronisieren.
- [ ] Cloud: 2 Browser und 2 Testkonten, Änderung wird synchron übernommen, konfliktfrei.
- [ ] Tagesziele, Lineups, Sperren und CWL-Archiv.
- [ ] Analyse, aktuelle Kriege, CW/CWL-Statistik und CWL-Live.
- [ ] Cloud-Sicherungen, lokale Exporte, Wiederherstellung nur auf Staging.
- [ ] Einstellungsunterseiten – ALLE Buttons erreichbar, ohne verschobene Modal-Footer.
- [ ] Farbschema, 320/390/768/1024/1440 px, iOS Safari.
- [ ] Cloud-Offline-Verhalten, Logout/Reload, Passwortreset.
- [ ] Core-Ergebnisse alter/neuer Oberfläche mit identischen Testdaten vergleichen.

**Go-Live bleibt gesperrt**, bis sämtliche Cloud- und Offline-Regressionstests bestanden sind.
