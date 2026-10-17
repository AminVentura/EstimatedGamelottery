/*
 * Consentimiento de cookies + Google Consent Mode v2 — prediccionloteria.com (2026-09-29)
 *
 * Cargar SÍNCRONO en <head>, antes de cualquier etiqueta de Google:
 *   <script src="/consent.js"></script>
 *
 * - Por defecto todo denegado (ad_storage, ad_user_data, ad_personalization, analytics_storage).
 * - El <script> de AdSense va en el HTML de las páginas con contenido (el rastreador no ejecuta este archivo).
 *   consent default queda denegado antes de ese script. loadAdSense() no lo duplica.
 *   En páginas legales no hay script: solo la metaetiqueta.
 * - Banner con Aceptar / Rechazar del mismo peso y un botón Configurar.
 * - Cualquier elemento con [data-cookie-prefs] reabre el banner (enlace "Preferencias de cookies" del footer).
 * - La elección se guarda en localStorage (clave cookieConsentPrefs). Si el almacenamiento falla, se pregunta de nuevo.
 *
 * NOTA: para tráfico del EEE / Reino Unido / Suiza Google exige una CMP certificada (TCF). Este banner no lo es.
 */
(function () {
  'use strict';

  var ADSENSE_CLIENT = 'ca-pub-8721021745606812';
  var STORAGE_KEY = 'cookieConsentPrefs';
  var LEGACY_KEY = 'cookieConsent'; // banner anterior; se mantiene sincronizada para no romper código viejo
  var PREFS_VERSION = 2;

  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  // 1) Consent Mode v2: todo denegado antes de cualquier etiqueta
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    wait_for_update: 500
  });
  gtag('set', 'ads_data_redaction', true);

  function readPrefs() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (!p || p.v !== PREFS_VERSION) return null;
      return { ads: !!p.ads, personalization: !!(p.ads && p.personalization), date: p.date || '' };
    } catch (e) { return null; }
  }

  function writePrefs(p) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        v: PREFS_VERSION, ads: p.ads, personalization: p.personalization, date: new Date().toISOString()
      }));
      window.localStorage.setItem(LEGACY_KEY, p.ads ? '1' : '0');
    } catch (e) { /* sin almacenamiento: la elección vale solo para esta visita */ }
  }

  function applyConsent(p) {
    gtag('consent', 'update', {
      ad_storage: p.ads ? 'granted' : 'denied',
      ad_user_data: p.personalization ? 'granted' : 'denied',
      ad_personalization: p.personalization ? 'granted' : 'denied',
      analytics_storage: 'denied' // el sitio no usa analítica
    });
  }

  var current = readPrefs();
  if (current) applyConsent(current);

  window.adsbygoogle = window.adsbygoogle || [];
  if (!current || !current.personalization) window.adsbygoogle.requestNonPersonalizedAds = 1;

  var adsenseRequested = false;
  function loadAdSense() {
    if (adsenseRequested) return;
    var p = current;
    if (!p || !p.ads) return;
    window.adsbygoogle = window.adsbygoogle || [];
    if (!p.personalization) window.adsbygoogle.requestNonPersonalizedAds = 1;
    if (document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')) {
      adsenseRequested = true;
      document.dispatchEvent(new CustomEvent('bs:adsense-ready'));
      return;
    }
    if (!document.querySelector('ins.adsbygoogle')) return;
    adsenseRequested = true;
    var s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + ADSENSE_CLIENT;
    s.onload = s.onerror = function () {
      document.dispatchEvent(new CustomEvent('bs:adsense-ready'));
    };
    document.head.appendChild(s);
  }

  // ---------- Banner ----------
  var banner, panel, chkAds, chkPers;

  function buildBanner() {
    if (banner) return banner;
    var old = document.getElementById('cookie-banner');
    if (old && old.parentNode) old.parentNode.removeChild(old);

    banner = document.createElement('div');
    banner.id = 'cookie-banner';
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');
    banner.setAttribute('aria-describedby', 'cookie-banner-desc');
    banner.innerHTML =
      '<div class="cookie-content">' +
        '<div class="cookie-text">' +
          '<h2 id="cookie-banner-title" class="cookie-title">Cookies y publicidad</h2>' +
          '<p id="cookie-banner-desc">Usamos almacenamiento técnico para que el sitio funcione. Con tu permiso, Google AdSense usará cookies para mostrar y medir anuncios. Puedes aceptar, rechazar o elegir. Detalles en la <a href="/politica-cookies.html">Política de Cookies</a>.</p>' +
        '</div>' +
        '<div class="cookie-buttons">' +
          '<button type="button" class="cookie-btn" data-consent="reject">Rechazar</button>' +
          '<button type="button" class="cookie-btn" data-consent="accept">Aceptar</button>' +
          '<button type="button" class="cookie-btn cookie-btn--ghost" data-consent="configure" aria-expanded="false" aria-controls="cookie-settings">Configurar</button>' +
        '</div>' +
      '</div>' +
      '<div id="cookie-settings" class="cookie-settings" hidden>' +
        '<fieldset>' +
          '<legend>Elige qué permites</legend>' +
          '<label><input type="checkbox" checked disabled> Técnicas (necesarias: preferencias y predicciones guardadas en tu navegador)</label>' +
          '<label><input type="checkbox" id="cookie-chk-ads"> Publicidad (Google AdSense)</label>' +
          '<label><input type="checkbox" id="cookie-chk-pers"> Anuncios personalizados según tus intereses</label>' +
        '</fieldset>' +
        '<button type="button" class="cookie-btn" data-consent="save">Guardar selección</button>' +
      '</div>';
    document.body.appendChild(banner);

    panel = banner.querySelector('#cookie-settings');
    chkAds = banner.querySelector('#cookie-chk-ads');
    chkPers = banner.querySelector('#cookie-chk-pers');
    chkAds.addEventListener('change', function () {
      chkPers.disabled = !chkAds.checked;
      if (!chkAds.checked) chkPers.checked = false;
    });

    banner.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-consent]');
      if (!btn) return;
      var action = btn.getAttribute('data-consent');
      if (action === 'accept') decide({ ads: true, personalization: true });
      else if (action === 'reject') decide({ ads: false, personalization: false });
      else if (action === 'save') decide({ ads: chkAds.checked, personalization: chkAds.checked && chkPers.checked });
      else if (action === 'configure') {
        var open = panel.hasAttribute('hidden');
        if (open) panel.removeAttribute('hidden'); else panel.setAttribute('hidden', '');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) chkAds.focus();
      }
    });
    banner.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && current) hideBanner();
    });
    return banner;
  }

  function showBanner(focus) {
    buildBanner();
    var p = current || { ads: false, personalization: false };
    chkAds.checked = p.ads;
    chkPers.checked = p.personalization;
    chkPers.disabled = !p.ads;
    banner.classList.add('show');
    if (focus) {
      var first = banner.querySelector('[data-consent="reject"]');
      if (first) first.focus();
    }
  }

  function hideBanner() {
    if (banner) banner.classList.remove('show');
  }

  function decide(p) {
    var hadAdsLoaded = adsenseRequested;
    current = p;
    writePrefs(p);
    applyConsent(p);
    hideBanner();
    document.dispatchEvent(new CustomEvent('bs:consent', { detail: p }));
    if (p.ads) {
      loadAdSense();
    } else if (hadAdsLoaded) {
      // Se retiró el permiso con AdSense ya cargado: recargar para que no quede el script activo.
      window.location.reload();
    }
  }

  function wirePrefsLinks() {
    document.addEventListener('click', function (ev) {
      var link = ev.target.closest('[data-cookie-prefs]');
      if (!link) return;
      ev.preventDefault();
      showBanner(true);
    });
  }

  window.bsConsent = {
    get: function () { return current; },
    adsAllowed: function () { return !!(current && current.ads); },
    open: function () { showBanner(true); },
    loadAdSense: loadAdSense
  };

  function init() {
    wirePrefsLinks();
    if (!current) showBanner(false);
    else if (current.ads) loadAdSense();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
