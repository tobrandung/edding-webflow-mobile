// WEBFLOW-PORT: der 3D-Stift-Slider als Webflow-Baustein.
//
// Struktur, die du im Designer baust:
//
//   <div data-edding-pen-slider="hitze">
//     <div data-pen-canvas></div>          <- Seitenverhaeltnis 990/770 (siehe unten)
//     <button data-pen-prev>…</button>
//     <button data-pen-next>…</button>
//     <div data-pen-slide>… Texte Stift 1 …</div>   <- 4x, Reihenfolge = Stift-Reihenfolge
//   </div>
//
// Drei Unterschiede zum Prototyp, alle bewusst:
//
//  1. BEDIENUNG NUR PER BUTTON (Nutzer-Entscheidung). Auf dem Desktop haengt der Slider am
//     Scrollen: die Sektion ist 2300px hoeher als der Viewport, klebt per position:sticky und
//     der Scrub kommt aus rect.top. Auf Mobile kostet das 2300px Scrollstrecke pro Slider -
//     hier schalten stattdessen zwei Buttons weiter, die Seite scrollt normal durch.
//
//  2. KEIN EINFLUG-INTRO (Nutzer-Entscheidung). Im Prototyp ist es ohnehin wirkungslos:
//     bindPenCarousel ruft setIntroProgress(introP) und direkt danach setVirtualIndex(0), was
//     die Drehung jeden Frame wieder auf die Ruhepose zurueckschreibt. Hier steht der Slider
//     nach dem Laden auf Stift 1, alles andere macht der Nutzer per Button.
//
//  3. LAZY + PAUSIERT. Das Rig wird erst gebaut, wenn die Sektion in Reichweite kommt (die vier
//     GLBs sind zusammen ~1 MB), und die Render-Loop laeuft nur, solange der Slider im Bild ist.
//     Beides gibt es im Prototyp nicht - dort laufen zwei WebGL-Loops permanent, was auf einem
//     Telefon Akku und Scroll-Framerate kostet.

import { SLIDER_PRESETS } from './presets.js';

// pen-rig.js wird DYNAMISCH geladen, nicht statisch importiert.
// Grund: pen-rig zieht three.js (249 KB) und den GLTFLoader (139 KB) mit. Bei einem statischen
// Import waeren das 388 KB beim Seitenaufruf - auch auf einer Seite, deren Slider erst mehrere
// Bildschirme weiter unten steht, und selbst auf Seiten ohne jeden Slider. Geladen wird jetzt
// zusammen mit den Stiftmodellen, wenn der erste Slider in Reichweite kommt.
let rigModulePromise = null;
function loadRigModule() {
  if (!rigModulePromise) rigModulePromise = import('./pen-rig.js');
  return rigModulePromise;
}

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

// Zahl weich hochzaehlen - uebernommen aus animateTempTo() in js/main.js (450 ms, kubisches
// Ausklingen). Nur aktiv, wenn ein [data-pen-count-up]-Element im aktiven Slide steht.
function countUpTo(el, target, duration = 450) {
  const from = Number(String(el.textContent).replace(/[^\d.-]/g, '')) || 0;
  if (from === target) { el.textContent = String(target); return; }
  // Im Hintergrundtab feuert requestAnimationFrame nicht - die Zahl wuerde auf dem alten Wert
  // stehenbleiben und beim Zurueckkommen falsch dastehen. Dann ohne Animation direkt setzen.
  if (document.hidden) { el.textContent = String(target); return; }
  const start = performance.now();
  const token = (el.__eddingToken = (el.__eddingToken || 0) + 1);
  (function tick(now) {
    if (el.__eddingToken !== token) return;
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = String(Math.round(from + (target - from) * eased));
    if (t < 1) requestAnimationFrame(tick);
  })(start);
}

