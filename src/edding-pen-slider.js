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

  // ------------------------------------------------------------------------------------------
  // SUCHBEREICH.
  // Standardmaessig sucht das Modul Felder, Buttons und Datensaetze INNERHALB des Elements mit
  // data-edding-pen-slider. In einer typischen Webflow-Struktur liegt die Textkarte aber als
  // GESCHWISTER neben dem Slider-Block, nicht darin:
  //
  //   padding-bottom
  //   ├── karte            (data-pen-field-Attribute)
  //   └── slider-block     (data-edding-pen-slider + data-pen-canvas)
  //
  // Dann waere der Suchbereich zu eng und es wuerde kein einziges Feld gefunden. Statt das
  // Verschieben im Designer zu verlangen, sucht das Modul selbst nach oben: Elternteil um
  // Elternteil, bis eines gefunden ist, das data-pen-field enthaelt UND nur EINEN Slider - so
  // kann es nicht versehentlich die Karte eines zweiten Sliders auf derselben Seite erwischen.
  //
  // data-pen-target="<CSS-Selektor>" setzt den Bereich ausdruecklich und gewinnt immer.
  // ------------------------------------------------------------------------------------------
  function findeSuchbereich() {
    const ziel = host.getAttribute('data-pen-target');
    if (ziel) {
      const el = host.closest(ziel) || document.querySelector(ziel);
      if (el) return el;
      console.warn('[edding] data-pen-target findet kein Element:', ziel);
    }
    if (host.querySelector('[data-pen-field], [data-pen-slide]')) return host;

    let el = host.parentElement;
    for (let tiefe = 0; el && el !== document.body && tiefe < 8; tiefe++, el = el.parentElement) {
      if (!el.querySelector('[data-pen-field], [data-pen-slide]')) continue;
      if (el.querySelectorAll('[data-edding-pen-slider]').length > 1) {
        console.warn('[edding] Die Textfelder liegen ausserhalb des Sliders, und der naechste'
          + ' gemeinsame Elternteil enthaelt mehrere Slider. Bitte data-pen-target setzen.');
        return host;
      }
      return el;
    }
    return host;
  }
  const scope = findeSuchbereich();

  const canvasBox = host.querySelector('[data-pen-canvas]')
    || scope.querySelector('[data-pen-canvas]') || host;
  if (getComputedStyle(canvasBox).position === 'static') canvasBox.style.position = 'relative';
  const canvas = document.createElement('canvas');
  canvas.className = 'edding-pen__canvas';
  canvas.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; display:block;';
  canvasBox.appendChild(canvas);

  // Buttons zuerst im Slider selbst, sonst im erweiterten Bereich - so bleiben bestehende
  // Aufbauten unveraendert, und Buttons neben dem Slider funktionieren trotzdem.
  const suche = (sel) => {
    const imHost = Array.from(host.querySelectorAll(sel));
    return imHost.length ? imHost : Array.from(scope.querySelectorAll(sel));
  };
  const prevBtns = suche('[data-pen-prev]');
  const nextBtns = suche('[data-pen-next]');
  const dots = suche('[data-pen-dot]');

  // ------------------------------------------------------------------------------------------
  // FELD-MODUS: du baust die Karte EINMAL und markierst die Textstellen mit
  // data-pen-field="<name>". Das Modul schreibt beim Umschalten nur die Texte um - so wie das
  // UI-Panel im Desktop-Prototyp (bindPenPanel).
  //
  // Woher die vier Texte kommen, darf jedes Feld selbst entscheiden. Gesucht wird in dieser
  // Reihenfolge, der erste Treffer gewinnt:
  //
  //   1. data-pen-1 … data-pen-4 AM FELD SELBST  (am wenigsten Klickarbeit: keine zusaetzlichen
  //      Elemente, kein Datenblock - die vier Fassungen haengen direkt an der Headline, am
  //      Fliesstext usw.)
  //   2. ein Kind mit demselben data-pen-field in einem data-pen-slide-Block
  //   3. ein Attribut data-pen-<name> am data-pen-slide-Block
  //
  // Fuer Stift 1 gilt zusaetzlich: findet sich nichts, bleibt der Text stehen, der schon im
  // Designer eingetippt ist. Man muss data-pen-1 also nur setzen, wenn es abweichen soll.
  //
  // Gibt es KEIN data-pen-field, faellt das Modul auf den alten Weg zurueck: vier fertig
  // gestylte data-pen-slide-Bloecke, von denen der aktive eingeblendet wird.
  // ------------------------------------------------------------------------------------------
  const alleSlides = Array.from(scope.querySelectorAll('[data-pen-slide]'));
  const zielFelder = Array.from(scope.querySelectorAll('[data-pen-field]'))
    .filter(el => !el.closest('[data-pen-slide]'));
  const feldModus = zielFelder.length > 0;

  // Startwerte sichern, damit Stift 1 auf den im Designer eingetippten Text zurueckfallen kann.
  const startTexte = new Map(zielFelder.map(el => [el, el.textContent.trim()]));

  // Im Feld-Modus sind die data-pen-slide-Bloecke reine Datenquelle und werden ausgeblendet.
  const slides = alleSlides;
  if (feldModus) {
    const datenHost = scope.querySelector('[data-pen-data]');
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

  // Feld-Modus: Text fuer Stift i und Feldname holen. Reihenfolge der Quellen siehe oben.
  // Gibt null zurueck, wenn es fuer dieses Feld keinen Wert gibt - dann bleibt der Text stehen,
  // statt leer zu werden (wichtig, wenn nur ein Teil der Felder ueber alle Stifte wechselt).
  function textFuer(ziel, name, i) {
    // 1. data-pen-1 … data-pen-4 am Feld selbst
    const direkt = ziel.getAttribute('data-pen-' + (i + 1));
    if (direkt !== null) return direkt.trim();

    const quelle = slides[i];
    if (quelle) {
      // 2. Kind mit demselben Feldnamen im Datenblock
      const von = quelle.querySelector(`[data-pen-field="${name}"]`);
      if (von) return von.textContent.trim();
      // 3. Attribut data-pen-<name> am Datenblock
      const attr = quelle.getAttribute('data-pen-' + name);
      if (attr !== null) return attr.trim();
    }

    // 4. Stift 1 ohne eigenen Wert: der im Designer eingetippte Text
    if (i === 0 && startTexte.has(ziel)) return startTexte.get(ziel);
    return null;
  }

  // ------------------------------------------------------------------------------------------
  // MASKEN-WECHSEL.
  // Der Text faehrt hinter einer unsichtbaren Kante nach UNTEN aus dem Bild, dort wird der Text
  // getauscht, dann faehrt er von unten wieder herauf. Weil beides dieselbe Bewegung in zwei
  // Richtungen ist, genuegt EINE Transform - kein Klonen von Elementen, keine Animationslib.
  //
  // Aufbau: der Text bekommt einen inneren <span>, der bewegt wird; das Feld selbst wird die
  // Maske. Zwei Feinheiten, die sonst auffallen wuerden:
  //
  //  - Maskiert wird per clip-path, NICHT per overflow:hidden. Beides wuerde Unterlaengen
  //    abschneiden (g, j, p); mit clip-path: inset(-0.18em 0) laesst sich der Maskenbereich
  //    aber nach oben und unten etwas ueber den Kasten hinaus erweitern - und zwar OHNE das
  //    Layout anzufassen. Der erste Versuch dafuer war padding-block plus negatives
  //    margin-block, und der war falsch: marginBlock ueberschreibt die im Designer gesetzten
  //    Abstaende (nachgemessen 2,34 px Versatz beim Fliesstext).
  //  - Die Felder starten zeitlich versetzt (Staffelung), sonst wirkt der Wechsel wie ein Block.
  //
  // Kein GSAP: die Bewegung ist eine einzige CSS-Transition auf translateY. Eine
  // Animationsbibliothek waere hier ~70 KB fuer zwei Zeilen.
  // ------------------------------------------------------------------------------------------
  const ANIM = (host.getAttribute('data-pen-anim') || 'mask').toLowerCase();
  const OUT_MS = num(host, 'data-pen-anim-out', 260);
  const IN_MS = num(host, 'data-pen-anim-in', 420);
  // Standard 0: alle Felder starten gleichzeitig (Nutzer-Vorgabe - die Staffelung wirkte wie eine
  // Verzoegerung). Ein Wert > 0 setzt sie wieder ein.
  const STAGGER_MS = num(host, 'data-pen-anim-stagger', 0);
  const FADE = flag(host, 'data-pen-anim-fade');
  // Richtung des Austritts: 'down' (Standard, wie besprochen) oder 'up' fuer eine durchlaufende
  // Rolle nach oben.
  const RAUS_RUNTER = (host.getAttribute('data-pen-anim-dir') || 'down') !== 'up';

  const EASE_OUT = 'cubic-bezier(0.55, 0, 0.55, 0.2)'; // zieht zum Ende hin an
  const EASE_IN = 'cubic-bezier(0.16, 1, 0.3, 1)';     // kommt weich zum Stehen

  const innere = new Map(); // Feld -> innerer span

  // Nicht jedes Feld will maskiert werden (Nutzer-Vorgabe):
  //  - Eine hochzaehlende Zahl hat schon ihre eigene Bewegung. Sie zusaetzlich hinter eine Maske
  //    zu schieben heisst, dass man den Anfang des Zaehlens nicht sieht.
  //  - Kurze Labels wirken beim Wandern eher unruhig als weich. Dafuer gibt es data-pen-no-anim
  //    zum Abwaehlen am einzelnen Feld.
  // Solche Felder bekommen keinen inneren Span und werden dadurch weiter unten automatisch
  // sofort und ohne Verzoegerung geschrieben - der Zweig "kein span" existiert schon.
  function willMaske(ziel) {
    if (ziel.hasAttribute('data-pen-no-anim')) return false;
    if (ziel.hasAttribute('data-pen-count-up')) return false;
    return true;
  }

  function baueMasken() {
    if (ANIM !== 'mask') return;
    for (const ziel of zielFelder) {
      if (!willMaske(ziel)) continue;
      const span = document.createElement('span');
      span.className = 'edding-pen__inner';
      span.style.cssText = 'display:block; will-change:transform;';
      while (ziel.firstChild) span.appendChild(ziel.firstChild);
      ziel.appendChild(span);
      // Ein inline-Element hat keinen eigenen Kasten, an dem sich zuverlaessig maskieren
      // laesst (z.B. die Zahl im Thermometer als <span>). Auf inline-block heben ist die
      // kleinste Aenderung, die eine Maske ueberhaupt moeglich macht.
      if (getComputedStyle(ziel).display === 'inline') ziel.style.display = 'inline-block';
      // Die Maske. Der negative Wert oben/unten laesst Unterlaengen stehen, ohne das Layout
      // anzufassen - siehe die Begruendung im Kopf dieses Abschnitts.
      ziel.style.clipPath = 'inset(-0.18em 0px)';
      innere.set(ziel, span);
    }
  }
  baueMasken();

  // Bei "Bewegung reduzieren" im Betriebssystem gar nicht animieren.
  const wenigerBewegung = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const timers = [];
  function schreibeFeld(ziel, i) {
    const name = ziel.getAttribute('data-pen-field');
    const text = textFuer(ziel, name, i);
    if (text === null) return false;
    if (ziel.hasAttribute('data-pen-count-up')) {
      const zahl = Number(text.replace(/[^\d.-]/g, ''));
      if (Number.isFinite(zahl)) {
        const traeger = innere.get(ziel) || ziel;
        countUpTo(traeger, zahl);
        return true;
      }
    }
    const traeger = innere.get(ziel) || ziel;
    traeger.textContent = text;
    return true;
  }

  const SWAP_MS = num(host, 'data-pen-swap-ms', 250);
  let swapTimer = null;

  // Sicherheitsnetz: die Maskenbewegung laeuft ueber verschachtelte setTimeout. Wechselt der
  // Nutzer mitten im Uebergang den Tab, drosselt der Browser die Timer auf etwa einen pro
  // Sekunde (nachgemessen: 7 Timer in 12,6 s) - der Text bliebe hinter der Maske geparkt und die
  // Karte waere leer. Deshalb: im Hintergrund gar nicht animieren, und beim Zurueckkommen alles
  // hart auf die Endposition setzen.
  function schnappAufEndposition() {
    for (const span of innere.values()) {
      span.style.transition = 'none';
      span.style.transform = 'translateY(0)';
      span.style.opacity = '1';
    }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) schnappAufEndposition();
  });

  function fuelleFelder(i) {
    // Erster Aufruf, "Bewegung reduzieren" und Hintergrundtab: ohne Animation setzen.
    if (activeIndex < 0 || wenigerBewegung || ANIM === 'none' || !innere.size || document.hidden) {
      if (document.hidden) schnappAufEndposition();
      timers.forEach(clearTimeout); timers.length = 0;
      if (ANIM === 'none' && activeIndex >= 0 && SWAP_MS > 0) {
        // Alter Weg: nur die Klasse setzen, das Aussehen macht dein CSS.
        scope.classList.add('is-swapping');
        clearTimeout(swapTimer);
        swapTimer = setTimeout(() => {
          zielFelder.forEach(z => schreibeFeld(z, i));
          scope.classList.remove('is-swapping');
        }, SWAP_MS);
        return;
      }
      zielFelder.forEach(z => schreibeFeld(z, i));
      return;
    }

    timers.forEach(clearTimeout);
    timers.length = 0;

    // Nur maskierte Felder werden gestaffelt gezaehlt - haetten die uebersprungenen einen Platz
    // in der Reihe, entstuende eine Luecke im Rhythmus.
    let stufe = 0;
    zielFelder.forEach(ziel => {
      const span = innere.get(ziel);
      if (!span) { schreibeFeld(ziel, i); return; }
      const verzug = stufe++ * STAGGER_MS;
      const weg = RAUS_RUNTER ? '100%' : '-100%';

      timers.push(setTimeout(() => {
        // 1. hinaus
        span.style.transition = `transform ${OUT_MS}ms ${EASE_OUT}`
          + (FADE ? `, opacity ${OUT_MS}ms linear` : '');
        span.style.transform = `translateY(${weg})`;
        if (FADE) span.style.opacity = '0';

        timers.push(setTimeout(() => {
          // 2. Text tauschen, waehrend er ausserhalb der Maske steht
          if (!schreibeFeld(ziel, i)) {
            // Kein Wert fuer dieses Feld: einfach wieder hereinfahren
          }
          // 3. herein - ohne Transition auf die Startseite setzen, dann animieren
          span.style.transition = 'none';
          span.style.transform = `translateY(${weg})`;
          // Reflow erzwingen, sonst fasst der Browser Sprung und Animation zusammen
          void span.offsetHeight;
          span.style.transition = `transform ${IN_MS}ms ${EASE_IN}`
            + (FADE ? `, opacity ${IN_MS}ms linear` : '');
          span.style.transform = 'translateY(0)';
          if (FADE) span.style.opacity = '1';
        }, OUT_MS));
      }, verzug));
    });
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

  // ------------------------------------------------------------------------------------------
  // Stift-Nummer ist NICHT gleich Slider-Stellung (Preset "wasser").
  //
  // Das Rig meldet immer den Stift, der vorne steht - beim Preset "wasser" laufen die Stifte
  // aber rueckwaerts durch (reverseCaps, gemessen: Stellung 1..4 meldet 3, 2, 1, 0; Kappe offen
  // und naechster zur Kamera stimmen damit ueberein). Fuer die TEXTE ist das richtig so, die
  // gehoeren zum Stift. Fuer alles, was von "erster/letzter" abhaengt, ist es falsch: die
  // Endpunkte lagen dadurch auf den verkehrten Buttons (Nutzer-Meldung: "disabled state ist
  // falsch rum").
  //
  // stellungVon() rechnet die Stift-Nummer in die Slider-Stellung um. Ohne reverseCaps ist das
  // die Identitaet, "hitze" bleibt also unberuehrt.
  const umgekehrt = !!preset.reverseCaps;
  const stellungVon = (i) => (umgekehrt ? pensCount - 1 - i : i);
  // Welcher Stift steht auf Slider-Stellung 1 vorne? Ohne reverseCaps der erste, mit reverseCaps
  // der letzte. NICHT einfach 0 - genau das war der Fehler: showSlide(0) schrieb bei "wasser" den
  // Text von Stift 1 in die Karte, waehrend das Rig sichtbar Stift 4 nach vorne gedreht hatte.
  const startStift = () => (umgekehrt ? pensCount - 1 : 0);
  // ------------------------------------------------------------------------------------------

  // Kein Endlos-Loop: die vier Stifte sitzen auf einem 76-Grad-Bogen (STEP_DEG 25.4 x 3), nicht
  // auf einem vollen Kreis. Ein Sprung von Stift 4 zurueck auf 1 wuerde sichtbar zurueckrotieren.
  // Stattdessen werden die Buttons an den Enden als deaktiviert markiert.
  function updateButtons() {
    const stellung = stellungVon(activeIndex);
    const atStart = stellung <= 0;
    const atEnd = stellung >= pensCount - 1;
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
        showSlide(startStift());
        updateButtons();
        if (debug) {
          console.log('[edding pen-slider]', presetName, {
            canvas: canvas.clientWidth + '×' + canvas.clientHeight,
            aspect: (canvas.clientWidth / (canvas.clientHeight || 1)).toFixed(3) + ' (Referenz 1.286)',
            pensCount: rig.pensCount,
            fovScale: num(host, 'data-pen-fov', 1),
            shift: [num(host, 'data-pen-shift-x', 0), num(host, 'data-pen-shift-y', 0)],
            // Steht hier 0 Felder, findet das Modul die Textkarte nicht - dann data-pen-target
            // auf ein Element setzen, das Karte UND Slider umschliesst.
            felderGefunden: zielFelder.length,
            suchbereich: scope === host ? 'der Slider selbst'
              : (scope.className || scope.tagName) + ' (Elternteil, automatisch gefunden)',
            modus: feldModus ? 'Feld-Modus' : 'Slide-Modus',
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
      // In Slider-Stellungen vergleichen, nicht in Stift-Nummern - bei "wasser" laufen die
      // Nummern rueckwaerts, ein Vergleich der Nummern schickte den Slider in die falsche
      // Richtung gegen den Anschlag (und damit ins Nichts).
      const ziel = stellungVon(k), jetzt = stellungVon(activeIndex);
      if (ziel > jetzt) rig.stepNext();
      else if (ziel < jetzt) rig.stepPrev();
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

  // Startzustand sofort setzen, nicht erst wenn das Rig fertig ist (Nutzer-Meldung: "das springt
  // um wenn ich hinscrolle"). Das Rig entsteht lazy - bis dahin stand in der Karte der im
  // Designer eingetippte Text, und in dem Moment, in dem das Rig fertig war, wurde er
  // ausgetauscht. Sichtbar, weil das genau beim Heranscrollen passiert.
  showSlide(startStift());

  return {
    host,
    get rig() { return rig; },
    get index() { return activeIndex; },
    // Slider-Stellung (1-basiert, wie der Nutzer klickt) - bei "wasser" nicht gleich der
    // Stift-Nummer, siehe stellungVon().
    get position() { return stellungVon(activeIndex) + 1; },
    get reversed() { return umgekehrt; },
    get pensCount() { return pensCount; },
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
