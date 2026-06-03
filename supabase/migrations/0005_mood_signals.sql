-- Mood empathy loop: a low-mood "heavy day" signal the partner can see WITHOUT
-- the numeric score (the score is included only if the user opted in via
-- profiles.prefs.mood_share_score). Run in the Supabase SQL editor. Idempotent.

create table if not exists mood_signals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  on_date date not null,
  level text not null default 'low' check (level in ('low')),
  mood int check (mood between 1 and 5),  -- null unless the user shares their score
  created_at timestamptz not null default now(),
  unique (from_user, on_date)
);
create index if not exists mood_signals_couple_idx on mood_signals(couple_id, on_date desc);

alter table mood_signals enable row level security;

-- Both partners can read the couple's signals; only the owner can write theirs.
drop policy if exists "mood_signals_select_couple" on mood_signals;
create policy "mood_signals_select_couple" on mood_signals for select
  using (couple_id = current_couple_id());

drop policy if exists "mood_signals_write_self" on mood_signals;
create policy "mood_signals_write_self" on mood_signals for all
  using (from_user = auth.uid())
  with check (from_user = auth.uid() and couple_id = current_couple_id());

-- Realtime so the partner's home updates live when a signal appears/clears.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mood_signals'
  ) then
    execute 'alter publication supabase_realtime add table public.mood_signals';
  end if;
end $$;
