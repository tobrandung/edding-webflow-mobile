// Bindet die Brush-Engine an eine Canvas-Flaeche und macht den Fortschritt zu einer
// reinen Funktion einer extern uebergebenen Zahl 0..1 (statt requestAnimationFrame/Zeit).
// So bleibt es wie beim Reifen-Modul in beide Scroll-Richtungen verlustfrei abspielbar -
// renderProgress() zeichnet bei jedem Aufruf die Ink-Ebene komplett neu bis zum Ziel-Index,
// es gibt keinen inkrementellen "lastIdx"-Zustand, der bei Rueckwaerts-Scroll korrigiert
// werden muesste.

import * as Brush from './brush-engine.js';

export class StrokeChapter {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.opts = opts;
    this.ctx = canvas.getContext('2d');

    this.inkCanvas = document.createElement('canvas');
    this.inkCtx = this.inkCanvas.getContext('2d');
    this.maskScratchCanvas = document.createElement('canvas');
    this.maskScratchCtx = this.maskScratchCanvas.getContext('2d');
    this.maskCanvas = null;

    this.perSubpath = [];
    this._lastProgress = 0;
    this._seed = Math.random() * 1000;

    this.ready = this._init();
  }

  async _init() {
    // WEBFLOW-PORT: svgText (Pfad als String, bevorzugt) ODER wie bisher svgUrl (fetch).
    // Die acht Pfade dieses Ports sind zusammen unter 60 KB und liegen deshalb als Strings in
    // paths.js - das spart acht Netzwerk-Anfragen und umgeht CORS bei fetch() vollstaendig.
    const [svgText, textureImg] = await Promise.all([
      this.opts.svgText != null
        ? Promise.resolve(this.opts.svgText)
        : fetch(this.opts.svgUrl).then(r => r.text()),
      this.opts.textureUrl ? Brush.loadTextureImage(this.opts.textureUrl) : Promise.resolve(null),
    ]);
    this.textureImg = textureImg;
    const parsed = Brush.parseSVGText(svgText);
    this.rawSubpaths = parsed.subpaths;
    this.rawBbox = parsed.bbox;
    this._layout();
  }

  _safeRect() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const marginX = w * (this.opts.marginX ?? 0.12);
    const marginY = h * (this.opts.marginY ?? 0.16);
    return { x: marginX, y: marginY, w: w - marginX * 2, h: h - marginY * 2 };
  }

  _layout() {
    if (!this.rawSubpaths) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.inkCanvas.width = this.canvas.width;
    this.inkCanvas.height = this.canvas.height;
    this.inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.maskScratchCanvas.width = this.canvas.width;
    this.maskScratchCanvas.height = this.canvas.height;

    let subpaths = Brush.fitSubpaths(this.rawSubpaths, this.rawBbox, this._safeRect(), this.opts.pathScale ?? 1);
    // reverse: kehrt die Zeichenrichtung um (Punktreihenfolge + Bogenlaenge "s" pro Subpath
    // gespiegelt), ohne die SVG-Datei selbst anfassen zu muessen.
    if (this.opts.reverse) {
      subpaths = subpaths.map(sp => ({
        length: sp.length,
        points: sp.points.slice().reverse().map(p => ({ ...p, s: sp.length - p.s })),
      }));
    }
    const brush = Brush.scaleBrush(Brush.BRUSHES[this.opts.brushId], this.opts.widthMultiplier);
    const totalLength = subpaths.reduce((sum, sp) => sum + sp.length, 0) || 1;

    let cursor = 0;
    this.perSubpath = subpaths.map(sp => {
      const derived = Brush.computeDerived(sp.points);
      const geo = Brush.buildStrokeGeometry(
        sp.points, derived, brush,
        this.opts.tipAngleDeg, this.opts.grungeAmt, this.opts.grainSizePx, this._seed
      );
      const T = Brush.buildTimeMapping(sp.points, derived, this.opts.dynamic);
      const startFrac = cursor / totalLength;
      cursor += sp.length;
      const endFrac = cursor / totalLength;
      return { geo, T, totalRel: T[T.length - 1] || 1, startFrac, endFrac };
    });

    if (this.textureImg) {
      this.maskCanvas = Brush.buildMaskFromImage(
        this.textureImg, this.canvas.width, this.canvas.height,
        this.opts.maskStrength ?? 0.7, this.opts.maskContrast ?? 1
      );
    }

    this.renderTrim(this._lastProgress, this._lastTail || 0);
  }

  handleResize() {
    this._layout();
  }

  renderProgress(progress) {
    this.renderTrim(progress, 0);
  }

  // Trim-Path (wie After Effects): zeichnet nur das Segment zwischen tailProgress (hinteres,
  // "wegradiertes" Ende) und headProgress (vorderes, weitermalendes Ende). Beide 0..1 ueber
  // den GESAMTEN Pfad. tailProgress=0 => normales Vorwaertsmalen ohne Wegradieren. Weil bei
  // jedem Aufruf komplett neu gezeichnet wird, ist "wegradieren" einfach = hinteren Teil
  // nicht mehr mitzeichnen (kein echtes Loeschen noetig).
  renderTrim(headProgress, tailProgress) {
    this._lastProgress = headProgress;
    this._lastTail = tailProgress;
    if (!this.perSubpath.length) return;

    this.inkCtx.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
    for (const sub of this.perSubpath) {
      if (headProgress <= sub.startFrac) continue;
      const span = sub.endFrac - sub.startFrac;
      const headLocal = span > 0 ? Math.min(1, (headProgress - sub.startFrac) / span) : 1;
      const headIdx = Brush.indexForElapsed(sub.T, headLocal * sub.totalRel);
      // tailIdx: solange tailProgress diesen Subpfad noch nicht erreicht hat, ab 1 zeichnen.
      let fromIdx = 1;
      if (tailProgress > sub.startFrac) {
        const tailLocal = span > 0 ? Math.min(1, (tailProgress - sub.startFrac) / span) : 1;
        fromIdx = Math.max(1, Brush.indexForElapsed(sub.T, tailLocal * sub.totalRel));
      }
      if (headIdx > fromIdx) Brush.drawQuadRange(this.inkCtx, this.opts.color, sub.geo, fromIdx, headIdx);
    }

    Brush.compositeToVisible(
      this.ctx, this.canvas, this.inkCanvas,
      this.maskCanvas, this.maskScratchCanvas, this.maskScratchCtx,
      this.maskCanvas ? (this.opts.maskStrength ?? 0.7) : 0
    );
  }
}
