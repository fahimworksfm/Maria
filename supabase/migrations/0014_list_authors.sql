-- Who added each item on the shared lists, so the app can show yours on one
-- side and your partner's on the other. Run in the Supabase SQL editor.
-- Idempotent. Existing rows keep a null author and render as neutral.
alter table bucket_items  add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table watchlist     add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table places        add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table songs         add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table travel_pins   add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table recipes       add column if not exists author_id uuid references auth.users(id) on delete set null;
alter table anniversaries add column if not exists author_id uuid references auth.users(id) on delete set null;

-- Make PostgREST pick the new columns up straight away.
notify pgrst, 'reload schema';
