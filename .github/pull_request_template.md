## Ziel / Umfang

Kurze Beschreibung und zugehörige Issues/PRs:

## Pflichtcheck vor Merge

- [ ] **Hilfe-Seite geprüft**: neue/geänderte Funktionen, Bezeichnungen, Statistiken, Rollen, Dialoge und Fehlerfälle mit allen betroffenen Hilfeabschnitten abgeglichen. Hilfetexte in diesem PR aktualisiert **oder** bewusst als unverändert geprüft. Cloud und separate Offline-PWA nach Bedarf unterschieden (#46).
- [ ] **Sprache geprüft**: deutsche Texte sind klar, konsistent und verständlich. Sobald Englisch implementiert ist (#177): dieselben UI-/Hilfetexte, Tooltips, Accessibility-Labels, Fehler- und Datums-/Zahlenformate in **DE und EN** aktualisiert und getestet. Deutsch bleibt Default.
- [ ] **Theme/Responsive geprüft**: Gold, Dark/Light (und vorhandene weitere Themes) sowie 320/390/430 px und Desktop geprüft, soweit UI betroffen. Bevorstehender Gold-Default (#46) darf bestehende bewusste Nutzerpräferenzen nicht überschreiben.
- [ ] **Daten- und Sicherheitsgrenzen geprüft**: bestehende Plan-/Statistikdaten, Rollen/RLS, Cloud vs. Offline und fremde Clanprofile nicht ungewollt verändert. Bei Import/Export (#176) Idempotenz, Provenienz, Backups und Konfliktvorschau berücksichtigt, soweit betroffen.
- [ ] **Regressionen dokumentiert**: relevante automatisierte Checks und/oder manuelle Browserprüfung; tatsächliche Safari-/Android-Praxisabnahme nicht ohne echten Test behaupten.
- [ ] **Projektübergabe/Backlog aktualisiert**, wenn neue Entscheidungen, noch offene Nacharbeiten, APIs, Migrationen oder Nutzeranforderungen entstehen (#121, docs/NEXT_CHAT_HANDOFF.md).

Weitere verbindliche UX-Regeln: [docs/UX_DESIGN_PRINCIPLES.md](../docs/UX_DESIGN_PRINCIPLES.md).

## Tests / Release-Status

- Durchgeführte Tests:
- Nicht getestete Punkte / bekannte Risiken:
- Pages-/Live-/Release-Status (nur bestätigen, wenn tatsächlich geprüft):
