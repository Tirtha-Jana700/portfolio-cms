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
        showToast("Logged in!", "success");
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
    showToast("Logged out", "success");
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

  const CONFIG = {
    skills: { listEl: "skillsList", formEl: "skillForm", titleField: "name", subFn: i => `${i.category || ""} · ${i.level}%` },
    projects: { listEl: "projectsList", formEl: "projectForm", titleField: "title", subFn: i => Number(i.starred) === 1 ? "★ Starred" : i.tech_stack || "" },
    experience: { listEl: "experienceList", formEl: "experienceForm", titleField: "role", subFn: i => `${i.organization || ""} (${i.start_date || ""} - ${i.end_date || ""})` }
  };

  async function loadList(type) {
    const cfg = CONFIG[type];
    const res = await api("/" + type);
    const items = await res.json();
    const listEl = document.getElementById(cfg.listEl);
    listEl.innerHTML = "";
    if (!Array.isArray(items) || !items.length) {
      listEl.innerHTML = '<p class="text-center text-[#93a5be] text-xs py-4">No entries yet.</p>';
      return;
    }
    items.forEach(item => {
      const row = document.createElement("div");
      row.className = "item-row flex items-center justify-between p-4 bg-[#e6e7ee] rounded-[20px] shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff]";
      row.innerHTML = `
        <div><strong class="font-bold text-sm">${escapeHtml(item[cfg.titleField])}</strong><div class="text-xs text-[#93a5be] mt-0.5">${escapeHtml(cfg.subFn(item))}</div></div>
        <div class="flex gap-2">
          <button type="button" class="w-8 h-8 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[3px_3px_6px_#b7b8c2,-3px_-3px_6px_#ffffff] text-[#5f7291] text-xs transition-all hover:text-brandAccent edit-btn">&#9998;</button>
          <button type="button" class="w-8 h-8 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[3px_3px_6px_#b7b8c2,-3px_-3px_6px_#ffffff] text-[#c0293a] text-xs transition-all hover:opacity-80 del-btn">&#10005;</button>
        </div>
      `;
      row.querySelector(".edit-btn").addEventListener("click", () => fillForm(type, item));
      row.querySelector(".del-btn").addEventListener("click", async () => {
        if (!confirm("Delete entry?")) return;
        const delRes = await api(`/${type}/${item.id}`, { method: "DELETE" });
        if (delRes.ok) {
          showToast("Deleted!", "success");
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
    form.scrollIntoView({ behavior: "smooth" });
  }

  function clearForm(type) {
    const form = document.getElementById(CONFIG[type].formEl);
    form.reset();
    const idInput = form.elements.namedItem("id");
    if (idInput) idInput.value = "";
  }

  Object.keys(CONFIG).forEach(type => {
    const form = document.getElementById(CONFIG[type].formEl);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const body = {};
      new FormData(form).forEach((v, k) => { if (k !== "id") body[k] = v; });
      const starredBox = form.elements.namedItem("starred");
      if (starredBox) body.starred = starredBox.checked ? 1 : 0;

      const idInput = form.elements.namedItem("id");
      const id = idInput ? idInput.value : "";
      const res = id ? await api(`/${type}/${id}`, { method: "PUT", body: JSON.stringify(body) })
                     : await api(`/${type}`, { method: "POST", body: JSON.stringify(body) });
      if (res.ok) {
        showToast(id ? "Updated project!" : "Added project!", "success");
        clearForm(type);
        loadList(type);
      } else {
        showToast("Save failed", "error");
      }
    });
    const cancelBtn = form.querySelector("[data-cancel-edit]");
    if (cancelBtn) cancelBtn.addEventListener("click", () => clearForm(type));
  });

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
    const body = {};
    new FormData(e.target).forEach((v, k) => { body[k] = v; });
    const res = await api("/profile", { method: "PUT", body: JSON.stringify(body) });
    if (res.ok) {
      showToast("Profile saved!", "success");
    } else {
      showToast("Failed to save profile", "error");
    }
  });

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  checkSession();
})();

