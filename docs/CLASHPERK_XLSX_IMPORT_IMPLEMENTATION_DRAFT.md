# #269 – Direkter ClashPerk-XLSX-Import im Planer (Entwicklungs-Draft)

**12.11.2026 · Stack auf UI-PR #270 · kein Live-Deploy, produktiv weiterhin v1.18.1.**

Dieser PR implementiert **den tatsächlichen Browser-Importer** für unveränderte
ClashPerk-Excel-Dateien. Nutzer laden keine selbst konvertierten JSON-Dateien
hoch; auch kleine Excel-Dateien mit nur 2 oder 10 enthaltenen Kriegen werden
verarbeitet. Der bisherige Ein-Datei-JSON-Weg bleibt separat kompatibel.

## Benutzerablauf (in der Web-App sichtbar)

In Discord für **jeden** verknüpften Clash-Clan:

1. `/export attack-log` → `clans`: diesen Clan; `war_type`: **Regular**; `limit`: **100** (Maximum).
2. `/export attack-log` → selber Clan; `war_type`: **CWL**; `limit`: **100**.
3. `/export missed` → selber Clan, wenn verfügbar getrennt **Regular**, `limit`: **100**.
4. `/export missed` → selber Clan, wenn verfügbar getrennt **CWL**, `limit`: **100**.

**Aktualisierung nach UF-2-Originaltest 14.11.2026:** Ein gemeinsamer Missed-Export
kann Regular und CWL enthalten, im Test aber bei langer Historie weniger
Kriegstage erfassen. Die vier separaten Dateien deckten dort nach
eindeutigem Kriegsabgleich alle Angriffsplätze ab. Die frühere Empfehlung
„einmal genügt“ ist deshalb überholt.

**Statistik → Überblick → „Excel-Dateien auswählen“** und die vier originalen
Attack-/Missed-Exporte **gemeinsam oder nacheinander** auswählen. Es sind nicht alle drei
zwingend: ein einzelner Attack-Log-Export mit wenigen Kriegen
funktioniert. Fehlende Missed-Einträge reduzieren die
nachweisbare Abdeckung; fehlende Nachweise sind keine Null. Alle Dateien
müssen zum **gerade ausgewählten** App-Clan gehören. Wer UF und UF 2
verwaltet, importiert jeden separat. **`limit: 100` ist die Obergrenze
für die jüngsten Einträge je Export, nicht die gesamte gespeicherte
Historie.** Ältere Originalexporte aufbewahren und neue regelmäßig
hinzufügen; identische Angriffe werden nicht doppelt gezählt.
`/export wars` ist eine aggregierte Spielerübersicht und für diesen
Import **nicht** nötig.

`/export wars` enthält laut vier real geprüften Dateien überwiegend
aggregierte Statistiken. Das Sheet wird **ignoriert**, niemals doppelt
zu den Einzelangriffen addiert. Pivot-Zusatzblätter `1 Missed Attacks`
und `2 Missed Attacks` werden ebenfalls nicht noch einmal eingelesen.

## Was tatsächlich implementiert ist

- `cwl-clashperk-xlsx.mjs`: vollständiger lokaler XLSX-ZIP-/XML-Reader
  über Web-Standards `DecompressionStream("deflate-raw")` und DOMParser,
  **keine CDN-/Remote-JavaScript-Abhängigkeit**. Nur Plain-Daten,
  keine Formelauswertung. Größen-/ZIP-Header-/Entpackgrenzen, Pfadkontrolle,
  keine Makros, externen Links oder fremden XLSX-Inhalte.
- Exakte verifizierte 25 Attack-Spalten und 9 Missed-Spalten, XLSX-
  SharedStrings/InlineStrings, Excel-Datumskonvertierung.
  Verwechselt nie `Stars` mit `New Stars` oder die **globale**
  `Attack Order` mit dem 1./2. persönlichen Angriff.
- Dedupe nach `(War ID, Attacker Tag, globale Attack Order)`, sodass
  etwa die **208** real beobachteten CWL-Metadaten-Duplikate nicht doppelt
  gewertet werden. Abweichende Werte bei doppeltem Schlüssel werden
  **nicht** stillschweigend akzeptiert.
- **Nur eigene Angriffe** (`Attacker Home Clan=1`) in `cwl_stat_attacks`.
  Die gegnerischen Events fließen nicht in die eigene 3★-Quote; sie werden
  in der Vorschau **gezählt**, aber für das zukünftige vollständige
  CW-Archiv #268 noch nicht als Detailreport gespeichert.
- Missed nur aus dem **Primär-Sheet**: `War ID + Player Tag`.
  `missed_log_complete` nur wenn aus tatsächlich aufgeführten
  Angriffen und belegten Missed-Slots **je Spieler genau** die
  theoretische Attack-Kapazität und **genau die War-Größe** nachgewiesen
  wird. Andernfalls ist „nicht vollständig belegt“ sichtbar,
  **niemals** ein erfundener Nullwert.
