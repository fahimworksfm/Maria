-- Couple-level accent theme. Run in the Supabase SQL editor. Idempotent.
alter table couples add column if not exists theme text not null default 'coral';