function createSlider(host, cfg) {
  const presetName = host.getAttribute('data-edding-pen-slider') || 'hitze';
  const preset = SLIDER_PRESETS[presetName] || SLIDER_PRESETS.hitze;

  const canvasBox = host.querySelector('[data-pen-canvas]') || host;
  if (getComputedStyle(canvasBox).position === 'static') canvasBox.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.className = 'edding-pen__canvas';
  canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:block;';
  canvasBox.appendChild(canvas);

  const prevBtns = Array.from(host.querySelectorAll('[data-pen-prev]'));
  const nextBtns = Array.from(host.querySelectorAll('[data-pen-next]'));
  const dots = Array.from(host.querySelectorAll('[data-pen-dot]'));

  // ------------------------------------------------------------------------------------------
  // Zwei Wege, die Texte zu fuellen:
  //
  //  A) FELD-MODUS (empfohlen): du baust die Karte EINMAL und markierst die Textstellen mit
  //     data-pen-field="headline|body|temp|label". Die vier Textsaetze liegen unsichtbar in
  //     einem Container mit data-pen-data, je Stift ein data-pen-slide mit denselben
  //     Feldnamen. Das Modul schreibt beim Wechsel nur die Texte um - so wie das UI-Panel im
  //     Desktop-Prototyp (bindPenPanel).
  //
  //  B) SLIDE-MODUS: vier fertige, gestylte Bloecke mit data-pen-slide, das Modul blendet den
  //     aktiven ein. Einfacher zu verstehen, aber du pflegst das Layout viermal.
  //
  // Der Modus ergibt sich von selbst: gibt es data-pen-field ausserhalb der Datenbloecke,
  // ist es A, sonst B.
  // ------------------------------------------------------------------------------------------
  const alleSlides = Array.from(host.querySelectorAll('[data-pen-slide]'));
  const zielFelder = Array.from(host.querySelectorAll('[data-pen-field]'))
    .filter(el => !el.closest('[data-pen-slide]'));
  const feldModus = zielFelder.length > 0;

  // Im Feld-Modus sind die data-pen-slide-Bloecke reine Datenquelle und werden ausgeblendet.
  const slides = alleSlides;
  if (feldModus) {
    const datenHost = host.querySelector('[data-pen-data]');
    if (datenHost) datenHost.style.display = 'none';
    else slides.forEach(s => { s.style.display = 'none'; });
  }

  // 'inline' (Standard): das Modul setzt Opacity/Sichtbarkeit selbst - funktioniert ohne jedes
  // Styling im Designer. 'class': es setzt nur die Klasse is-active, du stylst die Combo-Klasse.
  const slidesMode = host.getAttribute('data-pen-slides-mode') || 'inline';
  const debug = flag(host, 'data-pen-debug');

  // Slides uebereinanderlegen, damit der Wechsel die Layouthoehe nicht springen laesst.
  // Nur im Slide-Modus - im Feld-Modus sind sie unsichtbare Datenbloecke.
  if (!feldModus && slidesMode === 'inline' && slides.length) {
    const wrap = slides[0].parentElement;
    if (wrap && getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
    slides.forEach((s, i) => {
      s.style.transition = 'opacity 0.25s ease';
      if (i > 0) {
        s.style.position = 'absolute';
        s.style.top = '0';
        s.style.left = '0';
        s.style.width = '100%';
      }
    });
  }

  let activeIndex = -1;

  // Feld-Modus: Texte aus dem Datenblock des aktiven Stifts in die gestylte Karte schreiben.
  // Der Wechsel laeuft ueber die Klasse is-swapping am Slider (wie .pen-panel.is-swapping im
  // Prototyp): 250 ms ausblenden, Text tauschen, wieder einblenden. Ohne eigenes CSS passiert
  // einfach nichts Sichtbares dabei - der Text wechselt dann hart.
  const SWAP_MS = num(host, 'data-pen-swap-ms', 250);
  let swapTimer = null;
  function fuelleFelder(i) {
    const quelle = slides[i];
    if (!quelle) return;
    const schreiben = () => {
      for (const ziel of zielFelder) {
        const name = ziel.getAttribute('data-pen-field');
        const von = quelle.querySelector(`[data-pen-field="${name}"]`);
        if (!von) continue;
        const text = von.textContent.trim();
        if (ziel.hasAttribute('data-pen-count-up')) {
          const zahl = Number(text.replace(/[^\d.-]/g, ''));
          if (Number.isFinite(zahl)) { countUpTo(ziel, zahl); continue; }
        }
        ziel.textContent = text;
      }
      host.classList.remove('is-swapping');
    };
    if (activeIndex < 0 || SWAP_MS <= 0) { schreiben(); return; }
    host.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(schreiben, SWAP_MS);
  }

  function showSlide(i) {
    if (i === activeIndex) return;
    if (feldModus) {
      fuelleFelder(i);
      activeIndex = i;
    } else {
      activeIndex = i;
      slides.forEach((s, k) => {
        const on = k === i;
        s.classList.toggle('is-active', on);
        if (slidesMode === 'inline') {
          s.style.opacity = on ? '1' : '0';
          s.style.pointerEvents = on ? '' : 'none';
          s.style.visibility = on ? '' : 'hidden';
        }
        if (on) {
          const counter = s.querySelector('[data-pen-count-up]');
          if (counter) countUpTo(counter, num(counter, 'data-pen-count-up', 0));
        }
      });
    }
    dots.forEach((d, k) => {
      d.classList.toggle('is-active', k === i);
      d.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    updateButtons();
  }

  let rig = null;
  let pensCount = slides.length || 4;
  // Sichtbarkeit wird unabhaengig vom Rig mitgefuehrt: das Rig entsteht lazy, und wenn der
  // Slider zu diesem Zeitpunkt SCHON im Bild ist, feuert der Observer danach nicht mehr -
  // setRunning(true) wuerde also nie kommen. Deshalb wird der Zustand beim Bauen nachgezogen.
  let inView = false;

  // Kein Endlos-Loop: die vier Stifte sitzen auf einem 76-Grad-Bogen (STEP_DEG 25.4 x 3), nicht
  // auf einem vollen Kreis. Ein Sprung von Stift 4 zurueck auf 1 wuerde sichtbar zurueckrotieren.
  // Stattdessen werden die Buttons an den Enden als deaktiviert markiert.
  function updateButtons() {
    const atStart = activeIndex <= 0;
    const atEnd = activeIndex >= pensCount - 1;
    prevBtns.forEach((b) => {
      b.classList.toggle('is-disabled', atStart);
      b.setAttribute('aria-disabled', atStart ? 'true' : 'false');
    });
    nextBtns.forEach((b) => {
      b.classList.toggle('is-disabled', atEnd);
      b.setAttribute('aria-disabled', atEnd ? 'true' : 'false');
    });
  }

  // Weil das Rig-Modul erst geladen werden muss, ist build() asynchron. buildPromise haelt den
  // laufenden Aufbau fest, damit mehrere Klicks nicht zwei Rigs erzeugen.
  let buildPromise = null;
  function build() {
    if (rig) return Promise.resolve(rig);
    if (buildPromise) return buildPromise;
    buildPromise = loadRigModule().then(({ createPenRig, CAMERA_UPPER, CAMERA_LOWER }) => {
      const CAMERAS = { upper: CAMERA_UPPER, lower: CAMERA_LOWER };
      rig = createPenRig(canvas, {
        ...preset,
        camera: CAMERAS[preset.camera] || CAMERA_UPPER,
        assetBase: cfg.assetBase,
        fovScale: num(host, 'data-pen-fov', 1),
        shiftX: num(host, 'data-pen-shift-x', 0),
        shiftY: num(host, 'data-pen-shift-y', 0),
        onIndexChange: (i) => showSlide(i),
      });
      rig.setRunning(inView && !document.hidden);
      return rig.ready.then(() => {
        pensCount = rig.pensCount;
        showSlide(0);
        updateButtons();
        if (debug) {
          console.log('[edding pen-slider]', presetName, {
            canvas: canvas.clientWidth + '×' + canvas.clientHeight,
            aspect: (canvas.clientWidth / (canvas.clientHeight || 1)).toFixed(3) + ' (Referenz 1.286)',
            pensCount: rig.pensCount,
            fovScale: num(host, 'data-pen-fov', 1),
            shift: [num(host, 'data-pen-shift-x', 0), num(host, 'data-pen-shift-y', 0)],
          });
        }
        return rig;
      });
    }).catch((err) => {
      console.error('[edding] 3D-Slider konnte nicht laden:', err);
      buildPromise = null;
    });
    return buildPromise;
  }

  // Klicks warten auf das Rig ab: wird direkt nach dem Seitenaufruf geklickt, ist es vielleicht
  // noch nicht fertig geladen - dann wirkt der Klick, sobald es steht, statt ins Leere zu gehen.
  prevBtns.forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    build().then(() => rig && rig.stepPrev());
  }));
  nextBtns.forEach((b) => b.addEventListener('click', (e) => {
    e.preventDefault();
    build().then(() => rig && rig.stepNext());
  }));
  dots.forEach((d, k) => d.addEventListener('click', (e) => {
    e.preventDefault();
    build().then(() => {
      if (!rig) return;
      // Direktsprung: stepByClick tweent 700 ms, ein Mehrfachsprung wuerde sich ueberholen -
      // deshalb nur EIN Schritt in die richtige Richtung. Dots sind ohnehin optional
      // (Nutzer-Vorgabe: nur Pfeile).
      if (k > activeIndex) rig.stepNext();
      else if (k < activeIndex) rig.stepPrev();
    });
  }));

  // Lazy bauen: erst wenn die Sektion in Reichweite kommt. Ein Viewport Vorlauf, damit die
  // ~1 MB GLBs geladen sind, bevor der Slider im Bild ist.
  const buildIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      buildIO.disconnect();
      build();
    }
  }, { rootMargin: '100% 0px 100% 0px' });
  buildIO.observe(host);

  // Render-Loop nur, solange der Slider im Bild ist.
  const runIO = new IntersectionObserver((entries) => {
    for (const e of entries) {
      inView = e.isIntersecting;
      if (rig) rig.setRunning(inView && !document.hidden);
    }
  }, { rootMargin: '0px' });
  runIO.observe(canvasBox);

  // Im Hintergrundtab gar nicht rendern.
  document.addEventListener('visibilitychange', () => {
    if (rig) rig.setRunning(inView && !document.hidden);
  });

  showSlide(0);

  return {
    host,
    get rig() { return rig; },
    get index() { return activeIndex; },
    build,
    next: () => build().then(() => rig && rig.stepNext()),
    prev: () => build().then(() => rig && rig.stepPrev()),
    destroy() {
      buildIO.disconnect();
      runIO.disconnect();
      if (rig) rig.destroy();
      rig = null;
    },
  };
}

export function initPenSliders(cfg) {
  const els = document.querySelectorAll('[data-edding-pen-slider]:not([data-edding-ready])');
  const items = [];
  els.forEach((el) => {
    el.setAttribute('data-edding-ready', '1');
    items.push(createSlider(el, cfg));
  });
  return items;
}
