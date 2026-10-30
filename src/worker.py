import json
import time
import base64
from datetime import datetime, timezone
from urllib.parse import urlparse

from js import Response, Headers
from pyodide.ffi import to_js

MAX_LOGIN_ATTEMPTS = 5
LOCKOUT_SECONDS = 900
TOKEN_TTL_SECONDS = 86400
STORY_TTL_SECONDS = 86400

def json_response(payload, status=200):
    headers = Headers.new()
    headers.append("Content-Type", "application/json; charset=utf-8")
    headers.append("Cache-Control", "no-store")
    headers.append("Access-Control-Allow-Origin", "*")
    headers.append("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
    headers.append("Access-Control-Allow-Headers", "Content-Type, Authorization")
    
    init = to_js({"status": status, "headers": headers})
    return Response.new(json.dumps(payload), init)

def to_py_dict(row):
    if row is None:
        return None
    if hasattr(row, "to_py"):
        return row.to_py()
    return dict(row)

async def d1_all(db, sql, params=None):
    stmt = db.prepare(sql)
    if params:
        stmt = stmt.bind(*params)
    res = await stmt.all()
    results = res.results.to_py() if hasattr(res.results, "to_py") else list(res.results)
    return [dict(r) for r in results]

async def d1_first(db, sql, params=None):
    rows = await d1_all(db, sql, params)
    return rows[0] if rows else None

async def d1_run(db, sql, params=None):
    stmt = db.prepare(sql)
    if params:
        stmt = stmt.bind(*params)
    return await stmt.run()

def get_admin_secret(env):
    secret = getattr(env, "ADMIN_PASSWORD", None)
    if secret and str(secret).strip():
        return str(secret).strip()
    return "admin123"

def create_token(secret):
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    raw = f"{exp}.{secret}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8")

def verify_token(request, secret):
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.startswith("Bearer "):
        return False
    token = auth_header.split(" ", 1)[1].strip()
    try:
        decoded = base64.urlsafe_b64decode(token.encode("utf-8")).decode("utf-8")
        exp_str, token_secret = decoded.split(".", 1)
        exp = int(exp_str)
        if time.time() > exp:
            return False
        return token_secret == secret
    except Exception:
        return False

def iso_now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

