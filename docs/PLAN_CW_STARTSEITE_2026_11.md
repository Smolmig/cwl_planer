# Plan-Startseite: letzte CWL und aktueller Clankrieg

**Feature:** Cloud v1.16.61 (11.11.2026), Nutzerfeedback nach CWL-Saisonabschluss. Offline-PWA bleibt unverändert und benötigt für saisonale Abschluss-/Neustartentscheidungen manuelle Aktionen.

## Das sieht der Clan im Cloud-Plan

1. **Während einer CWL** bleibt die bestehende Tagesplanung der primäre Inhalt; kein CW-Widget überschreibt den Solver, die Aufstellungen oder archivierte Kriege.
2. **Nach der CWL, vor dem nächsten normalen CW-Kampftag** erscheint ein schlanker aufklappbarer Saisonrückblick. **Kriegstage / Tabelle / Spieler** sind drei direkte Reiter im Inhalt; die Ergebnisse verwenden unverändert `summarizeCwlSeason`, `summarizeCwlGroup` und die bestehenden Ansichten, keine neu erfundenen Zahlen. Ohne komplette letzte offizielle CWL-Runde wird nur „6/7 abgeschlossen“ gemeldet; die fehlenden Daten bleiben offen.
3. **Während einer normalen CW-Vorbereitung** sind alte CWL-Ergebnisse weiterhin leicht erreichbar und das neue CW-Widget zeigt den kommenden Gegner, die vorläufige Aufstellung und Startzeit, soweit Clash liefert.
4. **Beim Start eines normalen CW-Kampftages** wird der Clankrieg **vor** die vorige CWL und den in dieser Phase weniger relevanten CWL-Planheader gerückt. Die vergangene CWL klappt standardmäßig zu. Geöffnete Reiter, der Fokus und der bewusst wieder geöffnete alte Rückblick bleiben bei weiteren API-Refreshes erhalten.
5. **Nach dem Kampftag** bleibt das zuletzt gelieferte normale Kriegsergebnis sichtbar, solange Supercell `warEnded` zurückgibt. In einer neuen CW-Vorbereitung ist der Rückblick wieder einfach zugänglich; eine neue **CWL** übernimmt später erst nach dem bereits bestehenden, sicheren Archivierungs-/Zyklus-Gate.

### Normaler CW: der relevante API-Inhalt

- Unser Clan gegen Gegner, Wappen, Sterne und **Zerstörung beider Seiten**, erlaubte und bislang erfasste Angriffe, Kriegsgröße, Vorbereitung/Kampf/Endzeit.
- Drei **CW-Reiter**: **Angriffe** (beste dokumentierte Angriffe unserer Spieler nach Sternen und Zerstörung sowie zuletzt registrierte, nach API-`order` sortierte Angriffe, soweit dieses Feld verfügbar ist), **Unser Team** und **Gegner** (Position/Rathaus, Angriffe pro Spieler und gegen welche Base mit Sternen und Zerstörung).
- Die bestehende userauthentifizierte Supabase Edge `coc-cwl-status` gibt aus offiziellen Supercell CW-Daten nur zusätzliche, validierte `mapPosition` und `order` weiter; keine neue Tabelle und kein globaler Zugang. Die Liveanzeige ist read-only.
- **„Heroischster Angriff“** ist eine separate Spielauszeichnung, die aus diesen Feldern **nicht verlässlich** rekonstruiert werden kann. Der Text lautet deshalb **„Beste Angriffe unseres Clans – nach Sternen & Zerstörung“**, keine offizielle Auszeichnung. Ohne `order` steht **„Erfasste Angriffe“** statt künstlich „Letzte Angriffe“.
- Bis zum Kriegsschluss sind verbleibende Angriffe keine *vergessenen* Angriffe. Fehlende oder nicht gelieferte API-Daten sind nicht 0 und keine Sanktion; inaktive oder nicht verknüpfte Cloud-Clans sehen keine private CW-Anzeige.

### UX-/Sicherheits- und Akzeptanzkriterien

- Kein zusätzlicher Kartensalat: Nur eine primäre CW-Karte, unterhalb eine dezente native `<details>`-Leiste und jeweils eine flache Reiter-Navigation.
- 320/390/430px und Desktop, Gold/Dark/Light, Keyboard-Fokus und ARIA-Tabs, freie horizontale Scrollbarkeit, kein ungewolltes Scroll-Reset.
- Bei unveränderten Live-Daten keine unnötigen DOM-Replacement- oder neu angeordneten Knoten; Auswahl bleibt auf demselben Reiter. Wechselt der Nutzer bewusst zum alten CWL-Rückblick, bleibt er offen.
- Nutzernahe deutsche Begriffe in der Oberfläche; technische Herleitung nur als kleines `ⓘ`-Element und in der Hilfe. Vollständige englische UI weiterhin eigener offener Punkt #177.
- Keine neuen Owner-Rechte, Plan-/Solver-/RLS-/Statistik-/Collector-Änderungen; Cross-Tenant #212 weiterhin gesperrt.
- Die im Repository dokumentierten [Endabnahmen #213](https://github.com/Smolmig/cwl_planer/issues/213) auf realem iOS/Android, mit echten API-Varianten `preparation/inWar/warEnded` und mehr als einem Cloud-Clan bleiben ausdrücklich offen, bis tatsächlich ausgeführt.

**Hilfe:** Bei diesem Update zusammen mit der Oberfläche geprüft und auf den neuen Plan-Workflow geändert. Weitere globale Formulierungsbereinigung der gesamten App bleibt ausdrücklich als separate Aufgabe offen – nicht als durch diese gezielte Änderung erledigt markieren.
