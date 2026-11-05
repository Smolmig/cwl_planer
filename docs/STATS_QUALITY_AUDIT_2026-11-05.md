# Statistik-Qualitätsaudit & Vergleichbare Form — 05.11.2026

## Read-only-DB-Audit (United Fighters)

Gezielt aus dem verbundenen Supabase-Projekt ausschließlich aggregiert gelesen. **Keine Datensätze verändert**.

| Auditbefund | Wert |
|:--|--:|
| Gespeicherte abgeschlossene Kriege | 52 |
| Angriffszeilen | 1.187 |
| Missed-Eintragszeilen | 44 |
| Sicher bekannte versäumte Angriffe | 59 |
| Angriffe mit fehlendem Spieler-/Gegner-RH | 0 |
| Angriffe ohne gegnerischen Player-Tag | 0 |
| Dreisterne-Angriffe unter 100 % Zerstörung | 0 |
| Angriffe mit >= 2 Sternen unter 50 % Zerstörung | 0 |
| CWL: mehr als 1 Angriff je Spieler/Krieg | 0 |
| CW: mehr als 2 Angriffe je Spieler/Krieg | 0 |
| Widersprüchliche Missed-Zeilen (Misses + reale Angriffe > Limit) | 0 |
| Erkennbare doppelte Kriege am selben Kalendertag mit gleichem Gegner-Tag | 0 |
| Historisch importierte Kriege ohne belegte endgültige API-Roster | 50 |
| Historische CWL-Kriegstage ohne vollständige Missed-Abdeckung | 21 |

**Abdeckung:** 30 von 30 normalen CWs sind hinsichtlich Missed auswertbar, nur 1 von 22 CWL-Kriegstagen. Die 57 normalen Misses sind exakt; die 2 historischen CWL-Misses sind eine sichere **Untergrenze**. Fehlende Datensätze sind **keine** nachgewiesenen 0.

## Statistik-Sichten und Vergleichsregeln

1. **Clanstatistik Rohdaten:** Nach War-Typ und gespeicherten Kriegsfenstern; für jeden Angriff die originalen 0–3★ und erreichten Zerstörungsprozente. Unabhängige Datenqualitätsanzeige für Missed-CW und CWL.
2. **Mitgliederliste:** Bisherige letzte sieben Angriffe bleiben als stabiler, leicht verständlicher Vergleich; keine Änderung an der CWL-Aufstellung.
3. **Testansicht „Vergleichbare Form“:** 30 Tage **gleiches** Rathaus, 90 Tage gleiches Rathaus mit Halbwertszeit 30 Tage, klare CWL-/Normal-CW-Anteile, Quelle, `n_eff = (sum(w))²/sum(w²)`; nicht ausgewertete leichter/schwerer/unbekannte RH dokumentieren. Angaben als **beobachtete**, keine vorhergesagten Quoten.
4. **Datenqualität:** n_eff <5: wenig Daten; bei n_eff >=5 und >=2 aktuelle Angriffen erste Tendenz; n_eff>=12 und >=5 aktuelle Angriffe eine bessere Datenbasis. Wenn neuester Angriff älter als 30 Tage ist: **nicht aktuell**. Diese Kategorien sind praktische UI-Warnungen, nicht statistische Konfidenzintervalle.

## Vollständigkeit und historische Grenzen

- Kein automatisch erfundenes „gegenüber angegriffen“, da `mapPosition` historisch nicht gespeichert ist.
- Kein bekannter First-Hit/Cleanup-/Rush-/Helden-/Meta-Status historisch; daher **keine** blind kalibrierte Wahrscheinlichkeit und **keine** Auto-Aufstellung nach diesem Score.
- Für **CWL Missed Attacks** sind weiter **finale Tagesrosters und vollständige Attack-Logs oder komplette Missed-Logs der 21 alten CWL-Tage** nötig. Ein initiales CWL-Melde-Roster reicht nicht.
- Für die Zukunft native `mapPosition`, originalen globalen Angriff-`order`, Kriegs-Endstatus und vollständige Tagesrosters additiv aufnehmen, wenn sauber aus offiziellen API-Daten verfügbar. Das ist ein eigener getesteter Migrations-/Proxy-Schritt, kein rückwirkendes Auffüllen historischer Felder.
- Alte ClashPerk-Archive aus anderen Clans pro **Player-Tag** als unabhängige Quelle nur nach fachlicher Prüfung importieren, keine Dubletten via Namen.

## Offene Validierungsaufgaben vor Umstellung der Hauptkennzahl

- Chronologischer Offline-Backtest aus den 1.187 verfügbaren Angriffen: aktuelles „7 letzte“ vs. gleiches RH/30 Tage vs. gleiches RH/90 Tage mit Halbwertszeit und ggf. CWL-Gewichtung. Nur *vergangene* Angriffe verwenden, um *spätere* zu bewerten. Kalibrierung getrennt von zukünftiger Trainingsbasis.
- n_eff mit stabiler Qualitätsvorschau pro Spieler vergleichen, frühere Clan-Tags und aktuelle RH-Level getrennt prüfen.
- Für zukünftige War-Snapshots echte Map-Position und Erstangriff sauber erfassen. Datenbankmigration nur additiv mit RLS-Review/Backup und separatem Test, ausdrücklich niemals alte Positionen rückwirkend erraten.
- Drei Werte später separat: aktuelle Form, belastbare Langfrist-Leistung, Zuverlässigkeit. Keine Bonus-/Loot-/8★-Solver-Veränderung, bevor die Formmessung besser ist.

Referenzen: `docs/CWL_PLAYER_PERFORMANCE_RESEARCH_2026-11-05.md`, `docs/CLASHPERK_EXPORTS_AND_MISSED_COVERAGE.md`, #88 und #90.
