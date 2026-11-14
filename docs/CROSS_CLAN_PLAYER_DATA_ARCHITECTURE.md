# Entwurf: clanübergreifende Spielerdaten-Architektur (10.11.2026)

> **Status: Konzept / keine produktive Cross-Tenant-Datenfreigabe.** Technische Umsetzung nur nach #212 (Security/Privacy/Source-Qualität), #103 (bisherige Partnerclan-Sicht) und #104 (Collector); während der Entwicklung ggf. unabhängige Branches. Dieses Dokument ist die gemeinsame fachliche Linie für Statistik, Clanmanager, Planer und Testabnahme #213.

## 1. Produktziel und harte Trennung

Wenn ein Player-Tag während einer CWL bei UF2 oder irgendeinem anderen **berechtigt angebundenen Cloud-Clan** spielt, sollen dessen **nachweisbare Angriffsfakten** unabhängig von Browser/Owner später bei Rückkehr in den Hauptclan **dort nachvollziehbar berücksichtigt werden können**. Die Anwendungsfälle sind Statistik, Spielerform, RH-Verhältnis, nachweislich ausgelassene Angriffe und geeignete Aktivitätsindikatoren. Ein *App-Client/Gerät* speichert **nicht** die autoritative Historie; serverseitige Collector-/Datenbank-Jobs erfassen sie nach Möglichkeit auch ohne geöffnete App.

**Globale Player-Identität != globale Clanmitgliedschaft != globale Zugriffsberechtigung.** Ein Clash-Player-Tag identifiziert den Spieler; ein Clash-Clan-Tag identifiziert einen Spielclan; die App-`clan_id` identifiziert einen eigenständig berechtigten **App-Tenant**. Mehrere App-Tenants dürfen auf denselben echten Clash-Clan-Tag zeigen, ohne gemeinsame privaten Rechte/Notizen zu bekommen.

| Datenart | Langfristiges Ziel | Berechtigungsgrenze |
| --- | --- | --- |
| **Belegter Angriff**: War-Key, Player-Tag, Clash-Clan, CW/CWL, eigener RH-Stand und Gegner-RH, Sterne, Zerstörung, Zeitpunkt/Quelle | Zentral dedupliziert und in berechtigt geteilten Auswertungen wiederverwendbar | Nur belegte, erlaubte, erforderliche Felder der freigegebenen Projektion; keine fremde tenantprivate Tabelle |
| **Echtes Missed**: Pflichtteilnahme, abgeschlossener Krieg, vollständiges Roster/Log/Counter | Als nachweisbares Ereignis mit Quelle und Qualität referenzierbar | Andere Clans dürfen daraus nicht automatisch Strikes/Bestrafungen ableiten |
| **Aktivitätssignal**: dokumentierter Angriff, Spenden-Delta, Player-XP-/RH-Fortschritt etc. | Mit Stärke, Beobachtungszeit, Herkunft und Frische verwertbar, wenn erlaubt | Kein genaues „zuletzt online“, keine global durchsuchbare private Mitgliederüberwachung |
| **Clan-Mitgliedschaft** | Zeitgebundene, beobachtete Präsenz je Clash-Clan-Tag + Player-Tag | Bewertungen der Mitgliedschaftsdauer je App-Clan; keine angenommene historische Eintrittssekunde |
| **Rang** | Aktueller und vorheriger *beobachteter* Ingame-Rang pro realem Clash-Clan | Separat von App-Owner/Vize/Viewer; kein clanübergreifender Rangtransfer |
| **Clanregeln, Notizen, Owner-Entscheidungen** | Immer tenantprivat | RLS strikt auf App-`clan_id`; keine globalen Verwaltungs-Reads |
| **CWL-Einsatzplan, Bonus-/Goldpass-Ziele** | Immer ausgewählter App-Clan und konkrete Saison | Auswärtige Angriffe dürfen nicht 8★ dieser CWL oder aktuelle Tage erfüllen |

