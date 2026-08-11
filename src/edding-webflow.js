// WEBFLOW-PORT: der einzige Einstiegspunkt. Alles, was in Slater stehen muss, ist:
//
//   const BASE = 'https://cdn.jsdelivr.net/gh/<user>/<repo>@<version>/';
//   import(BASE + 'src/edding-webflow.js').then(m => m.initEdding({ assetBase: BASE + 'assets/' }));
//
// Alternativ ohne jede Konfiguration im Code: <body data-edding-asset-base="…/assets/"> setzen,
// dann findet initEdding() die Basis selbst.
//
// initEdding() ist mehrfach aufrufbar (z.B. nach dem Nachladen von CMS-Inhalten): jedes bereits
// initialisierte Element traegt data-edding-ready und wird uebersprungen.

import { initStrokes } from './edding-strokes.js';
import { initPenSliders } from './edding-pen-slider.js';
import { initImageBrush } from './edding-image-brush.js';

export { STROKE_PRESETS, STROKE_ASPECT, SLIDER_ASPECT, IMAGE_BRUSH_ASPECT } from './presets.js';

const VERSION = '1.0.0';

function resolveAssetBase(explicit) {
  const fromAttr = document.body && document.body.getAttribute('data-edding-asset-base');
  let base = explicit || fromAttr || '';
  if (base && !base.endsWith('/')) base += '/';
  if (!base) {
    console.warn('[edding] Keine assetBase gesetzt - Texturen und 3D-Modelle werden relativ zur'
      + ' Seiten-URL gesucht und in Webflow deshalb nicht gefunden.'
      + ' Entweder initEdding({ assetBase: "…" }) uebergeben oder'
      + ' <body data-edding-asset-base="…"> setzen.');
    base = 'assets/';
  }
  return base;
}

export function initEdding(options = {}) {
  const cfg = { assetBase: resolveAssetBase(options.assetBase) };

  const run = () => {
    const result = {
      version: VERSION,
      assetBase: cfg.assetBase,
      strokes: initStrokes(cfg),
      sliders: initPenSliders(cfg),
      imageBrush: initImageBrush(cfg),
    };
    // Zugriff fuer Nachmessungen und zum Nachjustieren in der Browser-Konsole.
    window.__edding = result;
    return result;
  };

  // Die Module vermessen Boxen - vorher muessen Layout und Schriften stehen. Bei Webflow laeuft
  // dieses Modul ohnehin am Seitenende, der Fallback ist nur fuer den Fall, dass es hoeher
  // eingebunden wird.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
    return null;
  }
  return run();
}

// Bequemlichkeit: liegt die Basis am <body>, startet das Modul von selbst - dann genuegt in
// Slater ein reines import() ohne Aufruf.
if (document.body && document.body.hasAttribute('data-edding-asset-base')
    && !document.body.hasAttribute('data-edding-no-autostart')) {
  initEdding();
}
