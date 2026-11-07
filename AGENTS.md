# CWL-Planer – Projektanweisungen für Entwicklungsarbeit

**Pflicht bei jedem neuen Chat und jeder Änderung:** Aktuellen Projektstand aus [docs/ACTIVE_PROJECT_HANDOFF.md](docs/ACTIVE_PROJECT_HANDOFF.md) lesen und dort nach der Arbeit echte Ergebnisse, PR, CI, Release, offene Punkte und nächste Aufgabe fortschreiben. Das bisherige [docs/NEXT_CHAT_HANDOFF.md](docs/NEXT_CHAT_HANDOFF.md) ist eine historische Übergabe, keine aktuelle Statusquelle.

Bevor du eine UI/UX-Änderung oder ein Feature in diesem Repository entwirfst, **lies `docs/UX_DESIGN_PRINCIPLES.md`**. Die dortigen Vorgaben gelten repo-weit, nicht nur für eine konkrete Ansicht.

**Merksatz:** „Zeige das Wichtige zuerst, gruppiere mit Abstand statt mit Kästen, und ändere niemals ungefragt das, womit jemand gerade arbeitet.“

Insbesondere:
- Vermeide Kartenstapel / mehrfache Rahmen um Listenzeilen.
- Bewahre Expansionen, Filter, Scrollposition, Fokus und Eingaben bei automatischem Refresh.
- Aktuelle CWL im Plan-Workflow, historische CWL im Archiv unter Mehr.
- Mobile First (320/390/430px) und Desktop, alle Themes sowie Beobachterrolle testen.
- Keine unerwünschten Änderungen an Cloud-Profilen, Live-CWL, RLS oder dem Planungssolver bei UI-Arbeit.
- Vor Merge verlässliche Regressionstests, PR und anschließende Live-Checks.

Die komplette Begründung, Prüfcheckliste und Referenzen stehen unter `docs/UX_DESIGN_PRINCIPLES.md`. Bei Widerspruch mit einer konkreten Benutzeranforderung diese bewusst umsetzen und die Abweichung im PR erklären.
