// Brush-Engine — extrahiert aus Edding_drawing_canvas/index.html.
// Reine Geometrie-/Zeichenfunktionen, unveraendert gegenueber dem Canvas-Prototyp.
// Einziger struktureller Unterschied zum Original: animateSubpath() (dort
// requestAnimationFrame-Zeitschleife) existiert hier nicht - Fortschritt kommt
// von aussen (Scroll) statt von performance.now(), siehe stroke-chapter.js.

export const SEAM_OVERLAP = 3;
export const GRUNGE_WIDTH_SCALE = 0.4;
export const GRUNGE_WOBBLE_SCALE = 1.5;
export const GRUNGE_ALPHA_MAX_DIP = 0.4;

export const BRUSHES = {
  'chisel-bold': { id: 'chisel-bold', label: 'Keilspitze Breit', minWidth: 4, maxWidth: 22, grungeBase: 0.4, wobble: 0.6, taper: true },
  'chisel-fine': { id: 'chisel-fine', label: 'Keilspitze Fein', minWidth: 2, maxWidth: 10, grungeBase: 0.35, wobble: 0.4, taper: true },
  'brush-tip': { id: 'brush-tip', label: 'Pinselspitze', minWidth: 3, maxWidth: 16, grungeBase: 0.65, wobble: 1.4, taper: true },
  'fine-liner': { id: 'fine-liner', label: 'Feinschreiber', minWidth: 2.2, maxWidth: 3.4, grungeBase: 0.15, wobble: 0.15, taper: false },
  'chalk': { id: 'chalk', label: 'Kreidemarker', minWidth: 3, maxWidth: 14, grungeBase: 0.95, wobble: 1.8, taper: true },
  'round': { id: 'round', label: 'Rundspitze', minWidth: 5, maxWidth: 5, grungeBase: 0.3, wobble: 0.4, taper: true },
};

export function scaleBrush(brush, widthMultiplier) {
  return { ...brush, minWidth: brush.minWidth * widthMultiplier, maxWidth: brush.maxWidth * widthMultiplier };
}

// ------------------------------- SVG-Pfad-Parsing -------------------------------

export function parseSVGText(text) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  const svgEl = doc.documentElement;
  if (svgEl.nodeName === 'parsererror' || !svgEl) return { subpaths: [], bbox: null };

  // Muss im DOM angehaengt sein, damit getTotalLength()/getBBox() zuverlaessig funktionieren.
  const host = document.createElement('div');
  host.style.position = 'absolute';
  host.style.visibility = 'hidden';
  host.style.width = '0'; host.style.height = '0'; host.style.overflow = 'hidden';
  document.body.appendChild(host);
  host.appendChild(svgEl);

  const geomEls = svgEl.querySelectorAll('path, line, polyline, polygon, rect, circle, ellipse');
  const subpaths = [];
  let bbox = null;

  geomEls.forEach(el => {
    if (typeof el.getTotalLength !== 'function') return;
    let total;
    try { total = el.getTotalLength(); } catch (e) { return; }
    if (!total || total < 1) return;

    const step = Math.max(2, total / 500);
    const n = Math.max(2, Math.ceil(total / step));
    const points = [];
    for (let i = 0; i <= n; i++) {
      const s = (i / n) * total;
      const p = el.getPointAtLength(s);
      points.push({ x: p.x, y: p.y, s });
    }
    subpaths.push({ points, length: total });

    try {
      const b = el.getBBox();
      if (b.width > 0 || b.height > 0) {
        if (!bbox) bbox = { x: b.x, y: b.y, w: b.width, h: b.height };
        else {
          const x0 = Math.min(bbox.x, b.x), y0 = Math.min(bbox.y, b.y);
          const x1 = Math.max(bbox.x + bbox.w, b.x + b.width), y1 = Math.max(bbox.y + bbox.h, b.y + b.height);
          bbox = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
        }
      }
    } catch (e) { /* ignore */ }
  });

  document.body.removeChild(host);
  return { subpaths, bbox };
}

