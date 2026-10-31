# CWL-Planer Cloud – nächste Etappen (Stand 30.10.2026)

## Umgesetzte UX-Runde v1.1.0-alpha.3

- Gastansicht: nur CSV-/Listenimport prominent, manuelles Hinzufügen unter aufklappbaren Aktionen; Mehrfachauswahl bleibt sichtbar.
- Cloud: erster Import ohne 45-mal „NEU“; neue Zugänge bei späteren Abgleichen erhalten eine Markierung. Ausgetretene Spieler bleiben am Ende ausgegraut mit Teilnahme=Pause.
- Spielernamen werden über den Stift explizit bearbeitet (nicht durch versehentliches Tippen auf Text); Eingabefeld erhält bei Bearbeitung Fokus.
- Mehrfachbearbeitung hat „Fertig“, danach normale Liste. Kein Rätselraten über Schließen.
- „Clash-Reihenfolge“ steht in der Sortierung. Wir verwenden zunächst die Reihenfolge der Mitgliederliste der Supercell-API; diese muss im echten Clan gegen die Spielansicht überprüft werden, falls Clash dort anders sortiert.
- Tagwechsel vermeiden unnötiges Smooth-Scroll. Wegen Safari/Pinch-Zoom muss Bottom-Navigation am echten iPhone weiter geprüft werden; Browser-Zoom lässt sich nicht immer sauber programmgesteuert zurücksetzen.
- Online-Hilfe erklärt Cloud-Import, Rollen, Konflikte und manuellen Export; Gast-Hilfe bleibt unabhängig.
- Änderungsprotokoll: letzte 100 Einträge, Aktualisierung bei erfolgreichem eigenen Speichern und live bei neuen Änderungsereignissen über Realtime. Vollständige Ereignisse bleiben in der Datenbank; eine spätere Suche/Pagination ist möglich.

## CWL-Statusautomatik: prinzipiell realisierbar, noch nicht implementiert

API-Routen und Daten:
1. `GET /clans/{clanTag}/currentwar/leaguegroup` -> CWL-Saison, Clans, Runden und Kriegstags.
2. `GET /clanwarleagues/wars/{warTag}` -> Kriegsstatus, Beginn/Ende, Teams, Gegner, Spieler, RH-Level und Angriffe, sofern sichtbar.
3. Zukünftige Runden können `#0` statt eines gültigen Kriegstags enthalten; nicht als Fehler oder abgeschlossen behandeln.
4. Die Clan-Seite der Kriegsantwort ist nicht immer im Attribut `clan` – sicher anhand des Tags orientieren.

Geplante Architektur:
- Edge Function lädt die CWL-Gruppe und alle zugehörigen Kriegsdaten serverseitig (API-Key niemals im Client).
- Pro Clan/Saison und Kriegs-ID einen eindeutigen Datensatz; Status `preparation`, `inWar`, `warEnded` getrennt speichern.
- Für Gegneransicht Namen, Kriegsstatus, RH-Verteilung und verbleibende Zeit zeigen; falls kein CWL-Krieg sichtbar ist, unverändertes „Tag 1–7“.
- Manuelles `↻` im Plan immer möglich und zentraler *serverseitiger* Zeitplan später alle 10–30 Minuten, während CWL läuft. Free-Tarif-Limits und Proxy-Ausfälle beachten.
- Automatische Bestätigung gespielter Tage **nur** wenn `warEnded`, War-Tag und Endzeit validiert, Krieg vollständig und tatsächliches Line-up dem richtigen Spielertag zugeordnet ist.
- Idempotent und transaktional übernehmen: automatischer Abschluss darf manuelle historische Kriege nicht löschen oder doppelt eintragen. Bei Ausfall unklaren Status anzeigen, **nie** einen Tag automatisch abschließen.
- Nach Abschluss übrige Tage mit bestehendem Scheduler neu berechnen; MUSS/RAUS/FIX und Archiv-Snapshots respektieren.
- Historische API-Daten nach Saisonende sind nicht unbeschränkt verfügbar. Kriege frühzeitig regelmäßig speichern.

## Statistiktab (späteres Feature, noch nicht implementiert)

- Quelle: gesammelte CWL-/CW-Angriffsdatensätze pro Spieler, Krieg, Verteidigungs-RH, Angriff, Sterne, Zerstörung, Zeit.
- Kennzahlen: Angriffe, Trefferquote (klar definieren: z. B. 3★-Rate), Ø Sterne, Ø Zerstörung, Angriff auf gleiches/höheres RH, Ausfall-/Nichtangriffsquote, Saisonfilter.
- Filtersortierung: Saison, Kriegsart, Rathaus-Level, Mindestanzahl Angriffe, Spieler, Gegner, Aktivität.
- Kleine Stichproben sichtbar kennzeichnen; 100 % 3★ bei einem Angriff nicht als stärker als 75 % bei 40 Angriffen behandeln.
- Offizielle API stellt nicht rückwirkend beliebig viele CWL-Angriffsdetails bereit; für alte Daten kann ein externer Historienanbieter nötig sein. Daten anderer Anbieter gesondert auf Aktualität, Nutzungsbedingungen und Kosten prüfen.
- Für ClashPerk-ähnliche Statistiken ist **laufende eigene Datensammlung** Voraussetzung; keine unbegründete Zusage von alten, nicht verfügbaren API-Daten.

