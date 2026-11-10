# Automatic CW/CWL statistics collector

## Scope

Collects official, currently accessible Clash war data for **every** linked Clash clan
in `public.cwl_clans` without a browser or user session. A single Clash tag may appear
in multiple **independently permissioned** app clans. A fetched public game snapshot
is written separately under each corresponding `clan_id`; no existing private
`cwl_stat_*` rows are copied between tenants.

## Trigger and authentication

- GitHub Actions `.github/workflows/collect-war-stats.yml` requests two
  starts per hour at **UTC minutes 17 and 47** (`17,47 * * * *`) and supports
  a protected manual dispatch. GitHub may delay or skip scheduled events:
  these are two best-effort opportunities, **not** a guaranteed 30-minute cadence.
- The job requests a **short-lived GitHub OIDC token** scoped to the audience
  `cwl-stats-collector:yjldnvfwposfwmzmcsow`.
- The Supabase Edge Function verifies the JWT **RS256 signature** against
  GitHub's public JWKS and additionally checks the exact issuer, audience,
  repository name and immutable ID, `refs/heads/main`, exact workflow path,
  `sub`, allowed event name and expiry. An unverifiable request is denied
  before accessing privileged server variables or database rows.
- The Edge Function has `verify_jwt=false` only because Supabase's built-in
  user-JWT check cannot validate GitHub's OIDC JWT. It is **not anonymous**:
  internal verification is mandatory. No long-lived GitHub secret, service-role
  key or Clash token is sent to the browser or stored in the repository.
- On first promotion to main, the scheduler runs once from the signed `push`
  workflow event. Additional scheduled runs follow automatically.

## Independent Supabase scheduler (rollout for #104)

GitHub's requested `:17/:47` runs are best-effort and remained absent for
over two hours after the 10.11.2026 collector baseline despite a successful
signed push invocation. **A second independent schedule is therefore needed.**

The independent scheduler consists of two deliberately ordered migrations:

1. `20261110160000_cwl_collector_cron_hmac.sql`: generates a random 256-bit
   signing key **inside Vault**, exposes only a Boolean
   `cwl_verify_collector_cron_request` RPC to `service_role` (SECURITY
   INVOKER; end-user roles explicitly revoked). The original GitHub OIDC
   signature/identity checks remain unchanged. The Edge function accepts
   only a separate, strictly shaped HMAC signature made from a UTC timestamp
   and a fixed context. A request older than 90 s or more than 15 s ahead,
   malformed, or mixing OIDC and Cron headers is rejected before collection.
2. `20261110160500_cwl_collector_cron_activate.sql`: enables Supabase
   `pg_cron` + `pg_net` and registers `5,35 * * * *` **UTC**. The SQL job
   reads Vault on the server and signs the request; no long-lived credential
   appears in the code, cron definition, app bundle or GitHub workflow.
   The HTTP request is sent over HTTPS and existing collector validation,
   tenant boundaries, deduplication and historical-unknown rules apply.

**Safe promotion order:** green complete regression/authorization checks;
deploy first migration; verify service-only RPC and nonpublic Vault secret;
deploy complete Edge function with `verify_jwt=false` (custom identity checks
remain mandatory); verify invalid Cron requests return HTTP 401 and existing
signed GitHub-OIDC canary still works; **only then** activate the second
migration. Confirm a new `collector_verified_trigger=internal_cron` audit,
HTTP 200, `tenantProfiles=tenureObservedProfiles`, and a second *valid* real
roster snapshot in the database. GitHub `event=schedule` stays enabled as a
second independent option and must not be confused with internal Cron.

**Emergency rollback:** `SELECT cron.unschedule('cwl-clan-collector-independent');`
stops internal Cron without touching the GitHub OIDC workflow, the Vault
secret, player records, archived wars or Cloud profiles. Preserve database
migrations and audit history for investigation; never revoke the existing
GitHub identity or mark missing observations as credited membership time.
`pg_net` is asynchronous; monitor job/run status and Edge response logs,
not merely a successful invocation of `cron.schedule`. The read-only
`scripts/collector-tenure-health.sql` remains the source of evidence.

## Data and reliability

