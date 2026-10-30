# CWL-Planer Cloud – nächste Etappen (Stand 30.10.2026)

## Umgesetzte UX-Runde v1.1.0-alpha.3

- Gastansicht: nur CSV-/Listenimport prominent, manuelles Hinzufügen unter aufklappbaren Aktionen; Mehrfachauswahl bleibt sichtbar.
- Cloud: erster Import ohne 45-mal „NEU“; neue Zugänge bei späteren Abgleichen erhalten eine Markierung. Ausgetretene Spieler bleiben am Ende ausgegraut mit Teilnahme=Pause.
- Spielernamen werden über den Stift explizit bearbeitet (nicht durch versehentliches Tippen auf Text); Eingabefeld erhält bei Bearbeitung Fokus.
- Mehrfachbearbeitung hat „Fertig“, danach normale Liste. Kein Rätselraten über Schließen.
- „Clash-Reihenfolge“ steht in der Sortierung. Wir verwenden zunächst die Reihenfolge der Mitgliederliste der Supercell-API; diese muss im echten Clan gegen die Spielansicht überprüft werden, falls Clash dort anders sortiert.
- Tagwechsel vermeiden unnötiges Smooth-Scroll. Wegen Safari/Pinch-Zoom muss Bottom-Navigation am echten iPhone weiter geprüft werden; Browser-Zoom lässt sich nicht immer sauber programmgesteuert zurücksetzen.
- Online-Hilfe erklärt Cloud-Import, Rollen, Konflikte und manuellen Export; Gast-Hilfe bleibt unabhängig.
- Änderungsprotokoll: letzte 100 Einträge, Aktualisierung bei erfolgreichem eigenen Speichern und live bei neuen Änderungsereignissen über Realtime. Vollständige Ereignisse bleiben in der Datenbank; eine spätere Suche/Pagination ist möglich.

## CWL-Statusautomatik: prinzipiell realisierbar, noch nicht implementiert

API-Routen und Daten:
1. `GET /clans/{clanTag}/currentwar/leaguegroup` -> CWL-Saison, Clans, Runden und Kriegstags.
2. `GET /clanwarleagues/wars/{warTag}` -> Kriegsstatus, Beginn/Ende, Teams, Gegner, Spieler, RH-Level und Angriffe, sofern sichtbar.
3. Zukünftige Runden können `#0` statt eines gültigen Kriegstags enthalten; nicht als Fehler oder abgeschlossen behandeln.
4. Die Clan-Seite der Kriegsantwort ist nicht immer im Attribut `clan` – sicher anhand des Tags orientieren.

Geplante Architektur:
- Edge Function lädt die CWL-Gruppe und alle zugehörigen Kriegsdaten serverseitig (API-Key niemals im Client).
- Pro Clan/Saison und Kriegs-ID einen eindeutigen Datensatz; Status `preparation`, `inWar`, `warEnded` getrennt speichern.
- Für Gegneransicht Namen, Kriegsstatus, RH-Verteilung und verbleibende Zeit zeigen; falls kein CWL-Krieg sichtbar ist, unverändertes „Tag 1–7“.
- Manuelles `↻` im Plan immer möglich und zentraler *serverseitiger* Zeitplan später alle 10–30 Minuten, während CWL läuft. Free-Tarif-Limits und Proxy-Ausfälle beachten.
- Automatische Bestätigung gespielter Tage **nur** wenn `warEnded`, War-Tag und Endzeit validiert, Krieg vollständig und tatsächliches Line-up dem richtigen Spielertag zugeordnet ist.
- Idempotent und transaktional übernehmen: automatischer Abschluss darf manuelle historische Kriege nicht löschen oder doppelt eintragen. Bei Ausfall unklaren Status anzeigen, **nie** einen Tag automatisch abschließen.
- Nach Abschluss übrige Tage mit bestehendem Scheduler neu berechnen; MUSS/RAUS/FIX und Archiv-Snapshots respektieren.
- Historische API-Daten nach Saisonende sind nicht unbeschränkt verfügbar. Kriege frühzeitig regelmäßig speichern.

## Statistiktab (späteres Feature, noch nicht implementiert)

- Quelle: gesammelte CWL-/CW-Angriffsdatensätze pro Spieler, Krieg, Verteidigungs-RH, Angriff, Sterne, Zerstörung, Zeit.
- Kennzahlen: Angriffe, Trefferquote (klar definieren: z. B. 3★-Rate), Ø Sterne, Ø Zerstörung, Angriff auf gleiches/höheres RH, Ausfall-/Nichtangriffsquote, Saisonfilter.
- Filtersortierung: Saison, Kriegsart, Rathaus-Level, Mindestanzahl Angriffe, Spieler, Gegner, Aktivität.
- Kleine Stichproben sichtbar kennzeichnen; 100 % 3★ bei einem Angriff nicht als stärker als 75 % bei 40 Angriffen behandeln.
- Offizielle API stellt nicht rückwirkend beliebig viele CWL-Angriffsdetails bereit; für alte Daten kann ein externer Historienanbieter nötig sein. Daten anderer Anbieter gesondert auf Aktualität, Nutzungsbedingungen und Kosten prüfen.
- Für ClashPerk-ähnliche Statistiken ist **laufende eigene Datensammlung** Voraussetzung; keine unbegründete Zusage von alten, nicht verfügbaren API-Daten.

## Vor öffentlichem Release

- Praktischer iPhone-Test ohne Zoom und mit Zoom für sticky Navigation; 2 echte Clanführer-Accounts für Konflikte, Viewer und Realtime.
- Import mit Spielern ohne Tags bzw. geändertem Namen validieren; unmarkierte manuelle Mitglieder niemals heimlich löschen.
- Ladezustände, Fehler und Wiederholversuche; API-Ratenlimits; bei Proxy-Ausfall lokaler/Cloud-Kader weiterhin nutzbar.
- Sicherheit: RLS/rollenbasierten Zugriff und Einladungen erneut testen; Supabase meldet aktuell optional deaktivierten Passwort-Leak-Check.
- Hilfe und Changelog bei jeder neuen Funktion aktualisieren.
