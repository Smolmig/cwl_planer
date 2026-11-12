# ClashPerk → CWL-Planer: echte XLSX-Exports, maximale Datenabdeckung und Import-Mapping

**Stand 12.11.2026 · Faktische Analyse von vier originalen ClashPerk-XLSX-Dateien und drei Discord-Screenshots. Technischer Entwurf zu #269/#268, nicht implementierter Live-Excel-Import.**

Diese Dokumentation verwendet **keine rohen Spielerlisten oder komplette Kriegsdaten** aus den Originaldateien. Die Originale wurden ausschließlich zur Schema-/Abdeckungsprüfung herangezogen. Import-Mapping niemals allein aus Dateinamen ableiten.

## 1. Schritt-für-Schritt für neue Clan-Administratoren

Pro App-Clan **einzeln** exportieren. Der Parameter `clans` soll den **richtigen Clash-Clan-Tag** enthalten; die Zugehörigkeit auch nach dem Export anhand aller Zeilen prüfen.

**Pflichtexport A: normale Kriege**
1. In Discord `/export attack-log` auswählen.
2. `war_type` = **Regular**.
3. `limit` = **100** (höchster in der geprüften Discord-UI angebotener Wert).
4. `clans` = gewünschter Clan.
5. Excel-Datei **unverändert** speichern.

**Pflichtexport B: CWL**
1. `/export attack-log`.
2. `war_type` = **CWL**.
3. `limit` = **100**.
4. `clans` = derselbe Clan.
5. Excel-Datei **unverändert** speichern.

**Pflichtexport C: verpasste Angriffe bei regulären Kriegen**
1. `/export missed`.
2. `clans` = derselbe Clan.
3. `war_type` = **Regular** (nicht „Regular and CWL“).
4. `limit` = **100**.
5. Excel-Datei unverändert speichern.

**Pflichtexport D: verpasste CWL-Angriffe**
1. `/export missed`.
2. `clans` = derselbe Clan.
3. `war_type` = **CWL** (nicht „Regular and CWL“).
4. `limit` = **100**.
5. Excel-Datei unverändert speichern.

**Ergebnis: vier wichtige Dateien pro Clan, also für zwei Clans acht Dateien.**
Ein gemeinsamer `/export missed war_type:Regular and CWL limit:100` ist **zulässig**, aber für größtmögliche historische Abdeckung **nicht optimal**: Die 100-War-Begrenzung wird möglicherweise über beide Kriegstypen gemeinsam ausgeschöpft. Die Dateianalyse beweist keine absolute zeitliche Tiefe; prüfen und abgleichen.

**Optional, nicht für den Primärimport:** `/export wars` mit `clans`, `war_type`, ggf. `start_date`/`end_date` (YYYY-MM-DD), `limit` maximal 100. Das liefert pro Spieler **aggregierte War Stats**, nicht den vollständigen War-ID-gebundenen Angriffsverlauf. Ohne Datum beobachtete der Nutzer nur ungefähr 30 Tage. Falls weitere historische Aggregate gewünscht sind, explizite längere Datumsfenster ausprobieren; einen tatsächlichen Backfill einzelner Angriffe ersetzt dies **nicht**.

**Noch ältere als die letzten 100 Kriege:** Auf dem geprüften Discord-Screenshot für `/export attack-log` sind `war_type`, `limit`, `clans` zu sehen, **kein Start-/Enddatum**. Deshalb kein älterer Attack-Log-Backfill über dieses Kommando belegt. Mögliches späteres Ergänzungsverfahren: Anbieter-Export/ClashKing-Historie je nach Tracking seit wann verfügbar. Keine garantierte „komplette CoC-Historie“ versprechen.

**Für United Fighters / UF 2 konkret:** Main-Tag `#99JP2RL2`, Zweitclan `#2JGC2J8VG`. Die untersuchten beiden Attack Logs und der Missed-Export beziehen sich **nur auf Main**. Die War-Stats-Datei enthält beide Clan-Sheets. Für UF 2 daher noch beide `attack-log`-Typen und beide getrennten `missed`-Typen durchführen. Für Main fehlt zur besseren Abdeckung die Trennung des bereits vorhandenen kombinierten `missed`-Exports in Regular und CWL.

