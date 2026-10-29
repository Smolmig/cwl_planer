# Versionierung des CWL-Planers

## Ziel und Gültigkeit

Ab dem neuen Release **v1.0.0** wird die öffentliche **App-Version** nach [Semantic Versioning 2.0.0](https://semver.org/lang/de/) vergeben: `MAJOR.MINOR.PATCH`.

Die alten Kennungen **v1 bis v9.6.1** waren Entwicklungs- und Veröffentlichungsbezeichnungen. Sie werden **nicht rückwirkend in Git-History, alte Backups oder bisherige Tags umgeschrieben**. Die folgende Tabelle ist eine **nachträgliche, dokumentarische Zuordnung** der Entwicklungsmeilensteine, keine Behauptung, dass die rückblickenden SemVer-Tags tatsächlich erschienen sind.

Die erste regulär unter der neuen Konvention freigegebene Version ist `v1.0.0`. Die technische Grundlage ist der bisher auf `main` veröffentlichte Stand `v9.6.1` (29.10.2026). Die Umstellung der Versionsanzeige ist **keine Funktions- oder Datenmigration**.

## Regeln für neue Releases

| Beispiel | Verwendung | Konsequenz |
| --- | --- | --- |
| `1.0.1` (PATCH) | Fehlerkorrektur, kleine Darstellungskorrektur, Sicherheit, PWA-Hotfix | Bestehende Daten und Funktionen bleiben kompatibel |
| `1.1.0` (MINOR) | Neue, optionale Funktionen, z. B. gemeinsamer Clanbereich oder API-Mitgliederimport | Bestehende Nutzung bleibt kompatibel |
| `2.0.0` (MAJOR) | Bewusst nicht rückwärtskompatible Änderung an unterstützten Schnittstellen/Verhalten | Migration, dokumentierte Konsequenzen und Freigabe nötig |

Für nicht freigegebene Builds `1.1.0-alpha.1`, `1.1.0-beta.1` oder `1.1.0-rc.1` verwenden. Entwicklungssprints oder Projektnamen wie „Cloud-Ausbau“ sind **keine** eigenständigen Release-Nummern. Einen großen Versionssprung gibt es nicht nur wegen des Umfangs, sondern erst bei absichtlich gebrochener Kompatibilität.

## Rückblickende Zuordnung seit dem ersten Stand

| Ursprünglicher Stand | Historische SemVer-Entsprechung (nur Dokumentation) | Inhalt / Einordnung |
| --- | --- | --- |
| v1 | 0.1.0 | Erster CWL-Planer / initialer Prototyp |
| v2 | 0.1.1 | iPhone-Safe-Area-Korrektur |
| v3 | 0.2.0 | Tagesdialog und Gesamtplan kopieren |
| v4 | 0.3.0 | Profile, Mitgliederverwaltung, CSV und Backups |
| v5 | 0.4.0 | Mitgliederimport/-verfügbarkeit und Bedienung |
| v6 | 0.5.0 | Mitglieder-Workflow und Mehrfachbearbeitung |
| v7 | 0.6.0 | Hilfe, Rathaus, Sortierung und UI |
| v8 | 0.7.0 | 3★-Einstufung und damalige Tagesziele |
| v9 | 0.8.0 | Live-CWL, Historie, Archive, Sicherheit der Datenspeicherung |
| v9.1 | 0.8.1 | Korrekturen an Kompaktansicht und Mitglieder-UI |
| v9.2 | 0.9.0 | Eigene Dialoge und Cyberpunk-Theme |
| v9.3 | 0.10.0 | Cyberpunk Hell und Performance |
| v9.4 | 0.10.1 | Visuelles Feintuning der Cyberpunk-Themes |
| v9.4.1 | 0.10.2 | FIX-Badges und korrekte Spielerakzente |
| v9.4.2 | 0.10.3 | Lesbarkeit der Toasts in Cyberpunk Hell |
| v9.5.0 | 0.11.0-dev.1 | Entwicklungszweig für mobile/desktop UI, **kein eigenständiger Release auf main** |
| v9.6.0 | 0.11.0 | Tatsächlich veröffentlicht: kombinierter UI-, Rotations-, Archiv- und PWA-Ausbau |
| v9.6.1 | **1.0.0 (neue formale Release-Basis)** | Tatsächlich veröffentlicht als v9.6.1: iPhone-PWA-Hotfix; ab jetzt einheitliche SemVer-Nummerierung |

**Wichtig:** Die rückblickenden Nummern in der zweiten Spalte sind eine redaktionelle Einordnung. Für alte Fehlermeldungen, Downloads und Commits gelten weiterhin die originalen alten Kennungen und Commit-SHAs. Das README enthält die ursprünglichen Beschreibungen sowie spätere Korrekturen, die frühere Pläne überholen (insbesondere das Entfernen der RH-/3★-Tagesziele in v9.6.0).

## App-Version, Datenformat, Speicher und PWA unterscheiden

- `APP_VERSION` im `index.html`: sichtbare SemVer-App-Version (z. B. `v1.0.0`), in Supportinfos und JSON-Export-Metadaten.
- `DATA_VERSION=9`: technisches Schema von Profilen/Backups; wird **nur** geändert, wenn sich das persistierte Datenformat tatsächlich inkompatibel oder migrationspflichtig weiterentwickelt.
- `STORAGE_KEY="cwl_planer_mobile_v9"`, Recovery-Key, `UI_SETTINGS_KEY` und `LEGACY_KEYS`: **nicht** zusammen mit der App-Version hochzählen. Die Speicherkennungen werden ausschließlich bei begründeter Datenmigration geändert.
- `service-worker.js`: Cache-Namespace (z. B. `cwl-planer-v1-0-0`) muss bei jedem veröffentlichten App-Update passend geändert werden. Network-first für Navigation und Offline-Fallback bleiben erhalten.
- **Alte Backups** behalten ihre ursprüngliche `version`-Metadatenangabe. Beim Import ist das Feld `dataVersion` maßgeblich. Alte lokale Daten werden nicht neu geschrieben, nur weil die sichtbare App-Version wechselt.
- Offline-PWA, lokal gespeicherte Profile, gespielte Line-ups und CWL-Archive dürfen bei reinen Versionsänderungen nicht gelöscht oder überschrieben werden.

## Ablauf für kommende Releases

1. Neuer Feature-/Fix-Branch aus dem aktuellen `main`; Änderungen und Versionskandidaten separat testen.
2. Changelog, `APP_VERSION`, Service-Worker-Cache und Regressionstests zusammen prüfen.
3. Automatische Tests ausführen (`node --test tests/*.test.cjs`); bei PWA-/UI-Änderungen zusätzlich echte iPhone-/Desktop-Checks.
4. Pull Request prüfen und mergen, erst dann ein **neues** Release/Tag `vX.Y.Z` für den gemergten Commit setzen. Nicht nachträglich frühere Versions-Tags umschreiben.
5. GitHub Pages und installierte PWA einschließlich Offline-Fallback testen. Vor PWA-Neuinstallation, Speicherbereinigung oder Migration ein vollständiges JSON-Backup anlegen.

## Nächste geplante Schritte

- Cloud-Profile mit Supabase und Berechtigungen: **geplantes kompatibles Feature-Release**, voraussichtlich `v1.1.0`.
- Clash-of-Clans-API-Mitgliederimport: **geplantes kompatibles Feature-Release**, möglicherweise `v1.2.0`, sofern separat veröffentlicht.
- Erst ein notwendiger Kompatibilitätsbruch würde einen Sprung auf `v2.0.0` rechtfertigen.

Diese Roadmap ist keine Zusage einer vorhandenen Funktion; der aktuelle stabile Planer arbeitet weiterhin mit lokalem Speicher.
