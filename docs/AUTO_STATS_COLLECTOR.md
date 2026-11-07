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

## Monitoring and recovery

- Per-clan data: `public.cwl_stat_collector_status` (read-only RLS).
- Verify GitHub Actions completed and the Edge Function shows no errors.
- If no last-success timestamp appears, investigate the OIDC audience/workflow
  claims, external API availability and database configuration first.
- No private player roster or auth tokens should be logged in workflow output.
- Disable the scheduled workflow if the game API or service role is compromised.
