# CWL lifecycle transition – Cloud Plan after the final war

**Scope:** Requested 10.11.2026 after November CWL ended. Design/implementation in branch `feat/cwl-postseason-plan-view-2026-11`, release target v1.16.59. The older clan-verification #183 development branch is **paused, not discarded**.

## Observed production issue and source of truth

A successful official `GET /clans/{tag}/currentwar/leaguegroup` can return `notInWar` *after* the league has finished. The previous proxy converted that to `active:false`, and the browser intentionally stopped showing any previous CWL snapshot. The same browser only auto-finalized days while `active:true` and each day was `warEnded`. Therefore a plan could still truthfully say **6/7** completed while the API read showed **no active CWL**.

Read-only live DB diagnosis, 10.11.2026: 3 November Cloud profiles; the seventh day is saved as `warEnded/locked` in one, `inWar/not locked` in another, and `unavailable/not locked` in the third. There are tenantprivate stored day-seven official war tags and saved league-group data. This diagnosis does **not** establish which user is in which state, or that any missing final score is known. No production player, profile, attack or plan row is modified by this investigation.

### Four display states

1. **Planning / Clash league active**: existing CWL planner, verified roster/score, last-hour warnings and manual planning rules stay identical.
2. **Postseason**: official group `ended`, or a recent saved same-Clash-clan CWL paired with a successful `notInWar` response. The Plan page shows **inline** the current CWL season's group standings/known opponents, seven rounds and player contributions, via the existing season rendering functions. Former `Saison ansehen` button and day-card grid are hidden only in this cloud mode. A missing final day stays **Abschluss offen 6/7**, never forced to 7/7. Replay/older saved data carry their source limitations visibly.
3. **Between CWLs**: when there is no active league and no valid recent CWL snapshot, show neutral `Keine aktive CWL` under Plan. Current normal CW is now there (formerly under Einsätze): clan/vs/opponent badges and stars, percent destruction, war size, preparation/end time, each side's actual attack count, and expandable individual rosters/targets/stars/destruction. It remains an optional read-only official API endpoint – if private/unavailable, no fake CW. CWL and normal CW are not merged into a single war record.
4. **New league begins**: when the current Cloud owner has **all seven actual API-source final** day locks for the prior season, the old season is idempotently archived in existing `archives` (with `sourceSeason` for dedupe), then persisted using the existing Cloud compare-and-swap and new-cycle RPC, and only then reset for the new season. Before the new league begins, a 7/7 completed season can already be archived without resetting the plan. If 6/7 or any manual/unknown source, **no automatic reset**, a visible transition warning and deliberate manual resolution. Manual offline PWA is unchanged.

### Recovery if the official league-group endpoint stops serving the old league

The authenticated `coc-cwl-status` Edge function looks up **only this permitted app tenant**'s previously observed `day=7` official `war_tag` in the existing member-RLS-protected `cwl_own_lineup_archives`. Only for the current/previous UTC calendar month and a valid 5–50-player saved war does it make one targeted official `/clanwarleagues/wars/{warTag}` request.

The final row is usable **only** if the official war is `warEnded`, references this exact linked Clash clan, has valid opponent tags and complete unique own/opponent rosters matching the saved team size, and has a dated end between 1 minute and 45 days ago. Recovered payload contains that **single final round**; older same-season rounds come only from the browser's prior validated saved snapshot, never inferred from the current time. The exact same `canFinalize()` gates in the browser apply before any historical lock. If official details are unavailable (expired endpoint, private war log, upstream failure), the app conservatively leaves the final round unresolved. Server secrets never leave Edge. No cross-tenant raw data is fetched or shared.

## Technical / QA and known limitations

- Explicit `groupState` from the official CWL group and per-war `warEnded` are different; tests cover 6/7, 7/7, stale older war detail, same-season/other-season rejection, clan-tag scope and no-live/unknown modes.
- Existing `cwl-season-view.mjs` group, rounds and players renderers are reused on Plan – not independently recalculated. Stored group JSON is fetched under existing owner/member-RLS when the live group expires. The UI does not replace a user's current plan because of an API outage.
- A displayed `warEnded` score with missing attack arrays is **not automatically evidence of a missed attack**. That remains a separate provenance-gated #183/#212/statistics feature.
- **No background server job** created to mutate/close planning state while all owner browsers are offline. The transition/archival runs on authorized Cloud owner refresh, or on reopening their app, and requires an eligible completed previous season. Owner/viewer permissions, revision safety and separate clans remain intact. A future server-owned background workflow would require its own permission/consistency design.
- The app archive stores the previous plan's played lineups and limited saved CWL snapshot, not a whole-app backup. Comprehensive backup/restore remains open #178. Old archives with no `sourceSeason` should not be silently destroyed.
- Automatic release/deployment must verify Edge user-authentication and normal CW fallback still work, as well as the 320/390/430px plan view, light/dark/gold themes, viewers, manual offline mode and all 7/7 release/plan scenarios.
- Live November Cloud plans must not be edited en masse. User-facing proof of a now available final war and genuine iOS/Android owner UAT remains #213; the read-only database inspection cannot prove the targeted Supercell endpoint currently still returns the old day-seven war.
