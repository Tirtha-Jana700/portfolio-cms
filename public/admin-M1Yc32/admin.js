(function () {
  "use strict";

  const api = (path, opts) => fetch("/api/admin" + path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });

  const loginWrap = document.getElementById("loginWrap");
  const adminShell = document.getElementById("adminShell");

  // ---------- auth ----------

  async function checkSession() {
    try {
      const res = await api("/session");
      const data = await res.json();
      if (data.authenticated) {
        showDashboard();
      } else {
        showLogin();
      }
    } catch (e) {
      showLogin();
    }
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
  }

  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = document.getElementById("loginPassword").value;
    const errorBox = document.getElementById("loginError");
    errorBox.textContent = "";
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
      errorBox.textContent = "Network error — try again.";
    }
  });

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    showLogin();
  });

  // ---------- tabs ----------

  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
    });
  });

  // ---------- profile ----------

  async function loadProfile() {
    const res = await fetch("/api/portfolio");
    const data = await res.json();
    const form = document.getElementById("profileForm");
    const profile = data.profile || {};
    Object.keys(profile).forEach(key => {
      const input = form.elements.namedItem(key);
      if (input) input.value = profile[key] || "";
    });
  }

  document.getElementById("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const body = {};
    new FormData(form).forEach((v, k) => { body[k] = v; });
    const res = await api("/profile", { method: "PUT", body: JSON.stringify(body) });
    if (res.ok) {
      const note = document.getElementById("profileSaved");
      note.classList.remove("hidden");
      setTimeout(() => note.classList.add("hidden"), 2000);
    }
  });

  // ---------- generic list CRUD (skills / projects / experience) ----------

  const CONFIG = {
    skills: {
      listEl: "skillsList",
      formEl: "skillForm",
      titleField: "name",
      subFn: (i) => (i.category ? i.category + " · " : "") + (i.level ?? 0) + "%",
    },
    projects: {
      listEl: "projectsList",
      formEl: "projectForm",
      titleField: "title",
      subFn: (i) => i.tech_stack || "",
    },
    experience: {
      listEl: "experienceList",
      formEl: "experienceForm",
      titleField: "role",
      subFn: (i) => [i.organization, [i.start_date, i.end_date].filter(Boolean).join(" – ")].filter(Boolean).join(" · "),
    },
  };

  async function loadList(type) {
    const cfg = CONFIG[type];
    const res = await api("/" + type);
    const items = await res.json();
    const listEl = document.getElementById(cfg.listEl);
    listEl.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
      listEl.innerHTML = '<p class="empty-note">Nothing added yet.</p>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "card item-row";
      row.innerHTML = `
        <div class="item-main">
          <div class="item-title"></div>
          <div class="item-sub"></div>
        </div>
        <div class="item-actions">
          <button type="button" class="icon-btn" data-action="edit">&#9998;</button>
          <button type="button" class="icon-btn btn-danger" data-action="delete">&#10005;</button>
        </div>
      `;
      row.querySelector(".item-title").textContent = item[cfg.titleField] || "(untitled)";
      row.querySelector(".item-sub").textContent = cfg.subFn(item);
      row.querySelector('[data-action="edit"]').addEventListener("click", () => fillForm(type, item));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => deleteItem(type, item.id));
      listEl.appendChild(row);
    });
  }

  function fillForm(type, item) {
    const form = document.getElementById(CONFIG[type].formEl);
    Object.keys(item).forEach(key => {
      const input = form.elements.namedItem(key);
      if (input) input.value = item[key] ?? "";
    });
    form.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function clearForm(type) {
    const form = document.getElementById(CONFIG[type].formEl);
    form.reset();
    form.elements.namedItem("id").value = "";
  }

  async function deleteItem(type, id) {
    if (!confirm("Delete this entry?")) return;
    await api(`/${type}/${id}`, { method: "DELETE" });
    loadList(type);
  }

  Object.keys(CONFIG).forEach(type => {
    const form = document.getElementById(CONFIG[type].formEl);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      new FormData(form).forEach((v, k) => { if (k !== "id") body[k] = v; });
      const id = form.elements.namedItem("id").value;
      if (id) {
        await api(`/${type}/${id}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await api(`/${type}`, { method: "POST", body: JSON.stringify(body) });
      }
      clearForm(type);
      loadList(type);
    });
    form.querySelector("[data-cancel-edit]").addEventListener("click", () => clearForm(type));
  });

  // ---------- image upload helpers ----------

  document.querySelectorAll('input[type="file"][data-upload-target]').forEach(fileInput => {
    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      const targetName = fileInput.dataset.uploadTarget;
      const targetInput = fileInput.closest("form").elements.namedItem(targetName);
      const fd = new FormData();
      fd.append("file", file);
      try {
        const res = await fetch("/api/admin/upload", { method: "POST", credentials: "include", body: fd });
        const data = await res.json();
        if (res.ok && data.url) {
          targetInput.value = data.url;
        } else {
          alert(data.error || "Upload failed");
        }
      } catch (e) {
        alert("Upload failed — check your connection.");
      }
    });
  });

  checkSession();
})();
