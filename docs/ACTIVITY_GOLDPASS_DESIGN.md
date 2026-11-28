# Zeitraum-Goldpass (#351): Kriterien und API-Evidence

## Ziel
Eigenständige Verlosung neben der CWL-Verlosung (#180): frei wählbare Zeitfenster, Mindestbedingungen, optional Punkte/gewichtete Lose, nachvollziehbarer Fortschritt. Standardvorschlag: ein Los je qualifiziertem Teilnehmer. Keine fest vorgegebenen Leistungsgrenzen. Kein automatischer Kauf/Versand.

## Datenquellen
- Bestehende positive Clan-Spendendeltas, eigene belegte CW/CWL-Angriffe und verifizierte Fehlangriffe wiederverwenden. Kriege nach dokumentiertem Zeitbezug auswählen (z. B. Abschlussdatum, nur bei belegtem Abschluss); Importquelle ausdrücklich getrennt. Unvollständige Quoten nicht als null berechnen.
- Offizielle neue Player-Battlelog- und League-History-/Group-Endpunkte seit Juni 2026 in SDK/Dokumentationsspiegel dokumentiert. Vor produktivem Polling prüfen, ob der vorhandene API-Key/Proxy diese Endpunkte und die erwarteten Felder tatsächlich liefert. BattleLogEntry: battleType HOME_VILLAGE/RANKED/LEGEND, attack, battleTimestamp, stars, destructionPercentage, opponentPlayerTag (optional). Nicht aus attackWins ableiten. Keine Verteidigung als Angriff. Begrenztes rollierendes Log; Polling-Lücken, Überlauf und widersprüchliche Identität als unvollständig markieren, nicht rückwirkend extrapolieren. Persistente Deduplizierung und Beobachtungszeitraum nötig. Aktive Spieltage sind beobachtete Aktivität, kein letzter Login.
- Ranked: Angriffe, Sterne, Dreier, abgeschlossene Turniere, Aufstieg und Teilnahmequote anhand tatsächlich verfügbarer Angriffe je Liga/Turnier. Legend separat optional. Keine pauschale gleiche Mindestzahl für alle Ligen. Bei unvollständigem Nenner Quote unbekannt.
- Raidlog: tatsächliche Angriffe, attackLimit+bonusAttackLimit, Hauptstadtgold, abgeschlossene Wochenenden; fehlende Beobachtungen getrennt. Nicht automatisch sechs Angriffe verlangen.
- Clanspiele: Differenz von Games Champion zwischen zeitnahen Snapshots, accountweit; nicht mit direktem clanbezogenem Eventscore verwechseln. Keine Rekonstruktion fehlender Startwerte.
- Optionale weitere Kriterien: normale Heimatdorf-Angriffe, Sterne, aktive Tage, Beute-/Upgrade-Fortschritt erst nach Feld- und Abdeckungsprüfung. Keine wirtschaftliche Bevorzugung von Echtgeldkäufen.

## Manuelle Mitgliedsmerkmale
Clanprivat und über Player-Tag gebunden. Discord-Mitgliedschaft: ja/nein/unbekannt, dauerhaft. Reaktion/Abstimmung: ja/nein/unbekannt je benanntem Event, nicht als globale Markierung. Owner kann markieren/filtern; spätere Mehrfachauswahl. Nicht durch CWL-Saisonreset entfernen. Mehrfachaccounts explizit gruppieren (keine Identitätsableitung aus Namen). Keine automatische Discord-Abfrage ohne passende Verbindung/Einwilligung.

## Auswertungsregel
Einzelne Mindestanforderungen separat aktivierbar, AND als erster Modus. Vollständig beobachtet: erfüllt/nicht erfüllt; bestätigte Untergrenze >= Schwelle: erfüllt; sonst unbekannt, nicht automatisch ausgeschlossen. Unvollständige Prozentwerte grundsätzlich unbekannt. Veranstalter oder bewusst manuell ausgeschlossene Teilnehmer separat ausweisen. Ein Los je qualifiziertem Teilnehmer als erste Variante; alternative Gruppen/gewichtete Punkte optional in Folgepaket.

## Lieferumfang dieses PR
Pure JS-Normalisierung von Kampfprotokollen und Mindestanforderungen, Tests; keine Live-Abfragen, keine DB-Änderung, keine Mitgliedsmarkierungs-Oberfläche, keine persistente Kampagne oder Ziehung. Vor Live-Betrieb: read-only API-Probe, Collector-Budget und Speicherung, Mandantentrennung/RLS, Mitgliedsmerkmale, Kampagnen-UI und unveränderliche Ziehung, echte Staging-Abnahme.

## Quellen
- https://clashy.clashk.ing/en/stable/miscellaneous/changelog.html
- https://clashygo.clashk.ing/en/latest/api/clashy/
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/battlelog.md
- https://clashygo.clashk.ing/en/latest/api/raids/


## Erweiterung 26.11.2026
- Zentrale Mitgliedsmerkmale in Mehr → Clanverwaltung: beobachtete aktuelle Mitglieder und gespeicherte ehemalige Accounts, Discord (unbekannt/ja/nein), explizite Haupt-/Zweitaccount-Zuordnung. Kein automatischer Identitätsabgleich. Owner-only, clan-/taggebunden; eine flache Gruppe statt Ketten, CAS bei Zuordnungsänderungen.
- Optionaler Kampagnenmodus `onePerPerson`: ein Los je Person mit mindestens einem **einzeln** qualifizierten Account. Qualifizierter Hauptaccount bevorzugt, sonst lexikografisch erster qualifizierter Tag. Veranstalter werden als Person ausgeschlossen. Unbekannte Fälle bleiben bis zur Prüfung offen. Pool, Accountliste, Gruppenstand und Ergebnis werden beim offiziellen Ziehen eingefroren; nachträgliche Zuordnungen verändern das Ergebnis nicht. Bereits gestartete Kampagnen behalten ihre Regeln. CWL-Saisonverlosung bleibt unberührt (dort Discord separat je Saison).
- Testziehung aus dem beobachteten aktuellen qualifizierten Pool, nur lokal, keine Speicherung. Glücksrad stellt den Losindex dar. Das ist keine offizielle Ziehung und nicht die Prognose eines noch laufenden Events.

## API-Prüfung für den nächsten Collector-Schritt (26.11.2026)
Dokumentationsabgleich, **keine authentifizierte Live-Probe** und keine Änderung am bestehenden Collector:
- Ranked: der Dokumentationsspiegel führt GET /players/{playerTag}/battlelog, /players/{playerTag}/leaguehistory und /leaguegroup/{leagueGroupTag}/{leagueSeasonId}?playerTag=... auf. Der Player-Endpunkt dokumentiert currentLeagueGroupTag. SDK-Dokumentation bestätigt BattleLogEntry/LeagueHistoryEntry. Mit dem im Projekt eingesetzten cocproxy.royaleapi.dev/v1 muss der tatsächliche Rückgabestatus und die Form erst geprüft werden. Keine Ranglistenwerte als angebliche Angriffsanzahl verwenden.
- Raid: GET /clans/{clanTag}/capitalraidseasons; Member-Schema enthält attacks, attackLimit, bonusAttackLimit, capitalResourcesLooted. Ein abgeschlossener Raid kann direkt nachgewiesen werden, wenn Zeitraum und Spielertag passen. Fehlender Member-Eintrag ist ohne dokumentierte Anwesenheit/Abdeckung nicht automatisch null. Nur vollständig im Kampagnenfenster liegende Wochenenden für Wochenendquoten; Nenner individuell, nicht immer sechs.
- Clanspiele: Profil-Achievement als accountweiter kumulativer Zähler. Vor Aktivierung den tatsächlichen Achievement-Namen und die Semantik per Live-Probe prüfen; kein direkter Eventscore aus Profil-Snapshots behaupten. Fehlende Start-/Endwerte, Reset und außerhalb des Clans erspielte Punkte sind nicht rückwirkend beweisbar.
- Collector: vorhandenes Laufzeitbudget (105s, max. 32 Tags/5 Clans je Lauf) erhalten. Raid pro Clan vor playerweisen Ranked-Abfragen; diese nur für aktive Events mit passender Regel, Rotation und persistenten Beobachtungscursors, Zeit-/Requestbudget, kein Polling ohne aktive Kampagne. Abdeckung und Fehler separat speichern. Erst nach echter Probe und Rollback-Tests freischalten.

Dokumentationsquellen:
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/battlelog.md
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/leagues/leaguegroup.md
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/get-player.md
- https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/clans/capitalraidseasons.md
- https://clashofclans.js.org/docs/api/interfaces/APICapitalRaidSeasonMember
- https://clashy.clashk.ing/en/stable/miscellaneous/changelog.html


## Read-only API-Diagnose (vorgemerkt nach v1.36.0)
Der bestehende Collector erhält einen separaten, explizit manuellen GitHub-Workflow-Modus `activity-probe`. Der reguläre Zeitplan, Roster-Beobachtungen und CW/CWL-Speicherung bleiben unverändert. Nur signierte GitHub-OIDC-Identitäten für den vorhandenen Main-Workflow und das Ereignis workflow_dispatch dürfen diese Probe aufrufen. Cron-Anfragen werden in diesem Modus abgewiesen. Der Modus liest höchstens sechs Clash-API-Endpunkte für einen bereits verknüpften Clan und einen über die Roster-Antwort beobachteten Spieler. Kein Retry und kein neuer Collector-Zeitplan. Es werden ausschließlich HTTP-Statusklassen, Antwortformen und erlaubte Feld-Präsenz-Flags zurückgegeben, weder Spielertags, Namen, konkrete Spielerdaten, Zugangsdaten noch rohe Providerfehler. Erfolgreicher Probe-Lauf bedeutet nicht vollständige Tracking-Abdeckung.

Deploy-Gate: zuerst Regressionen prüfen, anschließend den passenden Edge-Stand einschließlich des neuen Moduls bereitstellen und prüfen, erst danach den Workflow-Modus freigeben. Ein alter Edge-Stand kennt den Modus nicht; daher niemals die Probe vor dieser Deployment-Prüfung starten. Manuelle Ausführung: Actions → Collect finished Clash war statistics → Run workflow (main) → activity-probe. Ohne bestätigte Live-Antwort keine neuen Grind-Kriterien freischalten. Eine leere erfolgreiche Antwort ist nicht gleich fehlender Endpoint; für Ranked muss ggf. ein weiterer geeigneter Spieler in einer späteren Probe gewählt werden.

Dokumentationsabgleich: https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/battlelog.md, https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/leaguehistory.md, https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/players/get-player.md und https://github.com/MasiaAntoine/clash-of-clan-api-doc-official/blob/en/API/leagues/leaguegroup.md.

## Live probe follow-up (28.11.2026)
Run 46151857193 returned five HTTP 200 responses with verified player identity. Individual Raid and Ranked fields were not confirmed. Follow-up reads five recent raid seasons in the same single request, distinguishes ended member arrays from absent/empty arrays and checks each needed field separately. Player selection prefers an available group or tier hint; otherwise it selects the second roster entry rather than repeating the initial first entry. This is a sampling heuristic, not proof of active ranked participation. Battlelog reports only fixed field-presence/type flags, no arbitrary keys or values. Six-request ceiling, manual identity, no retries, no writes and regular collector untouched. Another authenticated manual probe is required after checked deployment.
