# ARENA WEEKVIEW – UX V7, 02.11.2026
**Aktuelle Testversion:** https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-ux-v7.html

Dies ist eine **isolierte Sandbox** mit fiktivem Testclan; die produktive GitHub-Pages-App und Supabase bleiben unverändert.

## Problemursachen und deren Korrektur

### 1. Einstellungen
- Der Profil-Selektor wurde in der alten Version per `prepend` **vor** die Unterseiten-Zurücknavigation gerendert. Dies war die Ursache für das visuell unlogische „Aktives Profil → Zurück → Clanprofile“.
- Neues `ar6-subnav` mit unauffälligem Zurück-Pfeil statt Standardbutton-Hintergrund.
- Die Unterseiten `Clan wechseln` (Profil auswählen) und `Profile verwalten` (Anlegen, Kopieren, Umbenennen, Löschen) sind jetzt **zwei getrennte Ansichten**, nicht mehr doppelte Links.
- Die Settings-Übersicht und die Unterseite haben ein exklusives `hidden`-/`display`-Verhalten und horizontale Übergangsanimation. Die ursprünglichen echten Eingabefelder verbleiben mit identischen IDs und Eventhandlern.

### 2. Plan – Tagesentscheidungen zuerst
- Die wichtigsten **Rein-/Raus-Spieler mit Namen** liegen jetzt in einem eigenständigen Block **direkt unter den Kriegstagskarten** und über der Aufstellung; Tag 1 zeigt sinnvollerweise den Hinweis „Startaufstellung“.
- Warnungen direkt unter den Wechseln.
- Speichern / Bearbeiten / Entsperren / Wechseltext kopieren sind **direkte Aktionen der eigentlichen CWL-Funktionen** `openLineupModal`, `unlockDay`, `copyChanges`, abhängig vom Tagesstatus und der Reihenfolge.
- Line-up darunter als einklappbare Liste.
- Der zusätzliche ausklappbare Block „Erweiterte Tagesfunktionen“ ist **entfernt**; das Original-`planDays` bleibt als verdeckte Kompatibilitätsstruktur im DOM, damit vorhandene Funktionen und Eventhandler nicht verschwinden.
- CWL-weite Verwaltungsaktionen und Einzeltag/Alle-Tage befinden sich in einem separaten kleinen Abschnitt **CWL verwalten**. Keine zweite sichtbare Liste aller alten Tageskarten.
- Die initiale Auswahl beginnt beim nächsten noch nicht gespielten Tag (im Demo-Profil Tag 3).
- Kein Hover-Lift, keine Skalierung; aktive Wochentage wechseln nur Farbe und Kontur.

### 3. Mitglieder – Aufgaben statt Funktionen durcheinander
- Im normalen Kader: Mitglied hinzufügen, CSV-Import, Mehrfachauswahl, Info-Symbol, **Sortierung**, **Suche** und **Statusfilter**. Der Filter ist wirklich nur ein Filter.
- Die Erklärung zu Dabei/Fix/Priorität öffnet sich nur über das Info-Symbol.
- „Weitere Möglichkeiten zum Hinzufügen“ enthält nur mehrere Namen und CSV-Vorlage, nicht Sortierung und Mehrfachbearbeitung.
- Originale Buttons bleiben als verdeckte Funktionsbrücke im DOM und werden von den neuen, klaren Aktionen ausgelöst.
- Bei echter Staging-Anmeldung erscheint ein eigener Bereich „Clash-Clan abgleichen“, nicht unter dem normalen Statusfilter.
- Mehrfachbearbeitung wird in der ARENA-Farbgebung dargestellt; vorhandene Massenaktionen bleiben.

### 4. Statistik
- Die vom Nutzer zuletzt als sauber bestätigte Tabellen-/Kennzahlenstruktur bleibt unverändert.
- Historische Angriffswerte bleiben ausdrücklich fiktiv; die eigentliche Einsatzanalyse stammt aus dem Planer.

## Technische Grenzen
- **Bestanden (statische Prüfung):** JS-Syntax; CSS-Klammerstruktur; die ursprünglichen statischen HTML-IDs; echte `calculatePlan()` im Sandbox-HTML; getrennte lokale Speicherschlüssel; keine Verbindung zur produktiven Cloud-Datenbank.
- **Noch offen (Browser-/Regressionstests):** Sichtprüfung und Klickpfade in iPhone Safari / Desktop / verschiedenen Bildschirmgrößen; vollständiger Test jeder neuen Tagesaktion und aller Backup-/Importvarianten gegen den echten Stand; Cloud-Anmeldung/Realtime/Statistik mit eigener Supabase-Staging-Instanz.
- `main` ist unverändert. Kein Merge ohne explizite Freigabe.

## Konkrete Abnahme
1. **Mehr → Profile wechseln:** Nur die Profil-Auswahl erscheint mit sauberem Zurück-Pfeil über der Unterseite; anschließend **Profile verwalten** separat testen.
2. **Plan → Tag 3:** Unter der Kriegswoche sofort Rein/Raus mit Namen, darunter einklappbare Aufstellung. Gespielten Tag bearbeiten, letzten entsperren, Wechsel kopieren.
3. **Mitglieder:** Suche und Statusfilter ohne sachfremde Optionen. CSV-Import, Mehrfachauswahl und Info separat; Massenänderung wirklich auslösen.
4. **Statistik:** Tabellen und Prozente nach CW-/CWL-Filter korrekt formatiert.
5. **Browser-Reload:** Änderungen im lokalen Testprofil bleiben erhalten, produktive App unverändert.
