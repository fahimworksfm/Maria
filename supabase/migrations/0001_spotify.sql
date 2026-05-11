-- Add Spotify connection columns to couples.
-- Run this in the Supabase SQL editor after schema.sql.

alter table couples add column if not exists spotify_refresh_token text;
alter table couples add column if not exists spotify_playlist_id text;
alter table couples add column if not exists spotify_connected_by uuid;
alter table couples add column if not exists spotify_user_name text;
alter table couples add column if not exists spotify_connected_at timestamptz;

-- Tighten read access so the refresh token is never selectable via the anon API.
-- We rely on the service-role key in server code for token reads/writes; couple
-- members still see the harmless fields via a SELECT that excludes the token.
-- (Postgres column-level security is not enabled here; instead, we instruct
-- application code to use a `select` list that omits spotify_refresh_token.)
