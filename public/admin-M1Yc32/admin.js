/**
 * ============================================================================
 * Spatial Glass Admin Dashboard Engine (public/admin-XXXXXX/admin.js)
 * ============================================================================
 * Features:
 *  - Session authentication with brute-force feedback
 *  - Sliding bouncy pill tab bar (#adminTabIndicator)
 *  - XMLHttpRequest live upload progress bars (0% - 100%)
 *  - Dual media previews (Saved in DB vs Staged/Current)
 *  - 24h Story & Video Reel publisher + active countdown list
 *  - One-tap Project Star toggle & full CRUD for all 6 D1 tables
 * ============================================================================
 */

(() => {
  "use strict";

  const TOKEN_KEY = "spatial_admin_token_v1";

  const state = {
    token: sessionStorage.getItem(TOKEN_KEY) || "",
    profile: {},
    stories: [],
    projects: [],
    skills: [],
    experience: []
  };

  // --------------------------------------------------------------------------
  // Helper Utilities & Toast Notifications
  // --------------------------------------------------------------------------

  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showToast(message, type = "success") {
    const stack = document.getElementById("toastStack");
    if (!stack) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type === "error" ? "toast-error" : "toast-success"}`;
    const icon = type === "error" ? "⚠️" : "✓";
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;
    stack.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(12px) scale(0.92)";
      toast.style.transition = "all 0.3s ease";
      setTimeout(() => toast.remove(), 300);
    }, 3400);
  }

  function isVideoUrl(url) {
    if (!url) return false;
    const lower = String(url).trim().toLowerCase();
    if (lower.startsWith("data:video/")) return true;
    return /\.(mp4|webm|ogg|mov|m4v)$/.test(lower.split("?")[0]);
  }

  function renderMediaFrame(containerId, url) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!url || !String(url).trim()) {
      el.innerHTML = "None";
      return;
    }
    const safeUrl = escapeHtml(url);
    if (isVideoUrl(url)) {
      el.innerHTML = `<video src="${safeUrl}" muted playsinline loop autoplay></video>`;
    } else {
      el.innerHTML = `<img src="${safeUrl}" alt="Preview" />`;
    }
  }

  // --------------------------------------------------------------------------
  // Authenticated API Request Wrapper
  // --------------------------------------------------------------------------

  async function apiRequest(path, options = {}) {
    const headers = Object.assign(
      { "Content-Type": "application/json", Accept: "application/json" },
      options.headers || {}
    );

    if (state.token) {
      headers["Authorization"] = `Bearer ${state.token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      handleLogout(false);
      throw new Error(data.error || "Session expired. Please log in again.");
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }

  // --------------------------------------------------------------------------
  // Live Percentage File Upload via XMLHttpRequest
  // --------------------------------------------------------------------------

  function bindUploadDropzone({
    dropzoneId,
    fileInputId,
    progressWrapId,
    progressPctId,
    progressFillId,
    targetInputId,
    previewContainerId
  }) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    const progressWrap = document.getElementById(progressWrapId);
    const progressPct = document.getElementById(progressPctId);
    const progressFill = document.getElementById(progressFillId);
    const targetInput = document.getElementById(targetInputId);

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", () => fileInput.click());

    dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    });

    dropzone.addEventListener("dragleave", () => {
      dropzone.classList.remove("dragover");
    });

    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        uploadFileWithProgress(e.dataTransfer.files[0]);
      }
    });

    fileInput.addEventListener("change", () => {
      if (fileInput.files && fileInput.files[0]) {
        uploadFileWithProgress(fileInput.files[0]);
      }
    });

    if (targetInput && previewContainerId) {
      targetInput.addEventListener("input", () => {
        renderMediaFrame(previewContainerId, targetInput.value);
      });
    }

    function uploadFileWithProgress(file) {
      if (progressWrap) progressWrap.classList.remove("hidden");
      if (progressPct) progressPct.textContent = "0%";
      if (progressFill) progressFill.style.width = "0%";

      const formData = new FormData();
      formData.append("file", file);

      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload", true);
      if (state.token) {
        xhr.setRequestHeader("Authorization", `Bearer ${state.token}`);
      }

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          if (progressPct) progressPct.textContent = `${pct}%`;
          if (progressFill) progressFill.style.width = `${pct}%`;
        }
      };

      xhr.onload = () => {
        setTimeout(() => {
          if (progressWrap) progressWrap.classList.add("hidden");
        }, 600);

        try {
          const res = JSON.parse(xhr.responseText || "{}");
          if (xhr.status >= 200 && xhr.status < 300 && res.url) {
            if (targetInput) targetInput.value = res.url;
            if (previewContainerId) renderMediaFrame(previewContainerId, res.url);
            showToast("File uploaded (" + file.name + ")");
          } else {
            showToast(res.error || "Upload failed", "error");
          }
        } catch {
          showToast("Invalid server response during upload", "error");
        }
      };

      xhr.onerror = () => {
        if (progressWrap) progressWrap.classList.add("hidden");
        showToast("Network error during file upload", "error");
      };

      xhr.send(formData);
    }
  }

  // --------------------------------------------------------------------------
  // Sliding Bouncy Pill Tab Bar
  // --------------------------------------------------------------------------

  function updateTabIndicator(activeBtn) {
    const tabsContainer = document.getElementById("adminTabs");
    const indicator = document.getElementById("adminTabIndicator");
    if (!tabsContainer || !indicator || !activeBtn) return;

    const containerRect = tabsContainer.getBoundingClientRect();
    const btnRect = activeBtn.getBoundingClientRect();

    const left = btnRect.left - containerRect.left + tabsContainer.scrollLeft;
    const top = btnRect.top - containerRect.top;

    indicator.style.width = `${btnRect.width}px`;
    indicator.style.height = `${btnRect.height}px`;
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;
  }

  function initTabs() {
    const tabsContainer = document.getElementById("adminTabs");
    if (!tabsContainer) return;

    const buttons = Array.from(tabsContainer.querySelectorAll(".admin-tab-btn"));
    const panes = Array.from(document.querySelectorAll(".admin-tab-pane"));

    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const targetTab = btn.dataset.tab;
        panes.forEach((pane) => {
          pane.classList.toggle("hidden", pane.id !== `tab-${targetTab}`);
        });

        updateTabIndicator(btn);
      });
    });

    window.addEventListener("resize", () => {
      const current = tabsContainer.querySelector(".admin-tab-btn.active");
      if (current) updateTabIndicator(current);
    });

    requestAnimationFrame(() => {
      const current = tabsContainer.querySelector(".admin-tab-btn.active");
      if (current) updateTabIndicator(current);
    });
  }

  // --------------------------------------------------------------------------
  // Data Loading & Rendering Across All 6 Tables
  // --------------------------------------------------------------------------

  async function fetchAllData() {
    try {
      const data = await apiRequest("/api/portfolio", { method: "GET" });
      state.profile = data.profile || {};
      state.stories = Array.isArray(data.stories) ? data.stories : [];
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      state.skills = Array.isArray(data.skills) ? data.skills : [];
      state.experience = Array.isArray(data.experience) ? data.experience : [];

      populateProfileForm();
      renderAdminStories();
      renderAdminProjects();
      renderAdminSkills();
      renderAdminExperience();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  // 1. Profile Form Population
  function populateProfileForm() {
    const p = state.profile;
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.value = val || "";
    };

    setVal("profFullName", p.full_name);
    setVal("profTitle", p.title);
    setVal("profTagline", p.tagline);
    setVal("profBio", p.bio);
    setVal("profAvatarUrl", p.avatar_url);
    setVal("profResumeUrl", p.resume_url);
    setVal("profEmail", p.email);
    setVal("profPhone", p.phone);
    setVal("profLocation", p.location);
    setVal("profGithub", p.github_url);
    setVal("profLinkedin", p.linkedin_url);
    setVal("profTwitter", p.twitter_url);
    setVal("profInstagram", p.instagram_url);
    setVal("profYoutube", p.youtube_url);

    renderMediaFrame("avatarSavedPreview", p.avatar_url);
    renderMediaFrame("avatarCurrentPreview", p.avatar_url);
  }

  // 2. Stories List Rendering
  function renderAdminStories() {
    const listEl = document.getElementById("adminStoriesList");
    if (!listEl) return;

    if (!state.stories.length) {
      listEl.innerHTML = `<div class="card empty-note">No active stories in the last 24 hours.</div>`;
      return;
    }

    listEl.innerHTML = state.stories
      .map((s) => {
        const video = isVideoUrl(s.media_url);
        const mediaThumb = video
          ? `<video class="admin-item-thumb" src="${escapeHtml(s.media_url)}" muted></video>`
          : `<img class="admin-item-thumb" src="${escapeHtml(s.media_url)}" alt="Story" />`;

        return `
          <div class="card admin-item-card">
            <div class="admin-item-info">
              ${mediaThumb}
              <div>
                <div class="admin-item-title">
                  <span>${escapeHtml(s.caption || "Untitled Story")}</span>
                  <span class="badge">${video ? "Video Reel" : "Photo"}</span>
                </div>
                <div class="admin-item-sub">Created: ${escapeHtml(s.created_at || "Just now")}</div>
              </div>
            </div>
            <div class="admin-item-actions">
              <button type="button" class="btn btn-danger btn-sm" data-delete-story="${s.id}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    listEl.querySelectorAll("[data-delete-story]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-story");
        try {
          await apiRequest(`/api/admin/stories/${id}`, { method: "DELETE" });
          showToast("Story deleted");
          fetchAllData();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  // 3. Projects List Rendering & One-Tap Star Toggle
  function renderAdminProjects() {
    const listEl = document.getElementById("adminProjectsList");
    if (!listEl) return;

    if (!state.projects.length) {
      listEl.innerHTML = `<div class="card empty-note">No projects added yet.</div>`;
      return;
    }

    listEl.innerHTML = state.projects
      .map((p) => {
        const isStarred = Number(p.starred) === 1;
        const thumb = p.image_url
          ? `<img class="admin-item-thumb" src="${escapeHtml(p.image_url)}" alt="" />`
          : `<div class="admin-item-thumb" style="display:flex;align-items:center;justify-content:center;">📁</div>`;

        return `
          <div class="card admin-item-card">
            <div class="admin-item-info">
              ${thumb}
              <div>
                <div class="admin-item-title">
                  <span>${escapeHtml(p.title)}</span>
                  ${
                    isStarred
                      ? `<span class="badge" style="color:var(--star-gold);border-color:rgba(255,214,10,0.4);">★ Popular</span>`
                      : ""
                  }
                </div>
                <div class="admin-item-sub">${escapeHtml(p.tech_stack || "")}</div>
              </div>
            </div>
            <div class="admin-item-actions">
              <button type="button" class="btn btn-sm" data-toggle-star="${p.id}" title="Toggle Starred Status">
                ${isStarred ? "★ Unstar" : "☆ Star"}
              </button>
              <button type="button" class="btn btn-sm" data-edit-project="${p.id}">Edit</button>
              <button type="button" class="btn btn-danger btn-sm" data-delete-project="${p.id}">Delete</button>
            </div>
          </div>
        `;
      })
      .join("");

    // Quick Star / Unstar Button
    listEl.querySelectorAll("[data-toggle-star]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.getAttribute("data-toggle-star"));
        const proj = state.projects.find((item) => Number(item.id) === id);
        if (!proj) return;
        const newStarred = Number(proj.starred) === 1 ? 0 : 1;
        try {
          await apiRequest(`/api/admin/projects/${id}`, {
            method: "PUT",
            body: JSON.stringify({ ...proj, starred: newStarred })
          });
          showToast(newStarred ? "Marked as ★ Popular!" : "Removed from Popular");
          fetchAllData();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });

    // Edit Project Button
    listEl.querySelectorAll("[data-edit-project]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-edit-project"));
        const proj = state.projects.find((item) => Number(item.id) === id);
        if (!proj) return;

        document.getElementById("projectFormHeading").textContent = "Edit Project";
        document.getElementById("projId").value = proj.id;
        document.getElementById("projTitle").value = proj.title || "";
        document.getElementById("projDesc").value = proj.description || "";
        document.getElementById("projTech").value = proj.tech_stack || "";
        document.getElementById("projImageUrl").value = proj.image_url || "";
        document.getElementById("projLiveUrl").value = proj.live_url || "";
        document.getElementById("projRepoUrl").value = proj.repo_url || "";
        document.getElementById("projSortOrder").value = proj.sort_order ?? 0;
        document.getElementById("projStarred").checked = Number(proj.starred) === 1;

        renderMediaFrame("projSavedPreview", proj.image_url);
        renderMediaFrame("projCurrentPreview", proj.image_url);

        document.getElementById("projCancelEditBtn").classList.remove("hidden");
        document.getElementById("projectForm").scrollIntoView({ behavior: "smooth" });
      });
    });

    // Delete Project Button
    listEl.querySelectorAll("[data-delete-project]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-project");
        try {
          await apiRequest(`/api/admin/projects/${id}`, { method: "DELETE" });
          showToast("Project deleted");
          fetchAllData();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  // 4. Skills List Rendering
  function renderAdminSkills() {
    const listEl = document.getElementById("adminSkillsList");
    if (!listEl) return;

    if (!state.skills.length) {
      listEl.innerHTML = `<div class="card empty-note">No skills added yet.</div>`;
      return;
    }

    listEl.innerHTML = state.skills
      .map(
        (s) => `
        <div class="card admin-item-card">
          <div class="admin-item-info">
            <div>
              <div class="admin-item-title">
                <span>${escapeHtml(s.name)}</span>
                <span class="badge">${Number(s.level ?? 80)}%</span>
                ${s.category ? `<span class="badge">${escapeHtml(s.category)}</span>` : ""}
              </div>
              <div class="admin-item-sub">Sort Order: ${s.sort_order ?? 0}</div>
            </div>
          </div>
          <div class="admin-item-actions">
            <button type="button" class="btn btn-sm" data-edit-skill="${s.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-skill="${s.id}">Delete</button>
          </div>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll("[data-edit-skill]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-edit-skill"));
        const skill = state.skills.find((item) => Number(item.id) === id);
        if (!skill) return;

        document.getElementById("skillFormHeading").textContent = "Edit Skill";
        document.getElementById("skillId").value = skill.id;
        document.getElementById("skillName").value = skill.name || "";
        document.getElementById("skillCategory").value = skill.category || "";
        document.getElementById("skillLevel").value = skill.level ?? 80;
        document.getElementById("skillSortOrder").value = skill.sort_order ?? 0;
        document.getElementById("skillCancelEditBtn").classList.remove("hidden");
      });
    });

    listEl.querySelectorAll("[data-delete-skill]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-skill");
        try {
          await apiRequest(`/api/admin/skills/${id}`, { method: "DELETE" });
          showToast("Skill removed");
          fetchAllData();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  // 5. Experience & Education List Rendering
  function renderAdminExperience() {
    const listEl = document.getElementById("adminExpList");
    if (!listEl) return;

    if (!state.experience.length) {
      listEl.innerHTML = `<div class="card empty-note">No timeline entries yet.</div>`;
      return;
    }

    listEl.innerHTML = state.experience
      .map(
        (e) => `
        <div class="card admin-item-card">
          <div class="admin-item-info">
            <div>
              <div class="admin-item-title">
                <span>${escapeHtml(e.role)}</span>
                <span class="badge">${escapeHtml(e.type || "work")}</span>
              </div>
              <div class="admin-item-sub">
                ${escapeHtml(e.organization || "")} • ${escapeHtml(e.start_date || "")} — ${escapeHtml(e.end_date || "Present")}
              </div>
            </div>
          </div>
          <div class="admin-item-actions">
            <button type="button" class="btn btn-sm" data-edit-exp="${e.id}">Edit</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete-exp="${e.id}">Delete</button>
          </div>
        </div>
      `
      )
      .join("");

    listEl.querySelectorAll("[data-edit-exp]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = Number(btn.getAttribute("data-edit-exp"));
        const exp = state.experience.find((item) => Number(item.id) === id);
        if (!exp) return;

        document.getElementById("expFormHeading").textContent = "Edit Timeline Entry";
        document.getElementById("expId").value = exp.id;
        document.getElementById("expType").value = exp.type || "work";
        document.getElementById("expRole").value = exp.role || "";
        document.getElementById("expOrg").value = exp.organization || "";
        document.getElementById("expStartDate").value = exp.start_date || "";
        document.getElementById("expEndDate").value = exp.end_date || "";
        document.getElementById("expDesc").value = exp.description || "";
        document.getElementById("expSortOrder").value = exp.sort_order ?? 0;
        document.getElementById("expCancelEditBtn").classList.remove("hidden");
      });
    });

    listEl.querySelectorAll("[data-delete-exp]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-delete-exp");
        try {
          await apiRequest(`/api/admin/experience/${id}`, { method: "DELETE" });
          showToast("Timeline entry deleted");
          fetchAllData();
        } catch (err) {
          showToast(err.message, "error");
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // Form Submissions & Authentication Handlers
  // --------------------------------------------------------------------------

  function resetProjectForm() {
    document.getElementById("projectForm").reset();
    document.getElementById("projId").value = "";
    document.getElementById("projectFormHeading").textContent = "Add New Project";
    document.getElementById("projCancelEditBtn").classList.add("hidden");
    renderMediaFrame("projSavedPreview", "");
    renderMediaFrame("projCurrentPreview", "");
  }

  function resetSkillForm() {
    document.getElementById("skillForm").reset();
    document.getElementById("skillId").value = "";
    document.getElementById("skillFormHeading").textContent = "Add Skill";
    document.getElementById("skillCancelEditBtn").classList.add("hidden");
  }

  function resetExpForm() {
    document.getElementById("expForm").reset();
    document.getElementById("expId").value = "";
    document.getElementById("expFormHeading").textContent = "Add Timeline Entry";
    document.getElementById("expCancelEditBtn").classList.add("hidden");
  }

  function showDashboard() {
    document.getElementById("loginGate").classList.add("hidden");
    document.getElementById("adminApp").classList.remove("hidden");
    initTabs();
    fetchAllData();
  }

  function handleLogout(notify = true) {
    state.token = "";
    sessionStorage.removeItem(TOKEN_KEY);
    document.getElementById("adminApp").classList.add("hidden");
    document.getElementById("loginGate").classList.remove("hidden");
    if (notify) showToast("Locked Admin Dashboard");
  }

  function initAdminApp() {
    // Bind Live XHR Dropzones
    bindUploadDropzone({
      dropzoneId: "avatarDropzone",
      fileInputId: "avatarFileInput",
      progressWrapId: "avatarProgressWrap",
      progressPctId: "avatarProgressPct",
      progressFillId: "avatarProgressFill",
      targetInputId: "profAvatarUrl",
      previewContainerId: "avatarCurrentPreview"
    });

    bindUploadDropzone({
      dropzoneId: "resumeDropzone",
      fileInputId: "resumeFileInput",
      progressWrapId: "resumeProgressWrap",
      progressPctId: "resumeProgressPct",
      progressFillId: "resumeProgressFill",
      targetInputId: "profResumeUrl",
      previewContainerId: null
    });

    bindUploadDropzone({
      dropzoneId: "storyDropzone",
      fileInputId: "storyFileInput",
      progressWrapId: "storyProgressWrap",
      progressPctId: "storyProgressPct",
      progressFillId: "storyProgressFill",
      targetInputId: "storyMediaUrl",
      previewContainerId: "storyCurrentPreview"
    });

    bindUploadDropzone({
      dropzoneId: "projDropzone",
      fileInputId: "projFileInput",
      progressWrapId: "projProgressWrap",
      progressPctId: "projProgressPct",
      progressFillId: "projProgressFill",
      targetInputId: "projImageUrl",
      previewContainerId: "projCurrentPreview"
    });

    // Login Form
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const password = document.getElementById("adminPasswordInput").value;
        const btn = document.getElementById("loginSubmitBtn");
        btn.disabled = true;
        btn.textContent = "Verifying...";

        try {
          const res = await apiRequest("/api/admin/login", {
            method: "POST",
            body: JSON.stringify({ password })
          });
          state.token = res.token;
          sessionStorage.setItem(TOKEN_KEY, res.token);
          document.getElementById("adminPasswordInput").value = "";
          showToast("Welcome back to Spatial Glass Studio!");
          showDashboard();
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          btn.disabled = false;
          btn.textContent = "Unlock Dashboard";
        }
      });
    }

    // Logout Button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => handleLogout(true));
    }

    // Profile Save Form
    document.getElementById("profileForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        full_name: document.getElementById("profFullName").value.trim(),
        title: document.getElementById("profTitle").value.trim(),
        tagline: document.getElementById("profTagline").value.trim(),
        bio: document.getElementById("profBio").value.trim(),
        avatar_url: document.getElementById("profAvatarUrl").value.trim(),
        resume_url: document.getElementById("profResumeUrl").value.trim(),
        email: document.getElementById("profEmail").value.trim(),
        phone: document.getElementById("profPhone").value.trim(),
        location: document.getElementById("profLocation").value.trim(),
        github_url: document.getElementById("profGithub").value.trim(),
        linkedin_url: document.getElementById("profLinkedin").value.trim(),
        twitter_url: document.getElementById("profTwitter").value.trim(),
        instagram_url: document.getElementById("profInstagram").value.trim(),
        youtube_url: document.getElementById("profYoutube").value.trim()
      };

      try {
        await apiRequest("/api/admin/profile", {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        showToast("Profile updated successfully!");
        fetchAllData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // Story Publish Form
    document.getElementById("storyForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        media_url: document.getElementById("storyMediaUrl").value.trim(),
        caption: document.getElementById("storyCaption").value.trim()
      };

      try {
        await apiRequest("/api/admin/stories", {
          method: "POST",
          body: JSON.stringify(payload)
        });
        document.getElementById("storyForm").reset();
        renderMediaFrame("storyCurrentPreview", "");
        showToast("24h Story published live!");
        fetchAllData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    // Project Save / Update Form
    document.getElementById("projectForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("projId").value;
      const payload = {
        title: document.getElementById("projTitle").value.trim(),
        description: document.getElementById("projDesc").value.trim(),
        tech_stack: document.getElementById("projTech").value.trim(),
        image_url: document.getElementById("projImageUrl").value.trim(),
        live_url: document.getElementById("projLiveUrl").value.trim(),
        repo_url: document.getElementById("projRepoUrl").value.trim(),
        sort_order: Number(document.getElementById("projSortOrder").value || 0),
        starred: document.getElementById("projStarred").checked ? 1 : 0
      };

      try {
        if (id) {
          await apiRequest(`/api/admin/projects/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          showToast("Project updated!");
        } else {
          await apiRequest("/api/admin/projects", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          showToast("Project created!");
        }
        resetProjectForm();
        fetchAllData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("projCancelEditBtn").addEventListener("click", resetProjectForm);

    // Skill Save / Update Form
    document.getElementById("skillForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("skillId").value;
      const payload = {
        name: document.getElementById("skillName").value.trim(),
        category: document.getElementById("skillCategory").value.trim(),
        level: Number(document.getElementById("skillLevel").value || 80),
        sort_order: Number(document.getElementById("skillSortOrder").value || 0)
      };

      try {
        if (id) {
          await apiRequest(`/api/admin/skills/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          showToast("Skill updated!");
        } else {
          await apiRequest("/api/admin/skills", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          showToast("Skill added!");
        }
        resetSkillForm();
        fetchAllData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("skillCancelEditBtn").addEventListener("click", resetSkillForm);

    // Experience Save / Update Form
    document.getElementById("expForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const id = document.getElementById("expId").value;
      const payload = {
        type: document.getElementById("expType").value,
        role: document.getElementById("expRole").value.trim(),
        organization: document.getElementById("expOrg").value.trim(),
        start_date: document.getElementById("expStartDate").value.trim(),
        end_date: document.getElementById("expEndDate").value.trim(),
        description: document.getElementById("expDesc").value.trim(),
        sort_order: Number(document.getElementById("expSortOrder").value || 0)
      };

      try {
        if (id) {
          await apiRequest(`/api/admin/experience/${id}`, {
            method: "PUT",
            body: JSON.stringify(payload)
          });
          showToast("Timeline entry updated!");
        } else {
          await apiRequest("/api/admin/experience", {
            method: "POST",
            body: JSON.stringify(payload)
          });
          showToast("Timeline entry added!");
        }
        resetExpForm();
        fetchAllData();
      } catch (err) {
        showToast(err.message, "error");
      }
    });

    document.getElementById("expCancelEditBtn").addEventListener("click", resetExpForm);

    // Auto-unlock if a valid session token is already present
    if (state.token) {
      showDashboard();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminApp);
  } else {
    initAdminApp();
  }
})();
