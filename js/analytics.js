/*
 * Capa de analytics para g360-catalogos-CIPSA.
 *
 * GitHub Pages solo sirve archivos estaticos (sin backend), por lo que el
 * analytics se implementa en el navegador: captura eventos y los envia a un
 * servicio externo. Este modulo expone una cola de eventos y un adaptador.
 *
 * Conectar un proveedor real:
 *   1) GA4:  carga gtag.js y llama track() en cada evento
 *   2) GoatCounter (gratis, sin cookies): llama goatcounter.count() o un endpoint
 *
 * Por defecto NO envia nada a terceros; solo registra en consola y deja los
 * eventos listos para conectar. Habilitar con ?analytics=1 o ANALYTICS_ENABLED.
 */

const DEFAULT_SERVICE = 'none'; // 'ga4' | 'goatcounter' | 'none'

function config() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('analytics');
  return {
    enabled: fromUrl ? fromUrl !== '0' : false,
    service: (fromUrl && ['ga4', 'goatcounter'].includes(fromUrl)) ? fromUrl : DEFAULT_SERVICE,
    ga4Id: '', // TODO: colocar tu GA4 Measurement ID (G-XXXXXXX)
    goatcounterEndpoint: 'https://TU-SITIO.goatcounter.com/count' // TODO
  };
}

export function track(eventName, payload = {}) {
  const cfg = config();
  const data = {
    event: eventName,
    path: window.location.pathname,
    page: payload.page ?? null,
    theme: payload.theme ?? null,
    ts: Date.now()
  };

  if (cfg.enabled && window.console) {
    console.info('[analytics]', data);
  }

  if (!cfg.enabled) return;

  if (cfg.service === 'ga4' && cfg.ga4Id && window.gtag) {
    window.gtag('event', eventName, payload);
  }

  if (cfg.service === 'goatcounter' && cfg.goatcounterEndpoint) {
    try {
      fetch(cfg.goatcounterEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        keepalive: true
      });
    } catch (e) {
      /* silencioso */
    }
  }
}

export function trackView(theme) {
  track('view', { theme });
}

export function trackPage(theme, page) {
  track('page_view', { theme, page });
}

export function trackAction(theme, action, detail = null) {
  track(action, { theme, ...(detail ? { detail } : {}) });
}
