# CWL-Historie gezielt mit ClashPerk ergänzen

**Arbeitsstand:** 05.11.2026 · nur Recherche und read-only Dateninventur, keine Imports oder Datenänderungen.
Verwandt: [#90](https://github.com/Smolmig/cwl_planer/issues/90) und der [bestehende vollständige Exportguide](CLASHPERK_EXPORTS_AND_MISSED_COVERAGE.md).

## Was fehlt wirklich?

Die historisch importierten CWL-Daten von United Fighters haben Angriffsergebnisse, aber keine vollständig nachgewiesenen **tatsächlichen Tagesaufstellungen und Ausfälle**. Read-only-Abfrage am 05.11.2026:

| Historischer Monat | Kriegstage mit unvollständigem CWL-Missed-Nachweis |
| --- | ---: |
| August 2026 | 7 |
| September 2026 | 7 |
| Oktober 2026 | 7 |
| **Summe** | **21** |

Zusätzlich waren bei der Abfrage **zwei November-Kriegstage** als abgeschlossene API-Runden mit zugeordneten Rostern gespeichert. Sie sind **nicht** Teil der 21 historischen Lücken. Das Datenbankfeld `missed_log_complete` ist auch bei diesen API-Runden nicht gesetzt; für diese Runden muss die Vollständigkeit aus *abgeschlossener Runde und tatsächlicher API-Aufstellung* gesondert validiert werden, nicht anhand des Flags allein.

## Beim nächsten Datenabruf gezielt anfragen

1. **CWL Missed Attacks Log** für August, September und Oktober 2026, jeweils mit Kriegsdatum/Gegner und **Player-Tag** der nicht angreifenden Mitglieder.
2. **Finale Kriegstagsaufstellung** pro Runde, also die tatsächlichen 15 bzw. 30 eingesetzten Spieler, mit Tags. Das 30–50-Personen-Anmelderoster alleine ist kein Nachweis.
3. **Abgeschlossene Angriffsliste** pro Runde, falls erhältlich, mit Angreifer-Tag und Ziel sowie Sternen. Dadurch lassen sich wirklich fehlende Angriffe prüfen.
4. **CWL Lineup Change / CWL Embed Log** als zusätzliche Quelle, wenn ein finaler Roster nicht direkt exportiert wird. Ein Änderungslog ist ohne abschließenden Stand kein Vollständigkeitsbeleg.

ClashPerk dokumentiert diese Logarten unter https://docs.clashperk.com/features/logs und bewirbt Datenexporte zu Google Sheets. **Der genaue historische Exportweg und die enthaltenen Spalten sind erst anhand des tatsächlich abrufbaren Exports verifiziert**; keine unbestätigten Slash-Befehle behaupten. Wenn alte Logs damals nicht aktiviert waren, lassen sich vergangene Ausfälle eventuell nicht vollständig rekonstruieren.

## Eingangsprüfung (bevor irgendein Import geplant wird)

- Krieg eindeutig mittels Datum, Kriegs-/Runden-ID und Gegner zuordnen; bei Uneindeutigkeit keine Übernahme.
- Spieler **über Player-Tag**, nicht über wechselbaren Namen, zuordnen.
- Pro abgeschlossener CWL-Runde dokumentieren, wie viele Spieler sicher im **tatsächlichen Tagesroster** standen, wie viele Angriffe wirklich stattgefunden haben und ob das Missed-Log lückenlos ist.
- Der Status „0 verpasst“ ist nur bei überprüfbar vollständiger Abdeckung zulässig. Fehlt ein Nachweis: „k. A.“ beziehungsweise nachgewiesene Untergrenze, nicht 0.
- Bereits vorhandene Angriffe/Misses deduplizieren. CWL-Misses separat von normalem CW führen, nicht als 0★-Angriffe behandeln.
- **Kein Datenbankimport** ohne Preview der geplanten Änderungen, passendes Backup, Rechteprüfung und ausdrückliche Freigabe. Keine persönlichen Clanexporte in ein öffentliches GitHub-Repository hochladen.

## Für uns später nützlich

Erst nach der vollständigen Zuordnung pro Krieg können wir die Zuverlässigkeit eines Spielers mit korrektem Nenner zeigen: **verpasste Angriffe / tatsächlich mögliche Angriffe, an denen er teilnahm**. Ohne diese Datengrundlage wäre eine automatische Herabstufung im CWL-Planer irreführend. Die Tagesaufstellungen werden niemals durch einen historischen Datenimport automatisch verändert.