## 2. Eingangsquelle, Normalisierung und Deduplikation

1. Eine **serverseitige** Collector-Instanz verwaltet Poll-/Retry-/Queue-Status, nicht jeder Browser. Je eindeutigem `clash_clan_tag` Polls bündeln, aber Berechtigungen der beteiligten App-Tenants getrennt halten. Signaturen, Auth und API-Rate-Limits nach #104 beachten.
2. Quellen bleiben als **Belege** erhalten: `source_type` (API/ClashPerk-Import/manuell), `source_app_clan_id`, `source_clash_clan_tag`, `observed_at`, `war_end`, `coverage`, `confidence`, optional Roh-Hash/Origin-ID. Es gibt nicht pauschal „kein Angriff = 0 Sterne“.
3. Normierte War-Identität aus echten API-`warTag` für CWL bzw. verifizierbarer CW-Kombination aus Clan-Tags/Zeiten. Attack-Key aus War-Key + Player-Tag + Attack-ID/Order. **Doppelte Beobachtung** (zwei Besitzer, beide War-Seiten, mehrfacher Cron) erhöht keinen Counter. Versionierte Korrekturregeln; Rohbeleg nicht überschreiben.
4. Saison/War/Clash-Clan-Roster und damaliges Spieler-/Gegner-RH **zum Angriff** sind entscheidend. RH-Upgrades später dürfen historische Verhältnisse nicht umdeuten. Gleiches RH / niedriges RH / höheres RH getrennt mit (n) darstellen.
5. **Missed** ausschließlich aus endgültigem Kriegsstatus und vollständigem belegtem Roster/Attacklog (ggf. echter API-Angriffszähler) ableiten. Unvollständige historische CWL bleibt „unbekannt“ (#90). Ein geschlossener Krieg ohne historisch erfasste Einzelangriffe lässt sich nicht einfach aus Warlog-Zusammenfassung rekonstruieren.
6. **Aktivität** ist ein Satz von Ereignissen aus Player-Profiländerungen und War-Angriffen. Keine negative Interpretation aus ausbleibenden Änderungen; bei saisonalem Spendenreset keinen falschen negativen Wert. Jedes Signal zeigt Frische und Provenienz.

## 3. Autorisierung und Zugriffsschutz

- **Vor Umsetzung** Supercell-Nutzungsbedingungen und EU-Privatsphäre-Anforderungen, transparenten Hinweis und zweckbezogene Freigabe-/Widerrufsregel prüfen. API-Verfügbarkeit allein ist **keine** universelle Freigabe. Ziel ist eine serverseitig erzeugte, **minimale abgeleitete Share-Projektion**, niemals Browser-Zugriff auf fremde rohe `cwl_stat_*`, `cwl_profile_*` oder administrative Tabellen. Der bisherige explizit freigegebene Partnerclan-Pfad #103 bleibt funktionierender Mindestumfang.
- Zugriff auf globale Playerhistorie nur für sachlichen Anlass (z. B. Player im aktuell verwalteten Clash-Clan, explizit angefragter Player-Tag mit berechtigter Statistikansicht); Rate-Limit, Audit und RLS/RPC nicht nur Client-Filter.
- Tenantprivate Verwaltungsentscheidungen, Quittierungen, Notizen, Aktivitätsbewertungen, Invite-/Auth-Daten dürfen nie aus einer fremden App-`clan_id` mitkopiert werden. Aus dem globalen Kern gelesene Missed-Ereignisse werden **nicht** automatisch zu Clan-Verstößen.
- Widerruf/Entfernung eines App-Tenants muss Regeln für Herkunft, Backups, abgeleitete Statistiken, eigene Clanhistorie und Berechtigung klar definieren; dieses Verhalten vor produktivem Start festlegen.

## 4. Rückkehr, Ränge und Qualifikationszeit

Beispiel: Spieler ist in **UF** bereits als Ältester beobachtet, tritt nach **UF2** über, wird dort Ältester und kommt nach **UF** zurück. **Offizieller Supercell-Stand beim erneuten Clanbeitritt: immer Member.** Die App zeigt daher den neuen echten UF-Rang **Member** und getrennt die Historie **„früher bei UF Ältester“** mit optionaler *manueller* Wiederbeförderungsempfehlung. Die UF2-Ranghistorie bleibt UF2 und verändert UF nicht.

**Abwesenheitsreset nach z. B. 10 Tagen** ist eine **clanspezifische Bewertungsregel** (ab wann die neue Qualifikations-Epoche beginnt), **kein Löschen der originalen Mitgliedschafts-/Rang-/Angriffshistorie**. Nachweisbar beobachtete Intervalle konservativ zählen; Zwischenlücken als Datenlücken kennzeichnen. Für Managerregeln nur gesichert verifizierte Ergebnisse und eigene Owner-Ausnahmen einsetzen.

Quellen: [Supercell Clan Roles](https://support.supercell.com/clash-of-clans/en/articles/clan-roles-3.html), [Supercell Terms](https://supercell.com/en/terms-of-service/), [CoC-Developer-Portal](https://developer.clashofclans.com/#/documentation).

## 5. Stufen der Umsetzung

1. **Verträge/Datenklassifikation/Audit:** Welche Quellen sind wirklich erlaubt, welche Daten dürfen geteilt werden, wie wird widerrufen? Baseline RLS/Kosten/DB-Schema und vorhandene 3 Clanprofile aus #103, #104, #183 lesen.
2. **Shadow-Normalisierung**: War-/Attack-Keys und Source-Qualität ohne sichtbares globales Sharing, Dry-Run auf Duplikate und Konflikte; private Tabellen unberührt.
3. **Staging-Server-RPC mit RLS-/Berechtigungsgates:** minimal berechtigte geteilte Beobachtungen; Tests mit 2 unabhängigen Ownern und zwei App-Profilen desselben Clash-Clan-Tags; kein breiter SELECT.
4. **Feature-Flag und UI:** Statistik zeigt Clan, War, RH, n, Frische und Qualität; Manager übernimmt zulässige Auswärtssignale nur als Beobachtung, nicht als automatische Strafe; Planer bleibt auf lokale Saison begrenzt.
5. **Skalierungs-/Chaos-Test** für 10/100/1000 *simulierte* Clans, API-429, fehlende Cron-Trigger, Warlog privat, Offline-/App-Abmeldung; tatsächliche Kosten/DB-Last; gezielter Rollback und #178-Backup.
6. **Abnahme:** Nutzercheckliste #213, Automatik/Vertrags-/Datenqualitäts-Gates, echte nächste CWL sofern nötig. Erst dann breitere Aktivierung.

**Nichtziele jetzt:** kein RLS-Lockern, keine automatische Ingame-Beförderung/Strafe, keine manipulierten gespielten CWL-Tage, keine globale private Clan-Datenbank und keine angebliche 100-%-Historie für beliebige Spieler. Produktwunsch ≠ bereits live.

**Issues:** [#212](https://github.com/Smolmig/cwl_planer/issues/212), [#103](https://github.com/Smolmig/cwl_planer/issues/103), [#183](https://github.com/Smolmig/cwl_planer/issues/183), [#104](https://github.com/Smolmig/cwl_planer/issues/104), [#90](https://github.com/Smolmig/cwl_planer/issues/90), [#213](https://github.com/Smolmig/cwl_planer/issues/213).


## 14.11.2026 – Erste sichere, lesende Spieler-Verknüpfung (Cloud v1.21.0)

Die App kann bei **bewusstem Klick innerhalb der Angriffsdetails** bereits dokumentierte Ergebnisse desselben Player-Tags in anderen **für den angemeldeten Benutzer ohnehin lesbaren App-Clans** abrufen. Der Client nutzt ausschließlich die regulären RLS-geschützten `cwl_clans`, `cwl_stat_attacks` und `cwl_stat_wars` mit dem authentifizierten Supabase-Client. Ein fremdes App-Tenant kann dadurch nicht ohne bestehende Berechtigung geöffnet werden. Statistiken bleiben pro App-Tenant getrennt, und eigene CWL-Planung, Notizen, Verwaltungsregeln und Missed-Disziplinarstrafen bleiben ausdrücklich unberührt.

**Wichtig:** Dies ist eine *erste, bewusst begrenzte Lesefunktion*, **nicht** das globale, autorisierte Player-Faktenregister aus #212. Es gibt weder eine neue allgemeine Zugriffsberechtigung noch eine automatisch deduplizierte global kombinierte Leistung. Alte Import- und API-Rohbelege können je Clan mehrfach vorliegen; die Detailansicht markiert bei mehreren Quellen die Rohdaten. Sie ist nicht für automatische Ranking- oder Planungsempfehlungen freigegeben. Für echte unabhängige Clanbetreiber benötigen wir weiterhin Datenschutz-/Einwilligungsmodell, serverseitige Share-Projektion, Rate-Limits, RLS-/Widerrufstests und Source-Alias-Verifikation. Ein letztes RH aus einem Angriff wird als **historisch belegt**, niemals als aktuelles API-Profil-RH gekennzeichnet.


## 14.11.2026 – Stufe 2: aktuelles öffentliches Spielerprofil, ausdrücklich auf Abruf (v1.22.0)

Der vorhandene Clanmitglieder-Endpunkt liefert keine aktuellen RH-Daten für **ehemalige** Mitglieder. Deshalb ist die gesonderte authentifizierte Edge Function `coc-player-profile` vorgesehen: Bei einem einzelnen, im aktuell berechtigten App-Clan nachweislich dokumentierten Angreifer fragt sie über den serverseitigen Clash-API-Schlüssel ausschließlich das aktuelle, öffentliche Spielerprofil ab. Zur Ausgabe gehören **Player-Tag, aktueller Anzeigename, aktuelles RH, aktuelle Clanzugehörigkeit und genauer API-Prüfzeitpunkt**. Die Abfrage verändert weder bestehende Spielerstatistiken noch das beim Angriff dokumentierte eigene oder gegnerische RH.

**Sicherheitsfolge:** `withSupabase({auth:"user"})` und `verify_jwt=true`; zuerst bestehende Benutzer-zu-App-Clan-Mitgliedschaft, anschließend Angriffsnachweis unter exakt derselben `clan_id` und `player_tag` (beides mit der Benutzeridentität und RLS), erst danach Cache- oder externer API-Zugriff. Leere/unbekannte/ungültige Tags und private fremde Clans werden abgewiesen. Der API-Schlüssel bleibt serverseitig; Antwortfelder werden begrenzt, Abfragen pro Isolat beschränkt und 5 Minuten gepuffert. Ein Isolat-Limit ist ausdrücklich **kein globales Rate-Limit**, daher keine Öffnung als frei durchsuchbare Spielerdatenbank.

**Produktposition:** Die Funktion wird innerhalb der aufklappbaren Spielerform-Details über „Aktuelles RH prüfen“ aufgerufen. Es wird kein sofortiger Profilscan aller Clanmitglieder durchgeführt, um Last, falsche Frischebehauptungen und UI-Informationsflut zu vermeiden. Ein gezeigtes RH ist nur **zum angegebenen Prüfzeitpunkt aktuell**; ein altes Foto/Snapshot bleibt `zuletzt bekannt`. Der appweite Angriffsfakten-Dedup und unabhängige Besitzer-übergreifende Freigaben erfordern weiterhin #212 Stufe 3+ (separate Serverprojektion, RLS, Einwilligung und Widerruf).
