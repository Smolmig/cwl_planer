# Clanverwaltung: Tracking-Abdeckung und historische Ergänzung

Stand 25.11.2026. Nur lesende Betreiberdiagnose; keine Änderung produktiver Daten oder Regeln.

## Befund

Der gespeicherte API-Normal-CW vom 17.11.2026 21:44 UTC enthält 29 Angriffe bei 15 Teilnehmern, ist aber nicht finalisiert. Letzte Aktualisierung 17.11. 22:05 UTC. Die neue CW-Missed-Erfassung wurde mit PR #313 am 18.11. 07:45 UTC gemergt. Zeitlicher Zusammenhang plausibel, Kausalität nicht belegt. Ein vollständig beendeter Krieg kann nicht anhand der Uhrzeit oder 29/30 Angriffe behauptet werden.

Drei ältere abgeschlossene normale CWs (11., 13., 15.11.) haben keinen vollständigen Missed-Nachweis; beide abgeschlossenen neueren CWs (19., 22.11.) haben ihn. Der aktuelle Krieg vom 24.11. ist nicht finalisiert. Keine rückwirkenden Sanktionen aus Lücken. Die getrennte Diagnose `scripts/clan-management-tracking-health.sql` meldet alte offene API-Normal-CWs ab 72 Stunden als Prüffälle, nicht als abgeschlossen. Die Diagnose ist ausschließlich für Betreiber, nicht als neue öffentliche RPC gedacht.

## ClashPerk: was nachliefern?

- Für den fehlenden Krieg und die letzten normalen CWs: `/export attack-log` (Regular) und `/export missed` (Regular), wie bereits für den bestehenden Import dokumentiert. Im Discord die tatsächlich vorhandenen Optionen wählen, beide Originaldateien mit überlappendem Zeitraum; CWL separat. Der aktuelle Import unter Statistik übernimmt Angriffsdaten; keine Übernahme in die Rangprüfungen zugesichert.
- Falls vorhanden: historischer War Embed / War Missed Attacks Log zum konkreten Gegner mit eindeutigem Abschluss, Datum, Teamgröße und Player-Tags. Ein fehlender Log ist nicht gleich null Fehlangriffe.
- Für Mitgliedschaft: vorhandene Member Join/Leave Logs inklusive Zeitstempel und Player-Tags; Role Change Log für frühere Ältestenränge; Donation Logs (möglichst einzelne positive Änderungen oder Tageswerte) für historischen Spendenkontext. Die Aktivierung jetzt beweist keine ältere Historie. Members-/Season-Export ist als zusätzlicher Kontext interessant, sein konkretes Format muss anhand realer Dateien geprüft werden; kein historisches Eintrittsdatum aus einer aktuellen Mitgliederliste ableiten.
- Offizielle Dokumentation: https://docs.clashperk.com/features/logs und https://docs.clashperk.com/faq. Beide Dienste beobachten per API-Polling, kurze Clanwechsel können unbemerkt bleiben.

## Folgepaket: sichere Übernahme in Empfehlungen

Vor Implementierung reale Originaldateien gegen API-Krieg, Spieler-Tags, War-ID/Gegner, Zeitstempel, Aufstellung, Abschluss, alle Angriffe und vollständige Missed-Nachweise vergleichen. Identische Quellen deduplizieren (vorhandene Reconciliation v1.19.1); bei partiellen Live-Daten keine Gleichheit aufgrund 29/30 oder Gegner/Datum alleine behaupten. Importierte Historie bleibt bis zur geklärten Herkunft und Konfliktprüfung von automatischen Rangregeln getrennt. Lücken nicht als Inaktivität behandeln; alte Clanzeit/Spenden nur mit getrenntem Herkunftsnachweis, nicht als künstliche API-Snapshots. Keine Änderungen an produktiven Rang-/Clanentscheidungen ohne gesonderte Abnahme.

## UI-Änderung dieses Pakets

Im leeren Bereich der offenen Rangvorschläge werden Anzahl auswertbarer Mitglieder, erreichte Mindest-Clanzeit, Angriffsstichprobe und Dreisternequote dynamisch aus exakt derselben bestehenden Leistungsprüfung ausgewiesen. Fehlende/ungültige Nachweise separat, Rückkehrfälle und andere Ränge nicht in den Nenner. Keine Änderung der Regeln, API-Quellen, Treueprüfung oder Freigaben. Tests für die Grenzwerte und unbekannte Nachweise. Kein öffentlicher Versionsbump vor CI und Release-Abnahme.