// WEBFLOW-PORT: scaleX / scaleY zum Stauchen und Strecken.
// Im Original ist die Skalierung immer gleichmaessig (ein scale fuer beide Achsen), die
// Zeichnung behaelt also zwangslaeufig ihre Proportion. Mit scaleX/scaleY laesst sie sich in
// Breite und Hoehe unabhaengig stauchen - beides 1 verhaelt sich exakt wie vorher.
//
// Zur Bogenlaenge s: sie steckt in zwei Rechnungen, die das Aussehen bestimmen -
//   computeDerived()    nimmt ds fuer die Kruemmung (und die steuert die Strichbreite),
//   buildTimeMapping()  nimmt ds fuer das Maltempo.
//
// Bei GLEICHMAESSIGER Skalierung bleibt deshalb alles beim Original: s wird einfach mitskaliert.
// Das ist wichtig - s kommt aus getPointAtLength() und ist die ECHTE Bogenlaenge, waehrend die
// Summe der Abstaende zwischen den (max. 501) Abtastpunkten die Kurven abschneidet. Nachgemessen
// liegt dieser Unterschied bei den meisten Zeichnungen unter 0,01 %, bei 03.svg (dem dichten
// Gekritzel von Kapitel 5) aber bei 4,5 % - dort wuerde ein Neuberechnen den Strich sichtbar
// breiter und langsamer machen.
//
// Nur beim STAUCHEN (scaleX != scaleY) muss neu gerechnet werden, weil die Bogenlaenge dann
// nicht mehr proportional ist. Der Faktor korr holt die Abtast-Ungenauigkeit dabei wieder
// heraus, indem er auf die echte Laenge der unverzerrten Zeichnung normiert.
export function fitSubpaths(subpaths, bbox, safeRect, scaleMultiplier = 1, scaleX = 1, scaleY = 1) {
  if (!bbox || bbox.w <= 0 || bbox.h <= 0) return subpaths;
  const base = Math.min(safeRect.w / bbox.w, safeRect.h / bbox.h) * 0.88 * scaleMultiplier;
  const sx = base * scaleX;
  const sy = base * scaleY;
  const cx = safeRect.x + safeRect.w / 2;
  const cy = safeRect.y + safeRect.h / 2;
  const bcx = bbox.x + bbox.w / 2;
  const bcy = bbox.y + bbox.h / 2;
  const gestaucht = scaleX !== 1 || scaleY !== 1;

  return subpaths.map(sp => {
    const pts = sp.points.map(p => ({
      x: (p.x - bcx) * sx + cx,
      y: (p.y - bcy) * sy + cy,
      s: gestaucht ? 0 : p.s * base,
    }));
    if (!gestaucht) return { length: sp.length * base, points: pts };

    // Normierungsfaktor aus der UNVERZERRTEN Zeichnung: echte Laenge / Polygonzug-Laenge.
    let rohPoly = 0;
    for (let i = 1; i < sp.points.length; i++) {
      rohPoly += Math.hypot(sp.points[i].x - sp.points[i - 1].x, sp.points[i].y - sp.points[i - 1].y);
    }
    const echt = sp.points[sp.points.length - 1].s;
    const korr = rohPoly > 0 && echt > 0 ? echt / rohPoly : 1;

    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      pts[i].s = acc * korr;
    }
    return { length: acc * korr || sp.length * base, points: pts };
  });
}

// ------------------------------- Geometrie -------------------------------

export function computeDerived(points) {
  const n = points.length;
  const heading = new Array(n);
  const curvature = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    heading[i] = Math.atan2(b.y - a.y, b.x - a.x);
  }
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1);
    let d = heading[i1] - heading[i0];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    const ds = Math.max(1e-3, points[i1].s - points[i0].s);
    curvature[i] = Math.abs(d / ds);
  }
  return { heading, curvature };
}

export function widthFactorFor(heading, tipAngleRad) {
  let d = heading - tipAngleRad;
  d = ((d % Math.PI) + Math.PI) % Math.PI;
  return Math.abs(Math.sin(d));
}

// ------------------------------- Grunge-Rauschen -------------------------------

export function noiseHash(i, seed) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453123;
  return x - Math.floor(x);
}

export function grungeNoise(coord, wavelengthPx, seed) {
  const t = coord / Math.max(1, wavelengthPx);
  const i0 = Math.floor(t);
  const frac = t - i0;
  const a = noiseHash(i0, seed), b = noiseHash(i0 + 1, seed);
  const smooth = frac * frac * (3 - 2 * frac);
  return (a + (b - a) * smooth) * 2 - 1;
}

