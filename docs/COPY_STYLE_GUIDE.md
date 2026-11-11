# Textstandard und Audit-Plan für die Cloud-App (#226)

**Stand:** 11.11.2026 · Umsetzung in kleinen, separat testbaren Schritten.

## Was Nutzer zuerst sehen sollen

1. **Was ist das?** Kurzer Titel („Spielerform“, „Verpasste Angriffe“, „Angriffe auf gleiches RH“).
2. **Was bedeutet der Wert?** Knappes Ergebnis, eindeutige Einheit und Zeitbezug.
3. **Was kann ich tun?** Eindeutiger Button („Kriege auswählen“, „Aktualisieren“, „Pause prüfen“).
4. **Was ist noch unklar?** „Noch kein Angriff erfasst“ ist **nicht** dasselbe wie „Angriff verpasst“; Datenlücken dürfen nicht zu 0 % / 0 Angriffen werden.
5. **Wie wird es berechnet?** Methodik, Grenzen und Datenherkunft in bestehende `details`-Bereiche oder Hilfe verschieben, nicht durch neue Karten verdoppeln.

## Einheitliche Begriffe

| Anwendungsfall | Kurztext im UI | Erläuterung |
| --- | --- | --- |
| Dreisterne aus belegten Angriffen | **3★-Quote** | Reale Anzahl der 3★-Angriffe im gewählten Zeitraum; kein Prognosewert |
| Spielerform nach Beleglage | **Angriffsmenge & 3★-Quote** | Zuerst nach 15 / 6–14 / 1–5 / 0 passenden Angriffen gruppiert, dann innerhalb der Gruppe nach 3★-Quote |
| Spielerform ohne Gruppierung | **3★-Quote (auch bei wenigen Angriffen)** | Auch ein einzelner Dreisterne-Angriff kann 100 % ergeben |
| Passende Formangriffe | **Angriffe auf gleiches RH** | Angreifer und Gegner mit derselben Rathausstufe; nicht automatisch Mirror oder gleich schwierige Basis |
| Frischer automatischer Abruf | **Kriegsdaten zuletzt erfolgreich geprüft** | Erfolg heißt nicht, dass der aktuelle Krieg bereits endgültig ausgewertet ist |
| Verspäteter Abruf | **Neue Kriegsdaten kommen möglicherweise verspätet** | Der bisherige Stand bleibt sichtbar, aber neue Angriffe könnten fehlen |
| Abgeschlossener Nachweis | **Verpasster Angriff** | Nur bei vollständig bestätigten Kriegs-/Aufstellungsdaten; sonst „offen“/„unbekannt“ |
| Rollen und Handlungen | **Clanführer / Vize / Beobachter; Prüfung, Vorschlag, Bestätigung** | App-Berechtigung und Ingame-Rang nicht vermischen; nie automatische Clash-Änderung behaupten |

## Bestandsaufnahme und Priorisierung

| Oberfläche | Befund / nächster Schritt | Stand |
| --- | --- | --- |
| **Plan / normale CW / letzte CWL** | Wichtigsten Krieg zuerst, kompakter Saisonrückblick, 1./2. Angriff und neutrale Nicht-Nachweis-Texte | v1.16.61–.62 in Produktion; später allgemeine Feinprüfung |
| **Statistik → Überblick / Spielerform** | Formsortierung und Health-Status waren zu technisch; Haupttexte kurz, methodische Details bereits in Hilfe/Disclosure | v1.16.64 als erstes Teilpaket #226 |
| **Clanverwaltung** | Lange und teils technische Prüf-, Abwesenheits- und Quittierungstexte; Anfänger-Vokabular und Owner-/Ingame-Unterschied prüfen | **Nächster Teilabschnitt** |
| **Einsätze / Mitglieder** | Status „offen“ versus „verpasst“, Rotationsziele und Hilfe bei Filterkombinationen einheitlich prüfen | Offen, eigener Teilabschnitt |
| **Statistik → Vergleiche / Verlauf / Kriege** | Einheiten, Leerfälle und Grundgesamtheiten konsequent kurz benennen | Offen, eigener Teilabschnitt |
| **Mehr / Einstellungen / CWL-Archiv / Konto** | Buttons und Speichermeldungen aus Sicht von Clanmitgliedern und Beobachtern prüfen | Offen, eigener Teilabschnitt |

Die Bestandserfassung basiert auf sichtbaren Titeln, Feldbeschriftungen, Statusmeldungen und Erklärungen im Quelltext; sie ist **keine** abgeschlossene Nutzer-UAT. In jedem Teilpaket die bestehende **Hilfe-Seite aktualisieren**, keine Berechnung/Cloud-Daten/Clash-Aufstellung ändern und die reale Geräteabnahme #213 offen lassen.

## Pflichtcheck für neue PRs

- [ ] **Titel:** Bedeutung ohne Entwicklerkontext?
- [ ] **Status:** korrekt, auch bei fehlenden/veralteten Daten?
- [ ] **Button:** beschreibt konkrete Nutzerhandlung?
- [ ] **Leer-/Fehlerfall:** keine erfundenen 0, kein Schuldvorwurf?
- [ ] **Hilfe / Info:** Methodik korrekt, vorhandene Hilfe aktualisiert?
- [ ] **Mobile & A11y:** 320/390/430 px, Gold/Dunkel/Hell, Tastatur/Fokus, Beobachter; keine zusätzliche Kartenebene?
