import { CATALOGS_CONFIG, getFlipbookConfig } from './config.js';
import { audioSystem } from './audio.js';
import { trackView, trackPage, trackAction } from './analytics.js';

const BLOCK_SIZE = 8;
const DRAG_THRESHOLD = 6;
const DBLCLICK_MS = 350;
const MAG_LEVELS = [0.5, 0.75, 1]; // max 1 = resolución nativa (nunca upscale)

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

  const STORAGE_PAGE_KEY = `catalog-last-page-${theme}`;

  function jumpToPage(pageNumber) {
    if (!pageFlip || pageNumber < 1 || pageNumber > CONFIG.total_pages) return;
    audioSystem.play('jump');
    suppressFlipSound = true;
    pageFlip.turnToPage(pageNumber - 1);
  }

  const bookEl = document.getElementById('book');
  const container = document.querySelector('.flipbook-container');
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const pageInput = document.getElementById('pageInput');
  const pageTotal = document.getElementById('pageTotal');
  const thumbsBtn = document.getElementById('thumbsBtn');
  const thumbsPanel = document.getElementById('thumbsPanel');
  const thumbsGrid = document.getElementById('thumbsGrid');
  const thumbsProgress = document.getElementById('thumbsProgress');
  const btnAudio = document.getElementById('btnAudio');
  const btnMagnifier = document.getElementById('btnMagnifier');
  const pageSlider = document.getElementById('pageSlider');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnShare = document.getElementById('btnShare');
  const btnIndex = document.getElementById('btnIndex');
  const indexPanel = document.getElementById('indexPanel');
  const indexList = document.getElementById('indexList');
  const magnifier = document.getElementById('magnifier');
  const magnifierImg = document.getElementById('magnifierImg');
  const magnifierViewport = document.getElementById('magnifierViewport');
  const magLevel = document.getElementById('magLevel');
  const magZoomIn = document.getElementById('magZoomIn');
  const magZoomOut = document.getElementById('magZoomOut');
  const magCapture = document.getElementById('magCapture');
  const magClose = document.getElementById('magClose');

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

  bookEl.addEventListener('mousemove', (e) => {
    if (magnifier && magVisible && magFollow) updateMagnifier(e);
    if (magVisible) return; // con la lupa activa no se arrastra la página
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

  /* ── Zoom con rueda del mouse (cuando la lupa está activa) ── */
  bookEl.addEventListener('wheel', (e) => {
    if (!magVisible) return;
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 1 : -1;
    const next = Math.min(MAG_LEVELS.length - 1, Math.max(0, magLevelIdx + delta));
    if (next !== magLevelIdx) {
      magLevelIdx = next;
      setMagLevelText();
      if (magImage) applyMagnifierZoom(lastRX, lastRY);
    }
  }, { passive: false });

  /* ── Doble-click: activar/cerrar lupa ── */
  let lastClickTime = 0;
  bookEl.addEventListener('click', (e) => {
    if (dragOccurred) return;
    const now = Date.now();
    if (now - lastClickTime < DBLCLICK_MS) {
      toggleMagnifier();
      lastClickTime = 0;
    } else {
      lastClickTime = now;
    }
  });

  /* ── Lupa (magnifier) ── */
  let magLevelIdx = 1; // default 0.75x
  let magVisible = false;
  let magFollow = true; // sigue al cursor mientras true
  let magPinned = false; // punto fijo al pin (click en el viewport)
  let magImage = null;
  let lastRX = 0.5;
  let lastRY = 0.5;

  function magZoom() { return MAG_LEVELS[magLevelIdx]; }

  function setMagLevelText() {
    const v = magZoom();
    magLevel.textContent = `${parseFloat(v.toFixed(2))}x`;
  }
  setMagLevelText();

  function loadMagImage(pageNum) {
    if (magImage && magImage.page === pageNum) return;
    const padded = String(pageNum).padStart(3, '0');
    const detail = `images/${theme}/detail/page_${padded}.jpg`;
    const normal = `images/${theme}/page_${padded}.jpg`;
    const probe = new Image();
    probe.onload = () => {
      magImage = { page: pageNum, naturalW: probe.naturalWidth, naturalH: probe.naturalHeight, src: detail };
      magnifierImg.src = detail;
      applyMagnifierZoom(lastRX, lastRY);
    };
    probe.onerror = () => {
      const probe2 = new Image();
      probe2.onload = () => {
        magImage = { page: pageNum, naturalW: probe2.naturalWidth, naturalH: probe2.naturalHeight, src: normal };
        magnifierImg.src = normal;
        applyMagnifierZoom(lastRX, lastRY);
      };
      probe2.src = normal;
    };
    probe.src = detail;
  }

  function applyMagnifierZoom(rx, ry) {
    if (!magImage) return;
    const level = magZoom();
    magnifierImg.style.width = `${magImage.naturalW * level}px`;
    magnifierImg.style.height = `${magImage.naturalH * level}px`;
    const mw = magnifierViewport.clientWidth;
    const mh = magnifierViewport.clientHeight;
    magnifierImg.style.left = `${-(rx * magImage.naturalW * level) + mw / 2}px`;
    magnifierImg.style.top = `${-(ry * magImage.naturalH * level) + mh / 2}px`;
  }

  function showMagnifier() {
    magnifier.style.display = 'block';
    magVisible = true;
    if (btnMagnifier) btnMagnifier.classList.add('active');
  }

  function hideMagnifier() {
    magnifier.style.display = 'none';
    magVisible = false;
    magPinned = false;
    magFollow = true;
    if (btnMagnifier) btnMagnifier.classList.remove('active');
  }

  function toggleMagnifier() {
    if (magVisible) {
      hideMagnifier();
      return;
    }
    if (pageFlip) loadMagImage(pageFlip.getCurrentPageIndex() + 1);
    showMagnifier();
  }

  if (btnMagnifier) {
    btnMagnifier.addEventListener('click', () => {
      toggleMagnifier();
      audioSystem.play('hover');
    });
  }

  magZoomIn.addEventListener('click', () => {
    magLevelIdx = Math.min(MAG_LEVELS.length - 1, magLevelIdx + 1);
    setMagLevelText();
    if (magImage) applyMagnifierZoom(lastRX, lastRY);
    audioSystem.play('hover');
  });
  magZoomOut.addEventListener('click', () => {
    magLevelIdx = Math.max(0, magLevelIdx - 1);
    setMagLevelText();
    if (magImage) applyMagnifierZoom(lastRX, lastRY);
    audioSystem.play('hover');
  });
  magClose.addEventListener('click', () => hideMagnifier());

  magCapture.addEventListener('click', () => {
    captureMagnifier();
    audioSystem.play('hover');
  });

  magnifierViewport.addEventListener('click', (e) => {
    e.stopPropagation();
    magPinned = !magPinned;
    magFollow = !magPinned;
    magnifier.classList.toggle('pinned', magPinned);
  });

  // Arrastrar el contenido dentro de la lupa cuando está fijada (pan)
  let magPan = null;
  magnifierViewport.addEventListener('mousedown', (e) => {
    if (!magPinned) return;
    e.preventDefault();
    e.stopPropagation();
    magPan = { x: e.clientX, y: e.clientY };
    magnifier.classList.add('panning');
  });
  window.addEventListener('mousemove', (e) => {
    if (!magPan) return;
    if (!magImage) return;
    e.preventDefault();
    const dx = e.clientX - magPan.x;
    const dy = e.clientY - magPan.y;
    magPan = { x: e.clientX, y: e.clientY };
    const level = magZoom();
    const vw = magnifierViewport.clientWidth;
    const vh = magnifierViewport.clientHeight;
    const totalW = magImage.naturalW * level;
    const totalH = magImage.naturalH * level;
    // desplazar el recorte en px CSS
    let left = parseFloat(magnifierImg.style.left) || 0;
    let top = parseFloat(magnifierImg.style.top) || 0;
    left += dx;
    top += dy;
    // limitar al rango visible (no mostrar fondo fuera de la imagen)
    const maxLeft = 0;
    const minLeft = -(totalW - vw);
    const maxTop = 0;
    const minTop = -(totalH - vh);
    left = Math.max(minLeft, Math.min(maxLeft, left));
    top = Math.max(minTop, Math.min(maxTop, top));
    magnifierImg.style.left = `${left}px`;
    magnifierImg.style.top = `${top}px`;
    // actualizar las coordenadas relativas para futuros zooms
    lastRX = (left * -1) / totalW;
    lastRY = (top * -1) / totalH;
  });
  window.addEventListener('mouseup', () => {
    magPan = null;
    magnifier.classList.remove('panning');
  });

  function captureMagnifier() {
    if (!magImage) return;
    const level = magZoom();
    const scale = 2; // resolucion 2x para nitidez
    const vw = magnifierViewport.clientWidth;
    const vh = magnifierViewport.clientHeight;
    const canvas = document.createElement('canvas');
    canvas.width = vw * scale;
    canvas.height = vh * scale;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Posicion de la imagen en px CSS (escala mostrada = level)
    const leftPx = parseFloat(magnifierImg.style.left) || 0;
    const topPx = parseFloat(magnifierImg.style.top) || 0;
    // Convertir a coordenadas de la imagen natural (drawImage usa px intrínsecos)
    const ix = (leftPx * -1) / level;
    const iy = (topPx * -1) / level;
    const iw = vw / level;   // region visible en px naturales
    const ih = vh / level;
    ctx.drawImage(magnifierImg, ix, iy, iw, ih, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `${theme}-pagina-${magImage.page}-zoom-${magZoom()}x.png`;
    a.click();
    trackAction(theme, 'capture', magImage.page);
  }

  if (btnFullscreen) {
    btnFullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        document.documentElement.requestFullscreen();
      }
      audioSystem.play('hover');
    });
    document.addEventListener('fullscreenchange', () => {
      btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
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
    document.addEventListener('click', (e) => {
      if (indexPanel && !e.target.closest('.index-panel') && !e.target.closest('#btnIndex')) {
        indexPanel.classList.remove('active');
      }
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

  function updateMagnifier(e) {
    if (!pageFlip) return;
    const bounds = pageFlip.getBoundsRect();
    const orientation = pageFlip.getOrientation();
    const currentIdx = pageFlip.getCurrentPageIndex();
    const total = CONFIG.total_pages;
    const isCover = currentIdx === 0;
    const isLast = currentIdx === total - 1;
    const singleSpread = orientation === 'portrait' || isCover || isLast;

    const pageWidth = bounds.pageWidth;
    const relX = e.clientX - bounds.left;
    let pageIdx = currentIdx;
    let rx;

    if (singleSpread) {
      rx = relX / pageWidth;
    } else {
      const leftSide = relX < pageWidth;
      pageIdx = leftSide ? currentIdx : currentIdx + 1;
      rx = (relX - (leftSide ? 0 : pageWidth)) / pageWidth;
    }
    const ry = (e.clientY - bounds.top) / bounds.height;
    lastRX = Math.max(0, Math.min(1, rx));
    lastRY = Math.max(0, Math.min(1, ry));

    loadMagImage(pageIdx + 1);
    applyMagnifierZoom(lastRX, lastRY);

    const mx = e.clientX + 16;
    const my = e.clientY + 16;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mw = magnifier.offsetWidth;
    const mh = magnifier.offsetHeight;
    magnifier.style.left = `${Math.max(0, Math.min(mx, vw - mw - 8))}px`;
    magnifier.style.top = `${Math.max(0, Math.min(my, vh - mh - 8))}px`;
  }

  bookEl.addEventListener('mouseenter', () => {
    if (magVisible && magFollow) magnifier.style.display = 'block';
  });
  bookEl.addEventListener('mouseleave', () => {
    if (magVisible && magFollow) magnifier.style.display = 'none';
  });

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
      imageUrls.push(`images/${theme}/page_${String(i).padStart(3, '0')}.jpg`);
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
      if (magVisible) loadMagImage(pageFlip.getCurrentPageIndex() + 1);
      trackPage(theme, page);
      prefetchNext(page);
    });

    function prefetchNext(page) {
      const next = page + 1;
      if (next <= CONFIG.total_pages) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = `images/${theme}/page_${String(next).padStart(3, '0')}.jpg`;
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
        hideMagnifier();
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
      thumbImg.src = `images/${theme}/page_${String(start).padStart(3, '0')}.jpg`;
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