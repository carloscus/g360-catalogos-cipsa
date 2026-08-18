import { CATALOGS_CONFIG, getFlipbookConfig } from './config.js';
import { audioSystem } from './audio.js';
import { trackView, trackPage, trackAction } from './analytics.js';

const BLOCK_SIZE = 8;
const DRAG_THRESHOLD = 6;
const DBLCLICK_MS = 350;

export async function initFlipbook({ theme }) {
  const CONFIG = CATALOGS_CONFIG[theme];
  if (!CONFIG) {
    console.error(`Configuración no encontrada para tema: ${theme}`);
    return;
  }

  const URL_PARAMS = new URLSearchParams(window.location.search);
  const PAGE_PARAM = URL_PARAMS.get('page');

  let pageFlip = null;
  let isLandscape = false;
  let suppressFlipSound = false;
  const isTouchDevice = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  const STORAGE_PAGE_KEY = `catalog-last-page-${theme}`;

  function jumpToPage(pageNumber) {
    if (!pageFlip || pageNumber < 1 || pageNumber > CONFIG.total_pages) return;
    audioSystem.play('jump');
    suppressFlipSound = true;
    pageFlip.turnToPage(pageNumber - 1);
  }

  const bookEl = document.getElementById('book');
  const container = document.querySelector('.flipbook-container');
  const wrapper = document.querySelector('.flipbook-wrapper');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const pageInput = document.getElementById('pageInput');
  const pageTotal = document.getElementById('pageTotal');
  const thumbsBtn = document.getElementById('thumbsBtn');
  const thumbsPanel = document.getElementById('thumbsPanel');
  const thumbsGrid = document.getElementById('thumbsGrid');
  const thumbsProgress = document.getElementById('thumbsProgress');
  const btnAudio = document.getElementById('btnAudio');
  const pageSlider = document.getElementById('pageSlider');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnShare = document.getElementById('btnShare');
  const btnIndex = document.getElementById('btnIndex');
  const indexPanel = document.getElementById('indexPanel');
  const indexList = document.getElementById('indexList');
  const magLevel = document.getElementById('magLevel');
  const magZoomIn = document.getElementById('magZoomIn');
  const magZoomOut = document.getElementById('magZoomOut');

  pageTotal.textContent = `/ ${CONFIG.total_pages}`;

  btnAudio.textContent = audioSystem.isMuted() ? '🔇' : '🔊';
  btnAudio.addEventListener('click', () => {
    const muted = audioSystem.toggleMute();
    btnAudio.textContent = muted ? '🔇' : '🔊';
  });

  thumbsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    thumbsPanel.classList.toggle('active');
    if (thumbsPanel.classList.contains('active')) updateThumbnails();
  });

  const thumbsHint = document.getElementById('thumbsHint');
  if (thumbsHint && !localStorage.getItem('catalog-thumbs-hint-seen')) {
    localStorage.setItem('catalog-thumbs-hint-seen', '1');
    setTimeout(() => thumbsHint.classList.add('show'), 1500);
    thumbsHint.addEventListener('click', () => {
      thumbsPanel.classList.add('active');
      updateThumbnails();
      thumbsHint.classList.remove('show');
    });
    setTimeout(() => thumbsHint.classList.remove('show'), 6500);
  }

  document.addEventListener('click', (e) => {
    if (indexPanel && !e.target.closest('.index-panel') && !e.target.closest('#btnIndex')) {
      indexPanel.classList.remove('active');
    }
    if (!e.target.closest('.thumbnails-panel') && !e.target.closest('.thumbnails-btn') && !e.target.closest('.thumbs-hint')) {
      thumbsPanel.classList.remove('active');
    }
  });

  /* ── Drag-to-flip manual: bloquea click-to-flip pero permite arrastrar páginas ── */
  let dragStart = null;
  let dragOccurred = false;

  bookEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragStart = { x: e.clientX, y: e.clientY, started: false };
  }, true);

  let lastMouse = null;
  bookEl.addEventListener('mousemove', (e) => {
    lastMouse = { clientX: e.clientX, clientY: e.clientY };
    if (!dragStart) return;
    e.preventDefault();
    e.stopPropagation();
    if (!pageFlip) return;
    const rect = bookEl.getBoundingClientRect();
    const pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    if (!dragStart.started) {
      const dist = Math.hypot(e.clientX - dragStart.x, e.clientY - dragStart.y);
      if (dist > DRAG_THRESHOLD) {
        dragStart.started = true;
        dragOccurred = true;
        pageFlip.startUserTouch({ x: dragStart.x - rect.left, y: dragStart.y - rect.top });
      }
    }
    if (dragStart.started) {
      pageFlip.userMove(pos, false);
    }
  }, true);

  window.addEventListener('mouseup', () => {
    if (dragStart) {
      dragStart = null;
      setTimeout(() => { dragOccurred = false; }, 50);
    }
  }, true);

  /* ── Rueda del mouse ── */
  bookEl.addEventListener('wheel', (e) => {
    if (pageFlip) {
      e.preventDefault();
      if (e.deltaY > 0) pageFlip.flipNext();
      else if (e.deltaY < 0) pageFlip.flipPrev();
    }
  }, { passive: false });

  /* ── Zoom de página completa (móvil) ── */
  let pageZoom = 1;
  const PAGE_ZOOM_MIN = 1;
  const PAGE_ZOOM_MAX = 3;
  let pinchStartDist = 0;
  let pinchStartZoom = 1;
  let panStartPoint = null;
  let panStartTransform = { tx: 0, ty: 0 };

  function getPageZoomTransform() {
    // retorna {tx, ty} actuales desde la transform del book
    const t = bookEl.style.transform;
    const m = t && t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(([\d.]+)\)/);
    if (m) return { tx: parseFloat(m[1]), ty: parseFloat(m[2]), scale: parseFloat(m[3]) };
    return { tx: 0, ty: 0, scale: 1 };
  }

  function applyPageZoom(zoom, tx, ty) {
    pageZoom = Math.min(PAGE_ZOOM_MAX, Math.max(PAGE_ZOOM_MIN, zoom));
    // limitar el pan para no perder el libro fuera de la vista
    const bw = bookEl.offsetWidth;
    const bh = bookEl.offsetHeight;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const maxTx = Math.max(0, (bw * pageZoom - cw) / 2);
    const maxTy = Math.max(0, (bh * pageZoom - ch) / 2);
    tx = Math.max(-maxTx, Math.min(maxTx, tx || 0));
    ty = Math.max(-maxTy, Math.min(maxTy, ty || 0));
    bookEl.style.transform = `translate(${tx}px, ${ty}px) scale(${pageZoom})`;
    bookEl.style.transformOrigin = '0 0';
    bookEl.style.willChange = 'transform';
    container.classList.add('zoomed');
    bookEl.classList.add('zoomed');
  }

  function resetPageZoom() {
    pageZoom = 1;
    bookEl.style.transform = '';
    bookEl.style.transformOrigin = '';
    bookEl.style.willChange = '';
    container.classList.remove('zoomed');
    bookEl.classList.remove('zoomed');
  }

  function isPageZoomed() { return pageZoom > 1; }

  /* ── Arrastrar con mouse cuando está zoom (desktop pan) ── */
  let panState = null;
  bookEl.addEventListener('mousedown', (e) => {
    if (!isPageZoomed()) return;
    if (e.button !== 0) return;
    if (e.target.closest('.toolbar') || e.target.closest('.magnifier')) return;
    panState = { startX: e.clientX, startY: e.clientY, startTx: 0, startTy: 0 };
    const t = bookEl.style.transform;
    const m = t && t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/);
    if (m) { panState.startTx = parseFloat(m[1]); panState.startTy = parseFloat(m[2]); }
    e.preventDefault();
    e.stopPropagation();
  }, true);

  window.addEventListener('mousemove', (e) => {
    if (!panState) return;
    e.preventDefault();
    const dx = e.clientX - panState.startX;
    const dy = e.clientY - panState.startY;
    const c = getPageZoomTransform();
    applyPageZoom(c.scale, panState.startTx + dx, panState.startTy + dy);
  }, true);

  window.addEventListener('mouseup', () => {
    panState = null;
  });

  if (isTouchDevice) {
    // Pinch (2 dedos): zoom de página completa
    bookEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        pinchStartZoom = pageZoom;
        const c = getPageZoomTransform();
        panStartPoint = { x: (e.touches[0].clientX + e.touches[1].clientX) / 2, y: (e.touches[0].clientY + e.touches[1].clientY) / 2 };
        panStartTransform = { tx: c.tx, ty: c.ty };
        e.preventDefault();
        e.stopPropagation();
      }
    }, { passive: false });

    bookEl.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = dist / (pinchStartDist || 1);
        applyPageZoom(pinchStartZoom * ratio, panStartTransform.tx, panStartTransform.ty);
        magLevel.textContent = `${parseFloat(pageZoom.toFixed(2))}x`;
      }
    }, { passive: false });

    // 1 dedo: pan manual con zoom; swipe de página sin zoom
    let oneFingerStart = null;
    bookEl.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        oneFingerStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (isPageZoomed()) e.preventDefault();
      }
    }, { passive: false });

    bookEl.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1 || !oneFingerStart) return;
      if (isPageZoomed()) {
        e.preventDefault();
        e.stopPropagation();
        const dx = e.touches[0].clientX - oneFingerStart.x;
        const dy = e.touches[0].clientY - oneFingerStart.y;
        oneFingerStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        const c = getPageZoomTransform();
        applyPageZoom(c.scale, c.tx + dx, c.ty + dy);
      }
    }, { passive: false });

    bookEl.addEventListener('touchend', () => {
      oneFingerStart = null;
    });
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (wrapper && wrapper.requestFullscreen) {
        wrapper.requestFullscreen();
      } else if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen();
      }
      audioSystem.play('hover');
    });
    document.addEventListener('fullscreenchange', () => {
      btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
    });
  }

  if (magZoomIn) {
    magZoomIn.addEventListener('click', () => {
      const c = getPageZoomTransform();
      applyPageZoom(c.scale + 0.25, c.tx, c.ty);
      magLevel.textContent = `${parseFloat(pageZoom.toFixed(2))}x`;
      audioSystem.play('hover');
    });
  }
  if (magZoomOut) {
    magZoomOut.addEventListener('click', () => {
      if (pageZoom <= 1.05) { resetPageZoom(); magLevel.textContent = '1x'; audioSystem.play('hover'); return; }
      const c = getPageZoomTransform();
      const next = c.scale - 0.25;
      applyPageZoom(next, c.tx, c.ty);
      magLevel.textContent = `${parseFloat(pageZoom.toFixed(2))}x`;
      audioSystem.play('hover');
    });
  }

  if (btnShare) {
    btnShare.addEventListener('click', async () => {
      const page = pageFlip ? pageFlip.getCurrentPageIndex() + 1 : 1;
      const url = `${window.location.origin}${window.location.pathname}?page=${page}`;
      try {
        await navigator.clipboard.writeText(url);
        btnShare.classList.add('active');
        btnShare.textContent = '✓';
        setTimeout(() => { btnShare.classList.remove('active'); btnShare.textContent = '🔗'; }, 1200);
      } catch (e) {
        prompt('Copiar enlace de la página:', url);
      }
      trackAction(theme, 'share', page);
      audioSystem.play('hover');
    });
  }

  if (btnIndex) {
    btnIndex.addEventListener('click', (e) => {
      e.stopPropagation();
      buildIndex();
      indexPanel.classList.toggle('active');
    });
  }

  function buildIndex() {
    if (!indexList) return;
    indexList.innerHTML = '';
    const sections = CONFIG.sections || [];
    sections.forEach((s) => {
      const item = document.createElement('button');
      item.className = 'index-item';
      item.innerHTML = `<span class="index-label">${s.label}</span><span class="index-page">p.${s.page}</span>`;
      item.addEventListener('click', () => {
        jumpToPage(s.page);
        indexPanel.classList.remove('active');
        trackAction(theme, 'index_jump', s.label);
      });
      indexList.appendChild(item);
    });
  }

  /* ── Flipbook ── */
  async function buildFlipbook() {
    let startPage = PAGE_PARAM ? parseInt(PAGE_PARAM, 10) - 1 : 0;
    if (Number.isNaN(startPage) || startPage < 0) {
      const saved = parseInt(localStorage.getItem(STORAGE_PAGE_KEY), 10);
      startPage = (saved >= 1 && saved <= CONFIG.total_pages) ? saved - 1 : 0;
    }

    const settings = await getFlipbookConfig(theme, CONFIG.total_pages);
    isLandscape = !settings.usePortrait;

    const PageFlipConstructor = window.St?.PageFlip;
    if (!PageFlipConstructor) {
      console.error('StPageFlip library not loaded');
      return;
    }

    pageFlip = new PageFlipConstructor(bookEl, settings);
    const imageUrls = [];
    for (let i = 1; i <= CONFIG.total_pages; i++) {
      imageUrls.push(`images/${theme}/page_${String(i).padStart(3, '0')}.webp`);
    }
    pageFlip.loadFromImages(imageUrls);
    if (startPage > 0) pageFlip.turnToPage(startPage);

    pageFlip.on('init', () => {
      const page = pageFlip.getCurrentPageIndex() + 1;
      pageInput.value = page;
      if (pageSlider) pageSlider.value = page;
      localStorage.setItem(STORAGE_PAGE_KEY, page);
      trackView(theme);
      trackPage(theme, page);
      updateThumbnails();
    });

    pageFlip.on('flip', (e) => {
      const page = e.data + 1;
      pageInput.value = page;
      if (pageSlider) pageSlider.value = page;
      localStorage.setItem(STORAGE_PAGE_KEY, page);
      if (!suppressFlipSound) audioSystem.play('flip');
      suppressFlipSound = false;
      updateThumbnails();
      resetPageZoom(); // al cambiar de página, volver a zoom 1x
      trackPage(theme, page);
      prefetchNext(page);
    });

    function prefetchNext(page) {
      const next = page + 1;
      if (next <= CONFIG.total_pages) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = `images/${theme}/page_${String(next).padStart(3, '0')}.webp`;
        document.head.appendChild(link);
      }
    }

    if (pageSlider) {
      pageSlider.max = CONFIG.total_pages;
      pageSlider.addEventListener('input', () => {
        pageInput.value = pageSlider.value;
      });
      pageSlider.addEventListener('change', () => {
        const target = parseInt(pageSlider.value, 10);
        if (target >= 1 && target <= CONFIG.total_pages) jumpToPage(target);
      });
    }

    btnPrev.addEventListener('click', () => { pageFlip.flipPrev(); trackAction(theme, 'prev'); });
    btnNext.addEventListener('click', () => { pageFlip.flipNext(); trackAction(theme, 'next'); });

    pageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const target = parseInt(pageInput.value, 10);
        if (target >= 1 && target <= CONFIG.total_pages) {
          jumpToPage(target);
          thumbsPanel.classList.remove('active');
        }
      }
    });
    pageInput.addEventListener('blur', () => {
      pageInput.value = pageFlip ? pageFlip.getCurrentPageIndex() + 1 : 1;
    });

    document.addEventListener('keydown', (e) => {
      if (e.target === pageInput) return;
      if (e.key === 'ArrowLeft') pageFlip.flipPrev();
      if (e.key === 'ArrowRight') pageFlip.flipNext();
      if (e.key === 'Home') jumpToPage(1);
      if (e.key === 'End') jumpToPage(CONFIG.total_pages);
       if (e.key === 'Escape') {
         thumbsPanel.classList.remove('active');
         if (indexPanel) indexPanel.classList.remove('active');
         if (document.fullscreenElement) document.exitFullscreen();
       }
    });

    updateThumbnails();
  }

  function updateThumbnails() {
    thumbsGrid.innerHTML = '';
    const currentPage = pageFlip ? pageFlip.getCurrentPageIndex() + 1 : 1;
    thumbsGrid.style.setProperty('--thumb-ar', isLandscape ? '16/9' : '2/3');

    const totalBlocks = Math.ceil(CONFIG.total_pages / BLOCK_SIZE);
    for (let b = 0; b < totalBlocks; b++) {
      const start = b * BLOCK_SIZE + 1;
      const end = Math.min(start + BLOCK_SIZE - 1, CONFIG.total_pages);
      const thumb = document.createElement('div');
      thumb.className = 'thumb-item';
      if (currentPage >= start && currentPage <= end) thumb.classList.add('active');
      const thumbImg = document.createElement('img');
      thumbImg.src = `images/${theme}/page_${String(start).padStart(3, '0')}.webp`;
      thumbImg.alt = `Páginas ${start}-${end}`;
      thumbImg.loading = 'lazy';
      thumb.appendChild(thumbImg);
      const label = document.createElement('span');
      label.className = 'thumb-label';
      label.textContent = start === end ? `${start}` : `${start}-${end}`;
      thumb.appendChild(label);
      thumb.addEventListener('click', () => {
        jumpToPage(start);
        thumbsPanel.classList.remove('active');
      });
      thumbsGrid.appendChild(thumb);
    }

    if (thumbsProgress) {
      thumbsProgress.style.width = `${(currentPage / CONFIG.total_pages) * 100}%`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildFlipbook);
  } else {
    buildFlipbook();
  }

  return {
    getPageFlip: () => pageFlip,
    jumpToPage: (n) => { if (pageFlip) jumpToPage(n); }
  };
}
