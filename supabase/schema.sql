-- =============================================================================
-- Tether schema
-- Run this in the Supabase SQL editor on a fresh project.
-- It is idempotent: safe to re-run.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Core: couples & members
-- A couple is a 2-person container. Each auth user belongs to at most one couple.
-- -----------------------------------------------------------------------------

create table if not exists couples (
  id uuid primary key default gen_random_uuid(),
  name text,
  invite_code text unique,
  created_at timestamptz not null default now()
);

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid references couples(id) on delete set null,
  display_name text,
  avatar_url text,
  birthday date,
  -- Preferences readable by partner (sizes, favourites, wishlist text):
  prefs jsonb not null default '{}'::jsonb,
  -- PIN hash for the private gift vault (bcrypt-ish; we store a sha256 + salt).
  vault_pin_hash text,
  vault_pin_salt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Helper: which couple does the current user belong to?
create or replace function current_couple_id() returns uuid
language sql stable security definer set search_path = public as $$
  select couple_id from profiles where user_id = auth.uid()
$$;

-- Helper: is the given user_id in the same couple as the current user?
create or replace function is_partner(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles me, profiles them
    where me.user_id = auth.uid()
      and them.user_id = target
      and me.couple_id is not null
      and me.couple_id = them.couple_id
  )
$$;

-- -----------------------------------------------------------------------------
-- Shared modules (both partners read/write within their couple)
-- -----------------------------------------------------------------------------

create table if not exists memories (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  title text,
  body text,
  media_url text,
  media_type text check (media_type in ('image','audio','video') or media_type is null),
  happened_on date,
  location_name text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now()
);
create index if not exists memories_couple_idx on memories(couple_id, happened_on desc);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  prompt text not null,
  prompt_date date not null default current_date,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  unique (couple_id, prompt_date, author_id)
);
create index if not exists journal_couple_idx on journal_entries(couple_id, prompt_date desc);

create table if not exists date_ideas (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  budget text check (budget in ('free','low','medium','high') or budget is null),
  effort text check (effort in ('low','medium','high') or effort is null),
  weather text check (weather in ('any','indoor','outdoor') or weather is null),
  done boolean not null default false,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists date_ideas_couple_idx on date_ideas(couple_id);

create table if not exists bucket_items (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  notes text,
  category text,
  target_date date,
  completed_at timestamptz,
  cover_url text,
  created_at timestamptz not null default now()
);
create index if not exists bucket_couple_idx on bucket_items(couple_id, completed_at);

create table if not exists watchlist (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  kind text check (kind in ('movie','show','other')) default 'movie',
  notes text,
  runtime_min int,
  mood_tags text[],
  watched_at timestamptz,
  rating int check (rating between 1 and 5),
  tmdb_id int,
  poster_path text,
  year int,
  overview text,
  created_at timestamptz not null default now()
);

create table if not exists places (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  kind text,
  notes text,
  lat double precision,
  lng double precision,
  visited boolean not null default false,
  rating int check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  artist text,
  spotify_url text,
  why text,
  created_at timestamptz not null default now()
);

create table if not exists travel_pins (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  visited boolean not null default false,
  visited_on date,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists recipes (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  title text not null,
  ingredients text[],
  steps text,
  source_url text,
  cooked_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists quiz_questions (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  question text not null,
  about_user uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists quiz_answers (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references quiz_questions(id) on delete cascade,
  answerer_id uuid not null references auth.users(id) on delete cascade,
  answer text not null,
  created_at timestamptz not null default now(),
  unique (question_id, answerer_id)
);

create table if not exists voice_letters (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid references auth.users(id) on delete set null,
  audio_url text not null,
  transcript text,
  unlock_at timestamptz,
  is_private boolean not null default false,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Personal modules (own-write, partner-read)
-- -----------------------------------------------------------------------------

create table if not exists mood_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  on_date date not null default current_date,
  mood int not null check (mood between 1 and 5),
  note text,
  share_with_partner boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, on_date)
);

create table if not exists love_language_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  category text not null check (category in ('words','acts','gifts','time','touch')),
  note text,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Private vault (only the owner can ever read these rows)
-- -----------------------------------------------------------------------------

create table if not exists vault_gifts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  occasion text,
  budget_cents int,
  due_on date,
  status text not null default 'idea' check (status in ('idea','planned','bought','given')),
  created_at timestamptz not null default now()
);
create index if not exists vault_gifts_owner_idx on vault_gifts(owner_id);

-- =============================================================================
-- RLS
-- =============================================================================

alter table couples enable row level security;
alter table profiles enable row level security;
alter table memories enable row level security;
alter table journal_entries enable row level security;
alter table date_ideas enable row level security;
alter table bucket_items enable row level security;
alter table watchlist enable row level security;
alter table places enable row level security;
alter table songs enable row level security;
alter table travel_pins enable row level security;
alter table recipes enable row level security;
alter table quiz_questions enable row level security;
alter table quiz_answers enable row level security;
alter table voice_letters enable row level security;
alter table mood_checkins enable row level security;
alter table love_language_logs enable row level security;
alter table vault_gifts enable row level security;

-- Couples: members of a couple can read it; anyone authenticated can create one.
drop policy if exists "couples_select_members" on couples;
create policy "couples_select_members" on couples for select
  using (id = current_couple_id());

drop policy if exists "couples_insert_auth" on couples;
create policy "couples_insert_auth" on couples for insert
  with check (auth.uid() is not null);

drop policy if exists "couples_update_members" on couples;
create policy "couples_update_members" on couples for update
  using (id = current_couple_id());

-- Profiles: you can read your own and your partner's. You can write only your own.
drop policy if exists "profiles_select_self_or_partner" on profiles;
create policy "profiles_select_self_or_partner" on profiles for select
  using (user_id = auth.uid() or is_partner(user_id));

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles for insert
  with check (user_id = auth.uid());

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id is not distinct from current_couple_id());

-- Generic shared-table policy maker: read/write requires couple_id = current_couple_id().
-- We inline the policies because Postgres doesn't allow parameterized policy definitions.

-- memories
drop policy if exists "memories_couple_all" on memories;
create policy "memories_couple_all" on memories for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

-- journal_entries
drop policy if exists "journal_couple_all" on journal_entries;
create policy "journal_couple_all" on journal_entries for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

-- date_ideas
drop policy if exists "date_ideas_couple_all" on date_ideas;
create policy "date_ideas_couple_all" on date_ideas for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- bucket_items
drop policy if exists "bucket_couple_all" on bucket_items;
create policy "bucket_couple_all" on bucket_items for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- watchlist
drop policy if exists "watchlist_couple_all" on watchlist;
create policy "watchlist_couple_all" on watchlist for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- places
drop policy if exists "places_couple_all" on places;
create policy "places_couple_all" on places for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- songs
drop policy if exists "songs_couple_all" on songs;
create policy "songs_couple_all" on songs for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- travel_pins
drop policy if exists "travel_pins_couple_all" on travel_pins;
create policy "travel_pins_couple_all" on travel_pins for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- recipes
drop policy if exists "recipes_couple_all" on recipes;
create policy "recipes_couple_all" on recipes for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- quiz_questions
drop policy if exists "quiz_questions_couple_all" on quiz_questions;
create policy "quiz_questions_couple_all" on quiz_questions for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id());

