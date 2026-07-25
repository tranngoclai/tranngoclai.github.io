/**
 * Video Generation Progressive Navigation Sync
 * Synchronizes elements with data-curriculum-* attributes against the frozen manifest.
 */
(function () {
  'use strict';

  function initNavigation() {
    const items = globalThis.VIDEO_GENERATION_CURRICULUM;
    if (!Array.isArray(items) || items.length === 0) return;

    // Detect current page
    const currentId = document.documentElement.getAttribute('data-curriculum-id');
    const pathName = window.location.pathname;

    let currentIndex = -1;
    if (currentId) {
      currentIndex = items.findIndex(item => item.id === currentId);
    }
    if (currentIndex === -1) {
      currentIndex = items.findIndex(item => pathName.endsWith('/' + item.href) || pathName === item.href);
    }
    if (currentIndex === -1) return; // Home or unlinked page

    const current = items[currentIndex];
    const prev = currentIndex > 0 ? items[currentIndex - 1] : null;
    const next = currentIndex < items.length - 1 ? items[currentIndex + 1] : null;

    // Sync prev links
    document.querySelectorAll('[data-curriculum-prev]').forEach(el => {
      if (prev) {
        el.setAttribute('href', prev.href);
        if (el.hasAttribute('data-curriculum-title-fallback')) {
          el.textContent = `← Bài ${prev.position}: ${prev.title}`;
        }
      } else {
        el.setAttribute('href', 'index.html');
      }
    });

    // Sync next links
    document.querySelectorAll('[data-curriculum-next]').forEach(el => {
      if (next) {
        el.setAttribute('href', next.href);
        if (el.hasAttribute('data-curriculum-title-fallback')) {
          el.textContent = `Bài ${next.position}: ${next.title} →`;
        }
      } else {
        el.style.display = 'none';
      }
    });

    // Sync home links
    document.querySelectorAll('[data-curriculum-home]').forEach(el => {
      el.setAttribute('href', 'index.html');
    });

    // Sync hero label
    document.querySelectorAll('[data-curriculum-hero-label]').forEach(el => {
      el.textContent = `${current.phase.toUpperCase()} · BÀI ${current.position} · ${current.meta.toUpperCase()}`;
    });

    // Sync breadcrumb
    document.querySelectorAll('[data-curriculum-breadcrumb]').forEach(el => {
      el.textContent = `${current.phase} / Bài ${current.position}: ${current.title}`;
    });

    // Sync footer text / completion label
    document.querySelectorAll('[data-curriculum-completion-label]').forEach(el => {
      el.textContent = `VIDEO GEN LAB · ${current.phase.toUpperCase()} · BÀI ${current.position} / ${current.title.toUpperCase()}`;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    initNavigation();
  }
})();