async def fetch(request, env):
    url_Info = urlparse(request.url)
    path = url_Info.path
    method = request.method.upper()

    if method == "OPTIONS":
        return json_response({"ok": True}, status=200)

    db = getattr(env, "DB", None)

    if path == "/api/portfolio" and method == "GET":
        if db is None:
            return json_response({"error": "D1 database binding 'DB' is missing."}, status=500)

        profile = await d1_first(db, "SELECT * FROM profile WHERE id = 1") or {}
        skills = await d1_all(db, "SELECT * FROM skills ORDER BY sort_order ASC, id ASC")
        projects = await d1_all(db, "SELECT * FROM projects ORDER BY starred DESC, sort_order ASC, id DESC")
        experience = await d1_all(db, "SELECT * FROM experience ORDER BY sort_order ASC, id DESC")

        cutoff_iso = datetime.fromtimestamp(time.time() - STORY_TTL_SECONDS, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        await d1_run(db, "DELETE FROM stories WHERE created_at < ?", [cutoff_iso])
        stories = await d1_all(db, "SELECT * FROM stories WHERE created_at >= ? ORDER BY created_at ASC", [cutoff_iso])

        return json_response({
            "profile": profile,
            "skills": skills,
            "projects": projects,
            "experience": experience,
            "stories": stories
        })

    if path == "/api/admin/login" and method == "POST":
        if db is None:
            return json_response({"error": "Database not bound"}, status=500)

        client_ip = request.headers.get("CF-Connecting-IP") or "local"
        now_ts = int(time.time())
        attempt_row = await d1_first(db, "SELECT * FROM login_attempts WHERE ip = ?", [client_ip])

        if attempt_row:
            attempts = int(attempt_row.get("attempts") or 0)
            last_attempt = int(attempt_row.get("last_attempt") or 0)
            if attempts >= MAX_LOGIN_ATTEMPTS and (now_ts - last_attempt) < LOCKOUT_SECONDS:
                wait_min = max(1, (LOCKOUT_SECONDS - (now_ts - last_attempt)) // 60)
                return json_response({"error": f"Too many failed attempts. Try again in {wait_min} min."}, status=429)
            elif (now_ts - last_attempt) >= LOCKOUT_SECONDS:
                await d1_run(db, "UPDATE login_attempts SET attempts = 0, last_attempt = ? WHERE ip = ?", [now_ts, client_ip])
                attempts = 0
        else:
            attempts = 0

        body_text = await request.text()
        body = json.loads(body_text or "{}")
        password = str(body.get("password") or "")
        secret = get_admin_secret(env)

        if password == secret:
            await d1_run(db, "DELETE FROM login_attempts WHERE ip = ?", [client_ip])
            token = create_token(secret)
            return json_response({"ok": True, "token": token})
        else:
            new_attempts = attempts + 1
            await d1_run(
                db,
                "INSERT INTO login_attempts (ip, attempts, last_attempt) VALUES (?, ?, ?) ON CONFLICT(ip) DO UPDATE SET attempts = excluded.attempts, last_attempt = excluded.last_attempt",
                [client_ip, new_attempts, now_ts]
            )
            remaining = max(0, MAX_LOGIN_ATTEMPTS - new_attempts)
            return json_response({"error": f"Invalid password. {remaining} attempts remaining."}, status=401)

    if path.startswith("/api/admin/"):
        secret = get_admin_secret(env)
        if not verify_token(request, secret):
            return json_response({"error": "Unauthorized"}, status=401)

        if path == "/api/admin/upload" and method == "POST":
            form_data = await request.formData()
            file_obj = form_data.get("file")
            if not file_obj:
                return json_response({"error": "No file provided"}, status=400)
            content_type = getattr(file_obj, "type", "") or "application/octet-stream"
            array_buf = await file_obj.arrayBuffer()
            raw_bytes = bytes(array_buf.to_py())
            b64_data = base64.b64encode(raw_bytes).decode("ascii")
            data_url = f"data:{content_type};base64,{b64_data}"
            return json_response({"ok": True, "url": data_url})

        body = {}
        if method in ("POST", "PUT"):
            raw_text = await request.text()
            body = json.loads(raw_text or "{}")

        if path == "/api/admin/profile" and method == "PUT":
            await d1_run(db, """
                INSERT INTO profile (
                  id, full_name, title, tagline, bio, avatar_url, resume_url,
                  email, phone, location, github_url, linkedin_url,
                  twitter_url, instagram_url, youtube_url, updated_at
                ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                  full_name = excluded.full_name, title = excluded.title, tagline = excluded.tagline,
                  bio = excluded.bio, avatar_url = excluded.avatar_url, resume_url = excluded.resume_url,
                  email = excluded.email, phone = excluded.phone, location = excluded.location,
                  github_url = excluded.github_url, linkedin_url = excluded.linkedin_url,
                  twitter_url = excluded.twitter_url, instagram_url = excluded.instagram_url,
                  youtube_url = excluded.youtube_url, updated_at = excluded.updated_at
            """, [
                body.get("full_name", ""), body.get("title", ""), body.get("tagline", ""), body.get("bio", ""),
                body.get("avatar_url", ""), body.get("resume_url", ""), body.get("email", ""), body.get("phone", ""),
                body.get("location", ""), body.get("github_url", ""), body.get("linkedin_url", ""),
                body.get("twitter_url", ""), body.get("instagram_url", ""), body.get("youtube_url", ""), iso_now()
            ])
            return json_response({"ok": True})

        if path == "/api/admin/stories" and method == "POST":
            await d1_run(db, "INSERT INTO stories (media_url, created_at, caption) VALUES (?, ?, ?)", [str(body.get("media_url") or "").strip(), iso_now(), str(body.get("caption") or "").strip()])
            return json_response({"ok": True})

        if path.startswith("/api/admin/stories/") and method == "DELETE":
            await d1_run(db, "DELETE FROM stories WHERE id = ?", [path.rsplit("/", 1)[-1]])
            return json_response({"ok": True})

        if path == "/api/admin/projects" and method == "POST":
            await d1_run(db, """
                INSERT INTO projects (title, description, image_url, tech_stack, live_url, repo_url, starred, sort_order, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, [
                body.get("title", ""), body.get("description", ""), body.get("image_url", ""), body.get("tech_stack", ""),
                body.get("live_url", ""), body.get("repo_url", ""), 1 if int(body.get("starred") or 0) == 1 else 0,
                int(body.get("sort_order") or 0), iso_now()
            ])
            return json_response({"ok": True})

        if path.startswith("/api/admin/projects/"):
            proj_id = path.rsplit("/", 1)[-1]
            if method == "PUT":
                await d1_run(db, """
                    UPDATE projects SET title = ?, description = ?, image_url = ?, tech_stack = ?,
                    live_url = ?, repo_url = ?, starred = ?, sort_order = ? WHERE id = ?
                """, [
                    body.get("title", ""), body.get("description", ""), body.get("image_url", ""), body.get("tech_stack", ""),
                    body.get("live_url", ""), body.get("repo_url", ""), 1 if int(body.get("starred") or 0) == 1 else 0,
                    int(body.get("sort_order") or 0), proj_id
                ])
                return json_response({"ok": True})
            if method == "DELETE":
                await d1_run(db, "DELETE FROM projects WHERE id = ?", [proj_id])
                return json_response({"ok": True})

        if path == "/api/admin/skills" and method == "POST":
            await d1_run(db, "INSERT INTO skills (name, category, level, sort_order) VALUES (?, ?, ?, ?)", [body.get("name", ""), body.get("category", ""), int(body.get("level") or 80), int(body.get("sort_order") or 0)])
            return json_response({"ok": True})

        if path.startswith("/api/admin/skills/"):
            skill_id = path.rsplit("/", 1)[-1]
            if method == "PUT":
                await d1_run(db, "UPDATE skills SET name = ?, category = ?, level = ?, sort_order = ? WHERE id = ?", [body.get("name", ""), body.get("category", ""), int(body.get("level") or 80), int(body.get("sort_order") or 0), skill_id])
                return json_response({"ok": True})
            if method == "DELETE":
                await d1_run(db, "DELETE FROM skills WHERE id = ?", [skill_id])
                return json_response({"ok": True})

        if path == "/api/admin/experience" and method == "POST":
            await d1_run(db, "INSERT INTO experience (type, role, organization, start_date, end_date, description, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)", [
                body.get("type", "work"), body.get("role", ""), body.get("organization", ""), body.get("start_date", ""),
                body.get("end_date", ""), body.get("description", ""), int(body.get("sort_order") or 0)
            ])
            return json_response({"ok": True})

        if path.startswith("/api/admin/experience/"):
            exp_id = path.rsplit("/", 1)[-1]
            if method == "PUT":
                await d1_run(db, "UPDATE experience SET type = ?, role = ?, organization = ?, start_date = ?, end_date = ?, description = ?, sort_order = ? WHERE id = ?", [
                    body.get("type", "work"), body.get("role", ""), body.get("organization", ""), body.get("start_date", ""),
                    body.get("end_date", ""), body.get("description", ""), int(body.get("sort_order") or 0), exp_id
                ])
                return json_response({"ok": True})
            if method == "DELETE":
                await d1_run(db, "DELETE FROM experience WHERE id = ?", [exp_id])
                return json_response({"ok": True})

    assets = getattr(env, "ASSETS", None)
    if assets is not None:
        return await assets.fetch(request)

    return json_response({"error": "Not found"}, status=404)
