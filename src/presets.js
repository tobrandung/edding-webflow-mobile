// WEBFLOW-PORT: die Rezepte. Alle Zahlen sind 1:1 aus js/main.js des Prototyps uebernommen -
// hier stehen sie nur unter einem Namen, damit im Designer `data-edding-stroke="hitze"` genuegt.
//
// Neu gegenueber dem Prototyp ist einzig `refBox`. Warum das der wichtigste Wert des Ports ist:
//
//   Die Strichbreite kommt in der Engine ABSOLUT aus dem Stift (BRUSHES[brushId] x
//   widthMultiplier, in CSS-Pixeln) und skaliert NICHT mit der Groesse der Box. Derselbe Strich,
//   der auf dem Desktop in einer 1550px breiten Box liegt, wirkt in einer 390px-Box viermal so
//   fett. Ohne Korrektur sehen alle Striche auf Mobile aus wie mit einem Riesenmarker gemalt.
//
//   refBox ist die Groesse der Box, in der der Prototyp-Wert richtig aussah (gemessen aus
//   style.css). Daraus rechnet edding-strokes.js den Faktor: wie stark wird der Pfad in DEINE
//   Box eingepasst, verglichen mit der Referenz - und skaliert widthMultiplier genauso mit.
//   Die Rechnung nutzt dieselbe Formel wie Brush.fitSubpaths (min(Breite, Hoehe) x 0.88), damit
//   sie auch dann stimmt, wenn du das Seitenverhaeltnis der Box aenderst.
//
// `path` ist die viewBox der Zeichnung (Naeherung fuer ihre Bounding-Box - bei diesen Exporten
// deckungsgleich). `mode` unterscheidet die zwei Zeichenarten von StrokeChapter:
//   'progress' = malt nur vorwaerts (renderProgress)
//   'trim'     = malt vorne und radiert hinten weg (renderTrim), Parameter unter `trim`
//
// Die trim-Werte sind ANTEILE (0..1) des Scroll-Fensters, umgerechnet aus den absoluten
// Pixelstrecken des Prototyps: span = freezeY - startY, dann jeder Wert / span. Beispiel
// Kapitel 3: span 784, headRange 900 -> head 1.148. Dass head groesser als 1 ist, ist kein
// Fehler - der Kopf erreicht auf dem Desktop nur 0.87, deshalb bleibt am Ende rechts das
// Reststueck stehen.

import * as PATHS from './paths.js';

// Der Stift, den alle Kapitel-Striche teilen (main.js: revealOpts von Kapitel 1-4).
const CHISEL_45 = {
  brushId: 'chisel-bold',
  tipAngleDeg: 45,
  widthMultiplier: 3.6,
  grungeAmt: 0.3,
  grainSizePx: 10,
  dynamic: true,
  maskStrength: 0.7,
  maskContrast: 0.95,
  texture: 'grain',      // -> assets/grain.jpg, siehe TEXTURES unten
};

// Dateiname je Texturschluessel, relativ zur assetBase.
export const TEXTURES = {
  grain: 'grain.jpg',            // aus texture2.png, 1024er Ausschnitt (Koernung unveraendert)
  grain2048: 'grain-2048.jpg',   // groesserer Ausschnitt fuer Tablet/Desktop-Breiten
  rough: 'grain-rough.jpg',      // aus texture_rough.jpg, NUR Kapitel 5
};

