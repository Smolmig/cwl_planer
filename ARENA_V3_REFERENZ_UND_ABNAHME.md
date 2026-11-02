# ARENA WEEKVIEW V3 – Referenzabgleich und Abnahme
Stand: 02.11.2026 · TESTBRANCH `preview/arena-weekview-test`

## Verbindliche Referenz
Die am 02.11. vom Nutzer gezeigten vier ursprünglichen WEEKVIEW-Konzeptansichten gelten als Designvorgabe (nicht die späteren V1/V2-Screenshots der Cloud-Version).

1. **Plan:** „Sieben Tage. Ein starkes Team.“ als charakterstarker, aber ruhiger Hero mit Goldkontur und dezentem Rathaus-Line-Art; vier Kennzahlen; große horizontale Karten für Kriegstag 01–07; darunter die tatsächliche Tagesaufstellung.
2. **Mitglieder:** Kaderüberschrift, eine klar sichtbare Hinzufügen-Aktion, Suche, schlanke tabellarische Spielerzeilen mit Avatar/Name/RH/Fix, Edit-Details erst nach Interaktion.
3. **Einsatzanalyse:** Kompakte aus echten Planungsdaten berechnete Balken und ein separates Fairnessfeld; darunter volle bisherige Detailauswertung inkl. Filter.
4. **Clan & Einstellungen:** Einstieg über **zwei ruhige Menügruppen** (Clanprofile und Planung & Daten) mit Pfeilzeilen. Unterseiten enthalten die bestehenden Bedienelemente statt alle Einstellungen gleichzeitig. Cloud & Konto und erweiterte Optionen sind extra erreichbar.

## Umsetzung V3
- Cloud-Fassung `cloud-arena-preview.html`, nicht die lokale `index.html`, als Grundlage.
- CSS `arena-cloud-v3.css` und DOM-Presentation-Layer `arena-cloud-v3.js`.
- Originale Felder und IDs bleiben erhalten, komplette Inline-Planungslogik unverändert; die CSS- und JS-Schicht ändern die Informationshierarchie.
- **Settings:** original `settingsCloudAccount`, `localProfileCard`, `slotsPreset`, `daysInput`, `settingsAutoRoster`, `themeSelect`, `importFile`, `exportAllBtn`, `archiveList` und weitere Controls werden in Unterseiten umgehängt, nicht nachprogrammiert.
- **Members:** originaler `renderMembers` erzeugt und bindet weiterhin alle Events; UI rückt existierende Teilnahme-/Fix-Schalter in die ausklappbaren Details.
- **Analyse:** kleine zusätzliche Visualisierung aus realem `state` und `lastPlan` ohne erfundene Beispiele. Bestehende Auswertung und Clan-Statistik behalten ihre IDs und Logik.
- **Cloud:** ursprüngliches Cloud-Modul ist in der Preview durch staginggebundene Variante ersetzt. Kein automatischer Verbindungsaufbau zur produktiven Supabase-Datenbank.

## Was tatsächlich geprüft wurde
- [x] Neue JS-Datei besteht Node-Syntaxprüfung.
- [x] CSS besteht tinycss2-Parsing ohne Syntaxfehler.
- [x] GitHub-Branch enthält neue JS/CSS und Testseite verweist auf V3.
- [x] Keine originale HTML-Control-ID aus `cloud-app.html` in der Testseite entfernt.
- [x] `cloud-app.html` auf `main` unverändert.
- [x] Keine Staging-Verbindung zum Supabase-Produktivprojekt.
- [ ] Visuelle Screenshot-Differenzprüfung der **vollständigen V3-Cloud-Seite** auf 320/390/768/1440px. Die Browserumgebung hier konnte Chromium nicht erfolgreich starten; nicht als bestanden ausgeben.
- [ ] Interaktionsprüfung im echten iOS-Safari und Desktop-Chrome: Plan, Wochentage, Unterseiten, Dialoge, Tastatur.
- [ ] Cloud-Test im zweiten Browser mit zwei echten Staging-Konten inkl. Zugriff/Rollen, Realtime-Synchronisation und Backup.
- [ ] Rechen-Regression des neuen UI gegen die produktive Cloud-App mit identischen Daten.
- [ ] Finale Cross-Browser-/Barrierefreiheitsprüfung (Kontrast, Fokus, PWA, Safe Areas, langes Member-Namensfeld, 30/50 Slots).

## Cloud-Sandbox
Eine eigene Supabase-Staging-Instanz wurde **noch nicht erzeugt**, weil Supabase einen ausdrücklichen Kostenentscheid verlangt. Ohne Staging funktionieren nur lokale UI-/Planungsversuche und nicht die echte Multiuser-Cloud-Synchronisierung.

## Rollout-Sperre
Nichts nach `main` mergen, keine Änderungen an produktiver Supabase-Datenbank. Alle oben offenen Tests müssen abgeschlossen und vom Nutzer abgenommen sein, bevor ein Live-Rollout erwogen wird.

## Links
- [V3-Testseite](https://raw.githack.com/Smolmig/cwl_planer/preview/arena-weekview-test/cloud-arena-preview.html?v=3)
- [Testbranch](https://github.com/Smolmig/cwl_planer/tree/preview/arena-weekview-test)
