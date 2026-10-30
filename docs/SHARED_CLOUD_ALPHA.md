# Gemeinsamer CWL-Planer – integrierte Alpha (v1.1.0-alpha.1)

Die **normale** PWA bleibt unter `https://smolmig.github.io/cwl_planer/` lokal nutzbar.
Die **integrierte Cloud-Testversion** ist unter `https://smolmig.github.io/cwl_planer/cloud-app.html`.

## Grundprinzip

- **Gast:** Bestehender lokaler CWL-Planer, vollständige manuelle Planungsfunktionen, CSV-/Textmitgliederimport, Daten nur im Gerätespeicher. Kein Cloud-Zugang und keine Synchronisation.
- **Angemeldet:** Der Planer verwendet ausschließlich den verknüpften Supabase-Clan. Lokale Profile werden **nicht** automatisch migriert oder geschrieben. Benutzer-Session und Theme-Präferenz können weiterhin browserseitig gespeichert sein.
- **Cloud:** Gleiche vorhandene Planungsoberfläche; Speicherung über Cloud-Profil mit Revisionsprüfung und Realtime-Mitteilungen. Bei Konflikt keine automatische Überschreibung.
- **Besitzer:** Clan verknüpfen, Vize/Beobachter per einmaligem 12-Zeichen-Code einladen, bearbeiten.
- **Vize:** Gemeinsamen Plan bearbeiten, Mitglieder synchronisieren.
- **Beobachter:** Nur ansehen, keine Cloud-Profiländerungen; Datenbank-RLS ist die entscheidende Zugriffssperre.
- **Mitgliederabgleich:** Clash-of-Clans-API nur über signierte Supabase Edge Function; vergleicht per Player-Tag, zeigt neue/geänderte/nicht mehr im Clan befindliche Mitglieder, übernimmt erst nach Bestätigung. Ehemalige optional auf Pause, nie automatisch löschen; vorhandene Fix/Prio/3★/Tagesregeln/gespielten Snapshots bleiben.
- **Änderungsverlauf:** Letzte 30 Profil-Ereignisse, Actor-Anzeigename, Revision, betroffene Spielernamen und Anzahl gespielter Tage. Keine Bearbeitung von Ereignissen durch Nutzer.

## Besitzer/Vize testen

