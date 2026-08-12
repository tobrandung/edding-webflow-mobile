// Kapitel 6 (verschmutzte Oberflaechen - Bild-Karussell): malt einen Pinselstrich nach
// pinselstrich_stroke_test02.svg und benutzt diesen gemalten Strich als ALPHA-MASKE ueber
// einem Bild-Karussell - das Bild wird also vom Pinsel "freigemalt". Anders als StrokeChapter
// (das die Tinte selbst sichtbar macht) landet die Tinte hier nur auf einer Offscreen-
// Ink-Ebene und stanzt per destination-in das darunterliegende Foto aus.
//
// Wiederverwendung: die reinen Geometrie-/Zeichenfunktionen aus brush-engine.js (Pfad-
// Parsing, Stroke-Geometrie, Trim-Path). Nicht wiederverwendet wird Brush.fitSubpaths()
// (zentriert + 0.88-Marge) - hier soll der Pfad exakt proportional auf die Buehnenbreite
// (= native Bildbreite 1280px) skaliert werden (Nutzer-Vorgabe), vertikal mittig + Offset.

import * as Brush from './brush-engine.js';

export class DirtyCarousel {
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts;

    // Ink-Ebene (nur Alpha zaehlt) + Foto-Ebene (aktuelles/ueberblendetes Bild).
    this.inkCanvas = document.createElement('canvas');
    this.inkCtx = this.inkCanvas.getContext('2d');
    this.photoCanvas = document.createElement('canvas');
    this.photoCtx = this.photoCanvas.getContext('2d');

    this.perSubpath = [];
    this._seed = Math.random() * 1000;
    this._vOffset = opts.vOffset ?? 0;
    this._lastHead = 0;
    this._lastState = { from: 0, to: 0, blend: 0 };

