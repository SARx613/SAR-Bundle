/**
 * Point d’entrée léger pour le bloc thème : Theme Check limite la taille du
 * fichier référencé par {% schema %}"javascript". Ce script charge bundle-builder.js.
 */
(function () {
  'use strict';
  if (window.__sarBundleMainRequested) return;
  window.__sarBundleMainRequested = true;
  var el = document.currentScript;
  if (!el || !el.src) {
    var scripts = document.getElementsByTagName('script');
    el = scripts[scripts.length - 1];
  }
  var src = el && el.src;
  if (!src) return;
  var base = src.replace(/[^/]+$/, '');
  var s = document.createElement('script');
  s.src = base + 'bundle-builder.js';
  s.defer = true;
  document.head.appendChild(s);
})();
