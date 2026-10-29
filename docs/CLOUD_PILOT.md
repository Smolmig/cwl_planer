# Cloud-Labor (Alpha) – United Fighters

**Stand:** Supabase-Projekt "Smolmig's Project" (`yjldnvfwposfwmzmcsow`) mit Tabellen und RLS aktiv. Testoberfläche `cloud-pilot.html` ist **getrennt** von der regulären lokalen `index.html`. Das Schema wurde in Supabase schon angewendet und in Git unter `supabase/migrations/` versioniert. Diese Migrationen nicht ein zweites Mal auf demselben Projekt ausführen.

## Umgesetzte Bausteine

- Supabase Auth: Email/Passwort für Besitzer/Vize/Beobachter.
- `cwl_clans`: getrennte Clanbereiche. Beim Erstellen wird der angemeldete Benutzer automatisch Besitzer.
- `cwl_clan_memberships`: Rollen `owner`, `editor`, `viewer`, mit RLS.
- `cwl_clan_invites`: einmalige, zeitlich begrenzte UUID-Einladungen. Einlösen über authentifizierte RPC, ohne Admin-Key im Browser.
- `cwl_cloud_profiles`: ein vollständiger Datenformat-v9-Profilsnapshot pro Clan, inkl. Mitglieder, Regeln, tatsächliche Line-ups und Archive. Revisionsnummer gegen gleichzeitiges Überschreiben; Realtime informiert über Änderungen.
- Import per **bewusst gewählter lokaler JSON-Backup-Datei**, ausdrücklich nicht automatisch und ohne Änderungen an lokalem `localStorage`. Export des Cloud-Profils möglich.
- Die bisherige kostenlose CoC-API-Testfunktion bleibt unabhängig; ihr Schlüssel wird **niemals** vom Cloud-Labor ausgelesen.

## Benötigte Einstellung für Login

1. Supabase Dashboard → Authentication → URL Configuration öffnen.
2. **Site URL** und/oder **Redirect URLs** für das spätere Preview mit `https://smolmig.github.io/cwl_planer/cloud-pilot.html` freigeben.
3. Unter Authentication → Providers prüfen, dass **Email** aktiviert ist; ggf. E-Mail-Bestätigung und Versandlimits beachten.
4. Nach Veröffentlichung der getrennten Testseite anmelden oder registrieren. Passwort mindestens 8 Zeichen.

**Wichtig:** Der Inhalt dieser Preview-Datei enthält nur den dafür vorgesehenen **publishable** API-Key. Supabase Secret Keys und Supercell Keys bleiben privat.

## Erster Test (nach Freigabe/Veröffentlichung der Preview)

1. Als Besitzer im Cloud-Labor anmelden und Clan "United Fighters" mit Clan-Tag `#99JP2RL2` erstellen.
2. Ein bestehendes **JSON-Backup** im normalen lokalen CWL-Planer anlegen.
3. In der Preview die Datei auswählen und die Mitgliedszahl/Archive kontrollieren; erst dann **explizit** in die Cloud hochladen.
4. Cloud-Stand laden und testweise wieder als JSON exportieren; Dateiinhalte vergleichen.
5. Einmalige Einladung für einen Vize erstellen; Person erstellt eigenen Account und löst die Einladung ein.
6. Prüfen, ob der Vize dasselbe Profil sieht und Änderungen Realtime-Warnungen auslösen.
7. Als Beobachter testen, dass kein Cloud-Upload möglich ist. Konkurrierende Revisionen müssen mit Konflikt abbrechen.

## Sicherheit und bekannte Grenzen

- Nur authentifizierte Clanmitglieder dürfen ihren Clan und das Profil lesen; Bearbeitung erfordert Besitzer-/Bearbeiterrolle. Jeder öffentliche Tabelle ist RLS zugewiesen.
- Besitzer dürfen Mitglieder nicht selbstständig zu Besitzern machen; die Ursprungs-Besitzerzuordnung ist geschützt.
- Cloud-Labor ist **noch kein fertiger gemeinsamer CWL-Planer**. Die reguläre `index.html` bleibt offline und lokal, und die Cloud-Testoberfläche dient nur Anmeldung/Import/Export und Rechte-Tests. Die bestehende Planung wird erst nach den Praxistests angebunden.
- Ein Profil wird als Gesamtdokument übertragen. Optimistic Locking verhindert stille parallele Überschreibungen; eine spätere feinere Synchronisierung einzelner Spieler/Tage bleibt möglich.
- Die 5-MB-Grenze gilt für ein einzelnes Cloud-Profil. Die App-Version ist v1.0.0, das Profile-Datenformat bleibt 9.
- Ein von Benutzern gewählter Clanname ist kein Eigentumsnachweis über einen echten Clash-Clan. Für eine öffentliche Variante später Clanbesitz-Verifizierung und Missbrauchsschutz ergänzen.
- Das Login-Frontend benötigt Internet. Die normale lokale App funktioniert weiterhin offline.

## Versionierung

Die Preview ist ein **unveröffentlichtes Alpha-Feature** (geplant als Minor-Release v1.1.0, bei Bedarf `v1.1.0-alpha.1`). Keine Änderung der veröffentlichten `APP_VERSION` oder des bisherigen PWA-Cache.
