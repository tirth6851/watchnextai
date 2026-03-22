-- WatchNextAI – Supabase schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- It is safe to re-run: existing rows are preserved, only missing tables/columns are added.

-- ── watchlist ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watchlist (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    integer     NOT NULL,
    media_type  text        NOT NULL,   -- 'movie' | 'tv' | 'anime'
    title       text,
    poster_path text,
    created_at  timestamptz DEFAULT now()
);

-- unique: one entry per user + media item
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_media
    ON watchlist (user_id, media_id, media_type);

-- ── watched ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS watched (
    id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id    integer     NOT NULL,
    media_type  text        NOT NULL,   -- 'movie' | 'tv' | 'anime'
    title       text,
    poster_path text,
    rating      integer,
    created_at  timestamptz DEFAULT now()
);

-- Add poster_path to watched if upgrading an existing database
ALTER TABLE watched ADD COLUMN IF NOT EXISTS poster_path text;

CREATE UNIQUE INDEX IF NOT EXISTS watched_user_media
    ON watched (user_id, media_id, media_type);

-- ── watching ────────────────────────────────────────────────────────────────
-- Tracks shows/anime a user is currently watching with episode progress
CREATE TABLE IF NOT EXISTS watching (
    id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    media_id        integer     NOT NULL,
    media_type      text        NOT NULL,   -- 'tv' | 'anime'
    title           text,
    poster_path     text,
    current_season  integer     DEFAULT 1,
    current_episode integer     DEFAULT 1,
    rating          integer,                -- enjoyment so far (1-5)
    created_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS watching_user_media
    ON watching (user_id, media_id, media_type);

-- ── Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE watched   ENABLE ROW LEVEL SECURITY;

-- Drop old policies before recreating (avoids "already exists" errors)
DROP POLICY IF EXISTS "watchlist_select" ON watchlist;
DROP POLICY IF EXISTS "watchlist_insert" ON watchlist;
DROP POLICY IF EXISTS "watchlist_delete" ON watchlist;
DROP POLICY IF EXISTS "watched_select"   ON watched;
DROP POLICY IF EXISTS "watched_insert"   ON watched;
DROP POLICY IF EXISTS "watched_delete"   ON watched;

CREATE POLICY "watchlist_select" ON watchlist FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watchlist_insert" ON watchlist FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watchlist_delete" ON watchlist FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "watched_select"   ON watched   FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watched_insert"   ON watched   FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watched_delete"   ON watched   FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE watching ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "watching_select" ON watching;
DROP POLICY IF EXISTS "watching_insert" ON watching;
DROP POLICY IF EXISTS "watching_update" ON watching;
DROP POLICY IF EXISTS "watching_delete" ON watching;

CREATE POLICY "watching_select" ON watching FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "watching_insert" ON watching FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "watching_update" ON watching FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "watching_delete" ON watching FOR DELETE USING (auth.uid() = user_id);