1. Poll the current normal war and active/ended CWL league group; resolve only
   the app-linked clan's own war tags. Other pairing data are not persisted.
2. Validate tag/roster/team-size, both timestamps, attackers, defenders,
   star counts and destruction percentages before writes.
3. An `inWar` snapshot may be staged under `source=api, finalized=false`.
   Such snapshots are **excluded** by `selectStatWars()`; they are not a
   claim that the war finished. An ended war is finalized only after all
   observed attacks have been stored successfully.
4. Reuse the current app's `normal:<startTime>:<opponentTag>` and
   `cwl:<warTag>` keys, and the 1-based **per-member** attack number. Existing
   unique DB keys make re-polling idempotent. Do not downgrade a finalized war
   when an earlier in-war response reappears.
5. A failed Clash source does not wipe successfully obtained game snapshots;
   failure is recorded in the tenant-scoped collector health table.
6. Requests, batches and runtime are bounded. When there are more than five
   distinct linked game clan tags, successive scheduled runs rotate through
   the batches. Allow several scheduled intervals for all tenants in that case.
7. The app's statistics view displays the last successful server check or
   a recoverable error, visible only when logged into that Cloud clan.

## Confirmed missed attacks (CWL only)

- A completed CWL round is marked `missed_log_complete=true` **only**
  if the official API provides the full valid own/opponent rosters, the war
  is `warEnded` with a settled end time, and the official **own-clan total
  attack count** exactly equals the sum of validated member attacks.
- Since CWL has **one attack per registered war player**, members without
  recorded attacks are then reliable per-war misses (count 1). Save those
  private, tenant-scoped `cwl_stat_missed` rows **before** setting the war
  to `finalized=true`. If any write fails, keep the war staged and retry.
- If the attack counter is absent or contradicts the member rows, the
  collector may retain confirmed attack data but must leave
  `missed_log_complete=false`: **unknown is not zero**.
- This does not change normal CW missed logic, already finalized historical
  records, older imports, war lineup decisions, player participation, or the
  user's CWL planning. Old finalized CWL snapshots with an unknown Missed
  status still need a separate **evidence-based** reconciliation path; do not
  silently backfill from incomplete historical records.

## Important limitations

- The official current-war endpoint does not offer an unlimited archive of old
  attacks. If a CW has already disappeared from the upstream API before any
  poll, the collector **cannot recreate** it. Explicit authorized ClashPerk
  history imports are separate.
- API availability, private war log settings, outage windows and GitHub
  schedule delays can create gaps. The status shows last success; it does not
  guarantee perfect coverage of every missed day.
