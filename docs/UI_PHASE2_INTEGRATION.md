> **Fortführung:** Die UI-Integration dieses Dokuments wurde am 03.11.2026 in den gesonderten **Cloud-v1.7.0-Release-Kandidaten** übernommen. Die Versionsangaben weiter unten dokumentieren weiterhin den damaligen Draft-Stand. Die Freigabekriterien stehen in [RELEASE_V1.7.0.md](RELEASE_V1.7.0.md). Noch kein Live-Merge.

# UI Phase 2 – integrierter Draft (03.11.2026)

## Ausgangslage
Produktiv auf `main`: Cloud v1.6.0, Commit `59f761561300dc98ad170d910ec4be4f770950bd`, DATA_VERSION v9. Während der laufenden CWL keine ungefragten Live-Merges, Cloud-Schreibtests oder Schemaänderungen.

Dieser Integrationsbranch startet vom **vollständigen PR #57** und übernimmt die isolierten, bereits einzeln geprüften Änderungen aus **PR #58 und #59**:
- #57: `Mehr → Hilfe & Sicherheit`, `Mehr → Clan & Konto` als echte Seiten. Login/Passwort-Reset bleiben Dialoge; Rechte-, Einladungs- und Backup-Handler unverändert, Versions-Neuladen pausiert auf der Kontoseite.
- #58: Mitgliedersuche wird auf 85 ms gebündelt. Bearbeiten, Tagesregeln und Duplikatdetails aktualisieren nur die betroffene Spielerkarte; keine unnötigen Listen-Neuaufbauten.
- #59: Bildgrößen und der lesbare RH-Fallback stimmen zwischen Mitglieder- und Statistikansicht überein. Anbieter-CDN statt GitHub-Raw für RH1–18; Arena-Karten ohne mehrfach geschachtelte Hintergründe.

## Prüfung der Zusammenführung
- `cloud-app.html`: Der originale, nicht bearbeitete Mitgliederlistenabschnitt aus #57 wurde durch den kompletten Abschnitt aus #58 ersetzt. Anschließend wurden ausschließlich die Rathaus-Renderfunktion und die zusätzlichen CSS-Styles aus #59 eingefügt. Die Unterseiten / Navigation von #57 wurden nachweislich nicht überschrieben.
- `cwl-stats.mjs` und dessen vorhandener Test zum Bilderhost stammen aus #59; alle neuen Einzeltests aus #58 und #59 liegen neben den #57-Tests.
- Weder `index.html`, `service-worker.js`, `cloud-version.json`, Supabase-Schema/Edge-Funktionen noch Daten-/Planungsalgorithmen sind betroffen.
- CI-Regression auf dem **letzten** Integrations-Commit prüfen (nicht nur auf den früheren Einzel-PRs). Browserprüfungen umfassen 320/390/768/1366px, Dark/Arena, Kontoverwaltung, Mitglieder-Interaktionen und Rathaus-Anzeige.
- Offene manuelle Abnahme: Cloud-Konto mit tatsächlichen Rollen, Anmeldung/Recovery/Einladung, iPhone-Safari, Rheinfolge der UI-Ansichten, externe Rathausbilder unter realen Netzwerkbedingungen.

## Vor einem späteren Release
1. `main` erneut gegenprüfen; bei Änderungen Integration auffrischen.
2. Eine neue Cloud-Version und Changelog festlegen. **Nicht** einfach `v1.6.0` mit neuen Modulen überschreiben: Versions-/Cachekennungen in Cloud-HTML, `cloud-sync.mjs`, `cwl-stats.mjs` und `cloud-version.json` beim Release konsistent ändern.
3. Kombinierte Regression sowie GitHub-Pages-Deployment prüfen und erst dann einen Release-PR freigeben.
4. Teil-PRs #57/#58/#59 nach erfolgreich veröffentlichtem Gesamt-Release als ersetzt kennzeichnen/schließen; nicht doppelt mergen.
5. Bei kritischem Fehler reiner Code-Revert plus neue Cachekennung. Cloud-Revisionen, Snapshots, Clan-Mitglieder und Kriegs-Historie nie zurücksetzen.

Weitere separate Punkte: #46 Alt-Demos/Pilot/Branches nach Link-Prüfung; #44 stärkebasierte Planung weiterhin deaktiviert.