## Vor öffentlichem Release

- Praktischer iPhone-Test ohne Zoom und mit Zoom für sticky Navigation; 2 echte Clanführer-Accounts für Konflikte, Viewer und Realtime.
- Import mit Spielern ohne Tags bzw. geändertem Namen validieren; unmarkierte manuelle Mitglieder niemals heimlich löschen.
- Ladezustände, Fehler und Wiederholversuche; API-Ratenlimits; bei Proxy-Ausfall lokaler/Cloud-Kader weiterhin nutzbar.
- Sicherheit: RLS/rollenbasierten Zugriff und Einladungen erneut testen; Supabase meldet aktuell optional deaktivierten Passwort-Leak-Check.
- Hilfe und Changelog bei jeder neuen Funktion aktualisieren.


## Umsetzung 31.10.2026: CWL-Live-Integration v1.2.0

- Im authentifizierten Cloud-Modus lädt eine neue Supabase Edge Function \`coc-cwl-status\` die CWL-Ligagruppe und Kriegsdetails. Token bleibt ausschließlich serverseitig. Auf der Plan-Startseite werden pro Tag Gegner, Anzahl der jeweiligen RH-Stufen, Kriegsstatus und tatsächliche Spielerangriffe mit Ziel, Sternen und Zerstörung angezeigt.
- Zukünftige Runden mit \`#0\` oder nicht erhältlichen Kriegsdetails bleiben ausdrücklich „noch nicht freigegeben“. Es gibt keine erfundenen Vorab-Gegner.
- Nur bei \`warEnded\`, gültigem War-Tag, verifiziertem Endzeitpunkt, passender Kriegsgröße und vollständigem tatsächlichem Line-up wird ein bislang offener Tag nach chronologischer Reihenfolge bestätigt. API-Spieler ohne bestehenden Eintrag werden ausschließlich als historische Spieler aufgenommen. Bereits gespielte/manuell gesperrte Tage werden nicht verändert.
- Ergebnis-/Gegnerdaten werden als optionale \`cwlLive\`-Metadaten im Cloud-Profil gespeichert, beim Archivieren übernommen und nach einem bewussten CWL-Reset für die zurückgesetzte Saison nicht erneut automatisch abgeschlossen.
- Die Cloud-App fragt beim Öffnen und anschließend regelmäßig während der Nutzung nach. **Noch kein serverseitiger unbeaufsichtigter 24/7-Abschluss**: Wenn niemand die App geöffnet hat, erfolgt die Übernahme beim nächsten erfolgreichen Aufruf.
- Die lokale Offline-PWA und der normale Cloud-Planer bleiben ohne sichtbare Liga-Gruppe unverändert nutzbar; bei Supercell-Ausfall werden keine Tage abgeschlossen.
- Die erste echte CWL nach Freigabe ist der notwendige End-to-End-Test von API-Antworten, Berechtigungen, Echtzeit-Aufstellungen und Übergang zur Folgerunde. Das ersetzt nicht die spätere vollständige Statistik-Historie über mehrere Saisons.


## 31.10.2026 · CWL-Anzeige: Spielstand und Clanabzeichen

- Auf jedem bekannten CWL-Kriegstag steht jetzt der gut lesbare, offizielle Sternestand zwischen den Clannamen und den Clanabzeichen. Die bisherigen Aufstellungen, Rein/Raus-Wechsel und RH-/Angriffsdaten bleiben separat zugänglich.
- Relevante Supercell-Felder der Kriegsantwort: `clan.stars`, `opponent.stars`, `destructionPercentage`, `badgeUrls.medium/small/large`. Wappen lassen sich für den Gegner bei Bedarf auch aus `leaguegroup.clans[].badgeUrls` ergänzen.
- Keine Addition der Einzelangriffe als Ersatz für Kriegssterne. Bei unvollständigen API-Werten sichtbar `–`, bei fehlender Badge-Datei neutrales Schild. Nicht freigegebene `#0`-Runden bleiben weiterhin unbekannt.
- Die browserseitige Wappen-URL wird erneut auf HTTPS und die originale Clash-Badge-Domain geprüft. Es gibt keine neue Anforderung an die Supabase-RLS-Berechtigungen und keinen zusätzlichen Schlüssel im Browser.


