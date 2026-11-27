# CWL-Ligaregeln – Nachweis und Freigabe (26.11.2026)

- [Offizieller Support: Matchmaking & Groups](https://sc-clashofclans.zendesk.com/hc/en-us/articles/49529065605403-Matchmaking-Groups): Crystal III bei acht Clans zwei Auf-/zwei Absteiger; unbesetzte unterste Plätze bleiben unbesetzt.
- [April-Änderung](https://supercell.com/en/games/clashofclans/blog/release-notes/the-sound-of-clash-update/): Titan-/Legend-Ligen und geänderte Auf-/Abstiegszahlen.
- [Oktober-Ankündigung, sekundäre Wiedergabe](https://www.reddit.com/r/ClashOfClans/comments/1wt8e7h/cwl_promotion_and_demotion_slots_will_be/).
- [November 2026, sekundäre Referenz](https://goofygoblins.gg/tools/cwl), [Master II Saisonhistorie](https://goofygoblins.gg/tools/cwl/master-ii): selbst Master II hatte im August/September 2026 andere Abstiegsplätze. Kein Dezember-Nachweis, keine externe Datenbank in App übernehmen.

## Referenz zur manuellen Prüfung, keine Dezember-Freigabe

| Liga | Auf / Ab (November-Referenz) |
|---|---|
| Legend | 0 / 2 |
| Titan I–III | 1 / 2 |
| Champion I–III | 1 / 2 |
| Master I | 1 / 2 |
| Master II–III | 2 / 2 |
| Crystal I–III | 2 / 2 |
| Gold I–III | 2 / 2 |
| Silver I–II | 2 / 2 |
| Silver III | 2 / 1 |
| Bronze I–II | 3 / 1 |
| Bronze III | 3 / 0 |

## Pilot-Nachweis

Default: keine Regel konfiguriert, kein tabellenbedingter Moduswechsel. Die mathematische Platzspanne bleibt verfügbar. Betreiber darf erst nach Sichtprüfung der tatsächlichen Ingame-Tabelle und dokumentiertem Nachweis einen Eintrag in die optionale Servervariable CWL_STRATEGIC_REVIEWED_LEAGUE_RULES aufnehmen. Kein Client-Eingabepfad, keine automatische Befüllung. Feature-Flag, UUID-Allowlist, RLS bleiben Pflicht.

Beispielschema (rein fiktiv):
```json
[{"clanId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","clanTag":"#P02","season":"2026-12","teamSize":15,"anchorWarTag":"#PQQ","league":"Master II","fullGroupSize":8,"promotionPlaces":2,"demotionPlaces":2,"source":"in_game_current_group","verifiedAt":"2026-12-03T12:00:00.000Z"}]
```

Eigener beobachteter WarTag bindet die Regel an die konkrete Gruppe auch bei zwei CWLs im Monat. Falscher Tenant/Clan, Format, Monat, Gruppe, Zukunft, doppelte Einträge oder ungültige Werte führen zu unbekannten Regeln. Das ist kein kryptografischer Nachweis, Betreiber muss tatsächlich prüfen. Keine Dezember-Werte freigegeben, keine Secrets gesetzt. Bei Regeländerung Eintrag entfernen und neu prüfen; kurze Vorschau-Gültigkeit bleibt bestehen. Kein automatischer Moduswechsel.

## Abnahme #213

Lokal: Default-off, gefälschte Client-Regel, exakte Serverregel, doppelte/abweichende Records, sechs statt acht Clans. Live Dezember: tatsächliche Ingame-Liga und Pfeile, eigener WarTag, Saison/Format abgleichen; nachvollziehbare Tabellenlage und Wechsel nur als Vorschlag. Hosted-/Geräteabnahme und echte Modellkalibrierung bleiben offen.
