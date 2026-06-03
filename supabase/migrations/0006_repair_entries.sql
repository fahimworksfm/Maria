-- Repair Log rebuilt as a 4-step guided reflection: trigger → feeling → need →
-- one small repair. Run in the Supabase SQL editor. Idempotent.
-- ("trigger" is a reserved word, so the column is quoted.)

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
