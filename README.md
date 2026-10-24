# Portfolio + hidden admin panel (Cloudflare Workers, Python/Flask, D1)

## What this is

- **Frontend** — plain HTML/CSS/JS (no React, no build step). Lives in `/public`.
  Every piece of content (name, bio, skills, projects, experience, contact info)
  is loaded from the API at runtime. There's no placeholder/sample content —
  if you haven't added something in the admin panel yet, that section of the
  site just doesn't show up.
- **Backend** — a single Python **Flask** app (`src/worker.py`) deployed as a
  **Cloudflare Python Worker**. It serves both your API (`/api/...`) and your
  static frontend files, so it's one project, one deploy, one URL.
- **Database** — **Cloudflare D1** (SQLite), free tier. Schema is in `schema.sql`.
- **Images (optional)** — **Cloudflare R2**, free tier, for the admin panel's
  "upload an image" button. If you skip setting this up, the admin panel still
  works — you just paste an image URL instead of uploading a file.

Everything runs on Cloudflare's free plan. As of this writing that's roughly:
100,000 requests/day, D1: 5,000,000 row reads + 100,000 row writes per day and
5 GB storage, R2: 10 GB storage free. More than enough for a personal
portfolio — check Cloudflare's current pricing page if you want exact, up to
date numbers.

### A heads-up on how new this is

Cloudflare made **Python Workers generally available on September 21, 2026** —
including the ability to run Flask directly, with native D1/R2 access. That's
very recent, so if a command or a binding call in this project behaves
slightly differently than documented here, it's almost certainly a small
syntax drift, not a fundamental problem. If you hit something like that:

- Official Flask-on-Workers guide: https://developers.cloudflare.com/workers/languages/python/packages/flask/
- Official D1-from-Python guide: https://developers.cloudflare.com/d1/examples/query-d1-from-python-workers/
- A working reference app (Flask + D1, same shape as this project):
  `git clone https://github.com/cloudflare/python-workers-examples` then
  look in `flask-todo/`.

## How the admin page is "hidden"

Two separate things are going on, worth keeping straight:

1. **Hidden from casual browsing / search engines** — the admin panel lives at
   an unguessable path (`/admin-k2vn9f/` by default), it's not linked from
   anywhere on the public site, and `robots.txt` tells search engines not to
   index it.
2. **Actually protected** — that's the password login. The hidden URL on its
   own isn't real security (anyone who discovers the link could try it), so
   the admin API routes all check a signed, expiring session cookie, and the
   password is never stored in plain text.

**You should rename the admin folder** before you deploy — don't ship it as
`admin-k2vn9f`. Rename the `public/admin-k2vn9f/` folder to something only you
know, and update the path in `public/robots.txt` to match.

If you want a stronger layer on top of this later, Cloudflare Access
(part of Cloudflare Zero Trust, free for small teams) can put a second login
in front of the whole `/admin-.../` path at the network edge — worth looking
at once the basics are working.

## One-time setup

You can do all of this from a browser (Termux's or your phone's), via the
Cloudflare dashboard — no local Node/Python toolchain required.

### 1. Push this project to GitHub

Create a new repo and push everything in this folder to it (GitHub Mobile or
`git` in Termux both work fine for this).

### 2. Create the D1 database

Cloudflare dashboard → **Storage & Databases → D1** → **Create database** →
name it `portfolio-db`. Copy the **Database ID** it gives you, and paste it
into `wrangler.jsonc` in place of `REPLACE_WITH_YOUR_D1_DATABASE_ID`, then
commit/push that change.

### 3. Load the schema

Still in the D1 database's dashboard page, use its **Console / query runner**
to paste in and run the contents of `schema.sql` from this project. This
creates the tables — no sample data, just structure plus one empty profile
row.

### 4. (Optional) Create the R2 bucket for image uploads

Dashboard → **R2** → **Create bucket** → name it `portfolio-media`. If you'd
rather skip this, delete the `r2_buckets` block from `wrangler.jsonc` — the
admin panel's "paste an image URL" field still works without it.

### 5. Generate your admin password hash

Your real password is never stored anywhere — only a one-way hash of it.
On Termux:

```bash
pkg install python -y
pip install werkzeug --break-system-packages
python scripts/generate_password_hash.py
```

Follow the prompts; it prints a hash string. Copy that whole string.

### 6. Connect the repo to Cloudflare Workers

Dashboard → **Workers & Pages** → **Create** → **Import a Git repository** →
pick your repo. Cloudflare should detect `wrangler.jsonc` and `pyproject.toml`
and configure it as a Python Worker automatically. If it asks you to confirm
a deploy command, use:

```
uv run pywrangler deploy
```

### 7. Set your secrets

In the project's **Settings → Variables and Secrets**, add two secrets:

- `ADMIN_PASSWORD_HASH` — paste the hash string from step 5.
- `SESSION_SECRET` — any long random string (used to sign login sessions).
  You can generate one at the same time with:
  `python -c "import secrets; print(secrets.token_hex(32))"`

### 8. Bind D1 (and R2, if used)

If the Git-connected build didn't already pick up the bindings from
`wrangler.jsonc`, add them manually under the project's **Settings →
Bindings**: a D1 binding named `DB` pointing at `portfolio-db`, and (if used)
an R2 binding named `MEDIA` pointing at `portfolio-media`.

### 9. Deploy and add your content

Trigger a deploy (push a commit, or use the dashboard's deploy button), then
visit `https://<your-worker>.workers.dev`. You'll see an empty page — that's
expected. Go to `/your-renamed-admin-path/`, log in with your password, and
fill in your profile, skills, projects and experience. The public site
updates immediately as you save each section.

### 10. Point your own domain at it (optional)

Dashboard → your Worker → **Settings → Domains & Routes → Add custom domain**,
if you have a domain on Cloudflare.

## Prefer the command line?

If you'd rather deploy from a terminal (Termux can run Node.js and `uv` if
you install them, though native-tool compatibility on Termux can be spotty):

```bash
pkg install nodejs -y
curl -LsSf https://astral.sh/uv/install.sh | sh
uv run pywrangler deploy
```

`uv run pywrangler dev` runs a local dev server if you want to test before
deploying.

## A couple of things worth doing once it's live

- **Rate-limit the login route.** This project doesn't implement custom
  brute-force protection in code. Add a Cloudflare **Rate Limiting Rule**
  (dashboard → Security → WAF) on `/api/admin/login` — a few requests per
  minute per IP is plenty for a one-person admin panel.
- **Keep the admin path to yourself.** Don't link it anywhere, don't put it
  in a public commit message, etc.

## Project structure

```
wrangler.jsonc          Worker config: D1/R2 bindings, static assets
pyproject.toml          Python dependencies (Flask)
schema.sql              D1 table definitions (run once)
src/worker.py           Flask app — all routes
public/                 Static frontend
  index.html, css/, js/   the public portfolio
  admin-k2vn9f/           the hidden admin panel — RENAME THIS FOLDER
  robots.txt              keep in sync with the admin folder name
scripts/generate_password_hash.py   run once to create ADMIN_PASSWORD_HASH
```
