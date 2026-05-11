-- Polish pass: persist AI-generated journal prompts and weekly digests.
-- Run in Supabase SQL editor after the previous migrations.

create table if not exists daily_prompts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  prompt_date date not null,
  prompt text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, prompt_date)
);

create table if not exists weekly_digests (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  week_of date not null,
  narrative text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, week_of)
);

alter table daily_prompts enable row level security;
alter table weekly_digests enable row level security;

drop policy if exists "daily_prompts_couple_all" on daily_prompts;
create policy "daily_prompts_couple_all" on daily_prompts for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

drop policy if exists "weekly_digests_couple_all" on weekly_digests;
create policy "weekly_digests_couple_all" on weekly_digests for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());
