# #44 – Pilot-Abnahme und Freigabekriterien

Stand 26.11.2026 · PR #359 · **Keine Produktivfreigabe**. Funktionsumfang eingefroren. Referenzstand 36a27ee: 1029/1029 Regressionen, lokaler Auth-UAT und ClashPerk-WebKit-Import grün. Recovery #358 isolierter Replay grün. Offizielle App v1.37.0. Kein Versionssprung für diese Test-/Staging-Vorbereitung. Bei späterer sichtbarer Veröffentlichung MINOR gemäß VERSIONING.md.

## Drei getrennte Prüfstände

1. Portable Demo: GitHub Actions `Strategic CWL browser pilot UAT`, nach erfolgreichem Lauf Artifact `strategic-demo-chromium` oder `strategic-demo-webkit` herunterladen, ZIP entpacken und HTML lokal im Browser öffnen. Ausschließlich fiktive Daten, bestehender isolierter Fixture-Entwurf (nicht komplette integrierte Cloud-Ansicht), kein Login, keine Verbindung, kein Speichern. CSP blockiert externe Abrufe. Kein iOS-Dateivorschau-Nachweis.
2. Integrierter Browser-Test: originales Cloud-HTML mit echten Rechenkernen und synthetischem Host. Chromium und WebKit, Screenshots. Keine echte Cloud-Anmeldung. Separater lokaler Auth-UAT: echte JWT/RLS/Handler mit synthetischer Clash-Antwort. Kein Hosted-Gateway-Nachweis.
3. Gehostetes Staging: aktuelle Metadaten 26.11.: genau ein verbundenes aktives Projekt (Produktion), keine Development-Branches. **Nicht anlegen** ohne konkrete Kostenprüfung und explizite Owner-Freigabe gemäß bestehender Staging-Checkliste. Keine realen Accounts, Daten, Secrets kopieren.

## Testbuild für separates gehostetes Staging (erst nach Freigabe)

Bestehenden fail-closed Builder verwenden: `CWL_STAGING_STRATEGIC=true` zusätzlich zu separater HTTPS-Staging-URL und Staging-Publishable-Key setzen. Siehe [ClashPerk Staging UAT](CLASHPERK_STAGING_RELEASE_UAT_20261113.md). Flag wird nur in die erzeugte Kopie eingefügt, kein produktives Frontend verändert. Kein Auth-Recht durch Frontendflag. Staging-Origin getrennt, niemals Produktionsservice oder Produktionskey; nur synthetische Clans. Serverflag/UUID-Allowlist ausschließlich dort setzen; keine live Clash-Aufrufe ohne separaten freigegebenen API-Zugang. Für aktive CWL kontrollierte Mockdaten im lokalen Auth-UAT; gehostete Liveprüfung bleibt getrennt. Staging muss vor Verwendung den tatsächlichen notwendigen Migrationsstand, RLS/HTTP-Auth, Redirects, Edge-Deployment und Netzwerkrouting nachweisen.

## Manueller Testplan (#213)

| ID | Startzustand / Aktion | Erwartetes Ergebnis | Status |
|---|---|---|---|
| S1 | Owner, nach Saisonende mit altem Plan und Locks, Vorschau öffnen | Alter Plan unverändert, neues Format Annahme | Offen |
| S2 | Teilnahme 15/30, 5/7, Zusage/Absage/offen, Fix-Konflikt | Anzahl plausibel, Konflikt konkret, keine Speicherung | Offen |
| S3 | Alle drei Modi, geringe/keine Form, Kadergrößen | Keine automatische Ausladung, nur belegte Alternativen | Offen |
| S4 | iPhone Safari/PWA, Android/Chromium, Desktop, alle Themes, Tastatur und 200% Zoom | Keine abgeschnittenen Controls, Fokus/Disclosure/Filter sinnvoll | Offen |
| S5 | Owner/Vize/Beobachter, Fremdclan, Logout, Widerruf während Abruf | Nur berechtigter Pilot; alte Ansicht entfernt, keinerlei Planänderung | Offen |
| S6 | Langsame Verbindung, offline, veraltete Phase und wiederholter Refresh | Keine falschen Empfehlungen, verständlicher Status, erneutes Berechnen bewusst | Offen |
| S7 | Netzwerk-/DB-Vorher-Nachher-Vergleich im isolierten Staging | Keine Produktion, Profil/Revisionsdaten unverändert durch Vorschau | Offen |
| S8 | Sprache Deutsch/Englisch und Hilfe | Vollständige verständliche UI; EN-Übersetzung vor allgemeiner Veröffentlichung | Offen |
| L1 | Echte kommende CWL: Anmeldefenster, tatsächlicher eigener registrierter Kader | Keine behauptete Live-Anmeldung, tatsächlicher Kader maßgeblich | Nicht testbar ohne CWL |
| L2 | Live-Vorbereitung, aktueller Gegner, gespielte/gesperrte/fehlende Tage | Nur bestätigte veränderbare Tage, keine in-game Aktion | Nicht testbar ohne CWL |
| L3 | Krieg beginnt innerhalb Vorschaugültigkeit | Vorschau endet spätestens zum Start, kein alter Wechsel | Nicht testbar ohne CWL |
| L4 | Verifizierte Ligapfeile und eigener Gruppen-WarTag, 6/8 Clans | Platzspanne korrekt, Moduswechsel nur mit bestätigter Regel und belegtem Vorteil | Nicht testbar ohne CWL |
| L5 | Unvollständige Angriffe, 8★ erreicht/offen | Mindestens belegte Sterne, keine erfundenen Misses/Prognosen | Nicht testbar ohne CWL |
| L6 | Prospektive, rechtmäßig verfügbare unveränderliche Beobachtungen | Vergleich mit neutraler/roher Baseline, getrennte CW/CWL-Abdeckung | Später |

Nachweis je Schritt: Datum, Commit, Gerät/Browser/Theme, Testrolle, Status OK/Fehler/Nicht testbar, anonymisierte Screenshot-/Notiz. Keine echten Tokens/Clandaten in Artefakten. Fehler in #44/#213 mit reproduzierbaren Schritten, keine pauschalen Erfolgshaken.

## Go / No-Go

- Demo: nur als fiktive Vorschau nach erfolgreicher Browser-CI.
- Hosted Pilot: NO-GO bis getrennte Umgebung, echte Gateway/RLS/Netzwerkprüfung, visuelle Abnahme und Owner-Freigabe. Keine Produktion als Ersatz.
- Allgemeine Freigabe: NO-GO bis Geräte-/Live-CWL-Abnahme, Rechte, Sprache, Modellgrenzen und Freigabe-/Rollback-Protokoll. Kein automatisches Apply vorhanden. Modell bleibt unkalibriert; prospektive Modellvalidierung benötigt gesonderte Datenherkunftsentscheidung.
- Rollback: Testbuild entfernen, Staging-Flag/Allowlist deaktivieren, alte freigegebene App bleibt unverändert. Keine produktive Migration oder Secret-Änderung.


## CI-Nachtrag
f158efd: 1030/1030, Chromium/WebKit je 2/2, Auth und Import-WebKit grün. Portable Demo Artifact 15155212859. Visuelle Nachprüfung 15155976779 ergab WebKit-Dark-Select-Kontrast und gekürzte Kaderoption; Korrektur mit Kontrasttest und Viewport-Aufnahme in neuer CI, noch nicht manuell abgenommen. Keine Änderung des No-Go für Hosted/Produktion.
