# Clanverwaltung #183 – Phase 2e1: Prüfhinweise quittieren und Ausnahmen setzen

**Offiziell live: Cloud v1.16.58 am 10.11.2026.** [PR #220](https://github.com/Smolmig/cwl_planer/pull/220), PR-CI 609/609, Main-CI 609/609, Pages & GitHub Release erfolgreich. Neue Tabelle produktiv mit geprüften Owner-RLS-Rechten, 0 initialen Entscheidungen; 99 Mitgliedschaftszeilen vorhanden. Reale Owner-/iOS-/Android-Praxisabnahme weiterhin offen. Die Funktion ist eine **rein manuelle, pro Cloud-App-Clan private Bearbeitung von Empfehlungen**, keine Ingame-Aktion und kein Sanktionen-System.

## Was der Owner entscheiden kann

Unter **Mehr → Clanverwaltung → Ränge & Nachweise** erscheint direkt unter einem **tatsächlich qualifizierten** Hinweis eine kompakte Aktionszeile für den Leistungspfad, Treuepfad oder einen belegten früheren Ältestenrang:

- **Quittieren**: Dieser Nachweisstand wurde angesehen und abgehakt. Die Zeile zeigt **„Quittiert“** und zählt nicht mehr zu offenen Prüfhinweisen. Ein späterer vollständiger API-Abruf mit unveränderten entscheidenden Daten öffnet den Fall **nicht** erneut. Ein geändertes Angriffsmuster (Anzahl/Sterne/Kriege), neue Spendenbelege, geänderte Grenzwerte oder ein neuer beobachteter Besuch erzeugen dagegen einen **neuen offenen Prüfhinweis**, nicht eine automatische Beförderung.
- **Erneut öffnen**: Die eigene Entscheidung bewusst zurücknehmen. Wieder **„Offen“**, auch bei unverändertem Nachweisstand.
- **Ausnahme**: Für exakt *diesen Spieler, diesen Clan und diesen Vorschlagstyp* bleibt der Vorschlag als **„Ausnahme aktiv“** stumm, auch wenn neue relevante Nachweise dazukommen. **Ausnahme aufheben** stellt die manuelle Prüfung wieder her. Es ist weder eine Ausnahmeregel für unbekannte Verstöße noch ein automatisch gewährter Ingame-Rang.
- **Keine Aktion** bei bloßen Datenlücken/ungeklärtem Rang, Elder ohne Rückkehrbezug, CoLeader oder Leader. Für mehrere gleichzeitig echte Fälle gibt es **getrennte** Quittierungen pro Vorschlagstyp. Keine globale Player-Sperrliste.

**Datenabdeckung:** Lediglich API-beobachtete und pro Clan aktuell zugängliche bestätigte Mitgliedschaft, bereits bewertete lokale finalisierte Angriffe, belegte Spendensteigerungen und bestätigte frühere Ältestenrolle. Keine rückwirkend angenommenen Ein-/Austrittszeiten, Offline-Behauptung, Strafpunktbuchung oder auswärtigen fremden Verwaltungsdaten. Das Ausbleiben eines positiven Signals erzeugt keinen neuen Vorwurf.

## Daten und Schutz

- Neue Tabelle `cwl_clan_review_decisions`: PK `(clan_id,source_clash_tag,player_tag,review_kind)`, aktuelles Ergebnis `open|acknowledged|exception`, begrenzter **Nachweis-Fingerprint** ohne Namen, bestätigte `revision` für optimistische Konkurrenzkontrolle, `updated_at`.
- Fremdclan-Zugriff ist doppelt gesperrt: Eigentümerfunktion `private.cwl_is_owner(clan_id)` **und** aktueller verknüpfter `cwl_clans.clash_tag`; die referenzierte Mitgliedszeile muss bereits existieren. Keine Freigabe über #212 und keinerlei browserseitiger Service-Key. `anon` darf nichts; `authenticated` benötigt Owner-RLS für SELECT/INSERT/UPDATE, kein DELETE.
- Speicheraktion erfolgt **nur** auf ausdrücklichen Button-Klick. Bei zeitgleicher Bearbeitung gilt `revision`-Compare-and-Swap; ein Konflikt fordert erneuten Clanstand. Bei Clan-/Sitzungswechsel darf weder eine verspätete Antwort noch die Entscheidung im falschen Clan angezeigt werden.
- Material-Fingerprint wird aus Grenzwerten, aktuellem Besuch und passenden tatsächlich belegten Angriffs-/Spenden-/Rangfakten gebildet. Der laufend steigende `last_observed_at`-Zeitstempel ist **absichtlich ausgeschlossen**; sonst würde jeder Collector-Lauf unnötig quittierte Fälle reaktivieren. Die Fingerprints sind **Vergleichsschlüssel**, keine kryptografischen Quellen-/API-Authentizitätsbeweise.
- UI zeigt direkt an der betreffenden Spielerzeile den aktuellen Status; nach Speichern wird nur diese Aktionszeile inkrementell aktualisiert, **kein** neuer Clash-API-Request, kein Seiten-/Filter-/Formularreset. Bei fehlgeschlagenem Rechte-/Daten-Read werden **keine** Aktionsbuttons angeboten.
- **Keine vollständige Ereignis-/Entscheidungs-Audit-Historie** in dieser Phase: der aktuellste Zustand und `updated_at` werden erhalten. Für spätere Begründungen und Prüfprotokolle sind ein append-only Owner-Audit, Notizen/Ausnahmegründe und ausdrückliches Entschuldigen **erst mit belegten CW-/CWL-Missed-Nachweisen** ergänzbar.

## Test und Rollout

1. SQL nur in `BEGIN/ROLLBACK` gegen Live-Schema kompilieren; den RLS-/FK-/GRANT-Vertrag und anonyme Rechte prüfen.
2. PR-CI mit gesamter Regression, getrennten Tests für stabile Quittierung, geänderte Nachweise, Ausnahme, neue Besuche, verschiedene Typen und Mobile/Desktop.
3. Nur nach grüner CI Migration additiv installieren; sofort RLS, nicht berechtigte Anfragen, vorhandene Clanzeit- und Regel-Zeilen sowie den Supabase Security Advisor prüfen.
4. Danach PR mergen, Main-CI/Pages/Release abnehmen, aktive Übergabe aktualisieren und reale Owner-Browserprüfung in der größeren Endabnahme #213 nachholen.
5. Backups #178 um die **clanprivate Review-Entscheidung** erweitern, bevor behauptet wird, ein vollständiger App-Stand sei gesichert. Cross-Tenant-Freigabe #212 bleibt eigenständiges Sicherheits-Gate.

**Hilfe geprüft und aktualisiert:** Cli­enteinstellung DE als Standard; EN #177 weiter offen; keine Mutation an Offline-PWA oder Plan-/Solver-/Krieg-/Collector-Daten.
