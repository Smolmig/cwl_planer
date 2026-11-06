# Cloud-Rollen, Planfreigabe und Vorschläge – UX-Vertrag (06.11.2026)

Ergänzung zu [UX_DESIGN_PRINCIPLES.md](UX_DESIGN_PRINCIPLES.md). Gilt für Cloud-App; die lokale Offline-PWA kennt keine Cloud-Rollen.

## Leitgedanke

**Rolle, Planstatus und Wirkung der nächsten Aktion sollen direkt am Ort der Handlung erkennbar sein.** Keine unnötige ganze Karte „Freigabe“ zwischen Übersicht und Kriegstagen; kein versteckter Vorschlag-Workflow nur unter Plan, wenn die Änderung bei Mitgliedern erfolgt.

| Rolle | Plan offen | Plan freigegeben | Mitglieder |
|---|---|---|---|
| Besitzer | Direkt bearbeiten, freigeben | Weiterhin direkt bearbeiten; Vorschläge prüfen/übernehmen/ablehnen, wieder öffnen | Verwalten; Status und Freigabe-Einstieg |
| Vize (editor) | Direkt bearbeiten; Änderungen in der Cloud | Nur lokal sichtbarer **Entwurf**, der explizit **eingereicht** wird; bis zur Annahme nicht im gemeinsamen Profil | Vorschlag direkt hier einreichen, Hinweis „noch nicht eingereicht“ |
| Beobachter (viewer) | Nur lesen | Nur lesen, **keine** Vorschlagsoberfläche | Lesbare Teilnahme/Fix, Rotation, Einsatzziele, Tagesregeln, Notizen; suchen, sortieren und Details öffnen |

- Jede Mutation an der Cloud bleibt serverseitig durch Mitgliedschaft, RLS und Freigabe-Logik geschützt. UI-Ausblenden ist keine Sicherheitsgrenze.
- Gespielte Lineups, Tagesfreigaben und geschützte Stammdaten dürfen durch einen Vorschlag nicht still ersetzt werden; wie bisher Backend-Revision und Solver-Prüfung einhalten.
- Vize darf **nicht** durch ein „gespeichert“-Toast glauben, ein nicht eingereichter Entwurf sei schon übernommen.
- Vorschläge zeigen wer, wann und was sich verändert hat; bei Clanführer offene Anfragen im Plan mit **konkreter Zahl** sichtbar markieren; bestehende Zusammenfassung und Entscheidung im aufklappbaren Detail.
- **Kompakte Statuszeile** ist der Standard im Plan. Details bleiben geschlossen, bis eine Nutzeraktion sie öffnet; Auto-Refresh öffnet/schließt nicht eigenmächtig.
- Es gibt eine primäre Verwaltung im Plan; bei Mitglieder einen kontextuellen Weg zu dieser Ansicht und bei gesperrtem Vize einen direkten Einreichen-Knopf.
- Beobachter nicht wie „kaputtes Formular“ grau darstellen. Editierflächen vollständig entfernen/ausblenden, aber die fachlichen Daten normal lesbar halten.
- Keine künstliche Notification-Animation bei jedem 15-Sekunden-Sync. Nur tatsächlich offene Anfragen werden hervorgehoben; keine Behauptung, etwas sei „ungelesen“, wenn kein Lesestatus erfasst wird.
- Warnung/Fehlermeldung nur bei konkreter nicht ausführbarer Aktion, nicht als dauerndes Modal. Das entspricht dem üblichen Prinzip progressiver Offenlegung aus Apple HIG.
- Wenn später eine globale Inbox entsteht: Ausstehende Vorschläge als genau eine Quelle verwenden; keine zweite, widersprüchliche Statusberechnung.

## Bei jedem Cloud-UX-Patch testen

1. Rollenwechsel (owner/editor/viewer), auch während eine Mitgliederkarte geöffnet ist.
2. Offen → Freigegeben → Offen, inklusive Vize-Entwurf und bestehender Vorschläge.
3. Owner-Entscheidung mit Anzeige der tatsächlichen einzelnen Änderungen.
4. Realtime/Intervallabgleich erhält offene Details, Suchtext, Fokus und Scrollposition.
5. iOS Safari/PWA, Android PWA, Desktop und Gold-/Dark-/Light-Theme.
6. Viewer kann über UI oder Cloud-RPC weder schreiben noch Freigaben/Vorschläge ausführen.
