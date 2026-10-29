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
