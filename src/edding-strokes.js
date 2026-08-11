// WEBFLOW-PORT: die gemalten Marker-Striche als Webflow-Baustein.
//
// Du baust im Designer eine leere Box und haengst ein Attribut dran:
//
//   <div data-edding-stroke="hitze"></div>
//
// Dieses Modul findet sie, legt eine Canvas hinein und bindet den Zeichenfortschritt an die
// Scrollposition. Alles, was der Prototyp ueber handkalibrierte absolute scrollY-Werte macht
// (CAROUSEL_STICKY_SHIFT = 4662, HEADER_SHIFT_PX = 17 und so weiter), laeuft hier ANKER-RELATIV:
// der Fortschritt kommt aus der Position der Box im Viewport. Damit ist er unabhaengig davon,
// was oberhalb steht - genau das, was ein Mobile-Nachbau braucht, wo Header und Bildhoehen
// nicht die des Desktops sind. Das Prinzip ist aus js/home-strokes.js (progressFor()) uebernommen.

import { StrokeChapter } from './stroke-chapter.js';
import { STROKE_PRESETS, TEXTURES } from './presets.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------------------------------------------------------------------------------------------
// Ein Scroll-Listener und ein requestAnimationFrame fuer ALLE Striche der Seite. Bei sechs
// Strichen waeren sechs eigene Listener sechsmal derselbe Layout-Lesevorgang pro Frame.
// ---------------------------------------------------------------------------------------------
const registry = [];
let ticking = false;
let bound = false;

function tick() {
  ticking = false;
  for (const item of registry) item.update();
}
function requestTick() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(tick);
}

// Resize wird entprellt: _layout() in StrokeChapter baut die Textur-Maske ueber JEDEN
// Geraetepixel der Canvas neu auf (getImageData + Schleife). Auf Mobile feuert resize beim
// Ein-/Ausblenden der Adressleiste - ungebremst waere das ein sichtbarer Ruckler.
let resizeTimer = null;
function onResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    for (const item of registry) item.relayout();
    requestTick();
  }, 150);
}

function bindGlobal() {
  if (bound) return;
  bound = true;
  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);
}

// ---------------------------------------------------------------------------------------------
// Attribut-Lesehilfen
// ---------------------------------------------------------------------------------------------
const num = (el, name, fallback) => {
  const raw = el.getAttribute(name);
  if (raw === null || raw.trim() === '') return fallback;
  const v = parseFloat(raw);
  return Number.isFinite(v) ? v : fallback;
};
const flag = (el, name) => {
  const raw = el.getAttribute(name);
  return raw !== null && raw !== 'false' && raw !== '0';
};

// data-stroke-scrub="1.0 0.45" -> { startVh: 1.0, endVh: 0.45 }
// Bedeutung: 1.0 = Oberkante der Box beruehrt den unteren Viewportrand (Strich beginnt),
// 0.45 = Oberkante steht bei 45 % Viewporthoehe (Strich ist fertig). endVh muss KLEINER sein
// als startVh, sonst laeuft der Fortschritt rueckwaerts.
function parseScrub(el) {
  const raw = (el.getAttribute('data-stroke-scrub') || '').trim();
  if (!raw) return { startVh: 1.0, endVh: 0.45 };
  const parts = raw.split(/[\s,]+/).map(parseFloat).filter(Number.isFinite);
  if (parts.length < 2) return { startVh: 1.0, endVh: 0.45 };
  return { startVh: parts[0], endVh: parts[1] };
}

// ---------------------------------------------------------------------------------------------
// Die Strichbreiten-Korrektur. Siehe die lange Begruendung bei refBox in presets.js:
// die Strichdicke kommt absolut aus dem Stift und wuerde in einer kleinen Box viel zu fett
// wirken. Hier wird derselbe Einpass-Faktor nachgerechnet, den Brush.fitSubpaths() verwendet -
// einmal fuer deine Box, einmal fuer die Referenzbox des Prototyps - und das Verhaeltnis auf
// widthMultiplier gelegt.
// ---------------------------------------------------------------------------------------------
function fitScale(boxW, boxH, path, marginX, marginY) {
  const safeW = boxW * (1 - 2 * marginX);
  const safeH = boxH * (1 - 2 * marginY);
  if (safeW <= 0 || safeH <= 0 || !path.w || !path.h) return 0;
  return Math.min(safeW / path.w, safeH / path.h) * 0.88;
}

