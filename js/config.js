const CATALOGS_CONFIG = {
  vinifan: { name: 'VINIFAN', theme: 'vinifan', gradient: 'linear-gradient(135deg, #2d0a0a 0%, #0d1117 50%, #1a0505 100%)', accent: '#722F37', accentGlow: 'rgba(114, 47, 55, 0.4)', total_pages: 72, images_dir: 'images/vinifan' },
  viniball: { name: 'VINIBALL', theme: 'viniball', gradient: 'linear-gradient(135deg, #0a2d0a 0%, #0d1117 50%, #051a05 100%)', accent: '#2ECC71', accentGlow: 'rgba(46, 204, 113, 0.4)', total_pages: 76, images_dir: 'images/viniball' },
  industriales: { name: 'INDUSTRIALES', theme: 'industriales', gradient: 'linear-gradient(135deg, #2d200a 0%, #0d1117 50%, #1a1505 100%)', accent: '#F39C12', accentGlow: 'rgba(243, 156, 18, 0.4)', total_pages: 10, images_dir: 'images/industriales' },
  representadas: { name: 'REPRESENTADAS', theme: 'representadas', gradient: 'linear-gradient(135deg, #0a1a2d 0%, #0d1117 50%, #05101a 100%)', accent: '#3498DB', accentGlow: 'rgba(52, 152, 219, 0.4)', total_pages: 32, images_dir: 'images/representadas' },
  institucional: { name: 'INSTITUCIONAL', theme: 'institucional', gradient: 'linear-gradient(135deg, #1a1505 0%, #0d1117 50%, #0a0a00 100%)', accent: '#D4AC0D', accentGlow: 'rgba(212, 172, 13, 0.4)', total_pages: 15, images_dir: 'images/institucional' }
};

const FLIPBOOK_CONFIG = {
  vinifan: { width: 400, height: 560, size: 'fixed', usePortrait: true, startPage: 0, drawShadow: true, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6 },
  viniball: { width: 400, height: 560, size: 'fixed', usePortrait: true, startPage: 0, drawShadow: true, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6 },
  industriales: { width: 400, height: 560, size: 'fixed', usePortrait: true, startPage: 0, drawShadow: true, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6 },
  representadas: { width: 400, height: 560, size: 'fixed', usePortrait: true, startPage: 0, drawShadow: true, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6 },
  institucional: { width: 400, height: 560, size: 'fixed', usePortrait: true, startPage: 0, drawShadow: true, showCover: true, mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6 }
};

export { CATALOGS_CONFIG, FLIPBOOK_CONFIG };
