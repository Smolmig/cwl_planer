# Cloud v1.6.0 – kontrollierter CWL-Release (03.11.2026)

## Umfang
Ein einziger Release-Branch aus dem getesteten Integrationsstand von PR #55 (enthält #53/#54) wird gegen `main` gemergt. Niemals die einzelnen Drafts #50–#55 zusätzlich mergen.

- Globale exakte Einsatzziele (1–6), drei Rotationsstufen, alte Prioritäten konservativ erhalten; gespielte/gesperrte Kriege bleiben fix.
- Mitglieder-Notizen, Player-Tag-basierter Austritt/Wiedereintritt, geprüfter API-Roster mit Warnung bei ungewöhnlich vielen Austritten.
- Manuell bestätigter API-Notfallmodus; normaler API-Kader schützt Name/RH, Sammelbearbeitung und Löschwege.
- CWL-Tag-1 bis Tag-7: vorläufige Clash-Aufstellung, rein lesender Abgleich mit **empfohlener** Aufstellung, konkrete Wechsel samt Player-Tag, eigene und gegnerische Teamliste als Dropdown.
- Kein „passt“ aus unvollständigen, alten oder falsch zugeordneten API-Daten; erneuter Abruf nötig, wenn Cloud-Profil ersetzt oder ein Krieg nur aus Cache ergänzt wurde.
- Sidebar-Schalter als dezenter Button im Kopf statt schwebendem Chevron.

## Release-Daten
- Ziel: `main` → `v1.6.0`, Datenformat **v9 unverändert**, separate Offline-`index.html` **v1.0.2 unverändert**.
- Keine SQL-Migration, kein Supabase-Edge-Deployment und kein Schreiben in produktive CWL-Planungen zum Testen.
- Versionen in `cloud-version.json`, `cloud-app.html`, `cloud-sync.mjs` und `cwl-live.mjs` einheitlich auf 1.6.0; damit werden alte JS-Module nicht fälschlich aus dem Cache bezogen.
- Der Service Worker cached keine Cloud-Module offline; die Offline-PWA-SW-Version bleibt unverändert.

## Prüf-/Freigabekriterien
1. Regression auf **Release-PR-Head** vollständig grün; nicht nur auf früheren Entwicklungs-PR-Commits.
2. Seit Release-Branch-Punkt keine unbeabsichtigten Änderungen in `supabase/`, `index.html`, `service-worker.js` oder Daten-/Migrationstabellen.
3. Cloud-Daten vor Release **nur lesend** geprüft: 3 Profile, 12 vorhandene Snapshots, Revisionsbereiche 5–198 (Momentaufnahme; natürlich veränderlich). Kein produktiver Test-Write.
4. Merge-Head gegen `main` erneut vergleichen; nur genau diesen SHA mergen.
5. Live-GitHub-Pages auf HTML-Version `v1.6.0`, `cloud-version.json` und verlinkten Modulen prüfen. Falls Pages-Verzögerung, nicht vorschnell „live“ behaupten.
6. Echte angemeldete Cloud-Konten / iPhone Safari **nicht** durch automatisierte Tests simulieren oder in produktive Pläne schreiben. Dafür ist eine manuelle Smoke-Abnahme nötig.

## Rücknahme im Fehlerfall
- GitHub-Release-Merge kann durch einen **reinen Code-Revert** auf den letzten guten Stand rückgängig gemacht werden. Danach muss eine frische Version-/Cachekennung gesetzt werden, damit aktive Browser nicht bei fehlerhaften Modulen hängen bleiben.
- **Nie** alte JSON-Daten zurückschreiben oder Datenbanktabellen leeren. Snapshot-/Recovery-Daten, archivierte/gespielte Tage und gemeinsame Cloud-Revisionen erhalten.
- Bei akutem Berechtigungs-/Datenkonflikt: Vor weiteren Aktionen Cloud-Stand neu laden; nicht einfach wiederholt speichern.
- Keine automatischen Datenbankänderungen durch dieses Release.

## Bewusst später
- #46: Theme-/UI-Polish, Navigation, Filter, komplexe Cleanup-Arbeiten.
- #44: Angriffsstärke-/Gegnermodell als eigenes standardmäßig deaktiviertes Experiment.
- Echte CWL-API-/Mehrgeräte-Abnahme mit berechtigtem Testkonto nach kontrollierter Veröffentlichung; keine ungefragten Änderungen am laufenden United-Fighters-Plan.