// pathScale (data-stroke-scale) geht MIT ein. Sonst waere "reinzoomen" halb falsch: die
// Zeichnung wuerde groesser, die Strichdicke aber gleich bleiben - der Strich wirkt beim
// Zoomen also immer duenner, statt mitzuwachsen. Reinzoomen heisst optisch, dass ALLES
// groesser wird, Strichdicke eingeschlossen.
function autoWidthMultiplier(preset, boxW, boxH, pathScale = 1) {
  const mx = preset.marginX ?? 0.12;
  const my = preset.marginY ?? 0.16;
  const mine = fitScale(boxW, boxH, preset.path, mx, my) * pathScale;
  const ref = fitScale(preset.refBox.w, preset.refBox.h, preset.path, mx, my);
  if (!ref || !mine) return preset.widthMultiplier;
  return preset.widthMultiplier * (mine / ref);
}

// ---------------------------------------------------------------------------------------------
// Ein Strich
// ---------------------------------------------------------------------------------------------
function createStroke(el, cfg) {
  const presetName = el.getAttribute('data-edding-stroke');
  const preset = STROKE_PRESETS[presetName];
  if (!preset && !el.getAttribute('data-stroke-svg')) {
    console.warn('[edding] Unbekanntes Strich-Preset:', presetName,
      '- moeglich sind:', Object.keys(STROKE_PRESETS).join(', '));
    return null;
  }
  const base = preset || STROKE_PRESETS.hitze;

  // Die Box muss positioniert sein, sonst haengt die absolut gesetzte Canvas am naechsten
  // positionierten Vorfahren und sitzt irgendwo. Wird hier still nachgeholt, damit ein
  // vergessenes "position: relative" im Designer nicht zum Raetsel wird.
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.className = 'edding-stroke__canvas';
  canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:block;';
  el.appendChild(canvas);

  const boxW = el.clientWidth;
  const boxH = el.clientHeight;
  if (!boxW || !boxH) {
    console.warn('[edding] Strich-Box hat keine Groesse (' + presetName + ').',
      'Die Box braucht im Designer eine Breite UND eine Hoehe - z.B. width 100% + aspect-ratio.');
  }

  const marginX = num(el, 'data-margin-x', base.marginX ?? 0.12);
  const marginY = num(el, 'data-margin-y', base.marginY ?? 0.16);

  // data-stroke-scale: Zoomfaktor. 1 = Zeichnung genau in die Box eingepasst, 2 = doppelt so
  // gross (ragt dann ueber die Boxkanten hinaus und wird von der Canvas beschnitten - genau das
  // ist beim Reinzoomen gewollt).
  const pathScale = num(el, 'data-stroke-scale', 1);

  // data-pen-width="auto" (Standard) skaliert mit der Boxgroesse UND mit dem Zoom,
  // eine Zahl setzt sie fest.
  const widthRaw = (el.getAttribute('data-pen-width') || 'auto').trim();
  const widthMultiplier = widthRaw === 'auto'
    ? autoWidthMultiplier({ ...base, marginX, marginY }, boxW, boxH, pathScale)
    : (parseFloat(widthRaw) || base.widthMultiplier);

  const textureKey = el.getAttribute('data-texture') || base.texture;
  const textureUrl = el.getAttribute('data-texture-url')
    || (textureKey && TEXTURES[textureKey] ? cfg.assetBase + TEXTURES[textureKey] : null);

  const opts = {
    svgText: el.getAttribute('data-stroke-svg') || base.svgText,
    brushId: el.getAttribute('data-pen-brush') || base.brushId,
    tipAngleDeg: num(el, 'data-pen-angle', base.tipAngleDeg),
    widthMultiplier,
    grungeAmt: num(el, 'data-pen-grunge', base.grungeAmt),
    grainSizePx: num(el, 'data-pen-grain', base.grainSizePx),
    dynamic: base.dynamic,
    color: el.getAttribute('data-stroke-color') || base.color,
    textureUrl,
    maskStrength: num(el, 'data-mask-strength', base.maskStrength),
    maskContrast: num(el, 'data-mask-contrast', base.maskContrast),
    marginX,
    marginY,
    // Versatz der Zeichnung in der Box, als Anteil der Boxgroesse. Beim Reinzoomen der Weg,
    // die interessante Stelle in den Ausschnitt zu holen (siehe _safeRect in stroke-chapter.js).
    offsetX: num(el, 'data-stroke-offset-x', 0),
    offsetY: num(el, 'data-stroke-offset-y', 0),
    // Stauchen/Strecken je Achse, unabhaengig vom gleichmaessigen Zoom (pathScale).
    // 1 = unveraendert, 0.6 = auf 60 % zusammengedrueckt, 1.4 = auf 140 % gezogen.
    // Die Strichdicke bleibt dabei absichtlich gleich: der Stift wird nicht mitgestaucht,
    // genau wie ein echter Marker, der eine flachere Kurve mit derselben Spitze zieht.
    scaleX: num(el, 'data-stroke-scale-x', 1),
    scaleY: num(el, 'data-stroke-scale-y', 1),
    pathScale,
    reverse: el.hasAttribute('data-stroke-reverse') ? flag(el, 'data-stroke-reverse') : !!base.reverse,
  };

  // Die Zeichenmaschine entsteht LAZY - erst wenn der Strich in Reichweite kommt.
  // Grund: der StrokeChapter-Konstruktor laedt sofort seine Textur. Bei sechs Strichen auf einer
  // Seite haette der Strich von Kapitel 5 seine eigene Textur (grain-rough.jpg, 436 KB) also
  // schon beim Seitenaufruf geholt, obwohl er zwei Bildschirme weiter unten liegt. Gemessen:
  // knapp 1 MB, die auf Mobile beim ersten Laden nichts beitragen.
  let chapter = null;
  function ensureChapter() {
    if (chapter) return chapter;
    chapter = new StrokeChapter(canvas, opts);
    chapter.ready.then(() => {
      item.relayout();
      item.update();
    }).catch((err) => {
      console.error('[edding] Strich konnte nicht geladen werden (' + presetName + '):', err);
    });
    return chapter;
  }

  const mode = el.getAttribute('data-stroke-mode') || base.mode || 'progress';
  const trim = {
    head: num(el, 'data-trim-head', base.trim ? base.trim.head : 1),
    tailStart: num(el, 'data-trim-tail-start', base.trim ? base.trim.tailStart : 0),
    tailRange: num(el, 'data-trim-tail-range', base.trim ? base.trim.tailRange : 1),
    tailMax: num(el, 'data-trim-tail-max', base.trim ? base.trim.tailMax : 1),
  };

  const { startVh, endVh } = parseScrub(el);
  // data-stroke-once: zeichnet beim Eintritt in den Viewport EINMAL durch, statt am Scrollen
  // zu haengen. Standard ist gescrubbt (Nutzer-Vorgabe).
  const once = flag(el, 'data-stroke-once');
  const onceMs = num(el, 'data-stroke-duration', 1000);
  const debug = flag(el, 'data-stroke-debug');

  if (debug) {
    console.log('[edding stroke]', presetName, {
      box: boxW + '×' + boxH,
      penWidth: Math.round(widthMultiplier * 1000) / 1000,
      penWidthPreset: base.widthMultiplier,
      mode, trim: mode === 'trim' ? trim : undefined,
      scrub: startVh + ' → ' + endVh,
      textureUrl,
    });
  }

  let last = -1;
  let visible = false;
  let done = false; // nur fuer once / reduced-motion

  function draw(p) {
    if (!chapter || !chapter.perSubpath.length) return; // noch nicht geladen
    if (mode === 'trim') {
      const head = clamp01(p / (trim.head || 1));
      const tail = Math.min(trim.tailMax, Math.max(0, (p - trim.tailStart) / (trim.tailRange || 1)));
      chapter.renderTrim(head, tail);
    } else {
      chapter.renderProgress(clamp01(p));
    }
  }

  function progressNow() {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || 1;
    const startTop = startVh * vh;
    const endTop = endVh * vh;
    return clamp01((startTop - rect.top) / (startTop - endTop || 1));
  }

  // Strichbreite bei Groessenaenderung nachrechnen.
  // Ohne das bliebe der beim Init berechnete Wert stehen - und der ist falsch, wenn die Box zu
  // diesem Zeitpunkt noch keine Groesse hatte (versteckter Tab, display:none bis zu einer
  // Interaktion, nachgeladener CMS-Abschnitt) oder wenn sich die Breite spaeter aendert
  // (Geraet drehen). Der Fall "Box war beim Start 0x0" ist beim Testen real aufgetreten:
  // widthMultiplier fiel auf den Desktop-Wert 3.6 zurueck und der Strich war viermal zu fett.
  let appliedWidth = widthMultiplier;
  function remeasureWidth() {
    if (widthRaw !== 'auto') return false;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return false;
    const next = autoWidthMultiplier({ ...base, marginX, marginY }, w, h, pathScale);
    if (!Number.isFinite(next) || Math.abs(next - appliedWidth) < 0.001) return false;
    appliedWidth = next;
    opts.widthMultiplier = next;                        // fuer eine noch nicht gebaute Maschine
    if (chapter) chapter.opts.widthMultiplier = next;   // wird in StrokeChapter._layout() gelesen
    if (debug) console.log('[edding stroke] ' + presetName + ' Breite neu:', Math.round(next * 1000) / 1000, 'bei Box', w + '×' + h);
    return true;
  }

  const item = {
    el,
    get chapter() { return chapter; },
    get progress() { return last; },
    get penWidth() { return appliedWidth; },
    update() {
      // Ausserhalb des Bildes gar nicht rechnen. Ohne das wuerden alle sechs Striche bei
      // jedem Scroll-Frame ihre Geometrie durchlaufen, auch die weit oberhalb liegenden.
      if (!visible || done) return;
      const p = progressNow();
      // Wie im Original: erst ab 0.002 Unterschied neu zeichnen, 0 und 1 aber immer.
      if (Math.abs(p - last) < 0.002 && p !== 0 && p !== 1) return;
      last = p;
      draw(p);
    },
    relayout() {
      remeasureWidth();
      if (chapter) chapter.handleResize();
      last = -1;
    },
    // Fuer Messungen von aussen (siehe test/mobile.html)
    setProgress(p) { ensureChapter(); last = p; draw(p); },
    ensureChapter,
  };

  // Einmal-Modus und "Bewegung reduzieren": ueber requestAnimationFrame durchspielen bzw.
  // sofort fertig zeichnen, statt am Scrollen zu haengen.
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function playOnce(durationMs) {
    done = true;
    if (durationMs <= 0) { draw(1); return; }
    const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const start = performance.now();
    (function step(now) {
      const t = clamp01((now - start) / durationMs);
      draw(easeInOut(t));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }

  // Ein Viewport Vorlauf (rootMargin 100%): so ist die Textur geladen und die Geometrie gebaut,
  // BEVOR der Strich ins Bild kommt - sonst waere der Anfang des Scrubbens leer.
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      visible = e.isIntersecting;
      if (!visible) continue;
      const ch = ensureChapter();
      if (reduced) { io.unobserve(el); ch.ready.then(() => playOnce(0)); return; }
      if (once) { io.unobserve(el); ch.ready.then(() => playOnce(onceMs)); return; }
      requestTick();
    }
  }, { rootMargin: '100% 0px 100% 0px' });

  // Reagiert auf JEDE Groessenaenderung der Box - auch auf den Sprung 0 -> echte Groesse, den
  // ein window.resize gar nicht meldet. Entprellt, weil _layout() die Textur-Maske ueber jeden
  // Geraetepixel neu aufbaut. Der erste, synchrone Callback wird uebersprungen: er kommt direkt
  // beim observe() und wuerde die Erstzeichnung doppelt anstossen.
  let roFirst = true;
  let roTimer = null;
  const ro = new ResizeObserver(() => {
    if (roFirst) { roFirst = false; return; }
    clearTimeout(roTimer);
    roTimer = setTimeout(() => { item.relayout(); requestTick(); item.update(); }, 120);
  });

  io.observe(el);
  ro.observe(el);

  registry.push(item);
  bindGlobal();
  return item;
}

// ---------------------------------------------------------------------------------------------
export function initStrokes(cfg) {
  const els = document.querySelectorAll('[data-edding-stroke]:not([data-edding-ready])');
  const items = [];
  els.forEach((el) => {
    el.setAttribute('data-edding-ready', '1');
    const item = createStroke(el, cfg);
    if (item) items.push(item);
  });
  return items;
}
