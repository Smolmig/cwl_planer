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

## Monitoring and recovery

- Per-clan data: `public.cwl_stat_collector_status` (read-only RLS).
- Verify GitHub Actions completed and the Edge Function shows no errors.
- If no last-success timestamp appears, investigate the OIDC audience/workflow
  claims, external API availability and database configuration first.
- No private player roster or auth tokens should be logged in workflow output.
- Disable the scheduled workflow if the game API or service role is compromised.
