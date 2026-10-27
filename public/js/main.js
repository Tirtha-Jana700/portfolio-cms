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
    } catch (e) {
      console.error("Failed to load portfolio", e);
      return null;
    }
  }

  let globalPortfolioData = {};

  function renderHero(p) {
    document.getElementById("heroName").textContent = p.full_name || "";
    document.getElementById("heroTitle").textContent = p.title || "";
    document.getElementById("heroTagline").textContent = p.tagline || "";

    if (p.avatar_url) {
      const img = document.getElementById("avatarImg");
      img.src = p.avatar_url;
      img.alt = p.full_name || "";
      img.classList.remove("hidden");
    }

    const actions = document.getElementById("heroActions");
    actions.innerHTML = "";
    if (p.resume_url) {
      const a = el("a", "inline-flex items-center gap-2 bg-[#e6e7ee] border-none rounded-full shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#3a56d4] font-semibold text-sm px-6 py-3 cursor-pointer transition-all hover:-translate-y-0.5 active:shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]", "Download Resume");
      a.href = p.resume_url; a.target = "_blank"; a.rel = "noopener";
      actions.appendChild(a);
    }
    if (p.email) {
      const a = el("a", "inline-flex items-center gap-2 bg-[#e6e7ee] border-none rounded-full shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#2c2f45] font-semibold text-sm px-6 py-3 cursor-pointer transition-all hover:-translate-y-0.5 active:shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]", "Contact Me");
      a.href = "#contact";
      actions.appendChild(a);
    }

    const social = document.getElementById("socialRow");
    social.innerHTML = "";
    [["github_url", "github"], ["linkedin_url", "linkedin"], ["twitter_url", "twitter"],
     ["instagram_url", "instagram"], ["youtube_url", "youtube"]].forEach(([field, icon]) => {
      if (p[field]) {
        const a = el("a", "w-12 h-12 rounded-full inline-flex items-center justify-center bg-[#e6e7ee] shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#5f7291] text-lg transition-all hover:text-brandAccent hover:-translate-y-0.5 active:shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]", iconFor(icon));
        a.href = p[field]; a.target = "_blank"; a.rel = "noopener";
        social.appendChild(a);
      }
    });

    updateStoryRingState();
  }

  function updateStoryRingState() {
    const ring = document.getElementById("avatarRing");
    const stories = globalPortfolioData.stories || [];
    if (!stories.length) {
      ring.style.display = "none";
      return;
    }
    const seenKey = "portfolio_stories_seen_" + (stories.map(s => s.id).join("_"));
    if (localStorage.getItem(seenKey) === "true") {
      ring.className = "absolute inset-0 rounded-full p-1 bg-[#b7b8c2] transition-all duration-400";
    } else {
      ring.className = "absolute inset-0 rounded-full p-1 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] animate-pulse transition-all duration-400";
    }
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
      const card = el("div", "bg-[#e6e7ee] rounded-[26px] shadow-[8px_8px_18px_#b7b8c2,-8px_-8px_18px_#ffffff] p-6 transition-all");
      card.innerHTML = `
        <div class="flex justify-between font-bold mb-3"><span>${escapeHtml(s.name)}</span><span class="text-[#93a5be] font-semibold">${level}%</span></div>
        <div class="h-2.5 rounded-full shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff] overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-brandAccent to-brandAccent2 transition-all duration-1000 ease-apple-spring skill-fill" data-level="${level}" style="width:0%"></div>
        </div>
      `;
      grid.appendChild(card);
    });
    section.classList.remove("hidden");
  }

  let currentProjectFilter = "all";
  let isCarouselView = false;
  let autoScrollTimer = null;
  let isAutoScrolling = false;

  function renderProjects(projects) {
    const section = document.getElementById("projects");
    const grid = document.getElementById("projectsGrid");
    grid.innerHTML = "";
    if (!projects.length) { section.classList.add("hidden"); return; }

    let filtered = projects;
    if (currentProjectFilter === "starred") {
      filtered = projects.filter(p => Number(p.starred) === 1);
    }

    if (!filtered.length) {
      grid.innerHTML = '<p class="text-center text-[#93a5be] text-sm col-span-full">No projects match this filter.</p>';
      section.classList.remove("hidden");
      return;
    }

    filtered.forEach(p => {
      const isStarred = Number(p.starred) === 1;
      const tags = (p.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
      const card = el("div", `bg-[#e6e7ee] rounded-[26px] shadow-[8px_8px_18px_#b7b8c2,-8px_-8px_18px_#ffffff] p-0 overflow-hidden relative transition-all duration-300 hover:-translate-y-1 project-card ${isStarred ? "starred-card" : ""}`);
      let html = "";
      if (p.image_url) {
        html += `<div class="aspect-[16/10] bg-[#e6e7ee] shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff] m-3.5 rounded-[18px] overflow-hidden"><img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover" /></div>`;
      }
      html += `<div class="p-6 pt-2">
        <h3 class="text-lg font-bold mb-2">${escapeHtml(p.title)}</h3>
        <p class="text-[#5f7291] text-sm mb-4">${escapeHtml(p.description || "")}</p>
        <div class="flex flex-wrap gap-1.5 mb-5">${tags.map(t => `<span class="inline-block bg-[#e6e7ee] shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff] text-[#5f7291] rounded-full px-3.5 py-1 text-xs font-semibold">${escapeHtml(t)}</span>`).join("")}</div>
        <div class="flex gap-2.5">
          ${p.live_url ? `<a class="inline-flex items-center gap-2 bg-[#e6e7ee] border-none rounded-full shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#3a56d4] font-semibold text-xs px-4 py-2 cursor-pointer transition-all hover:-translate-y-0.5 active:shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]" href="${escapeHtml(p.live_url)}" target="_blank" rel="noopener">Live</a>` : ""}
          ${p.repo_url ? `<a class="inline-flex items-center gap-2 bg-[#e6e7ee] border-none rounded-full shadow-[4px_4px_9px_#b7b8c2,-4px_-4px_9px_#ffffff] text-[#2c2f45] font-semibold text-xs px-4 py-2 cursor-pointer transition-all hover:-translate-y-0.5 active:shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]" href="${escapeHtml(p.repo_url)}" target="_blank" rel="noopener">Code</a>` : ""}
        </div>
      </div>`;
      card.innerHTML = html;
      grid.appendChild(card);
    });
    section.classList.remove("hidden");
  }

  document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".filter-btn").forEach(b => {
          b.classList.remove("active", "text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
          b.classList.add("text-[#5f7291]");
        });
        btn.classList.add("active", "text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
        btn.classList.remove("text-[#5f7291]");
        currentProjectFilter = btn.dataset.filter;
        renderProjects(globalPortfolioData.projects || []);
      });
    });

    const viewToggleBtn = document.getElementById("viewToggleBtn");
    const gridEl = document.getElementById("projectsGrid");
    const iconGrid = document.getElementById("viewIconGrid");
    const iconCarousel = document.getElementById("viewIconCarousel");

    viewToggleBtn.addEventListener("click", () => {
      isCarouselView = !isCarouselView;
      if (isCarouselView) {
        gridEl.classList.add("carousel-view");
        iconGrid.style.display = "none";
        iconCarousel.style.display = "block";
      } else {
        gridEl.classList.remove("carousel-view");
        iconGrid.style.display = "block";
        iconCarousel.style.display = "none";
      }
    });

    const autoScrollBtn = document.getElementById("autoScrollToggleBtn");
    autoScrollBtn.addEventListener("click", () => {
      isAutoScrolling = !isAutoScrolling;
      if (isAutoScrolling) {
        autoScrollBtn.textContent = "Auto-scroll: On";
        autoScrollBtn.classList.add("text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
        autoScrollTimer = setInterval(() => {
          if (gridEl.classList.contains("carousel-view")) {
            gridEl.scrollBy({ left: 320, behavior: "smooth" });
            if (gridEl.scrollLeft + gridEl.clientWidth >= gridEl.scrollWidth - 10) {
              gridEl.scrollTo({ left: 0, behavior: "smooth" });
            }
          }
        }, 3000);
      } else {
        autoScrollBtn.textContent = "Auto-scroll: Off";
        autoScrollBtn.classList.remove("text-brandAccent", "shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff]");
        clearInterval(autoScrollTimer);
      }
    });
  });

  function renderExperience(items) {
    const section = document.getElementById("experience");
    const timeline = document.getElementById("timeline");
    timeline.innerHTML = "";
    if (!items.length) { section.classList.add("hidden"); return; }
    items.forEach(x => {
      const period = [x.start_date, x.end_date].filter(Boolean).join(" – ");
      const typeLabel = x.type === "education" ? "Student" : "Work";
      const item = el("div", "bg-[#e6e7ee] rounded-[26px] shadow-[8px_8px_18px_#b7b8c2,-8px_-8px_18px_#ffffff] p-7 transition-all");
      item.innerHTML = `
        <div class="mb-2"><span class="inline-block bg-[#e6e7ee] shadow-[inset_3px_3px_7px_#b7b8c2,inset_-3px_-3px_7px_#ffffff] text-[#5f7291] rounded-full px-3.5 py-1 text-xs font-semibold ${x.type === "education" ? "text-brandAccent" : ""}">${typeLabel}</span></div>
        <div class="font-bold text-lg">${escapeHtml(x.role)}</div>
        ${x.organization ? `<div class="text-brandAccent font-semibold text-sm mt-0.5">${escapeHtml(x.organization)}</div>` : ""}
        ${period ? `<div class="text-[#93a5be] text-xs mt-1">${escapeHtml(period)}</div>` : ""}
        ${x.description ? `<div class="text-[#5f7291] text-sm mt-3 whitespace-pre-line">${escapeHtml(x.description)}</div>` : ""}
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
    if (p.location) items.push(["Location", p.location, "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(p.location)]);
    if (!items.length) { section.classList.add("hidden"); return; }
    items.forEach(([label, value, href]) => {
      const card = el("div", "bg-[#e6e7ee] rounded-[26px] shadow-[8px_8px_18px_#b7b8c2,-8px_-8px_18px_#ffffff] p-7 text-center transition-all");
      const inner = `<div class="text-[#93a5be] text-xs font-bold uppercase tracking-wider mb-2">${escapeHtml(label)}</div><div class="font-semibold text-sm break-words transition-colors hover:text-brandAccent">${escapeHtml(value)}</div>`;
      const a = el("a", "block", inner);
      a.href = href;
      if (href.startsWith("http")) { a.target = "_blank"; a.rel = "noopener"; }
      card.appendChild(a);
      grid.appendChild(card);
    });
    section.classList.remove("hidden");
  }

  function renderFooter(p) {
    const year = new Date().getFullYear();
    document.getElementById("footerText").textContent = p.full_name ? `© ${year} ${p.full_name}` : `© ${year}`;
  }

  function initScrollReveal() {
    const targets = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window) || !targets.length) {
      targets.forEach(t => t.classList.add("in-view"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
        }
      });
    }, { threshold: 0.1 });
    targets.forEach(t => io.observe(t));
  }

  function initSkillsReveal() {
    const section = document.getElementById("skills");
    if (!section || !("IntersectionObserver" in window)) {
      document.querySelectorAll(".skill-fill").forEach(f => { f.style.width = f.dataset.level + "%"; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const fills = entry.target.querySelectorAll(".skill-fill");
        if (entry.isIntersecting) {
          fills.forEach((f, i) => setTimeout(() => { f.style.width = f.dataset.level + "%"; }, i * 80));
        } else {
          fills.forEach(f => { f.style.width = "0%"; });
        }
      });
    }, { threshold: 0.25 });
    io.observe(section);
  }

  function initNav() {
    const navLinks = document.getElementById("navLinks");
    const indicator = document.getElementById("navIndicator");
    const links = Array.from(document.querySelectorAll(".nav-link") || document.querySelectorAll("#navLinks a"));

    function positionIndicator(link) {
      if (!link) return;
      const lRect = link.getBoundingClientRect();
      const pRect = navLinks.getBoundingClientRect();
      indicator.style.width = lRect.width + "px";
      indicator.style.height = lRect.height + "px";
      indicator.style.left = (lRect.left - pRect.left) + "px";
      indicator.style.top = (lRect.top - pRect.top) + "px";
    }

    function setActive(link, animate) {
      links.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      positionIndicator(link);
      if (animate) {
        link.classList.remove("animate-bounce");
        void link.offsetWidth;
        link.classList.add("animate-bounce");
      }
    }

    links.forEach(link => {
      link.addEventListener("click", () => setActive(link, true));
    });

    const sections = links.map(l => {
      const id = l.getAttribute("href").substring(1);
      return document.getElementById(id);
    }).filter(Boolean);

    window.addEventListener("scroll", () => {
      const scrollPos = window.scrollY + 140;
      for (let i = sections.length - 1; i >= 0; i--) {
        const sec = sections[i];
        if (sec && !sec.classList.contains("hidden") && sec.offsetTop <= scrollPos) {
          const currentActive = links.find(l => l.getAttribute("href") === "#" + sec.id);
          if (currentActive && !currentActive.classList.contains("active")) {
            setActive(currentActive, false);
          }
          break;
        }
      }
    });

    const initialLink = links[0];
    if (initialLink) setActive(initialLink, false);
    window.addEventListener("resize", () => {
      const active = document.querySelector("#navLinks a.active") || links[0];
      if (active) positionIndicator(active);
    });
  }

  let currentStoryIndex = 0;
  let storyTimer = null;

  function initStoryViewer() {
    const wrap = document.getElementById("avatarFrameWrap");
    const modal = document.getElementById("storyModal");
    const closeBtn = document.getElementById("storyCloseBtn");
    const prevBtn = document.getElementById("storyPrevBtn");
    const nextBtn = document.getElementById("storyNextBtn");

    wrap.addEventListener("click", () => {
      const stories = globalPortfolioData.stories || [];
      if (!stories.length) return;
      currentStoryIndex = 0;
      openStoryModal();
    });

    closeBtn.addEventListener("click", closeStoryModal);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeStoryModal();
    });

    prevBtn.addEventListener("click", () => {
      if (currentStoryIndex > 0) {
        currentStoryIndex--;
        playStory(currentStoryIndex);
      }
    });

    nextBtn.addEventListener("click", () => {
      const stories = globalPortfolioData.stories || [];
      if (currentStoryIndex < stories.length - 1) {
        currentStoryIndex++;
        playStory(currentStoryIndex);
      } else {
        closeStoryModal();
      }
    });
  }

  function openStoryModal() {
    const modal = document.getElementById("storyModal");
    modal.classList.remove("hidden");
    const profile = globalPortfolioData.profile || {};
    document.getElementById("storyModalName").textContent = profile.full_name || "Portfolio";
    if (profile.avatar_url) document.getElementById("storyModalAvatar").src = profile.avatar_url;
    
    buildStoryProgressBars();
    playStory(0);
  }

  function closeStoryModal() {
    const modal = document.getElementById("storyModal");
    modal.classList.add("hidden");
    if (storyTimer) clearTimeout(storyTimer);
    const stories = globalPortfolioData.stories || [];
    if (stories.length) {
      const seenKey = "portfolio_stories_seen_" + (stories.map(s => s.id).join("_"));
      localStorage.setItem(seenKey, "true");
      updateStoryRingState();
    }
  }

  function buildStoryProgressBars() {
    const container = document.getElementById("storyProgressBars");
    container.innerHTML = "";
    const stories = globalPortfolioData.stories || [];
    stories.forEach(() => {
      const seg = el("div", "flex-1 bg-white/35 rounded-full overflow-hidden h-full");
      seg.appendChild(el("div", "h-full w-0 bg-white transition-all duration-linear"));
      container.appendChild(seg);
    });
  }

  function playStory(index) {
    if (storyTimer) clearTimeout(storyTimer);
    const stories = globalPortfolioData.stories || [];
    if (!stories[index]) { closeStoryModal(); return; }

    currentStoryIndex = index;
    const story = stories[index];

    const segments = document.querySelectorAll("#storyProgressBars > div");
    segments.forEach((seg, i) => {
      const fill = seg.querySelector("div");
      fill.style.transition = "none";
      fill.style.width = "0%";
      if (i < index) {
        fill.style.width = "100%";
      } else if (i === index) {
        setTimeout(() => {
          fill.style.transition = "width 5s linear";
          fill.style.width = "100%";
        }, 50);
      }
    });

    const stage = document.getElementById("storyMediaStage");
    stage.innerHTML = "";
    const isVid = story.media_url.match(/\.(mp4|webm|ogg|mov)$/i);
    if (isVid) {
      const vid = document.createElement("video");
      vid.src = story.media_url;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.className = "w-full h-full object-contain";
      vid.onended = () => {
        if (currentStoryIndex < stories.length - 1) playStory(currentStoryIndex + 1);
        else closeStoryModal();
      };
      stage.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = story.media_url;
      img.className = "w-full h-full object-contain";
      stage.appendChild(img);
      storyTimer = setTimeout(() => {
        if (currentStoryIndex < stories.length - 1) playStory(currentStoryIndex + 1);
        else closeStoryModal();
      }, 5000);
    }

    const captionBox = document.getElementById("storyCaptionText");
    captionBox.textContent = story.caption || "";
    captionBox.style.display = story.caption ? "block" : "none";
  }

  function runIntro(profile) {
    const introScreen = document.getElementById("introScreen");
    const mainContent = document.getElementById("mainContent");
    document.getElementById("introName").textContent = profile.full_name || "";
    document.getElementById("introTitle").textContent = profile.title || "";
    if (profile.avatar_url) {
      const introAvatarImg = document.getElementById("introAvatarImg");
      introAvatarImg.src = profile.avatar_url;
      introAvatarImg.classList.remove("hidden");
    }

    setTimeout(() => {
      const ring = document.getElementById("introProgressRing");
      if (ring) ring.style.strokeDashoffset = "0";
      setTimeout(() => {
        introScreen.classList.add("intro-zoom");
        document.body.classList.remove("pre-reveal");
        mainContent.classList.remove("opacity-0");
        initScrollReveal();
        initSkillsReveal();
        initNav();
        initStoryViewer();
        setTimeout(() => { introScreen.style.display = "none"; }, 950);
      }, 420);
    }, 500);
  }

  document.addEventListener("DOMContentLoaded", () => {
    fetchPortfolio().then(data => {
      if (!data) return;
      globalPortfolioData = data;
      const profile = data.profile || {};
      renderHero(profile);
      renderAbout(profile);
      renderSkills(data.skills || []);
      renderProjects(data.projects || []);
      renderExperience(data.experience || []);
      renderContact(profile);
      renderFooter(profile);
      runIntro(profile);
    });
  });
})();

