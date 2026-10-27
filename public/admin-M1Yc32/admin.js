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
    toast.className = "toast " + (type || "success");
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 300);
    }, 2600);
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
      }
    } catch (e) {
      errorBox.textContent = "Network error";
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

  // --- Profile Loader ---
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
      setPreview("avatarPreview", profile.avatar_url);
    }
  }

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = {};
    new FormData(e.target).forEach((v, k) => { body[k] = v; });
    const res = await api("/profile", { method: "PUT", body: JSON.stringify(body) });
    if (res.ok) showToast("Profile saved successfully!", "success");
    else showToast("Failed to save profile", "error");
  });

  // --- Generic CRUD Lists ---
  const CONFIG = {
    skills: { listEl: "skillsList", formEl: "skillForm", titleField: "name", subFn: i => `${i.category || ""} · ${i.level}%` },
    projects: { listEl: "projectsList", formEl: "projectForm", titleField: "title", subFn: i => Number(i.starred) === 1 ? "★ Starred" : i.tech_stack || "" },
    experience: { listEl: "experienceList", formEl: "experienceForm", titleField: "role", subFn: i => `${i.organization} (${i.start_date} - ${i.end_date})` }
  };

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
          <button type="button" class="icon-btn edit-btn">&#9998;</button>
          <button type="button" class="icon-btn btn-danger del-btn">&#10005;</button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => fillForm(type, item));
      row.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Delete entry?")) return;
        await api(`/${type}/${item.id}`, { method: "DELETE" });
        showToast("Deleted", "success");
        loadList(type);
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
    if (type === "projects" && item.image_url) setPreview("projectPreview", item.image_url);
    form.scrollIntoView({ behavior: "smooth" });
  }

  function clearForm(type) {
    const form = document.getElementById(CONFIG[type].formEl);
    form.reset();
    form.elements.namedItem("id").value = "";
    if (type === "projects") {
      const img = document.getElementById("projectPreview");
      if (img) img.style.display = "none";
    }
  }

  Object.keys(CONFIG).forEach(type => {
    const form = document.getElementById(CONFIG[type].formEl);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      new FormData(form).forEach((v, k) => {
        if (k !== "id") body[k] = v;
      });
      // Handle checkboxes explicitly
      const starredBox = form.elements.namedItem("starred");
      if (starredBox) body.starred = starredBox.checked ? 1 : 0;

      const id = form.elements.namedItem("id").value;
      const res = id ? await api(`/${type}/${id}`, { method: "PUT", body: JSON.stringify(body) })
                     : await api(`/${type}`, { method: "POST", body: JSON.stringify(body) });
      if (res.ok) {
        showToast(id ? "Updated successfully!" : "Added successfully!", "success");
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
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:12px;">
          <img src="${escapeHtml(s.media_url)}" style="width:40px; height:40px; border-radius:8px; object-fit:cover;" />
          <div><strong>Story #${s.id}</strong><div style="font-size:0.8rem; color:var(--text-faint);">${new Date(s.created_at).toLocaleString()}</div></div>
        </div>
        <button type="button" class="icon-btn btn-danger">&#10005;</button>
      `;
      row.querySelector("button").addEventListener("click", async () => {
        await api(`/stories/${s.id}`, { method: "DELETE" });
        showToast("Story deleted", "success");
        loadStories();
      });
      listEl.appendChild(row);
    });
  }

  document.getElementById("storyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const media_url = document.getElementById("storyMediaUrlInput").value;
    if (!media_url) { showToast("Please upload an image first", "error"); return; }
    const res = await api("/stories", { method: "POST", body: JSON.stringify({ media_url }) });
    if (res.ok) {
      showToast("Story published!", "success");
      document.getElementById("storyForm").reset();
      document.getElementById("storyPreview").style.display = "none";
      loadStories();
    } else {
      showToast("Failed to publish story", "error");
    }
  });

  // --- File Upload with XHR Progress & Live Preview ---
  function setPreview(id, url) {
    let img = document.getElementById(id);
    if (!img) {
      img = document.createElement("img");
      img.id = id;
      img.style.cssText = "width:80px; height:80px; border-radius:12px; object-fit:cover; margin-top:10px;";
      document.currentFileInputParent.appendChild(img);
    }
    img.src = url;
    img.style.display = "block";
  }

  document.querySelectorAll('input[type="file"][data-upload-target]').forEach(fileInput => {
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const targetId = fileInput.dataset.uploadTarget;
      const targetInput = document.getElementById(targetId);

      fileInput.dataset.uploadTargetParent = true;
      document.currentFileInputParent = fileInput.parentElement;

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload");
      xhr.withCredentials = true;
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          const pct = Math.round((ev.loaded / ev.total) * 100);
          showToast(`Uploading... ${pct}%`, "success");
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const data = JSON.parse(xhr.responseText);
          targetInput.value = data.url;
          if (targetId === "avatarUrlInput") setPreview("avatarPreview", data.url);
          if (targetId === "projectImageUrlInput") setPreview("projectPreview", data.url);
          if (targetId === "storyMediaUrlInput") setPreview("storyPreview", data.url);
          showToast("Image uploaded successfully!", "success");
        } else {
          showToast("Upload failed", "error");
        }
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