## 2. Was die vier geprüften Originaldateien tatsächlich enthalten

| Export | Sheets | Rohzeilen | Kriege | Historie / Besonderheiten |
|---|---|---:|---:|---|
| `/export wars` (War Stats) | `United Fighters (#99JP2RL2)`, `UF 2 (#2JGC2J8VG)` | 33 / 16 Spieler | nicht eindeutig per War-ID | Aggregierte Spielerstatistik, **keine** War IDs oder Datums-Spalte, nicht als neue Kriege zählen |
| `/export attack-log` Regular, Main | Main-Sheet | 5.050 | 100 | 2.664 eigene + 2.386 gegnerische Angriffe; ältester erfasster War-Start Dez 2025 |
| `/export attack-log` CWL, Main | Main-Sheet | 3.118 | 100 | **208 duplizierte Angriffsereignisse**, bereinigt 2.910, ältester War-Start Okt 2025 |
| `/export missed` Regular and CWL, Main | `Missed Attacks` sowie `2 Missed Attacks`, `1 Missed Attacks` | 99 **Primärzeilen** | 46 mit Missed | 96 Reg- + 3 CWL-Einträge, 67 mit einem, 32 mit zwei Missed-Slots |

Die beiden Missed-Pivotblätter sind **abgeleitete Spieler-/Datumsübersichten** und dürfen **nicht zusätzlich** zum Primärblatt importiert werden: das würde Missed-Angriffe mehrfach zählen.

**CWL-Duplikate sind real**: In sieben `War ID`s sind 208 Ereignisse jeweils doppelt vorhanden (6×30 und 1×28). Jeweils derselbe `War ID`, `Attacker Tag`, `Attack Order`, Sterne und Zerstörung. Einziger Unterschied: `Clan League/Level` und `Enemy Clan League/Level` sind bei der zweiten Zeile leer. Dedupe per **`(tenantClan,warType,War ID,Attacker Tag,Attack Order)`**, vollständige Liga-Metadaten aus der informativen Zeile behalten. **Nie** 3.118 Rohzeilen als 3.118 Angriffe zählen. Nach Dedupe **1.486 eigene und 1.424 gegnerische CWL-Angriffe**.

## 3. Konkret benötigte Spalten/Tabellen

**Attack Log (Regular/CWL), erstes Blatt:** 25 Spalten

`Tag`, `Name`, `Position`, `Town Hall`, **`War ID`**, **`Attack Order`**, **`Attacker Tag`**, `Defender Tag`, **`Stars`**, `New Stars`, **`Destruction`**, `Defender Tag` (nochmals identischer Header!), `Defender Name`, `Defender Position`, **`Defender TH`**, **`Attacker Home Clan`**, **`Clan Tag`**, `Clan Name`, `Clan League/Level`, **`Enemy Clan Tag`**, `Enemy Clan Name`, `Enemy Clan League/Level`, **`War Start Time`**, **`Team Size`**, **`War Type`**.

- `Attacker Home Clan = 1`: **eigener Angriff**, zählt in die eigenen Spielerstatistiken. `=0`: **gegnerischer Angriff**, nur für gegnerische Auswertung/Kriegsbericht; niemals eigene Hit-Rate verfälschen.
- `Attack Order` ist der originale globale Kriegs-Angriffsindex, **nicht** automatisch 1./2. Angriff desselben Spielers. Für bestehendes `cwl_stat_attacks.attack_order` die eigenen Angriffe **je (War ID, Player Tag) chronologisch sortieren und bei 1 beginnend nummerieren**; originalen Index zusätzlich im optionalen detailgenauen CW-Archiv behalten.
- `Stars` sind tatsächlich erzielte Sterne, `New Stars` zusätzliche Nettosterne für Clan-Kriegsergebnis. Nicht verwechseln.
- `War Start Time` und `Ended` im Missed-Sheet sind **numerische Excel-Datumsserien**. Mit Datumsserial-Konvertierung und expliziter Timezone-/DST-Prüfung nach UTC speichern, nie als UNIX-Sekunden übernehmen.
- Wegen doppeltem `Defender Tag` die Spalten **positionsgebunden bzw. eindeutig disambiguiert** mappen, niemals blind über einen Object-Header, der die erste/zweite Spalte still verliert.
- `War ID` stammt aus ClashPerk; vor Merge mit vorhandener Supercell-API-Historie über Clan-Tag + Gegner-Tag + War Start + Größe + Kriegstyp abgleichen. Kein zweites Resultat nur wegen unterschiedlicher API-/ClashPerk-War-Keys. Unklare Identität → Importvorschau/Review, **nicht** duplizieren.
- In besonderen Formaten sind War Size 5, 10, 15, 20, 25 beobachtet, keine 15er-Annahme für reguläre Kriege; CWL-Beispiel 15, zukünftige 30 berücksichtigen.

