const CATALOGS_CONFIG = {
  vinifan: { name: 'VINIFAN', theme: 'vinifan', description: 'Vinilos y productos escolares de alto rendimiento', gradient: 'linear-gradient(135deg, #2d0a0a 0%, #0d1117 50%, #1a0505 100%)', accent: '#722F37', accentGlow: 'rgba(114, 47, 55, 0.4)', total_pages: 72, images_dir: 'images/vinifan', sections: [
    { label: 'Portada', page: 1 },
    { label: 'Productos', page: 2 },
    { label: 'Modelos', page: 20 },
    { label: 'Especificaciones', page: 50 }
  ] },
  viniball: { name: 'VINIBALL', theme: 'viniball', description: 'Pelotas y sistemas de contención deportiva', gradient: 'linear-gradient(135deg, #0a2d0a 0%, #0d1117 50%, #051a05 100%)', accent: '#2ECC71', accentGlow: 'rgba(46, 204, 113, 0.4)', total_pages: 76, images_dir: 'images/viniball', sections: [
    { label: 'Portada', page: 1 },
    { label: 'Fútbol', page: 2 },
    { label: 'Vóley', page: 22 },
    { label: 'Balonmano', page: 42 },
    { label: 'Otros deportes', page: 60 }
  ] },
  industriales: { name: 'INDUSTRIALES', theme: 'industriales', description: 'Soluciones industriales para empresas', gradient: 'linear-gradient(135deg, #2d200a 0%, #0d1117 50%, #1a1505 100%)', accent: '#F39C12', accentGlow: 'rgba(243, 156, 18, 0.4)', total_pages: 10, images_dir: 'images/industriales', sections: [
    { label: 'Portada', page: 1 },
    { label: 'Línea industrial', page: 2 },
    { label: 'Contacto', page: 9 }
  ] },
  representadas: { name: 'REPRESENTADAS', theme: 'representadas', description: 'Marcas representadas de oficina y herramientas', gradient: 'linear-gradient(135deg, #0a1a2d 0%, #0d1117 50%, #05101a 100%)', accent: '#3498DB', accentGlow: 'rgba(52, 152, 219, 0.4)', total_pages: 32, images_dir: 'images/representadas', sections: [
    { label: 'Portada', page: 1 },
    { label: 'Marcas', page: 2 },
    { label: 'Oficina', page: 12 },
    { label: 'Herramientas', page: 24 }
  ] },
  institucional: { name: 'INSTITUCIONAL', theme: 'institucional', description: 'Productos personalizados e institucionales', gradient: 'linear-gradient(135deg, #1a1505 0%, #0d1117 50%, #0a0a00 100%)', accent: '#D4AC0D', accentGlow: 'rgba(212, 172, 13, 0.4)', total_pages: 15, images_dir: 'images/institucional', sections: [
    { label: 'Portada', page: 1 },
    { label: 'Nosotros', page: 2 },
    { label: 'Personalización', page: 8 },
    { label: 'Contacto', page: 14 }
  ] }
};

const FLIPBOOK_DEFAULTS = {
  size: 'fixed', startPage: 0, drawShadow: true, showCover: true,
  mobileScrollSupport: true, flippingTime: 800, maxShadowOpacity: 0.6,
  disableFlipByClick: true
};

const FLIPBOOK_DIMS = {
  portrait: { width: 400, height: 560 },
  landscape: { width: 560, height: 360 }
};

function detectOrientation(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const isLandscape = img.naturalWidth > img.naturalHeight;
      resolve({
        usePortrait: !isLandscape,
        ...(isLandscape ? FLIPBOOK_DIMS.landscape : FLIPBOOK_DIMS.portrait)
      });
    };
    img.onerror = () => resolve({ usePortrait: true, ...FLIPBOOK_DIMS.portrait });
    img.src = imageUrl;
  });
}

function getFlipbookConfig(theme, totalPages) {
  const firstPage = `images/${theme}/page_001.webp`;
  return detectOrientation(firstPage).then((orientation) => ({
    ...FLIPBOOK_DEFAULTS, ...orientation
  }));
}

export { CATALOGS_CONFIG, FLIPBOOK_DEFAULTS, FLIPBOOK_DIMS, detectOrientation, getFlipbookConfig };