export function buildStrokeGeometry(points, derived, brush, tipAngleDeg, grungeAmt, grainSizePx, seedOffset) {
  const tipRad = tipAngleDeg * Math.PI / 180;
  const n = points.length;
  const left = new Array(n), right = new Array(n), width = new Array(n);
  const skip = new Array(n).fill(false), alphaJ = new Array(n);
  const taperLen = Math.max(3, Math.floor(n * 0.04));
  const grain = grainSizePx || 14;
  const seed = seedOffset ?? Math.random() * 1000;

  for (let i = 0; i < n; i++) {
    const s = points[i].s + seed;
    const wf = widthFactorFor(derived.heading[i], tipRad);
    let w = brush.minWidth + (brush.maxWidth - brush.minWidth) * wf;

    if (brush.taper) {
      if (i < taperLen) w *= 0.35 + 0.65 * (i / taperLen);
      if (i > n - 1 - taperLen) w *= 0.35 + 0.65 * ((n - 1 - i) / taperLen);
    }

    const nWidth = grungeNoise(s, grain, 11);
    const jitter = nWidth * grungeAmt * brush.grungeBase * (brush.maxWidth - brush.minWidth) * GRUNGE_WIDTH_SCALE;
    w = Math.max(0.6, w + jitter);
    width[i] = w;

    const nx = -Math.sin(derived.heading[i]), ny = Math.cos(derived.heading[i]);
    const nWobble = grungeNoise(s, grain * 0.7, 23);
    const wobbleRaw = nWobble * grungeAmt * (brush.wobble || 0) * GRUNGE_WOBBLE_SCALE;
    const wobble = Math.max(wobbleRaw, -width[i] * 0.35);
    left[i] = { x: points[i].x + nx * (width[i] / 2 + wobble), y: points[i].y + ny * (width[i] / 2 + wobble) };
    right[i] = { x: points[i].x - nx * (width[i] / 2 + wobble * 0.6), y: points[i].y - ny * (width[i] / 2 + wobble * 0.6) };

    const nAlpha = (grungeNoise(s, grain, 41) + 1) / 2;
    alphaJ[i] = Math.max(0.2, 1 - nAlpha * grungeAmt * GRUNGE_ALPHA_MAX_DIP);
  }
  return { left, right, width, skip, alphaJ };
}

// ------------------------------- Kurvenabhaengiges Timing (Schwung) -------------------------------

export function buildTimeMapping(points, derived, dynamic) {
  const n = points.length;
  const T = new Array(n); T[0] = 0;
  const curvRef = 0.012, slow = dynamic ? 0.65 : 0.05;

  const speeds = new Array(n);
  for (let i = 0; i < n; i++) {
    const cn = Math.min(1, derived.curvature[i] / curvRef);
    let sp = 1 - slow * cn;
    const edgeFrac = Math.min(i, n - 1 - i) / Math.max(1, n * 0.12);
    const ease = Math.min(1, edgeFrac);
    sp *= 0.25 + 0.75 * ease;
    speeds[i] = Math.max(0.12, sp);
  }
  for (let i = 1; i < n; i++) {
    const ds = points[i].s - points[i - 1].s;
    const avgSp = (speeds[i] + speeds[i - 1]) / 2;
    T[i] = T[i - 1] + ds / Math.max(0.05, avgSp);
  }
  return T;
}

// ------------------------------- Zeichnen -------------------------------

function fillRun(inkCtx, geo, from, to) {
  if (to < from) return;
  inkCtx.globalAlpha = geo.alphaJ[Math.floor((from + to) / 2)] * 0.97;
  inkCtx.beginPath();
  inkCtx.moveTo(geo.left[from - 1].x, geo.left[from - 1].y);
  for (let i = from; i <= to; i++) inkCtx.lineTo(geo.left[i].x, geo.left[i].y);
  for (let i = to; i >= from; i--) inkCtx.lineTo(geo.right[i].x, geo.right[i].y);
  inkCtx.lineTo(geo.right[from - 1].x, geo.right[from - 1].y);
  inkCtx.closePath();
  inkCtx.fill();
}

