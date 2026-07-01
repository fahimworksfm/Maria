-- "Together" module: next-visit (couple-level), per-user home location, a
-- one-time daily rhythm (wake/sleep/work hours) and an activity heartbeat so
-- presence + good-morning/good-night can be inferred AUTOMATICALLY (no daily
-- tapping). Run in the Supabase SQL editor. Idempotent.

-- Couple-level next visit (both partners can read + edit via existing couples policies).
alter table couples add column if not exists next_visit_at timestamptz;
alter table couples add column if not exists next_visit_label text;
alter table couples add column if not exists next_visit_traveler text; -- who travels: a user_id or free text

-- Per-user location + rhythm + last-seen (self-write, partner-read via existing profiles policies).
alter table profiles add column if not exists home_city text;
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lng double precision;
alter table profiles add column if not exists timezone text;        -- IANA, e.g. 'America/New_York'
alter table profiles add column if not exists wake_hour int;        -- 0-23, local
alter table profiles add column if not exists sleep_hour int;       -- 0-23, local
alter table profiles add column if not exists work_start_hour int;  -- 0-23, nullable
alter table profiles add column if not exists work_end_hour int;    -- 0-23, nullable
alter table profiles add column if not exists last_active_at timestamptz;

-- No new RLS policies needed:
--   couples_select_members / couples_update_members  → both partners read+edit next_visit_*
--   profiles_select_self_or_partner / profiles_update_self → each reads self+partner, writes only self
