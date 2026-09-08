Site: https://smolmig.github.io/cwl_planer/

Hinweise:
- Die App speichert Daten lokal auf dem jeweiligen Gerät.
- In der App kannst du ein JSON-Backup exportieren/importieren.
- Nach dem ersten vollständigen Laden funktioniert sie auch offline.

Update v2: 
- iPhone Safe-Area oben korrigiert, damit Titel/Button nicht mehr mit Uhrzeit, Dynamic Island oder Statussymbolen überlappen.

Update v3:
- Tage/Sonderfall-Fenster bleibt nach Änderungen offen.
- Neuer Button „Aufstellung + Wechsel kopieren“ kopiert den kompletten 7-Tage-Plan.

Update v4:
- App startet für neue Nutzer mit leerer Mitgliederliste; vorhandene v1-v3-Daten werden automatisch übernommen.
- Profile/Clans hinzugefügt: erstellen, wechseln, kopieren, umbenennen und löschen.
- Reset leert das aktive Profil jetzt wirklich vollständig.
- Mehrfachauswahl für Mitglieder mit „Alle“, „Keine“, „Ausgewählte löschen“ und „Alle löschen“.
- Mehrere Mitglieder können auf einmal per Textliste eingefügt werden.
- CSV-Vorlage kann heruntergeladen, ausgefüllt und wieder importiert werden (Dabei/Fix/Priorität/Tag1-Tag7).
- Profil-Backup einzeln sowie Komplett-Backup aller Profile möglich.
- „Fehler melden“ öffnet direkt ein neues GitHub-Issue mit technischen Basisinfos, aber ohne Spielernamen.

Update v5:
- Mitgliederlisten-Vorlage vereinfacht: nur noch ein Spielername pro Zeile; Einstellungen erfolgen danach in der App.
- Vorlage verständlicher benannt und direkt in der Datei erklärt.
- Mitgliederliste kann jetzt auch direkt im Mitglieder-Tab importiert werden.
- Mehrfachauswahl erweitert: ausgewählte Mitglieder gemeinsam auf Dabei/Pause sowie Fix/Nicht-Fix setzen.
- „Erst ab Tag …“ und „Raus ab Tag …“ können kombiniert werden und die Auswahl bleibt sichtbar gespeichert.
- Profil-Auswahl enthält unten direkt „+ Neues Profil erstellen…“.
- Frische Nutzer starten weiterhin mit leerem Profil; vorhandene v4-Daten werden automatisch in v5 übernommen.

Update v6:
- Mitglieder-Tab visuell aufgeräumt und Aktionen klar nach Hinzufügen, Listenimport und Mehrfachbearbeitung benannt.
- „Mehrere Mitglieder“ erklärt jetzt ausdrücklich: ein Name pro Zeile, nach jedem Namen Enter drücken; erkannte Namen werden live gezählt.
- Mehrfachbearbeitung übersichtlicher gruppiert: Auswahl, CWL-Teilnahme, Fixstatus und Löschen.
- Buttons eindeutiger beschriftet (z. B. „Mitgliederliste importieren“, „CSV-Vorlage herunterladen“, „Mehrfach bearbeiten“).
- Mitgliederlisten-Vorlage weiter vereinfacht und als „CWL_Mitgliederliste_Eintragen.csv“ klarer benannt; sie enthält keine Beispielspieler mehr, die versehentlich importiert werden könnten.
- Doppelte Mitgliederlisten-Aktionen aus „Einstellungen & Daten“ entfernt; Import und Vorlage liegen jetzt nur noch dort, wo sie hingehören: im Mitglieder-Tab.
- Profil-Auswahl trennt vorhandene Profile sichtbar von „+ Neues Profil erstellen…“.
- Frische Nutzer starten weiterhin vollständig leer; bestehende v5-Daten werden automatisch übernommen.

Update v7:
- Mehrfachbearbeitung und Dark-Mode-Kontrast überarbeitet; helle Flächen mit schlecht lesbarer Schrift beseitigt.
- Hilfe-Funktion ergänzt und Begriffe direkt erklärt: Dabei, Fix, Prio, Rathaus, AUTO/MUSS/RAUS, Sonderfälle, Profile und gespeicherte Tage.
- Neu berechnen gibt jetzt eine kurze, selbst verschwindende Rückmeldung statt eines Popups.
- Am Ende der Mitgliederliste gibt es zusätzlich einen Button zum schnellen Hinzufügen eines neuen Mitglieds.
- Mitglieder-Vorlage lesbarer gemacht, mit UTF-8/BOM für Excel und klarer Schritt-für-Schritt-Anleitung; Datei heißt jetzt „CWL_Mitgliederliste_Vorlage.csv“.
- Mehrere-Mitglieder-Fenster verwendet neutrale Muster-Namen statt Clan-Mitglieder.
- Mehrfachbearbeitung klar von Hinzufügen/Import getrennt und um gemeinsames Setzen von Prio und Rathaus erweitert.
- Optionales Rathaus-Level pro Mitglied ergänzt.
- Mitglieder können nach Name, Rathaus, Priorität oder CWL-Teilnahme sortiert werden; in „Eigene Reihenfolge“ lassen sie sich mit ↑/↓ frei anordnen.
- Prioritätsauswahl verbreitert, damit nach der Auswahl sichtbar „Prio 0–5“ angezeigt wird.
- Bestehende v6-Daten werden automatisch übernommen; frische Nutzer starten weiterhin leer.

