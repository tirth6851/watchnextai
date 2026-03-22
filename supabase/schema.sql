-- WatchNextAI – Supabase schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)

-- 1. Clean slate (safe if tables don't exist yet)
DROP TABLE IF EXISTS watching  CASCADE;
DROP TABLE IF EXISTS watched   CASCADE;
DROP TABLE IF EXISTS watchlist CASCADE;

-- 2. watchlist
CREATE TABLE watchlist (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    integer     NOT NULL,
    media_type  text        NOT NULL,
    title       text,
    poster_path text,
    created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX watchlist_user_media ON watchlist (user_id, media_id, media_type);

-- 3. watched
CREATE TABLE watched (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    integer     NOT NULL,
    media_type  text        NOT NULL,
    title       text,
    poster_path text,
    rating      integer,
    created_at  timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX watched_user_media ON watched (user_id, media_id, media_type);

-- 4. watching (episode progress tracker)
CREATE TABLE watching (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id        integer     NOT NULL,
    media_type      text        NOT NULL,
    title           text,
    poster_path     text,
    current_season  integer     DEFAULT 1,
    current_episode integer     DEFAULT 1,
    rating          integer,
    created_at      timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX watching_user_media ON watching (user_id, media_id, media_type);

-- 5. Row Level Security
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched   ENABLE ROW LEVEL SECURITY;
ALTER TABLE watching  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "watchlist_select" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_insert" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_delete" ON watchlist FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "watched_select"   ON watched   FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watched_insert"   ON watched   FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watched_delete"   ON watched   FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "watching_select"  ON watching  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watching_insert"  ON watching  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watching_update"  ON watching  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watching_delete"  ON watching  FOR DELETE USING (auth.uid() = user_id);
