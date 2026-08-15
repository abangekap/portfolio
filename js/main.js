(function () {
  document.getElementById('year').textContent = new Date().getFullYear();

  // Smooth scroll via Lenis (https://github.com/darkroomengineering/lenis).
  // It animates the real window scroll position (not a transform wrapper),
  // so position: sticky and the scroll-spy logic below keep working as-is.
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lenis = null;

  if (window.Lenis && !reducedMotion) {
    lenis = new Lenis({
      autoRaf: true,
      anchors: false, // handled manually below
    });

    document.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link) return;
      const id = link.getAttribute('href').slice(1);
      const el = id ? document.getElementById(id) : null;
      if (!el) return;
      event.preventDefault();
      // No manual offset here — the target's CSS `scroll-margin-top` already
      // accounts for the sticky nav, and Lenis respects it automatically.
      lenis.scrollTo(el);
      history.pushState(null, '', `#${id}`);
    });
  }

  // Page curtain — plays a slanted wipe over the current page, then performs
  // the real (multi-page) navigation once the curtain fully covers the
  // screen. The destination page loads already in the "covered" state (see
  // the inline script near the top of <body>) and reveals itself on load, so
  // the two halves of the animation line up across the page boundary.
  const PAGE_LABELS = {
    '': 'Halo!',
    'index.html': 'Halo!',
    'work.html': 'Work',
    'about.html': 'About',
    'case-study-gokomodo.html': 'Case Study',
    'case-study-whatsapp-funnel.html': 'Case Study',
    'case-study-klinik-tani.html': 'Case Study',
    '404.html': 'Oops',
  };
  // Per-destination curtain colors — only case study detail pages depart
  // from the default dark/white; every other destination falls back to it.
  const CURTAIN_THEMES = {
    'case-study-gokomodo.html': { background: '#E2EF72', color: '#212121' },
    'case-study-whatsapp-funnel.html': { background: '#E2EF72', color: '#212121' },
    'case-study-klinik-tani.html': { background: '#E2EF72', color: '#212121' },
  };
  const curtain = document.querySelector('[data-page-curtain]');
  const curtainLabel = document.querySelector('[data-page-curtain-label]');
  // The sweep itself takes 500ms (matches the CSS animation) and keeps its
  // original unhurried pace — only the hold afterwards got trimmed, so the
  // actual page swap follows right on the sweep's heels instead of lingering.
  const CURTAIN_SWEEP_DURATION = 500;
  const CURTAIN_HOLD_DURATION = 80;

  if (curtain && !reducedMotion) {
    document.addEventListener('click', (event) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const link = event.target.closest('a');
      if (!link) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;

      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (link.origin !== window.location.origin) return;
      if (href === window.location.pathname.split('/').pop()) return;

      event.preventDefault();
      const page = href.split('/').pop().split('?')[0];
      if (curtainLabel) {
        curtainLabel.textContent = PAGE_LABELS[page] || '';
      }
      const theme = CURTAIN_THEMES[page];
      if (theme) {
        curtain.style.setProperty('--curtain-bg', theme.background);
        curtain.style.setProperty('--curtain-color', theme.color);
      } else {
        curtain.style.removeProperty('--curtain-bg');
        curtain.style.removeProperty('--curtain-color');
      }
      curtain.classList.add('is-entering');
      window.setTimeout(() => {
        window.location.href = href;
      }, CURTAIN_SWEEP_DURATION + CURTAIN_HOLD_DURATION);
    });
  }

  const navLinks = document.querySelectorAll('[data-nav-link]');
  const sectionNavLinks = Array.from(navLinks).filter((link) => link.getAttribute('href').startsWith('#'));
  const sections = sectionNavLinks
    .map((link) => document.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  function setActiveLink() {
    if (!sections.length) return;

    const scrollPos = window.scrollY + window.innerHeight / 3;
    let currentSection = sections[0];

    sections.forEach((section) => {
      if (section.offsetTop <= scrollPos) {
        currentSection = section;
      }
    });

    sectionNavLinks.forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${currentSection.id}`);
    });
  }

  if (sections.length) {
    window.addEventListener('scroll', setActiveLink, { passive: true });
    setActiveLink();
  }

  // Sliding nav indicator — a shared pill that glides between links on
  // hover instead of each link popping its own background in/out.
  const navPill = document.querySelector('.site-nav__pill');

  if (navPill && navLinks.length) {
    const indicator = document.createElement('span');
    indicator.className = 'site-nav__indicator';
    indicator.setAttribute('aria-hidden', 'true');
    navPill.prepend(indicator);
    navPill.classList.add('has-nav-indicator');

    function moveNavIndicator(link) {
      indicator.style.width = `${link.offsetWidth}px`;
      indicator.style.height = `${link.offsetHeight}px`;
      indicator.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    }

    function activeNavLink() {
      return navPill.querySelector('.site-nav__link.is-active') || navLinks[0];
    }

    moveNavIndicator(activeNavLink());
    // Position instantly on load, then turn on the slide transition next
    // frame so the initial placement never animates in from the left edge.
    if (!reducedMotion) {
      requestAnimationFrame(() => indicator.classList.add('is-ready'));
    }

    navLinks.forEach((link) => {
      link.addEventListener('mouseenter', () => moveNavIndicator(link));
    });

    navPill.addEventListener('mouseleave', () => moveNavIndicator(activeNavLink()));
    window.addEventListener('resize', () => moveNavIndicator(activeNavLink()));
  }

  const caseStudyTrack = document.querySelector('[data-carousel-track]');
  const caseStudyDots = document.querySelectorAll('[data-carousel-dot]');
  const caseStudyRoot = document.querySelector('.case-study');

  if (caseStudyTrack && caseStudyDots.length) {
    const AUTOPLAY_DELAY = 3000;
    const slides = Array.from(caseStudyTrack.children);
    const realSlideCount = caseStudyDots.length;
    const totalSlides = slides.length;
    let position = 0;
    let autoplayTimer = null;
    let remainingDelay = AUTOPLAY_DELAY;
    let timerStartedAt = null;

    // The track's own width must be definite (not "auto") for the slides'
    // percentage widths to resolve correctly instead of falling back to
    // content-based sizing, which caused incomplete slide transitions.
    caseStudyTrack.style.width = `${totalSlides * 100}%`;
    slides.forEach((slide) => {
      slide.style.width = `${100 / totalSlides}%`;
    });

    function activeIndex() {
      return position % realSlideCount;
    }

    function updateSlideInertness() {
      const current = activeIndex();
      for (let i = 0; i < realSlideCount; i += 1) {
        if (i === current) {
          slides[i].removeAttribute('inert');
        } else {
          slides[i].setAttribute('inert', '');
        }
      }
    }

    function updateDots(fill) {
      const current = activeIndex();
      caseStudyDots.forEach((dot, i) => {
        const isActive = i === current;
        dot.classList.toggle('case-study__dot--active', isActive);
        dot.setAttribute('aria-selected', String(isActive));

        if (!isActive) {
          dot.classList.remove('is-filling', 'is-paused');
        } else if (fill) {
          dot.classList.remove('is-paused', 'is-filling');
          void dot.offsetWidth;
          dot.classList.add('is-filling');
        }
      });
    }

    function goToPosition(pos, { animate = true, fill = true } = {}) {
      position = pos;
      caseStudyTrack.classList.toggle('is-snapping', !animate);
      const percent = (100 / totalSlides) * position;
      caseStudyTrack.style.transform = `translateX(-${percent}%)`;
      updateDots(fill);
      updateSlideInertness();
    }

    function nextSlide() {
      goToPosition(position + 1);
    }

    caseStudyTrack.addEventListener('transitionend', (event) => {
      if (event.propertyName !== 'transform') return;
      if (position !== realSlideCount) return;

      requestAnimationFrame(() => {
        goToPosition(0, { animate: false, fill: false });
        requestAnimationFrame(() => {
          caseStudyTrack.classList.remove('is-snapping');
        });
      });
    });

    function pauseAutoplayVisual() {
      caseStudyDots[activeIndex()].classList.add('is-paused');
    }

    function resumeAutoplayVisual() {
      caseStudyDots[activeIndex()].classList.remove('is-paused');
    }

    function clearAutoplayTimer() {
      if (autoplayTimer) {
        window.clearTimeout(autoplayTimer);
        autoplayTimer = null;
      }
    }

    function startAutoplay() {
      if (reducedMotion) return;
      clearAutoplayTimer();
      timerStartedAt = Date.now();
      autoplayTimer = window.setTimeout(() => {
        remainingDelay = AUTOPLAY_DELAY;
        nextSlide();
        startAutoplay();
      }, remainingDelay);
    }

    function stopAutoplay() {
      if (autoplayTimer && timerStartedAt) {
        const elapsed = Date.now() - timerStartedAt;
        remainingDelay = Math.max(0, remainingDelay - elapsed);
      }
      clearAutoplayTimer();
    }

    caseStudyDots.forEach((dot, index) => {
      dot.addEventListener('click', () => {
        if (index === activeIndex()) return;
        goToPosition(index);
        remainingDelay = AUTOPLAY_DELAY;
        startAutoplay();
      });
    });

    caseStudyRoot.addEventListener('mouseenter', () => {
      stopAutoplay();
      pauseAutoplayVisual();
    });
    caseStudyRoot.addEventListener('mouseleave', () => {
      resumeAutoplayVisual();
      startAutoplay();
    });
    caseStudyRoot.addEventListener('focusin', () => {
      stopAutoplay();
      pauseAutoplayVisual();
    });
    caseStudyRoot.addEventListener('focusout', () => {
      resumeAutoplayVisual();
      startAutoplay();
    });

    updateDots(true);
    updateSlideInertness();
    startAutoplay();
  }

  // Testimonials carousel — native scroll-snap track, driven by the
  // prev/next buttons (mouse drag is deliberately off, see CLAUDE.md).
  // No autoplay: unlike the short case-study slides above, these quotes
  // take real time to read, so an auto-advancing track would fight the
  // reader instead of helping them.
  const testimonialsTrack = document.querySelector('[data-testimonials-track]');
  const testimonialsPrev = document.querySelector('[data-testimonials-prev]');
  const testimonialsNext = document.querySelector('[data-testimonials-next]');

  if (testimonialsTrack) {
    const trackWrap = testimonialsTrack.parentElement;

    function scrollByCard(direction) {
      const card = testimonialsTrack.querySelector('.testimonial');
      if (!card) return;
      const amount = (card.getBoundingClientRect().width + 20) * direction;
      trackWrap.scrollBy({ left: amount, behavior: reducedMotion ? 'auto' : 'smooth' });
    }

    function updateArrowState() {
      if (!testimonialsPrev || !testimonialsNext) return;
      const maxScroll = trackWrap.scrollWidth - trackWrap.clientWidth;
      testimonialsPrev.disabled = trackWrap.scrollLeft <= 1;
      testimonialsNext.disabled = trackWrap.scrollLeft >= maxScroll - 1;
    }

    if (testimonialsPrev) testimonialsPrev.addEventListener('click', () => scrollByCard(-1));
    if (testimonialsNext) testimonialsNext.addEventListener('click', () => scrollByCard(1));
    trackWrap.addEventListener('scroll', updateArrowState, { passive: true });
    window.addEventListener('resize', updateArrowState);
    updateArrowState();
  }

  const workGrid = document.querySelector('[data-work-grid]');
  const workFilterTabs = document.querySelectorAll('.work-filter__tab');

  if (workGrid && workFilterTabs.length) {
    const workCards = Array.from(workGrid.querySelectorAll('.case-study__card'));
    const workEmptyState = workGrid.querySelector('[data-work-empty]');

    function applyWorkFilter(filter) {
      let visibleCount = 0;
      workCards.forEach((card) => {
        const matches = filter === 'all' || card.dataset.category === filter;
        card.hidden = !matches;
        if (matches) visibleCount += 1;
      });
      if (workEmptyState) {
        workEmptyState.hidden = visibleCount !== 0;
      }
    }

    workFilterTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        workFilterTabs.forEach((t) => {
          t.classList.remove('is-active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('is-active');
        tab.setAttribute('aria-selected', 'true');
        applyWorkFilter(tab.dataset.filter);
      });
    });
  }

  const experienceToggles = document.querySelectorAll('[data-experience-toggle]');

  if (experienceToggles.length) {
    experienceToggles.forEach((toggle) => {
      toggle.addEventListener('click', () => {
        const item = toggle.closest('.experience__item');
        const wasOpen = item.classList.contains('is-open');

        experienceToggles.forEach((t) => {
          t.closest('.experience__item').classList.remove('is-open');
          t.setAttribute('aria-expanded', 'false');
        });

        if (!wasOpen) {
          item.classList.add('is-open');
          toggle.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

})();
