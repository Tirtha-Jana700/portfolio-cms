(function () {
  "use strict";

  const api = (path, opts) => fetch("/api/admin" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  const loginWrap = document.getElementById("loginWrap");
  const adminShell = document.getElementById("adminShell");

  function showToast(message, type) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast " + (type === "error" ? "toast-error" : "toast-success");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 350);
    }, 3000);
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
    adminShell.classList.add("hidden");
  }

  function showDashboard() {
    loginWrap.style.display = "none";
    adminShell.classList.remove("hidden");
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
        showToast("Logged in successfully!", "success");
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
    showToast("Logged out successfully", "success");
  });

  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => {
        t.classList.remove("active", "text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
        t.classList.add("text-[#5f7291]");
      });
      tab.classList.add("active", "text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
      tab.classList.remove("text-[#5f7291]");

      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
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

  let savedAvatarUrl = "";
  async function loadProfile() {
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
      listEl.innerHTML = '<p class="text-center text-[#93a5be] text-sm">No entries yet.</p>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-row";
      row.innerHTML = `
        <div><strong class="font-bold">${escapeHtml(item[cfg.titleField])}</strong><div class="text-xs text-[#93a5be] mt-0.5">${escapeHtml(cfg.subFn(item))}</div></div>
        <div class="flex gap-2">
          <button type="button" class="w-10 h-10 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#5f7291] text-sm transition-all hover:text-brandAccent edit-btn">&#9998;</button>
          <button type="button" class="w-10 h-10 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#c0293a] text-sm transition-all hover:opacity-80 del-btn">&#10005;</button>
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
          showToast("Failed to delete", "error");
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

  async function loadStories() {
    const res = await api("/stories");
    const stories = await res.json();
    const listEl = document.getElementById("storiesList");
    listEl.innerHTML = "";
    if (!Array.isArray(stories) || !stories.length) {
      listEl.innerHTML = '<p class="text-center text-[#93a5be] text-sm">No active 24h stories.</p>';
      return;
    }
    stories.forEach(s => {
      const row = document.createElement("div");
      row.className = "item-row";
      const isVid = s.media_url.match(/\.(mp4|webm|ogg|mov)$/i);
      row.innerHTML = `
        <div class="flex items-center gap-3">
          ${isVid ? `<video src="${escapeHtml(s.media_url)}" class="w-10 h-10 rounded-lg object-cover" muted></video>` : `<img src="${escapeHtml(s.media_url)}" class="w-10 h-10 rounded-lg object-cover" />`}
          <div><strong class="font-bold">Story #${s.id}</strong><div class="text-xs text-[#93a5be] mt-0.5">${escapeHtml(s.caption || "No caption")}</div></div>
        </div>
        <button type="button" class="w-10 h-10 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#c0293a] text-sm transition-all hover:opacity-80">&#10005;</button>
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

  // XHR File Upload with Progress Bar & Previews
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

      xhr.onerror = () => {
        showToast("Upload network error", "error");
        if (track) track.style.display = "none";
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