**Missed Attacks, nur Blatt `Missed Attacks`:**

`Name,Tag,Clan,Enemy Clan,War ID,Ended,War Type,Team Size,Missed`.
`War Type` = `Regular` bzw. `CWL`, auf `normal`/`cwl` normalisieren.
`Missed` = 1/2 (bei regulären Kriegen), je *War ID und Player-Tag*; keine Null erzeugen, wenn keine Zeile vorhanden ist. **99 Zeilen** umfassen **131 nachgewiesene nicht verwendete Angriffs-Slots** in 46 Kriegen. Alle 46 War IDs existieren auch in den beiden Attack Logs.

Die beiden weiteren Missed-Sheets `2 Missed Attacks` und `1 Missed Attacks` sind Spielerzusammenfassungen und **kein unabhängiger Originalbeleg**.

## 4. Vollständigkeit: überprüfter Abgleich der Originaldateien

Für jedes War ID:
- mögliche eigene Angriffs-Slots: `Team Size × 2` normaler CW, `Team Size × 1` CWL.
- Anzahl **eindeutiger eigener** Attack-Events (`Attacker Home Clan=1`) addieren.
- Nachgewiesene `Missed`-Slots aus dem **ersten** Missed-Blatt addieren.
- Nur als **lückenlos belegt** werten, wenn Summe exakt der Kapazität entspricht, die Vereinigung der jeweiligen Tags genau `Team Size` Spieler ergibt und für **jeden** Spieler die Kapazität 2 bzw. 1 aufgeht. Bei einem vollständig aufgezeichneten War ohne Missed ist die Zahl 0 gerechtfertigt, **sonst unknown**. Zusätzliche Saison-/War-Ende-/Quellenprüfung vor einem finalen `missed_log_complete=true` erforderlich.

**Gemessene Abdeckung nach CWL-Dedupe:**

| Typ | 100 War IDs | Lückenlos nachgewiesene eigene Slots | War IDs ohne vollständig gesicherten Missed-Nachweis |
|---|---:|---:|---:|
| Regular | 100 | **60** (= 43 mit Missed + 17 vollständig geführten eigenen Angriffen) | **40** |
| CWL | 100 | **92** (= 3 mit Missed + 89 vollständig geführten eigenen Angriffen) | **8** |

Die **46** im Missed-Blatt dokumentierten War IDs sind **alle rechnerisch exakt vollständig** (43+3); keine widersprechende Kapazität. Die **restlichen 48** Kriege müssen nach separaten `missed`-Typ-Exporten neu bewertet werden.

**Gegner-Lücken bleiben getrennt**: Beide Seiten haben in den Attack Logs zahlreiche Angriffe; nicht angreifende **gegnerische** Roster-Mitglieder lassen sich aber aus Attack-Zeilen allein nicht sicher ermitteln. Für den vollständigen CW-Archivbericht tatsächliche Original-Roster-/Final-Scores aus signierten Supercell-/ClashKing-Snapshots getrennt erfassen.

## 5. Historische Spieler und Tenant-Isolation

