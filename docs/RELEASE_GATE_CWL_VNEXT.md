# CWL Cloud vNext – Freigabe- und Datensicherheitsprüfung

**Status:** Vorbereitung, **NICHT zur Produktion freigegeben**. Stand: 2026-11-03. Hauptbranch `main`: Cloud v1.5.2, Commit `b9f901943`.

## Änderungen im Entwurf

- [PR #50](https://github.com/Smolmig/cwl_planer/pull/50): deterministische Mehrtagesplanung, exakte Rotationsziele, drei Gewichtungen, harte Konfliktsperre vor Planfreigabe
- [PR #51](https://github.com/Smolmig/cwl_planer/pull/51): Austritt/Wiedereintritt mit altem Planungszustand, Schutz gespielter Tage, ungültige bzw. ungewöhnlich unvollständige Clanlisten abfangen
- [PR #52](https://github.com/Smolmig/cwl_planer/pull/52): Spielernotizen, API-verwaltete Name/RH-Stammdaten, bestätigter Notfallmodus
- [PR #53](https://github.com/Smolmig/cwl_planer/pull/53): kombinierter Integrationsstand; ausschließlich im Draft-Branch, nicht live

Nur `cloud-app.html` / Cloud-Modul- und Regressionstest-Dateien ändern sich; die Offline-PWA (`index.html`) bleibt eigenständig. Kein neues Supabase-Schema oder Datenformat geplant. Das experimentelle Leistungs-/Gegner-Modell aus #44 bleibt deaktiviert.

## Bereits durchgeführt – nur automatisierte Prüfungen

- GitHub Actions (Syntax, Node-Regressionssuite, Playwright/Chromium) für den Integrationsstand bis Commit `426e2b90c3`: **grün**; auf neueren Commits immer erneut prüfen.
- Synthetische mobile/Desktop-Browserdaten: Karten, Rotation, exakte Ziele, Notizen; API-verwaltete Mitglieder lassen sich ohne Notfallmodus nicht über versteckte Lösch- und Importwege verändern.
- Solver: exakte 4:3 / 5:2 / 6:1 Verteilung, Konflikte 5+5 und MUSS gegen Ziel, gesperrte Tage, 15/30 und weitere Platzgrößen.
- Wiedereintritt, manuelle Änderungen während Abwesenheit, `kept`, Wiederholung und Profil-Klon sowie Notizen/XSS-Escaping getestet.
- Unvollständige/duplizierte Clan-API-Mitgliederlisten blockiert; größere Austrittswelle braucht manuelle Prüfung.
- **Read-only Supabase-Metadatenprüfung 2026-11-03:** Projekt erreichbar; 3 Cloud-Profile und 12 Snapshot-Einträge für 3 Clans, je Clan 2–5 Einträge. Sämtliche abgefragten öffentlichen CWL-Tabellen hatten RLS aktiviert. **0 von 3 Profilen** hatten einen Snapshot mit derselben letzten Revision wie das Profil. Keine Profilinhalte gelesen und keinerlei Daten geändert.

## Go/No-Go – vor dem ersten Live-Merge verpflichtend

- [ ] **Fresh Backup:** Unmittelbar vor Merge eine frische, versionierte Sicherung aller produktiven Cloud-Profile über die vorgesehenen Backup-Funktionen erzeugen; je Clan Zeit, Revision und Ergebnis dokumentieren. Bestehende ältere Snapshots ersetzen keinen verifizierten aktuellen Sicherungsstand.
- [ ] **Recovery-Nachweis:** Backup-Datei/JSON auf Vollständigkeit und sichere Einlesbarkeit außerhalb der Produktion prüfen. Kein produktives Profil für den Test überschreiben. Sicherungsstände bis nach erfolgreichem Release aufbewahren.
- [ ] **Cloud-Rollen:** Owner/Editor/Viewer mit einem ausdrücklich für Tests bestimmten Clan/Profil durchspielen; einschließlich gesperrtem CWL-Plan, Vize-Antrag, Annahme/Ablehnung, Realtime-Konflikt, leerer API und API-Rückkehr. Keine Testschreiboperation an produktiven CWL-Plänen.
- [ ] **Realgeräte:** iPhone Safari und installierte PWA sowie Desktop-Ansichten mit langem Spielernamen, Notiz, Arena/Gold, leerem Kader, RH-Karten und geöffneten Tagesregeln prüfen. Synthetisches Chromium ersetzt keinen echten WebKit-Test.
- [ ] **Planungs-Freigabe:** Bestätigen, dass ein Konflikt `ok:false` weder Tagesbestätigung noch Freigabe noch Editor-Vorschlag auslöst; gespielte Tage und Profile/Backups dabei unverändert.
- [ ] **API-Kader:** Weggang/Wiedereintritt, erhaltene Pause, Änderungen in Abwesenheit und Massenaustrittswarnung auf einem kontrollierten Testprofil nachvollziehen; Notfallmodus nach API-Ausfall ausdrücklich bestätigen und wieder verlassen.
- [ ] **Aktualität & Review:** `main` erneut mit Draft-PRs vergleichen, diff/Dependencies prüfen, CI für den **letzten Release-Commit** grün. **PR #45 nicht blind mergen.** #46 ausschließlich nach Abhängigkeitsprüfung bearbeiten.
- [ ] **Versionierung:** Cloud-`APP_VERSION`, `cloud-version.json`, `cloud-sync.mjs?v=...` und abhängige Modul-Bust-Parameter konsistent ändern, Release-Notiz ergänzen. Offline-PWA Cache-/Version unverändert.
- [ ] **Nachverfolgung:** Sofort nach Deployment Lade-/Syntaxfehler und Plan-Konfliktanzeigen prüfen, Cloud-Revisionen nur lesend verifizieren und Rollback-Möglichkeit bestätigen. Keine automatische Datenmigration.

## Release-Reihenfolge

Bevorzugt kleine, nachvollziehbare Änderungen statt ungesehen alle PRs zu mergen: erst unabhängige Kader-Sicherungen/#51, dann globale Planung/#50, danach Notizen/Notfallmodus/#52 – jeweils gegen den aktualisierten `main` testen. PR #53 dient als Integrationsreferenz; Konflikte im gemeinsam bearbeiteten `cloud-app.html`/`cloud-sync.mjs` bei jedem Schritt sorgfältig zusammenführen. **Keine zwei getrennten Implementierungen derselben Funktionen doppelt mergen.**

**Stand dieses Dokuments ist kein Freigabesignal.** Exakte Backups und kontrollierte Rollen-/WebKit-Prüfung sind noch offen. Die produktiven Clan-/CWL-Daten müssen bis dahin unangetastet bleiben. Siehe Hauptissue #49 sowie #44 und #46.
