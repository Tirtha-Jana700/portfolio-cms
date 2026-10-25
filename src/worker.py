"""
Portfolio backend — Flask app running on Cloudflare Python Workers.
"""

import json
import time
import hashlib
from datetime import datetime, timezone

from flask import Flask, request, Response, jsonify
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from pyodide.ffi import run_sync
from workers import wsgi

app = Flask(__name__)

SESSION_MAX_AGE = 60 * 60 * 24 * 7  # 7 days
ADMIN_COOKIE = "session_token"


# ---------------------------------------------------------------------------
# env / D1 / R2 helpers
# ---------------------------------------------------------------------------

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
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Admin auth & Pure-Python Hashing
# ---------------------------------------------------------------------------

def custom_check_password(stored_hash, password):
    """Pure Python SHA-256 verification compatible with Pyodide runtime."""
    try:
        salt, pwd_hash = stored_hash.split("$")
        computed = hashlib.sha256((salt + password).encode("utf-8")).hexdigest()
        return computed == pwd_hash
    except Exception:
        return False


def serializer():
    secret = getattr(env(), "SESSION_SECRET", None) or "dev-insecure-secret-change-me"
    return URLSafeTimedSerializer(secret)


def is_authenticated():
    token = request.cookies.get(ADMIN_COOKIE)
    if not token:
        return False
    try:
        data = serializer().loads(token, max_age=SESSION_MAX_AGE)
        return data.get("adm") is True
    except (BadSignature, SignatureExpired):
        return False


def admin_required(fn):
    def wrapper(*args, **kwargs):
        if not is_authenticated():
            return jsonify({"error": "Not authenticated"}), 401
        return fn(*args, **kwargs)
    wrapper.__name__ = fn.__name__
    return wrapper


def cookie_is_secure():
    host = request.host.split(":")[0]
    return host not in ("localhost", "127.0.0.1")


@app.post("/api/admin/login")
def admin_login():
    body = request.get_json(silent=True) or {}
    password = body.get("password", "")

    stored_hash = getattr(env(), "ADMIN_PASSWORD_HASH", None)
    if not stored_hash:
        return jsonify({"error": "Admin password is not configured on the server yet."}), 500

    if not password or not custom_check_password(stored_hash, password):
        return jsonify({"error": "Incorrect password"}), 401

    token = serializer().dumps({"adm": True})
    resp = jsonify({"ok": True})
    resp.set_cookie(
        ADMIN_COOKIE,
        token,
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=cookie_is_secure(),
        samesite="Strict",
        path="/api/admin",
    )
    return resp


@app.post("/api/admin/logout")
def admin_logout():
    resp = jsonify({"ok": True})
    resp.delete_cookie(ADMIN_COOKIE, path="/api/admin")
    return resp


@app.get("/api/admin/session")
def admin_session():
    return jsonify({"authenticated": is_authenticated()})


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

@app.get("/api/portfolio")
def get_portfolio():
    profile = d1_first("SELECT * FROM profile WHERE id = 1") or {}
    skills = d1_all("SELECT * FROM skills ORDER BY sort_order ASC, id ASC")
    projects = d1_all("SELECT * FROM projects ORDER BY sort_order ASC, id DESC")
    experience = d1_all("SELECT * FROM experience ORDER BY sort_order ASC, id ASC")
    return jsonify({
        "profile": profile,
        "skills": skills,
        "projects": projects,
        "experience": experience,
    })


