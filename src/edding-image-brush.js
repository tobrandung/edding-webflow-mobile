// WEBFLOW-PORT: Kapitel 6 - der Pinselstrich, der ein Bild-Karussell freimalt.
//
// Struktur, die du im Designer baust:
//
//   <section data-edding-image-brush>
//     <div data-brush-sticky>
//       <div data-brush-canvas></div>              <- Seitenverhaeltnis 1280/677
//       <img data-brush-image src="…staubig.jpg">  <- 4x, in dieser Reihenfolge
//       <div data-brush-word>Staubig</div>         <- optional, 4x
//     </div>
//   </section>
//
// WARUM DAS HIER NEU GEBAUT IST (und nur hier):
// Der Prototyp treibt dieses Kapitel mit einem "wheel-Hijack" an - er faengt das Mausrad ab
// (preventDefault), rechnet das Delta selbst um und zwingt die Seite per window.scrollTo() auf
// eine feste Scroll-Position. Auf einem Telefon gibt es keine wheel-Events, das Verfahren kann
// dort grundsaetzlich nicht funktionieren. Der Antrieb ist deshalb auf natives position:sticky
// plus Scroll-Scrub umgestellt - also genau das, was Kapitel 1 und 2 auf dem Desktop schon
// nutzen und was Kapitel 6 dort aus Risikogruenden nie geworden ist.
// Die Maschine darunter (DirtyCarousel: Strich als Alpha-Maske, Fotos per destination-in
// ausgestanzt) ist unveraendert uebernommen.
//
// Die Hoehe der aeusseren Sektion setzt dieses Modul selbst aus der Choreografie. Grund: im
// Prototyp sind die CSS-Hoehe und der JS-Teiler zwei getrennte Werte, die auseinanderlaufen
// koennen (dokumentierte Falle) - hier ist es einer.

import { DirtyCarousel } from './dirty-carousel.js';
import { IMAGE_BRUSH_PRESET } from './presets.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
// Quintisches Ein-/Ausklingen - wie im Prototyp fuer das Wort-Karussell (bewusst staerker
// gekruemmt als kubisch, weil der Uebergang mit 300px relativ lang ist).
const easeInOut = (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);

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