- Importing data or aggregating private statistics **between** two app clans
  remains a separate opt-in security design (Issue #103). Neither OIDC collection
  nor matching Clash tags grants cross-tenant read permissions.
- Never manually invoke the collector with `service_role` in client code.
  The GitHub workflow is its only trusted production trigger.

## Clan-time and donation health check – 10.11.2026

The read-only, aggregate-only query
[`scripts/collector-tenure-health.sql`](../scripts/collector-tenure-health.sql)
reports the count of app-clan member rows, second observations, confirmed
membership seconds, observed donation increases and current per-profile
collector health. The query returns no clan/player IDs, names or tags and
cannot change production data. Its companion regression test rejects
accidental writes and identifying output.

**Observed at 14:44 UTC:** 94 member rows in 3 app clans, all currently
present; baseline 13:23:43–48 UTC; **0 second observations**, **0 members with
confirmed positive clan time**, **0 observed donation increases**.
All 3 collector status profiles reported success without stored errors.
That is a sound baseline, **not** confirmed long-term collection.
The latest available GitHub Actions list contained only the signed
`push` collector run at 13:23 UTC after PR #207, and no newer
`event=schedule` run. GitHub's pre-change 04:42 schedule run is **not**
post-change proof. A missing run is not evidence of a failed Edge/API call.

**Next acceptance gate:** inspect the GitHub Actions event field for a
*new* `schedule` run, correlate its verified Edge trigger and HTTP response,
and rerun the SQL to confirm a second complete roster observation. If the
two start chances continue to be skipped for multiple hours, evaluate a
separately authenticated independent scheduler before assuming hourly
tracking is reliable. Never grant unobserved gaps as clan-time credit,
infer offline status, or backfill donation deltas.

## Read-only follow-up – 10.11.2026

**10.11.2026 – P0 Collector #104 (nur Leseprüfung):** Bereits am 07.11. waren wiederholte `schedule`-Läufe belegt; neu geprüft wurden 13 erfolgreiche GitHub-Schedule-Runs seitdem. Drei aktuelle unabhängige Läufe (09.11. 11:55 UTC, 09.11. 22:36 UTC, 10.11. 04:42 UTC) sind jeweils mit Supabase `collector_verified_trigger=schedule`, Edge-HTTP-200 und nachfolgenden DB-Erfolgszeiten korreliert. [Runs 42612779637](https://github.com/Smolmig/cwl_planer/actions/runs/42612779637), [42713333281](https://github.com/Smolmig/cwl_planer/actions/runs/42713333281), [42757593952](https://github.com/Smolmig/cwl_planer/actions/runs/42757593952). Letzter Status 10.11. 04:43 UTC: 3/3 Clanprofile erfolgreich, 0 gespeicherte Fehler, 3 beobachtete Kriege, 12 Angriffe und 0 neu finalisierte Kriege. **Neue Datenlücke:** November-API-CWL hat 21 App-Clan-Kriegsdatensätze (14 eindeutige Clash-War-Keys), 18 als abgeschlossen markiert; nur 6 davon mit vollständigem Missed-Nachweis, bei **12 ist Missed-Abdeckung weiterhin UNBEKANNT**, 3 laufen/vorläufig. Das sind **keine 12 nachgewiesenen versäumten Angriffe**. Neu: `scripts/collector-monthly-coverage.sql` samt No-Write-/Privacy-Test, live nur mit SELECT verifiziert. GitHub-Stunden-Cron bleibt best effort und hat tatsächliche Mehrstundenlücken. **Nächster P0-Gate:** fehlende amtliche finale Clanangriffszähler/ursprüngliche API-Roster nur über den gesicherten Quell-/Staging-Prozess prüfen; keine heimliche Rekonstruktion, keine SQL-/DB-/Solver-/Edge-/Cloud-App-Mutation. Hilfe für das unveränderte Feature geprüft, daher kein neuer App-Release.

**Repeatable, tenant-safe SQL:** [monthly coverage](../scripts/collector-monthly-coverage.sql) and [static safety regression](../tests/collector-monthly-coverage-sql.test.cjs). The query groups by month and source, shows app-clan war-record counts separately from distinct public Clash war keys, and includes only aggregated collector-health status. It never returns player tags, identities, tenant IDs or war keys. It cannot validate the historical official `clan.attacks` counter; the latter is **not** present in the stored war table. All 12 unresolved finalized November records remain unknown and must not be marked zero or complete. The earlier 07.11 schedule evidence below is retained for provenance.

## Verified schedule and Missed-coverage audit – 07.11.2026

**Read-only production check at the end of 07.11.2026 (UTC).**
The hourly workflow is **best-effort**, but repeated autonomous triggers are
independently confirmed on GitHub: [07:28 run 42351395780](https://github.com/Smolmig/cwl_planer/actions/runs/42351395780),
[14:58 run 42384101005](https://github.com/Smolmig/cwl_planer/actions/runs/42384101005), and
[19:31 run 42406623454](https://github.com/Smolmig/cwl_planer/actions/runs/42406623454)
all show `event=schedule` and successful completion. Supabase
`coc-stats-collector` **Edge v5** was active during the later check, and the
three app-clan collector-status rows had latest successful timestamps around
**19:31:41–19:31:50 UTC**, **zero stored errors** and **45 observed attacks**
summed across app-clan profiles in the latest poll. This proves several live
checks, **not** a guarantee that every future hourly run will fire.

A read-only query on `cwl_stat_wars`, `cwl_stat_attacks` and
`cwl_stat_missed` found **33 stored CWL app-clan war records**, including
**31 finalized** and **2 provisional**; of the finalized records,
**21 historical/imported records** were marked Missed-complete, while **10
API-derived finalized app-clan records** were not. The ten unresolved records
represent **seven distinct Clash war keys** because a real Clash war may be
stored independently under more than one app-clan ID. This distinction is
crucial for honest monitoring and must **not** be deduplicated across tenant
boundaries when presenting individual clan statistics.

| Stored attacks on 15-person roster | Unresolved app-clan records | Distinct Clash war keys | Meaning |
| --- | ---: | ---: | --- |
| 15/15, 15 distinct rostered attackers | 6 | 5 | Every roster slot has a documented attack; original official clan-wide attack counter was not persisted, so `missed_log_complete=false` remains unchanged |
| 14/15 | 2 | 1 | One slot lacks a stored attack; could be a real missed attack or incomplete capture |
| 13/15 | 2 | 1 | Two slots lack stored attacks; no evidence of exact missed count |

The reproducible audit is
[`scripts/collector-cwl-missed-coverage.sql`](../scripts/collector-cwl-missed-coverage.sql).
It returns **only aggregated counts**, includes the full `(clan_id,war_key)`
join key and counts distinct Clash keys separately. It cannot see the
original official `clan.attacks` field because that field is **not stored**
in historical tables, so even its 15/15 group is **not automatic proof** of
the API counter or permission to flip `missed_log_complete`. The query
contains no modifications, joins no external tenants' private data, and
never emits player tags, names or account IDs. The static SQL safety contract
is checked in `tests/collector-cwl-missed-coverage-sql.test.cjs`.

**Remaining P0 decisions:** To reconcile earlier final records, require a
separate, explicitly reviewed, idempotent workflow that retrieves the
original final upstream war snapshot (if still accessible), verifies both
rosters, unique attacker tags and the official clan-wide attack counter,
and applies write-order/tenant isolation checks **before** any updates.
If that authoritative evidence is no longer obtainable, preserve the
unknown status permanently until a source-backed import becomes available.
Do **not** backfill from the number of missing local attack rows; do not
alter the existing production Collector v5 or stored data as part of this audit.

## Historical CWL Missed reconciliation: verified dry-run only

The repository includes
[`collector-reconciliation.mjs`](../supabase/functions/coc-stats-collector/collector-reconciliation.mjs)
with the pure helper `previewHistoricalCwlMisses` and the corresponding
[`collector-historical-cwl-missed-preview.test.cjs`](../tests/collector-historical-cwl-missed-preview.test.cjs).
**This helper is deliberately NOT imported by the deployed Edge Function,
not callable by the browser and not connected to a scheduled write operation.**
It is a safety building block only, and no historical data are changed.

### Required, independent evidence

Before calling this in any future reviewed server-only workflow, obtain:

1. The **authorized linked app-clan record** (`id`, `clash_tag`) and one
   matching `cwl_stat_wars` record (`clan_id=id`) already finalized from
   `source=api` with `war_type=cwl`, but with
   `missed_log_complete=false`.
2. **All** saved `cwl_stat_attacks` and **all** saved `cwl_stat_missed`
   for **that same** `(clan_id,war_key)`. Mixed tenants, duplicate attacks
   or existing missed rows disqualify the proposal.
3. A **fresh server-side, authenticated official Clash API** response from
   `/clanwarleagues/wars/{warTag}`, with the independently fetched
   `warTag` explicitly supplied. The trusted endpoint's war tag must
   match the database key; **deriving the fetched war tag only from the
   saved key is not independent proof**. Never accept a user's uploaded or
   browser-provided JSON as the official source.

The pure helper uses the existing verified `buildWarSnapshot` logic:
settled `warEnded`, complete own and opponent rosters, unique player tags,
valid individual attacks and a numeric official `clan.attacks` counter
exactly matching the parsed own-clan attack rows. It additionally demands
**exact agreement** between saved and official war metadata, roster membership,
attack identities, defender tags, stars, destruction and available town halls.
It refuses to infer even a single missed attack from absent saved attack
rows if the official snapshot is missing or contradictory.

Eligible proposals return `confirmedMissedCount` and private `missedRows`
for internal comparison only. Rejections return a safe reason code,
`confirmedMissedCount=null` and no rows. **The preview cannot write**:
no database/client call, credentials, API request or logger exists in this
module. Never log or return the private proposal to a client, even if
eligible.

### Deliberately still missing: transactionally safe writer

An eventual writer needs an explicitly reviewed server-side authorization
path, independent official API fetch, complete tenant-scoped reads, and an
**atomic optimistic conflict guard** covering `finalized`,
`missed_log_complete`, original attack rows and already-present missed
rows. Persist confirmed `cwl_stat_missed` records first, then mark
`missed_log_complete=true`; on any failure preserve UNKNOWN and retry
idempotently. Do not auto-run this on new collector scans or change the live
scheduler. If the original war is no longer available through the trusted
API, the historical record remains **UNKNOWN** without guessing.

## Atomic historical-CWL Missed writer – non-deployed design candidate

This is **NOT a production migration or active correction**. The file
[`scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql`](../scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql)
is intentionally under `scripts/`, not `supabase/migrations/`; nobody should
paste/execute it against the live Supabase project at this stage.
Neither `index.ts` nor GitHub Actions imports/calls it, and **zero historical
war/missed rows are modified**.

The tested pure function `prepareHistoricalCwlMissedRpc(input)` extends the
previous `previewHistoricalCwlMisses(input)` evidence check. **It returns
`p_apply:false` every time.** No network, database write, secrets or log call.
If the old row lacks `updated_at`, an official snapshot is missing, or any
tenant/roster/attack identity fails the existing check, it returns no RPC
arguments.

The SQL is a **candidate atomic, service-role-only RPC**:
- `SECURITY INVOKER`, fixed empty `search_path`, explicit `current_user`
  verification; `REVOKE EXECUTE` from `PUBLIC`, `anon`, `authenticated`
  and `GRANT` to `service_role` in the same SQL transaction.
  A browser may never receive the service-role credential.
- It checks the linked app-clan tag, the **same** `(clan_id,war_key)`, the
  immutable final/API/CWL state, original `updated_at` and war metadata,
  the entire saved roster and **exact canonical contents of all attacks**.
  Existing missed entries always cause a conflict.
- It validates that the proposed missing tags are *exactly* the roster tags
  without an observed attack; for CWL each proposed row counts 1, has a
  valid tag and a bounded name. The validated official `clan.attacks`
  counter must match the entire stored attack count. A mismatch never
  becomes a missing attack.
- One PostgreSQL RPC transaction locks the four implicated tables in a
  fixed order with a short lock timeout; this conservative protection also
  prevents concurrent collector inserts from creating phantom rows.
  The draft intentionally blocks **all stats-table writers** briefly,
  which must be measured in a disposable/staging database before deployment.
- `p_apply=false` is the **default**, yielding only a verified count.
  A separately authorized operation could set it `true` only after fresh
  official-source verification and explicit approval. It would insert
  confirmed Missed rows then mark the war complete within the **same**
  transaction; a failure rolls both changes back. Repeated application
  fails closed instead of silently overwriting history.

**Security limitation:** SQL cannot establish the provenance of a JSON
"official snapshot". Service-role-only EXECUTE is a privilege boundary,
not a cryptographic Clash proof. A future strictly server-side caller must
fetch the legitimate `/clanwarleagues/wars/{tag}` response independently,
run the validated pure preview and never trust client/imported parameters.

**Validation prepared:** A dedicated CI job
[`.github/workflows/collector-reconciliation-sql-ci.yml`](../.github/workflows/collector-reconciliation-sql-ci.yml)
uses an isolated PostgreSQL 17 service, synthetic Supabase-like roles and
fictitious app-clan records. It executes the draft SQL to verify real grants,
dry-run semantics, stale-record rejection, forced rollback, independent tenant
rows, duplicate apply, and a concurrent writer lock timeout. CI results must
be checked before claiming a passed database integration test.
The Node regression
[`tests/collector-historical-cwl-atomic-rpc-design.test.cjs`](../tests/collector-historical-cwl-atomic-rpc-design.test.cjs)
validates pure input protocol and static safety safeguards separately.

**Unmet deployment gates even after a green CI:** Run the exact draft on a
Supabase-equivalent disposable/staging environment using production-equivalent
RLS, triggers and grants, review the global writer-lock impact under real
collector load, check security advisors, and separately review the trusted
caller and official source verification. Only then consider a proper
`supabase migration new` and explicitly approved migration/deployment. No
production write is authorized by the existence of this draft. The unknown historical 29.10.
import and earlier missing official counters stay unresolved.

## Secure official end-war source gate – server-only candidate (08.11.2026)

The new
[`collector-reconciliation-source.mjs`](../supabase/functions/coc-stats-collector/collector-reconciliation-source.mjs)
is a **non-deployed and non-exposed server-only** building block for #104.
It is deliberately **not imported** by the live
`supabase/functions/coc-stats-collector/index.ts`, any browser/PWA
module, or the hourly GitHub workflow. It does **not** call Supabase,
the SQL draft or any write endpoint.

In a **future privileged, separately reviewed server path**, the caller
must first retrieve the actual linked `cwl_clans` record, the finalized,
API-sourced and still Missed-unverified `cwl_stat_wars` record, *all*
`cwl_stat_attacks` and *all* `cwl_stat_missed` rows from the **same**
`(clan_id,war_key)`, then provide the secret `COC_API_KEY` held only
server-side. This module rejects invalid or wrong-tenant input **before
any network request**. The caller cannot substitute user-submitted war
JSON for an official response.

The source gate then makes at most **two GET requests** to the existing
fixed `https://cocproxy.royaleapi.dev/v1` endpoint with the secret
Bearer token, a strict 8-second timeout, redirects disabled, JSON body
validation and bounded response size:

1. Fetch the linked clan's `/clans/{clanTag}/currentwar/leaguegroup`.
   Confirm the actual clan is listed, the league rounds and war tags
   are well formed, and the historical WarTag appears **exactly once**
   in the independent group. Ignore legitimate `#0` placeholder tags.
   Without this independent lookup, the saved `war_key` is **not
   sufficient provenance** and the operation stops.
2. Fetch exactly that verified
   `/clanwarleagues/wars/{warTag}`. Confirm the real linked clan appears
   on one side. Feed the fresh response to
   `prepareHistoricalCwlMissedRpc`, which independently validates
   `warEnded`, complete roster and opponent, `clan.attacks`,
   attack-level correspondence, timestamps and the saved war version.

A successful result is **only a private DRY-RUN payload** with
`p_apply:false`. All rejection paths return a fixed safe reason
and `rpcArgs:null`, without user data, upstream error bodies, player
names, token contents or URLs. The caller must **never return the private
payload to a browser or log it**.

**Limitations:** This is the authenticated Clash-shaped API through the
existing RoyaleAPI proxy, not a cryptographically signed Supercell
snapshot. The independent league-group endpoint is transient; if the
original completed league war is no longer listed or accessible, **do
not backfill** and leave `missed_log_complete=false`. There is no
background historical reconciliation or active writer yet.

The safety contract is covered by
[`tests/collector-official-endwar-source.test.cjs`](../tests/collector-official-endwar-source.test.cjs):
correct fixed endpoints, no network requests for an invalid tenant,
group/WarTag independent cross-check, missing official counter,
mismatched recorded attacks, 404/403/429/503 and malformed upstream
responses, two independent app-clan profiles referring to the same
real war, and confirmation the live Edge entrypoint does not import
this module. **No real private Clash credentials or player data are used.**

See also
[`COLLECTOR_RECONCILIATION_STAGING_CHECKLIST.md`](COLLECTOR_RECONCILIATION_STAGING_CHECKLIST.md)
for the separately required live-like staging and security gates.

## Monitoring and recovery

- Per-clan data: `public.cwl_stat_collector_status` (read-only RLS).
- Verify GitHub Actions completed and the Edge Function shows no errors.
- If no last-success timestamp appears, investigate the OIDC audience/workflow
  claims, external API availability and database configuration first.
- No private player roster or auth tokens should be logged in workflow output.
- Disable the scheduled workflow if the game API or service role is compromised.
