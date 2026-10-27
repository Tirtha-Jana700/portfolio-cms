(function () {
  "use strict";

  const ICONS = {
    github: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12.03c0 5.05 3.29 9.33 7.84 10.84.57.1.78-.25.78-.55 0-.27-.01-1-.02-1.96-3.19.7-3.86-1.53-3.86-1.53-.52-1.34-1.28-1.7-1.28-1.7-1.04-.72.08-.7.08-.7 1.16.08 1.76 1.19 1.76 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.73-1.54-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.47.11-3.06 0 0 .97-.31 3.18 1.18a11.02 11.02 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.59.24 2.77.12 3.06.74.8 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.07.78 2.15 0 1.56-.01 2.81-.01 3.19 0 .3.2.66.79.55A10.53 10.53 0 0 0 23.5 12.03C23.5 5.73 18.27.5 12 .5z"/></svg>',
    linkedin: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.45v6.29zM5.34 7.43a2.07 2.07 0 1 1 0-4.14 2.07 2.07 0 0 1 0 4.14zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.8 0 0 .78 0 1.75v20.5C0 23.22.8 24 1.77 24h20.45c.98 0 1.78-.78 1.78-1.75V1.75C24 .78 23.2 0 22.22 0z"/></svg>',
    twitter: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 1.5h3.68l-8.04 9.19L24 22.5h-7.4l-5.8-7.58-6.63 7.58H.47l8.6-9.83L0 1.5h7.59l5.24 6.93 6.07-6.93zm-1.29 18.84h2.04L6.5 3.56H4.3l13.31 16.78z"/></svg>',
    instagram: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41-.56-.22-.96-.48-1.38-.9-.42-.42-.68-.82-.9-1.38-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.8.31-1.47.72-2.14 1.39A5.9 5.9 0 0 0 .62 4.15c-.3.76-.5 1.64-.56 2.91C0 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.31.8.72 1.47 1.39 2.14.67.67 1.34 1.08 2.14 1.39.76.3 1.64.5 2.91.56C8.33 24 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56.8-.31 1.47-.72 2.14-1.39.67-.67 1.08-1.34 1.39-2.14.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.9 5.9 0 0 0-1.39-2.14A5.9 5.9 0 0 0 19.85.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 12 18.16 6.16 6.16 0 0 0 12 5.84zm0 10.16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.4-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z"/></svg>',
    youtube: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 0 0 .5 6.2 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.8zM9.6 15.6V8.4L15.8 12z"/></svg>',
    website: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm7.94 10h-3.1a16.6 16.6 0 0 0-1.3-6.1A10.03 10.03 0 0 1 19.94 10zM12 2.08c.9 1.1 2.03 3.3 2.34 7.92H9.66C9.97 5.38 11.1 3.18 12 2.08zM9.46 3.9A16.6 16.6 0 0 0 8.16 10h-3.1A10.03 10.03 0 0 1 9.46 3.9zM5.06 12h3.1c.14 2.25.6 4.33 1.3 6.1A10.03 10.03 0 0 1 5.06 14H12zm2.6 0h4.68c-.31 4.62-1.44 6.82-2.34 7.92-.9-1.1-2.03-3.3-2.34-7.92z"/></svg>',
  };

  function iconFor(key) { return ICONS[key] || ICONS.website; }
  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html !== undefined) node.innerHTML = html;
    return node;
  }
  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  async function fetchPortfolio() {
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      return await res.json();
    } catch (e) { return null; }
  }

  // --- Stories Setup ---
  let currentStories = [];
  let storyIndex = 0;
  let storyTimer = null;

  function initStories(stories) {
    currentStories = stories || [];
    const ring = document.getElementById("avatarRing");
    const container = document.getElementById("avatarContainer");
    if (!currentStories.length) {
      ring.classList.add("watched");
      container.style.cursor = "default";
      return;
    }
    container.addEventListener("click", () => {
      if (!currentStories.length) return;
      ring.classList.add("watched");
      openStoryModal(0);
    });
  }

  function openStoryModal(index) {
    storyIndex = index;
    document.getElementById("storyModal").classList.add("active");
    renderStorySlide();
  }

  function renderStorySlide() {
    if (storyIndex >= currentStories.length) {
      closeStoryModal();
      return;
    }
    const story = currentStories[storyIndex];
    document.getElementById("storyImageWrap").innerHTML = `<img src="${escapeHtml(story.media_url)}" alt="Story" />`;
    document.getElementById("storyTimestamp").textContent = new Date(story.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

    const progressSegments = document.getElementById("storyProgressSegments");
    progressSegments.innerHTML = "";
    currentStories.forEach((_, i) => {
      const seg = el("div", "story-progress-segment");
      const fill = el("div", "story-progress-fill");
      if (i <= storyIndex) fill.style.width = "100%";
      seg.appendChild(fill);
      progressSegments.appendChild(seg);
    });

    clearTimeout(storyTimer);
    storyTimer = setTimeout(() => {
      storyIndex++;
      renderStorySlide();
    }, 5000);
  }

  function closeStoryModal() {
    clearTimeout(storyTimer);
    document.getElementById("storyModal").classList.remove("active");
  }

  document.getElementById("closeStoryBtn").addEventListener("click", closeStoryModal);

  // --- Render Sections ---
  function renderHero(p) {
    document.getElementById("heroName").textContent = p.full_name || "";
    document.getElementById("heroTitle").textContent = p.title || "";
    document.getElementById("heroTagline").textContent = p.tagline || "";

    if (p.avatar_url) {
      const img = document.getElementById("avatarImg");
      img.src = p.avatar_url;
      img.style.display = "block";
    }

    const actions = document.getElementById("heroActions");
    actions.innerHTML = "";
    if (p.resume_url) {
      const a = el("a", "btn btn-accent", "Download Resume");
      a.href = p.resume_url; a.target = "_blank"; a.rel = "noopener";
      actions.appendChild(a);
    }
    if (p.email) {
      const a = el("a", "btn", "Contact Me");
      a.href = "#contact";
      actions.appendChild(a);
    }

    const social = document.getElementById("socialRow");
    social.innerHTML = "";
    [["github_url", "github"], ["linkedin_url", "linkedin"], ["twitter_url", "twitter"],
     ["instagram_url", "instagram"], ["youtube_url", "youtube"]].forEach(([field, icon]) => {
      if (p[field]) {
        const a = el("a", "icon-btn", iconFor(icon));
        a.href = p[field]; a.target = "_blank"; a.rel = "noopener";
        social.appendChild(a);
      }
    });
  }

  function renderAbout(p) {
    const section = document.getElementById("about");
    if (!p.bio) { section.classList.add("hidden"); return; }
    document.getElementById("aboutBio").textContent = p.bio;
    section.classList.remove("hidden");
  }

  function renderSkills(skills) {
    const section = document.getElementById("skills");
    const grid = document.getElementById("skillsGrid");
    grid.innerHTML = "";
    if (!skills.length) { section.classList.add("hidden"); return; }

    skills.forEach(s => {
      const level = Math.max(0, Math.min(100, Number(s.level) || 0));
      const card = el("div", "card skill-card");
      card.innerHTML = `
        <div class="skill-name"><span>${escapeHtml(s.name)}</span><span>${level}%</span></div>
        <div class="skill-track"><div class="skill-fill" data-level="${level}"></div></div>
      `;
      grid.appendChild(card);
    });
    section.classList.remove("hidden");

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.querySelectorAll(".skill-fill").forEach(fill => {
            fill.style.width = fill.dataset.level + "%";
          });
        }
      });
    }, { threshold: 0.2 });
    observer.observe(section);
  }

  // --- Projects: Carousel / Grid toggle & Star Filter ---
  let allProjects = [];
  let currentFilter = "all";
  let currentView = "carousel";

  function renderProjects(projects) {
    allProjects = projects || [];
    const section = document.getElementById("projects");
    if (!allProjects.length) { section.classList.add("hidden"); return; }
    section.classList.remove("hidden");
    buildProjectsUI();
  }

  function buildProjectsUI() {
    const container = document.getElementById("projectsContainer");
    container.innerHTML = "";

    let filtered = allProjects;
    if (currentFilter === "starred") filtered = allProjects.filter(p => Number(p.starred) === 1);
    if (currentFilter === "unstarred") filtered = allProjects.filter(p => Number(p.starred) !== 1);

    if (!filtered.length) {
      container.innerHTML = '<p class="empty-note" style="text-align:center; padding:30px;">No projects found.</p>';
      return;
    }

    const wrapper = el("div", currentView === "carousel" ? "projects-carousel" : "projects-grid");
    filtered.forEach(p => {
      const tags = (p.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
      const card = el("div", "card project-card");
      let html = "";
      if (Number(p.starred) === 1) {
        html += `<div class="star-badge" title="Popular Project">★</div>`;
      }
      if (p.image_url) {
        html += `<div class="project-image"><img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" /></div>`;
      }
      html += `<div class="project-body">
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(p.description || "")}</p>
        <div class="tech-tags">${tags.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>
        <div class="project-links">
          ${p.live_url ? `<a class="btn btn-accent" href="${escapeHtml(p.live_url)}" target="_blank" rel="noopener">Live</a>` : ""}
          ${p.repo_url ? `<a class="btn" href="${escapeHtml(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ""}
        </div>
      </div>`;
      card.innerHTML = html;
      wrapper.appendChild(card);
    });
    container.appendChild(wrapper);
  }

  document.querySelectorAll("[data-filter]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      document.querySelectorAll("[data-filter]").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      currentFilter = e.target.dataset.filter;
      buildProjectsUI();
    });
  });

  document.getElementById("viewToggleBtn").addEventListener("click", () => {
    currentView = currentView === "carousel" ? "grid" : "carousel";
    document.getElementById("viewToggleBtn").textContent = currentView === "carousel" ? "Switch to Grid View" : "Switch to Carousel View";
    buildProjectsUI();
  });

  function renderExperience(items) {
    const section = document.getElementById("experience");
    const timeline = document.getElementById("timeline");
    timeline.innerHTML = "";
    if (!items.length) { section.classList.add("hidden"); return; }
    items.forEach(x => {
      const period = [x.start_date, x.end_date].filter(Boolean).join(" – ");
      const item = el("div", "card timeline-item");
      item.innerHTML = `
        <div class="timeline-top"><span class="badge type-badge">${x.type === "education" ? "Student" : "Work"}</span></div>
        <div class="role">${escapeHtml(x.role)}</div>
        ${x.organization ? `<div class="org">${escapeHtml(x.organization)}</div>` : ""}
        ${period ? `<div class="period">${escapeHtml(period)}</div>` : ""}
        ${x.description ? `<div class="desc">${escapeHtml(x.description)}</div>` : ""}
      `;
      timeline.appendChild(item);
    });
    section.classList.remove("hidden");
  }

  function renderContact(p) {
    const section = document.getElementById("contact");
    const grid = document.getElementById("contactGrid");
    grid.innerHTML = "";
    const items = [];
    if (p.email) items.push(["Email", p.email, "mailto:" + p.email]);
    if (p.location) {
      items.push(["Location", p.location, `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.location)}`]);
    }
    if (!items.length) { section.classList.add("hidden"); return; }
    items.forEach(([label, value, href]) => {
      const card = el("div", "card contact-card");
      card.innerHTML = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener"><div class="label">${escapeHtml(label)}</div><div class="value">${escapeHtml(value)}</div></a>`;
      grid.appendChild(card);
    });
    section.classList.remove("hidden");
  }

  function renderFooter(p) {
    document.getElementById("footerText").textContent = p.full_name ? `© ${new Date().getFullYear()} ${p.full_name}` : `© ${new Date().getFullYear()}`;
  }

  // --- Bouncy Sliding Nav Indicator Physics ---
  function initNavIndicator() {
    const navLinks = document.getElementById("navLinks");
    const indicator = document.getElementById("navIndicator");
    const links = Array.from(document.querySelectorAll(".nav-link"));

    function moveIndicator(link, animate) {
      if (!link) return;
      const lRect = link.getBoundingClientRect();
      const bRect = navLinks.getBoundingClientRect();
      indicator.style.width = lRect.width + "px";
      indicator.style.height = lRect.height + "px";
      indicator.style.left = (lRect.left - bRect.left) + "px";
      indicator.style.top = (lRect.top - bRect.top) + "px";

      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");

      if (animate) {
        link.classList.remove("bounce");
        void link.offsetWidth;
        link.classList.add("bounce");
      }
    }

    links.forEach(link => {
      link.addEventListener("click", () => moveIndicator(link, true));
    });

    const sections = links.map(l => document.querySelector(l.getAttribute("href"))).filter(Boolean);
    window.addEventListener("scroll", () => {
      let fromTop = window.scrollY + 140;
      sections.forEach((sec, idx) => {
        if (sec.offsetTop <= fromTop && sec.offsetTop + sec.offsetHeight > fromTop) {
          moveIndicator(links[idx], false);
        }
      });
    });

    if (links.length) moveIndicator(links[0], false);
  }

  function runIntro(profile) {
    const introScreen = document.getElementById("introScreen");
    const mainContent = document.getElementById("mainContent");
    if (profile.full_name) document.getElementById("introName").textContent = profile.full_name;
    if (profile.title) document.getElementById("introTitle").textContent = profile.title;
    if (profile.avatar_url) {
      const im = document.getElementById("introAvatarImg");
      im.src = profile.avatar_url;
      im.style.display = "block";
    }

    setTimeout(() => {
      introScreen.classList.add("intro-zoom");
      document.body.classList.remove("pre-reveal");
      mainContent.classList.add("revealed");
      initNavIndicator();
      setTimeout(() => { introScreen.style.display = "none"; }, 800);
    }, 2500);
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const data = await fetchPortfolio();
    const profile = (data && data.profile) || {};
    renderHero(profile);
    initStories((data && data.stories) || []);
    renderAbout(profile);
    renderSkills((data && data.skills) || []);
    renderProjects((data && data.projects) || []);
    renderExperience((data && data.experience) || []);
    renderContact(profile);
    renderFooter(profile);
    runIntro(profile);
  });
})();

