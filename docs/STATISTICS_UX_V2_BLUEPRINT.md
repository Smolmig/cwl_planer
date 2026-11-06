# Statistik UX v2 – Arbeitsstandard (06.11.2026)

## Ziel: klare Antworten statt zusätzlicher Felder

Die App unterscheidet **historische Statistik** (vom Nutzer ausgewählte Kriegstage)
und **Spielerform** (feste, aktuelle Kalenderfenster). Diese beiden Datensichten
dürfen nicht still miteinander verschachtelt werden. Keine Rangfolge aus 2/2
Angriffen als Behauptung, dass ein Spieler „der Beste“ ist.

## Neue Seitenstruktur

| Bereich | Leitfrage | Zeitraum | Hauptdarstellung |
|---|---|---|---|
| Überblick | Wie läuft der Clan insgesamt? | Nur die hier ausgewählten Kriege | KPIs + Datenabdeckung |
| Spielerstatistik | Was haben Spieler in meiner Auswahl tatsächlich erreicht? | Eigene CW-/CWL-Auswahl | lesbare nummerierte Tabelle; Spalten 3★-Quote, n, Ø★, belegte Misses |
| Spielerform | Wie spielt jemand **jetzt**? | Fix 14, 30 und 90 Tage bis heute; **unabhängig** von historischen Filtern | drei gleich-RH-Balken je Spieler mit n und CW/CWL-Quelle; keine pauschale Stärkepunktzahl |
| Vergleiche | Welche Unterschiede sehe ich bei vergleichbaren Angriffen? | Eigene CW-/CWL-Auswahl | Vergleichsbalken RH tiefer/gleich/höher/unbekannt; CW versus CWL und Spielerduell |
| Verlauf & Kriege | Wie hat sich das über die Zeit entwickelt? | Eigene CW-/CWL-Auswahl | Woche als Detailstandard; Monat als Option, n-Tabelle; einzelne Angriffe |

### Zeitfilter-Regeln

- Historische Bereiche speichern ihre Auswahl **je Unteransicht** und erklären sie unmittelbar über den Daten.
- Oben **nicht** mehr das kryptische „30/30 CWs“ bei gleichzeitig „Letzte 50“:
  Bei 30 gespeicherten CWs wird die 50-Grenze als „Alle 30 verfügbaren CWs“ beschrieben,
  bei Auswahl 10 als „10 von 30 CWs“.
- Unterschied zwischen **Anzahl Kriege** und **Kalendertagen** ist fachlich klar;
  bei CWL meint ein ausgewählter Durchgang mehrere tatsächliche Kriegstage.
- Ausgewählte Kriege dürfen **nicht** ohne Kennzeichnung zusätzlich heimlich
  auf „letzte 10“ eingeschränkt werden.
- Die **Form** liest sämtliche abgeschlossenen verfügbaren Kriege, unabhängig von
  den historischen Auswahlfiltern. 14/30/90 Tage werden parallel und getrennt
  durch tatsächliche Angriffszahl sichtbar. Ihre Quoten bestehen aus Angriffen
  gegen das **gleiche RH**. Bei wenigen Fällen bleibt die Interpretation unsicher.
- „Aktuelle Form“ ist von der historischen Rohstatistik und einem späteren
  Intelligent-Planer-Score strikt getrennt.

### Vergleiche: sinnvolle Ausbaureihenfolge

1. **Jetzt belastbar:** CW/CWL, RH-Differenz, 3★-Quote mit n, Ø Sterne,
   0/1/2/3-Sterne-Verteilung, direkte Spielerduelle bei identischen Filtern,
   Wochen-/Monatsverlauf, belegte verpasste Angriffe mit Datenabdeckung.
2. **Nach bereits vorhandenen Grunddaten:** Spielerposition im Krieg,
   Angriff auf höheres/gleiches/niedrigeres RH je Spieler, Trend nach RH-Upgrade,
   Erstangriff vs. Aufräumangriff **nur**, wenn zuverlässig aus Reihenfolge belegbar.
3. **Nicht ohne neue Datenquelle:** gegnerische Armeezusammenstellung,
   Helden-/Equipment-Stärke, Layout oder Defensive-Clan-Castle-Truppen,
   tatsächliche Basisschwierigkeit und verlässlicher „Skillscore“.
4. **UF 2:** Spieler-Tag-Identität ja; private Kriegshistorie fremder Clanprofile
   weiterhin RLS-geschützt und nur nach ausdrücklicher Clan-Freigabe teilbar.
   Gegen niedrigeres RH dürfen rohe Hitraten nicht gleich gewichtet werden.

### Charts/UX-Standards

- Desktop: größere Typografie, richtige Breite für Tabellen, nicht auf
  Miniatur-Kartenmaßstab alles in dieselbe Spaltenbreite pressen.
- Mobile: 320/390/430 px, keine horizontale Gesamtseiten-Scrollfläche;
  5 Unteransichten als kompakte Reiter.
- Jede Kennzahl mit **n** und definierter Grundgesamtheit.
- Keine Bedeutung nur über Farbe: CW = **durchgezogene Linie**, CWL =
  **gestrichelte Linie**; neutrale explizite Textlegende, CSS-Theme-Variablen.
- Bei 4 erfassten Monaten zuerst Wochen anzeigen, keine künstliche glatte
  Hochrechnung fehlender Daten, Monat als echte eigene Auswahl.
- Browser-Auto-Refresh darf Fokus, Scrollkontext oder offene Details nicht schließen.
- Benötigte Sicherheit: keine SQL-/RLS-/Cloudprofilschema-/Solver-Änderung.
  Verschiedene Clans in demselben Backend sind Mandanten, nicht automatisch Partner.

### Qualitätsgates vor Merge

- Browserinteraktionen auf 320/390/430/1366px, Gold/Dark/Light,
  Darstellung der 30 von 30 trotz 50er-Maximum.
- Form bleibt unverändert, wenn die Auswahl in Spielerstatistik auf 10 CW
  begrenzt wird; Wechsel zurück stellt die jeweilige Auswahl wieder her.
- Testdaten 2/2 versus 40/60, gleicher TH, mehr/weniger RH und fehlende RH.
- Diagramm „Woche“ ist Default, Linie und Strichart sind themeunabhängig, Tabelle mit n.
- Kein zweiter verdeckter 10-Kriege-Filter in Spielerzeilen.
- Keine zusätzlichen Datenbank-Schreibzugriffe, kein Planer-Eingriff.

Diese Architektur wird in kleinen überprüfbaren PRs umgesetzt, aber als
**zusammenhängende Statistikansicht** getestet und nicht vorschnell live gestellt.