Update v8:
- Optionale 3★-Stärke pro Mitglied ergänzt: Oft 3★, Solide / teils 3★, Selten 3★, Normal kein 3★ oder Unbekannt.
- 3★-Stärke kann sortiert und per Mehrfachbearbeitung für mehrere Mitglieder gleichzeitig gesetzt werden.
- Pro Krieg können jetzt eigene Tagesziele für die gewünschte Rathaus-Verteilung und 3★-Stärke festgelegt werden.
- Tagesziele sind bewusst weich: Fix/MUSS/RAUS und gespeicherte Tage haben Vorrang; danach versucht der Planer RH-/Stärke-Ziele zu treffen und hält die übrige Rotation möglichst fair.
- Tageskarten zeigen Zielwerte und tatsächliche Erfüllung direkt an; RH und 3★-Einstufung werden auch bei den eingeplanten Spielern eingeblendet.
- Bestehende v7-Daten werden automatisch übernommen; neue Felder starten neutral (3★-Stärke unbekannt, keine Tagesziele).

Update v9:
- Live-CWL-Workflow überarbeitet: Tage werden chronologisch als GESPIELT bestätigt, das tatsächliche Line-up muss exakt der Kriegsgröße entsprechen und nur der zuletzt bestätigte Tag kann wieder entsperrt werden.
- Bereits gespielte Tage bleiben stabil; vergangene Tagesregeln sind gesperrt und spätere Änderungen berechnen nur offene Tage neu.
- Neue CWL / Planung zurücksetzen direkt im Plan-Tab. Laufende oder abgeschlossene CWLs werden vor dem Neustart als schreibgeschützter Snapshot archiviert.
- Spieler, die bereits an gespielten Tagen eingesetzt wurden, bleiben bei späterem Entfernen in Historie und Einsatz-Verteilung erhalten.
- Einsatz-Verteilung aufgewertet: Rotationsspanne direkt in der Planübersicht, weiterhin konkrete Einsatzanzahlen pro Spieler; Fairness-Badge nur als Zusatzsignal.
- Doppelte Clash-Spielernamen sind erlaubt. Namensdopplungen werden mit ! markiert; optionaler Player-Tag wird zur eindeutigen Zuordnung empfohlen.
- Profilnamen müssen eindeutig sein.
- Tagesziele klar als optionale Gegnerplanung beschrieben; unmögliche Ziele und Konflikte mit Fix/MUSS werden direkt markiert.
- Prio 0–5 praxisnäher erklärt; Mehrfachbearbeitung klarer geführt; RH-Auswahl auf RH3–RH20 angepasst.
- 15er/30er-CWL als schnelle Kriegsgrößen-Presets; individueller Wert bis 50 bleibt möglich.
- Neue leere Mitglieder werden nicht mehr dauerhaft angelegt; Namen dürfen nicht leer gespeichert werden.
- Kopiertexte klarer: gesamter CWL-Plan bzw. Wechseltext; GESPIELT/GEPLANT wird im Gesamttext unterschieden.
- Dark Mode bleibt Standard; Light Mode und Systemmodus können in den Einstellungen gewählt werden.
- Responsive Darstellung für Smartphones, Tablets und Desktop verbreitert/optimiert; optionale Kompaktansicht reduziert lange 30er-Pläne.
- PWA-Update verbessert: Navigation nutzt Network-first mit Offline-Fallback; App-Version und manueller Update-Button ergänzt.
- Backup-Wiederherstellung warnt vor dem Ersetzen aller Profile; Datenformat ist versioniert. Ein lokaler Recovery-Snapshot schützt zusätzlich vor beschädigten gespeicherten Daten.
- Grunddaten werden nach CWL-Start gesperrt, damit keine gemischten 15er/30er- oder Tageszustände entstehen.
- Diverse Dark-Mode-Kontrast-, Safe-Area-, Touch- und Toast-Verbesserungen.
