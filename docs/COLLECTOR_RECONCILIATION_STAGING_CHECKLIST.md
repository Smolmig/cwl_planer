# CWL Missed Reconciliation – staging and security acceptance checklist

**Status 08.11.2026:** Planning document; **no separate Supabase staging project created, no live migration, no active writer**. The live Cloud app remains v1.16.20; all historical CWL-Missed flags remain unchanged. This checklist is a release gate, not permission to deploy.

## 1. Safe prerequisites

- Create a **new, isolated Supabase staging project** with disposable/synthetic test clan profiles and fake player tags. No real service-role key, production backup, linked users or live Clan data may be copied into public CI logs.
- Verify staging PostgreSQL version, installed extensions, RLS, table grants, constraints, triggers, foreign keys, lock behavior and Data API exposure against production **without disabling production RLS**. The existing GitHub PostgreSQL-17 workflow checks basic transactions with fake Supabase roles, but is **not** a substitute for an actual Supabase staging run.
- Record the tested git SHA, SQL SHA, Supabase platform/PG versions, baseline table counts, and rollback mechanism. Backups and migration permissions require an owner review.
- Check the actual Supabase CLI and platform documentation at implementation time; recent CLI v3 defaults to local and confirms remote changes. Never assume that deploying to a named project is the default.
- Preserve the existing collector's short-lived GitHub-OIDC verification and its secret-only server API token; never put them into the frontend.

## 2. Prove the independent official source (read-only)

1. Read **one authorized app-clan** and its exact `(clan_id,war_key)` finalized API-sourced CWL row, all related attacks and any missed rows under the same clan ID.
2. With a trusted server-held `COC_API_KEY`, use the existing fixed Clash proxy host, fetch the real group's `rounds.warTags`, verify the stored war tag is independently listed exactly once and that the actual linked clan participates. Then GET that exact war.
3. Verify the complete `warEnded` match, settled end, opposite roster, expected war start, opponent tag, distinct recorded attackers, individual defender targets/stars/destruction/RHs, official clan total attack counter, and the recorded `updated_at` version.
4. If the group is no longer accessible, the WarTag disappeared, API returns 403/404/429/5xx, the counter is missing, or any attack differs, **stop**. Keep missed status **unknown**. `#0` placeholder tags never authorize a correction.
5. Do not log or return raw war JSON, API tokens, individual player details, stored private rows or proposed RPC arguments. External status only: safe reason code, counts of processed/rejected candidates (only when authorized to see them).

## 3. Stage and test the atomic writer

- The SQL is in `scripts/DRAFT_cwl_historical_missed_atomic_rpc.sql` and deliberately **not** in `supabase/migrations/`. It must be reviewed as a **draft** before producing a proper migration via the Supabase CLI.
- Confirm the RPC stays `SECURITY INVOKER`, not definer; `PUBLIC`, `anon`, and `authenticated` cannot execute it, `service_role` can only in protected server context, and no direct browser REST endpoint exposes service-role privileges.
- Check with realistic tenant-specific rows: default `p_apply=false` never writes; only approved `p_apply=true` after immediately re-fetching a trusted official snapshot could write.
- Concurrently run collector-like inserts/updates, historic import attempts, double-submit, a stale `updated_at`, overlapping clan profiles with the same Clash war key and a deliberately failed status update. **No partial Missed rows, cross-clan writes or silent overwrite** permitted.
- Benchmark the draft's **global SHARE ROW EXCLUSIVE locks** while running real-like collector workloads. If the brief global blocking is too costly, redesign using row-scoped locking and safely handle concurrent inserts; do not remove the phantom-insert protection merely to improve speed.
- Inspect `lock_timeout`, `statement_timeout`, transaction isolation, RLS policies, trigger effects and grants in actual Supabase staging. Run database and security advisors. Document findings and regressions.

## 4. Deployment gate (not yet reached)

- Obtain explicit operator approval of a **specific** migration, authenticated server-only caller and final proof plan. The existing unexposed helper and draft SQL are not approval for production writes.
- Create a timestamped migration **only using the supported CLI** after checking its version/help; review privileges and potential REST/RPC exposure.
- Establish a backup, on-call rollback and monitoring plan. Roll out in two phases: dry-run audit, then **one explicitly approved historical war** if and only if fresh official evidence still exists.
- Verify each app-clan independently; a shared Clash war tag does not authorize reading or writing another tenant. Compare before/after counters by clan ID without disclosing player identities.
- Monitor next autonomous collector runs and the original historical records for unintended changed attacks or plan state. Never touch the CWL solver, scheduled lineups, editor/observer roles or the separate offline PWA.
- Do **not** label the incomplete 29.10. archive or the ten historically unverified API rows as fully reliable merely because the dry-run code exists.

## 5. Current verification evidence

- [PR #145 – read-only missed coverage](https://github.com/Smolmig/cwl_planer/pull/145)
- [PR #146 – pure official snapshot comparison](https://github.com/Smolmig/cwl_planer/pull/146)
- [PR #147 – isolated PostgreSQL-17 SQL transaction testing](https://github.com/Smolmig/cwl_planer/pull/147)
- [Issue #104 – ongoing evidence and limits](https://github.com/Smolmig/cwl_planer/issues/104)
- [Live handoff](ACTIVE_PROJECT_HANDOFF.md)

Next practical milestone: real Supabase-like staging for the draft RPC **and** a separately reviewed privileged server-side caller that supplies independently verified official source data. No deployment is implied by this checklist.
