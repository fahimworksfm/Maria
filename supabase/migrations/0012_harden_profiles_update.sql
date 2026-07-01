-- Security hardening (pre-existing gap, found in review). The profiles UPDATE
-- policy had no WITH CHECK, so Postgres reused only the USING clause — which
-- constrains user_id but NOT couple_id. An authenticated user could therefore
-- change their own couple_id via a direct API call and read another couple's
-- shared data. Legitimate couple assignment happens through the service-role
-- admin client (join/signup), which bypasses RLS, so pinning couple_id here is
-- safe. Run in the Supabase SQL editor. Idempotent.

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id is not distinct from current_couple_id());