export const STROKE_PRESETS = {
  // ---------- Kapitel 1: "edding haelt Hitze aus" ----------
  hitze: {
    ...CHISEL_45,
    svgText: PATHS.pfad_01,
    color: '#fa0000',
    marginX: 0.08,
    marginY: 0.03,
    mode: 'progress',
    path: { w: 699, h: 685 },
    // .stroke-reveal__art: width 1550px, aspect-ratio 560/330
    refBox: { w: 1550, h: 913.4 },
  },

  // ---------- Kapitel 2: "und laesst kein Wasser an sich ran" ----------
  wasser: {
    ...CHISEL_45,
    svgText: PATHS.pfad_02,
    color: '#00368e',
    marginX: 0.08,
    marginY: 0.03,
    mode: 'progress',
    path: { w: 1338, h: 587 },
    // .stroke-reveal__art--water: width 1338px, aspect-ratio 1338/587
    refBox: { w: 1338, h: 587 },
  },

  // ---------- Kapitel 3: Permanent (Trim, Reststueck bleibt stehen) ----------
  permanent: {
    ...CHISEL_45,
    svgText: PATHS.tightcurve02,
    color: '#ffcf00',
    marginX: 0.04,
    marginY: 0.1,
    mode: 'trim',
    // main.js TRIM_HEAT: startY 1905, headRange 900, tailDelay 400, tailRange 550,
    // tailMax 0.85, freezeY 2689  ->  span 784
    trim: { head: 1.148, tailStart: 0.510, tailRange: 0.702, tailMax: 0.85 },
    path: { w: 2949, h: 833 },
    // .stroke-reveal__art--permanent: width 2949 * 1.26, height fest 1400px
    refBox: { w: 3715.7, h: 1400 },
  },

  // ---------- Kapitel 4: Non-Permanent (Trim, wird komplett wegradiert) ----------
  nonpermanent: {
    ...CHISEL_45,
    svgText: PATHS.gerade_reversed, // Pfad startet RECHTS -> Linie kommt von rechts herein
    color: '#ffcf00',
    marginX: 0.0,
    marginY: 0.45, // flache Linie -> viel vertikaler Rand, damit sie mittig-schmal sitzt
    mode: 'trim',
    // main.js TRIM_NONPERM: startY 2900, headRange 250, tailDelay 150, tailRange 350,
    // tailMax 1.0, freezeY 3400  ->  span 500
    trim: { head: 0.5, tailStart: 0.3, tailRange: 0.7, tailMax: 1.0 },
    path: { w: 3140, h: 2 },
    // .stroke-reveal__art--nonpermanent: width 2400px, height 300px
    refBox: { w: 2400, h: 300 },
  },

  // ---------- Kapitel 5: verschmutzte Oberflaechen (Kritzelmuster) ----------
  dirty: {
    svgText: PATHS.pattern03,
    brushId: 'chisel-bold',
    tipAngleDeg: 36,
    widthMultiplier: 2.33,
    grungeAmt: 0.75,
    grainSizePx: 11,
    dynamic: true,
    color: '#1a1a1a',
    texture: 'rough',       // einziges Kapitel mit der zweiten Textur
    maskStrength: 1.0,
    maskContrast: 2.0,
    reverse: true,          // Prototyp-Kommentar: "wirkt bisher nicht wie gewuenscht" - so gelassen
    mode: 'trim',
    // main.js TRIM_DIRTY: startY 3400, headRange 340, tailDelay 255, tailRange 425,
    // tailMax 1.0, freezeY 4080  ->  span 680
    trim: { head: 0.5, tailStart: 0.375, tailRange: 0.625, tailMax: 1.0 },
    path: { w: 972, h: 265 },
    // .stroke-reveal__art--dirty: width 2160px, aspect-ratio 972/265.
    // Im Prototyp liegt die Flaeche zusaetzlich auf opacity 0.3 - das ist CSS, also deine Box.
    refBox: { w: 2160, h: 588.9 },
  },

  // ---------- Kapitel 7: der rote Marker-Kreis um "Darum" ----------
  darum: {
    svgText: PATHS.circle,
    brushId: 'chisel-bold',
    tipAngleDeg: 36,
    widthMultiplier: 1.84,
    grungeAmt: 0.11,
    grainSizePx: 4,
    dynamic: true,
    color: '#fa0000',
    texture: 'grain',
    maskStrength: 0.27,
    maskContrast: 2.0,
    marginX: 0.02,
    marginY: 0.03,
    mode: 'progress',
    path: { w: 875, h: 651 },
    // .darum__stage: min(760px, ...), aspect-ratio 875/651
    refBox: { w: 760, h: 565.4 },
  },
};