// Zeichnet den Bereich [from,to] als moeglichst wenige zusammenhaengende Polygone
// (siehe Original-Kommentar zu sichtbaren Naht-"Chunks" bei Einzel-Fills).
export function drawQuadRange(inkCtx, color, geo, from, to) {
  inkCtx.fillStyle = color;
  let runStart = -1;
  const start = Math.max(1, from);
  for (let i = start; i <= to + 1; i++) {
    const isSkip = i > to || geo.skip[i];
    if (!isSkip) {
      if (runStart === -1) runStart = i;
    } else if (runStart !== -1) {
      fillRun(inkCtx, geo, runStart, i - 1);
      runStart = -1;
    }
  }
  inkCtx.globalAlpha = 1;
}

// Findet den groessten Punktindex idx, fuer den T[idx] <= elapsedRel gilt (binaere Suche,
// da elapsedRel bei Rueckwaerts-Scrollen nicht monoton wachsend ankommt).
export function indexForElapsed(T, elapsedRel) {
  let lo = 0, hi = T.length - 1;
  if (elapsedRel <= T[0]) return 0;
  if (elapsedRel >= T[hi]) return hi;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (T[mid] <= elapsedRel) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// ------------------------------- Textur-Maske (Compositing) -------------------------------
// Identische Logik zum Original: Ink-Ebene bleibt sauber, erst beim Anzeigen wird eine
// Kopie per destination-in durch die Alpha-Maske gestanzt.

// WEBFLOW-PORT: crossOrigin + ein geteilter Cache.
//
// crossOrigin: buildMaskFromImage() liest die Textur per getImageData() aus. Kommt das Bild von
// einer anderen Domain (hier: das CDN) und ist NICHT als crossOrigin geladen, gilt die Canvas
// als "getaint" und getImageData() wirft einen SecurityError - die Maske waere tot und mit ihr
// die Koernung aller Striche. Die Gegenseite muss dazu CORS erlauben (jsDelivr sendet
// Access-Control-Allow-Origin: *).
//
// Cache: auf der Mobilseite haengen bis zu sechs Striche an DERSELBEN Textur. Ohne Cache
// dekodiert jeder sein eigenes Image-Objekt (der Netzwerk-Request wird zwar vom Browser
// zusammengelegt, das Dekodieren einer 1024x1024-JPEG aber nicht). Ein Eintrag pro URL genuegt.
const textureCache = new Map();

export function loadTextureImage(src) {
  const cached = textureCache.get(src);
  if (cached) return cached;
  const p = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
  textureCache.set(src, p);
  return p;
}

export function buildMaskFromImage(img, width, height, strength, contrast) {
  if (width <= 0 || height <= 0) return null;
  const tmp = document.createElement('canvas');
  tmp.width = width; tmp.height = height;
  const tctx = tmp.getContext('2d');
  const pattern = tctx.createPattern(img, 'repeat');
  tctx.fillStyle = pattern;
  tctx.fillRect(0, 0, width, height);
  const data = tctx.getImageData(0, 0, width, height).data;

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width; maskCanvas.height = height;
  const mctx = maskCanvas.getContext('2d');
  const imgData = mctx.createImageData(width, height);
  for (let i = 0, p = 0; i < width * height; i++, p += 4) {
    const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
    let v = (lum - 0.5) * contrast + 0.5;
    v = Math.max(0, Math.min(1, v));
    const finalAlpha = (1 - strength) + strength * v;
    imgData.data[i * 4 + 3] = Math.round(finalAlpha * 255);
  }
  mctx.putImageData(imgData, 0, 0);
  return maskCanvas;
}

export function compositeToVisible(ctx, visibleCanvas, inkCanvas, maskCanvas, maskScratchCanvas, maskScratchCtx, maskStrength) {
  ctx.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
  if (maskCanvas && maskStrength > 0) {
    maskScratchCtx.clearRect(0, 0, maskScratchCanvas.width, maskScratchCanvas.height);
    maskScratchCtx.globalCompositeOperation = 'source-over';
    maskScratchCtx.drawImage(inkCanvas, 0, 0);
    maskScratchCtx.globalCompositeOperation = 'destination-in';
    maskScratchCtx.drawImage(maskCanvas, 0, 0);
    maskScratchCtx.globalCompositeOperation = 'source-over';
    ctx.drawImage(maskScratchCanvas, 0, 0);
  } else {
    ctx.drawImage(inkCanvas, 0, 0);
  }
}
