# #269 – Direkter ClashPerk-XLSX-Import im Planer (Entwicklungs-Draft)

**12.11.2026 · Stack auf UI-PR #270 · kein Live-Deploy, produktiv weiterhin v1.18.1.**

Dieser PR implementiert **den tatsächlichen Browser-Importer** für unveränderte
ClashPerk-Excel-Dateien. Nutzer laden keine selbst konvertierten JSON-Dateien
hoch; auch kleine Excel-Dateien mit nur 2 oder 10 enthaltenen Kriegen werden
verarbeitet. Der bisherige Ein-Datei-JSON-Weg bleibt separat kompatibel.

## Benutzerablauf (in der Web-App sichtbar)

In Discord für **jeden** verknüpften Clash-Clan:

1. `/export attack-log` → `clans`: diesen Clan; `war_type`: **Regular**; `limit`: **100**.
2. `/export attack-log` → selber Clan; `war_type`: **CWL**; `limit`: **100**.
3. `/export missed` → selber Clan; `war_type`: **Regular**; `limit`: **100**.
4. `/export missed` → selber Clan; `war_type`: **CWL**; `limit`: **100**.

**Statistik → Überblick → „Excel-Dateien auswählen“** und die verfügbaren
Attack- und Missed-Exporte **gleichzeitig** auswählen. Es sind nicht
alle vier erforderlich: ein einzelner Attack-Log-Export mit wenigen
Kriegen funktioniert; fehlende Missed-Logs reduzieren nur die
nachweisbare Abdeckung. Alle Dateien müssen zum **gerade ausgewählten**
App-Clan gehören. Wer UF und UF 2 verwaltet, importiert jeden separat.

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
- Bereits vorhandene historische Spieler werden in ihren originalen
  Kriegen auf Basis ihres **Player-Tags** mitgezählt. Die spätere
  robuste Klassifikation tatsächlicher aktueller Mitglieder vs.
  weiterhin für CWL vorgemerkter Ex-Spieler bleibt Issue #96.

## Sicherheits-/Veröffentlichungsgrenzen

**Noch kein Prod-Release.** Es wurden keine alten Excel-Daten in Supabase
hochgeladen und keine bestehenden Tabellen verändert. Browser-Support
auf iOS/Safari 16.4+ muss real getestet werden. Die neuen synthetischen
Tests sind **kein Ersatz für echten UAT**.

Die Einfügeoperationen laufen über bestehende, tenantgebundene RLS-
Tabellen in kleinen Batches und sind idempotent (Wiederholung fügt
keine Duplikate ein), aber **noch nicht eine einzige Datenbanktransaktion**.
Ein Netzwerkfehler während des Imports kann deshalb bereits einige
neue War-IDs/Angriffe enthalten; der sichere Nutzerweg ist **erneut
dieselben Originaldateien hochladen**. Für eine vollständig atomare
Anwendung über viele Batches wäre ein zusätzlicher, serverseitig
validierender RPC mit Staging-Tabelle notwendig (ggf. mit #178 bündeln).

Noch ausstehende Test-/Freigabeschritte:
- Node-/JSDOM-/Browser-Test auf den synthetischen 2/10/205 War-Fixtures,
  echten ZIP/XLSX-Codepfad inkl. Dedupe/Missed/Clan-Isolation.
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
