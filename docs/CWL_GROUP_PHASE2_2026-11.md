# CWL-Gruppe – Phase 2, 04.11.2026

## Befund
Die bestehende Supabase Edge Function `coc-cwl-status` ruft bereits **alle bis zu 28 War-Tags** der eigenen CWL-Gruppe ab, um die sieben eigenen Kriege zuzuordnen. Ein zweiter API-Endpunkt oder zusätzliche externe Requests sind **nicht erforderlich**. Bisher wurden die anderen Kriege nach dem Abruf nicht an den Browser übermittelt.

## Neuer Umfang (v1.10.0)
- Authentifizierte `coc-cwl-status`-Antwort enthält optional `group`: maximal 8 aus `leaguegroup.clans` validierte Clans, maximal 7 Runden und bis zu 4 kompakte Paarungen je Runde.
- Für jedes verfügbare Kriegspaar nur Clan-Tags, Namen, Wappen vom offiziellen CDN, Status, Kriegssterne, Zerstörung, Angriffsanzahl, Kriegsgröße und War-Tag; **keine gegnerischen Mitglieder-/Angriffslisten** außerhalb der ohnehin bekannten eigenen sieben Kriege.
- `preparation` liefert für Scores/Zerstörung `null`, niemals ein vermeintliches 0:0-Ergebnis; `inWar` zeigt laufende Zwischenstände, `warEnded` ist bestätigt. `#0`, Fehler, unvollständige War-Tags ergeben unbekannte Paarung.
- `cwl-group-core.mjs` fasst pro Clan bestätigte Kriegssterne und +10 **nur** für gewonnene, beendete Kriege zusammen. Kriegsgewinner nach Sternen und – bei Sternengleichstand – Zerstörung. Bei vollständig gleichem Ergebnis kein fiktiver Sieger/Bonus. Summe Zerstörung aus API-Prozent × tatsächlicher War-Teamgröße, mit transparenter Rundungsabweichung.
- Unter `Mehr → CWL-Saison` ersetzt `Gruppe` die Gegnerliste durch eine **klar als vorläufig markierte** Tabelle, `Runden` zeigt bis zu vier Begegnungen pro Kriegstag. Vorhandene `Clan`-Ansicht bleibt unverändert.
- Mit älterer Edge Function oder fehlendem `group` bleibt die v1.9.0-Ansicht als Fallback erhalten.

## Sicherheit, Betrieb, Tests
- `withSupabase({auth:"user"})` und anschließende Mitgliedschafts-/Clanprüfung bleiben **identisch**; vorhandene Deployment-Konfiguration `verify_jwt=false` ist erforderlich, weil die Funktion selbst die User-Auth übernimmt. Nicht ungeprüft auf `true` umstellen.
- Kein Supabase-Tabellen-, RLS-, Edge-Key-, Cache- oder Poll-Intervall-Wechsel. Bestehendes `getWar`-Caching (60s laufend, 120s Vorbereitung, 12h beendet) wird unverändert benutzt.
- Edge Function **vor** Frontend-Release deployen; die alte Cloud-Version ignoriert das zusätzliche optionale Feld. In CI reine Mocks mit exakt 1 Gruppenabruf + den ohnehin vorhandenen War-Requests, Rollen-Abgleich und Datenfilter; mobile/desktop Layout und Regression.
- Auf keinen Fall `COC_API_KEY` in GitHub, Browser oder Screenshots ausgeben. Nur die freigegebenen Clan-Metadaten nutzen.
- Teste live anschließend mit berechtigtem Login: zwei beendete/aktive Runden, Gegnernamen, Gruppentabelle, Ergebnisvergleich mit Clash, unvollständige Runden, Viewer, Status bei fehlender Verbindung, iPhone/PC.

## Noch offen
- Persistente, geteilte **Gruppen-Snapshots** für spätere CWL-Archive, einschließlich fehlender Runden/Quellen und kontrollierter Aufbewahrung. Phase 3 separat (Issue #71), nicht opportunistisch in das produktive Datenformat v9 schreiben.
- Tatsächlicher Gleichstand mehrerer Clans in Sternen **und** Zerstörung: als Gleichstand anzeigen und nicht künstlich nach Name auflösen.
- Eventuelle durch die API gerundete Zerstörung kann zu ±0,1 Abweichung zu Clash führen. Beim Vergleich gegen echte Screenshots prüfen.
