(() => {
  'use strict';
  const targetFrameMs = 1000 / 60;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 901px)');
  const header = document.querySelector('[data-header]');
  const menuButton = document.querySelector('[data-menu-button]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  const mobileAppointment = document.querySelector('.mobile-appointment');
  const appointment = document.querySelector('#appointment');
  const doctorsIntroSection = document.querySelector('.doctors-intro');
  const doctorSliderSection = document.querySelector('[data-doctor-slider]');
  const bridge = document.querySelector('[data-optical-bridge]');
  const horizontal = document.querySelector('[data-horizontal]');
  const track = document.querySelector('[data-horizontal-track]');
  const progressBar = document.querySelector('[data-horizontal-progress]');
  const panels = [...document.querySelectorAll('.journey-panel')];
  const routePanel = document.querySelector('.journey-panel--plan');
  const opticSpecs = [
    { host: '.appointment', name: 'mirror-macro', src: '../assets/images/foreground-optics/mirror-macro.png', depth: 32 },
    { host: '.doctor-slider', name: 'scanner-macro', src: '../assets/images/foreground-optics/scanner-macro-v1.png', depth: -24 }
  ];
  const foregroundMotion = opticSpecs.map((spec) => {
    const host = document.querySelector(spec.host);
    if (!host) return null;
    host.classList.add('foreground-host');
    const image = document.createElement('img');
    image.className = `foreground-optic foreground-optic--${spec.name}`;
    image.src = spec.src;
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.decoding = 'async';
    image.loading = spec.eager ? 'eager' : 'lazy';
    if (spec.eager) image.fetchPriority = 'high';
    host.append(image);
    return { host, image, depth: spec.depth, x: 0, y: 0, rotate: 0, targetX: 0, targetY: 0, targetRotate: 0, active: false };
  }).filter(Boolean);
  const foregroundObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const item = foregroundMotion.find((candidate) => candidate.host === entry.target);
      if (!item) return;
      item.active = entry.isIntersecting;
      item.image.classList.toggle('is-motion-active', item.active);
    });
    requestMotion();
  }, { rootMargin: '32% 0px' }) : null;
  foregroundMotion.forEach((item) => {
    if (foregroundObserver) foregroundObserver.observe(item.host);
    else { item.active = true; item.image.classList.add('is-motion-active'); }
  });
  const driftSpecs = [
    ['.manifesto .eyebrow', -9],
    ['.manifesto-statement h2', 25],
    ['.manifesto-statement > p:not(.eyebrow)', 11],
    ['.section-heading .eyebrow', -10],
    ['.section-heading h2', 22],
    ['.section-heading > p:not(.eyebrow)', 9],
    ['.evidence-head .eyebrow', -9],
    ['.evidence-head h2', 20],
    ['.evidence-head > p:not(.eyebrow)', 10],
    ['.appointment-copy .eyebrow', -8],
    ['.appointment-copy h2', 19],
    ['.appointment-copy > p:not(.eyebrow)', 9]
  ];
  const smoothBlocks = driftSpecs.flatMap(([selector, depth]) => [...document.querySelectorAll(selector)].map((element) => ({ element, depth, value: 0, target: 0, active: false })));
  smoothBlocks.forEach((item) => item.element.classList.add('scroll-drift-layer'));
  const motionValues = new WeakMap();
  const setMotionValue = (element, property, value) => {
    let values = motionValues.get(element);
    if (!values) { values = new Map(); motionValues.set(element, values); }
    if (values.get(property) === value) return;
    values.set(property, value);
    element.style.setProperty(property, value);
  };
  const motionLayerObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const item = smoothBlocks.find((candidate) => candidate.element === entry.target);
      if (!item) return;
      item.active = entry.isIntersecting;
      item.element.classList.toggle('is-motion-active', item.active);
    });
    requestMotion();
  }, { rootMargin: '35% 0px' }) : null;
  smoothBlocks.forEach((item) => {
    if (motionLayerObserver) motionLayerObserver.observe(item.element);
    else { item.active = true; item.element.classList.add('is-motion-active'); }
  });
  let lastY = scrollY;
  let downDistance = 0;
  let upDistance = 0;
  let railTarget = 0;
  let railCurrent = 0;
  let bridgeTarget = 0;
  let bridgeCurrent = 0;
  let introCameraTarget = 0;
  let introCameraCurrent = 0;
  let introCameraSettling = false;
  let journeyPanelSettling = false;
  let animationFrame = 0;
  let panelMetrics = [];
  let horizontalScrollDistance = 1;
  let railTravel = 0;
  const panelDepthEnabled = true;

  function setRouteDiagramProgress(progress) {
    if (!routePanel) return;
    const value = Math.max(0, Math.min(1, progress));
    setMotionValue(routePanel, '--route-progress', value.toFixed(4));
    [0, .18, .38, .6, .82].forEach((threshold, index) => {
      const reveal = Math.max(0, Math.min(1, (value - threshold) / .12));
      setMotionValue(routePanel, `--route-node-${index + 1}`, reveal.toFixed(4));
    });
  }

  function refreshMotionLayout() {
    panelMetrics = panels.map((panel) => ({ panel, left: panel.offsetLeft, width: panel.offsetWidth }));
    railTravel = track ? Math.max(0, track.scrollWidth - innerWidth) : 0;
    horizontalScrollDistance = Math.max(1, railTravel);
    if (horizontal && desktop.matches && !reduced.matches) {
      const endRest = Math.round(Math.min(180, Math.max(110, innerHeight * .14)));
      horizontal.style.height = `${Math.round(innerHeight + railTravel + endRest)}px`;
    }
    else horizontal?.style.removeProperty('height');
  }
  refreshMotionLayout();

  function updateJourneyDepth(railX) {
    if (!panelDepthEnabled) return;
    introCameraSettling = false;
    journeyPanelSettling = false;
    panelMetrics.forEach(({ panel, left, width }) => {
      const center = left + width * .5 + railX;
      const rawLocal = (center - innerWidth * .5) / innerWidth;
      const active = Math.abs(rawLocal) < 1.35;
      if (panel.classList.contains('is-motion-active') !== active) panel.classList.toggle('is-motion-active', active);
      if (!active) return;
      const local = Math.max(-1, Math.min(1, rawLocal));
      const depthLayers = [
        ['_journeyCopyMotion', '--copy-shift', -local * 8, .1],
        ['_journeyKickerMotion', '--kicker-shift', -local * 22, .11],
        ['_journeyTitleMotion', '--title-shift', -local * 48, .082],
        ['_journeyBodyMotion', '--body-shift', -local * 28, .095],
        ['_journeyCaptionMotion', '--caption-shift', -local * 12, .12]
      ];
      depthLayers.forEach(([stateKey, property, target, ease]) => {
        if (!Number.isFinite(panel[stateKey])) panel[stateKey] = target;
        panel[stateKey] += (target - panel[stateKey]) * (reduced.matches ? 1 : ease);
        if (Math.abs(target - panel[stateKey]) > .12) journeyPanelSettling = true;
        setMotionValue(panel, property, `${panel[stateKey].toFixed(2)}px`);
      });
      if (panel.classList.contains('journey-panel--intro')) {
        const travelled = Math.max(0, -railX);
        introCameraTarget = -Math.min(280, travelled * .30);
        introCameraCurrent += (introCameraTarget - introCameraCurrent) * (reduced.matches ? 1 : .085);
        introCameraSettling = Math.abs(introCameraTarget - introCameraCurrent) > .12;
        const reveal = Math.min(1, Math.abs(introCameraCurrent) / 210);
        setMotionValue(panel, '--intro-camera-shift', `${introCameraCurrent.toFixed(2)}px`);
        setMotionValue(panel, '--intro-copy-drift', `${(45 * (1 - Math.exp(-travelled / 650))).toFixed(2)}px`);
        setMotionValue(panel, '--intro-copy-lock', `${((560 + innerWidth * .07) * (1 - Math.exp(-travelled / 700))).toFixed(2)}px`);
        setMotionValue(panel, '--intro-copy-blur', `${(3.2 * (1 - reveal)).toFixed(2)}px`);
        setMotionValue(panel, '--intro-copy-opacity', `${(.58 + reveal * .42).toFixed(3)}`);
      }
      if (panel === routePanel) setRouteDiagramProgress((.98 - rawLocal) / 1.34);
    });
  }

  function initDesktopSmoothScroll() {
    let enabled = desktop.matches && !reduced.matches;
    let current = scrollY;
    let target = scrollY;
    let frame = 0;
    let animating = false;
    let lastTickTime = 0;

    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const clampTarget = (value) => Math.max(0, Math.min(maxScroll(), value));
    const sync = () => { current = scrollY; target = scrollY; };
    const stop = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      animating = false;
      lastTickTime = 0;
      sync();
    };
    // Shared route for scripted scrolling: keeps the desktop inertia state in
    // sync, so a section snap cannot be overwritten by the wheel controller.
    window.__dentaScrollTo = (value, immediate = false) => {
      target = clampTarget(value);
      if (immediate) {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        current = target;
        animating = false;
        lastTickTime = 0;
        window.scrollTo(0, target);
        return;
      }
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const applyMode = () => {
      enabled = desktop.matches && !reduced.matches;
      document.documentElement.classList.toggle('has-desktop-inertia', enabled);
      stop();
    };
    const tick = (time) => {
      if (!enabled) { stop(); return; }
      const elapsed = time - lastTickTime;
      if (lastTickTime && elapsed < targetFrameMs - .5) {
        frame = requestAnimationFrame(tick);
        return;
      }
      lastTickTime = time - (elapsed % targetFrameMs);
      const delta = target - current;
      current += delta * .08;
      if (Math.abs(delta) < .35) current = target;
      animating = true;
      window.scrollTo(0, current);
      if (current !== target) frame = requestAnimationFrame(tick);
      else { frame = 0; animating = false; }
    };
    const editable = (targetElement) => targetElement instanceof Element && targetElement.closest('input,textarea,select,[contenteditable="true"]');
    addEventListener('wheel', (event) => {
      if (!enabled || event.ctrlKey || event.metaKey || menuOpen() || editable(event.target)) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      target = clampTarget(target + event.deltaY * unit * .88);
      if (!frame) frame = requestAnimationFrame(tick);
    }, { passive: false });
    addEventListener('scroll', () => { if (!animating && !frame) sync(); }, { passive: true });
    addEventListener('pointerdown', () => { if (frame) stop(); }, { passive: true });
    addEventListener('keydown', (event) => {
      if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown', ' '].includes(event.key) && frame) stop();
    });
    addEventListener('resize', () => { target = clampTarget(target); }, { passive: true });
    desktop.addEventListener?.('change', applyMode);
    reduced.addEventListener?.('change', applyMode);
    applyMode();
  }
  initDesktopSmoothScroll();

  function initPremiumMotion() {
    if (reduced.matches || !window.gsap || !window.ScrollTrigger) return;
    window.gsap.registerPlugin(window.ScrollTrigger);
    window.gsap.ticker.fps(60);
    const mobileMotion = window.matchMedia('(max-width: 900px)').matches;
    window.gsap.utils.toArray('.service-card').forEach((card, index) => {
      window.gsap.fromTo(card, { '--reveal-y': `${48 + index * 7}px` }, {
        '--reveal-y': '0px',
        ease: 'none',
        scrollTrigger: { trigger: card, start: 'top 92%', end: 'top 58%', scrub: .65 }
      });
      const image = card.querySelector('img');
      if (image) {
        window.gsap.fromTo(image, { opacity: .7, filter: 'blur(3px)' }, {
          opacity: 1,
          filter: 'blur(0px)',
          ease: 'none',
          scrollTrigger: { trigger: card, start: 'top 94%', end: 'top 64%', scrub: .72 }
        });
      }
    });
    window.gsap.utils.toArray('.evidence-grid article').forEach((card, index) => {
      if (mobileMotion) {
        window.gsap.fromTo(card, { y: 48, scale: .955, opacity: 0, rotate: index === 1 ? -.55 : .55 }, {
          y: 0,
          scale: 1,
          opacity: 1,
          rotate: 0,
          duration: .9,
          ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 88%', toggleActions: 'play none none reverse' }
        });
      } else {
        window.gsap.fromTo(card, { y: 42 + index * 18, rotate: index === 1 ? -.8 : .8 }, {
          y: 0,
          rotate: 0,
          ease: 'none',
          scrollTrigger: { trigger: '.evidence-grid', start: 'top 88%', end: 'center 62%', scrub: .7 }
        });
      }
    });
    if (mobileMotion) {
      window.gsap.fromTo('.evidence-finance', { y: 54, scale: .965, opacity: 0 }, {
        y: 0,
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.evidence-finance', start: 'top 88%', toggleActions: 'play none none reverse' }
      });
    }
    window.gsap.fromTo('.appointment-actions', { y: 56, opacity: .72 }, {
      y: 0,
      opacity: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.appointment', start: 'top 86%', end: 'top 44%', scrub: .8 }
    });
    const doctorTimeline = window.gsap.timeline({
      scrollTrigger: { trigger: '.doctor-slider', start: 'top bottom', end: 'bottom top', scrub: .9 }
    });
    doctorTimeline
      .fromTo('.doctor-slide__copy', { y: 34 }, { y: -22, ease: 'none' }, 0)
      .fromTo('.doctor-slide__portrait', { yPercent: 5, scale: 1.025 }, { yPercent: -4, scale: 1, ease: 'none' }, 0)
      .fromTo('.doctor-slide__xray img', { yPercent: -5, scale: .985 }, { yPercent: 6, scale: 1.02, ease: 'none' }, 0)
      .fromTo('.doctor-slide__field svg', { yPercent: -2 }, { yPercent: 3.5, ease: 'none' }, 0)
      .fromTo('.doctor-slider__ambient', { y: -18 }, { y: 18, ease: 'none' }, 0);
    window.gsap.fromTo('.doctors-intro__team', { yPercent: -2.5, scale: 1.035 }, {
      yPercent: 2.5,
      scale: 1.055,
      ease: 'none',
      scrollTrigger: { trigger: '.doctors-intro', start: 'top bottom', end: 'bottom top', scrub: .9 }
    });
  }
  window.addEventListener('load', initPremiumMotion, { once: true });

  function initEvidenceMobileFallback() {
    if (reduced.matches || window.matchMedia('(min-width: 901px)').matches || (window.gsap && window.ScrollTrigger) || !('IntersectionObserver' in window)) return;
    const targets = [...document.querySelectorAll('.evidence-grid article, .evidence-finance')];
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-evidence-visible', entry.isIntersecting));
    }, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
    targets.forEach((target, index) => {
      target.classList.add('evidence-reveal');
      target.style.setProperty('--evidence-delay', `${Math.min(index, 3) * 55}ms`);
      observer.observe(target);
    });
  }
  window.addEventListener('load', initEvidenceMobileFallback, { once: true });

  function initSectionMagnet() {
    if (reduced.matches) return;
    if (initSectionMagnet.started) return;
    initSectionMagnet.started = true;
    let timer = 0;
    let releaseTimer = 0;
    let snapping = false;

    const candidates = () => {
      return [...document.querySelectorAll('[data-section-snap="always"]')];
    };

    const cancelSnap = () => {
      clearTimeout(timer);
      clearTimeout(releaseTimer);
      if (snapping) window.scrollTo({ top: scrollY, behavior: 'auto' });
      snapping = false;
      document.documentElement.classList.remove('is-section-snapping');
    };

    const settle = () => {
      if (snapping || menuOpen() || document.activeElement?.matches('input,textarea,select')) return;
      const threshold = innerHeight * (desktop.matches ? .82 : .48);
      let best = null;
      let bestDistance = Infinity;
      candidates().forEach((section) => {
        const rect = section.getBoundingClientRect();
        const distance = Math.abs(rect.top);
        const entryLine = innerHeight * (desktop.matches ? .88 : .62);
        const meaningfullyVisible = rect.bottom > innerHeight * .4 && rect.top < entryLine;
        if (!meaningfullyVisible || distance >= threshold || distance >= bestDistance) return;
        best = section;
        bestDistance = distance;
      });
      if (!best || bestDistance < 3) return;
      snapping = true;
      document.documentElement.classList.add('is-section-snapping');
      const rect = best.getBoundingClientRect();
      const startY = scrollY;
      const targetY = Math.max(0, startY + rect.top);
      const duration = desktop.matches ? 540 : 420;
      const startedAt = performance.now();
      const animateToSection = (now) => {
        if (!snapping) return;
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 4);
        const nextY = startY + (targetY - startY) * eased;
        if (typeof window.__dentaScrollTo === 'function') window.__dentaScrollTo(nextY, true);
        else window.scrollTo({ top: nextY, behavior: 'auto' });
        if (progress < 1) requestAnimationFrame(animateToSection);
      };
      requestAnimationFrame(animateToSection);
      releaseTimer = window.setTimeout(() => {
        snapping = false;
        document.documentElement.classList.remove('is-section-snapping');
      }, duration + 90);
    };

    const schedule = () => {
      if (snapping) return;
      clearTimeout(timer);
      timer = window.setTimeout(settle, desktop.matches ? 170 : 210);
    };

    addEventListener('scroll', schedule, { passive: true });
    addEventListener('wheel', () => { if (snapping) cancelSnap(); }, { passive: true });
    addEventListener('touchstart', () => { if (snapping) cancelSnap(); }, { passive: true });
    addEventListener('pointerdown', () => { if (snapping) cancelSnap(); }, { passive: true });
    desktop.addEventListener?.('change', cancelSnap);
  }
  if (document.readyState === 'complete') initSectionMagnet();
  else window.addEventListener('load', initSectionMagnet, { once: true });

  const menuOpen = () => menuButton?.getAttribute('aria-expanded') === 'true';
  function setMenu(open, restoreFocus = true) {
    if (!menuButton || !mobileMenu) return;
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    if (open) {
      mobileMenu.hidden = false;
      requestAnimationFrame(() => mobileMenu.classList.add('is-open'));
    } else {
      mobileMenu.classList.remove('is-open');
      window.setTimeout(() => {
        if (!menuOpen()) mobileMenu.hidden = true;
      }, reduced.matches ? 0 : 300);
    }
    document.body.classList.toggle('menu-open', open);
    document.querySelectorAll('main,.site-footer,.mobile-appointment').forEach((element) => { element.inert = open; });
    header?.classList.remove('is-hidden');
    if (open) requestAnimationFrame(() => mobileMenu.querySelector('a')?.focus({ preventScroll: true }));
    else if (restoreFocus && menuButton.offsetParent !== null) menuButton.focus({ preventScroll: true });
  }
  menuButton?.addEventListener('click', () => setMenu(!menuOpen()));
  mobileMenu?.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (event) => {
    if (!menuOpen()) return;
    if (event.key === 'Escape') { setMenu(false); return; }
    if (event.key !== 'Tab') return;
    const focusable = [menuButton, ...mobileMenu.querySelectorAll('a,button')].filter((element) => !element.hidden);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  header?.addEventListener('focusin', () => header.classList.remove('is-hidden'));

  panels.forEach((panel) => {
    const title = panel.querySelector('h2,h3');
    if (!title) return;
    const lines = title.innerHTML.split(/<br\s*\/?\s*>/i);
    title.innerHTML = lines.map((line) => `<span class="journey-title-line"><span>${line.trim()}</span></span>`).join('');
  });

  function measureTargets() {
    if (reduced.matches) { railTarget = 0; bridgeTarget = 0; return; }
    if (horizontal && track && desktop.matches) {
      const rect = horizontal.getBoundingClientRect();
      const routeOffset = Math.max(0, Math.min(horizontalScrollDistance, -rect.top));
      railTarget = -routeOffset;
      if (progressBar) progressBar.style.transform = `scaleX(${routeOffset / horizontalScrollDistance})`;
    }
    else if (routePanel && desktop.matches) {
      const rect = routePanel.getBoundingClientRect();
      setRouteDiagramProgress((innerHeight * .86 - rect.top) / (innerHeight * .62));
    }
    if (routePanel && reduced.matches) setRouteDiagramProgress(1);
    if (bridge) {
      const rect = bridge.getBoundingClientRect();
      bridgeTarget = Math.max(-1, Math.min(1, (innerHeight * .5 - (rect.top + rect.height * .5)) / (innerHeight + rect.height)));
    }
    foregroundMotion.forEach((item) => {
      if (!item.active) return;
      const rect = item.host.getBoundingClientRect();
      const local = Math.max(-1.25, Math.min(1.25, (rect.top + rect.height * .5 - innerHeight * .5) / (innerHeight * .85)));
      item.targetX = local * item.depth * .34;
      item.targetY = local * item.depth;
      item.targetRotate = local * 3.4;
    });
    smoothBlocks.forEach((item) => {
      if (!item.active) return;
      const rect = item.element.getBoundingClientRect();
      item.target = Math.max(-1, Math.min(1, (rect.top + rect.height * .5 - innerHeight * .52) / innerHeight)) * item.depth;
    });
  }

  let lastMotionFrameTime = 0;
  function renderMotion(time) {
    const elapsed = time - lastMotionFrameTime;
    if (lastMotionFrameTime && elapsed < targetFrameMs - .5) {
      animationFrame = requestAnimationFrame(renderMotion);
      return;
    }
    lastMotionFrameTime = time - (elapsed % targetFrameMs);
    animationFrame = 0;
    const railEase = 1;
    const bridgeEase = reduced.matches ? 1 : .075;
    railCurrent += (railTarget - railCurrent) * railEase;
    bridgeCurrent += (bridgeTarget - bridgeCurrent) * bridgeEase;
    if (track && desktop.matches && !reduced.matches) {
      setMotionValue(track, '--rail-current', `${railCurrent.toFixed(2)}px`);
      updateJourneyDepth(railCurrent);
    }
    if (bridge && !reduced.matches) {
      setMotionValue(bridge, '--bridge-shift', `${(bridgeCurrent * 34).toFixed(2)}px`);
      setMotionValue(bridge, '--bridge-x', `${(bridgeCurrent * -18).toFixed(2)}px`);
      setMotionValue(bridge, '--bridge-scale', String(1.055 - Math.abs(bridgeCurrent) * .018));
    }
    foregroundMotion.forEach((item) => {
      if (!item.active) return;
      const ease = reduced.matches ? 1 : .07;
      item.x += (item.targetX - item.x) * ease;
      item.y += (item.targetY - item.y) * ease;
      item.rotate += (item.targetRotate - item.rotate) * ease;
      setMotionValue(item.image, '--foreground-x', `${item.x.toFixed(2)}px`);
      setMotionValue(item.image, '--foreground-y', `${item.y.toFixed(2)}px`);
      setMotionValue(item.image, '--foreground-rotate', `${item.rotate.toFixed(2)}deg`);
    });
    smoothBlocks.forEach((item) => {
      if (!item.active) return;
      item.value += (item.target - item.value) * (reduced.matches ? 1 : .08);
      setMotionValue(item.element, '--section-drift', `${item.value.toFixed(2)}px`);
    });
    const foregroundSettling = foregroundMotion.some((item) => item.active && Math.abs(item.targetY - item.y) > .12);
    const blockSettling = smoothBlocks.some((item) => item.active && Math.abs(item.target - item.value) > .08);
    if (Math.abs(railTarget - railCurrent) > .08 || Math.abs(bridgeTarget - bridgeCurrent) > .001 || introCameraSettling || journeyPanelSettling || foregroundSettling || blockSettling) animationFrame = requestAnimationFrame(renderMotion);
  }
  function requestMotion() {
    measureTargets();
    if (!animationFrame) animationFrame = requestAnimationFrame(renderMotion);
  }

  function updateChrome() {
    const y = Math.max(0, scrollY);
    const delta = y - lastY;
    header?.classList.toggle('is-scrolled', y > 22);
    if (delta > 0) {
      downDistance += delta;
      upDistance = 0;
      if (downDistance > 16 && y > 110 && !menuOpen()) header?.classList.add('is-hidden');
    } else if (delta < 0) {
      upDistance += -delta;
      downDistance = 0;
      if (upDistance > 9) header?.classList.remove('is-hidden');
    }
    if (y < 70 || menuOpen()) header?.classList.remove('is-hidden');
    if (mobileAppointment && appointment && !desktop.matches) {
      const rect = appointment.getBoundingClientRect();
      const doctorRect = doctorSliderSection?.getBoundingClientRect();
      const routeRect = horizontal?.getBoundingClientRect();
      const servicesRect = document.querySelector('.services')?.getBoundingClientRect();
      const doctorVisible = doctorRect && doctorRect.bottom > 0 && doctorRect.top < innerHeight;
      const routeVisible = routeRect && routeRect.bottom > 0 && routeRect.top < innerHeight;
      const servicesVisible = servicesRect && servicesRect.bottom > 0 && servicesRect.top < innerHeight;
      mobileAppointment.classList.toggle('is-hidden', rect.top < innerHeight * .72 || y < 220 || doctorVisible || routeVisible || servicesVisible);
    }
    const doctorRect = doctorSliderSection?.getBoundingClientRect();
    const doctorDarkVisible = doctorRect && doctorRect.bottom > 0 && doctorRect.top < innerHeight && doctorSliderSection.classList.contains('is-dark-slide');
    header?.classList.toggle('is-doctor-dark', Boolean(doctorDarkVisible));
    if (!desktop.matches) {
      const introRect = doctorsIntroSection?.getBoundingClientRect();
      const chapterAtCenter = [introRect, doctorRect].some((rect) => rect && rect.top < innerHeight * .52 && rect.bottom > innerHeight * .48);
      header?.classList.toggle('is-doctor-chapter', Boolean(chapterAtCenter));
    } else header?.classList.remove('is-doctor-chapter');
    lastY = y;
    requestMotion();
  }
  let chromeFrame = 0;
  let lastChromeFrameTime = 0;
  const requestChromeUpdate = () => {
    if (chromeFrame) return;
    const run = (time) => {
      const elapsed = time - lastChromeFrameTime;
      if (lastChromeFrameTime && elapsed < targetFrameMs - .5) {
        chromeFrame = requestAnimationFrame(run);
        return;
      }
      lastChromeFrameTime = time - (elapsed % targetFrameMs);
      chromeFrame = 0;
      updateChrome();
    };
    chromeFrame = requestAnimationFrame(run);
  };
  addEventListener('scroll', requestChromeUpdate, { passive: true });
  addEventListener('resize', () => { refreshMotionLayout(); railCurrent = railTarget; introCameraCurrent = introCameraTarget; updateChrome(); }, { passive: true });
  desktop.addEventListener?.('change', () => {
    if (desktop.matches && menuOpen()) setMenu(false, false);
    railCurrent = 0;
    track?.style.removeProperty('--rail-current');
    refreshMotionLayout();
    requestMotion();
  });

  const blurCopy = document.querySelector('[data-blur-copy]');
  if (blurCopy) {
    const words = blurCopy.textContent.trim().split(/\s+/);
    blurCopy.textContent = '';
    words.forEach((word, index) => {
      const span = document.createElement('span');
      span.className = 'blur-word';
      span.style.setProperty('--i', index);
      span.textContent = word;
      blurCopy.append(span, document.createTextNode(' '));
    });
    const reveal = () => blurCopy.classList.add('is-revealed');
    if (reduced.matches) reveal();
    else {
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        reveal();
        observer.disconnect();
      }, { threshold: .18, rootMargin: '0px 0px -12% 0px' });
      observer.observe(blurCopy);
    }
  }

  // Editorial focus reveal — intentionally limited to the user-marked content.
  // Keep it native so the effect still works when the optional GSAP CDN is unavailable.
  const markedFocusSelectors = [
    '#manifesto-title',
    '#services-title',
    '#services .section-heading > .eyebrow',
    '#services .section-heading > p:last-child',
    '#services .services-other',
    '#services .service-card :is(.service-card__number, .service-card__name, small)',
    '#doctors-title',
    '#doctors .doctors-intro__head > .eyebrow',
    '#doctors .doctors-intro__head > p:last-of-type',
    '#doctors .doctors-intro__head > span',
    '#results-title',
    '#results .results-head > .eyebrow',
    '#results .results-head > span',
    '#results [data-result-panel] .result-case__copy > *',
    '#complex-care .complex-care__lead > .eyebrow',
    '#complex-care-title',
    '#complex-care .complex-care__lead > p:last-of-type',
    '#complex-care .complex-care__proof :is(b, span, p)',
    '#appointment .appointment-copy > :is(.eyebrow, h2, p)',
    '#appointment .appointment-actions :is(.appointment-primary > span, .appointment-primary > small, .appointment-whatsapp > span, .appointment-call > span, .appointment-call > b, .appointment-actions > p)'
  ];
  const markedFocusTargets = [...new Set(markedFocusSelectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
  const showMarkedFocus = (element) => element.classList.add('is-text-focus-visible');
  const replayMarkedFocus = (scope) => {
    if (!desktop.matches || reduced.matches) return;
    scope.querySelectorAll?.('[data-text-focus]').forEach((element) => {
      element.classList.remove('is-text-focus-visible');
      void element.offsetWidth;
      requestAnimationFrame(() => showMarkedFocus(element));
    });
  };

  markedFocusTargets.forEach((element, index) => {
    element.dataset.textFocus = '';
    element.style.setProperty('--text-focus-delay', `${(index % 4) * 58}ms`);
    if (element.matches('#services .service-card small')) {
      element.style.setProperty('--text-focus-delay', '190ms');
    }
  });
  if (reduced.matches || !desktop.matches) markedFocusTargets.forEach(showMarkedFocus);
  else {
    const focusObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        showMarkedFocus(entry.target);
        focusObserver.unobserve(entry.target);
      });
    }, { threshold: .16, rootMargin: '0px 0px -8% 0px' });
    markedFocusTargets.forEach((element) => focusObserver.observe(element));
  }

  const contactActions = document.querySelector('#appointment .appointment-actions');
  if (contactActions) {
    contactActions.dataset.contactReveal = '';
    const revealContactActions = () => contactActions.classList.add('is-contact-revealed');
    if (reduced.matches) revealContactActions();
    else {
      const contactObserver = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        revealContactActions();
        contactObserver.disconnect();
      }, { threshold: .22, rootMargin: '0px 0px -8% 0px' });
      contactObserver.observe(contactActions);
    }
  }

  // The full 3D card response is reserved for a stable desktop canvas.  On a
  // half-width desktop window it made the card and its copy feel detached.
  const precisePointer = matchMedia('(min-width: 1101px) and (hover: hover) and (pointer: fine)');
  const serviceCards = [...document.querySelectorAll('.service-card')];
  const resetServiceCardPointer = (card) => {
    if (card._pointerFrame) cancelAnimationFrame(card._pointerFrame);
    card._pointerFrame = 0;
    card.classList.remove('is-pointer-active');
    card.style.setProperty('--mx', '68%');
    card.style.setProperty('--my', '24%');
    card.style.setProperty('--tilt-x', '0deg');
    card.style.setProperty('--tilt-y', '0deg');
    card.style.setProperty('--card-x', '0px');
    card.style.setProperty('--card-y', '0px');
    card.style.setProperty('--copy-x', '0px');
    card.style.setProperty('--copy-y', '0px');
    card.style.setProperty('--word-x', '0px');
    card.style.setProperty('--word-y', '0px');
    card.style.setProperty('--marker-x', '0px');
    card.style.setProperty('--marker-y', '0px');
    card.style.setProperty('--marker-rotate', '0deg');
  };
  serviceCards.forEach((card) => {
    card.addEventListener('pointermove', (event) => {
      if (!precisePointer.matches || reduced.matches) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      if (card._pointerFrame) cancelAnimationFrame(card._pointerFrame);
      card._pointerFrame = requestAnimationFrame(() => {
        card.classList.add('is-pointer-active');
        card.style.setProperty('--mx', `${x * 100}%`);
        card.style.setProperty('--my', `${y * 100}%`);
        card.style.setProperty('--tilt-x', `${(.5 - y) * 4.4}deg`);
        card.style.setProperty('--tilt-y', `${(x - .5) * 5.4}deg`);
        card.style.setProperty('--card-x', `${(x - .5) * 30}px`);
        card.style.setProperty('--card-y', `${(y - .5) * 22}px`);
        card.style.setProperty('--copy-x', `${(.5 - x) * 9}px`);
        card.style.setProperty('--copy-y', `${(.5 - y) * 7}px`);
        card.style.setProperty('--word-x', `${(.5 - x) * 18}px`);
        card.style.setProperty('--word-y', `${(.5 - y) * 12}px`);
        card.style.setProperty('--marker-x', `${(x - .5) * 10}px`);
        card.style.setProperty('--marker-y', `${(y - .5) * 8}px`);
        card.style.setProperty('--marker-rotate', `${(x - .5) * 18}deg`);
        card._pointerFrame = 0;
      });
    });
    card.addEventListener('pointerleave', () => {
      resetServiceCardPointer(card);
    });
  });
  precisePointer.addEventListener?.('change', () => {
    if (!precisePointer.matches) serviceCards.forEach(resetServiceCardPointer);
  });

  const doctorSlider = document.querySelector('[data-doctor-slider]');
  if (doctorSlider) {
    const slides = [...doctorSlider.querySelectorAll('[data-doctor-slide]')];
    const counter = doctorSlider.querySelector('[data-doctor-counter]');
    let current = 0;
    let locked = false;
    const show = (next) => {
      if (locked || next === current) return;
      locked = true;
      const outgoing = slides[current];
      const incoming = slides[next];
      const stableScrollY = window.scrollY;
      const finish = () => {
        outgoing.hidden = true;
        outgoing.className = outgoing.className.replace(/\s*doctor-slide--leave/g, '').replace(/\s*is-active/g, '');
        incoming.hidden = false;
        incoming.classList.add('is-active', 'doctor-slide--enter');
        current = next;
        doctorSlider.classList.toggle('is-dark-slide', incoming.dataset.tone === 'dark');
        const restoreDoctorScroll = () => window.scrollTo({ top: stableScrollY, behavior: 'auto' });
        restoreDoctorScroll();
        updateChrome();
        requestAnimationFrame(() => requestAnimationFrame(() => {
          if (Math.abs(window.scrollY - stableScrollY) > 1) {
            restoreDoctorScroll();
            updateChrome();
          }
        }));
        window.setTimeout(() => {
          if (Math.abs(window.scrollY - stableScrollY) > 1) {
            restoreDoctorScroll();
            updateChrome();
          }
        }, 460);
        window.setTimeout(() => {
          if (Math.abs(window.scrollY - stableScrollY) > 1) {
            restoreDoctorScroll();
            updateChrome();
          }
        }, 1120);
        doctorSlider.querySelectorAll('[data-doctor-index]').forEach((button, index) => button.classList.toggle('is-active', index === current));
        if (counter) counter.textContent = `Профиль ${String(current + 1).padStart(2, '0')}`;
        setTimeout(() => { incoming.classList.remove('doctor-slide--enter'); locked = false; }, reduced.matches ? 0 : 1000);
      };
      if (reduced.matches) finish();
      else { outgoing.classList.add('doctor-slide--leave'); setTimeout(finish, 380); }
    };
    doctorSlider.querySelector('[data-doctor-prev]')?.addEventListener('click', (event) => {
      if (event.detail) event.currentTarget.blur();
      show((current - 1 + slides.length) % slides.length);
    });
    doctorSlider.querySelector('[data-doctor-next]')?.addEventListener('click', (event) => {
      if (event.detail) event.currentTarget.blur();
      show((current + 1) % slides.length);
    });
    doctorSlider.querySelectorAll('[data-doctor-index]').forEach((button) => button.addEventListener('click', () => show(Number(button.dataset.doctorIndex))));
  }

  const results = document.querySelector('[data-results]');
  if (results) {
    const cases = [...results.querySelectorAll('[data-result-panel]')];
    const caseButtons = [...results.querySelectorAll('[data-result-index]')];
    const caseCounter = results.querySelector('[data-result-counter]');
    let currentCase = 0;

    const privacyFields = [...results.querySelectorAll('.result-case__privacy-field')].map((canvas, fieldIndex) => ({
      canvas,
      fieldIndex,
      width: 0,
      height: 0,
      particles: []
    }));

    const seed = (value) => {
      const sine = Math.sin(value * 12.9898) * 43758.5453;
      return sine - Math.floor(sine);
    };

    const paintPrivacyField = (field, time = 0) => {
      const media = field.canvas.closest('.result-case__media');
      if (!media || media.closest('[hidden]')) return;
      const bounds = media.getBoundingClientRect();
      if (bounds.width < 2 || bounds.height < 2) return;
      const scale = Math.min(window.devicePixelRatio || 1, 1.5);
      const width = Math.round(bounds.width * scale);
      const height = Math.round(bounds.height * scale);
      if (field.width !== width || field.height !== height) {
        field.width = width;
        field.height = height;
        field.canvas.width = width;
        field.canvas.height = height;
        const amount = Math.max(260, Math.min(720, Math.round((bounds.width * bounds.height) / 440)));
        field.particles = Array.from({ length: amount }, (_, index) => {
          const token = index + 1 + field.fieldIndex * 251;
          return {
            x: seed(token * 1.1),
            y: seed(token * 2.3),
            radius: .44 + seed(token * 3.7) * 2.1,
            phase: seed(token * 5.9) * Math.PI * 2,
            drift: .42 + seed(token * 7.1) * 1.45,
            alpha: .22 + seed(token * 8.9) * .68
          };
        });
      }
      const context = field.canvas.getContext('2d');
      if (!context) return;
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, bounds.width, bounds.height);
      const flow = time * .00072;
      field.particles.forEach((particle, index) => {
        const wave = Math.sin(flow * particle.drift + particle.phase);
        const cross = Math.cos(flow * (particle.drift * .71) + particle.phase * 1.7);
        const x = ((particle.x + wave * .052 + cross * .024) % 1 + 1) % 1 * bounds.width;
        const y = ((particle.y + cross * .038 + wave * .023) % 1 + 1) % 1 * bounds.height;
        const alpha = particle.alpha * (.48 + (wave + 1) * .29);
        context.beginPath();
        context.fillStyle = `rgba(233, 237, 235, ${alpha})`;
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
        if (index % 4 === 0) {
          context.beginPath();
          context.fillStyle = `rgba(255, 255, 255, ${alpha * .32})`;
          context.arc(x + wave * 8, y + cross * 6, particle.radius * .58, 0, Math.PI * 2);
          context.fill();
        }
      });
    };

    let privacyFrame = 0;
    let resultsVisible = false;
    const paintPrivacyFields = (time) => {
      privacyFrame = 0;
      if (!resultsVisible || reduced.matches) return;
      privacyFields.forEach((field) => paintPrivacyField(field, time));
      privacyFrame = requestAnimationFrame(paintPrivacyFields);
    };
    const requestPrivacyPaint = () => {
      if (!resultsVisible || reduced.matches || privacyFrame) return;
      privacyFrame = requestAnimationFrame(paintPrivacyFields);
    };

    if (privacyFields.length) {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
          resultsVisible = entry.isIntersecting;
          if (resultsVisible) requestPrivacyPaint();
          else if (privacyFrame) { cancelAnimationFrame(privacyFrame); privacyFrame = 0; }
        }, { rootMargin: '18% 0px' }).observe(results);
      } else {
        resultsVisible = true;
        requestPrivacyPaint();
      }
      addEventListener('resize', () => {
        privacyFields.forEach((field) => { field.width = 0; field.height = 0; });
        requestPrivacyPaint();
      }, { passive: true });
    }

    let resultsRevealed = false;
    const revealAllResults = () => {
      resultsRevealed = true;
      results.querySelectorAll('.result-case__media').forEach((media) => {
        media.classList.remove('is-censored');
        media.classList.add('is-revealed');
      });
      results.querySelectorAll('[data-result-reveal]').forEach((button) => {
        button.setAttribute('aria-pressed', 'true');
        button.setAttribute('aria-label', 'Работы показаны');
      });
    };

    results.querySelectorAll('[data-result-reveal]').forEach((button) => button.addEventListener('click', () => {
      if (!resultsRevealed) revealAllResults();
    }));

    const showCase = (next) => {
      const normalized = (next + cases.length) % cases.length;
      if (normalized === currentCase) return;
      cases[currentCase].hidden = true;
      cases[currentCase].classList.remove('is-active');
      currentCase = normalized;
      cases[currentCase].hidden = false;
      requestAnimationFrame(() => cases[currentCase].classList.add('is-active'));
      requestAnimationFrame(() => replayMarkedFocus(cases[currentCase]));
      caseButtons.forEach((button, index) => {
        const active = index === currentCase;
        button.classList.toggle('is-active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (caseCounter) caseCounter.textContent = `${String(currentCase + 1).padStart(2, '0')} / ${String(cases.length).padStart(2, '0')}`;
    };
    results.querySelector('[data-result-prev]')?.addEventListener('click', () => showCase(currentCase - 1));
    results.querySelector('[data-result-next]')?.addEventListener('click', () => showCase(currentCase + 1));
    caseButtons.forEach((button) => button.addEventListener('click', () => showCase(Number(button.dataset.resultIndex))));
  }

  track?.addEventListener('keydown', (event) => {
    if (desktop.matches || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    track.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * innerWidth * .78, behavior: reduced.matches ? 'auto' : 'smooth' });
  });

  if (horizontal && !reduced.matches) {
    const mobileJourneyObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => entry.target.classList.toggle('is-in-view', entry.isIntersecting));
    }, { threshold: .38, rootMargin: '-12% 0px -12% 0px' });
    panels.forEach((panel) => mobileJourneyObserver.observe(panel));
  }

  if (routePanel && !reduced.matches && 'IntersectionObserver' in window) {
    const routeLine = routePanel.querySelector('.route-line');
    const routeShadow = routePanel.querySelector('.route-shadow');
    const routeNodes = [...routePanel.querySelectorAll('.route-nodes circle')];
    const routeStages = [...routePanel.querySelectorAll('.route-stage')];
    const routeThresholds = [0, .18, .38, .6, .82];
    let mobileRouteFrame = 0;
    let mobileRouteProgress = 0;
    let lastMobileRouteScrollY = scrollY;
    let mobileRouteDirection = 1;

    const paintMobileRoute = (progress) => {
      const value = Math.max(0, Math.min(1, progress));
      mobileRouteProgress = value;
      routeLine?.style.setProperty('stroke-dashoffset', String(1 - value), 'important');
      routeShadow?.style.setProperty('stroke-dashoffset', String(1 - value), 'important');
      routeShadow?.style.setProperty('opacity', String(value * .5), 'important');
      routeNodes.forEach((node, index) => {
        const reveal = Math.max(0, Math.min(1, (value - routeThresholds[index]) / .13));
        node.style.setProperty('opacity', String(reveal), 'important');
        node.style.setProperty('transform', `scale(${.28 + reveal * .72})`, 'important');
      });
      routeStages.forEach((stage, index) => {
        const reveal = Math.max(0, Math.min(1, (value - routeThresholds[index]) / .14));
        stage.style.setProperty('opacity', String(reveal), 'important');
        stage.style.setProperty('transform', `translate3d(0, ${(1 - reveal) * 6}px, 24px)`, 'important');
      });
    };

    const resetMobileRoute = () => {
      cancelAnimationFrame(mobileRouteFrame);
      routePanel.classList.remove('is-mobile-route-played');
      paintMobileRoute(0);
    };

    const animateMobileRoute = (target, duration) => {
      if (desktop.matches) { resetMobileRoute(); return; }
      cancelAnimationFrame(mobileRouteFrame);
      routePanel.classList.add('is-mobile-route-played');
      const from = mobileRouteProgress;
      let start = 0;
      const tick = (now) => {
        if (!start) start = now;
        const raw = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - raw, 3);
        paintMobileRoute(from + (target - from) * eased);
        if (raw < 1) mobileRouteFrame = requestAnimationFrame(tick);
        else if (target === 0) routePanel.classList.remove('is-mobile-route-played');
      };
      mobileRouteFrame = requestAnimationFrame(tick);
    };

    const observeMobileRouteDirection = () => {
      const nextScrollY = scrollY;
      if (Math.abs(nextScrollY - lastMobileRouteScrollY) > 2) {
        mobileRouteDirection = nextScrollY > lastMobileRouteScrollY ? 1 : -1;
        lastMobileRouteScrollY = nextScrollY;
      }
    };
    addEventListener('scroll', observeMobileRouteDirection, { passive: true });

    const mobileRoutePlayback = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (desktop.matches) return;
        if (!entry.isIntersecting) {
          if (mobileRouteDirection < 0) animateMobileRoute(0, 900);
          return;
        }
        if (mobileRouteDirection > 0) animateMobileRoute(1, 2800);
        else animateMobileRoute(0, 1100);
      });
    }, { threshold: .48, rootMargin: '-10% 0px -10% 0px' });
    mobileRoutePlayback.observe(routePanel);
  }

  document.querySelectorAll('[data-contact-placeholder]').forEach((link) => {
    link.addEventListener('click', (event) => event.preventDefault());
  });

  const phone = document.querySelector('[data-field="phone"]');
  phone?.addEventListener('input', () => {
    const digits = phone.value.replace(/\D/g, '').replace(/^8/, '7').slice(0, 11);
    const local = digits.startsWith('7') ? digits.slice(1) : digits;
    let value = '+7';
    if (local.length) value += ` ${local.slice(0, 3)}`;
    if (local.length > 3) value += ` ${local.slice(3, 6)}`;
    if (local.length > 6) value += `-${local.slice(6, 8)}`;
    if (local.length > 8) value += `-${local.slice(8, 10)}`;
    phone.value = value;
    phone.setCustomValidity(local.length === 10 ? '' : 'Введите 10 цифр российского номера после +7');
  });
  const form = document.querySelector('[data-appointment-form]');
  form?.addEventListener('input', () => {
    const success = form.querySelector('[data-form-success]');
    if (success) success.hidden = true;
  });
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    phone?.dispatchEvent(new Event('input'));
    if (!form.reportValidity()) return;
    const success = form.querySelector('[data-form-success]');
    if (success) success.hidden = false;
    form.reset();
    phone?.setCustomValidity('');
  });

  const contactLensTargets = [...document.querySelectorAll('[data-contact-lens]')];
  const contactLensPointer = matchMedia('(min-width: 1101px) and (hover: hover) and (pointer: fine)');
  if (contactLensTargets.length && contactLensPointer.matches && !reduced.matches) {
    const lens = document.createElement('span');
    lens.className = 'contact-hover-lens';
    lens.setAttribute('aria-hidden', 'true');
    document.body.append(lens);

    let lensX = 0;
    let lensY = 0;
    let targetX = 0;
    let targetY = 0;
    let lensFrame = 0;
    let hideLensTimer = 0;

    const paintLens = () => {
      lensX += (targetX - lensX) * .34;
      lensY += (targetY - lensY) * .34;
      lens.style.setProperty('--contact-lens-x', `${lensX.toFixed(2)}px`);
      lens.style.setProperty('--contact-lens-y', `${lensY.toFixed(2)}px`);
      if (Math.abs(targetX - lensX) > .12 || Math.abs(targetY - lensY) > .12) lensFrame = requestAnimationFrame(paintLens);
      else lensFrame = 0;
    };

    const moveLens = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
      if (!lensFrame) lensFrame = requestAnimationFrame(paintLens);
    };

    contactLensTargets.forEach((target) => {
      target.addEventListener('pointerenter', (event) => {
        clearTimeout(hideLensTimer);
        targetX = event.clientX;
        targetY = event.clientY;
        if (!lens.classList.contains('is-visible')) {
          lensX = targetX;
          lensY = targetY;
          lens.style.setProperty('--contact-lens-x', `${lensX}px`);
          lens.style.setProperty('--contact-lens-y', `${lensY}px`);
        }
        lens.classList.add('is-visible');
      });
      target.addEventListener('pointermove', moveLens);
      target.addEventListener('pointerleave', () => {
        hideLensTimer = window.setTimeout(() => lens.classList.remove('is-visible'), 55);
      });
    });
  }

  const navLinks = [...document.querySelectorAll('.desktop-nav a')];
  const navObserver = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((link) => link.toggleAttribute('aria-current', link.hash === `#${entry.target.id}`));
  }), { rootMargin: '-35% 0px -55%' });
  navLinks.map((link) => document.querySelector(link.hash)).filter(Boolean).forEach((section) => navObserver.observe(section));
  const privacyNotice = document.querySelector('[data-privacy-notice]');
  const privacyNoticeClose = document.querySelector('[data-privacy-notice-close]');
  if (privacyNotice && !localStorage.getItem('denta-privacy-notice-seen')) {
    privacyNotice.hidden = false;
    requestAnimationFrame(() => privacyNotice.classList.add('is-visible'));
    privacyNoticeClose?.addEventListener('click', () => {
      localStorage.setItem('denta-privacy-notice-seen', '1');
      privacyNotice.classList.remove('is-visible');
      window.setTimeout(() => { privacyNotice.hidden = true; }, 260);
    }, { once: true });
  }
  updateChrome();
})();
