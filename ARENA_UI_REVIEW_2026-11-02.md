# ARENA WEEKVIEW – UI-Review / 02.11.2026

## Aktuelle Testversion
[Cloud-ARENA mit isoliertem Demo-Clan](https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-ui-review.html)

Verwendet das **echte** `cloud-app.html`-Planermodell, den unveränderten `calculatePlan()`-Algorithmus sowie die bisherige Mitglieder-, Profil-, Archiv- und Backup-Logik. Historische Angriffswerte bleiben als Demo markiert. Cloud-Anmeldung und gemeinsames Speichern sind weiterhin mangels separater Supabase-Staging-Datenbank deaktiviert. **Produktivsystem `main` und produktive Cloud unverändert.**

## Aus konkretem Benutzerfeedback korrigiert

### Clan & Einstellungen
- Übersicht und Unterseiten sind jetzt exklusiv: `home` und `setHead` werden beim Öffnen einer Unterseite ausgeblendet.
- Unterseiten haben eine kurze horizontale Übergangsanimation und den sichtbaren Zurück-Pfeil. Escape führt zur Einstellungsübersicht zurück.
- Vorhandene Controls wurden nicht kopiert oder ersetzt, sondern behalten ihre IDs und Handler.
- Fixiert: Die ursprüngliche Einstellungsübersicht blieb wegen `display:grid` trotz `hidden` sichtbar.

### Tagesplanung
- Die reale `dayPlans[d].rein`- und `.raus`-Differenz steht direkt unter der Tagesüberschrift, mit getrennten Ein-/Auswechslungsfarben und Teilnehmernamen.
- Tag 1: Hinweis auf Startaufstellung statt erfundener Wechsel.
- Etwaige Warnungen werden direkt angezeigt.
- Direkte Tagesaktionen: als gespielt speichern, vergangenes Line-up bearbeiten, letzten Tag entsperren, Wechsel kopieren – jeweils nur wenn der ursprüngliche Handler dies erlaubt.
- Die Spielerliste ist durch einen beschrifteten Bereich auf- und einklappbar.
- Alte Tageskarten sind visuell verborgen und dienen lediglich als verknüpfte Original-Handler. Weitere Werkzeuge und CWL-Gesamtoptionen bleiben separat erreichbar.
- Kein `translateY`, `scale` oder außerhalb der Karte liegender Fokusumriss bei aktiven/hovernden Kriegstagskarten.

### Mitglieder
- „Filter“-Button entfernt: die echte Suche und Statusauswahl sind bereits sichtbar.
- Direkte, eindeutige Aktionen: „CSV-Import“, „Mehrfachauswahl“, kleines Hilfe-Symbol.
- Sortierauswahl bleibt zugänglich; mehrstufige Import-/Zusatzfunktionen sind unter „Weitere Importmöglichkeiten“.
- Die Massenbearbeitung erhält neutrale ARENA-Flächen und goldene Interaktionskontraste statt tiefblauer Alt-Styles.
- Die ursprünglichen Eingabefelder, Mehrfachaktionen und Bestätigungen bleiben funktional verknüpft.

### Clan-Statistik
- Simulierte Kennzahlen und Filter erhalten eigene responsive Grid-Stile.
- Tabellenwerte bleiben in Spalten; auf schmalen Displays fällt die separate Spalte „Verpasst“ weg, der Wert ist in der Desktop-Ansicht verfügbar.
- Hit-Rate ist berechnet als `3★-Angriffe / tatsächlich durchgeführte Angriffe`. Die Daten sind und bleiben **fiktiv**.

## Prüfstatus
**Statisch geprüft**: Neue JavaScript-Datei kompiliert syntaktisch, CSS-Klammern ausgeglichen, sämtliche originalen statischen HTML-IDs erhalten, ursprünglicher `calculatePlan()` vorhanden, Sandbox-Speicherschlüssel getrennt, produktiver Cloud-Client nicht eingebunden.

**Noch zu testen:** komplette Browser-Sichtprüfung auf iOS-Safari und Desktop; jeder Tages-/Regel-/Sperren-/Backup-Pfad mit realistischen Testdaten; Tastatur- und Fokusnavigation, horizontale Scrollleiste bei schmalen Geräten; vollständige Cloud-End-to-End-Tests (Anmeldung, Berechtigungen, gemeinsamer Edit, Realtime, Clanabgleich, Statistik) auf einer tatsächlich getrennten und freigegebenen Supabase-Staging-Instanz.

## Empfohlene Kurzprüfung
1. **Plan:** Tag 1–7 wechseln, Rein/Raus prüfen, Line-up ausklappen, Tag als gespielt speichern, letzten gespielten Tag entsperren.
2. **Mitglieder:** Suche, Statusfilter und Sortierung; Hilfe-Symbol; CSV importieren; Mehrfachauswahl und 2–3 Änderungen.
3. **Analyse:** Einsatzbalken/Fairness und Clan-Statistik (CW/CWL filtern, Hit-Rate/Spalten bei klein und groß).
4. **Mehr:** Clanprofile, CWL-Grunddaten, Backup & Wiederherstellung, Darstellung & Hilfe öffnen und wieder zurückkehren.
5. **Persistenz:** Änderungen durchführen, Reload, unveränderte Werte. Vor jedem Test mit manuellem Backup arbeiten.

Kein Merge nach `main` ohne Freigabe.
