-- TMDb metadata for watchlist rows. All optional: manually added titles keep
-- working with these left null.
alter table watchlist add column if not exists tmdb_id int;
alter table watchlist add column if not exists poster_path text;
alter table watchlist add column if not exists year int;
alter table watchlist add column if not exists overview text;