- Player-Tags sind stabile Spieler-Identität; Name/RH können historisch wechseln. Nicht anhand des Namens zusammenführen.
- Ergebnisse bleiben für **jenen Clan**, in dem der Krieg aufgezeichnet wurde – ein UF-2-War wird beim Wechsel zum Main **nicht** dem Main gutgeschrieben.
- Ehemalige Spieler werden in der **gesamten historischen Clanquote** berücksichtigt und in Spielerstatistiken **standardmäßig sichtbar**, Badge `Ehemals im Clan`, per Filter optional ausblendbar. Historische War-Roster/Archive zeigen immer die damalige tatsächliche Teilnahme.
- Nicht durch bloße Existenz in der gespeicherten `profile.members`-Liste als aktuell klassifizieren; echte verifizierte Mitgliedschaft bzw. `cocSyncState` berücksichtigen (bestehender Klassifizierungsfehler aus #96).
- Owner/Editor-Importrechte, fremde Clan-Tags im Import ablehnen, Daten nur nach explizitem Vorschau-/Bestätigungsschritt schreiben. Bestehende API-verifizierte Ergebnisse nie durch unvollständige Importdaten still überschreiben.

## 6. Import-Pipeline (noch zu implementieren)

1. Eingehende .xlsx auf Dateigröße, Zip-Bomb/externen Inhalt, Blattnamen, 25-/9-Spaltenlayout und korrektes Schema prüfen. Fehlende/andere Header und Misch-Clans als Vorschaufehler anzeigen, niemals raten.
2. Optional mehrere Dateien in einen **gemeinsamen Importvorgang** laden; Originaltyp pro Datei erkennen (`Attack Log`, `Missed Attacks`, `War Stats`).
3. Alle Angriffe nach Schlüssel `tenant+type+warId+attackerTag+globalAttackOrder` normalisieren/deduplizieren; redundante CWL-Liga-Metadaten zusammenführen. Source `clashperk`, Importzeit, Einzelbeleg und Datenabdeckung behalten.
4. Eigen- vs. Gegnerangriffe trennen; eigene 1./2. Angriffe korrekt nummerieren; verpasste Slots separat aus Missed-Primärsheet über War-ID verknüpfen.
5. Gegen vorhandene `cwl_stat_wars` / `cwl_stat_attacks` / `cwl_stat_missed` via Quelle/War-Identität abgleichen; `cp:[WarID]`-Legacy-Key und API-Key können denselben War repräsentieren. Kein doppelter Spieler, Krieg, Angriff oder Miss.
6. Vorschau (Clan, Datum, Normal/CWL, War IDs, eigene/generische Angriffe, eindeutige Attack-Zahl, bestätigte Missed, Anzahl vollständig/unbekannt, Konflikte/Überlappungen, ehemalige Spieler) → bewusste Bestätigung.
7. Nur danach tenant-/rollen-/revisionsgeschützte DB-Transaktion. Idempotenz bei wiederholtem Upload; Backup-/Restore-Gate #178, Staging- und UAT-Gate #213.

### Test-Fixtures vor Release

Originale **nicht** im öffentlich lesbaren GitHub-Repo speichern. Anonymisierte synthetische Varianten mit **gleicher** Blatt-/Spaltenstruktur und gezielt nachgestellten 208 CWL-Metadaten-Duplikaten sowie zwei Clans anlegen. Tests für limit 100, 5/7 / 6/7, CWL 30er, Spielerwechsel UF 2→Main, 1/2 verpasste Angriffe, gefälschten Clan-Tag, doppelte Sheets/Pivots, schadhafte XLSX/Zip, historische API-Überschneidung und erneutes Importieren.

## Externe Dokumentation

- ClashPerk automatische Discord-Logs: https://docs.clashperk.com/features/logs
- ClashPerk Website und Datenerfassung: https://clashperk.com/
- Ergänzende alternative gespeicherte War-/CWL-Historie: https://api.clashk.ing/swagger/index.html

**Abgrenzung:** Es gibt in dieser Dokumentationsetappe noch **keinen** laufenden XLSX-Parser und keinen Backfill alter Supabase-Daten. Die vier Originaldateien sind **nicht automatisch importiert**; produktive Statistik/Live bleiben unverändert.
