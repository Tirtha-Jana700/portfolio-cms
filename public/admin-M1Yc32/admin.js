(function () {
"use strict";
​const api = (path, opts) => fetch("/api/admin" + path, {
credentials: "include",
headers: { "Content-Type": "application/json" },
...opts,
});
​const loginWrap = document.getElementById("loginWrap");
const adminShell = document.getElementById("adminShell");
​// ---------- Apple Floating Toast Notification Helper ----------
​function showToast(message, type) {
const container = document.getElementById("toastContainer");
if (!container) return;
const toast = document.createElement("div");
toast.className = toast toast-${type || "success"};
toast.textContent = message;
container.appendChild(toast);
​requestAnimationFrame(() => {
toast.classList.add("toast-in");
});
​setTimeout(() => {
toast.classList.remove("toast-in");
setTimeout(() => toast.remove(), 350);
}, 3000);
}
​async function checkSession() {
try {
const res = await api("/session");
const data = await res.json();
if (data.authenticated) { showDashboard(); } else { showLogin(); }
} catch (e) { showLogin(); }
}
​function showLogin() {
loginWrap.style.display = "flex";
adminShell.classList.remove("active");
}
​function showDashboard() {
loginWrap.style.display = "none";
adminShell.classList.add("active");
loadProfile();
loadList("skills");
loadList("projects");
loadList("experience");
loadStories();
}
​document.getElementById("loginForm").addEventListener("submit", async (e) => {
e.preventDefault();
const password = document.getElementById("loginPassword").value;
const errorBox = document.getElementById("loginError");
errorBox.textContent = "";
​try {
const res = await api("/login", { method: "POST", body: JSON.stringify({ password }) });
const data = await res.json();
if (res.ok) {
document.getElementById("loginPassword").value = "";
showDashboard();
showToast("Signed in successfully!", "success");
} else {
errorBox.textContent = data.error || "Authentication failed";
showToast("Failed to authenticate", "error");
}
} catch (e) {
errorBox.textContent = "Network error";
showToast("Network error connecting to backend", "error");
}
});
​document.getElementById("logoutBtn").addEventListener("click", async () => {
await api("/logout", { method: "POST" });
showLogin();
showToast("Logged out", "success");
});
​document.querySelectorAll(".admin-tab").forEach(tab => {
tab.addEventListener("click", () => {
document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
document.querySelectorAll(".admin-panel").forEach(p => p.classList.remove("active"));
tab.classList.add("active");
document.getElementById("panel-" + tab.dataset.tab).classList.add("active");
});
});
​// ---------- Previews Helper ----------
​function renderPreviews(containerId, currentUrl, savedUrl) {
const container = document.getElementById(containerId);
if (!container) return;
container.innerHTML = "";
​if (savedUrl) {
const box = el("div", "preview-box");
const isVid = savedUrl.match(/.(mp4|webm|ogg|mov)/i);
box.innerHTML = isVid
? `<video src="${escapeHtml(savedUrl)}" muted></video><span class="preview-label">Saved</span>`
: `<img src="${escapeHtml(savedUrl)}" alt="Saved" /><span class="preview-label">Saved</span>`;
container.appendChild(box);
}
if (currentUrl && currentUrl !== savedUrl) {
const box = el("div", "preview-box");
const isVid = currentUrl.match(/\.(mp4|webm|ogg|mov)/i);
box.innerHTML = isVid
? <video src="${escapeHtml(currentUrl)}" muted autoplay></video><span class="preview-label">Current</span>
: <img src="${escapeHtml(currentUrl)}" alt="Current" /><span class="preview-label">Current</span>;
container.appendChild(box);
}
}
​function el(tag, cls, html) {
const node = document.createElement(tag);
if (cls) node.className = cls;
if (html !== undefined) node.innerHTML = html;
return node;
}
​function escapeHtml(str) {
const d = document.createElement("div");
d.textContent = str == null ? "" : String(str);
return d.innerHTML;
}
​// ---------- Profile Loader & Saver ----------
​let savedAvatarUrl = "";
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
renderPreviews("avatarPreviewContainer", profile.avatar_url, savedAvatarUrl);
}
} catch (e) {
showToast("Failed to fetch profile info", "error");
}
}
​document.getElementById("profileForm").addEventListener("submit", async (e) => {
e.preventDefault();
const body = {};
new FormData(e.target).forEach((v, k) => { body[k] = v; });
const res = await api("/profile", { method: "PUT", body: JSON.stringify(body) });
if (res.ok) {
savedAvatarUrl = body.avatar_url;
showToast("Profile updated successfully!", "success");
} else {
showToast("Could not save profile", "error");
}
});
​// ---------- CRUD Collections (Skills, Projects, Experience) ----------
​const CONFIG = {
skills: { listEl: "skillsList", formEl: "skillForm", titleField: "name", subFn: i => ${i.category || ""} · ${i.level}% },
projects: { listEl: "projectsList", formEl: "projectForm", titleField: "title", subFn: i => Number(i.starred) === 1 ? "★ Starred (Featured)" : i.tech_stack || "" },
experience: { listEl: "experienceList", formEl: "experienceForm", titleField: "role", subFn: i => ${i.organization || ""} (${i.start_date || ""} - ${i.end_date || ""}) }
};
​let savedProjectImgUrl = "";
​async function loadList(type) {
const cfg = CONFIG[type];
const res = await api("/" + type);
const items = await res.json();
const listEl = document.getElementById(cfg.listEl);
listEl.innerHTML = "";
if (!Array.isArray(items) || !items.length) {
listEl.innerHTML = '<p class="empty-note">No entries created yet.</p>';
return;
}
items.forEach(item => {
const row = document.createElement("div");
row.className = "card item-row";
row.innerHTML = <div class="item-main"> <div class="item-title">${escapeHtml(item[cfg.titleField])}</div> <div class="item-sub">${escapeHtml(cfg.subFn(item))}</div> </div> <div style="display:flex; gap:8px;"> <button type="button" class="icon-btn edit-btn" title="Edit">✎</button> <button type="button" class="icon-btn btn-danger del-btn" title="Delete">✕</button> </div>;
row.querySelector(".edit-btn").addEventListener("click", () => fillForm(type, item));
row.querySelector(".del-btn").addEventListener("click", async () => {
if (!confirm("Are you sure you want to delete this item?")) return;
const delRes = await api(/${type}/${item.id}, { method: "DELETE" });
if (delRes.ok) {
showToast("Item deleted", "success");
loadList(type);
} else {
showToast("Failed to delete item", "error");
}
});
listEl.appendChild(row);
});
}
​function fillForm(type, item) {
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
renderPreviews("projectPreviewContainer", item.image_url, savedProjectImgUrl);
}
form.scrollIntoView({ behavior: "smooth" });
}
​function clearForm(type) {
const form = document.getElementById(CONFIG[type].formEl);
form.reset();
form.elements.namedItem("id").value = "";
if (type === "projects") {
document.getElementById("projectPreviewContainer").innerHTML = "";
savedProjectImgUrl = "";
}
}
​Object.keys(CONFIG).forEach(type => {
const form = document.getElementById(CONFIG[type].formEl);
form.addEventListener("submit", async (e) => {
e.preventDefault();
const body = {};
new FormData(form).forEach((v, k) => { if (k !== "id") body[k] = v; });
​const starredBox = form.elements.namedItem("starred");
if (starredBox) body.starred = starredBox.checked ? 1 : 0;
​const id = form.elements.namedItem("id").value;
const res = id ? await api(/${type}/${id}, { method: "PUT", body: JSON.stringify(body) })
: await api(/${type}, { method: "POST", body: JSON.stringify(body) });
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
​// ---------- 24h Instagram Stories & Reels ----------
​async function loadStories() {
const res = await api("/stories");
const stories = await res.json();
const listEl = document.getElementById("storiesList");
listEl.innerHTML = "";
if (!Array.isArray(stories) || !stories.length) {
listEl.innerHTML = '<p class="empty-note">No stories currently active.</p>';
return;
}
stories.forEach(s => {
const isVid = s.media_url.match(/.(mp4|webm|ogg|mov)$/i);
const row = document.createElement("div");
row.className = "card item-row";
row.innerHTML = <div style="display:flex; align-items:center; gap:14px;"> <div style="width:46px; height:46px; border-radius:10px; overflow:hidden; background:#000;"> ${isVid ?<video src="${escapeHtml(s.media_url)}" style="width:100%;height:100%;object-fit:cover;"></video>:<img src="${escapeHtml(s.media_url)}" style="width:100%;height:100%;object-fit:cover;" />} </div> <div> <strong>Story #${s.id}</strong> <div style="font-size:0.8rem; color:var(--text-faint);">${escapeHtml(s.caption || "No caption")} · ${new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div> </div> </div> <button type="button" class="icon-btn btn-danger del-story-btn">✕</button> ;
row.querySelector(".del-story-btn").addEventListener("click", async () => {
if (!confirm("Delete story?")) return;
const delRes = await api(/stories/${s.id}, { method: "DELETE" });
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
​document.getElementById("storyForm").addEventListener("submit", async (e) => {
e.preventDefault();
const media_url = document.getElementById("storyMediaUrlInput").value;
const caption = e.target.elements.namedItem("caption").value;
if (!media_url) {
showToast("Please upload media first", "error");
return;
}
const res = await api("/stories", { method: "POST", body: JSON.stringify({ media_url, caption }) });
if (res.ok) {
showToast("Story published to homepage ring!", "success");
document.getElementById("storyForm").reset();
document.getElementById("storyPreviewContainer").innerHTML = "";
loadStories();
} else {
showToast("Failed to publish story", "error");
}
});
​// ---------- Progress-Tracked File Uploads ----------
​document.querySelectorAll('input[type="file"][data-upload-target]').forEach(fileInput => {
fileInput.addEventListener("change", async (e) => {
const file = e.target.files[0];
if (!file) return;
​const targetId = fileInput.dataset.uploadTarget;
const progressId = fileInput.dataset.progressId;
const previewId = fileInput.dataset.previewId;
const targetInput = document.getElementById(targetId);
const track = document.getElementById(progressId);
const fill = track ? track.querySelector(".upload-progress-fill") : null;
​if (track) track.style.display = "block";
if (fill) fill.style.width = "0%";
​const xhr = new XMLHttpRequest();
xhr.open("POST", "/api/admin/upload");
xhr.withCredentials = true;
​xhr.upload.onprogress = (ev) => {
if (ev.lengthComputable && fill) {
const pct = Math.round((ev.loaded / ev.total) * 100);
fill.style.width = pct + "%";
}
};
​xhr.onload = () => {
if (xhr.status >= 200 && xhr.status < 300) {
try {
const data = JSON.parse(xhr.responseText);
targetInput.value = data.url;
if (targetId === "avatarUrlInput") renderPreviews(previewId, data.url, savedAvatarUrl);
else if (targetId === "projectImageUrlInput") renderPreviews(previewId, data.url, savedProjectImgUrl);
else renderPreviews(previewId, data.url, "");
showToast("Media uploaded successfully!", "success");
} catch (err) {
showToast("Upload response invalid", "error");
}
} else {
showToast("Upload failed — check size or credentials", "error");
}
if (track) setTimeout(() => { track.style.display = "none"; }, 900);
};
​xhr.onerror = () => {
showToast("Upload network failure", "error");
if (track) track.style.display = "none";
};
​const fd = new FormData();
fd.append("file", file);
xhr.send(fd);
});
});
​checkSession();
})();