# edding-webflow-mobile

> *Diese Datei wurde KI-generiert (Claude Code).*

Die Canvas-/WebGL-Teile der edding-Scrollytelling-Seite `warum-edding.html` als wiederverwendbare
Bausteine für eine **Webflow-Mobile-Umsetzung**. Angebunden über Custom Attributes, ausgeliefert
über jsDelivr, ohne Build-Schritt.

**→ [ANLEITUNG.md](ANLEITUNG.md) ist die Schritt-für-Schritt-Anleitung mit allen Code-Schnipseln.**

## Einbinden

```html
<script type="module">
  const BASE = 'https://cdn.jsdelivr.net/gh/tobrandung/edding-webflow-mobile@v1/';
  const m = await import(BASE + 'src/edding-webflow.js');
  m.initEdding({ assetBase: BASE + 'assets/' });
</script>
```

```html
<div data-edding-stroke="hitze" style="position:relative; width:100%; aspect-ratio:1550/913.4"></div>
```

## Was drin ist

| Datei | Rolle |
|---|---|
| `src/brush-engine.js` | Pfad-Abtastung, Stift-Geometrie, Textur-Maske, Compositing |
| `src/stroke-chapter.js` | `renderProgress(p)` / `renderTrim(head, tail)` — reine Funktionen von 0..1 |
| `src/dirty-carousel.js` | Strich als Alpha-Maske über einem Bild-Karussell |
| `src/pen-rig.js` | 3D-Stift-Karussell (three.js) |
| `src/vendor/` | GLTFLoader + BufferGeometryUtils aus three r160.1, Imports umgeschrieben |
| `src/paths.js` | die sieben SVG-Zeichnungen als Strings |
| `src/presets.js` | die Rezepte: 6 Striche, 2 Slider, 1 Bild-Karussell |
| `src/edding-strokes.js` | Webflow-Anbindung der Striche |
| `src/edding-pen-slider.js` | Webflow-Anbindung der 3D-Slider |
| `src/edding-image-brush.js` | Webflow-Anbindung des Bild-Karussells |
| `src/edding-webflow.js` | Einstiegspunkt (`initEdding`) |
| `assets/` | Texturen, Stiftmodelle, Fotos — auf 390 px Zielbreite aufbereitet |
| `test/mobile.html` | Testseite, lokale Dateien |
| `test/cdn.html` | Testseite, alles vom CDN (entspricht Webflow) |

## Herkunft

Portiert aus dem edding-Prototyp (`UEBERGABE-edding-prototyp-2026-08-04`). Die Zeichenmaschine ist
unverändert übernommen — sie hat keine Abhängigkeiten und ist eine reine Funktion des Fortschritts,
weshalb Scroll-Scrubbing in beide Richtungen von sich aus funktioniert.

Geändert wurde bewusst nur, was ein Mobile-Nachbau braucht:

- **Choreografie statt absoluter Scroll-Werte.** Der Prototyp arbeitet mit handkalibrierten
  `scrollY`-Konstanten (`CAROUSEL_STICKY_SHIFT = 4662`, `HEADER_SHIFT_PX = 17` …), die nur bei
  1920 px mit genau jenem Header gelten. Hier kommt der Fortschritt aus der Position der Box im
  Viewport.
- **Strichbreite skaliert mit der Box.** In der Engine kommt sie absolut aus dem Stift; über
  `refBox` je Preset wird sie auf die tatsächliche Boxgröße umgerechnet.
- **Kapitel 6 neu angetrieben.** Der Prototyp nutzt dort einen `wheel`-Hijack mit
  `preventDefault()` — Touch-Geräte feuern keine `wheel`-Events. Jetzt `position: sticky` +
  Scroll-Scrub; die Maske selbst ist unverändert.
- **Kein Einflug-Intro der Stifte** (Vorgabe). Im Prototyp ist es ohnehin wirkungslos, weil
  `setVirtualIndex(0)` es jeden Frame überschreibt.
- **Ohne Importmap, lazy, pausierbar.** three.js und die Stiftmodelle laden erst, wenn ein Slider
  naht; die Render-Loop läuft nur, solange der Slider im Bild ist.

Die Datei `assets/pens-original/` (unkomprimierte Stiftmodelle) ist absichtlich nicht Teil dieses
Repos — die Originale liegen im Prototyp-Ordner unter `assets/models/`.
