# Kostenloser Clash-of-Clans-API-Test (intern)

**Status:** vorbereiteter Proof of Concept. Kein produktiver Mitgliederimport, keine Änderung der PWA, Profile oder CWL-Archive.

## Quellen und Architektur

- [RoyaleAPI-Proxy](https://docs.royaleapi.com/proxy) unterstützt Clash of Clans über `https://cocproxy.royaleapi.dev` mit freigegebener IP `45.79.218.79`.
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions/quickstart-dashboard) führen die Anfrage serverseitig aus.
- [Supabase Auth-Optionen](https://supabase.com/docs/guides/functions/auth) und [Secrets](https://supabase.com/docs/guides/functions/secrets) verhindern, dass der Supercell-Key in GitHub Pages erscheint.

## Einrichtung

### 1. Key im Supercell Developer Portal

Auf https://developer.clashofclans.com/ einen **eigenen Test-Key** (z. B. "CWL Planer Proxy Test") mit **nur** der freigegebenen IPv4 `45.79.218.79` erstellen. Den Key niemals hier im Chat, auf GitHub oder in der öffentlich zugänglichen Web-App einfügen. Der RoyaleAPI-Proxy ist ein Drittanbieter, über den der Key technisch übertragen wird.

### 2. Secrets in Supabase

Im vorhandenen Supabase-Projekt unter **Edge Functions > Secrets** speichern:

| Name | Wert |
| --- | --- |
| `COC_API_KEY` | Dein vollständiger Supercell-API-Key (ohne `Bearer `) |
| `COC_CLAN_TAG` | Euer Clan-Tag, z. B. `#ABC123` als Platzhalter |

### 3. Function deployen

**Über das Dashboard (einfach):**

1. **Edge Functions > Deploy a new function > Via Editor**.
2. Name: `coc-members-test`.
3. Den vollständigen Code aus [index.ts](../supabase/functions/coc-members-test/index.ts) in den Editor kopieren und deployen.
4. In den Einstellungen der Funktion **Verify JWT ausschalten**. Die Funktion authentifiziert weiterhin selbst: `withSupabase({auth: "secret"})`. **Nicht** auf `auth: "none"` ändern.

**Alternativ mit Supabase CLI:**

```bash
supabase login
supabase link --project-ref DEIN_PROJECT_REF
supabase functions deploy coc-members-test
```

In [config.toml](../supabase/config.toml) ist `verify_jwt = false` für diese Testfunktion gesetzt. Das macht sie **nicht** anonym erreichbar, weil sie einen gültigen Supabase Secret-Key im `apikey`-Header fordert.

### 4. Manuell im Dashboard testen

1. **Edge Functions > coc-members-test > Test**.
2. Methode **POST**, Body `{}`.
3. Header **`apikey`** = **Supabase Secret API Key** (`sb_secret_...`, unter **Settings > API Keys**). Nicht den Publishable-/Anon-Key verwenden. Das Secret nur innerhalb deines Supabase-Projekts benutzen und niemals in die PWA oder in GitHub übernehmen.
4. Test senden und Status-/Antwortdaten prüfen.

Beispiel einer erfolgreichen Antwortstruktur (nur erfundene Testdaten):

```json
{
  "ok": true,
  "clanTag": "#ABC123",
  "memberCount": 1,
  "members": [
    { "tag": "#PLAYER", "name": "Testspieler", "townHallLevel": 18, "role": "coLeader" }
  ]
}
```

## Fehlerdiagnose

| Ergebnis | Bedeutung |
| --- | --- |
| 401 / 403 von Supabase | Secret-`apikey` oder Auth-Einstellung prüfen |
| 503 missing_server_configuration | Supabase-Secrets fehlen |
| 502 supercell_request_failed, upstreamStatus 403 | Supercell-Key, Proxy-IP-Freigabe oder Proxyzugriff falsch |
| 502 … upstreamStatus 404 | Clan-Tag oder Endpoint nicht gefunden |
| 502 … upstreamStatus 429 | Rate-Limit |
| 502 upstream_timeout / upstream_unreachable | Proxy oder Supercell nicht erreichbar |

## Sicherheit und nächste Schritte

- Keine beliebigen Clan-Tags oder Ziel-URLs vom Aufrufer; nur dein fest hinterlegter Clan.
- API-Key wird nie in der Antwort, im Frontend oder im Repository gespeichert. Auch der **Supabase Secret-Key** darf nie an Vize-Anführer verteilt werden.
- Im Produktivbetrieb wird **nicht** mit Secret-Key aus dem Browser gearbeitet: Supabase Auth für Benutzer, Clanrollenprüfung, RLS, Rate-Limit, Cache und ein bestätigter Import-Dialog müssen zuvor umgesetzt werden.
- Der Test importiert oder überschreibt **keine** Profile. Gespielte Tages-Snapshots, Archive, FIX/MUSS/RAUS und Prioritäten bleiben unverändert.
- Der Drittanbieter kann API-Key und API-Anfragen technisch einsehen. Separaten Test-Key verwenden und bei Problemen widerrufen.

Nach erfolgreichem API-Test folgt der separate Cloud-Ausbau für gemeinsame Clanprofile; erst danach wird der API-Import in der Benutzeroberfläche freigeschaltet.
