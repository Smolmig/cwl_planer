## Änderung aus Nutzersicht

_Was sehen oder nutzen Clanführer, Vize und Beobachter nach dieser Änderung anders?_

## Versionsentscheidung für die Cloud-App

- [ ] **Kein Cloud-App-Release** – nur interne Arbeiten, Doku oder Tests
- [ ] **PATCH** – Fehler, Sicherheit oder kleine UX-/Textkorrektur, keine eigenständige neue Funktion
- [ ] **MINOR** – neue rückwärtskompatible Funktion oder eigenständiger nutzbarer App-Bereich
- [ ] **MAJOR** – bewusste inkompatible Änderung mit Migration

**Begründung:** _Ein Satz zur Nutzerwirkung und warum diese Stufe zutrifft. Bei einem gemischten Release die höchste Stufe wählen._

**Version (falls Release):** `vX.Y.Z`

## Release- und Qualitätsprüfung

- [ ] Altdaten, gespielte Tage, Archive und Rollen unverändert bzw. Migration dokumentiert
- [ ] Hilfe-Seite geprüft/aktualisiert; nach Einführung von Englisch beide Sprachen gepflegt
- [ ] Öffentlicher `cloud-release-history.mjs`-Eintrag mit Datum, einfachem Titel und `releaseType`, neuester Settings-Changelog, `cloud-version.json`, Cloud-Cache und `CHANGELOG.md` synchron (nur bei Cloud-Release)
- [ ] Browser-/Rollen-/Mobile-Regressionen und bestehende Tests geprüft
- [ ] Neue Funktionen nicht als PATCH etikettiert, um nur die dritte Zahl zu erhöhen

Details: [VERSIONING.md](../VERSIONING.md). Die Offline-PWA hat einen eigenen Versionsstrang; historisch veröffentlichte Tags nicht ändern.
