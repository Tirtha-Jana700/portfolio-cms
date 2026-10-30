/**
 * ============================================================================
 * Apple iOS 18 / visionOS Spatial Glass Portfolio Engine (public/js/main.js)
 * ============================================================================
 * Matched 100% to your 6-table Cloudflare D1 Schema:
 *  - profile (full_name, github_url, linkedin_url, twitter_url, instagram_url, youtube_url, etc.)
 *  - skills (name, category, level, sort_order)
 *  - projects (title, description, image_url, tech_stack, live_url, repo_url, starred)
 *  - experience (type, role, organization, start_date, end_date, description)
 *  - stories (id, media_url, created_at, caption)
 * ============================================================================
 */

(() => {
  "use strict";

  // --------------------------------------------------------------------------
  // Adjustable Configuration Parameters
  // --------------------------------------------------------------------------
  const CONFIG = {
    API_ENDPOINT: "/api/portfolio",
    STORY_IMAGE_DURATION_MS: 5000, // 5 seconds per image story
    SEEN_STORIES_STORAGE_KEY: "portfolio_seen_stories_v1",
    AUTO_SCROLL_SPEED_PX: 0.75,    // Carousel auto-scroll speed (pixels per frame)
    INTRO_HOLD_MS: 650,            // Pause after SVG ring finishes before zoom
    INTRO_CLEANUP_MS: 800          // Duration of zoom transition
  };

  // --------------------------------------------------------------------------
  // Application State
  // --------------------------------------------------------------------------
  const state = {
    profile: {},
    skills: [],
    projects: [],
    experience: [],
    stories: [],

    // Projects UI state
    activeFilter: "all",       // "all" | "starred" | "unstarred"
    viewMode: "carousel",      // "carousel" | "grid"
    autoScrollEnabled: true,
    autoScrollPaused: false,
    autoScrollRafId: null,

    // Story Player state
    storyIndex: 0,
    storyMuted: false,
    storyRafId: null,
    storyStartTime: 0,
    storyModalOpen: false,

    // Scroll IntersectionObserver
    scrollObserver: null
  };

  // --------------------------------------------------------------------------
  // Utility Functions
  // --------------------------------------------------------------------------

  /**
   * Escapes special HTML characters to prevent XSS injection.
   */
  function escapeHtml(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /**
   * Converts an ISO timestamp or SQLite datetime string into a relative label (e.g., "4h ago").
   */
  function formatTimeAgo(dateInput) {
    if (!dateInput) return "Just now";
    const raw = String(dateInput).trim();
    const parsed = typeof dateInput === "number"
      ? (dateInput < 1e12 ? dateInput * 1000 : dateInput)
      : Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");

    if (Number.isNaN(parsed)) return "Recently";

    const diffSeconds = Math.max(0, Math.floor((Date.now() - parsed) / 1000));
    if (diffSeconds < 60) return "Just now";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }

  /**
   * Automatically determines if a story `media_url` is a video reel or an image.
   * Works with file extensions (.mp4, .webm, .mov, .ogg) and data:video/* URLs.
   */
  function isVideoStory(story) {
    if (!story || !story.media_url) return false;
    const url = String(story.media_url).trim().toLowerCase();
    if (url.startsWith("data:video/")) return true;
    const cleanPath = url.split("?")[0].split("#")[0];
    return /\.(mp4|webm|ogg|mov|m4v)$/.test(cleanPath);
  }

  /**
   * Extracts social links from the `profile` table columns.
   */
  function extractSocialsFromProfile(profile) {
    if (!profile) return [];
    const mapping = [
      { key: "github_url", label: "GitHub" },
      { key: "linkedin_url", label: "LinkedIn" },
      { key: "twitter_url", label: "Twitter / X" },
      { key: "instagram_url", label: "Instagram" },
      { key: "youtube_url", label: "YouTube" }
    ];

    const list = [];
    mapping.forEach(({ key, label }) => {
      const url = profile[key] ? String(profile[key]).trim() : "";
      if (url) {
        list.push({ platform: label, url });
      }
    });
    return list;
  }

  // --------------------------------------------------------------------------
  // 1. Spatial Intro Screen (#introScreen)
  // --------------------------------------------------------------------------

  function populateIntro(profile) {
    const introName = document.getElementById("introName");
    const introTitle = document.getElementById("introTitle");
    const introAvatarImg = document.getElementById("introAvatarImg");

    const displayName = profile.full_name || profile.name || "Welcome";
    if (introName) introName.textContent = displayName;
    if (introTitle) introTitle.textContent = profile.title || "";

    if (introAvatarImg && profile.avatar_url) {
      introAvatarImg.src = profile.avatar_url;
      introAvatarImg.alt = displayName;
      introAvatarImg.style.display = "block";
    }
  }

  function finishIntro() {
    const introScreen = document.getElementById("introScreen");
    if (!introScreen) {
      document.body.classList.remove("pre-reveal");
      return;
    }

    introScreen.classList.add("intro-ready");

    setTimeout(() => {
      introScreen.classList.add("intro-zoom");
      document.body.classList.remove("pre-reveal");

      requestAnimationFrame(() => updateNavIndicator());

      setTimeout(() => {
        introScreen.classList.add("hidden");
      }, CONFIG.INTRO_CLEANUP_MS);
    }, CONFIG.INTRO_HOLD_MS);
  }

  // --------------------------------------------------------------------------
  // 2. Dynamic Island Bouncy Navigation (initNav)
  // --------------------------------------------------------------------------

  function updateNavIndicator(targetLink) {
    const navLinksContainer = document.getElementById("navLinks");
    const indicator = document.getElementById("navIndicator");
    if (!navLinksContainer || !indicator) return;

    const activeLink =
      targetLink ||
      navLinksContainer.querySelector(".nav-link.active") ||
      navLinksContainer.querySelector(".nav-link");

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
    indicator._stretchTimer = setTimeout(() => {
      indicator.classList.remove("stretching");
    }, 320);
  }

  function initNav() {
    const navLinksContainer = document.getElementById("navLinks");
    if (!navLinksContainer) return;

    const links = Array.from(navLinksContainer.querySelectorAll(".nav-link"));
    if (!links.length) return;

    links[0].classList.add("active");
    requestAnimationFrame(() => updateNavIndicator(links[0]));

    links.forEach((link) => {
      link.addEventListener("click", () => {
        links.forEach((l) => l.classList.remove("active", "bounce"));
        void link.offsetWidth; // Reflow to restart keyframe animation
        link.classList.add("active", "bounce");
        updateNavIndicator(link);
      });
    });

    window.addEventListener("resize", () => updateNavIndicator());

    const sectionIds = links
      .map((link) => link.getAttribute("href"))
      .filter((href) => href && href.startsWith("#"))
      .map((href) => href.slice(1));

    const spyObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            const matchingLink = links.find(
              (link) => link.getAttribute("href") === `#${id}`
            );
            if (matchingLink && !matchingLink.classList.contains("active")) {
              links.forEach((l) => l.classList.remove("active"));
              matchingLink.classList.add("active");
              updateNavIndicator(matchingLink);
            }
          }
        });
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: 0.05 }
    );

    sectionIds.forEach((id) => {
      const sectionEl = document.getElementById(id);
      if (sectionEl) spyObserver.observe(sectionEl);
    });
  }

  // --------------------------------------------------------------------------
  // 3. Hero, Profile, About & Contact Rendering
  // --------------------------------------------------------------------------

  function renderProfile(profile) {
    const brandText = document.getElementById("brandText");
    const heroName = document.getElementById("heroName");
    const heroTitle = document.getElementById("heroTitle");
    const heroTagline = document.getElementById("heroTagline");
    const avatarImg = document.getElementById("avatarImg");
    const avatarFallback = document.getElementById("avatarFallback");
    const heroActions = document.getElementById("heroActions");
    const socialRow = document.getElementById("socialRow");
    const aboutSection = document.getElementById("about");
    const aboutBio = document.getElementById("aboutBio");
    const contactSection = document.getElementById("contact");
    const contactGrid = document.getElementById("contactGrid");
    const footerText = document.getElementById("footerText");

    const fullName = profile.full_name || profile.name || "Portfolio";
    document.title = `${fullName} — Portfolio`;

    if (brandText) brandText.textContent = fullName;
    if (heroName) heroName.textContent = fullName;
    if (heroTitle) heroTitle.textContent = profile.title || "";
    if (heroTagline) heroTagline.textContent = profile.tagline || "";

    if (avatarImg && profile.avatar_url) {
      avatarImg.src = profile.avatar_url;
      avatarImg.alt = fullName;
      avatarImg.style.display = "block";
      if (avatarFallback) avatarFallback.style.display = "none";
    }

    // Hero Call-to-Action Buttons
    if (heroActions) {
      const actionsHtml = [
        `<a href="#projects" class="btn btn-accent">View Projects</a>`
      ];
      if (profile.resume_url) {
        actionsHtml.push(
          `<a href="${escapeHtml(profile.resume_url)}" class="btn" target="_blank" rel="noopener noreferrer">Resume ↗</a>`
        );
      }
      if (profile.email) {
        actionsHtml.push(
          `<a href="mailto:${escapeHtml(profile.email)}" class="btn">Get In Touch</a>`
        );
      }
      heroActions.innerHTML = actionsHtml.join("");
    }

    // Social Links extracted from `profile` columns
    const socials = extractSocialsFromProfile(profile);
    if (socialRow) {
      socialRow.innerHTML = socials
        .map(
          (s) => `
          <a href="${escapeHtml(s.url)}" class="btn" target="_blank" rel="noopener noreferrer">
            ${escapeHtml(s.platform)}
          </a>`
        )
        .join("");
    }

    // About Section
    if (aboutSection && aboutBio && profile.bio) {
      aboutBio.textContent = profile.bio;
      aboutSection.classList.remove("hidden");
    }

    // Contact Section
    if (contactSection && contactGrid) {
      const cards = [];
      if (profile.email) {
        cards.push({
          label: "Email",
          value: profile.email,
          href: `mailto:${profile.email}`
        });
      }
      if (profile.phone) {
        cards.push({
          label: "Phone",
          value: profile.phone,
          href: `tel:${profile.phone}`
        });
      }
      if (profile.location) {
        cards.push({
          label: "Location",
          value: profile.location,
          href: null
        });
      }
      socials.forEach((s) => {
        cards.push({
          label: s.platform,
          value: s.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""),
          href: s.url
        });
      });

      if (cards.length > 0) {
        contactGrid.innerHTML = cards
          .map((c) => {
            const inner = `
              <div class="label">${escapeHtml(c.label)}</div>
              <div class="value">${escapeHtml(c.value)}</div>
            `;
            return c.href
              ? `<a href="${escapeHtml(c.href)}" target="_blank" rel="noopener noreferrer" class="card contact-card scroll-item-ltr">${inner}</a>`
              : `<div class="card contact-card scroll-item-ltr">${inner}</div>`;
          })
          .join("");
        contactSection.classList.remove("hidden");
      }
    }

    // Footer
    if (footerText) {
      const year = new Date().getFullYear();
      footerText.textContent = `© ${year} ${fullName}. All rights reserved.`;
    }
  }

  // --------------------------------------------------------------------------
  // 4. Instagram-Style 24h Story Ring & Video Reels Modal (initStories)
  // --------------------------------------------------------------------------

  function getSeenStoryIds() {
    try {
      const raw = localStorage.getItem(CONFIG.SEEN_STORIES_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  function markStorySeen(storyId) {
    if (storyId === undefined || storyId === null) return;
    const seen = new Set(getSeenStoryIds());
    seen.add(String(storyId));
    try {
      localStorage.setItem(
        CONFIG.SEEN_STORIES_STORAGE_KEY,
        JSON.stringify(Array.from(seen))
      );
    } catch {
      // Ignore storage errors
    }
    updateAvatarStoryRingState();
  }

  function updateAvatarStoryRingState() {
    const avatarFrame = document.getElementById("avatarFrame");
    const storyBadge = document.getElementById("storyBadge");
    if (!avatarFrame) return;

    const activeStories = state.stories;
    if (!Array.isArray(activeStories) || activeStories.length === 0) {
      avatarFrame.classList.remove("has-story", "story-unseen", "story-seen");
      if (storyBadge) storyBadge.classList.add("hidden");
      return;
    }

    const seenIds = new Set(getSeenStoryIds());
    const allSeen = activeStories.every((s) => seenIds.has(String(s.id)));

    avatarFrame.classList.add("has-story");
    avatarFrame.classList.toggle("story-unseen", !allSeen);
    avatarFrame.classList.toggle("story-seen", allSeen);

    if (storyBadge) {
      storyBadge.classList.remove("hidden");
      storyBadge.textContent = allSeen ? "REPLAY" : "STORY";
    }
  }

  function initStories(stories) {
    const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
    state.stories = (Array.isArray(stories) ? stories : []).filter((s) => {
      if (!s || !s.media_url) return false;
      if (!s.created_at) return true;
      const raw = String(s.created_at).trim();
      const ts = typeof s.created_at === "number"
        ? (s.created_at < 1e12 ? s.created_at * 1000 : s.created_at)
        : Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T") + "Z");
      return Number.isNaN(ts) ? true : ts >= cutoffMs;
    });

    updateAvatarStoryRingState();

    const avatarFrame = document.getElementById("avatarFrame");
    const storyModal = document.getElementById("storyModal");
    const storyBackdrop = document.getElementById("storyBackdrop");
    const storyCloseBtn = document.getElementById("storyCloseBtn");
    const storyMuteBtn = document.getElementById("storyMuteBtn");
    const storyPrevZone = document.getElementById("storyPrevZone");
    const storyNextZone = document.getElementById("storyNextZone");

    if (avatarFrame) {
      avatarFrame.addEventListener("click", () => {
        if (!state.stories.length) return;
        const seenIds = new Set(getSeenStoryIds());
        const firstUnseenIdx = state.stories.findIndex(
          (s) => !seenIds.has(String(s.id))
        );
        openStoryModal(firstUnseenIdx >= 0 ? firstUnseenIdx : 0);
      });
    }

    if (storyCloseBtn) storyCloseBtn.addEventListener("click", closeStoryModal);
    if (storyBackdrop) storyBackdrop.addEventListener("click", closeStoryModal);
    if (storyPrevZone) storyPrevZone.addEventListener("click", () => stepStory(-1));
    if (storyNextZone) storyNextZone.addEventListener("click", () => stepStory(1));

    if (storyMuteBtn) {
      storyMuteBtn.addEventListener("click", () => {
        const videoEl = document.getElementById("storyVideoEl");
        state.storyMuted = !state.storyMuted;
        if (videoEl) videoEl.muted = state.storyMuted;
        updateMuteButtonUI();
      });
    }

    window.addEventListener("keydown", (e) => {
      if (!state.storyModalOpen) return;
      if (e.key === "Escape") closeStoryModal();
      if (e.key === "ArrowRight") stepStory(1);
      if (e.key === "ArrowLeft") stepStory(-1);
    });

    if (storyModal) {
      storyModal.addEventListener("contextmenu", (e) => e.preventDefault());
    }
  }

  function updateMuteButtonUI() {
    const muteIcon = document.getElementById("storyMuteIcon");
    if (muteIcon) {
      muteIcon.textContent = state.storyMuted ? "🔇" : "🔊";
    }
  }

  function openStoryModal(startIndex = 0) {
    const storyModal = document.getElementById("storyModal");
    const progressRow = document.getElementById("storyProgressRow");
    const storyUserAvatar = document.getElementById("storyUserAvatar");
    const storyUserName = document.getElementById("storyUserName");

    if (!storyModal || !state.stories.length) return;

    state.storyModalOpen = true;
    storyModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";

    if (storyUserName) {
      storyUserName.textContent =
        state.profile.full_name || state.profile.name || "Story";
    }
    if (storyUserAvatar) {
      if (state.profile.avatar_url) {
        storyUserAvatar.src = state.profile.avatar_url;
        storyUserAvatar.style.display = "block";
      } else {
        storyUserAvatar.style.display = "none";
      }
    }

    if (progressRow) {
      progressRow.innerHTML = state.stories
        .map(
          (_, idx) => `
          <div class="story-seg">
            <div class="story-seg-fill" id="storySegFill-${idx}"></div>
          </div>`
        )
        .join("");
    }

    showStoryAtIndex(startIndex);
  }

  function stopCurrentStoryPlayback() {
    if (state.storyRafId) {
      cancelAnimationFrame(state.storyRafId);
      state.storyRafId = null;
    }
    const videoEl = document.getElementById("storyVideoEl");
    if (videoEl) {
      videoEl.pause();
      videoEl.onended = null;
      videoEl.ontimeupdate = null;
      videoEl.removeAttribute("src");
      videoEl.load();
    }
  }

  function closeStoryModal() {
    stopCurrentStoryPlayback();
    state.storyModalOpen = false;
    const storyModal = document.getElementById("storyModal");
    if (storyModal) storyModal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function stepStory(direction) {
    const nextIndex = state.storyIndex + direction;
    if (nextIndex < 0) {
      showStoryAtIndex(0);
    } else if (nextIndex >= state.stories.length) {
      closeStoryModal();
    } else {
      showStoryAtIndex(nextIndex);
    }
  }

  function setSegmentFill(index, percentage) {
    const el = document.getElementById(`storySegFill-${index}`);
    if (el) {
      el.style.width = `${Math.max(0, Math.min(100, percentage))}%`;
    }
  }

  function showStoryAtIndex(index) {
    stopCurrentStoryPlayback();
    state.storyIndex = index;

    const story = state.stories[index];
    if (!story) {
      closeStoryModal();
      return;
    }

    state.stories.forEach((_, idx) => {
      setSegmentFill(idx, idx < index ? 100 : 0);
    });

    markStorySeen(story.id ?? index);

    const timeAgoEl = document.getElementById("storyTimeAgo");
    if (timeAgoEl) timeAgoEl.textContent = formatTimeAgo(story.created_at);

    const captionBar = document.getElementById("storyCaptionBar");
    const captionText = document.getElementById("storyCaptionText");
    if (captionBar && captionText) {
      if (story.caption && String(story.caption).trim()) {
        captionText.textContent = story.caption;
        captionBar.classList.remove("hidden");
      } else {
        captionText.textContent = "";
        captionBar.classList.add("hidden");
      }
    }

    const imgEl = document.getElementById("storyImgEl");
    const videoEl = document.getElementById("storyVideoEl");
    const muteBtn = document.getElementById("storyMuteBtn");

    if (isVideoStory(story)) {
      if (imgEl) imgEl.classList.add("hidden");
      if (muteBtn) muteBtn.classList.remove("hidden");

      if (videoEl) {
        videoEl.classList.remove("hidden");
        videoEl.src = story.media_url;
        videoEl.muted = state.storyMuted;
        updateMuteButtonUI();

        videoEl.ontimeupdate = () => {
          if (videoEl.duration && Number.isFinite(videoEl.duration)) {
            const pct = (videoEl.currentTime / videoEl.duration) * 100;
            setSegmentFill(index, pct);
          }
        };

        videoEl.onended = () => {
          setSegmentFill(index, 100);
          stepStory(1);
        };

        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            state.storyMuted = true;
            videoEl.muted = true;
            updateMuteButtonUI();
            videoEl.play().catch(() => {});
          });
        }
      }
    } else {
      if (videoEl) videoEl.classList.add("hidden");
      if (muteBtn) muteBtn.classList.add("hidden");

      if (imgEl) {
        imgEl.classList.remove("hidden");
        imgEl.src = story.media_url;
      }

      state.storyStartTime = performance.now();
      const tick = (now) => {
        if (!state.storyModalOpen || state.storyIndex !== index) return;
        const elapsed = now - state.storyStartTime;
        const pct = (elapsed / CONFIG.STORY_IMAGE_DURATION_MS) * 100;
        setSegmentFill(index, pct);

        if (elapsed >= CONFIG.STORY_IMAGE_DURATION_MS) {
          stepStory(1);
        } else {
          state.storyRafId = requestAnimationFrame(tick);
        }
      };
      state.storyRafId = requestAnimationFrame(tick);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Skills & Experience Rendering (Mapped to `category`, `start_date`, `end_date`)
  // --------------------------------------------------------------------------

  function renderSkills(skills) {
    const skillsSection = document.getElementById("skills");
    const skillsGrid = document.getElementById("skillsGrid");
    if (!skillsSection || !skillsGrid || !Array.isArray(skills) || !skills.length) {
      return;
    }

    skillsGrid.innerHTML = skills
      .map((skill) => {
        const level = Math.max(0, Math.min(100, Number(skill.level ?? 80)));
        const categoryTag = skill.category
          ? `<span class="badge" style="margin-bottom:8px;">${escapeHtml(skill.category)}</span>`
          : "";
        return `
          <div class="card skill-card scroll-item-ltr">
            ${categoryTag}
            <div class="skill-name">
              <span>${escapeHtml(skill.name)}</span>
              <span>${level}%</span>
            </div>
            <div class="skill-track">
              <div class="skill-fill" data-level="${level}"></div>
            </div>
          </div>
        `;
      })
      .join("");

    skillsSection.classList.remove("hidden");
  }

  function renderExperience(experience) {
    const expSection = document.getElementById("experience");
    const timeline = document.getElementById("timeline");
    if (!expSection || !timeline || !Array.isArray(experience) || !experience.length) {
      return;
    }

    timeline.innerHTML = experience
      .map((item) => {
        const isEdu = String(item.type || "").toLowerCase() === "education";
        const badgeLabel = isEdu ? "Education" : "Work Experience";

        // Format `start_date` and `end_date` from your `experience` table
        let periodText = item.period || "";
        if (!periodText && (item.start_date || item.end_date)) {
          const start = item.start_date || "";
          const end = item.end_date || "Present";
          periodText = start ? `${start} — ${end}` : end;
        }

        return `
          <div class="card timeline-item scroll-item-ltr">
            <div class="timeline-top">
              <span class="badge type-badge ${isEdu ? "type-education" : ""}">${badgeLabel}</span>
            </div>
            <div class="role">${escapeHtml(item.role)}</div>
            <div class="org">${escapeHtml(item.organization || "")}</div>
            ${periodText ? `<div class="period">${escapeHtml(periodText)}</div>` : ""}
            ${item.description ? `<div class="desc">${escapeHtml(item.description)}</div>` : ""}
          </div>
        `;
      })
      .join("");

    expSection.classList.remove("hidden");
  }

  // --------------------------------------------------------------------------
  // 6. Projects Showcase: Starred Spotlight, Filter, View Switch & Auto-Scroll
  // --------------------------------------------------------------------------

  function isProjectStarred(project) {
    return (
      project &&
      (project.starred === 1 ||
        project.starred === true ||
        project.starred === "1")
    );
  }

  function buildProjectCardHtml(project) {
    const starred = isProjectStarred(project);
    const tags = Array.isArray(project.tech_stack)
      ? project.tech_stack
      : String(project.tech_stack || "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);

    return `
      <article class="card project-card scroll-item-ltr">
        ${
          starred
            ? `<div class="project-star-ribbon" title="Popular Starred Project">★ Popular</div>`
            : ""
        }
        ${
          project.image_url
            ? `<div class="project-image">
                 <img src="${escapeHtml(project.image_url)}" alt="${escapeHtml(project.title)}" loading="lazy" />
               </div>`
            : ""
        }
        <div class="project-body">
          <h3>${escapeHtml(project.title || "Untitled Project")}</h3>
          <p>${escapeHtml(project.description || "")}</p>
          ${
            tags.length
              ? `<div class="tech-tags">
                   ${tags.map((t) => `<span class="badge">${escapeHtml(t)}</span>`).join("")}
                 </div>`
              : ""
          }
          <div class="project-links">
            ${
              project.live_url
                ? `<a href="${escapeHtml(project.live_url)}" class="btn btn-accent" target="_blank" rel="noopener noreferrer">Live Demo ↗</a>`
                : ""
            }
            ${
              project.repo_url
                ? `<a href="${escapeHtml(project.repo_url)}" class="btn" target="_blank" rel="noopener noreferrer">GitHub</a>`
                : ""
            }
          </div>
        </div>
      </article>
    `;
  }

  function renderStarredSpotlight(projects) {
    const spotlightSection = document.getElementById("starredSpotlight");
    const spotlightGrid = document.getElementById("starredShowcaseGrid");
    if (!spotlightSection || !spotlightGrid) return;

    const starredList = (Array.isArray(projects) ? projects : []).filter(isProjectStarred);
    if (!starredList.length) {
      spotlightSection.classList.add("hidden");
      return;
    }

    spotlightGrid.innerHTML = starredList.map(buildProjectCardHtml).join("");
    spotlightSection.classList.remove("hidden");
  }

  function renderProjectsList() {
    const projectsSection = document.getElementById("projects");
    const projectsGrid = document.getElementById("projectsGrid");
    if (!projectsSection || !projectsGrid) return;

    if (!Array.isArray(state.projects) || !state.projects.length) {
      projectsSection.classList.add("hidden");
      return;
    }

    projectsSection.classList.remove("hidden");

    const filtered = state.projects.filter((p) => {
      if (state.activeFilter === "starred") return isProjectStarred(p);
      if (state.activeFilter === "unstarred") return !isProjectStarred(p);
      return true;
    });

    if (!filtered.length) {
      projectsGrid.innerHTML = `<div class="empty-note">No projects found in this filter.</div>`;
      return;
    }

    projectsGrid.innerHTML = filtered.map(buildProjectCardHtml).join("");
    observeScrollItems();
  }

  function updateAutoScrollButtonUI() {
    const autoScrollBtn = document.getElementById("autoScrollBtn");
    const autoScrollIcon = document.getElementById("autoScrollIcon");
    if (!autoScrollBtn || !autoScrollIcon) return;

    const isActive = state.autoScrollEnabled && state.viewMode === "carousel";
    autoScrollBtn.classList.toggle("active", isActive);

    if (isActive) {
      autoScrollIcon.innerHTML = `<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>`;
    } else {
      autoScrollIcon.innerHTML = `<path d="M8 5v14l11-7z"/>`;
    }
  }

  function startInfiniteAutoScroll() {
    if (state.autoScrollRafId) {
      cancelAnimationFrame(state.autoScrollRafId);
    }

    const track = document.getElementById("projectsGrid");
    if (!track) return;

    const step = () => {
      if (
        state.autoScrollEnabled &&
        state.viewMode === "carousel" &&
        !state.autoScrollPaused
      ) {
        const maxScroll = track.scrollWidth - track.clientWidth;
        if (maxScroll > 4) {
          track.scrollLeft += CONFIG.AUTO_SCROLL_SPEED_PX;
          if (track.scrollLeft >= maxScroll - 1) {
            track.scrollLeft = 0;
          }
        }
      }
      state.autoScrollRafId = requestAnimationFrame(step);
    };

    state.autoScrollRafId = requestAnimationFrame(step);
  }

  function initProjectControls() {
    const filterGroup = document.getElementById("projectFilters");
    const autoScrollBtn = document.getElementById("autoScrollBtn");
    const carouselViewBtn = document.getElementById("carouselViewBtn");
    const gridViewBtn = document.getElementById("gridViewBtn");
    const viewport = document.getElementById("projectsViewport");
    const track = document.getElementById("projectsGrid");

    if (filterGroup) {
      const filterBtns = Array.from(filterGroup.querySelectorAll(".filter-btn"));
      filterBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          filterBtns.forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.activeFilter = btn.dataset.filter || "all";
          if (track) track.scrollLeft = 0;
          renderProjectsList();
        });
      });
    }

    if (carouselViewBtn && gridViewBtn && viewport) {
      carouselViewBtn.addEventListener("click", () => {
        state.viewMode = "carousel";
        viewport.classList.add("is-carousel");
        viewport.classList.remove("is-grid");
        carouselViewBtn.classList.add("active");
        gridViewBtn.classList.remove("active");
        updateAutoScrollButtonUI();
      });

      gridViewBtn.addEventListener("click", () => {
        state.viewMode = "grid";
        viewport.classList.add("is-grid");
        viewport.classList.remove("is-carousel");
        gridViewBtn.classList.add("active");
        carouselViewBtn.classList.remove("active");
        updateAutoScrollButtonUI();
      });
    }

    if (autoScrollBtn) {
      autoScrollBtn.addEventListener("click", () => {
        state.autoScrollEnabled = !state.autoScrollEnabled;
        if (state.autoScrollEnabled && state.viewMode !== "carousel" && carouselViewBtn) {
          carouselViewBtn.click();
        } else {
          updateAutoScrollButtonUI();
        }
      });
    }

    if (track) {
      track.addEventListener("mouseenter", () => {
        state.autoScrollPaused = true;
      });
      track.addEventListener("mouseleave", () => {
        state.autoScrollPaused = false;
      });
      track.addEventListener(
        "touchstart",
        () => {
          state.autoScrollPaused = true;
        },
        { passive: true }
      );
      track.addEventListener(
        "touchend",
        () => {
          setTimeout(() => {
            state.autoScrollPaused = false;
          }, 1200);
        },
        { passive: true }
      );
    }

    updateAutoScrollButtonUI();
    startInfiniteAutoScroll();
  }

  // --------------------------------------------------------------------------
  // 7. Apple Notification Scroll Reveal & Skill Bar Fill Animations
  // --------------------------------------------------------------------------

  function observeScrollItems() {
    if (!state.scrollObserver) return;
    const elements = document.querySelectorAll(".scroll-anim, .scroll-item-ltr");
    elements.forEach((el) => state.scrollObserver.observe(el));
  }

  function initScrollAnimations() {
    state.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target;
          if (entry.isIntersecting) {
            el.classList.add("in-view");
            const skillFills = el.querySelectorAll(".skill-fill[data-level]");
            skillFills.forEach((fill) => {
              fill.style.width = `${fill.dataset.level}%`;
            });
          } else {
            el.classList.remove("in-view");
            const skillFills = el.querySelectorAll(".skill-fill[data-level]");
            skillFills.forEach((fill) => {
              fill.style.width = "0%";
            });
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    observeScrollItems();
  }

  // --------------------------------------------------------------------------
  // 8. Main Application Bootstrapper
  // --------------------------------------------------------------------------

  async function loadPortfolio() {
    initNav();
    initProjectControls();
    initScrollAnimations();

    try {
      const response = await fetch(CONFIG.API_ENDPOINT, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      state.profile = data.profile || {};
      state.skills = Array.isArray(data.skills) ? data.skills : [];
      state.projects = Array.isArray(data.projects) ? data.projects : [];
      state.experience = Array.isArray(data.experience) ? data.experience : [];

      populateIntro(state.profile);
      renderProfile(state.profile);
      renderStarredSpotlight(state.projects);
      renderSkills(state.skills);
      renderProjectsList();
      renderExperience(state.experience);
      initStories(data.stories || []);

      observeScrollItems();
    } catch (err) {
      console.warn("Could not load /api/portfolio:", err.message);
      populateIntro({ full_name: "Portfolio" });
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
