# CWL-Planer – Projektanweisungen für Entwicklungsarbeit

**Pflicht bei jedem neuen Chat und jeder Änderung:** Aktuellen Projektstand aus [docs/ACTIVE_PROJECT_HANDOFF.md](docs/ACTIVE_PROJECT_HANDOFF.md) lesen und dort nach der Arbeit echte Ergebnisse, PR, CI, Release, offene Punkte und nächste Aufgabe fortschreiben. Das bisherige [docs/NEXT_CHAT_HANDOFF.md](docs/NEXT_CHAT_HANDOFF.md) ist eine historische Übergabe, keine aktuelle Statusquelle.

Bevor du eine UI/UX-Änderung oder ein Feature in diesem Repository entwirfst, **lies `docs/UX_DESIGN_PRINCIPLES.md`**. Die dortigen Vorgaben gelten repo-weit, nicht nur für eine konkrete Ansicht.

**Merksatz:** „Zeige das Wichtige zuerst, gruppiere mit Abstand statt mit Kästen, und ändere niemals ungefragt das, womit jemand gerade arbeitet.“

**Pflicht zum öffentlichen Update-Verlauf seit v1.16.66:** Bei jeder Cloud-Version den **neuesten** Nutzer-Eintrag in `cloud-release-history.mjs` ergänzen (echtes Releasedatum, verständlicher kurzer Titel, ggf. kurzer Erläuterungssatz), zusätzlich `CHANGELOG.md`, `cloud-version.json`, die „Neu in …“-Box unter Design & Aktualisierung und die Hilfe pflegen. Im Menü **Mehr → Update-Verlauf** müssen die früheren Stände vollständig erhalten bleiben; vor v1.0.0 keine historischen Tagesdaten erfinden. Der Contract-Test `tests/cloud-public-update-history.test.cjs` verhindert neue Cloud-Versionen ohne vordersten Verlaufseintrag. Kein Roh-Changelog oder Entwicklerjargon in der öffentlichen Ansicht. Das History-Modul erst bei Ansicht öffnen laden, um den Cloud-App-Start nicht zu verschlechtern.

Insbesondere:
- Vermeide Kartenstapel / mehrfache Rahmen um Listenzeilen.
- Bewahre Expansionen, Filter, Scrollposition, Fokus und Eingaben bei automatischem Refresh.
- Aktuelle CWL im Plan-Workflow, historische CWL im Archiv unter Mehr.
- Mobile First (320/390/430px) und Desktop, alle Themes sowie Beobachterrolle testen.
- Keine unerwünschten Änderungen an Cloud-Profilen, Live-CWL, RLS oder dem Planungssolver bei UI-Arbeit.
- Vor Merge verlässliche Regressionstests, PR und anschließende Live-Checks.

Die komplette Begründung, Prüfcheckliste und Referenzen stehen unter `docs/UX_DESIGN_PRINCIPLES.md`. Bei Widerspruch mit einer konkreten Benutzeranforderung diese bewusst umsetzen und die Abweichung im PR erklären.


## Plattformweite Daten & Abschlussabnahme (10.11.2026)

Bei Änderungen an Datenmodell, Collector, Statistiken, PlayerTag-Zuordnung, Clanmitgliedschaft, Aktivitätsbewertung, Backup, Auth/RLS oder Multi-Clan **auch** [docs/CROSS_CLAN_PLAYER_DATA_ARCHITECTURE.md](docs/CROSS_CLAN_PLAYER_DATA_ARCHITECTURE.md) sowie Issues [#212](https://github.com/Smolmig/cwl_planer/issues/212), [#103](https://github.com/Smolmig/cwl_planer/issues/103), [#183](https://github.com/Smolmig/cwl_planer/issues/183) lesen. **Global identifizierbare Spieler/Angriffe und tenantprivate Clanverwaltung sind verschiedene Ebenen.** Niemals fremde Rohstatistik-/Profil-Tabellen per RLS öffnen, nie fremde Owner-Entscheidungen/Notizen teilen; nur berechtigt/vertraglich geprüftes minimales Beobachtungsprojekt vorsehen. Clash-War-Daten ohne vollständigen belegten Angriff/Missed-Log nicht als 0 werten. Wiederkehrer-Rang muss per Clan aktuell aus API kommen; historische Beförderungen bleiben Hinweise. Keine produktive Freigabe/Migration ohne Sicherheits-/Datenqualitätscheck, Staging, Tests und Rollback.

[#213](https://github.com/Smolmig/cwl_planer/issues/213) ist die spätere **vollständige manuelle UAT-Abnahme**. Bei der Abarbeitung des Feature-Backlogs kontinuierlich abnahmefähige Szenarien, Testdaten, bekannte offene iOS-/Android-/Live-CWL-Prüfungen und Reproduktionsschritte dokumentieren. Nach wesentlichen Features die Endcheckliste mit **jetzt ohne CWL testbaren** und **erst bei einer echten künftigen CWL möglichen** Schritten konsolidieren; erfolgreiche CI niemals als Beweis realer CWL-Funktion ausgeben.
