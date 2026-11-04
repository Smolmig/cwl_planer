# CWL-Saison & Archiv unter „Mehr“ – Phase 1 (04.11.2026)

## Ziel
Mehr bekommt eigenständige Seiten **CWL-Saison** und **CWL-Archiv**. Der Tab **Plan** ist für operative Lineups/Wechsel, **Einsätze** für aktuelle Einsatzverteilung. Keine zweite unabhängige Planungslogik.

## Implementiert (PR-Preview)
- Echte Navigation `Mehr → CWL-Saison` und `Mehr → CWL-Archiv` inklusive Zurück nach Mehr, korrektem aktivem Bottom-Navigation-Reiter und responsivem Gold-/Dark-Theme.
- Vorhandener Archivbereich von `Einsätze` nach `Mehr → CWL-Archiv` verschoben: **bestehende** Archivobjekte/Spieler-Snapshots/Details bleiben, keine neue Speicherung oder Datenmigration. Beobachter sehen keine Löschaktion.
- CWL-Saison als read-only Unterseite mit drei Segmenten: **Gruppe** (bisher bekannte Gegner der eigenen sieben Kriege, ausdrücklich *keine* erfundene Gruppenrangliste), **Runden** (sieben Kriege mit echten Gegnern und validen Zuständen) und **Clan** (bei gestarteten/beendeten Kriegen bekannte Spieler, echte Einsätze, Angriffe, Sterne und Ø).
- Sicherer Umgang mit `preparation`, `inWar`, `warEnded`, unbekannten/fehlenden Runden, fehlenden Angriffen und bekannten alten Profil-Snapshots. Kein `0:0` als vermeintliches Ergebnis einer noch vorbereiteten Partie.
- Aktueller Abruf wird aus dem bestehenden `coc-cwl-status`-Refresh verwendet, ohne einen zweiten API-Abruf/weitere Berechtigungen. Fehlerhaft gecachte Rundentage sind keine frischen Quellen.
- Spieler- und Clan-Namen werden HTML-escaped; Clanwappen nur von Supercells vertrauenswürdigem HTTPS-Badge-CDN. Keine Client-API-Keys.

## Noch nicht implementiert (bewusst Phase 2)
- **Vollständige Gruppentabelle und alle vier Paarungen pro Runde**, also die in Clash sichtbaren 8er-Gruppeninformationen und eigene Bonus-/Tie-Break-Regeln: derzeit speichert die aktive Edge Function ausschließlich die **eigenen sieben** Gruppenspiele. Erfordert einen separaten, limitierten, gecachten, geschützten Serverabruf aller Gruppen-War-Tags und eigene RLS-/Speicherprüfung. Das kann nicht allein aus dem Cloud-Profil rekonstruiert werden.
- Historische Gruppentabellen, Auf- und Abstiege: offizielle Clash-API garantiert keine beliebige ältere Saisonhistorie. Snapshot-Persistenz und Backfill mit Herkunft/Abdeckung separat planen; keine Daten ohne Nachweis auffüllen.
- Statistikbasierte Lineup-Empfehlungen: eigenständiges optionales Experiment (#44), Standardplaner unverändert.
- Weitere „Mehr“-Unterseiten (CWL-Regeln, Design, Backup): separates navigationsbezogenes Paket nach iPhone-Preview.

## Tests & Deployment-Sicherheit
- Tests auf korrekte Saison-Summen, 7 Tage, falsche Nullwerte, HTML-Injection, Viewer-Archiv, Tabs, mobile 320/390/430 und Desktop.
- Keine SQL-/RLS-/Storage-/Edge-Function-Änderungen, keine Schreibaktionen in der Saisonansicht.
- Alle 1.8.2 Funktionen, Profildaten v9, separate Offline-PWA v1.0.2 bleiben erhalten.
- Release nur nach vollständiger CI und Prüfen des neu gekoppelten Cloud-Moduls sowie manuellem iPhone-Review.

## Nächste Tickets
- #71 Gruppe/Runden/Clan inkl. vollständigem API-Snapshot und Archiv
- #46 „Mehr“ vollständig und verständlich konsolidieren
- #44 Experimentelle, statistisch gestützte Einteilung