// Empfohlenes Seitenverhaeltnis der Box je Preset, als fertiger CSS-Wert fuer den Designer.
// Das ist das Verhaeltnis der REFERENZBOX, nicht der Zeichnung: nur damit sitzt der Strich
// relativ zur Box genauso wie auf dem Desktop. Bei der Zeichnungs-Proportion wuerde der Strich
// die Box fuellen - auch legitim, sieht aber anders aus als der Prototyp.
export const STROKE_ASPECT = Object.fromEntries(
  Object.entries(STROKE_PRESETS).map(([k, p]) => [k, `${p.refBox.w} / ${p.refBox.h}`])
);

// ---------------------------------------------------------------------------------------------
// Die zwei 3D-Slider. Werte aus js/main.js, bindCarouselChapter-Aufrufe in init().
// Beide nutzen DIESELBEN vier GLBs (PENS_UPPER) - der Unterschied ist nur die Kamera und die
// Drehrichtung. PENS_LOWER aus pen-rig.js wird im Prototyp nie benutzt.
// ---------------------------------------------------------------------------------------------
export const SLIDER_PRESETS = {
  // Oberes Karussell: alles Standardwerte des Rigs.
  hitze: {},

  // Unteres Karussell: untere Kamera, andere Seite des Kreises, gespiegelte Kappen-Reihenfolge.
  wasser: {
    camera: 'lower',
    baseRotationDeg: 185,
    penRollDeg: -113,
    rotationSign: -1,
    reverseCaps: true,
  },
};

// Die Canvas-Proportion, fuer die die Kamera eingerichtet ist (.pen-carousel: 990 x 770).
// Weicht deine Box davon ab, verschiebt sich der Bildausschnitt - dafuer gibt es
// data-pen-fov und data-pen-shift-x/-y.
export const SLIDER_ASPECT = '990 / 770';

// ---------------------------------------------------------------------------------------------
// Kapitel 6: Pinselstrich als Alpha-Maske ueber vier Fotos.
// Werte aus bindDirtyCarousel() in js/main.js.
// ---------------------------------------------------------------------------------------------
export const IMAGE_BRUSH_PRESET = {
  svgText: PATHS.pinselstrich,
  brushId: 'chisel-bold',
  tipAngleDeg: 36,
  widthMultiplier: 5,
  grungeAmt: 0.11,
  grainSizePx: 4,
  dynamic: true,
  vOffset: 0,
  // Keine Textur: der Strich wird hier als reine Alpha-Maske benutzt, nicht als sichtbare Tinte.
  path: { w: 1300, h: 348 },
  // .dirty-carousel__stage: width 1280px, aspect-ratio 1280/677 (= native Bildgroesse).
  // DirtyCarousel skaliert den Pfad auf die CANVAS-BREITE (nicht eingepasst wie StrokeChapter),
  // deshalb ist hier allein die Breite die Referenz.
  refBox: { w: 1280, h: 677 },
  // Choreografie in Scroll-Pixeln, aus DIRTY_CAR_*: 4 Bilder x 200px Standzeit
  // + 3 Uebergaenge x 300px = 1700px Scrub, davor 360px zum Freimalen des Strichs.
  holdPx: 200,
  xfadePx: 300,
  revealPx: 360,
  // Wort-Karussell: Wort faehrt 150px hoch / kommt von unten, synchron zum Bildwechsel.
  wordShiftPx: 150,
  images: ['staubig.jpg', 'oelig.jpg', 'rostig.jpg', 'nass.jpg'],
};

export const IMAGE_BRUSH_ASPECT = '1280 / 677';
