> **NEUE PRODUKT-TO-DOS – 09.11.2026 (noch nicht implementiert):** Prioritäten und Einzelanforderungen in [Issue #121](https://github.com/Smolmig/cwl_planer/issues/121): [#46](https://github.com/Smolmig/cwl_planer/issues/46) Gold-Theme als Standard (bestehende persönliche Wahl erhalten) + vollständiges Hilfe-Audit mit verpflichtendem Hilfe-Abgleich **bei jedem späteren Update**; [#176](https://github.com/Smolmig/cwl_planer/issues/176) anschauliche/selektive Statistikexporte, vollständiger versionierter Statistik-Export und verlustarmer idempotenter Import, alle realen ClashPerk-Originalexportarten direkt importieren; [#177](https://github.com/Smolmig/cwl_planer/issues/177) App-Einstellung Deutsch/Englisch, **Deutsch Standard**, gesamte Cloud-/Offline-UI übersetzen und später beide Sprachfassungen pro Update pflegen. [UX-Richtlinien](UX_DESIGN_PRINCIPLES.md) und PR-Checkliste verbindlich berücksichtigen. **Bestehende technische Supabase-/Plan-Backups sind nicht mit Statistik-Datenportabilität gleichzusetzen.**

> **Aktuelle Übergabe:** Dieses Dokument hält nur den früheren Stand fest. Für den laufend gepflegten GitHub-Projektstand und den Einstieg in neue Chats bitte zuerst [ACTIVE_PROJECT_HANDOFF.md](ACTIVE_PROJECT_HANDOFF.md) lesen.

> **Historischer Stand:** Diese Übergabe dokumentiert die Entwicklungsplanung **vor Cloud v1.6.0**. Der Gesamt-Release wurde am 03.11.2026 über [PR #56](https://github.com/Smolmig/cwl_planer/pull/56) veröffentlicht. Für den aktuellen Stand siehe [Cloud v1.6.0](https://github.com/Smolmig/cwl_planer/releases/tag/v1.6.0) und die offenen Punkte in [Issue #46](https://github.com/Smolmig/cwl_planer/issues/46) / [#44](https://github.com/Smolmig/cwl_planer/issues/44). Alte Draft-PRs #50–#55 wurden durch #56 ersetzt und dürfen nicht erneut gemergt werden. Diese Datei bleibt zur Nachvollziehbarkeit erhalten.

# CWL-Planer – Übergabe für den nächsten Chat

**Stand: 03.11.2026, nach Live-Release Cloud v1.5.2.**  
**Zweck:** vollständige, weiterverwendbare Arbeitsgrundlage. Dies ist eine **Planung/Übergabe**, keine bereits umgesetzte v1.5.3.

## 0. Sofortiger Einstieg im neuen Chat

1. **Dieses Dokument zuerst lesen**, dann GitHub Issue [#49](https://github.com/Smolmig/cwl_planer/issues/49), [#46](https://github.com/Smolmig/cwl_planer/issues/46) und [#44](https://github.com/Smolmig/cwl_planer/issues/44).
2. Aktuellen `main`-Commit, `cloud-version.json`, die relevanten Codestellen und offenen PRs **neu prüfen**. Nicht aus alten Gesprächsständen ableiten, was implementiert ist.
3. **Nächstes Hauptziel:** exakte Einsatzziele, einfache Rotationsgewichtung, korrekte Wiedereintritte, Spielernotizen und reduzierte Cloud-Mitgliederverwaltung. Zuerst Tests/Logik, danach UI. Die Rest-UI-Baustellen sind weiter unten als Backlog erfasst.
4. **Keine direkte Datenbank- oder Produktionsplan-Manipulation** zum Testen. Feature-Branch, reproduzierbare Tests und anschließend kleine nachvollziehbare Releases.
5. Nutzer möchte das meiste selbstständige Arbeiten über GitHub-/Supabase-Verbindungen, keine langwierigen Rückfragen bei bereits geklärten Punkten.

**Links**
- Repository: https://github.com/Smolmig/cwl_planer
- Live-Cloud-App: https://smolmig.github.io/cwl_planer/cloud-app.html
- Tracking für diese Übergabe: https://github.com/Smolmig/cwl_planer/issues/49
- Restliches UI/Cleanup: https://github.com/Smolmig/cwl_planer/issues/46
- Experimentelle Gegner-/Stärke-Planung: https://github.com/Smolmig/cwl_planer/issues/44
- Älterer gemischter Draft-PR: https://github.com/Smolmig/cwl_planer/pull/45

## 1. Verifizierter Projektstand

- Aktiver Cloud-Einstieg: **`cloud-app.html`**, aktuelle Release-Version **v1.5.2** (GitHub `main`, `cloud-version.json`, Cloud-Release).
- Cloud-Logik in `cloud-sync.mjs`, Statistik in `cwl-stats.mjs`, Live-CWL/Kriege in `cwl-live.mjs` / `cwl-current-war.mjs`, Backups in `cloud-backups.mjs`.
- Cloud nutzt Supabase inklusive Auth, Clan-/Rollenrechten, Realtime, gespeicherten Plänen und Edge Functions als Clash-API-Proxy. **Cloud ist online-only**. API-Abfrage braucht nicht identisch mit Cloud-Verbindung zu sein.
- Separate lokale/offline PWA: **`index.html` (v1.0.2)** plus `service-worker.js`. Zusätzlich hat `cloud-app.html` einen nicht angemeldeten lokalen Gastmodus. Diese Varianten bei Änderungen auseinanderhalten. Alte lokale Daten/Backups keinesfalls verlieren.
- Kürzlich bereits veröffentlicht:
  - **v1.5.1 / PR #47:** Kopfbereich, direkter Clanwechsel, einklappbare Desktop-Seitenleiste.
  - **v1.5.2 / PR #48:** **Clanauswahl erst vormerken und per „Wechseln“ bestätigen**; Abbrechen und „Clan & Konto“ im Menü; mobile Header-Position; RH/Toggle-Abstand; auf Mobil zwei redundante Chips verborgen; kleiner Stift und Sidebar-Chevron. Automatisierte Tests + GitHub Pages grün.
- **Nicht umsetzen als schon fertig:** der neue globale Solver, exakte Ziele, Rotationsstufen, Wiedereintritts-Snapshot, Spielernotizen, API-Notfallmodus. Alles bislang **nur fachlich abgestimmt**.
- **PR #45 bleibt offen und Draft**: gemischte Navigation/Gold/Mehr-Änderungen aus älterem Branch, teilweise von v1.5.1/1.5.2 überholt. **Nicht direkt mergen**. Nur nach aktuellem `main` relevante Reständerungen sauber extrahieren.
- Keine zweite Staging-Supabase-Instanz vorgesehen. Nutzer bevorzugt **kostenlos**, kleine, vorsichtig geprüfte **Live-Patches** und Feedback bei normaler Nutzung, nicht eine parallele App mit Test-Login und doppelter Testarbeit.

## 2. Fachlich beschlossene nächste Funktionen – verbindliche Produktanforderungen

### A. Exaktes Einsatzziel, nicht Mindestzahl

- Für einen **rotierenden** Spieler heißt „Genau N Einsätze“ wirklich **exakt N über die gesamte CWL**; der Planer wählt die konkreten Tage selbst.
- Bei **7-Tage-CWL** auswählbar: **„Automatisch“ oder genau 1 bis 6 Einsätze**. Sieben wird **nicht angeboten**: Wer jeden Tag spielen soll, wird **Fix** gesetzt.
- Sonderfälle: Anzahl Tage im Planer kann variieren; Auswahl logisch auf **maximal Tage minus 1** begrenzen. Bei kurzen Sonderplänen UX für unmögliche/irrelevante Ziele abfangen.
- Ein Ziel ist eine **harte Gesamtvorgabe**, sofern erfüllbar, nicht wie bisher ein bevorzugtes/minimales Soll. Der Planer darf niemals unbemerkt mehr oder weniger Einsätze zuweisen und das Ziel als erfüllt darstellen.
- `Fix`, `MUSS`, `RAUS`, verfügbare/gespielte/gesperrte Tage und 15/30 Slots berücksichtigen. Bei Konflikten **konkreten verständlichen Hinweis** anzeigen statt ignorieren.
- Beispiele für Regressionen:
  1. 15 Slots × 7 Tage; 14 Fix + 2 rotierende Spieler = **7 zu verteilende Rotationsplätze**. Ohne Vorgaben möglichst **4:3**.
  2. Spieler A „Genau 4“ -> A 4, B 3; A „Genau 5“ -> 5:2.
  3. A „Genau 6“ -> 6:1: **zulässig**, aber unaufdringlicher Hinweis auf ungleiche Rotation.
  4. A 5 und B 5 bei nur 7 freien Plätzen -> **nicht erfüllbar**, harter Konflikt.
  5. A an drei Tagen MUSS, exaktes Ziel 2 -> **Regelkonflikt**.
  6. Schon drei tatsächlich gespielte Einsätze, Ziel nachträglich 2 -> **Konflikt**, historische Tage nicht anpassen.
  7. Tages-RH-/Stärkeziele dürfen harte Einsatzregeln nicht übersteuern; wenig verfügbare Spieler sollen nicht durch tageweise Greedy-Entscheidungen „verhungern“.
- Benötigt **global konsistente Mehrtagesplanung**, nicht bloß den heutigen Greedy-Kandidaten abschneiden. Zuerst harte Randbedingungen/Erfüllbarkeit, danach weiche Fairness-/Tagesziele. Geeignetes Verfahren nach Review wählen (z. B. Constraint-Suche / Min-Cost-Flow mit klarer Unsat-Diagnose). Vor produktiver Aktivierung Tests mit realistischen/synthetischen 15-/30er-Szenarien.

### B. Priorität 0–5 durch verständliche Rotationsgewichtung ersetzen

- **Priorität nicht vollständig entfernen**, sondern für rotierende Spieler **drei verständliche Stufen**:
  - **Bevorzugt berücksichtigen**
  - **Ausgewogen** (Standard)
  - **Seltener berücksichtigen**
- Ziel: Wenn bei ansonsten fairer Rotation manche Spieler einen Einsatz mehr erhalten müssen, erhält eine bevorzugte Person eher den zusätzlichen, eine seltener berücksichtigte eher den geringeren Anteil.
- **Fixspieler brauchen keine Gewichtung** -> ausblenden, keine Auswirkung. Bei **exaktem Einsatzziel** darf die Gewichtung die festgelegte Anzahl nie verändern. UI bei Rotationsspielern im **normalen ausgeklappten Bereich**, nicht unnötig tief verstecken.
- Wichtig: **Bestandswerte `priority: 0..5` nicht stillschweigend falsch migrieren.** Bestehende Clans/Backups beachten; nachvollziehbare Mapping-/Fallback-Strategie sowie Kompatibilitätstests definieren. `priority: 0` war bisher Default, nicht „negative Priorität“.
- Nicht mit dem gesonderten **experimentellen, an echten Angriffsdaten orientierten** Stärkemodell (#44) verwechseln. Diese einfache Rotationsgewichtung ist eine manuelle Fairnesspräferenz.

### C. Ausgetreten und wieder beigetreten – echten Vorzustand erhalten

- Spieler anhand **stabilem Player-Tag** wiedererkennen. Nach API-Austritt als „Ausgetreten“ **unten ausgegraut** behalten, während der Abwesenheit nicht automatisch für neue Tage einsetzen.
- Vor dem Austritt zuletzt gültigen Planungszustand schützen: **Dabei/Pause, Fix, Tagesregeln, Einsatzziel, Gewichtung, Notiz**.
- Beim Wiedereintritt zurück in aktive Liste, **genau den vorherigen Zustand wiederherstellen**: Wer vorher auf Pause war, bleibt Pause; wer Dabei/Fix war, erhält seinen ursprünglichen Status. Manuelle Änderungen, die während des Austritts bewusst gesetzt wurden, dürfen nicht durch alten Snapshot übersteuert werden.
- Bereits gespielte/gesperrte Kriegstage, vollständige Historie und frühere Lineups bleiben unangetastet. Spieler, die trotz Austritt ausdrücklich „Weiterhin dabei“ erhalten, gesondert behandeln.
- **Kein automatisches Sammellöschen beim CWL-Neustart!** Ausgetretene bleiben in der Liste, bis der Clanleiter sie **explizit** mit Rückfrage löscht; historische Daten bleiben geschützt.
- **IST-CODE:** `cloud-sync.mjs` `getRoster()` / `applyRoster()`: neue Spieler per Tag, `cocSyncState="former"` und `"kept"`, bei Rückkehr `delete m.cocSyncState`; beim Austritt wird `m.participating=false` gesetzt, **aber derzeit nicht zuverlässig wiederhergestellt**. `cocOrder`/Name/RH werden beim Abruf aktualisiert. Gespielte Lineups haben bereits eine Schutzlogik. **Zuerst diese Funktionen lesen**.

### D. API-geführter Cloud-Modus versus lokale manuelle Variante

- Bei gesunder Clash-API und verknüpftem Clan sind **Spielername und Rathaus reine API-Stammdaten**. Nicht mehr direkt editierbar; bei erfolgreichem Abgleich aktualisieren.
- Im **normalen Cloud-Modus** manuelles Hinzufügen von Clanmitgliedern und Löschen **aktiver API-Mitglieder** nicht prominent anbieten; redundante Controls entfernen/verbergen, nicht unkontrolliert aus Code/Altdaten löschen.
- **Nur bei „Ausgetreten“** oder echten manuell angelegten Sonderfällen gezieltes Entfernen mit Bestätigung erlauben; bereits benutzte Lineups/Archive erhalten.
- API-Ausfall: **zuletzt bekannte Daten bleiben sichtbar**. Keine plötzliche große UI-Umschaltung; sichtbare Fehlermeldung und bewusst aktivierbare **„Manuelle Notfallbearbeitung“** (Name/RH/Import/Korrekturen soweit nötig). Vor erneutem API-Abgleich bewusste Konfliktbehandlung, damit nicht unbemerkt überschrieben.
- **Wichtige Trennung:** Clash-API nicht erreichbar bei weiterhin funktionierender Supabase-Cloud ≠ **Supabase/Internet offline**. Die aktuelle Cloud-App ist online-only; nicht einfach annehmen, Offline-Cloud-Writes seien möglich.
- **Cloud-Gastmodus und separate Offline-`index.html`** müssen Namen/RH/manuell hinzufügen/löschen weiterhin ermöglichen. Lokale Oberfläche soll trotz mehr Controls übersichtlich bleiben.
- Bestehende Rollen (Owner, Editor/Vize, Viewer) und Freigabe-/Vorschlags-Sperren müssen auch bei Notfallfunktionen gelten.
- Ohne funktionsfähigen API-Link (z. B. Clan ohne Tag) den manuell nutzbaren Ausgangszustand ermöglichen und klar erklären.

### E. Spielernotizen

- **Kleiner, dezenter Notiz-Button rechts oben** in der Mitgliederkarte. Im Cloud-Modus ersetzt er den derzeitigen Namen-Stift als sinnvolle Zusatzfunktion; lokale manuelle Variante kann neben Namen bearbeiten ebenfalls Notizen besitzen.
- Kleine, unkomplizierte Textnotiz, etwa **bis 200 Zeichen** als UI-Vorschlag. Wenn vorhanden, **eine dezente Textzeile direkt in der Karte** anzeigen, möglichst ohne Layoutaufblähung.
- Notiz gemeinsam für berechtigte Clanführung speichern, für Leseberechtigte angemessen sichtbar. Bestand bei Umbenennung, Austritt/Wiedereintritt, Sortierung, CWL-Wechsel und Cloud-Abgleich erhalten.
- Schema/Datenspeicherung prüfen: derzeit Mitglied als JSON im Cloud-Profil (`freshMember`/`normalizeMember` in `cloud-app.html`); Cloud-Sync, Realtime, JSON-Backup/Restore, RLS und XSS-sichere Textdarstellung testen. **Keine öffentlichen privaten Notizen in GitHub committen.**

### F. Kartenlayout und Bedienung

- Auf vorhandener v1.5.2-Optik aufbauen, **kein kompletter Neubau**.
- Kopfzeile normal: Name, API-RH/Statistik, **Notizsymbol rechts oben**; sofort sichtbar **Dabei** und **Fix**.
- Im aufgeklappten Bereich: **Einsatzziel**, **Rotationsgewichtung**, **Tagesregeln** gleichmäßig und gut antippbar. Unnötige Namens-/RH-/Lösch-Buttons im Cloud-Normalbetrieb nicht zeigen.
- Bei Fixspieler Ziel/Gewichtung ausblenden, weil jeder verfügbare Tag belegt sein soll. Ausnahme der absoluten Konflikte beachten.
- Lokaler/Gast-/API-Notfallmodus braucht zusätzliche Felder und Aktionen, sauber gruppiert statt quetschiger Buttons.
- Bereits entfernt in v1.5.2: mobile Chips „✓ 3★-Werte aus Statistik“ und „Fix: alle verfügbaren Tage“, kleiner Namen-Stift im derzeitigen Cloudmodus. Jetzt **Cloud-Stift durch Notizsymbol ersetzen**, lokale Stiftfunktion erhalten.
- Begriffe schlicht und verständlich (für Clanführung ohne Entwicklerwissen), keine technische Terminologie ohne Not.

## 3. Technischer Ist-Zustand: bekannte Fallstricke

- **`cloud-app.html`** enthält umfangreiche Inline-CSS-Regeln (teils wiederholte Override-Layer) sowie fast die gesamte Planungslogik in einer Inline-`<script>`-Sektion. Änderungen klein und gezielt; keine ungetestete globale CSS-Reorganisation.
- Planberechnung: `calculatePlan()`, `fairnessCandidateScore()`. Derzeit hauptsächlich **Greedy je Kriegstag**, `priority` nur nach bisherigen Einsätzen/Verfügbarkeit, `targetDays` als gedeckeltes weiches Ziel in der Kandidatenauswahl; Fix/MUSS können darüber hinausgehen. **Neues Fachkonzept ist eine echte algorithmische Änderung**.
- Mitgliedermodelle: `freshMember()`, `normalizeMember()`; `getDisplayMembers()` und `renderMembers()`; `deleteMember()`/`removeMembers()` archivieren gegebenenfalls frühere Locked-Lineup-Spieler. Stabilität von Mitglieds-IDs/Player-Tags bewahren.
- `cloud-sync.mjs`: `getRoster()` ruft Edge Function `coc-clan-members`; automatische Abgleichsversuche werden in geöffneten Clients getriggert und gedrosselt, **kein garantierter 24/7-Abgleich**. `applyRoster()` aktualisiert Status und Daten; unter anderem `cocSyncState`, `kept`.
- `cloud-sync.mjs` `installNameEditors()` hängt Bearbeitung per Delegation an `#memberList`; in Cloud-Modus für API-Spieler deaktivieren oder entsprechend verzweigen, statt bloß Stift auszublenden und offene Editwege zu lassen.
- `renderMembers()` baut die gesamte Kartenliste mit `innerHTML` erneut auf. Desktop-Ruckler aus früherem Feedback **nicht nachweislich behoben**; Profiling und DOM-Reuse als separater Punkt.
- Alte lokale Speicher-/Backup-Version ist **nicht identisch** mit Cloud-SemVer; keine unmotivierte Änderung der lokalen Datenformat-Keys. Kompatibilität zu vorhandenen JSON-Backups sowie gesperrten Lineups testen.
- Bei neuer CWL sorgfältig prüfen, welche Vorgaben CWL-spezifisch sind und ob Einsatzziele bewusst zurückgesetzt oder übernommen werden. **Nicht stillschweigend** veraltete Ziele weitertragen. Diese Lifecycle-UX vor Umsetzung anhand Code und Nutzerentscheidung klären.
- Cloud-Backup: Snapshots im **selben** Supabase-Projekt plus separater verschlüsselter GitHub-Actions-DB-Export. Git-Rollback korrigiert **keine** überschriebenen DB-Daten. Siehe `docs/BACKUP_AND_PERFORMANCE.md` und Actions `encrypted-backup.yml`/`test-encrypted-restore.yml`.

## 4. Test- und Freigabekriterien für die nächste Implementierung

**Bevor Live-Merge:**
- [ ] Code- und Datenmodelltests zu exakt N pro Spieler über **alle Tage**, 15/30er Aufstellungen und kleine Sonderfall-Slots.
- [ ] Konfliktmeldungen: unmögliche Gesamtziele, Fix/MUSS/RAUS-Widersprüche, bereits gespielte Einsätze, geänderte Regeln, zu wenige verfügbare Spieler.
- [ ] Weiche Fairnesshinweise bei 6:1, 5:2; **keine** unzulässige harte Fehlermeldung, wenn bewusst unfair aber erfüllbar.
- [ ] Gewichtung nur beeinflusst die weichen Verteilungsspielräume, niemals harte Zielzahl/gesperrte Tage.
- [ ] Austritt, Rückkehr, erneut Austritt, Pause/Fix-Restore, vorübergehende `kept`-Entscheidung, Umbenennung, zurückkehrender Player-Tag; keine Duplikate, historische Snapshots erhalten.
- [ ] API-/Netzwerkfehler, manueller Notfall-Override, nachfolgender API-Abgleich und mögliche Synchronisationskonflikte.
- [ ] Notizen: Sonderzeichen, leere Notiz, Speichern, Rollen, Cloud-Sync, Realtime, Export/Import, Backup, Austritt/Rückkehr und XSS.
- [ ] Gast-/Offline-PWA: manuelle Namens-/RH-/Mitgliederverwaltung weiterhin funktionsfähig, lokale Backups sicher.
- [ ] Echte mobile/desktop Layouts, Themes, Info-/Lösch-/Notizdialoge und zu lange Namen testen; bei Plan-Freigabe Vize-/Owner-/Viewer-Rollen prüfen.
- [ ] GitHub-Regr.-Workflow `node --test tests/*.test.cjs`, Versions-/Cache-Tests, Pages-Bereitstellung; keine echten Produktiv-Clanänderungen im Test.

## 5. Früher offene Themen / Backlog – beim nächsten Chat nicht vergessen

### UI/Design (zunächst nach Hauptfunktion, sofern nichts akut kaputt ist)
- **Gold/Arena-Theme:** unpassende Hintergrundzeichnung/Helligkeitsübergänge entfernen; konsequent ruhige Hintergründe; inkonsistente Karten-Hintergründe („ausgeschnittene“/hellere Inset-Kästen), Schrift-/Heading-Stil und Clankonto/Statistik aufräumen. Im Draft-PR #45 liegt ein möglicher Teilansatz – vor Übernahme mit v1.5.2 rebasen und nicht blind mergen.
- **Rathausbilder:** Position, Größe, Rahmen in Statistik und Mitgliedern; Mobil/PC und alle Themes prüfen; API-Assetqualität/fehlende Icons bedenken.
- **„Mehr“ / Clan & Konto / Hilfe:** statt bloßen Weiterleitungen und Scroll-to-Abschnitten **echte, intuitive Unterseiten mit Zurück-Navigation**, mobil wie native iOS-Sheets; „Mehr“ nicht als wirre Sammlung technischer Formulare. PR #45 enthält einen unvollständigen Ansatz, **Konto und Hilfe fehlten noch als echte Unterseiten**.
- **Filter und Tagesplanung:** Filter-Bereich nur echte Filter, andere Einstellungen an passende Stelle; alte „erweiterte Tagesfunktionen“ unpassend/teils defekt; Raus/Rein bei einzelnen Tagen sichtbarer/weiter oben; Day-Status/Bar und Tagesnavigation erneut im realen Mobile testen.
- **Desktop-Flächennutzung und Mitglieder-Scrollen:** reale Performance messen (`renderMembers()`), danach DOM-/CSS-Optimierung; keine reine Verdachtsfixes.
- **Themes und Copy:** Cyberpunk-CWL-OPS-Zusatzschriftzug (in #45 nur vorbereitet, `main` prüfen), Gold-Kontraste, Back-Header, iOS-Light-Varianten, Dialoge und Textgrößen; Formulierungen für Drittbenutzer ohne Entwicklungswissen verständlich, nicht „KI zusammengewürfelt“.
- **PWA-Refresh:** lokale installierte iOS-PWA und Safari-Cache/update-button auf Echthardware testen; keine Offline-PWA-Daten verlieren. Cloud-SW hat bereits no-store-Regeln für Cloud-Module.

### Cloud/CWL/Stats/Sicherheit – validieren, nicht ohne Codeprüfung als offen behaupten
- Live-E2E mit **mehreren echten Geräten/Rollen**: Auth, Clanwechsel, Cloud-Realtime, Planfreigabe, Vize-Vorschläge, Viewer-Rechte, Clans `United Fighters` / `UF 2`.
- Tatsächliche CWL-Runden, Gegner, verifizierte API-Lineups und automatische Abschlüsse **in einer echten laufenden CWL** prüfen. Bisherige verifizierte Implementierung ist defensiv, Aktualisierung hängt am aktiven Client; kein garantierter serverseitiger 24/7-Importer. Bei unbekanntem War-Tag `#0` keine Ergebnisse/Gegner erfinden.
- Statistik: **letzte bis zu 7 tatsächlich ausgeführte Angriffe** für 3★-Rate und Sterneschnitt, nicht „letzte 7 Tage“. Fehlangriffe nur bei belegter Abdeckung. Fenster zuletzt 50 normale CWs plus letzte 3 CWL-Saisons; Quellen-/Stichprobentransparenz und historische Grenzen kommunizieren. Frühere UI-Wünsche zu klaren Filtern, Einzelangriffsdetails/War-Historie und Beschriftungen gegen v1.5.2 abgleichen.
- Clanrollen, Einladungen, unterschiedliche Konten, aktive Bearbeiter, Konfliktlösung, Backup-Sicherungspunkte/Restore und UX-Hilfetexte prüfen; Supabase-Option zum Schutz vor kompromittierten Passwörtern historisch als offener Security-Check notiert – aktuellen Status prüfen.
- Frühere Fairness-/Archive-Caveats aus Oktober (niedrige Spieler-Verfügbarkeit, gespeicherte Fix-Regeln, 0-Einsätze im Archiv, veränderte Historie) mit aktuellen Tests abgleichen; nicht einfach als weiterhin bestehende Bugs darstellen.
- **Optionaler experimenteller, gegner- und angriffsstärkeorientierter Solver** separat aus Issue #44: standardmäßig **aus**, nur Vorschau, niemals ohne Bestätigung überschreiben. Kein Bestandteil der jetzt vereinbarten Rotationsgewichtung.
- **Cleanup** nach Issue #46: `cloud-pilot.html`, `cwl-demo.html` und Demo-Daten, veraltete Branches/Previews, Docs/Links/Cloud-Altlasten prüfen; **nur nach Dependency-/Backups-Prüfung löschen**. Lokales `index.html`, Service Worker, produktive Clans, Benutzer, Backups, API-Statistiken niemals unbedacht löschen.

## 6. Prioritäten / sinnvoller Ablauf

**P1 – Korrektheit:** Datenmodell, exaktes Ziel, globale konsistente Planung, fairer Verteilungsspielraum und eindeutige Konfliktdiagnose. Zuerst gezielte Unit-/Regressionsfälle im Feature-Branch. Wenn großer Eingriff, in mehrere überprüfbare PRs/Patches statt einen riskanten Komplettrelease.

**P2 – Mitgliederdaten:** Austritts-/Wiedereintritts-Status sicher bewahren; Notizen inklusive Auth/Cloud-Sync und Backups; getrennte API-/Gast-/Notfall-Bearbeitungsrechte.

**P3 – Oberfläche:** Minimaler Cloud-Mitgliederdialog mit sauber angeordnetem Einsatzziel, Gewichtung, Regeln, Notiz rechts oben; richtige „manuell“-Controls für Gast/Offline/Fallback. Danach tatsächlicher iPhone-/Desktop-Check.

**P4 – offener UI-Backlog:** Gold/Arena, Mehr-Unterseiten, Statistik-/RH-Polish, Desktop-Performance, Text-/UX-Audit; PR #45 nur selektiv verwerten.

**P5 – Wartung:** Code-/Daten-/GitHub-/Supabase-Cleanup #46 mit gesichertem Inventar; separate experimentelle Planung #44 bleibt abgekoppelt.

## 7. Übergreifende Produktregeln / Kommunikationsstil

- **Fokus Cloud**, dennoch lokaler/Offline-Modus funktional erhalten. Einfache, gut verständliche deutsche UI und konsistente Gestaltung.
- **Keine unnötigen Extras, keine kostenpflichtige Test-Infrastruktur**, keine zweite Staging-Supabase nur für einen UI-Patch. Kleine Live-Patches mit grünem Test und nachvollziehbarem PR/Changelog.
- Löschen und Datenmigration nur nach Sicherung/Verifikation und explizitem sinnvollen Nutzerworkflow. Nicht automatisch ausgetretene Spieler bei CWL-Neustart bereinigen.
- Bei Widersprüchen zwischen diesem Dokument und **neuen** Nutzeranweisungen gilt die neuere Anweisung. Alte Bugs/Versionen stets neu gegen aktuelles `main` validieren.

---
**Übergabe angelegt am 03.11.2026.** Dieses Dokument und Issue #49 im neuen Chat als Einstieg verwenden; keine v1.5.3-Funktion wurde durch diese Dokumentation bereits implementiert.
