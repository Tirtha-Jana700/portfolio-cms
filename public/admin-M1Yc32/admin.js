(function () {
  "use strict";

  const api = (path, opts) => fetch("/api/admin" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  const loginWrap = document.getElementById("loginWrap");
  const adminShell = document.getElementById("adminShell");

  function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast toast-${type} toast-in`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove("toast-in");
      toast.classList.add("toast-out");
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  async function checkSession() {
    try {
      const res = await api("/session");
      const data = await res.json();
      if (data.authenticated) { showDashboard(); } else { showLogin(); }
    } catch (e) { showLogin(); }
  }

  function showLogin() {
    loginWrap.style.display = "flex";
    adminShell.classList.remove("active");
  }

  function showDashboard() {
    loginWrap.style.display = "none";
    adminShell.classList.add("active");
    loadProfile();
    loadList("skills");
    loadList("projects");
    loadList("experience");
    loadStories();
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("loginPassword").value;
    const errorBox = document.getElementById("loginError");
    try {
      const res = await api("/login", { method: "POST", body: JSON.stringify({ password }) });
      const data = await res.json();
      if (res.ok) {
        document.getElementById("loginPassword").value = "";
        showDashboard();
      } else {
        errorBox.textContent = data.error || "Login failed";
        showToast(data.error || "Login failed", "error");
      }
    } catch (e) {
      errorBox.textContent = "Network error";
      showToast("Network error", "error");
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    showLogin();
  });

  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });

  function renderDualPreviews(containerId, currentUrl, savedUrl) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";

    if (savedUrl) {
      const box = el("div", "preview-box");
      const isVid = savedUrl.match(/\.(mp4|webm|ogg|mov)$/i);
      box.innerHTML = isVid ? `<video src="${escapeHtml(savedUrl)}" muted></video><span class="preview-label">Saved</span>` : `<img src="${escapeHtml(savedUrl)}" alt="Saved" /><span class="preview-label">Saved</span>`;
      container.appendChild(box);
    }
    if (currentUrl && currentUrl !== savedUrl) {
      const box = el("div", "preview-box");
      const isVid = currentUrl.match(/\.(mp4|webm|ogg|mov)$/i);
      box.innerHTML = isVid ? `<video src="${escapeHtml(currentUrl)}" muted autoplay></video><span class="preview-label">Current</span>` : `<img src="${escapeHtml(currentUrl)}" alt="Current" /><span class="preview-label">Current</span>`;
      container.appendChild(box);
    }
  }

  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }

  // --- Profile Loader ---
  let savedAvatarUrl = "";
  async function loadProfile() {
    try {
      const res = await fetch("/api/portfolio");
      const data = await res.json();
      const form = document.getElementById("profileForm");
      const profile = data.profile || {};
      Object.keys(profile).forEach(key => {
        const input = form.elements.namedItem(key);
        if (input) input.value = profile[key] || "";
      });
      if (profile.avatar_url) {
        savedAvatarUrl = profile.avatar_url;
        document.getElementById("avatarUrlInput").value = profile.avatar_url;
        renderDualPreviews("avatarPreviewContainer", profile.avatar_url, savedAvatarUrl);
      }
    } catch (e) {
      console.error(e);
    }
  }

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    new FormData(e.target).forEach((v, k) => { body[k] = v; });
    const res = await api("/profile", { method: "PUT", body: JSON.stringify(body) });
    if (res.ok) {
      savedAvatarUrl = body.avatar_url;
      showToast("Profile saved successfully!", "success");
    } else {
      showToast("Failed to save profile", "error");
    }
  });

  // --- CRUD Lists ---
  const CONFIG = {
    skills: { listEl: "skillsList", formEl: "skillForm", titleField: "name", subFn: i => `${i.category || ""} · ${i.level}%` },
    projects: { listEl: "projectsList", formEl: "projectForm", titleField: "title", subFn: i => Number(i.starred) === 1 ? "★ Starred" : i.tech_stack || "" },
    experience: { listEl: "experienceList", formEl: "experienceForm", titleField: "role", subFn: i => `${i.organization} (${i.start_date} - ${i.end_date})` }
  };

  let savedProjectImgUrl = "";
  async function loadList(type) {
    const cfg = CONFIG[type];
    const res = await api("/" + type);
    const items = await res.json();
    const listEl = document.getElementById(cfg.listEl);
    listEl.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
      listEl.innerHTML = '<p class="empty-note">No entries yet.</p>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "card item-row";
      row.innerHTML = `
        <div><strong>${escapeHtml(item[cfg.titleField])}</strong><div style="font-size:0.8rem; color:var(--text-faint);">${escapeHtml(cfg.subFn(item))}</div></div>
        <div style="display:flex; gap:8px;">
          <button type="button" class="icon-btn edit-btn bounce-click">&#9998;</button>
          <button type="button" class="icon-btn btn-danger del-btn bounce-click">&#10005;</button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => fillForm(type, item));
      row.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Delete entry?")) return;
        const delRes = await api(`/${type}/${item.id}`, { method: "DELETE" });
        if (delRes.ok) {
          showToast("Deleted successfully", "success");
          loadList(type);
        } else {
          showToast("Failed to delete entry", "error");
        }
      });
      listEl.appendChild(row);
    });
  }

  function fillForm(type, item) {
    const form = document.getElementById(CONFIG[type].formEl);
    Object.keys(item).forEach(key => {
      const input = form.elements.namedItem(key);
      if (input) {
        if (input.type === "checkbox") input.checked = Number(item[key]) === 1;
        else input.value = item[key] ?? "";
      }
    });
    if (type === "projects" && item.image_url) {
      savedProjectImgUrl = item.image_url;
      renderDualPreviews("projectPreviewContainer", item.image_url, savedProjectImgUrl);
    }
    form.scrollIntoView({ behavior: "smooth" });
  }

  function clearForm(type) {
    const form = document.getElementById(CONFIG[type].formEl);
    form.reset();
    form.elements.namedItem("id").value = "";
    if (type === "projects") {
      document.getElementById("projectPreviewContainer").innerHTML = "";
      savedProjectImgUrl = "";
    }
  }

  Object.keys(CONFIG).forEach(type => {
    const form = document.getElementById(CONFIG[type].formEl);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      new FormData(form).forEach((v, k) => { if (k !== "id") body[k] = v; });
      const starredBox = form.elements.namedItem("starred");
      if (starredBox) body.starred = starredBox.checked ? 1 : 0;

      const id = form.elements.namedItem("id").value;
      const res = id ? await api(`/${type}/${id}`, { method: "PUT", body: JSON.stringify(body) })
                     : await api(`/${type}`, { method: "POST", body: JSON.stringify(body) });
      if (res.ok) {
        showToast(id ? "Updated successfully!" : "Added successfully!", "success");
        if (type === "projects") savedProjectImgUrl = body.image_url || "";
        clearForm(type);
        loadList(type);
      } else {
        showToast("Save failed", "error");
      }
    });
    const cancelBtn = form.querySelector("[data-cancel-edit]");
    if (cancelBtn) cancelBtn.addEventListener("click", () => clearForm(type));
  });

  // --- Stories Management ---
  async function loadStories() {
    const res = await api("/stories");
    const stories = await res.json();
    const listEl = document.getElementById("storiesList");
    listEl.innerHTML = "";
    if (!Array.isArray(stories) || !stories.length) {
      listEl.innerHTML = '<p class="empty-note">No active 24h stories.</p>';
      return;
    }
    stories.forEach(s => {
      const row = document.createElement("div");
      row.className = "card item-row";
      const isVid = s.media_url.match(/\.(mp4|webm|ogg|mov)$/i);
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          ${isVid ? `<video src="${escapeHtml(s.media_url)}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;" muted></video>` : `<img src="${escapeHtml(s.media_url)}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;" />`}
          <div><strong>Story #${s.id}</strong><div style="font-size:0.8rem; color:var(--text-faint);">${escapeHtml(s.caption || "No caption")}</div></div>
        </div>
        <button type="button" class="icon-btn btn-danger bounce-click">&#10005;</button>
      `;
      row.querySelector("button").addEventListener("click", async () => {
        const delRes = await api(`/stories/${s.id}`, { method: "DELETE" });
        if (delRes.ok) {
          showToast("Story deleted", "success");
          loadStories();
        } else {
          showToast("Failed to delete story", "error");
        }
      });
      listEl.appendChild(row);
    });
  }

  document.getElementById("storyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const media_url = document.getElementById("storyMediaUrlInput").value;
    const caption = e.target.elements.namedItem("caption").value;
    if (!media_url) { showToast("Please upload media first", "error"); return; }
    const res = await api("/stories", { method: "POST", body: JSON.stringify({ media_url, caption }) });
    if (res.ok) {
      showToast("Story published successfully!", "success");
      document.getElementById("storyForm").reset();
      document.getElementById("storyPreviewContainer").innerHTML = "";
      loadStories();
    } else {
      showToast("Failed to publish story", "error");
    }
  });

  // --- XHR File Upload with Progress Bar & Previews ---
  document.querySelectorAll('input[type="file"][data-upload-target]').forEach(fileInput => {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const targetId = fileInput.dataset.uploadTarget;
      const progressId = fileInput.dataset.progressId;
      const previewId = fileInput.dataset.previewId;
      const targetInput = document.getElementById(targetId);
      const track = document.getElementById(progressId);
      const fill = track ? track.querySelector(".upload-progress-fill") : null;

      if (track) track.style.display = "block";
      if (fill) fill.style.width = "0%";

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload");
      xhr.withCredentials = true;

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable && fill) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          fill.style.width = pct + "%";
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          targetInput.value = data.url;
          if (targetId === "avatarUrlInput") renderDualPreviews(previewId, data.url, savedAvatarUrl);
          else if (targetId === "projectImageUrlInput") renderDualPreviews(previewId, data.url, savedProjectImgUrl);
          else renderDualPreviews(previewId, data.url, "");
          showToast("Upload completed successfully!", "success");
        } else {
          showToast("Upload failed", "error");
        }
        if (track) setTimeout(() => { track.style.display = "none"; }, 800);
      };

      const fd = new FormData();
      fd.append("file", file);
      xhr.send(fd);
    });
  });

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  checkSession();
})();

