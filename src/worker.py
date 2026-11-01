"""
===============================================================================
Portfolio Backend — Flask app on Cloudflare Python Workers
===============================================================================
"""

import json
import time
import hashlib
import uuid
from datetime import datetime, timezone, timedelta

from flask import Flask, request, Response, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from pyodide.ffi import run_sync
from workers import wsgi

app = Flask(__name__)

SESSION_MAX_AGE = 60 * 60 * 24  # 24 hours

# -----------------------------------------------------------------------------
# Cloudflare D1 & Environment Helpers
# -----------------------------------------------------------------------------
def env():
    return request.environ["workers.env"]

def to_py(obj):
    if obj is None:
        return None
    if hasattr(obj, "to_py"):
        try:
            return obj.to_py()
        except Exception:
            pass
    return obj

def d1_all(sql, params=None):
    stmt = env().DB.prepare(sql)
    if params:
        stmt = stmt.bind(*params)
    result = to_py(run_sync(stmt.all()))
    rows = result.get("results", result) if isinstance(result, dict) else result
    return rows or []

def d1_first(sql, params=None):
    stmt = env().DB.prepare(sql)
    if params:
        stmt = stmt.bind(*params)
    result = run_sync(stmt.first())
    return to_py(result)

def d1_run(sql, params=None):
    stmt = env().DB.prepare(sql)
    if params:
        stmt = stmt.bind(*params)
    return to_py(run_sync(stmt.run()))

def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

# -----------------------------------------------------------------------------
# Authentication (Bearer Token via itsdangerous)
# -----------------------------------------------------------------------------
def get_admin_secret():
    secret = getattr(env(), "ADMIN_PASSWORD", None)
    if secret and str(secret).strip():
        return str(secret).strip()
    return "admin123"  # Fallback for local testing

def serializer():
    return URLSafeTimedSerializer(get_admin_secret())

def is_authenticated():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return False
    token = auth_header.split(" ", 1)[1].strip()
    try:
        data = serializer().loads(token, max_age=SESSION_MAX_AGE)
        return data.get("adm") is True
    except (BadSignature, SignatureExpired):
        return False

def admin_required(fn):
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return jsonify({"ok": True}), 200
        if not is_authenticated():
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper

@app.post("/api/admin/login")
def admin_login():
    body = request.get_json(silent=True) or {}
    password = body.get("password", "")
    secret = get_admin_secret()
    
    if password == secret:
        token = serializer().dumps({"adm": True})
        return jsonify({"ok": True, "token": token})
    return jsonify({"error": "Incorrect password"}), 401

@app.post("/api/admin/logout")
def admin_logout():
    return jsonify({"ok": True})

# -----------------------------------------------------------------------------
# 1. Public Portfolio Endpoint
# -----------------------------------------------------------------------------
@app.get("/api/portfolio")
def get_portfolio():
    profile = d1_first("SELECT * FROM profile WHERE id = 1") or {}
    skills = d1_all("SELECT * FROM skills ORDER BY sort_order ASC, id ASC")
    projects = d1_all("SELECT * FROM projects ORDER BY starred DESC, sort_order ASC, id DESC")
    experience = d1_all("SELECT * FROM experience ORDER BY sort_order ASC, id ASC")
    
    # 24-Hour Story Filtering
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).strftime("%Y-%m-%dT%H:%M:%SZ")
    d1_run("DELETE FROM stories WHERE created_at < ?", [cutoff])
    stories = d1_all("SELECT * FROM stories WHERE created_at >= ? ORDER BY created_at ASC", [cutoff])

    return jsonify({
        "profile": profile,
        "skills": skills,
        "projects": projects,
        "experience": experience,
        "stories": stories,
    })

# -----------------------------------------------------------------------------
# 2. Admin Profile CRUD
# -----------------------------------------------------------------------------
PROFILE_FIELDS = [
    "full_name", "title", "tagline", "bio", "avatar_url", "resume_url",
    "email", "phone", "location", "github_url", "linkedin_url",
    "twitter_url", "instagram_url", "youtube_url",
]

@app.put("/api/admin/profile")
@admin_required
def update_profile():
    body = request.get_json(silent=True) or {}
    sets, params = [], []
    for field in PROFILE_FIELDS:
        if field in body:
            sets.append(f"{field} = ?")
            params.append(str(body[field]))
    if not sets:
        return jsonify({"error": "No fields provided"}), 400
    sets.append("updated_at = ?")
    params.append(now_iso())
    d1_run(f"UPDATE profile SET {', '.join(sets)} WHERE id = 1", params)
    return jsonify({"ok": True})

