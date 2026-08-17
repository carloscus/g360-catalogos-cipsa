import { CATALOGS_CONFIG, getFlipbookConfig } from './config.js';
import { audioSystem } from './audio.js';

const MIN_ZOOM = 1.0;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.25;
const BLOCK_SIZE = 8;

export async function initFlipbook({ theme }) {
  const CONFIG = CATALOGS_CONFIG[theme];
  if (!CONFIG) {
    console.error(`Configuración no encontrada para tema: ${theme}`);
    return;
  }

  const URL_PARAMS = new URLSearchParams(window.location.search);
  const PAGE_PARAM = URL_PARAMS.get('page');

  let pageFlip = null;
  let currentZoom = 1.0;
  let isLandscape = false;
  let suppressFlipSound = false;

  function jumpToPage(pageNumber) {
    if (!pageFlip || pageNumber < 1 || pageNumber > CONFIG.total_pages) return;
    audioSystem.play('jump');
    suppressFlipSound = true;
    pageFlip.turnToPage(pageNumber - 1);
  }

  const bookEl = document.getElementById('book');
  const container = document.querySelector('.flipbook-container');

  ['mousedown', 'mouseup', 'click'].forEach((evt) => {
    bookEl.addEventListener(evt, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, true);
  });
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const pageInput = document.getElementById('pageInput');
  const pageTotal = document.getElementById('pageTotal');
  const thumbsBtn = document.getElementById('thumbsBtn');
  const thumbsPanel = document.getElementById('thumbsPanel');
  const thumbsGrid = document.getElementById('thumbsGrid');
  const thumbsProgress = document.getElementById('thumbsProgress');
  const btnAudio = document.getElementById('btnAudio');
  const zoomInBtn = document.getElementById('zoomIn');
  const zoomOutBtn = document.getElementById('zoomOut');
  const zoomIndicator = document.getElementById('zoomIndicator');

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

  function setZoom(level) {
    currentZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level));
    bookEl.style.transform = `scale(${currentZoom})`;
    container.classList.toggle('zoomed', currentZoom > 1);
    zoomIndicator.textContent = `${Math.round(currentZoom * 100)}%`;
  }

  zoomInBtn.addEventListener('click', () => { setZoom(currentZoom + ZOOM_STEP); audioSystem.play('hover'); });
  zoomOutBtn.addEventListener('click', () => { setZoom(currentZoom - ZOOM_STEP); audioSystem.play('hover'); });
  zoomIndicator.addEventListener('click', () => { setZoom(1); audioSystem.play('hover'); });

  bookEl.addEventListener('dblclick', (e) => {
    e.preventDefault();
    setZoom(currentZoom === 1.0 ? 1.5 : 1.0);
    audioSystem.play('hover');
  });

  let touchStartDist = 0;
  let touchStartZoom = 1;
  container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      touchStartDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartZoom = currentZoom;
    }
  }, { passive: true });

  container.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartDist;
      const next = Math.round(touchStartZoom * ratio * 4) / 4;
      setZoom(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next)));
      e.preventDefault();
    }
  }, { passive: false });

  async function buildFlipbook() {
    let startPage = PAGE_PARAM ? parseInt(PAGE_PARAM, 10) - 1 : 0;
    if (Number.isNaN(startPage) || startPage < 0) startPage = 0;

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
      pageInput.value = pageFlip.getCurrentPageIndex() + 1;
      updateThumbnails();
    });

    pageFlip.on('flip', (e) => {
      const page = e.data + 1;
      pageInput.value = page;
      if (!suppressFlipSound) audioSystem.play('flip');
      suppressFlipSound = false;
      updateThumbnails();
    });

    btnPrev.addEventListener('click', () => { pageFlip.flipPrev(); });
    btnNext.addEventListener('click', () => { pageFlip.flipNext(); });

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
      if (e.key === 'Escape') thumbsPanel.classList.remove('active');
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
    jumpToPage: (n) => { if (pageFlip) jumpToPage(n); },
    setZoom,
    getZoom: () => currentZoom
  };
}