1. **Supabase Auth Redirect URL** ergänzen: `https://smolmig.github.io/cwl_planer/cloud-app.html`. Für diese Testseite gibt es einen [direkten Dashboard-Link](https://supabase.com/dashboard/project/yjldnvfwposfwmzmcsow/auth/url-configuration).
2. Neue Alpha auf dem iPhone öffnen, oben **☁️ Konto** auswählen und dich mit dem vorhandenen Konto anmelden.
3. Den bereits angelegten Clan **United Fighters** auswählen. Ein leerer Cloud-Plan ist bei der ersten Nutzung normal.
4. Einen **Anzeigenamen** vergeben, damit der Änderungsverlauf Personen korrekt zuordnet.
5. **Mitglieder abgleichen** tippen, Diff prüfen, Änderungen übernehmen (neue Spieler starten auf Pause, bis du sie für die CWL freigibst).
6. Nach der Cloud-Speicherung prüfen, ob die Einträge nach Neustart der Testseite wieder erscheinen.
7. **Vize einladen**, Rolle Editor, den Link privat teilen. Der Vize registriert einen eigenen Account, bestätigt ggf. die E-Mail, und löst den Einladungscode ein.
8. Auf zwei Geräten einen Spieler ändern: Der andere Nutzer soll die neue Revision sehen. Bei konkurrierenden ungesicherten Änderungen wird kein älterer Cloud-Stand still überschrieben.
9. Beobachter einladen, prüfen, dass kein Schreibzugriff möglich ist.
10. Vor Tests mit echten CWL-Daten über **Aktuelles Profil exportieren** ein Backup herunterladen.

## Bekannte Grenzen (nicht als fertig ausgeben)

- **Alpha**, bisher nur automatisierte Tests und datenbankseitige Rollback-Tests, noch **kein vollständiger echter Zwei-Account-Browsertest**.
- Im Gastmodus bleibt das **bestehende lokale Speichern** erhalten, damit niemand seine v1.0.x-Profile verliert. Für neue Besucher können wir später einen expliziten flüchtigen Gastmodus ergänzen.
- Cloud-Daten werden als ganzes Profil gespeichert. Revisionsprüfung verhindert stilles Überschreiben; echtes Feld-für-Feld-Merging ist noch nicht vorhanden.
- Der Cloud-Modus verlangt Internet. Eine spätere offlinefähige Synchronisationswarteschlange ist noch nicht implementiert.
- CoC-Mitgliederabruf im Gastmodus erfolgt derzeit nur über manuelle CSV-/Textimporte. Der API-Abgleich erfordert einen angemeldeten Clan, um API-Raten und Geheimnisse abzusichern.
- Verknüpfen eines Clan-Tags belegt noch nicht automatisch den Besitz des echten Supercell-Clans. Für eine spätere öffentliche Version ist echte Clanverifizierung notwendig.
- Das Cloud-Profil ist eine einzelne Kopie; ein Upload eines alten Backups überschreibt auf Nachfrage. Während der aktuellen Alpha möglichst erst ein eigenes Testprofil verwenden.
- Einladungen und die Profilhistorie werden nur für authentifizierte Clanmitglieder verfügbar gemacht, RLS aktiv; zu jeder Testphase Supabase Security Advisor prüfen.
- Änderungen an den **Cloud-Tabellen** sind bereits aktiv und über die SQL-Migrationsdateien dokumentiert; niemals zweimal manuell anwenden.

## Versionsstände

- Haupt-App: `v1.0.1` (PWA-Cache-Fix: weitere HTML-Seiten überschreiben nicht mehr den Offline-Fallback).
- Integrierte Cloud-Alpha: `v1.1.0-alpha.1` (noch nicht die normale Homepage).
- Datenformat: unverändert `9`, lokaler Schlüssel unverändert.

## Feedback-Runde: Alpha.2 (30.10.2026)

- API-Fehler beim ersten Mitgliederabgleich: Authentisierte Edge Function hatte die falsche User-ID-Eigenschaft gelesen (`ctx.userClaims.sub` statt `ctx.userClaims.id`). Der Zugriff wird weiterhin per Benutzer-Session + Clanmitgliedschaft geprüft.
- Im angemeldeten Mitglieder-Tab steht **Mitglieder importieren / aktualisieren** im Vordergrund; manuelle Aktionen liegen unter **Mitglieder manuell verwalten**.
- Noch nicht vorhandene Cloud-Mitglieder erhalten beim Import die Markierung **NEU**; sie verschwindet bei der ersten Interaktion mit der Spielerzeile. Die Kennzeichnung wird mit dem Cloud-Profil synchronisiert.
- Spieler, die beim nächsten Abgleich nicht mehr im Clan sind, werden nicht gelöscht. Sie bleiben als **AUSGETRETEN** ausgegraut am Ende der Liste und werden vorsichtshalber auf Pause gesetzt. Kommen sie zurück, wird ihre Markierung beim Abgleich entfernt.
- Unveränderte ausgetretene Spieler werden nicht bei jedem weiteren Abgleich erneut als „gerade gegangen“ gemeldet.
- Kontozugriff über **Clan ▾**; zusätzliche Clanverknüpfung in einem aufklappbaren Bereich. Keine doppelten lokalen Profilaktionen im Cloud-Modus.
- Bei einer API-Antwort mit Fehlerstatus zeigt die Testoberfläche möglichst die tatsächliche Fehlermeldung statt nur `Edge Function returned a non-2xx status code`.

Die normale App bleibt weiterhin auf v1.0.1 und von dieser Alpha-Iteration getrennt. Backend-Funktion `coc-clan-members` ist bereits auf die korrigierte Fassung deployed; der echte Browserabruf nach der Korrektur muss durch einen angemeldeten Clanleiter bestätigt werden.

## Feedback-Runde v1.1.0-alpha.4 (30.10.2026)

- Sortierung und „Mehrfachauswahl“ sind auf Mobilgeräten einheitlich hoch und breit; die Namen werden als **schreibgeschützte Beschriftung plus sichtbarer Stift** gerendert. Erst ein Stift-Tipp öffnet die Tastatur.
- Im Clanmenü erkennt man **Mein Clan · Besitzer** vs. **Gemeinsamer Clan · Vize/Beobachter**. Beim Wechsel werden Plan, Mitglieder, Auswahlmodus und Filter passend zurückgesetzt.
- Eine Aktivitätsanzeige zeigt pro Clan, wer innerhalb der letzten zwei Minuten eine Anmeldung in der App aktiv hatte. **Das ist keine Live-Cursoranzeige:** „aktiv“ kann bis zu zwei Minuten nach Schließen noch angezeigt werden.
- Vize/Beobachter können einen geteilten Clan selbst verlassen (ohne fremde Daten zu löschen). Besitzer dürfen ihren eigenen Cloud-Clan nur nach doppelter Bestätigung dauerhaft löschen. Bei der Löschung gehen alle zugehörigen Cloud-Profile, Einladungen, Änderungsereignisse und Mitgliedschaften verloren – vorher JSON-Backup erstellen!
- Der Button „Jetzt aktualisieren“ zeigt deutlich, ob der Cloud-Stand bereits aktuell ist oder eine neue Revision geladen wurde; andere bearbeitete/gespeicherte Änderungen kommen weiterhin über Realtime.
- Cloud-Alpha-Versionen werden bei aktiver Verbindung periodisch und beim Wiederöffnen geprüft und bei sicherem Zustand automatisch geladen. Während offener Eingaben, Dialoge, Speichervorgänge und Konflikte wird keine automatische Neuladung erzwungen. iOS kann die Hintergrundausführung einer geschlossenen/suspendierten Web-App pausieren.
- Die unveränderte Offline-Haupt-App bleibt separat. Der Browser-Synchronisationstest mit zwei echten Accounts und iPhone-Zoomtests steht weiterhin aus.
- Migrationen sind im verbundenen Supabase-Projekt bereits aktiv: `cwl_clan_presence_and_self_leave`, `cwl_touch_presence_rpc`. Keine manuelle Zweitausführung.

## Alpha 5 – 30.10.2026

- **Änderungshinweise:** Popup über der unteren Navigation, das die letzte von einer anderen Person gespeicherte Cloud-Änderung nennt. „Ansehen“ öffnet das Änderungsprotokoll. Es werden nur im Backend bestätigte Änderungen angezeigt.
- **Synchronisierung:** Ergänzend zu Supabase Realtime prüft die geöffnete Cloud-App alle 15 Sekunden die Profilrevision. Damit werden auch verpasste Push-Nachrichten abgefangen. Bei lokalen ungespeicherten Änderungen oder offenen Bearbeitungsdialogen erfolgt niemals stilles Überschreiben; Hinweis/Konflikt bleiben sichtbar.
- **Archiv:** Archivierte CWLs lassen sich nach eindeutiger Bestätigung entfernen. Dieser Vorgang löscht weder aktuelle Mitglieder noch die aktive CWL. Bei Cloud-Nutzern speichert die Änderung in der gemeinsamen Datenbank und ist jetzt auch als Archivänderung im Protokoll erkennbar.
- **App-Updates:** Kleine Versionsmanifest-Datei `cloud-version.json` ermöglicht schnelle Prüfung beim Seitenstart, Zurückwechseln und der ersten Interaktion, zusätzlich periodisch. Neue Versionen laden automatisch über eine eindeutige URL; offene Dialoge, Editoren und ungespeicherte Cloud-Daten werden nicht unterbrochen. Für die erste Umstellung von alten Alpha-Versionen kann einmaliges manuelles Aktualisieren nötig sein.
- **Changelog in der App:** Direkt bei „App-Version“ steht nur die kurze Zusammenfassung der aktuellen Version. Bei jeder neuen Alpha/Release muss dieser Text und die Versionsmanifest-Datei gemeinsam aktualisiert werden.
- Geschlossener Pilotlink bleibt `cloud-app.html`. Nicht als öffentlich fertige Version deklarieren, bis tatsächlicher Mehrbenutzer-Abgleich und UI getestet sind.
