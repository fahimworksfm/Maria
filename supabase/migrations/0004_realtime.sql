-- Enable Supabase Realtime on the tables the client subscribes to.
-- Run in the Supabase SQL editor. Idempotent. RLS still governs which rows each
-- subscriber receives over postgres_changes.

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
