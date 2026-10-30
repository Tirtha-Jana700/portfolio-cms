/**
 * ============================================================================
 * Neumorphic Dynamic Portfolio Engine (public/js/main.js)
 * ============================================================================
 * Features:
 *  1. Typography Stagger & Fly-Through Intro
 *  2. Day/Night Theme Toggle (Device Defaults + LocalStorage)
 *  3. Seamless Infinite DOM-Cloning Auto-Scroll
 *  4. 24h Story Viewer & Neumorphic Physics Navigation
 * ============================================================================
 */

(() => {
  "use strict";

  const CONFIG = {
    API_ENDPOINT: "/api/portfolio",
    STORY_IMAGE_DURATION_MS: 5000,
    SEEN_STORIES_STORAGE_KEY: "portfolio_seen_stories_v1",
    THEME_STORAGE_KEY: "portfolio_theme_pref",
    AUTO_SCROLL_SPEED_PX: 1.2,
    INTRO_HOLD_MS: 900,
    INTRO_CLEANUP_MS: 1200
  };

  const state = {
    profile: {}, skills: [], projects: [], experience: [], stories: [],
    activeFilter: "all", viewMode: "carousel",
    autoScrollEnabled: true, autoScrollPaused: false, autoScrollRafId: null,
    storyIndex: 0, storyMuted: false, storyRafId: null, storyStartTime: 0, storyModalOpen: false,
    scrollObserver: null
  };

  function escapeHtml(val) {
    if (val === null || val === undefined) return "";
    return String(val).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function formatTimeAgo(dateInput) {
    if (!dateInput) return "Just now";
    const raw = String(dateInput).trim();
    const parsed = typeof dateInput === "number" ? (dateInput < 1e12 ? dateInput * 1000 : dateInput) : Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
    if (Number.isNaN(parsed)) return "Recently";
    const diff = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
    if (diff < 60) return "Just now";
    const diffM = Math.floor(diff / 60);
    if (diffM < 60) return `${diffM}m ago`;
    const diffH = Math.floor(diffM / 60);
    if (diffH < 24) return `${diffH}h ago`;
    return `${Math.floor(diffH / 24)}d ago`;
  }

  function isVideoStory(story) {
    if (!story || !story.media_url) return false;
    const url = String(story.media_url).trim().toLowerCase();
    if (url.startsWith("data:video/")) return true;
    return /\.(mp4|webm|ogg|mov|m4v)$/.test(url.split("?")[0].split("#")[0]);
  }

  function extractSocials(profile) {
    if (!profile) return [];
    const mapping = [
      { key: "github_url", label: "GitHub" }, { key: "linkedin_url", label: "LinkedIn" },
      { key: "twitter_url", label: "Twitter / X" }, { key: "instagram_url", label: "Instagram" },
      { key: "youtube_url", label: "YouTube" }
    ];
    const list = [];
    mapping.forEach(({ key, label }) => {
      const url = profile[key] ? String(profile[key]).trim() : "";
      if (url) list.push({ platform: label, url });
    });
    return list;
  }

  // --------------------------------------------------------------------------
  // 1. Day / Night Theme Engine
  // --------------------------------------------------------------------------
  function initThemeEngine() {
    const btn = document.getElementById("themeToggleBtn");
    const icon = document.getElementById("themeIcon");
    const metaColor = document.getElementById("metaThemeColor");
    
    // Check saved override first, fallback to device pref
    const saved = localStorage.getItem(CONFIG.THEME_STORAGE_KEY);
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    let currentTheme = saved ? saved : (prefersDark ? "dark" : "light");

    const applyTheme = (theme) => {
      document.documentElement.setAttribute("data-theme", theme);
      if (icon) icon.textContent = theme === "light" ? "🌙" : "☀️";
      if (metaColor) metaColor.setAttribute("content", theme === "light" ? "#e2e8f0" : "#2b2d35");
    };

    applyTheme(currentTheme);

    if (btn) {
      btn.addEventListener("click", () => {
        currentTheme = currentTheme === "light" ? "dark" : "light";
        localStorage.setItem(CONFIG.THEME_STORAGE_KEY, currentTheme);
        applyTheme(currentTheme);
      });
    }

    // Listen to system changes if no override exists
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!localStorage.getItem(CONFIG.THEME_STORAGE_KEY)) {
        currentTheme = e.matches ? "dark" : "light";
        applyTheme(currentTheme);
      }
    });
  }

  // --------------------------------------------------------------------------
  // 2. Typography Stagger & Fly-Through Intro
  // --------------------------------------------------------------------------
  function populateIntro(profile) {
    const textContainer = document.getElementById("introDynamicText");
    if (!textContainer) return;

    // Use full name, split into animating characters
    const nameStr = (profile.full_name || profile.name || "PORTFOLIO").toUpperCase();
    
    textContainer.innerHTML = nameStr.split("").map((char, i) => {
        if (char === " ") return `<span class="intro-char" style="width: 20px;">&nbsp;</span>`;
        // Stagger the animation delay based on index
        return `<span class="intro-char" style="animation-delay: ${i * 0.08}s">${escapeHtml(char)}</span>`;
    }).join("");
  }

  function finishIntro() {
    const introScreen = document.getElementById("introScreen");
    if (!introScreen) {
      document.body.classList.remove("pre-reveal");
      return;
    }

    // Trigger staggered character slide-up
    introScreen.classList.add("intro-ready");

    // Wait for slide-up to finish, then trigger Fly-Through scale
    setTimeout(() => {
      introScreen.classList.add("intro-zoom");
      document.body.classList.remove("pre-reveal");

      requestAnimationFrame(() => updateNavIndicator());

      // Remove from DOM once zoomed past camera
      setTimeout(() => {
        introScreen.classList.add("hidden");
      }, CONFIG.INTRO_CLEANUP_MS);
      
    }, CONFIG.INTRO_HOLD_MS);
  }

  // --------------------------------------------------------------------------
  // 3. Navigation & Hero / Profile Render (Phone Removed)
  // --------------------------------------------------------------------------
  function updateNavIndicator(targetLink) {
    const navLinksContainer = document.getElementById("navLinks");
    const indicator = document.getElementById("navIndicator");
    if (!navLinksContainer || !indicator) return;

    const activeLink = targetLink || navLinksContainer.querySelector(".nav-link.active") || navLinksContainer.querySelector(".nav-link");
    if (!activeLink) return;

    const containerRect = navLinksContainer.getBoundingClientRect();
    const linkRect = activeLink.getBoundingClientRect();

    const left = linkRect.left - containerRect.left + navLinksContainer.scrollLeft;
    const top = linkRect.top - containerRect.top;

    indicator.classList.add("stretching");
    indicator.style.width = `${linkRect.width}px`;
    indicator.style.height = `${linkRect.height}px`;
    indicator.style.left = `${left}px`;
    indicator.style.top = `${top}px`;

    clearTimeout(indicator._stretchTimer);
    indicator._stretchTimer = setTimeout(() => { indicator.classList.remove("stretching"); }, 320);
  }

  function initNav() {
    const navLinksContainer = document.getElementById("navLinks");
    if (!navLinksContainer) return;

    const links = Array.from(navLinksContainer.querySelectorAll(".nav-link:not(.theme-toggle-btn)"));
    if (!links.length) return;

    links[0].classList.add("active");
    requestAnimationFrame(() => updateNavIndicator(links[0]));

    links.forEach((link) => {
      link.addEventListener("click", () => {
        links.forEach((l) => l.classList.remove("active", "bounce"));
        void link.offsetWidth;
        link.classList.add("active", "bounce");
        updateNavIndicator(link);
      });
    });

    window.addEventListener("resize", () => updateNavIndicator());

    const sectionIds = links.map(l => l.getAttribute("href")).filter(h => h?.startsWith("#")).map(h => h.slice(1));
    const spyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const matchingLink = links.find(l => l.getAttribute("href") === `#${entry.target.id}`);
          if (matchingLink && !matchingLink.classList.contains("active")) {
            links.forEach(l => l.classList.remove("active"));
            matchingLink.classList.add("active");
            updateNavIndicator(matchingLink);
          }
        }
      });
    }, { rootMargin: "-35% 0px -55% 0px", threshold: 0.05 });

    sectionIds.forEach((id) => {
      const sectionEl = document.getElementById(id);
      if (sectionEl) spyObserver.observe(sectionEl);
    });
  }

  function renderProfile(profile) {
    const fullName = profile.full_name || profile.name || "Portfolio";
    document.title = `${fullName} — Portfolio`;

    const els = {
      brand: document.getElementById("brandText"), heroName: document.getElementById("heroName"),
      title: document.getElementById("heroTitle"), tagline: document.getElementById("heroTagline"),
      avatarImg: document.getElementById("avatarImg"), fallback: document.getElementById("avatarFallback"),
      actions: document.getElementById("heroActions"), social: document.getElementById("socialRow"),
      about: document.getElementById("about"), bio: document.getElementById("aboutBio"),
      contact: document.getElementById("contact"), contactGrid: document.getElementById("contactGrid"),
      footer: document.getElementById("footerText")
    };

    if (els.brand) els.brand.textContent = fullName;
    if (els.heroName) els.heroName.textContent = fullName;
    if (els.title) els.title.textContent = profile.title || "";
    if (els.tagline) els.tagline.textContent = profile.tagline || "";

    if (els.avatarImg && profile.avatar_url) {
      els.avatarImg.src = profile.avatar_url;
      els.avatarImg.alt = fullName;
      els.avatarImg.style.display = "block";
      if (els.fallback) els.fallback.style.display = "none";
    }

    if (els.actions) {
      const html = [`<a href="#projects" class="btn btn-accent">View Projects</a>`];
      if (profile.resume_url) html.push(`<a href="${escapeHtml(profile.resume_url)}" class="btn" target="_blank">Resume ↗</a>`);
      if (profile.email) html.push(`<a href="mailto:${escapeHtml(profile.email)}" class="btn">Get In Touch</a>`);
      els.actions.innerHTML = html.join("");
    }

    const socials = extractSocials(profile);
    if (els.social) {
      els.social.innerHTML = socials.map(s => `<a href="${escapeHtml(s.url)}" class="btn" target="_blank">${escapeHtml(s.platform)}</a>`).join("");
    }

    if (els.about && els.bio && profile.bio) {
      els.bio.textContent = profile.bio;
      els.about.classList.remove("hidden");
    }

    // Contact Cards (Phone Removed completely)
    if (els.contact && els.contactGrid) {
      const cards = [];
      if (profile.email) cards.push({ label: "Email", value: profile.email, href: `mailto:${profile.email}` });
      if (profile.location) cards.push({ label: "Location", value: profile.location, href: null });
      socials.forEach(s => cards.push({ label: s.platform, value: s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: s.url }));

      if (cards.length > 0) {
        els.contactGrid.innerHTML = cards.map(c => {
          const inner = `<div class="label">${escapeHtml(c.label)}</div><div class="value">${escapeHtml(c.value)}</div>`;
          return c.href ? `<a href="${escapeHtml(c.href)}" target="_blank" class="card contact-card scroll-item-ltr">${inner}</a>` : `<div class="card contact-card scroll-item-ltr">${inner}</div>`;
        }).join("");
        els.contact.classList.remove("hidden");
      }
    }

    if (els.footer) els.footer.textContent = `© ${new Date().getFullYear()} ${fullName}. All rights reserved.`;
  }

  // --------------------------------------------------------------------------
  // 4. Stories & Modules
  // --------------------------------------------------------------------------
  function getSeenStoryIds() {
    try { return JSON.parse(localStorage.getItem(CONFIG.SEEN_STORIES_STORAGE_KEY) || "[]").map(String); } catch { return []; }
  }
  function markStorySeen(id) {
    if (id == null) return;
    const seen = new Set(getSeenStoryIds()); seen.add(String(id));
    try { localStorage.setItem(CONFIG.SEEN_STORIES_STORAGE_KEY, JSON.stringify([...seen])); } catch {}
    updateAvatarStoryRingState();
  }
  function updateAvatarStoryRingState() {
    const frame = document.getElementById("avatarFrame"), badge = document.getElementById("storyBadge");
    if (!frame) return;
    if (!state.stories.length) {
      frame.classList.remove("has-story", "story-unseen", "story-seen");
      if (badge) badge.classList.add("hidden");
      return;
    }
    const seenIds = new Set(getSeenStoryIds());
    const allSeen = state.stories.every(s => seenIds.has(String(s.id)));
    frame.classList.add("has-story");
    frame.classList.toggle("story-unseen", !allSeen);
    frame.classList.toggle("story-seen", allSeen);
    if (badge) { badge.classList.remove("hidden"); badge.textContent = allSeen ? "REPLAY" : "STORY"; }
  }

  function initStories(stories) {
    const cutoffMs = Date.now() - 24 * 3600000;
    state.stories = (Array.isArray(stories) ? stories : []).filter(s => {
      if (!s || !s.media_url) return false;
      if (!s.created_at) return true;
      const ts = typeof s.created_at === "number" ? (s.created_at < 1e12 ? s.created_at * 1000 : s.created_at) : Date.parse(String(s.created_at).replace(" ", "T") + "Z");
      return Number.isNaN(ts) ? true : ts >= cutoffMs;
    });
    updateAvatarStoryRingState();

    const frame = document.getElementById("avatarFrame");
    if (frame) frame.addEventListener("click", () => {
      if (!state.stories.length) return;
      const seenIds = new Set(getSeenStoryIds());
      const firstUnseen = state.stories.findIndex(s => !seenIds.has(String(s.id)));
      openStoryModal(firstUnseen >= 0 ? firstUnseen : 0);
    });

    document.getElementById("storyCloseBtn")?.addEventListener("click", closeStoryModal);
    document.getElementById("storyBackdrop")?.addEventListener("click", closeStoryModal);
    document.getElementById("storyPrevZone")?.addEventListener("click", () => stepStory(-1));
    document.getElementById("storyNextZone")?.addEventListener("click", () => stepStory(1));
    document.getElementById("storyMuteBtn")?.addEventListener("click", () => {
      const v = document.getElementById("storyVideoEl");
      state.storyMuted = !state.storyMuted;
      if (v) v.muted = state.storyMuted;
      const icon = document.getElementById("storyMuteIcon");
      if (icon) icon.textContent = state.storyMuted ? "🔇" : "🔊";
    });
  }

  function openStoryModal(idx) {
    const m = document.getElementById("storyModal"), r = document.getElementById("storyProgressRow");
    if (!m || !state.stories.length) return;
    state.storyModalOpen = true; m.classList.remove("hidden"); document.body.style.overflow = "hidden";
    
    document.getElementById("storyUserName").textContent = state.profile.full_name || "Story";
    const av = document.getElementById("storyUserAvatar");
    if (state.profile.avatar_url) { av.src = state.profile.avatar_url; av.style.display = "block"; } else { av.style.display = "none"; }
    
    if (r) r.innerHTML = state.stories.map((_, i) => `<div class="story-seg"><div class="story-seg-fill" id="storySegFill-${i}"></div></div>`).join("");
    showStoryAtIndex(idx);
  }

  function stopCurrentStory() {
    if (state.storyRafId) cancelAnimationFrame(state.storyRafId);
    state.storyRafId = null;
    const v = document.getElementById("storyVideoEl");
    if (v) { v.pause(); v.onended = null; v.ontimeupdate = null; v.removeAttribute("src"); v.load(); }
  }

  function closeStoryModal() {
    stopCurrentStory(); state.storyModalOpen = false;
    document.getElementById("storyModal")?.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function stepStory(dir) {
    const next = state.storyIndex + dir;
    if (next < 0) showStoryAtIndex(0); else if (next >= state.stories.length) closeStoryModal(); else showStoryAtIndex(next);
  }

  function setSegFill(idx, pct) {
    const e = document.getElementById(`storySegFill-${idx}`);
    if (e) e.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  }

  function showStoryAtIndex(index) {
    stopCurrentStory(); state.storyIndex = index;
    const story = state.stories[index];
    if (!story) return closeStoryModal();

    state.stories.forEach((_, i) => setSegFill(i, i < index ? 100 : 0));
    markStorySeen(story.id ?? index);

    document.getElementById("storyTimeAgo").textContent = formatTimeAgo(story.created_at);
    const cb = document.getElementById("storyCaptionBar"), ct = document.getElementById("storyCaptionText");
    if (cb && ct) {
      if (story.caption) { ct.textContent = story.caption; cb.classList.remove("hidden"); } else { ct.textContent = ""; cb.classList.add("hidden"); }
    }

    const img = document.getElementById("storyImgEl"), vid = document.getElementById("storyVideoEl"), mute = document.getElementById("storyMuteBtn");
    if (isVideoStory(story)) {
      img.classList.add("hidden"); mute.classList.remove("hidden"); vid.classList.remove("hidden");
      vid.src = story.media_url; vid.muted = state.storyMuted;
      vid.ontimeupdate = () => { if (vid.duration) setSegFill(index, (vid.currentTime / vid.duration) * 100); };
      vid.onended = () => { setSegFill(index, 100); stepStory(1); };
      const p = vid.play();
      if (p !== undefined) p.catch(() => { state.storyMuted = true; vid.muted = true; document.getElementById("storyMuteIcon").textContent = "🔇"; vid.play().catch(()=>{}); });
    } else {
      vid.classList.add("hidden"); mute.classList.add("hidden"); img.classList.remove("hidden"); img.src = story.media_url;
      state.storyStartTime = performance.now();
      const tick = (now) => {
        if (!state.storyModalOpen || state.storyIndex !== index) return;
        const elapsed = now - state.storyStartTime, pct = (elapsed / CONFIG.STORY_IMAGE_DURATION_MS) * 100;
        setSegFill(index, pct);
        if (elapsed >= CONFIG.STORY_IMAGE_DURATION_MS) stepStory(1); else state.storyRafId = requestAnimationFrame(tick);
      };
      state.storyRafId = requestAnimationFrame(tick);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Portfolios & Flawless Seamless Auto-Scroll
  // --------------------------------------------------------------------------
  function buildProjectCardHtml(p) {
    const isStar = Number(p.starred) === 1;
    const tags = Array.isArray(p.tech_stack) ? p.tech_stack : String(p.tech_stack || "").split(",").map(t => t.trim()).filter(Boolean);
    return `
      <article class="card project-card scroll-item-ltr">
        ${isStar ? `<div class="project-star-ribbon">★ Popular</div>` : ""}
        ${p.image_url ? `<div class="project-image"><img src="${escapeHtml(p.image_url)}" loading="lazy" /></div>` : ""}
        <div class="project-body">
          <h3>${escapeHtml(p.title || "Untitled")}</h3>
          <p>${escapeHtml(p.description || "")}</p>
          ${tags.length ? `<div class="tech-tags">${tags.map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("")}</div>` : ""}
          <div class="project-links">
            ${p.live_url ? `<a href="${escapeHtml(p.live_url)}" class="btn btn-accent" target="_blank">Live Demo ↗</a>` : ""}
            ${p.repo_url ? `<a href="${escapeHtml(p.repo_url)}" class="btn" target="_blank">GitHub</a>` : ""}
          </div>
        </div>
      </article>`;
  }

  function renderProjectsList() {
    const sec = document.getElementById("projects"), grid = document.getElementById("projectsGrid");
    if (!sec || !grid) return;
    if (!state.projects.length) { sec.classList.add("hidden"); return; }
    
    sec.classList.remove("hidden");
    const filtered = state.projects.filter(p => state.activeFilter === "starred" ? Number(p.starred) === 1 : (state.activeFilter === "unstarred" ? Number(p.starred) === 0 : true));
    
    if (!filtered.length) { grid.innerHTML = `<div class="empty-note">No projects match this filter.</div>`; return; }
    
    const htmlBlock = filtered.map(buildProjectCardHtml).join("");
    
    // For perfect seamless infinite scroll, we duplicate the innerHTML 
    // so it loops without visual interruption when reset to 0.
    if (state.viewMode === "carousel" && filtered.length > 1) {
        grid.innerHTML = htmlBlock + htmlBlock; 
    } else {
        grid.innerHTML = htmlBlock;
    }
    
    observeScrollItems();
  }

  function startInfiniteAutoScroll() {
    if (state.autoScrollRafId) cancelAnimationFrame(state.autoScrollRafId);
    const track = document.getElementById("projectsGrid");
    const viewport = document.getElementById("projectsViewport");
    if (!track) return;

    const step = () => {
      if (state.autoScrollEnabled && state.viewMode === "carousel" && !state.autoScrollPaused) {
        // Add class to disable CSS scroll-snap while animating
        viewport.classList.add("is-scrolling");
        track.scrollLeft += CONFIG.AUTO_SCROLL_SPEED_PX;
        
        // Because we duplicated the content, resetting when we hit halfway (the start of the clone) is perfectly seamless.
        if (track.scrollLeft >= track.scrollWidth / 2) {
          track.scrollLeft = 0;
        }
      } else {
        viewport.classList.remove("is-scrolling");
      }
      state.autoScrollRafId = requestAnimationFrame(step);
    };
    state.autoScrollRafId = requestAnimationFrame(step);
  }

  function initProjectControls() {
    const filterBtns = document.querySelectorAll(".filter-btn");
    filterBtns.forEach(btn => btn.addEventListener("click", () => {
      filterBtns.forEach(b => b.classList.remove("active")); btn.classList.add("active");
      state.activeFilter = btn.dataset.filter || "all";
      const track = document.getElementById("projectsGrid");
      if (track) track.scrollLeft = 0;
      renderProjectsList();
    }));

    document.getElementById("carouselViewBtn")?.addEventListener("click", (e) => {
      state.viewMode = "carousel";
      document.getElementById("projectsViewport").classList.replace("is-grid", "is-carousel");
      e.currentTarget.classList.add("active"); document.getElementById("gridViewBtn").classList.remove("active");
      updateAutoScrollButtonUI(); renderProjectsList();
    });

    document.getElementById("gridViewBtn")?.addEventListener("click", (e) => {
      state.viewMode = "grid";
      document.getElementById("projectsViewport").classList.replace("is-carousel", "is-grid");
      e.currentTarget.classList.add("active"); document.getElementById("carouselViewBtn").classList.remove("active");
      updateAutoScrollButtonUI(); renderProjectsList();
    });

    document.getElementById("autoScrollBtn")?.addEventListener("click", () => {
      state.autoScrollEnabled = !state.autoScrollEnabled;
      if (state.autoScrollEnabled && state.viewMode !== "carousel") document.getElementById("carouselViewBtn")?.click();
      else updateAutoScrollButtonUI();
    });

    const track = document.getElementById("projectsGrid");
    if (track) {
      track.addEventListener("mouseenter", () => state.autoScrollPaused = true);
      track.addEventListener("mouseleave", () => state.autoScrollPaused = false);
      track.addEventListener("touchstart", () => state.autoScrollPaused = true, { passive: true });
      track.addEventListener("touchend", () => setTimeout(() => state.autoScrollPaused = false, 1200), { passive: true });
    }

    updateAutoScrollButtonUI();
    startInfiniteAutoScroll();
  }

  function updateAutoScrollButtonUI() {
    const btn = document.getElementById("autoScrollBtn"), icon = document.getElementById("autoScrollIcon");
    if (!btn || !icon) return;
    const isActive = state.autoScrollEnabled && state.viewMode === "carousel";
    btn.classList.toggle("active", isActive);
    icon.innerHTML = isActive ? `<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>` : `<path d="M8 5v14l11-7z"/>`;
  }

  // --------------------------------------------------------------------------
  // 6. Generic Renders (Skills, Exp, Spotlights) & Scroll Anim
  // --------------------------------------------------------------------------
  function renderSkills(s) {
    const sec = document.getElementById("skills"), grid = document.getElementById("skillsGrid");
    if (!sec || !grid || !s.length) return;
    grid.innerHTML = s.map(sk => `<div class="card skill-card scroll-item-ltr">${sk.category ? `<span class="badge" style="margin-bottom:8px;">${escapeHtml(sk.category)}</span>` : ""}
      <div class="skill-name"><span>${escapeHtml(sk.name)}</span><span>${Number(sk.level ?? 80)}%</span></div>
      <div class="skill-track"><div class="skill-fill" data-level="${Number(sk.level ?? 80)}"></div></div></div>`).join("");
    sec.classList.remove("hidden");
  }

  function renderExperience(e) {
    const sec = document.getElementById("experience"), timeline = document.getElementById("timeline");
    if (!sec || !timeline || !e.length) return;
    timeline.innerHTML = e.map(item => {
      const isEdu = String(item.type).toLowerCase() === "education";
      let p = item.period || "";
      if (!p && (item.start_date || item.end_date)) p = item.start_date ? `${item.start_date} — ${item.end_date || "Present"}` : item.end_date;
      return `<div class="card timeline-item scroll-item-ltr"><div class="timeline-top"><span class="badge type-badge ${isEdu ? "type-education" : ""}">${isEdu ? "Education" : "Work"}</span></div>
        <div class="role">${escapeHtml(item.role)}</div><div class="org">${escapeHtml(item.organization || "")}</div>
        ${p ? `<div class="period">${escapeHtml(p)}</div>` : ""}${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ""}</div>`;
    }).join("");
    sec.classList.remove("hidden");
  }

  function observeScrollItems() {
    if (!state.scrollObserver) return;
    document.querySelectorAll(".scroll-anim, .scroll-item-ltr").forEach(el => state.scrollObserver.observe(el));
  }

  function initScrollAnimations() {
    state.scrollObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const el = entry.target;
        if (entry.isIntersecting) {
          el.classList.add("in-view");
          el.querySelectorAll(".skill-fill[data-level]").forEach(f => f.style.width = `${f.dataset.level}%`);
        } else {
          el.classList.remove("in-view");
          el.querySelectorAll(".skill-fill[data-level]").forEach(f => f.style.width = "0%");
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    observeScrollItems();
  }

  // --------------------------------------------------------------------------
  // 7. Application Bootstrapper
  // --------------------------------------------------------------------------
  async function loadPortfolio() {
    initThemeEngine();
    initNav();
    initProjectControls();
    initScrollAnimations();

    try {
      const response = await fetch(CONFIG.API_ENDPOINT, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      state.profile = data.profile || {};
      state.skills = Array.isArray(data.skills) ? data.skills : [];
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      state.experience = Array.isArray(data.experience) ? data.experience : [];

      populateIntro(state.profile);
      renderProfile(state.profile);
      renderSkills(state.skills);
      renderProjectsList();
      renderExperience(state.experience);
      initStories(data.stories || []);
      
      const spotlightList = state.projects.filter(p => Number(p.starred) === 1);
      if (spotlightList.length) {
        document.getElementById("starredShowcaseGrid").innerHTML = spotlightList.map(buildProjectCardHtml).join("");
        document.getElementById("starredSpotlight").classList.remove("hidden");
      }

      observeScrollItems();
    } catch (err) {
      console.warn("API Error:", err.message);
      populateIntro({ full_name: "PORTFOLIO" });
      renderProfile({ full_name: "Portfolio" });
      observeScrollItems();
    } finally {
      finishIntro();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPortfolio);
  } else {
    loadPortfolio();
  }
})();
