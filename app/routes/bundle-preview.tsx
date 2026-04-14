import { readFileSync } from "fs";
import path from "path";

/**
 * Route publique (sans auth) qui sert la page HTML de prévisualisation du bundle.
 * Chargée dans un <iframe> par BundleIframePreview.tsx dans l'éditeur admin.
 *
 * Communication bidirectionnelle via postMessage :
 *   Parent → iframe  : { type: 'sar-preview-update', bundle: {...}, stepIndex, selectedBlockId }
 *   iframe → Parent  : { type: 'sar-editor-select-block', blockId }
 *   iframe → Parent  : { type: 'sar-preview-ready' }
 *   iframe → Parent  : { type: 'sar-preview-height', height: number }
 */
export function loader() {
  const base = process.cwd();

  // On lit les assets directement depuis le système de fichiers (dev + prod)
  let js = "";
  let css = "";
  let sharedCss = "";

  try {
    js = readFileSync(
      path.join(base, "extensions/sar-bundle-ui/assets/bundle-builder.js"),
      "utf-8",
    );
  } catch {
    js = "console.error('[SAR Preview] bundle-builder.js introuvable');";
  }
  try {
    css = readFileSync(
      path.join(base, "extensions/sar-bundle-ui/assets/bundle-builder.css"),
      "utf-8",
    );
  } catch {
    css = "";
  }
  try {
    sharedCss = readFileSync(
      path.join(
        base,
        "extensions/sar-bundle-ui/assets/bundle-shared-ui.css",
      ),
      "utf-8",
    );
  } catch {
    sharedCss = "";
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SAR Bundle Preview</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: transparent;
    }
    body { padding: 16px; }
    ${sharedCss}
    ${css}
    /* En mode preview, on retire la bordure externe du widget */
    .sar-bundle { border: none !important; border-radius: 0 !important; }
  </style>
</head>
<body>
  <div
    id="sar-bundle-root"
    class="sar-bundle"
    data-sar-bundle-root
  >
    <div class="sar-bundle__loading" data-sar-loading>Chargement de l'aperçu…</div>
    <div class="sar-bundle__inner" data-sar-inner hidden></div>
  </div>

  <script>
${js}
  </script>

  <script>
    // ═══════════════════════════════════════════════════════════════════
    // BRIDGE postMessage ↔ bundle-builder.js
    // ═══════════════════════════════════════════════════════════════════

    var sarPreviewEl = document.getElementById('sar-bundle-root');

    // 1. Écoute les mises à jour de données envoyées par l'éditeur admin
    window.addEventListener('message', function(e) {
      if (!e.data || e.data.type !== 'sar-preview-update') return;
      var payload = e.data.bundle;
      if (!payload) return;

      // Flags d'édition : highlight de blocs, navigation d'étape
      payload.__editorMode = true;
      payload.__selectedBlockId = e.data.selectedBlockId || null;
      payload.stepIndex = typeof e.data.stepIndex === 'number' ? e.data.stepIndex : 0;

      // Remise à zéro du DOM de l'élément root avant re-mount
      sarPreviewEl.innerHTML =
        '<div data-sar-loading class="sar-bundle__loading" hidden></div>' +
        '<div data-sar-inner hidden></div>';

      window.SARBundleJS.mount(sarPreviewEl, payload).catch(function(err) {
        console.error('[SAR Preview] Erreur de montage :', err);
      });
    });

    // 2. Relaie la sélection de bloc vers l'éditeur parent
    window.addEventListener('sar-editor-select-block', function(e) {
      window.parent.postMessage(
        { type: 'sar-editor-select-block', blockId: e.detail },
        '*'
      );
    });

    // 3. Hauteur dynamique — ResizeObserver sur body
    if (typeof ResizeObserver !== 'undefined') {
      var sarHeightObserver = new ResizeObserver(function() {
        var h = document.documentElement.scrollHeight;
        window.parent.postMessage({ type: 'sar-preview-height', height: h }, '*');
      });
      sarHeightObserver.observe(document.body);
    }

    // 4. Signaler au parent que l'iframe est prête à recevoir des données
    window.parent.postMessage({ type: 'sar-preview-ready' }, '*');
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Autorise l'intégration en iframe depuis le même domaine et Shopify Admin
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy":
        "frame-ancestors 'self' https://*.shopify.com https://admin.shopify.com https://partners.shopify.com;",
      // Pas de cache agressif en dev, mais cache court en prod pour les assets lus depuis le FS
      "Cache-Control": "no-store",
    },
  });
}