# ---------------------------------------------------------------------------
# Admin: profile & CRUD with safe unique endpoints
# ---------------------------------------------------------------------------

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
    return jsonify(d1_first("SELECT * FROM profile WHERE id = 1"))


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
            body = dict(body)
            body["created_at"] = now_iso()
        cols = ", ".join(fields)
        placeholders = ", ".join(["?"] * len(fields))
        params = [body.get(f) for f in fields]
        d1_run(f"INSERT INTO {table} ({cols}) VALUES ({placeholders})", params)
        row = d1_first(f"SELECT * FROM {table} ORDER BY id DESC LIMIT 1")
        return jsonify(row), 201
    create_item.__name__ = f"{table}_create_item"

    def update_item(item_id):
        body = request.get_json(silent=True) or {}
        fields = [f for f in allowed_fields if f in body]
        if not fields:
            return jsonify({"error": "No fields provided"}), 400
        sets = ", ".join(f"{f} = ?" for f in fields)
        params = [body.get(f) for f in fields] + [item_id]
        d1_run(f"UPDATE {table} SET {sets} WHERE id = ?", params)
        row = d1_first(f"SELECT * FROM {table} WHERE id = ?", [item_id])
        if row is None:
            return jsonify({"error": "Not found"}), 404
        return jsonify(row)
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


skills_list, skills_create, skills_update, skills_delete = make_crud(
    "skills", ["name", "category", "level", "sort_order"], "name", "sort_order ASC, id ASC"
)
app.get("/api/admin/skills")(skills_list)
app.post("/api/admin/skills")(skills_create)
app.put("/api/admin/skills/<int:item_id>")(skills_update)
app.delete("/api/admin/skills/<int:item_id>")(skills_delete)

projects_list, projects_create, projects_update, projects_delete = make_crud(
    "projects",
    ["title", "description", "image_url", "tech_stack", "live_url", "repo_url", "featured", "sort_order"],
    "title", "sort_order ASC, id DESC",
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


# ---------------------------------------------------------------------------
# Media & R2 Storage (Supports both BUCKET and MEDIA bindings safely)
# ---------------------------------------------------------------------------

def get_bucket():
    e = env()
    return getattr(e, "BUCKET", None) or getattr(e, "MEDIA", None)


@app.post("/api/admin/upload")
@admin_required
def upload_image():
    bucket = get_bucket()
    if bucket is None:
        return jsonify({"error": "Image uploads aren't set up. Please add an R2 bucket binding named 'BUCKET' or 'MEDIA'."}), 501

    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file provided"}), 400

    try:
        import uuid
        ext = ""
        if "." in file.filename:
            ext = "." + file.filename.rsplit(".", 1)[1].lower()
        key = f"{uuid.uuid4().hex}{ext}"

        data = file.read()
        
        # Safely invoke put method across different Pyodide worker bindings
        put_promise = bucket.put(key, data, {"httpMetadata": {"contentType": file.mimetype or "application/octet-stream"}})
        run_sync(put_promise)

        return jsonify({"url": f"/media/{key}"}), 201
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500


def read_object_bytes(obj):
    try:
        return run_sync(obj.bytes())
    except AttributeError:
        return run_sync(obj.arrayBuffer())


@app.get("/media/<path:key>")
def serve_media(key):
    bucket = get_bucket()
    if bucket is None:
        return Response("Not found", status=404)
    try:
        obj = run_sync(bucket.get(key))
        if obj is None:
            return Response("Not found", status=404)
        body = read_object_bytes(obj)
        content_type = "application/octet-stream"
        try:
            http_meta = to_py(obj.httpMetadata)
            if http_meta and http_meta.get("contentType"):
                content_type = http_meta["contentType"]
        except Exception:
            pass
        return Response(body, content_type=content_type, headers={"Cache-Control": "public, max-age=31536000, immutable"})
    except Exception as e:
        return Response(f"Error serving media: {e}", status=500)


# ---------------------------------------------------------------------------
# Frontend Fallthrough
# ---------------------------------------------------------------------------

@app.get("/")
@app.get("/<path:path>")
def frontend(path=""):
    assets = env().ASSETS
    asset_response = run_sync(assets.fetch(f"https://assets.local/{path}"))
    body = run_sync(asset_response.bytes())
    return Response(body, status=asset_response.status, headers=asset_response.headers)


Default = wsgi.entrypoint(app)

