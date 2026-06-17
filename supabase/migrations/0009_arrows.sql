-- Arrows puzzle progress (per user, comparable within the couple).
-- Run in the Supabase SQL editor. Idempotent.
create table if not exists arrows_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  level int not null default 1,
  updated_at timestamptz not null default now()
);

alter table arrows_progress enable row level security;

drop policy if exists "arrows_select_couple" on arrows_progress;
create policy "arrows_select_couple" on arrows_progress for select
  using (couple_id = current_couple_id());

drop policy if exists "arrows_write_self" on arrows_progress;
create policy "arrows_write_self" on arrows_progress for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = current_couple_id());
