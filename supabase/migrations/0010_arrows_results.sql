-- Per-puzzle best results for Arrows (level bests + daily puzzle), comparable
-- within the couple. puzzle_key is e.g. "L7" (level 7) or "D2026-06-04" (daily).
-- Run in the Supabase SQL editor. Idempotent.
create table if not exists arrows_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  puzzle_key text not null,
  moves int not null,
  time_ms int not null,
  created_at timestamptz not null default now(),
  unique (user_id, puzzle_key)
);
create index if not exists arrows_results_couple_idx on arrows_results(couple_id, puzzle_key);

alter table arrows_results enable row level security;

drop policy if exists "arrows_results_select_couple" on arrows_results;
create policy "arrows_results_select_couple" on arrows_results for select
  using (couple_id = current_couple_id());

drop policy if exists "arrows_results_write_self" on arrows_results;
create policy "arrows_results_write_self" on arrows_results for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = current_couple_id());
