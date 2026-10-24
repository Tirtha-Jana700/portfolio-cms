-- Run this once against your D1 database before your first deploy:
--   wrangler d1 execute portfolio-db --remote --file schema.sql
--
-- Nothing here is sample/mock content — it's just table structure, plus one
-- empty profile row that your admin panel fills in. The site shows nothing
-- until you add it yourself.

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  full_name TEXT DEFAULT '',
  title TEXT DEFAULT '',
  tagline TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  resume_url TEXT DEFAULT '',
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  location TEXT DEFAULT '',
  github_url TEXT DEFAULT '',
  linkedin_url TEXT DEFAULT '',
  twitter_url TEXT DEFAULT '',
  instagram_url TEXT DEFAULT '',
  youtube_url TEXT DEFAULT '',
  updated_at TEXT
);

INSERT OR IGNORE INTO profile (id) VALUES (1);

CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  level INTEGER DEFAULT 80,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  tech_stack TEXT DEFAULT '',
  live_url TEXT DEFAULT '',
  repo_url TEXT DEFAULT '',
  featured INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT DEFAULT 'work',           -- 'work' or 'education'
  role TEXT NOT NULL,
  organization TEXT DEFAULT '',
  start_date TEXT DEFAULT '',
  end_date TEXT DEFAULT '',
  description TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0
);