    this.ready = this._init();
  }

  async _init() {
    // WEBFLOW-PORT: svgText (String) ODER svgUrl (fetch), wie in stroke-chapter.js.
    const [svgText, ...images] = await Promise.all([
      this.opts.svgText != null
        ? Promise.resolve(this.opts.svgText)
        : fetch(this.opts.svgUrl).then(r => r.text()),
      ...this.opts.images.map(src => Brush.loadTextureImage(src)),
    ]);
    this.images = images;
    const parsed = Brush.parseSVGText(svgText);
    this.rawSubpaths = parsed.subpaths;
    this.rawBbox = parsed.bbox;
    this._layout();
  }

  setVOffset(px) {
    this._vOffset = px;
    this._layout();
  }

  // Skaliert den Pfad EXAKT proportional so, dass seine Bounding-Box-Breite = Canvasbreite
  // ist (statt Brush.fitSubpaths, das einpasst + zentriert). Vertikal mittig + _vOffset.
  _fitToWidth() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const b = this.rawBbox;
    if (!b || b.w <= 0) return [];
    const scale = w / b.w;
    const top = (h - b.h * scale) / 2 + this._vOffset;
    return this.rawSubpaths.map(sp => ({
      length: sp.length * scale,
      points: sp.points.map(p => ({
        x: (p.x - b.x) * scale,
        y: (p.y - b.y) * scale + top,
        s: p.s * scale,
      })),
    }));
  }

  // WEBFLOW-PORT: force=true baut auch dann neu, wenn sich nichts geaendert hat.
  _layout(force = false) {
    if (!this.rawSubpaths) return;
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // WEBFLOW-PORT: dieselbe Bremse wie in StrokeChapter._layout() - siehe die Begruendung
    // dort. Kurz: diese Funktion setzt gleich unten canvas.width (das LEERT die Canvas) und
    // baut die Stiftgeometrie neu. Auf Mobile feuert window.resize beim Ein-/Ausblenden der
    // Adressleiste, also mitten im Scrollen, obwohl sich an der Canvas nichts geaendert hat.
    const sig = [
      Math.floor(w * dpr), Math.floor(h * dpr),
      this.opts.widthMultiplier, this.opts.tipAngleDeg, this.opts.grungeAmt,
      // _vOffset und NICHT opts.vOffset: setVOffset() schreibt nur das Feld. Stuende hier der
      // opts-Wert, wuerde eine Verschiebung als "nichts geaendert" gelten und nicht ankommen.
      this.opts.grainSizePx, this.opts.brushId, this._vOffset,
    ].join('|');
    if (!force && this._layoutSig === sig && this.perSubpath.length) return;
    this._layoutSig = sig;

    for (const c of [this.canvas, this.inkCanvas, this.photoCanvas]) {
      c.width = Math.floor(w * dpr);
      c.height = Math.floor(h * dpr);
    }
    this.inkCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const subpaths = this._fitToWidth();
    const o = this.opts;
    const brush = Brush.scaleBrush(Brush.BRUSHES[o.brushId], o.widthMultiplier);
    const totalLength = subpaths.reduce((sum, sp) => sum + sp.length, 0) || 1;

    let cursor = 0;
    this.perSubpath = subpaths.map(sp => {
      const derived = Brush.computeDerived(sp.points);
      const geo = Brush.buildStrokeGeometry(
        sp.points, derived, brush, o.tipAngleDeg, o.grungeAmt, o.grainSizePx, this._seed
      );
      const T = Brush.buildTimeMapping(sp.points, derived, o.dynamic);
      const startFrac = cursor / totalLength;
      cursor += sp.length;
      return { geo, T, totalRel: T[T.length - 1] || 1, startFrac, endFrac: cursor / totalLength };
    });

    // Letzten Zustand neu zeichnen (nach Resize/Offset-Aenderung).
    this._composite(this._lastHead, this._lastState);
  }

  handleResize(force = false) { this._layout(force); }

  // Ink-Ebene bis headProgress (0..1) neu aufbauen (immer komplett, richtungsunabhaengig -
  // wie StrokeChapter.renderTrim, aber ohne Tail: der Strich bleibt als Maske stehen).
  _renderInk(headProgress) {
    this.inkCtx.clearRect(0, 0, this.inkCanvas.width, this.inkCanvas.height);
    for (const sub of this.perSubpath) {
      if (headProgress <= sub.startFrac) continue;
      const span = sub.endFrac - sub.startFrac;
      const headLocal = span > 0 ? Math.min(1, (headProgress - sub.startFrac) / span) : 1;
      const headIdx = Brush.indexForElapsed(sub.T, headLocal * sub.totalRel);
      if (headIdx > 1) Brush.drawQuadRange(this.inkCtx, '#000', sub.geo, 1, headIdx);
    }
  }

  // Foto-Ebene aufbauen: Basisbild + optionale Ueberblendung zum naechsten Bild.
  _renderPhoto({ from, to, blend }) {
    const cw = this.photoCanvas.width, ch = this.photoCanvas.height;
    this.photoCtx.clearRect(0, 0, cw, ch);
    const imgFrom = this.images[from];
    const imgTo = this.images[to];
    if (imgFrom) this.photoCtx.drawImage(imgFrom, 0, 0, cw, ch);
    if (imgTo && blend > 0 && to !== from) {
      this.photoCtx.globalAlpha = blend;
      this.photoCtx.drawImage(imgTo, 0, 0, cw, ch);
      this.photoCtx.globalAlpha = 1;
    }
  }

  // Foto durch die Ink-Maske stanzen und auf die sichtbare Canvas bringen.
  _composite(headProgress, state) {
    this._lastHead = headProgress;
    this._lastState = state;
    if (!this.perSubpath.length) return;
    this._renderInk(headProgress);
    this._renderPhoto(state);

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.globalCompositeOperation = 'source-over';
    this.ctx.drawImage(this.photoCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'destination-in';
    this.ctx.drawImage(this.inkCanvas, 0, 0);
    this.ctx.globalCompositeOperation = 'source-over';
  }

  // Phase 1 (Reveal, scroll-gesteuert): Strich malt sich, gibt Bild 0 frei.
  renderReveal(headProgress) {
    this._composite(headProgress, { from: 0, to: 0, blend: 0 });
  }

  // Phase 2 (Karussell, gepinnt/wheel-gescrubbt): Strich voll gemalt (Maske steht),
  // Foto blendet zwischen from und to ueber.
  renderCarousel(from, to, blend) {
    this._composite(1, { from, to, blend });
  }
}