-- quiz_answers: read if in same couple via the question; write only your own answers
drop policy if exists "quiz_answers_select_couple" on quiz_answers;
create policy "quiz_answers_select_couple" on quiz_answers for select
  using (exists (
    select 1 from quiz_questions q
    where q.id = quiz_answers.question_id
      and q.couple_id = current_couple_id()
  ));

drop policy if exists "quiz_answers_insert_self" on quiz_answers;
create policy "quiz_answers_insert_self" on quiz_answers for insert
  with check (answerer_id = auth.uid() and exists (
    select 1 from quiz_questions q
    where q.id = quiz_answers.question_id
      and q.couple_id = current_couple_id()
  ));

-- voice_letters: shared OR private (recipient = self) within the couple
drop policy if exists "voice_letters_select" on voice_letters;
create policy "voice_letters_select" on voice_letters for select
  using (
    couple_id = current_couple_id()
    and (
      is_private = false
      or author_id = auth.uid()
      or recipient_id = auth.uid()
    )
    and (unlock_at is null or unlock_at <= now() or author_id = auth.uid())
  );

drop policy if exists "voice_letters_insert" on voice_letters;
create policy "voice_letters_insert" on voice_letters for insert
  with check (couple_id = current_couple_id() and author_id = auth.uid());

drop policy if exists "voice_letters_delete_self" on voice_letters;
create policy "voice_letters_delete_self" on voice_letters for delete
  using (author_id = auth.uid());

-- mood_checkins: own-write; partner-read only if share_with_partner = true
drop policy if exists "mood_select" on mood_checkins;
create policy "mood_select" on mood_checkins for select
  using (user_id = auth.uid() or (is_partner(user_id) and share_with_partner = true));

drop policy if exists "mood_write_self" on mood_checkins;
create policy "mood_write_self" on mood_checkins for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = current_couple_id());

-- love_language_logs: own-write; partner-read for pattern visibility
drop policy if exists "ll_select" on love_language_logs;
create policy "ll_select" on love_language_logs for select
  using (user_id = auth.uid() or is_partner(user_id));

drop policy if exists "ll_write_self" on love_language_logs;
create policy "ll_write_self" on love_language_logs for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and couple_id = current_couple_id());

-- vault_gifts: owner only. Partner can NEVER read.
drop policy if exists "vault_owner_only" on vault_gifts;
create policy "vault_owner_only" on vault_gifts for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- =============================================================================
-- Auto-create a profile row when a new auth user signs up.
-- =============================================================================

create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- Storage bucket for media (memories, voice letters, avatars)
-- Create via the dashboard or run:
--   insert into storage.buckets (id, name, public) values ('tether-media', 'tether-media', false) on conflict do nothing;
-- Then add storage policies so couple members can read each other's uploaded
-- files. For brevity in v1, we keep the bucket private and serve via signed URLs.
-- =============================================================================
insert into storage.buckets (id, name, public)
values ('tether-media', 'tether-media', false)
on conflict (id) do nothing;

