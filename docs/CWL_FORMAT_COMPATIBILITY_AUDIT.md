# CWL-Kompatibilitätsaudit – Gruppenlänge, Kriegsgröße und Cloud-Format

**Erstellt:** 11.11.2026 · **Issue:** [#254](https://github.com/Smolmig/cwl_planer/issues/254).  
**Status:** gesicherte Regeln und konkrete Codeprüfung; reale Geräte-/API-Abnahme steht gesondert aus.

## 1. Offizielle Clash-Regeln

- **Normale CWL:** acht Clans in einer Gruppe, jeder kämpft einmal gegen jeden anderen, folglich **sieben echte Kriegstage**. Häufig als achttägiger Ablauf mit Vorbereitung beschrieben – kein achter Ligakrieg.
- **Verkürzte CWL:** offiziell **sechs Clans**, jeder gegen fünf Gegner, folglich **fünf echte Kriegstage**. Supercell bestätigte diese Gruppenstruktur und z. B. die besonderen Februar-Saisons 2022 und 2024.
- **Erste Teilnahme eines Clans:** anfängliche Ligaplatzierung anhand der Stärke der 15 bzw. 30 stärksten angemeldeten Spieler; **das erzeugt nicht automatisch fünf Kriegstage**.
- **Spieler pro Krieg:** aktuell 15v15 oder 30v30 (höhere Ligen nur 15v15). **Historisches 5v5** wurde im offiziellen Februar-Update 2026 eingeführt und im März 2026 offiziell angeboten, aber danach für April wieder herausgenommen. Alte 5v5-Ligen weiterhin korrekt anzeigen; künftige Änderungen von Supercell nicht durch willkürliche UI-Sperren ausschließen.
- **11 Spieler:** Nicht als offiziell zugelassenes 11v11-CWL-Format belegt. 11 Spieler **im Kader für eine 5er-Tagesaufstellung** sind zulässig und anders zu behandeln. Normale/freundschaftliche Clankriege bleiben ein eigener Datentyp.

**Quellen:**
- https://support.supercell.com/clash-of-clans/en/articles/cwl-matchmaking-and-groups.html
- https://support.supercell.com/clash-of-clans/en/articles/about-cwl-3.html
- https://supercell.com/en/games/clashofclans/blog/news/february-clan-war-leagues
- https://supercell.com/en/games/clashofclans/blog/release-notes/the-february-update-has-escaped/
- https://supercell.com/en/games/clashofclans/blog/news/its-time-for-dragon-escape/

## 2. Architektur nach Audit

| Teil | Befund/Handlung | Grenze |
| --- | --- | --- |
| **Solver `cwl-planning-core.js`** | Bereits 1–7 Tage und 1–50 Plätze, inkl. 15/30; neue 5-Tage-/5er-/11er-Kader-Fixtures | Eingestellte exakte Einsatzziele können nach offiziell kürzerer Liga unzulässig sein: Konflikt anzeigen, nicht heimlich ändern |
| **Cloud-Kriegstage** | Verifizierte Supercell-Gruppenkennung sechs Clans → fünf Kriege, acht Clans → sieben; im Snapshot `warCount` gespeichert | Fehlender/widersprüchlicher Gruppensnapshot → **nicht** auf gut Glück auf fünf kürzen |
| **Cloud-Kriegsgröße** | Eindeutige API-`teamSize` aus belegten Kriegs-/Gruppendaten verwenden, bevor Tage abgeschlossen werden; für verknüpfte Clans manuelle Größenkontrollen deaktivieren | Bei bereits gespielten/gesperrten Tagen **keine** rückwirkende Änderung von `config`; Bedarf an zusätzlichem Mismatch-Hinweis |
| **Postseason / Tabelle** | Gruppen mit sechs Clans nur fünf Runden und 15 Paarungen; fünf belegte API-Endstände können echte 5/5-Vollständigkeit ergeben | Unbekannter letzter Krieg ist weiter *unbekannt*, niemals 0★ oder künstlich abgeschlossen |
| **Archiv / lokaler Owner-Cycle** | Gesicherte fünf originalen API-Aufstellungen als vollständig archivieren; Sonderformat und Anzahl im Archiv speichern | Kein neuer ownerloser serverseitiger Plan-Zyklus ohne #227-Sicherheitsdesign |
| **Serverfreigabe** | Seit v1.16.72 exakte `cycle_id`/Saison und Service-Gruppenarchiv verifiziert | Separate Migration `20261111192000_cwl_review_final_actual_round_five_or_seven.sql` **in Prüfung**: legt wirkliche letzte Runde (5/7) aus einer vollständigen validierten 6-/8-Clan-Gruppe fest. Ohne archivierten Finalbeleg bleibt der Abschluss offen. Bis erfolgreicher CI, DB-Migration und Live-SQL-Verifikation nicht als produktiv abgesichert bezeichnen |
| **Historische Daten** | Read-only 5v5, 5/5, 6/7, 7/7 nach Quellenqualität | Keine nachträgliche Umdeutung von `played`, alten Attacken, Gesamtroster oder Sternen |

## 3. Freigabe- und UAT-Matrix

1. Gruppe 8, **7/7**, 15v15 – weiterhin einwandfrei; Standard-Solver mit Rotation und 8★.
2. Gruppe 8, **7/7**, 30v30 – automatische 30 aus bestätigter Vorbereitung/TeamSize, vorherige 15er-Saison niemals mit derselben Aufstellung weiterverwenden.
3. Gruppe 6, **5/5**, 15v15/30v30 – fünf echte Kriege, fünfter als letzter, keine Phantomtage 6 oder 7, finale Tabelle und Archiv.
4. Historisches 5v5 und **11 registrierte Spieler mit fünf Tagesplätzen** – korrekt unterscheiden.
5. Normale sieben-Tage-CWL, nur **6/7** wirklich beendet – *unvollständig*; nicht als fünf-Tage-Sonderfall klassifizieren.
6. Neue Liga vor Tag 1 (auch noch ohne Mannschaftsaufstellung), vorübergehend leeres Matchup-Array, API-429, Clanwechsel und zwei Browser – keine falsche Größenentscheidung, keine Überschreibung.
7. Owner/Vize/Viewer & 320/390/430px, Desktop, Arena/Dark/Light; Cloud vs Offline strikt getrennt.
8. Veralteter Browser, neue Saison, RLS/checked-RPC und archivierte fünf/ sieben Kriegstage; niemals fremden App-Clan oder altes Saisonarchiv überschreiben.

**Abnahmegrenze:** Automatisierte Tests mit synthetischen offiziellen Gruppenantworten ersetzen keine echte 30er- oder verkürzte Supercell-Saison. Ob Supercell zukünftige andere Formate zulässt, bestimmt ausschließlich deren aktuelle API und Dokumentation.

## 4. Nachprüfung des serverseitigen Final-Guards (#254)

Die gezielte SQL-Migration `supabase/migrations/20261111192000_cwl_review_final_actual_round_five_or_seven.sql` ersetzt ausschließlich `private.cwl_review_last_round_ended` und ergänzt den nicht für Browser freigegebenen, deterministischen Helfer `private.cwl_review_group_final_ended`. Sie übernimmt **keinen** Wert von Browser/Konfiguration und ändert keine Bestandsdaten. Nach CI und kontrollierter Anwendung prüft `tests/sql/cwl-review-final-5-7-fixtures.sql` ausschließlich synthetische JSON-Gruppen; die Query muss **0 Zeilen** liefern. Zusätzlich: Rechte der privaten Funktionen für `anon` und `authenticated` verneinen, vier bereits vorhandene `*_checked`-RPCs auf unveränderte Authentifizierung prüfen, mit vorhandenen 8-Clan-Archiven die Erhaltung der bisherigen 7er-Erkennung nachweisen, Datenzeilenzahlen vor/nach Anwendung vergleichen. Kein einzelner fehlender API-Krieg gilt als 0 oder abgeschlossen. Bis echte 5er-CWL in Clash beobachtet wurde, nur synthetische Integrationsabdeckung; reales Gerät/Owner/Vize/Viewer #213 bleibt erforderlich.
