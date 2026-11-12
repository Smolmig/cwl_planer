# Cloud v1.18.0 – Saisonrückblick im CWL-Archiv und bestätigte Gruppen-Endstände

**Offiziell veröffentlicht:** 11.11.2026 · [Release](https://github.com/Smolmig/cwl_planer/releases/tag/v1.18.0) · [Implementierungs-PR #259](https://github.com/Smolmig/cwl_planer/pull/259) · Squash `e2158c566cd7ce17b5cd147995e9ba242773ffd8`.

## Nutzerfeedback und konkrete Daten

Der Screenshot vom 11.11.2026 zeigt im CWL-Archiv für **November 2026** eine Gruppentabelle mit **24/28** und „Noch nicht vollständig“, daneben einen bereits als **7/7 abgeschlossen** archivierten Plan. Die Quellen erfassen unterschiedliche Mengen:

- **Gruppenarchiv:** vier letzte Gruppenspiele aus Runde 7 waren noch als `inWar` gespeichert.
- **Eigenes CWL-Aufstellungsarchiv desselben Cloud-Clans:** der siebte eigene Krieg ist mit passendem War-Tag `warEnded` gespeichert.
- Die vier Gruppen-War-Tags aus Runde 7 sind in der Datenbank **eindeutig, valide und bereits erfasst**. Eine gesonderte 28/28-Saison in der Datenbank gehört zu einem **anderen Clan**; sie darf nicht mit dem 24/28-Stand vermischt werden.
- **Befund nach Deployment:** zunächst weiterhin 24/28 bis zu einem erneuten authentifizierten Statusabruf. Kein manuelles Überschreiben; ob die Clash-API die vier Endstände nach CWL-Schluss noch liefert, muss real geprüft werden.

## Neue Oberfläche

- **Mehr → CWL-Archiv → Archivierte CWL-Pläne → Ansehen:** historischer **Saisonrückblick** in drei Reitern **Kriegstage / Tabelle / Spieler**, mit den bestehenden Plan-Startseiten-Renderern.
- Darunter bleiben **frühere Aufstellungen und Einsätze** vollständig erhalten und read-only.
- Nur die ursprüngliche Clan-Kennung plus Saison erlauben die Zuordnung eines historischen Planarchivs zu einer Gruppentabelle. Manuelle Pläne/Importe bekommen keine fremden Gruppenergebnisse allein wegen desselben Monats.
- **Gruppenarchiv:** „Gruppenstand veraltet“ erklärt bestätigten eigenen letzten Krieg vs. vorläufige Gruppe. Weitere Fälle unterscheiden fehlende Ergebnisse, offene Begegnungen und bestätigten Gruppenabschluss.
- **„Mit Clash abgleichen“:** verwendet die bisherige authentifizierte Status-Funktion und lädt danach die serverseitigen Archive neu; Fehlermeldungen/Archivdaten bleiben erhalten, Auto-Refresh zerstört keine offenen Bereiche.

## Backend und Sicherheit

`coc-cwl-status`, **Edge Version 13**: Nach offiziell beendeter Liga (`notInWar`) dürfen nur in diesem Cloud-Clan gespeicherte War-Tags der jüngsten belegten 6- bzw. 8-Clan-Gruppe erneut abgefragt werden. Ein Gruppenkrieg wird ausschließlich auf `warEnded` erhöht, wenn War-Tag, exakte gegnerische Clans, Teamgröße sowie valide Sterne/Zerstörung aus Supercell übereinstimmen. API-Fehler, unbekannte Paarungen und andere Clans erzeugen **keinen** künstlichen Abschluss.

- Keine Supabase-Migration, RLS-Aufweichung, neue Service-Schlüssel im Browser, neue Cloud-Profile oder Offline-PWA-Änderung.
- `verify_jwt=false` blieb bei der Edge Deployment-Konfiguration bestehen, ebenso die serverseitige `withSupabase({auth:"user"})`-Prüfung und die Clanmitgliedschaftsautorisierung.
- Remote-Edge-Datei `index.ts` nach Deployment mit der GitHub-`main`-Datei verglichen: **exakt identisch**.
- Der vorhandene Datenbank-Trigger `private.cwl_merge_group_archive` verhindert Regression eines `warEnded`-Endstands in `inWar` oder unvollständige Datensätze.

## CI, Freigabe und Veröffentlichung

- PR #259, finaler Branch-Head `6054679eb8a7de3ca8ea88dde0d8d0c0f0366b0d`, [PR-Regression #43112414818](https://github.com/Smolmig/cwl_planer/actions/runs/43112414818): **680/680 erfolgreich**.
- Squash auf `main`: `e2158c566cd7ce17b5cd147995e9ba242773ffd8`.
- [Main-Regression #43112859530](https://github.com/Smolmig/cwl_planer/actions/runs/43112859530) erfolgreich.
- [GitHub Pages #43112858302](https://github.com/Smolmig/cwl_planer/actions/runs/43112858302) erfolgreich.
- [Release-Automation #43113133267](https://github.com/Smolmig/cwl_planer/actions/runs/43113133267) erfolgreich; offizielles Tag `v1.18.0` zeigt exakt auf `e2158c5`.
- Edge `coc-cwl-status` Version **13 ACTIVE**, Quellgleichheit bestätigt.
- SemVer **MINOR**, weil neue eigenständige Archiv-Ansicht. Hilfe, Settings-Neuigkeiten, öffentlicher Update-Verlauf, `cloud-version.json` und `CHANGELOG.md` synchron.

## Weiter offen – reale Endkontrolle

1. Im verknüpften Cloud-Clan in der aktuellen App **Mehr → CWL-Archiv → Mit Clash abgleichen** ausführen (oder authentifizierten regulären CWL-Statuspoll abwarten). Danach **read-only** prüfen, ob vier bekannte War-Tags echte `warEnded`-Endstände bekommen haben.
2. **Wenn API 28/28 belegt:** Gruppentabelle und Status „Abgeschlossen“ bestätigen, 7/7-Plan unverändert, denselben Club/Monat vergleichen.
3. **Falls API historische Kriege nicht mehr ausliefert:** 24/28 und ehrlichen Hinweis beibehalten. Keine fremden 28/28-Daten, keine 0-Sterne-Schätzungen, kein synthetischer Endstatus. Eine alternative beweisbare Archiv-Quelle als separates Thema prüfen.
4. Reale Geräte-/Rollenabnahme (Owner/Vize/Viewer, iPhone/Android, 320/390/430/1366, Gold/Dark/Light) gemäß [#213](https://github.com/Smolmig/cwl_planer/issues/213) weiterhin offen; automatisierte Tests ersetzen die manuelle Abnahme nicht.