# -----------------------------------------------------------------------------
# 3. Dynamic Admin CRUD Factory
# -----------------------------------------------------------------------------
def make_crud(table, allowed_fields, required_field, order_sql):
    def list_items():
        return jsonify(d1_all(f"SELECT * FROM {table} ORDER BY {order_sql}"))
    list_items.__name__ = f"{table}_list_items"

    def create_item():
        body = request.get_json(silent=True) or {}
        if not body.get(required_field):
            return jsonify({"error": f"'{required_field}' is required"}), 400
        
        fields = [f for f in allowed_fields if f in body]
        if table == "projects":
            fields.append("created_at")
            body["created_at"] = now_iso()
            
        cols = ", ".join(fields)
        placeholders = ", ".join(["?"] * len(fields))
        params = [body.get(f) for f in fields]
        
        d1_run(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", params)
        return jsonify({"ok": True}), 201
    create_item.__name__ = f"{table}_create_item"

    def update_item(item_id):
        body = request.get_json(silent=True) or {}
        fields = [f for f in allowed_fields if f in body]
        if not fields:
            return jsonify({"error": "No fields provided"}), 400
            
        sets = ", ".join(f"{f} = ?" for f in fields)
        params = [body.get(f) for f in fields] + [item_id]
        
        d1_run(f"UPDATE {table} SET {sets} WHERE id = ?", params)
        return jsonify({"ok": True})
    update_item.__name__ = f"{table}_update_item"

    def delete_item(item_id):
        d1_run(f"DELETE FROM {table} WHERE id = ?", [item_id])
        return jsonify({"ok": True})
    delete_item.__name__ = f"{table}_delete_item"

    return (
        admin_required(list_items),
        admin_required(create_item),
        admin_required(update_item),
        admin_required(delete_item),
    )

# Map CRUD routes
skills_list, skills_create, skills_update, skills_delete = make_crud(
    "skills", ["name", "category", "level", "sort_order"], "name", "sort_order ASC, id ASC"
)
app.get("/api/admin/skills")(skills_list)
app.post("/api/admin/skills")(skills_create)
app.put("/api/admin/skills/<int:item_id>")(skills_update)
app.delete("/api/admin/skills/<int:item_id>")(skills_delete)

projects_list, projects_create, projects_update, projects_delete = make_crud(
    "projects",
    ["title", "description", "image_url", "tech_stack", "live_url", "repo_url", "starred", "sort_order"],
    "title", "starred DESC, sort_order ASC",
)
app.get("/api/admin/projects")(projects_list)
app.post("/api/admin/projects")(projects_create)
app.put("/api/admin/projects/<int:item_id>")(projects_update)
app.delete("/api/admin/projects/<int:item_id>")(projects_delete)

experience_list, experience_create, experience_update, experience_delete = make_crud(
    "experience",
    ["type", "role", "organization", "start_date", "end_date", "description", "sort_order"],
    "role", "sort_order ASC, id ASC",
)
app.get("/api/admin/experience")(experience_list)
app.post("/api/admin/experience")(experience_create)
app.put("/api/admin/experience/<int:item_id>")(experience_update)
app.delete("/api/admin/experience/<int:item_id>")(experience_delete)

# -----------------------------------------------------------------------------
# 4. Stories & Media Uploads (R2)
# -----------------------------------------------------------------------------
@app.post("/api/admin/stories")
@admin_required
def admin_create_story():
    body = request.get_json(silent=True) or {}
    media_url = body.get("media_url")
    caption = body.get("caption", "")
    if not media_url:
        return jsonify({"error": "media_url is required"}), 400
    d1_run("INSERT INTO stories (media_url, caption, created_at) VALUES (?, ?, ?)", [media_url, caption, now_iso()])
    return jsonify({"ok": True}), 201

@app.delete("/api/admin/stories/<int:story_id>")
@admin_required
def admin_delete_story(story_id):
    d1_run("DELETE FROM stories WHERE id = ?", [story_id])
    return jsonify({"ok": True})

def get_bucket():
    e = env()
    return getattr(e, "MEDIA", None) or getattr(e, "BUCKET", None)

@app.post("/api/admin/upload")
@admin_required
def upload_image():
    bucket = get_bucket()
    if bucket is None:
        return jsonify({"error": "R2 bucket binding not found."}), 501
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400
    try:
        ext = ""
        if "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[1].lower()
        key = f"{uuid.uuid4().hex}{ext}"
        data = file.read()
        run_sync(bucket.put(key, data, {"httpMetadata": {"contentType": file.mimetype or "application/octet-stream"}}))
        return jsonify({"url": f"/media/{key}"}), 201
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@app.get("/media/<path:key>")
def serve_media(key):
    bucket = get_bucket()
    if bucket is None:
        return Response("Not found", status=404)
    try:
        obj = run_sync(bucket.get(key))
        if obj is None:
            return Response("Not found", status=404)
        try:
            body = bytes(run_sync(obj.arrayBuffer()))
        except Exception:
            body = run_sync(obj.bytes())
        
        content_type = "application/octet-stream"
        try:
            http_meta = to_py(obj.httpMetadata)
            if http_meta and http_meta.get("contentType"):
                content_type = http_meta["contentType"]
        except Exception:
            pass
        return Response(body, content_type=content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})
    except Exception as e:
        return Response(f"Error serving media: {str(e)}", status=500)

# -----------------------------------------------------------------------------
# 5. Static Asset Serving & App Entrypoint
# -----------------------------------------------------------------------------
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.get("/")
@app.get("/<path:path>")
def frontend(path=""):
    assets = env().ASSETS
    asset_response = run_sync(assets.fetch(f"https://assets.local/{path}"))
    body = run_sync(asset_response.bytes())
    return Response(body, status=asset_response.status, headers=asset_response.headers)

# Resolves Code 10030 by correctly binding the WSGI app for pywrangler
Default = wsgi.entrypoint(app)
