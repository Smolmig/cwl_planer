> **Phase 2d2 OFFIZIELL LIVE (10.11.2026, v1.16.57, PR #218):** Die bisherigen zwei Owner-only Ereignisquellen werden jetzt durch einen eigens owner-geprüften, read-only SECURITY INVOKER Bericht zusammengeführt. Optionaler Treuepfad ist **standardmäßig AUS**, pro App-Clan per CAS-Regel konfigurierbar (60 nachweislich bestätigte Clantage, 50 positive beobachtete Spenden, mindestens 3 UTC-Spendentage in 30 Tagen, letztes positives Ereignis binnen 14 Tagen). Bei nachgewiesenen Kriterien lediglich **„Treue: Beförderung prüfen“**, selbst ohne CW. Die Empfehlung behauptet weder vollständige Teilnahmezuverlässigkeit noch fehlende verpasste Angriffe. Bei registriertem Wiedereintritt, aber fehlendem Abwesenheitsprotokoll, Datenlücken oder einer >=10-Tage **beobachteten** Abwesenheitsserie **keine Treue-Beförderung**: nur Sachverhalt manuell prüfen, kumulierte bestätigte Clanzeit bleibt unverändert. Auswahl `absence_reset_days=null` deaktiviert die Abwesenheits-Schwellenprüfung. Nachweisqualität und bekannte Grenzen bleiben wie unten dokumentiert. Keine automatische Reset-/Rang-/Kick-Aktion, kein Cross-Tenant-Sharing. Vollständiges Backup #178 muss die neuen Regeln mit einbeziehen.\n\n# Clanverwaltung #183 – Phase 2d1: belegte Treue-Signale

**Status: Vorbereitung, noch keine Treue-Beförderung live.** Diese Phase speichert künftig automatisch nur zwei zusätzliche **clanprivate** Nachweisarten, wenn der bestehende signierte Collector eine vollständige Clash-Mitgliederliste erfolgreich verarbeitet. Bestehende Quellen / RLS / Auth / Clash-Abgleich / Angriffsarchive bleiben unverändert.

## Gespeicherte Beobachtungen

1. `cwl_clan_donation_observations`: positive **beobachtete** Spendenänderung während zweier vollständiger, höchstens drei Stunden auseinanderliegender saisonaler Mitglieder-Snapshots; dedupliziert anhand App-Clan + Clash-Clan-Tag + Player-Tag + Beobachtungszeit. Der erste Snapshot zählt niemals als Spendenzuwachs; rückläufige Saisonwerte sind kein negatives Ereignis. Keine Rückrechnung alter Spenden.
2. `cwl_clan_absence_observations`: ein Eintrag pro **beobachtetem** Austritt, angereichert um Anzahl tatsächlich fehlender Snapshots, den längsten beobachteten Zeitabschnitt mit aufeinanderfolgenden vollständigen API-Abfragen (maximal drei Stunden Abstand) und den beobachteten Rückkehr-Snapshot. Unterbrechungen im Polling setzen die aktuelle Sequenz auf null; fehlende Zeit wird niemals aufgefüllt. Weder exakter Aus- oder Eintrittszeitpunkt noch Online-/Offline-Zeit sind aus den Daten ableitbar.

Beide Tabellen besitzen RLS und lassen **ausschließlich Clan-Owner derselben App-Clan-ID** lesend zu. Schreiben erfolgt ausschließlich innerhalb des bestehenden Service-RPC-Transaktionspfads per SECURITY INVOKER Trigger; keine Freigabe an andere Tenant-Owner, keine neue Service-Key-Nutzung im Browser. Keine Änderungen am `confirmed_seconds`-Zähler.

## Bewusst nicht aktiviert

- Bestehende Einstellungen `loyalty_min_days=60` und `absence_reset_days=10` bleiben **reserviert**: keine automatische Qualifikations-Epochen-Berechnung, keine Beförderung auf Basis nur eines Spendendeltas, keine automatische Degradierung/Kick.
- Die künftige Treuebewertung benötigt **konfigurierbare Mindestspenden und Zeitfenster**, verlässliche Besuchs-Epochen, das Heranziehen ausschließlich rechtmäßig zugänglicher Beobachtungen sowie klare Statushinweise zur Datenabdeckung.
- Bei einem verborgenen Wechsel zwischen zwei vollständigen Mitgliedersnapshots ist selbst die beobachtete Abwesenheitssequenz kein absoluter Beweis kontinuierlicher Abwesenheit. Vor einem 10-Tage-Reset ist daher gesonderte Regel-/Review-Logik erforderlich.
- Historische Spiel-/Clan- und Spendenereignisse vor diesem Deploy bleiben **unbekannt**. Rückwirkend wird nichts als belegt ausgegeben.

## Sicherer Rollout & Prüfung

1. PR-Regressionssuite inkl. `tests/clan-management-loyalty-evidence.test.cjs` grün; Migration gegen Live-Schema **nur in einer zurückgerollten SQL-Transaktion** validieren.
2. Erst danach `cwl_clan_loyalty_evidence_v1` als einzelne additive Migration anwenden, ursprüngliche RPC-Version unverändert lassen.
3. Security Advisor prüfen; RLS/GRANT ohne veränderte Ownerrechte bestätigen. Mit **read-only Aggregaten** erst nach weiteren echten vollständigen Collector-Läufen nachweisen, ob erste neue Spenden- oder Abwesenheitsnachweise entstanden sind. Die leere Tabelle bei bislang null dokumentierten Wiedereintritten ist kein Fehlschlag.
4. Für einen gezielten Test von Austritt/Return/Replay und Spenden kann später nur eine **rollback-only** Testtransaktion mit Dummy-Tenant/RPC-Rollen genutzt werden; keine realen Spieler und keine Live-Ränge manipulieren.
5. **Hilfe-Audit:** kein neues nutzerseitiges Feature, bestehende Hilfe behält bewusst die Aussage, dass Treue-/Reset-Kriterien noch nicht für Empfehlungen verwendet werden. DE-UI unverändert; EN #177 weiterhin Backlog.

## Spätere Phase 2d2

Pro-Clan justierbare Spendenquote/Zeitraum mit ausreichender Nachweiszeit, Besuchs-Epochen und 7-/11-Tage-Rückkehrtests implementieren; `#212` darf fremde Clanprivatdaten nicht freigeben. Vor Produktivaktivierung vom Owner nachvollziehbare Quellenangabe, Stichprobe und manuelle Prüfregel, ohne Schluss von „kein Signal“ auf „offline“. Endabnahme #213 ergänzen.


**Live-Nachweis:** PR 602/602, Main 602/602, Pages/Release erfolgreich; Supabase-Owner-RPC installiert, bisher 0 automatisch identifizierte qualifizierte Personen. Die folgenden alten Phase-2d1-Rolloutschritte bleiben als historische Nachvollziehbarkeit erhalten. Die ownerseitige Praxisabnahme ist noch offen.
