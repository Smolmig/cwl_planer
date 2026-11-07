# Automatic CW/CWL statistics collector

## Scope

Collects official, currently accessible Clash war data for **every** linked Clash clan
in `public.cwl_clans` without a browser or user session. A single Clash tag may appear
in multiple **independently permissioned** app clans. A fetched public game snapshot
is written separately under each corresponding `clan_id`; no existing private
`cwl_stat_*` rows are copied between tenants.

## Trigger and authentication

- GitHub Actions `.github/workflows/collect-war-stats.yml` requests an hourly
  run at **UTC minute 27** (`27 * * * *`) and supports a protected manual dispatch.
  GitHub may delay or skip scheduled events: this is a best-effort collector,
  not a guarantee of precisely hourly synchronization.
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

**Unmet deployment gates:** Verify SQL syntax, grants, dry-run behavior,
rollback, retries, contested writes and concurrent collector inserts in a
**disposable PostgreSQL 17 + Supabase-role test environment**. Check real
RLS and grants with advisors, review the global writer-lock impact,
create a proper migration with `supabase migration new` *only after*
tests and approval, preserve a backup, and explicitly deploy/monitor.
The current Node regression
[`tests/collector-historical-cwl-atomic-rpc-design.test.cjs`](../tests/collector-historical-cwl-atomic-rpc-design.test.cjs)
validates the pure input protocol and static SQL safeguards only; **it is
not a live database/SQL-execution test**. The unknown historical 29.10.
import and earlier missing official counters stay unresolved.

## Monitoring and recovery

- Per-clan data: `public.cwl_stat_collector_status` (read-only RLS).
- Verify GitHub Actions completed and the Edge Function shows no errors.
- If no last-success timestamp appears, investigate the OIDC audience/workflow
  claims, external API availability and database configuration first.
- No private player roster or auth tokens should be logged in workflow output.
- Disable the scheduled workflow if the game API or service role is compromised.