- `cwl-clashperk-import-db.mjs`: Vorabvergleich der **gesamten**
  vorhandenen, tenant-spezifischen Kriegsmetadaten. Eindeutige
  `cp:<War ID>`-Schlüssel; bereits API-verifizierter Krieg mit
  gleicher Art/Gegner/Größe/±8h wird **übersprungen**, niemals per
  Excel überschrieben. Bereits vorhandene ClashPerk-Daten mit gleichem
  Schlüssel können durch `ignoreDuplicates` nicht doppelt zählen.
  Später hochgeladene **vollständig belegte** Missed-Daten dürfen
  nur `source=import` auf `missed_log_complete=true` anheben.
  Identitätskonflikt → **Abbruch vor allen Schreibvorgängen**.
- Mandantenbindung und Schreibrolle (Owner/Vize) vor Parsing sowie
  direkt vor und während DB-Batches erneut geprüft; PostgREST-RLS
  bleibt verbindlich. Vorschau mit neuen/vorhandenen/API-geschützten
  Kriegen, Zahl eigener/gegnerischer Angriffe, eliminierten Duplikaten,
  dokumentierten Missed-Slots und vollständig/unvollständig belegten
  Kriegen. Explizite Bestätigung vor Mutation.
- Statistik lädt War-Metadaten ab sofort **paginiert statt auf
  200 begrenzt**, Angriffe bis 60.000 und Missed bis 20.000.
  Echte Abbrüche bei sehr großen Datenbeständen statt stiller
  Abschneidung. Bisherige JSON-Validierung (max. 150 War-IDs
  *pro JSON-Datei*) bleibt unverändert; XLSX ist eigener Pfad.
- Bereits vorhandene historische Spieler bleiben in ihren originalen
  Kriegen auf Basis ihres **Player-Tags** erhalten. Im Cloud-Statistikkontext
  zählen gespeicherte Mitglieder mit `cocSyncState=former/kept` nun **nicht
  mehr als aktuell im Clan**, sodass historische UF-2-Gäste nach ihrem
  Rückwechsel korrekt „Ehemals im Clan“ erscheinen. Die unabhängige
  API-Mitgliedschaftsprüfung bleibt als weitergehendes Thema in #96.
- Ein Attack-Log kann auch einen noch laufenden Krieg enthalten. Kriege
  mit Startzeit innerhalb der letzten **72 Stunden** werden mangels
  verifiziertem Endstatus einzeln ausgelassen und in der Importvorschau
  erklärt; die ältere Historie derselben Datei wird dennoch verarbeitet.
- Neue importierte Kriege werden zuerst mit `finalized=false` als
  **vorläufiger Schreibstand** angelegt. Erst nach erfolgreichen
  Attack- und Missed-Batches werden sie als `finalized=true` markiert
  und die tatsächlich nachgewiesene Missed-Abdeckung freigeschaltet.
  Bei Abbruch kann derselbe Upload gefahrlos erneut durchgeführt werden.

## Sicherheits-/Veröffentlichungsgrenzen

**Noch kein Prod-Release.** Es wurden keine alten Excel-Daten in Supabase
hochgeladen und keine bestehenden Tabellen verändert. Browser-Support
auf iOS/Safari 16.4+ muss real getestet werden. Die neuen synthetischen
Tests sind **kein Ersatz für echten UAT**.

Der neue gestapelte **Etappe-2-Draft `feat/clashperk-atomic-rpc-20261113`**
behebt die Mehrbatch-Teilübernahme:
- `scripts/DRAFT_cwl_clashperk_atomic_import_rpc.sql` enthält eine
  **SECURITY INVOKER**-Funktion `cwl_import_clashperk_atomic(uuid,jsonb)`.
  Der Nutzer muss eingeloggt sein und `private.cwl_can_edit` für exakt
  den ausgewählten App-Clan erfüllen. Berechtigungen anderer Clans sind
  ausgeschlossen; `anon` und `PUBLIC` erhalten **kein EXECUTE**.
- Die App sendet **einmal** das normalisierte JSON aus dem geprüften
  Original-XLSX an diese RPC. Es gibt ausdrücklich **keinen Fallback**
  auf mehrere direkte Browser-Schreibaufrufe, falls die Datenbankfunktion
  fehlt.
- Die Datenbank prüft Kriegsschlüssel, Clanidentität, 72-Stunden-Puffer
  für jüngste Kriege, War-Typ, Clan/Gegner/Größe/Zeit, API-Überlappungen,
  sichere 1./2. Angriffe, bereits vorhandene Werte, Missed-Slots und
  vollständige Aufstellungen **erneut serverseitig**. Jede Ausnahme
  rollt Kriegseinträge, Angriffe, Missed-Logs und Finalisierungen
  **gemeinsam** zurück.
- Für dieselbe App-Clan-ID serialisiert eine Transaktionssperre den
  Import, ohne Vize-Mitgliedern Clanverwaltungsrechte zu geben.
  Der RPC verwendet keine `service_role`-Schlüssel im Browser.
