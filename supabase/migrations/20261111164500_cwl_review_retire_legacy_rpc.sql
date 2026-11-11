-- #37 phase B: only after the v1.16.72 client and phase-A RPCs are verified.
-- A stale cached tab may still call these old endpoints; rejecting those writes
-- is intentional. They cannot bypass the cycle token requirement.
revoke execute on function public.cwl_set_plan_lock(uuid,boolean,boolean) from authenticated;
revoke execute on function public.cwl_submit_plan_suggestion(uuid,bigint,jsonb) from authenticated;
revoke execute on function public.cwl_resolve_plan_suggestion(uuid,boolean) from authenticated;
revoke execute on function public.cwl_withdraw_plan_suggestion(uuid) from authenticated;
