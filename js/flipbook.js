import { CATALOGS_CONFIG } from './config.js';

class ImageFlipbook {
  constructor(containerId, theme, startPage = 0) {
    this.container = document.getElementById(containerId);
    this.theme = theme;
    this.startPage = startPage;
    this.config = CATALOGS_CONFIG[theme];
    this.pageFlip = null;
    this.totalPages = this.config.total_pages;
    this.currentImageIndex = 0;
    this.loadingImages = new Set();
    this.loadedImages = [];
  }

  async init() {
    const settings = FLIPBOOK_CONFIG[this.theme] || FLIPBOOK_CONFIG.vinifan;
    
    // Import StPageFlip dynamically
    const StPageFlipModule = await import('https://cdn.jsdelivr.net/npm/page-flip@2.0.33/dist/page-flip.browser.js');
    const StPageFlip = StPageFlipModule.default || StPageFlipModule.St.PageFlip;
    
    this.pageFlip = new StPageFlip(this.container, settings);
    
    // Generate image URLs
    const imageUrls = [];
    for (let i = 1; i <= this.totalPages; i++) {
      imageUrls.push(`../../images/${this.theme}/page_${String(i).padStart(3, '0')}.webp`);
    }
    
    this.pageFlip.loadFromImages(imageUrls);
    
    if (this.startPage > 0 && this.startPage < this.totalPages) {
      this.pageFlip.turnToPage(this.startPage - 1);
    }
    
    this.pageFlip.on('flip', (e) => {
      const counter = document.getElementById('pageCounter');
      if (counter) counter.textContent = `${e.data + 1}/${this.totalPages}`;
      audioSystem.play('flip');
      updateThumbnails();
    });
    
    this.pageFlip.on('init', (e) => {
      const counter = document.getElementById('pageCounter');
      if (counter) counter.textContent = `${e.data + 1}/${this.totalPages}`;
    });
    
    return this;
  }

  prev() {
    if (this.pageFlip) this.pageFlip.flipPrev();
  }

  next() {
    if (this.pageFlip) this.pageFlip.flipNext();
  }

  goToPage(pageNum) {
    if (this.pageFlip) this.pageFlip.turnToPage(pageNum - 1);
  }

  getCurrentPage() {
    return this.pageFlip ? this.pageFlip.getCurrentPageIndex() + 1 : 1;
  }

  getTotalPages() {
    return this.totalPages;
  }
}

export { ImageFlipbook };