function createImageBrush(section, cfg) {
  const P = IMAGE_BRUSH_PRESET;
  const sticky = section.querySelector('[data-brush-sticky]') || section.firstElementChild;
  const canvasBox = section.querySelector('[data-brush-canvas]');
  if (!sticky || !canvasBox) {
    console.warn('[edding] Bild-Karussell braucht [data-brush-sticky] und [data-brush-canvas].');
    return null;
  }

  // Bildquellen: aus dem Markup (du verwaltest sie im Webflow-Asset-Manager) oder, wenn keine
  // <img data-brush-image> vorhanden sind, die vier aufbereiteten Fotos vom CDN.
  const imgEls = Array.from(section.querySelectorAll('[data-brush-image]'));
  const images = imgEls.length
    ? imgEls.map((el) => el.getAttribute('src') || el.getAttribute('data-src'))
    : P.images.map((f) => cfg.assetBase + 'karussell/' + f);
  // Die <img> selbst werden nicht angezeigt - gezeichnet wird auf der Canvas. Sie stehen nur
  // als Quellenliste im Markup.
  imgEls.forEach((el) => { el.style.display = 'none'; });

  const words = Array.from(section.querySelectorAll('[data-brush-word]'));

  if (getComputedStyle(canvasBox).position === 'static') canvasBox.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.className = 'edding-brush__canvas';
  canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:block;';
  canvasBox.appendChild(canvas);

  const N = images.length;
  const T = Math.max(1, N - 1);
  const holdPx = num(section, 'data-hold-px', P.holdPx);
  const xfadePx = num(section, 'data-xfade-px', P.xfadePx);
  const SEG = holdPx + xfadePx;
  // Gesamte Bild-Scrubstrecke: 4 x Standzeit + 3 x Ueberblendung = 1700px bei den Prototyp-Werten.
  const TOTAL = N * holdPx + T * xfadePx;
  const revealPx = num(section, 'data-reveal-px', P.revealPx);
  const scrubPx = num(section, 'data-scrub-px', revealPx + TOTAL);
  const wordShift = num(section, 'data-word-shift', P.wordShiftPx);
  const debug = flag(section, 'data-brush-debug');

  // Strichbreite mit der Boxbreite mitskalieren. DirtyCarousel skaliert den Pfad auf die
  // CANVAS-BREITE (nicht eingepasst wie StrokeChapter), deshalb ist allein die Breite die
  // Referenz - siehe refBox in presets.js und die Begruendung dort.
  const boxW = canvasBox.clientWidth || P.refBox.w;
  const widthRaw = (section.getAttribute('data-pen-width') || 'auto').trim();
  const widthMultiplier = widthRaw === 'auto'
    ? P.widthMultiplier * (boxW / P.refBox.w)
    : (parseFloat(widthRaw) || P.widthMultiplier);

  const carouselOpts = {
    svgText: P.svgText,
    images,
    brushId: P.brushId,
    tipAngleDeg: num(section, 'data-pen-angle', P.tipAngleDeg),
    widthMultiplier,
    grungeAmt: num(section, 'data-pen-grunge', P.grungeAmt),
    grainSizePx: num(section, 'data-pen-grain', P.grainSizePx),
    dynamic: P.dynamic,
    vOffset: num(section, 'data-brush-offset-y', P.vOffset),
  };

  // LAZY: der DirtyCarousel-Konstruktor laedt sofort ALLE vier Fotos. Beim Seitenaufruf waeren
  // das gemessen ~480 KB fuer einen Abschnitt, der mehrere Bildschirme weiter unten liegt.
  // Gebaut wird deshalb erst, wenn die Sektion in Reichweite kommt (ein Viewport Vorlauf).
  let carousel = null;
  let readyPromise = null;
  function build() {
    if (carousel) return carousel;
    carousel = new DirtyCarousel(canvas, carouselOpts);
    readyPromise = carousel.ready.then(() => {
      remeasureWidth();
      carousel.handleResize();
      update();
      ro.observe(canvasBox);
      if (debug) {
        console.log('[edding image-brush]', {
          canvas: canvasBox.clientWidth + '×' + canvasBox.clientHeight,
          bilder: N,
          penWidth: Math.round(appliedWidth * 1000) / 1000,
          penWidthPreset: P.widthMultiplier,
          scrubPx, revealPx, holdPx, xfadePx, TOTAL,
          sektionshoehe: section.getBoundingClientRect().height,
        });
      }
    }).catch((err) => console.error('[edding] Bild-Karussell konnte nicht laden:', err));
    return carousel;
  }

  // Sektionshoehe = ein Viewport (die gepinnte Ansicht) + die Scrubstrecke. svh statt vh:
  // auf Mobile aendert das Ein-/Ausblenden der Adressleiste vh und wuerde die Sektionshoehe
  // und damit den ganzen Scrub mitten im Scrollen verschieben.
  section.style.position = 'relative';
  section.style.height = `calc(100svh + ${scrubPx}px)`;
  sticky.style.position = 'sticky';
  sticky.style.top = '0';

  // Fotozustand an Scrub-Position s (in px) - unveraendert aus photoStateAt() im Prototyp.
  function photoStateAt(s) {
    for (let k = 0; k < T; k++) {
      const xs = k * SEG + holdPx;
      if (s < xs) return { from: k, to: k, blend: 0 };
      if (s < xs + xfadePx) return { from: k, to: k + 1, blend: (s - xs) / xfadePx };
    }
    return { from: N - 1, to: N - 1, blend: 0 };
  }

  // Wort-Karussell: aktives Wort + laufender Uebergang, synchron zum Bildwechsel.
  function applyWords(s) {
    if (!words.length) return;
    let activeIdx = 0, tp = 0;
    for (let k = 0; k < T; k++) {
      const a = k * SEG + holdPx;
      const b = a + xfadePx;
      if (s >= b) { activeIdx = k + 1; }
      else if (s > a) { activeIdx = k; tp = easeInOut((s - a) / (b - a)); break; }
      else break;
    }
    words.forEach((el, i) => {
      let op = 0, ty = wordShift;
      if (i === activeIdx) { op = 1 - tp; ty = -wordShift * tp; }
      else if (i === activeIdx + 1) { op = tp; ty = wordShift * (1 - tp); }
      el.style.opacity = op;
      el.style.transform = `translateY(${ty}px)`;
    });
  }

  let lastState = null;
  let lastReveal = -1;

  function update() {
    if (!carousel || !carousel.perSubpath.length) return; // noch nicht gebaut/geladen
    // Fortschritt aus der Position der Sektion: solange ihre Oberkante ueber 0 liegt, faehrt
    // sie noch herein (Reveal-Phase); danach laeuft der Scrub linear mit dem Scrollen.
    const top = section.getBoundingClientRect().top;
    const past = -top; // wie weit die Sektion oben aus dem Bild gewandert ist

    if (past < revealPx) {
      // Phase 1: der Pinselstrich malt sich und gibt Bild 1 frei.
      const p = clamp01(past / revealPx);
      if (Math.abs(p - lastReveal) >= 0.002 || p === 0 || p === 1) {
        lastReveal = p;
        carousel.renderReveal(p);
      }
      applyWords(0);
      return;
    }

    // Phase 2: Strich steht (Maske voll), die Fotos blenden durch.
    lastReveal = 1;
    const s = Math.max(0, Math.min(TOTAL, past - revealPx));
    const st = photoStateAt(s);
    if (!lastState || st.from !== lastState.from || st.to !== lastState.to
        || Math.abs(st.blend - lastState.blend) >= 0.004) {
      lastState = st;
      carousel.renderCarousel(st.from, st.to, st.blend);
    }
    applyWords(s);
  }

  let ticking = false;
  function requestTick() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; update(); });
  }

  // Strichbreite bei Groessenaenderung nachrechnen - gleicher Grund wie bei den Strichen:
  // hatte die Box beim Start noch keine Breite (versteckter Tab, spaeter eingeblendeter
  // Abschnitt), stand hier sonst dauerhaft der Desktop-Wert 5.
  let appliedWidth = widthMultiplier;
  function remeasureWidth() {
    if (widthRaw !== 'auto') return;
    const w = canvasBox.clientWidth;
    if (!w) return;
    const next = P.widthMultiplier * (w / P.refBox.w);
    if (!Number.isFinite(next) || Math.abs(next - appliedWidth) < 0.001) return;
    appliedWidth = next;
    carouselOpts.widthMultiplier = next;                  // fuer eine noch nicht gebaute Maschine
    if (carousel) carousel.opts.widthMultiplier = next;   // wird in DirtyCarousel._layout() gelesen
  }

  let resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      remeasureWidth();
      if (carousel) carousel.handleResize();
      lastState = null;
      lastReveal = -1;
      update();
    }, 150);
  }

  let roFirst = true;
  const ro = new ResizeObserver(() => {
    if (roFirst) { roFirst = false; return; }
    onResize();
  });

  // Ein Viewport Vorlauf, damit Strich-Geometrie und Fotos stehen, bevor die Sektion ins Bild
  // kommt - sonst waere der Anfang der Reveal-Phase leer.
  const buildIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      buildIO.disconnect();
      build();
    }
  }, { rootMargin: '100% 0px 100% 0px' });
  buildIO.observe(section);

  window.addEventListener('scroll', requestTick, { passive: true });
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  return {
    section,
    get carousel() { return carousel; },
    build,
    get ready() { return readyPromise; },
    update,
    // Fuer Messungen von aussen (siehe test/mobile.html): Zustand an einer Scrub-Position,
    // ohne wirklich dorthin zu scrollen.
    stateAt: (s) => photoStateAt(s),
    get scrubTotal() { return TOTAL; },
    get scrubPx() { return scrubPx; },
  };
}

export function initImageBrush(cfg) {
  const els = document.querySelectorAll('[data-edding-image-brush]:not([data-edding-ready])');
  const items = [];
  els.forEach((el) => {
    el.setAttribute('data-edding-ready', '1');
    const item = createImageBrush(el, cfg);
    if (item) items.push(item);
  });
  return items;
}
