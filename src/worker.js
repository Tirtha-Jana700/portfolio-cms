/**
 * ============================================================================
 * Cloudflare Native JS Worker Backend (src/worker.js)
 * ============================================================================
 * Replaces the unstable Python backend to resolve Code 10030.
 * Matches your 6-table Cloudflare D1 Schema.
 * ============================================================================
 */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// CORS Headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...corsHeaders
    }
  });
}

// Authentication Helpers
function getAdminSecret(env) {
  return (env.ADMIN_PASSWORD || "admin123").trim();
}

function createToken(secret) {
  const exp = Date.now() + TOKEN_TTL_MS;
  const raw = `${exp}.${secret}`;
  return btoa(raw); // Base64 encode
}

function verifyToken(request, secret) {
  const authHeader = request.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return false;
  
  try {
    const token = authHeader.split(" ")[1].trim();
    const decoded = atob(token);
    const [expStr, tokenSecret] = decoded.split(".");
    if (Date.now() > parseInt(expStr, 10)) return false;
    return tokenSecret === secret;
  } catch {
    return false;
  }
}

function isoNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method.toUpperCase();

    // Handle CORS Preflight
    if (method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const db = env.DB;

    // -------------------------------------------------------------------------
    // 1. Public Portfolio Data Endpoint: GET /api/portfolio
    // -------------------------------------------------------------------------
    if (path === "/api/portfolio" && method === "GET") {
      if (!db) return jsonResponse({ error: "DB binding missing" }, 500);

      try {
        const [profileRes, skillsRes, projectsRes, experienceRes] = await Promise.all([
          db.prepare("SELECT * FROM profile WHERE id = 1").all(),
          db.prepare("SELECT * FROM skills ORDER BY sort_order ASC, id ASC").all(),
          db.prepare("SELECT * FROM projects ORDER BY starred DESC, sort_order ASC, id DESC").all(),
          db.prepare("SELECT * FROM experience ORDER BY sort_order ASC, id DESC").all()
        ]);

        // Cleanup expired stories
        const cutoffIso = new Date(Date.now() - STORY_TTL_MS).toISOString();
        await db.prepare("DELETE FROM stories WHERE created_at < ?").bind(cutoffIso).run();
        
        const storiesRes = await db
          .prepare("SELECT * FROM stories WHERE created_at >= ? ORDER BY created_at ASC")
          .bind(cutoffIso)
          .all();

        return jsonResponse({
          profile: profileRes.results[0] || {},
          skills: skillsRes.results || [],
          projects: projectsRes.results || [],
          experience: experienceRes.results || [],
          stories: storiesRes.results || []
        });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // -------------------------------------------------------------------------
    // 2. Admin Authentication Endpoint: POST /api/admin/login
    // -------------------------------------------------------------------------
    if (path === "/api/admin/login" && method === "POST") {
      const clientIp = request.headers.get("CF-Connecting-IP") || "local";
      const nowTs = Date.now();

      const attemptRow = await db.prepare("SELECT * FROM login_attempts WHERE ip = ?").bind(clientIp).first();
      
      let attempts = attemptRow ? (attemptRow.attempts || 0) : 0;
      let lastAttempt = attemptRow ? (attemptRow.last_attempt || 0) : 0;

      if (attempts >= MAX_LOGIN_ATTEMPTS && (nowTs - lastAttempt) < LOCKOUT_MS) {
        const waitMin = Math.max(1, Math.floor((LOCKOUT_MS - (nowTs - lastAttempt)) / 60000));
        return jsonResponse({ error: `Too many failed attempts. Try again in ${waitMin} min.` }, 429);
      } else if ((nowTs - lastAttempt) >= LOCKOUT_MS) {
        await db.prepare("UPDATE login_attempts SET attempts = 0, last_attempt = ? WHERE ip = ?")
          .bind(nowTs, clientIp).run();
        attempts = 0;
      }

      let body = {};
      try { body = await request.json(); } catch {}
      const password = (body.password || "").toString();
      const secret = getAdminSecret(env);

      if (password === secret) {
        await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(clientIp).run();
        return jsonResponse({ ok: true, token: createToken(secret) });
      } else {
        const newAttempts = attempts + 1;
        await db.prepare(`
          INSERT INTO login_attempts (ip, attempts, last_attempt) VALUES (?, ?, ?)
          ON CONFLICT(ip) DO UPDATE SET attempts = excluded.attempts, last_attempt = excluded.last_attempt
        `).bind(clientIp, newAttempts, nowTs).run();
        
        const remaining = Math.max(0, MAX_LOGIN_ATTEMPTS - newAttempts);
        return jsonResponse({ error: `Invalid password. ${remaining} attempts remaining.` }, 401);
      }
    }

    // -------------------------------------------------------------------------
    // 3. Protected Admin Endpoints (/api/admin/*)
    // -------------------------------------------------------------------------
    if (path.startsWith("/api/admin/")) {
      if (!verifyToken(request, getAdminSecret(env))) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      // 3A. File Upload Endpoint (Data URI fallback)
      if (path === "/api/admin/upload" && method === "POST") {
        const formData = await request.formData();
        const file = formData.get("file");
        if (!file) return jsonResponse({ error: "No file provided" }, 400);

        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        
        // Convert to Base64 in JS
        let binaryString = "";
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const b64Data = btoa(binaryString);
        const dataUrl = `data:${file.type || "application/octet-stream"};base64,${b64Data}`;
        
        return jsonResponse({ ok: true, url: dataUrl });
      }

      let body = {};
      if (["POST", "PUT"].includes(method)) {
        try { body = await request.json(); } catch {}
      }

      // 3B. Profile CRUD
      if (path === "/api/admin/profile" && method === "PUT") {
        await db.prepare(`
          INSERT INTO profile (
            id, full_name, title, tagline, bio, avatar_url, resume_url,
            email, phone, location, github_url, linkedin_url,
            twitter_url, instagram_url, youtube_url, updated_at
          ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            full_name = excluded.full_name, title = excluded.title,
            tagline = excluded.tagline, bio = excluded.bio,
            avatar_url = excluded.avatar_url, resume_url = excluded.resume_url,
            email = excluded.email, phone = excluded.phone, location = excluded.location,
            github_url = excluded.github_url, linkedin_url = excluded.linkedin_url,
            twitter_url = excluded.twitter_url, instagram_url = excluded.instagram_url,
            youtube_url = excluded.youtube_url, updated_at = excluded.updated_at
        `).bind(
          body.full_name || "", body.title || "", body.tagline || "", body.bio || "",
          body.avatar_url || "", body.resume_url || "", body.email || "", body.phone || "",
          body.location || "", body.github_url || "", body.linkedin_url || "",
          body.twitter_url || "", body.instagram_url || "", body.youtube_url || "", isoNow()
        ).run();
        return jsonResponse({ ok: true });
      }

      // 3C. Stories CRUD
      if (path === "/api/admin/stories" && method === "POST") {
        if (!body.media_url) return jsonResponse({ error: "media_url is required" }, 400);
        await db.prepare("INSERT INTO stories (media_url, created_at, caption) VALUES (?, ?, ?)")
          .bind(body.media_url.trim(), isoNow(), (body.caption || "").trim()).run();
        return jsonResponse({ ok: true });
      }
      if (path.startsWith("/api/admin/stories/") && method === "DELETE") {
        const id = path.split("/").pop();
        await db.prepare("DELETE FROM stories WHERE id = ?").bind(id).run();
        return jsonResponse({ ok: true });
      }

      // 3D. Projects CRUD
      if (path === "/api/admin/projects" && method === "POST") {
        await db.prepare(`
          INSERT INTO projects (
            title, description, image_url, tech_stack, live_url, repo_url, starred, sort_order, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          body.title || "", body.description || "", body.image_url || "", body.tech_stack || "",
          body.live_url || "", body.repo_url || "", body.starred ? 1 : 0, Number(body.sort_order) || 0, isoNow()
        ).run();
        return jsonResponse({ ok: true });
      }
      if (path.startsWith("/api/admin/projects/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          await db.prepare(`
            UPDATE projects SET title = ?, description = ?, image_url = ?, tech_stack = ?,
            live_url = ?, repo_url = ?, starred = ?, sort_order = ? WHERE id = ?
          `).bind(
            body.title || "", body.description || "", body.image_url || "", body.tech_stack || "",
            body.live_url || "", body.repo_url || "", body.starred ? 1 : 0, Number(body.sort_order) || 0, id
          ).run();
          return jsonResponse({ ok: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM projects WHERE id = ?").bind(id).run();
          return jsonResponse({ ok: true });
        }
      }

      // 3E. Skills CRUD
      if (path === "/api/admin/skills" && method === "POST") {
        await db.prepare("INSERT INTO skills (name, category, level, sort_order) VALUES (?, ?, ?, ?)")
          .bind(body.name || "", body.category || "", Number(body.level) || 80, Number(body.sort_order) || 0).run();
        return jsonResponse({ ok: true });
      }
      if (path.startsWith("/api/admin/skills/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          await db.prepare("UPDATE skills SET name = ?, category = ?, level = ?, sort_order = ? WHERE id = ?")
            .bind(body.name || "", body.category || "", Number(body.level) || 80, Number(body.sort_order) || 0, id).run();
          return jsonResponse({ ok: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM skills WHERE id = ?").bind(id).run();
          return jsonResponse({ ok: true });
        }
      }

      // 3F. Experience CRUD
      if (path === "/api/admin/experience" && method === "POST") {
        await db.prepare(`
          INSERT INTO experience (type, role, organization, start_date, end_date, description, sort_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          body.type || "work", body.role || "", body.organization || "", body.start_date || "",
          body.end_date || "", body.description || "", Number(body.sort_order) || 0
        ).run();
        return jsonResponse({ ok: true });
      }
      if (path.startsWith("/api/admin/experience/")) {
        const id = path.split("/").pop();
        if (method === "PUT") {
          await db.prepare(`
            UPDATE experience SET type = ?, role = ?, organization = ?, start_date = ?,
            end_date = ?, description = ?, sort_order = ? WHERE id = ?
          `).bind(
            body.type || "work", body.role || "", body.organization || "", body.start_date || "",
            body.end_date || "", body.description || "", Number(body.sort_order) || 0, id
          ).run();
          return jsonResponse({ ok: true });
        }
        if (method === "DELETE") {
          await db.prepare("DELETE FROM experience WHERE id = ?").bind(id).run();
          return jsonResponse({ ok: true });
        }
      }
    }

    // -------------------------------------------------------------------------
    // 4. Serve Static Frontend Assets
    // -------------------------------------------------------------------------
    if (env.ASSETS) {
      try {
        return await env.ASSETS.fetch(request);
      } catch (err) {
        return jsonResponse({ error: "Asset fetch failed" }, 404);
      }
    }

    return jsonResponse({ error: "Not found" }, 404);
  }
};