## 31.10.2026 · Angriffsliste im ClashPerk-Stil (v1.2.2)

- Pro Angriff: gut sichtbare `★★☆`, Zerstörung in Prozent und `RH18 Eigener Spieler vs RH17 Gegner`; bei fehlenden Angreifern drei ungefüllte Sterne und ausdrücklich offener Status.
- Während des Krieges offene Angriffe priorisieren; nach Kriegsende natürliche Aufstellungsreihenfolge anzeigen. Details bleiben beim Aktualisieren geöffnet.
- Beide CWL-Oberflächen nutzen denselben renderer: reale Cloud-App und vollständig isolierte Simulation. Die Original-Planerübersicht mit Rein/Raus bleibt in der Cloud-App erhalten.
- Keine Änderungen an Supercell-API-Key-Verwaltung, Speicherung, vorhandenen Locks, Datenformat oder öffentlichen Gastfunktionen.


## 31.10.2026 – Umsetzung Statistik v1.3.0

- **Cloud → Statistik:** KPI-Karten und Spieler-Tabelle analog zu ClashPerk, Filter 10/25/50 Kriege, normal/CWL, Angriff auf gleiches/höheres RH, ehemalige Spieler sowie Suche/Sortierung.
- **Import:** Das bereitgestellte Excel `Geronimo [Attack Log].xlsx` enthält 50 Kriege (29 CWs, 21 CWLs; 4.8.–29.10.2026). 1.244 Zeilen für eigene Angriffe; 105 davon exakt doppelte CWL-Angriffe. Bereinigte JSON-Historie: 1.139 eindeutige Angriffe. Quelle wird privat als Nutzerdatei bereitgestellt und nicht öffentlich im GitHub-Repository gespeichert.
- **Sicherheit:** `cwl_stat_wars` und `cwl_stat_attacks` haben strikte Clanmitgliedschafts-RLS. Nur Besitzer und Editor dürfen importieren. Ein Export für einen anderen Clan-Tag wird abgewiesen; Upload wiederholbar und nach `clan_id` sowie `war_key` idempotent.
- **Live:** Nach verifiziertem `warEnded` speichert die Cloud-App komplette CWL-Aufstellungen und über den `currentwar`-Endpunkt den zuletzt abrufbaren regulären CW; pro Spieler mit Sternen und TH-Informationen. Abschlüsse mit nicht vollständigen Aufstellungen werden für „Missed“ nicht als verlässlich gewertet.
- **Grenzen:** Fehlende historische 0-Angriffs-Spieler sind aus dem Angriffsexport nicht rekonstruierbar. Die offizielle Supercell-API garantiert keinen vollständigen Langzeitkriegsverlauf. Ohne geöffnete App und ohne erreichbare API kann eine beendete normale CW aus der aktuellen API verschwinden, bevor sie erfasst wird. Später kann ein optionaler Serverzeitplan dieses Risiko mindern.


## Nachtrag 31.10.2026 – zweite ClashPerk-Datei „Geronimo [Missed Attacks].xlsx“

- Quelle umfasst 171 Einträge: 95 United Fighters, 76 UF 2. Die 95 United-Fighters-Einträge entsprechen 125 verpassten Angriffen aus regulären Clankriegen über Mai–Oktober 2026.
- In den letzten 50 Kriegen des bisherigen Statistikimports sind 29 normale CWs und 21 CWL-Kriege enthalten. Für 22 der 29 normalen CWs existieren 42 passende Fehlangriffszeilen (57 Missed); die sieben anderen regulären CWs haben in dem zeitlich umfassenden Missed-Export keine Fehlangriffseinträge.
- Historische CWL-Angriffe sind in der Missed-Quelle nicht enthalten. Deren Fehlangriffe sind weiterhin unbekannt. Bei gemischten Statistiken wird eine belegte Untergrenze angezeigt, keine erfundene vollständige Zahl.
- Der einmalige private JSON-Import enthält `missed` mit (war_key, player_tag, player_name, missed_count) und die War-Abdeckung `missed_log_complete`. Die Originaldateien und personenbezogenen Spielerlisten werden **nicht** ins öffentliche Git-Repository übernommen.
- Private Tabelle `public.cwl_stat_missed` (RLS wie `cwl_stat_wars` und `cwl_stat_attacks`) speichert die per Kriegs-ID verknüpften Fälle. Die Hilfsspalte `missed_log_complete` sagt explizit, wo die Abwesenheit eines Missed-Eintrags als Null gewertet werden darf.


## Ergänzung 31.10.2026 – CWL-Missed und Cloud-Navigation (v1.3.2)

