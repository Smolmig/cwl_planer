# Atomic CWL season rollover (issue #227)

## Release gate

- Only the existing verified scheduled collector uses the new service-role RPC. Official current-month group with state preparation/inWar, unique six/eight-clan roster including the exact linked Clash tag, and consistent rounds (empty pending draw or correct 5/7 count).
- A previous saved matching season is required. No month-only reset or imported proof. Existing archive must match the saved locked lineups; 0/5/6/7 are preserved, no guessed finals. New archive preserves the exact old cwlLive and recorded lineup data; force an exact pre-transition revision snapshot.
- One database transaction: lock linked clan and current profile, compare revision, lock review cycle; validate original archive prefix, member identity/stammdaten, cleared day rules, actual archive lineups; mark only pending old-cycle suggestions stale; create new unlocked cycle, update profile and audit. Duplicate runs return false. Old browser writes with stale revision fail normally. A pre-existing different review season blocks the collector rather than overwriting a possible interrupted manual transition.
- No fake owner identity. Service-role-only EXECUTE, SECURITY INVOKER, exact service JWT + transaction marker in existing write/revision triggers. updated_by retains last human editor; audit actor NULL, details.system_action=cwl_season_rollover. Normal user guards unchanged.
- Process the official group before individual war fetches. Stats/roster collection continues if rollover fails, failure counted separately.
- Deploy order: reviewed database SQL first, verify grants, then collector (preserve independent cron and OIDC verification). No automatic live data changes before real official December group. The browser owner path remains fallback.
- `scripts/cwl-atomic-rollover-release.sql` is the reviewed DDL source. `tests/sql/cwl-atomic-rollover-rollback-fixture.sql` must run with it inside BEGIN/ROLLBACK, only synthetic tenant/user. Verify fixture absent afterward. Separate deployment and real December UAT required; do not claim a live actual rollover before it occurs.

## Verification so far

Rollback fixture passed on actual Supabase schema twice (second pass with stricter archive/day rules): unauthorized roles lack EXECUTE, stale revision, wrong clan, ended group, missing archive rejected, successful transition increments revision, snapshot matches old profile, old pending suggestion stale, new cycle unlocked, explicit system audit, duplicate rejected, direct service profile write without marker rejected. Synthetic fixture rolled back. Read-only existing profile check: United Fighters and UF 2 both seven valid November locks; UF's existing archive lineups match all locks; UF2 has no November plan archive yet. No real clan profile or review cycle modified.
