-- More modules: Anniversaries, Repair Log, Affirmations, Random Acts,
-- Pulses (nudges + push subscriptions), Gratitudes, Postcards, Worksheets.
-- Idempotent. Run after schema.sql + 0001_spotify.sql.

create table if not exists anniversaries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  on_date date not null,
  kind text not null default 'anniversary' check (kind in ('anniversary','milestone','birthday','custom')),
  recurring boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists anniversaries_couple_idx on anniversaries(couple_id);

create table if not exists repair_logs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  occurred_on date not null default current_date,
  trigger_note text,
  what_happened text,
  what_repaired text,
  learned text,
  created_at timestamptz not null default now()
);
create index if not exists repair_couple_idx on repair_logs(couple_id, occurred_on desc);

create table if not exists affirmations (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists affirmations_couple_idx on affirmations(couple_id);

create table if not exists random_acts (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  week_of date not null,
  for_user uuid not null references auth.users(id) on delete cascade,
  act text not null,
  done boolean not null default false,
  ai_generated boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists random_acts_couple_week_idx on random_acts(couple_id, week_of);

create table if not exists nudges (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  to_user uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'pulse',
  message text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists nudges_to_user_idx on nudges(to_user, created_at desc);

create table if not exists push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_subs_user_idx on push_subscriptions(user_id);

create table if not exists gratitudes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists gratitudes_couple_idx on gratitudes(couple_id, created_at desc);

create table if not exists postcards (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  location text,
  photo_url text,
  note text,
  sent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists postcards_couple_idx on postcards(couple_id, sent_on desc);

create table if not exists worksheet_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  worksheet_id text not null,
  answers jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, worksheet_id)
);

-- ----- RLS -----
alter table anniversaries enable row level security;
alter table repair_logs enable row level security;
alter table affirmations enable row level security;
alter table random_acts enable row level security;
alter table nudges enable row level security;
alter table push_subscriptions enable row level security;
alter table gratitudes enable row level security;
alter table postcards enable row level security;
alter table worksheet_responses enable row level security;

drop policy if exists "anniversaries_couple_all" on anniversaries;
create policy "anniversaries_couple_all" on anniversaries for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

drop policy if exists "repair_couple_all" on repair_logs;
create policy "repair_couple_all" on repair_logs for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

drop policy if exists "affirmations_couple_all" on affirmations;
create policy "affirmations_couple_all" on affirmations for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

drop policy if exists "random_acts_couple_all" on random_acts;
create policy "random_acts_couple_all" on random_acts for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

drop policy if exists "nudges_select" on nudges;
create policy "nudges_select" on nudges for select
  using (couple_id = current_couple_id());

drop policy if exists "nudges_insert" on nudges;
create policy "nudges_insert" on nudges for insert
  with check (couple_id = current_couple_id() and from_user = auth.uid());

drop policy if exists "nudges_update_recipient" on nudges;
create policy "nudges_update_recipient" on nudges for update
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

drop policy if exists "push_subs_own" on push_subscriptions;
create policy "push_subs_own" on push_subscriptions for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "gratitudes_couple_all" on gratitudes;
create policy "gratitudes_couple_all" on gratitudes for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

drop policy if exists "postcards_couple_all" on postcards;
create policy "postcards_couple_all" on postcards for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

drop policy if exists "ws_resp_select" on worksheet_responses;
create policy "ws_resp_select" on worksheet_responses for select
  using (user_id = auth.uid() or (couple_id = current_couple_id() and completed_at is not null));

drop policy if exists "ws_resp_insert" on worksheet_responses;
create policy "ws_resp_insert" on worksheet_responses for insert
  with check (user_id = auth.uid() and couple_id = current_couple_id());

drop policy if exists "ws_resp_update" on worksheet_responses;
create policy "ws_resp_update" on worksheet_responses for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ws_resp_delete" on worksheet_responses;
create policy "ws_resp_delete" on worksheet_responses for delete
  using (user_id = auth.uid());
