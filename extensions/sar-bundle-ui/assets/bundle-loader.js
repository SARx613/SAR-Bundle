/**
 * Charge bundle-builder.js. Ne pas se fier à document.currentScript avec defer/module :
 * il est souvent null, et « dernier script » peut être Google Analytics → mauvaise URL.
 * L’URL canonique vient de data-sar-main-js (asset_url Liquid) sur #sar-bundle-root.
 */
(function () {
  'use strict';

  function showLoadError(msg) {
    var nodes = document.querySelectorAll('[data-sar-loading]');
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = msg;
      nodes[i].classList.add('sar-bundle__error');
    }
  }

  function resolveMainScriptUrl() {
    var root = document.getElementById('sar-bundle-root');
    var fromLiquid = root && root.getAttribute('data-sar-main-js');
    if (fromLiquid) return fromLiquid.trim();

    var el = document.currentScript;
    if (el && el.src) {
      return el.src.replace(/[^/]+$/, '') + 'bundle-builder.js';
    }
    var scripts = document.getElementsByTagName('script');
    for (var j = scripts.length - 1; j >= 0; j--) {
      var u = scripts[j].src || '';
      if (u.indexOf('bundle-loader') !== -1) {
        return u.replace(/[^/]+$/, '') + 'bundle-builder.js';
      }
    }
    return '';
  }

  function inject() {
    if (window.__sarBundleMainRequested) return;
    var mainUrl = resolveMainScriptUrl();
    if (!mainUrl) {
      console.error('[SAR Bundle] URL de bundle-builder.js introuvable');
      showLoadError(
        'Configuration bloc : URL du script principale manquante. Réinstallez / mettez à jour l’extension thème.',
      );
      return;
    }
    window.__sarBundleMainRequested = true;
    var s = document.createElement('script');
    s.src = mainUrl;
    s.defer = true;
    s.onerror = function () {
      console.error('[SAR Bundle] Échec chargement', mainUrl);
      showLoadError(
        'Impossible de charger le script du bundle. Vérifiez l’extension thème et le réseau, puis rafraîchissez.',
      );
    };
    document.head.appendChild(s);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
})();
