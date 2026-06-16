-- Realtime for the optimistic collection boards (so a partner's adds/edits/
-- deletes stream in live). Idempotent. Run in the Supabase SQL editor.
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