drop policy if exists "storage_couple_read" on storage.objects;
create policy "storage_couple_read" on storage.objects for select to authenticated
  using (bucket_id = 'tether-media');

drop policy if exists "storage_couple_write" on storage.objects;
create policy "storage_couple_write" on storage.objects for insert to authenticated
  with check (bucket_id = 'tether-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "storage_owner_delete" on storage.objects;
create policy "storage_owner_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'tether-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- =============================================================================
-- Realtime: add tables to the supabase_realtime publication so the client can
-- subscribe to postgres_changes. Idempotent. RLS still governs which rows each
-- subscriber receives.
-- =============================================================================
do $$
declare t text;
begin
  foreach t in array array['nudges','journal_entries','mood_checkins'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- =============================================================================
-- Mood empathy loop: partner-visible "heavy day" signal (no score unless the
-- user opts in via profiles.prefs.mood_share_score).
-- =============================================================================
create table if not exists mood_signals (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  from_user uuid not null references auth.users(id) on delete cascade,
  on_date date not null,
  level text not null default 'low' check (level in ('low')),
  mood int check (mood between 1 and 5),
  created_at timestamptz not null default now(),
  unique (from_user, on_date)
);
create index if not exists mood_signals_couple_idx on mood_signals(couple_id, on_date desc);

alter table mood_signals enable row level security;

drop policy if exists "mood_signals_select_couple" on mood_signals;
create policy "mood_signals_select_couple" on mood_signals for select
  using (couple_id = current_couple_id());

drop policy if exists "mood_signals_write_self" on mood_signals;
create policy "mood_signals_write_self" on mood_signals for all
  using (from_user = auth.uid())
  with check (from_user = auth.uid() and couple_id = current_couple_id());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'mood_signals'
  ) then
    execute 'alter publication supabase_realtime add table public.mood_signals';
  end if;
end $$;

-- =============================================================================
-- Repair Log: 4-step guided reflection (trigger → feeling → need → repair).
-- ("trigger" is a reserved word, hence quoted.)
-- =============================================================================
create table if not exists repair_entries (
  id uuid primary key default gen_random_uuid(),
  couple_id uuid not null references couples(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  "trigger" text,
  feeling text,
  need text,
  repair text,
  created_at timestamptz not null default now()
);
create index if not exists repair_entries_couple_idx on repair_entries(couple_id, created_at desc);

alter table repair_entries enable row level security;

drop policy if exists "repair_entries_select_couple" on repair_entries;
create policy "repair_entries_select_couple" on repair_entries for select
  using (couple_id = current_couple_id());

drop policy if exists "repair_entries_write_self" on repair_entries;
create policy "repair_entries_write_self" on repair_entries for all
  using (couple_id = current_couple_id())
  with check (couple_id = current_couple_id() and author_id = auth.uid());

-- Couple-level accent theme (see src/lib/themes.ts).
alter table couples add column if not exists theme text not null default 'coral';

-- Realtime for optimistic collection boards (places, gratitudes, bucket_items, watchlist).
do $$
declare t text;
begin
  foreach t in array array['places','gratitudes','bucket_items','watchlist'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- Arrows puzzle progress (per user, comparable within the couple).
create table if not exists arrows_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  couple_id uuid not null references couples(id) on delete cascade,
  level int not null default 1,
  updated_at timestamptz not null default now()
);
alter table arrows_progress enable row level security;
drop policy if exists "arrows_select_couple" on arrows_progress;
create policy "arrows_select_couple" on arrows_progress for select using (couple_id = current_couple_id());
drop policy if exists "arrows_write_self" on arrows_progress;
create policy "arrows_write_self" on arrows_progress for all using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = current_couple_id());

-- Per-puzzle best results for Arrows (level bests + daily), comparable in-couple.
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
create policy "arrows_results_select_couple" on arrows_results for select using (couple_id = current_couple_id());
drop policy if exists "arrows_results_write_self" on arrows_results;
create policy "arrows_results_write_self" on arrows_results for all using (user_id = auth.uid()) with check (user_id = auth.uid() and couple_id = current_couple_id());

-- "Together" module (see migration 0011). Next-visit is couple-level; location +
-- daily rhythm + last-seen are per-user (self-write, partner-read). Covered by the
-- existing couples/profiles policies, so no new RLS here.
alter table couples add column if not exists next_visit_at timestamptz;
alter table couples add column if not exists next_visit_label text;
alter table couples add column if not exists next_visit_traveler text;
alter table profiles add column if not exists home_city text;
alter table profiles add column if not exists home_lat double precision;
alter table profiles add column if not exists home_lng double precision;
alter table profiles add column if not exists timezone text;
alter table profiles add column if not exists wake_hour int;
alter table profiles add column if not exists sleep_hour int;
alter table profiles add column if not exists work_start_hour int;
alter table profiles add column if not exists work_end_hour int;
alter table profiles add column if not exists last_active_at timestamptz;
