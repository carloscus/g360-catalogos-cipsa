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
    if (magVisible) return; // con la lupa activa no se arrastra la página
    e.preventDefault();
    e.stopPropagation();
    dragStart = { x: e.clientX, y: e.clientY, started: false };
  }, true);

  let lastMouse = null;
  bookEl.addEventListener('mousemove', (e) => {
    lastMouse = { clientX: e.clientX, clientY: e.clientY };
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

  /* ── Rueda del mouse ── */
  bookEl.addEventListener('wheel', (e) => {
    if (magVisible) {
      // con la lupa activa: la rueda ajusta el zoom
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY < 0 ? 1 : -1;
      const next = Math.min(MAG_LEVELS.length - 1, Math.max(0, magLevelIdx + delta));
      if (next !== magLevelIdx) {
        magLevelIdx = next;
        setMagLevelText();
        if (magImage) applyMagnifierZoom(lastRX, lastRY);
      }
    } else if (pageFlip) {
      // sin lupa: la rueda voltea la página (como las apps de catálogo)
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

  /* ── Doble-click: activar/cerrar lupa ── */
  let lastClickTime = 0;
  bookEl.addEventListener('click', (e) => {
    if (dragOccurred) return;
    const now = Date.now();
    if (now - lastClickTime < DBLCLICK_MS) {
      // sincronizar el recorte con la posicion del cursor al abrir
      lastRX = 0.5;
      lastRY = 0.5;
      toggleMagnifier(e);
      lastClickTime = 0;
    } else {
      lastClickTime = now;
    }
  });

  /* ── Lupa (magnifier) ── */
  let magLevelIdx = 0; // default 0.50x
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

  function centerMagnifierOn(e) {
    if (!e) return;
    // centrar la lupa sobre el cursor (el punto de inspeccion queda al centro)
    const mx = e.clientX - magnifier.offsetWidth / 2;
    const my = e.clientY - magnifier.offsetHeight / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mw = magnifier.offsetWidth;
    const mh = magnifier.offsetHeight;
    magnifier.style.left = `${Math.max(0, Math.min(mx, vw - mw))}px`;
    magnifier.style.top = `${Math.max(0, Math.min(my, vh - mh))}px`;
  }

  function toggleMagnifier(e) {
    if (magVisible) {
      hideMagnifier();
      return;
    }
    if (pageFlip) loadMagImage(pageFlip.getCurrentPageIndex() + 1);
    showMagnifier();
    if (e) {
      centerMagnifierOn(e);
    } else if (lastMouse) {
      centerMagnifierOn(lastMouse);
    } else {
      // centrar en pantalla si no hay referencia de cursor
      magnifier.style.left = `${(window.innerWidth - magnifier.offsetWidth) / 2}px`;
      magnifier.style.top = `${(window.innerHeight - magnifier.offsetHeight) / 2}px`;
    }
  }

  if (btnMagnifier) {
    btnMagnifier.addEventListener('click', () => {
      toggleMagnifier();
      audioSystem.play('hover');
    });
  }
  magZoomIn.addEventListener('click', () => {
    if (isTouchDevice) {
      const c = getPageZoomTransform();
      applyPageZoom(c.scale + 0.25, c.tx, c.ty);
      magLevel.textContent = `${parseFloat((c.scale + 0.25).toFixed(2))}x`;
      audioSystem.play('hover');
      return;
    }
    magLevelIdx = Math.min(MAG_LEVELS.length - 1, magLevelIdx + 1);
    setMagLevelText();
    if (magImage) applyMagnifierZoom(lastRX, lastRY);
    audioSystem.play('hover');
  });
  magZoomOut.addEventListener('click', () => {
    if (isTouchDevice) {
      const c = getPageZoomTransform();
      if (c.scale <= 1.05) { resetPageZoom(); magLevel.textContent = '1x'; audioSystem.play('hover'); return; }
      const next = c.scale - 0.25;
      applyPageZoom(next, c.tx, c.ty);
      magLevel.textContent = `${parseFloat(next.toFixed(2))}x`;
      audioSystem.play('hover');
      return;
    }
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
    if (!magPinned) { // al despinear, volver a seguir al cursor
      magPan = null;
      magnifier.classList.remove('panning');
      if (lastMouse) updateMagnifier(lastMouse);
    }
  });

  // Arrastrar el contenido dentro de la lupa cuando está fijada (pan)
  let magPan = null;

  function panStart(x, y) {
    if (!magPinned) return;
    magPan = { x, y };
    magnifier.classList.add('panning');
  }
  function panMove(x, y) {
    if (!magPan || !magImage) return;
    const dx = x - magPan.x;
    const dy = y - magPan.y;
    magPan = { x, y };
    const level = magZoom();
    const vw = magnifierViewport.clientWidth;
    const vh = magnifierViewport.clientHeight;
    const totalW = magImage.naturalW * level;
    const totalH = magImage.naturalH * level;
    let left = parseFloat(magnifierImg.style.left) || 0;
    let top = parseFloat(magnifierImg.style.top) || 0;
    left += dx;
    top += dy;
    const maxLeft = 0;
    const minLeft = -(totalW - vw);
    const maxTop = 0;
    const minTop = -(totalH - vh);
    left = Math.max(minLeft, Math.min(maxLeft, left));
    top = Math.max(minTop, Math.min(maxTop, top));
    magnifierImg.style.left = `${left}px`;
    magnifierImg.style.top = `${top}px`;
    lastRX = (left * -1) / totalW;
    lastRY = (top * -1) / totalH;
  }
  function panEnd() {
    magPan = null;
    magnifier.classList.remove('panning');
  }

  magnifierViewport.addEventListener('mousedown', (e) => {
    if (!magPinned) return;
    e.preventDefault();
    e.stopPropagation();
    panStart(e.clientX, e.clientY);
  });
  window.addEventListener('mousemove', (e) => {
    if (!magPan) return;
    e.preventDefault();
    panMove(e.clientX, e.clientY);
  });
  window.addEventListener('mouseup', panEnd);

  // Touch: pan táctil dentro de la lupa fijada
  magnifierViewport.addEventListener('touchstart', (e) => {
    if (!magPinned || e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    panStart(t.clientX, t.clientY);
  }, { passive: false });
  magnifierViewport.addEventListener('touchmove', (e) => {
    if (!magPan || e.touches.length !== 1) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    panMove(t.clientX, t.clientY);
  }, { passive: false });
  magnifierViewport.addEventListener('touchend', panEnd);

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

    // centrar la lupa sobre el cursor
    const mx = e.clientX - magnifier.offsetWidth / 2;
    const my = e.clientY - magnifier.offsetHeight / 2;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const mw = magnifier.offsetWidth;
    const mh = magnifier.offsetHeight;
    magnifier.style.left = `${Math.max(0, Math.min(mx, vw - mw))}px`;
    magnifier.style.top = `${Math.max(0, Math.min(my, vh - mh))}px`;
  }

  bookEl.addEventListener('mouseenter', () => {
    if (magVisible && magFollow) magnifier.style.display = 'block';
  });
  bookEl.addEventListener('mouseleave', () => {
    // solo ocultar si sigue al cursor; si esta fijada (pinned) permanece visible
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
      resetPageZoom(); // al cambiar de página, volver a zoom 1x
      if (magVisible) {
        if (magFollow && lastMouse) {
          // sigue al cursor: re-sincronizar con la posicion actual
          loadMagImage(pageFlip.getCurrentPageIndex() + 1);
          updateMagnifier(lastMouse);
        } else {
          // fijada: resetear al centro de la nueva pagina para no quedar
          // en una zona arbitraria de la pagina anterior
          lastRX = 0.5;
          lastRY = 0.5;
          loadMagImage(pageFlip.getCurrentPageIndex() + 1);
          applyMagnifierZoom(lastRX, lastRY);
        }
      }
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