- Zweiter ClashPerk-Missed-Export für CWL nachgereicht. Nur **zwei eindeutige United-Fighters-CWL-Einträge** passen zur bestehenden 50-Kriege-Historie; die **42 bereits vorhandenen normalen CW-Einträge** bleiben unverändert. Somit 44 Ereignisse / **59 belegte Fehlangriffe** in der kombinierten privaten Importdatei.
- Eine CWL-Missed-Meldung ist ein belegter Einzelfall, aber **kein Nachweis vollständiger Kriegsteilnehmer- oder Fehlangriffsdaten**. Deshalb `≥` als Mindestzahl bei unvollständig abgedeckten CWL-Kriegen.
- Die Tab-Leiste zeigt alle vier Cloud-Navigationsziele in einer Reihe; nach Abmeldung wird die private Statistikansicht geschlossen und der lokale Plan gezeigt.
- Der Abruf normaler CWs ist unabhängig von der CWL-Planung: `coc-cwl-status` liefert bei fehlender aktiver CWL zusätzlich den aktuellen normalen Krieg; `cwl-stats.mjs` speichert **beendete** Kriege mit Angriffen und vollständiger Aufstellung im getrennten Statistikarchiv. Kein serverseitiger 24/7-History-Dienst; Supabase/Clash-API muss die Daten beim Cloud-Abgleich noch liefern.


## 31.10.2026 – CWL-Saisonfilter und nachvollziehbare Datenabdeckung

- CWL-Angriffe nach **CWL-Saisons**, nicht nach einem unbeschrifteten „Letzte N Kriege“-Limit. Die 21 War-IDs aus August, September und Oktober 2026 zählen als drei Ligawettbewerbe mit je sieben Kriegstagen.
- Auswahl 1 / 2 / 3 / alle gespeicherten CWL-Saisons. Der tatsächliche Monatsbestand wird pro Saison ausgewiesen; für unvollständige Saisons werden fehlende Kriegstage nicht automatisch ergänzt oder mit null gewertet.
- Reale Historie: `#L9RR0YP28` (UF⚡Weiss) besitzt in allen drei Monaten je sieben ausgeführte Angriffe, davon je sieben Drei-Sterne-Angriffe. Letzte 10 CWL-Kriegstage = zehn dieser 21 Attacken, nicht die volle Drei-Saisons-Bilanz.
- Die übrigen Filter (normal/alle, 10/25/50, RH-Vergleich, ehemalige Spieler) funktionieren unverändert. Keine Migration oder neues Datenformat erforderlich.


## 31.10.2026 – Aktuelle Clanübersicht und rollierende Spielerbewertungen (v1.3.5)

- Eigene Übersichtskarte für einen aktiven normalen CW, gespeist aus dem authentifizierten `/clans/{tag}/currentwar`-Endpunkt im vorhandenen Supabase-Proxy. Dort sind Spielstand, Gegner, Zeit und offene Angriffe jederzeit während des geöffneten Cloud-Planers sichtbar; keine CWL-Platzbelegung.
- Statistik: **letzte 50 reguläre Clankriege plus drei CWL-Saisons**. Die Fenster-Auswahl erfolgt anhand abgeschlossener Kriege und der CWL-Monate. Archivierte ältere Kriege werden nicht gelöscht, sondern außerhalb der Standardauswertung aufbewahrt. Die vorhandenen 50 importierten Kriege werden nicht migriert.
- 3-Sterne-Quote = nur 3-Sterne-Angriffe / nur tatsächlich ausgeführte Angriffe. Nicht eingeplant zu sein ist kein Fehlschlag; verpasste Angriffe werden separat aus belegten Listen und vollständigen Kriegsaufstellungen ausgewiesen.
- Safari-Mitgliederabgleich: `scrollIntoView`-Fehler behoben. Zusätzliche Fehlermeldung, wenn die API nicht erreichbar ist. Übernahme weiterhin erst nach manueller Prüfung; CWL-Regeln bleiben bestehen.
- Die Benutzertexte wurden aus Sicht eines neuen Clanleiters überarbeitet: einfache Erklärungen statt technischer Workflow-Hinweise. Regressionstests decken Rollenwechsel, normalen CW und Ausschnittsberechnung ab.


## 31.10.2026 – Navigationseinstellungen v1.3.7

Im Tab „Übersicht“ stehen jetzt nur noch inhaltliche Übersichten (CW, Einsatzverteilung, Archive). Über das Zahnrad neben dem Clannamen öffnet sich eine eigene Einstellungsseite für Profile, CWL-Grunddaten, Theme und lokale Sicherung. Der Bereich „Clan & Konto“ des verbundenen Cloud-Clans bleibt erhalten und ist von dort aus ebenfalls erreichbar. Kein zusätzlicher Bottom-Tab und keine Datenmigration.
