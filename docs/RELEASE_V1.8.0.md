# Cloud v1.8.0 – gemeinsamer Release-Kandidat

Stand: 03.11.2026. Vor dem Live-Merge bleibt `main` auf **v1.7.0**. Enthält den getesteten gemeinsamen Draft [#67](https://github.com/Smolmig/cwl_planer/pull/67), aufgebaut aus #62, #64 und #65.

## Nutzerfunktionen
- Im CWL-Livetag **Unser Team links und Gegnerteam rechts**, auf dem Smartphone untereinander. Beide zeigen X/15 Angriffe, offizielle Kriegssterne sowie Einzelangriffe mit Sternen, Prozentwert, Rathaus und Ziel, falls die Clash-API diese Daten liefert. Vorbereitungsphase zeigt ausdrücklich nur vorläufige Listen.
- Mobiler Konflikthinweis wieder lesbar; lokale Gastaktionen und Mehrfachimport funktionieren ohne Supabase-Modul; lokale Profil-Erstellen-/Umbenennen-Fenster im Vordergrund; „Alle Tage“ zeigt wieder alle Tage. Wiederholte Warnungen je Tag gruppiert.
- **Konto-Menü mit Abmelden** direkt im Header. Bei abgelaufener Session lokales Logout möglich; bei ungespeicherten Änderungen vorher Backup und Bestätigung.
- Arena: zusammengehörige Editorial-Überschriften auf den Haupttabs und ruhigerer Lichtakzent statt geometrischem Wasserzeichen. Übrige Themes behalten ihre Haupttypografie.

## Daten-, Rechte- und Cache-Schutz
- Kein Supabase-/RLS-/Edge-Funktions-Deployment, keine Produktiv-Schreibtests, keine Änderung an CWL-Algorithmus, Clash-Backend, Benutzerrechten oder Kriegshistorie.
- **`DATA_VERSION=9`, `STORAGE_KEY=cwl_planer_mobile_v9`, Cloud-Profile/Snapshots und JSON-Backups bleiben kompatibel.**
- `APP_VERSION` und `cloud-version.json` auf **v1.8.0**; Cache-Busting an `cwl-planning-core.js`, `cloud-sync.mjs`, dessen vier Modulimporten und `cwl-live-core.mjs` einheitlich `v=1.8.0`.
- Die **separate Offline-PWA `index.html` bleibt v1.0.2**, inklusive Service Worker/Cache unverändert.

## Prüftore vor Veröffentlichung
1. Aktuellen Main-Commit und PR-Diff verifizieren: keine Supabase-Migration, kein `index.html`, `service-worker.js`, `cwl-planning-core.js`, kein Datenformatwechsel.
2. Vollständige Unit-/JSDOM-/Chromium-Regressionssuite auf **dem letzten Release-Commit** grün; besonders Gast-Modus ohne Cloud-Modul, lokaler Mehrfachimport, Profilfenster, „Alle Tage“, mobiler Konflikt, abgelaufene Auth-Session, Backup bei Logout sowie beide CWL-Seiten.
3. Die Tests müssen Dark, Light, Cyber, Cyber Light und Arena und Breiten 320/390/768/1366 px umfassen, außerdem Vorbereitung ohne fiktive Angriffe.
4. Echte Konto-/Rollen-/Einladungs-/Recovery-Prüfung und iPhone-Safari-/Desktop-Sichtprüfung als **separate manuelle Abnahme kennzeichnen**, solange nicht ausgeführt. Synthetische Browser-Sitzungen beweisen keine echte Supabase-Sitzung.
5. Erst nach bewusster Freigabe nach `main` mergen; GitHub Pages, Main-Regression und Git-Release/Tag verifizieren. „Live“ erst behaupten, wenn die Auslieferung bestätigt ist.
6. Teil-Drafts #62/#64/#65/#67 erst nach erfolgreicher Publikation als durch den gemeinsamen Release ersetzt schließen – **nicht separat mergen**.

## Rückfall
Bei kritischem Fehler **Code-only Revert mit neuer Versions-/Cachekennung**. Keine produktiven Cloud-Profile, Revisionszähler, Snapshots, Memberlisten oder CWL-Archive zurücksetzen. Die Speicher- und Datenformat-Keys nicht verändern.

Nachfolgeaufgaben: #46 weitere UI-Details und sicherer Legacy-Demo-Cleanup, #44 optionales Stärkemodell weiterhin deaktiviert.