- Das JSON-Paket ist auf 1.000 War-IDs, 20.000 eigene Angriffe,
  4.000 Missed-Einträge und 9 MB begrenzt. Der Nutzer wird bei größeren
  Dateien klar auf getrennte Uploads hingewiesen. Innerhalb **jedes**
  bestätigten Imports gibt es keine teilweisen Ergebnisse.
- Zusätzliches SQL-CI gegen eigenständiges PostgreSQL 17 mit
  **synthetischen** Owner-/Editor-/Viewer-/Zweitclan-Daten testet
  Rückrollung nach spät auftretendem Fehler, Reupload ohne Duplikate,
  API-Vorrang, später ergänzte Missed-Belege und RLS.

**Wichtig:** Dieser SQL-Entwurf wurde **noch nicht** auf der Live-DB
als Migration aktiviert. Ein ungeprüfter Browser-Release wäre
fail-closed („Import auf dem Server nicht verfügbar“).
Vor Prod sind Staging, Backup-/Restore-Gate #178 und echte Nutzer-/PWA-UAT
#213 weiterhin zwingend.

Noch ausstehende Test-/Freigabeschritte:
- Node-/JSDOM-/Browser-Test auf den synthetischen 2/10/205 War-Fixtures,
  echten ZIP/XLSX-Codepfad auch mit `sharedStrings.xml`, Dedupe,
  Missed/Clan-Isolation, unterbrochenen Imports mit Wiederaufnahme sowie
  Altkriegen neben aktuellem Krieg (nur aktuelle Zeilen überspringen).
- Auf bereits vom Nutzer gesendeten **vier Originaldateien** die
  erwarteten Summen und 208 CWL-Dubletten im **Browser/UAT** bestätigen,
  ohne Original-Personendaten in öffentliche Test-Fixtures zu committen.
- Test Supabase-RLS für Owner/Vize/Viewer, tatsächliche API-Überschneidung,
  iOS Safari, Filter/Former-Semantik, Backups/Restore #178, UAT #213.
- Vor dem sichtbaren Release Hilfe-Seite/Changelog-/Versionshinweis
  in beiden zukünftigen Sprachversionen synchron pflegen.

**Der Planungs-/CWL-Archivzustand selbst wird durch diesen Import nicht
geändert.** Externe Discord-Logs für Aufstellungswechsel werden nicht
als vorhandene XLSX-Spalten ausgegeben; diese bleiben #268/#269 Folgeumfang.

## 13.11.2026 – Original-XLSX-Audit ohne personenbezogene Veröffentlichung

Die vier echten vom Nutzer hochgeladenen Originaldateien wurden **privat und ohne
Upload ins öffentliche GitHub** mit einer unabhängigen OOXML-/ZIP-Strukturanalyse
geprüft. Das ist eine zusätzliche Plausibilitäts- und Vollständigkeitsprüfung:
Die synthetischen Chromium-/WebKit-Tests durchlaufen weiterhin den eigentlichen
Browser-Importer; die hier genannten Summen stammen **nicht** aus einem
produktiven App-Import und ersetzen keine reale iOS-/PWA-Abnahme.

| Originalexport | Festgestellte Struktur |
| --- | --- |
| Attack Log Regular | 5.050 Datenzeilen, 25 Spalten, 100 unterschiedliche War-IDs |
| Attack Log CWL | 3.118 Datenzeilen, 25 Spalten, 100 unterschiedliche War-IDs |
| Missed Attacks | **ein** Primärblatt mit 99 Einträgen: **96 Regular, 3 CWL**; zwei Pivot-Summary-Blätter sind keine neuen Nachweise |
| War Stats | zwei reine Clan-Zusammenfassungen ohne exportierbare Einzelangriffs-Historie |

Aus den beiden Attack-Logs ergeben sich im aktuellen **72-Stunden-Sicherheitsfenster**
99 auswertbare normale CWs und 99 CWL-Kriege; zwei noch zu junge Kriege werden
korrekt zurückgestellt. Unter den älteren Einträgen waren **208 doppelte
Attack-Ereignisse**, die nicht doppelt gezählt werden dürfen. Die unabhängige
Prüfung ergab **4.112 eigene Angriffe** (gegnerische Angriffe bleiben getrennt),
**131 ausdrücklich dokumentierte verpasste Angriffs-Slots** und **151 vollständig
nachgewiesene** gegenüber **47 unvollständig belegten** Kriegen. Alle 99
Missed-Einträge gehörten zu vorhandenen Kriegs-IDs; bei der strukturellen
Feldprüfung gab es **keine** ungültigen Tags, Größen, Sternewerte oder
widersprüchlichen Dubletten.

**Wichtige Anleitungskorrektur:** Vorher verlangten UI/Hilfe/Dokumentation
irrtümlich **zwei** getrennte `/export missed`-Dateien nach Regular/CWL.
Die echten Exporte beweisen, dass ein **gemeinsamer** Missed-Export beide
Typen umfasst. Deshalb sind im Normalfall **drei statt vier** Dateien
nötig. Der War-Stats-Export ist optional, wird aber nicht als zusätzlicher
Angriffsnachweis verwendet.
