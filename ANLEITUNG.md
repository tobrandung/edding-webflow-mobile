# edding-Module für Webflow — Schritt-für-Schritt

> *Dieser Text wurde KI-generiert (Claude Code) und mit dem Nutzer abgestimmt.*

Die drei Canvas-/WebGL-Teile von `warum-edding.html` als Bausteine für deine Webflow-Mobile-Seite:
**gemalte Marker-Striche**, **3D-Stift-Slider**, **Bild-Karussell mit Pinsel-Maske**.

Du baust im Designer normale, leere Boxen und hängst ein Custom Attribute dran. Der Code findet
sie, legt eine Canvas hinein und macht den Rest. Kein Build, kein Bundler, keine Importmap.

**Alles ist bei 390 px Breite eingemessen.**

---

## 1. Einmal pro Seite: das Snippet

In **Slater** ein neues Script anlegen, oder in Webflow unter *Page Settings → Before `</body>` tag*:

```html
<script type="module">
  const BASE = 'https://cdn.jsdelivr.net/gh/tobrandung/edding-webflow-mobile@v3/';
  const m = await import(BASE + 'src/edding-webflow.js');
  m.initEdding({ assetBase: BASE + 'assets/' });
</script>
```

Falls Slater `type="module"` nicht durchlässt, geht auch die klassische Variante:

```js
const BASE = 'https://cdn.jsdelivr.net/gh/tobrandung/edding-webflow-mobile@v3/';
import(BASE + 'src/edding-webflow.js').then(m => m.initEdding({ assetBase: BASE + 'assets/' }));
```

Das ist alles. Repo: <https://github.com/tobrandung/edding-webflow-mobile>

> **Zum `@v3`:** die Version ist fest verdrahtet, damit sich nichts von selbst ändert. Wenn du
> eine neue Fassung brauchst, wird ein neuer Tag gesetzt und du tauschst die Nummer.
> Nimm **nicht** `@main` — das liegt bis zu 12 Stunden im jsDelivr-Cache, Änderungen kommen
> also verzögert an.
>
> **Änderungen:** v2 brachte Zoom, Stauchen und Versatz für die Striche
> (`data-stroke-scale`, `data-stroke-scale-x/-y`, `data-stroke-offset-x/-y`).
> v3 bringt den Feld-Modus für den 3D-Slider: die Karte einmal bauen, das Modul tauscht die
> Texte (`data-pen-field`, `data-pen-data`). Wenn du noch eine ältere Nummer eingebunden hast,
> tausche sie.

---

## 2. Die gemalten Striche

### Markup

Eine leere Box, das war es. Höhe über `aspect-ratio`, nicht über eine Pixelhöhe.

```html
<div data-edding-stroke="hitze" style="position:relative; width:100%; aspect-ratio:1550/913.4"></div>
```

In Webflow:
1. Div-Block einfügen
2. Width `100%`, Position `Relative`
3. Unter *Size* das Seitenverhältnis setzen (oder per Custom-CSS `aspect-ratio`)
4. Unter *Settings → Custom attributes*: Name `data-edding-stroke`, Wert `hitze`

### Die sechs Striche

| Wert | Was | Farbe | Box-Verhältnis | Verhalten |
|---|---|---|---|---|
| `hitze` | Kapitel 1, geschwungener Strich | Rot `#fa0000` | `1550 / 913.4` | malt vorwärts |
| `wasser` | Kapitel 2, flacher Strich | Blau `#00368e` | `1338 / 587` | malt vorwärts |
| `permanent` | Kapitel 3, lange Kurve | Gelb `#ffcf00` | `3715.7 / 1400` | malt + radiert, Reststück bleibt |
| `nonpermanent` | Kapitel 4, gerade Linie von rechts | Gelb `#ffcf00` | `2400 / 300` | malt + radiert komplett weg |
| `dirty` | Kapitel 5, Kritzelmuster | Fast schwarz `#1a1a1a` | `2160 / 588.9` | malt + radiert komplett weg |
| `darum` | Kapitel 7, Marker-Kreis | Rot `#fa0000` | `760 / 565.4` | malt vorwärts |

Das Box-Verhältnis ist das der **Desktop-Box**, nicht das der Zeichnung. Nur damit sitzt der
Strich relativ zur Box so wie im Prototyp. Andere Verhältnisse verzerren nichts — die Zeichnung
wird immer proportional eingepasst und zentriert, es entsteht nur mehr oder weniger leerer Rand.

`dirty` liegt im Prototyp zusätzlich auf **30 % Deckkraft** — das ist CSS, also deine Box
(`opacity: 0.3`).

### Größer / mehr reingezoomt

Standardmäßig wird die ganze Zeichnung in die Box eingepasst — sie ist dann komplett zu sehen und
entsprechend klein. Für den Look aus dem Mobile-Design (dicker Strich, angeschnitten) zoomst du
rein:

```html
data-stroke-scale="2.2"           <!-- Zoomfaktor: 1 = eingepasst, 2 = doppelt so groß -->
data-stroke-offset-x="-0.26"      <!-- Versatz, Anteil der Boxbreite -->
data-stroke-offset-y="0.46"       <!-- Versatz, Anteil der Boxhöhe -->
data-margin-x="0" data-margin-y="0"
```

Was über die Box hinausragt, wird abgeschnitten — genau das ist beim Zoomen gewollt. Die
Strichdicke wächst automatisch mit (bei `data-pen-width="auto"`, dem Standard): reinzoomen heißt
optisch, dass alles größer wird, die Strichdicke eingeschlossen.

**Der Versatz ist der Punkt, der nicht offensichtlich ist.** Zoomen vergrößert um die *Mitte der
Box*, und bei manchen Zeichnungen liegt dort gar keine Farbe. Bei `wasser` (einer breiten Welle)
ist die Mitte leer — ohne Versatz zoomst du in ein Loch, und je näher du kommst, desto weniger
ist zu sehen. Nachgemessen: Farbanteil sinkt von 13 % bei Zoom 1 auf 0 % bei Zoom 4. Mit Versatz
steigt er auf über 40 %.

**Dafür gibt es einen Regler:** öffne `test/regler.html` (lokaler Server nötig, siehe unten).
Dort stellst du Zeichnung, Boxform, Zoom, Versatz, Strichdicke und Körnung live ein, „Beste
Position suchen" setzt den Versatz automatisch auf den Ausschnitt mit der meisten Farbe, und
unten steht der fertige Attribut-Block zum Kopieren. Das ist deutlich schneller als Werte im
Designer zu raten.

Gemessene Startwerte (Box volle Breite, `margin-x/y` auf 0). „Farbanteil" ist, wie viel der Box
der Strich bei vollem Fortschritt bedeckt — grob ein Maß dafür, wie „satt" der Ausschnitt wirkt:

| Zeichnung | Boxform | Zoom | Versatz X | Versatz Y | Farbanteil |
|---|---|---|---|---|---|
| `hitze` | `390/280` | 1.6 | −0.04 | 0.24 | 16 % |
| `hitze` | `390/280` | 2.2 | −0.26 | 0.44 | 22 % |
| `hitze` | `390/280` | 3.0 | −0.52 | 0.52 | 31 % |
| `wasser` | `390/230` | 1.6 | −0.23 | −0.04 | 17 % |
| `wasser` | `390/230` | 2.2 | −0.52 | −0.29 | 21 % |
| `wasser` | `390/230` | 3.0 | −0.88 | −0.56 | 30 % |

Die Versatzwerte hängen an der Boxform — änderst du das Seitenverhältnis, im Regler neu
suchen lassen.

### Stauchen und Strecken

Zoom vergrößert proportional. Willst du die Zeichnung **flacher oder schmaler** machen, gibt es
zwei getrennte Faktoren:

```html
data-stroke-scale-x="1.3"    <!-- Breite: 1 = unverändert, <1 schmaler, >1 breiter -->
data-stroke-scale-y="0.5"    <!-- Höhe:  0.5 = auf die halbe Höhe zusammengedrückt -->
```

**Die Strichdicke wird dabei absichtlich nicht mitgestaucht.** Der Stift bleibt, wie er ist —
genau wie ein echter Marker, der eine flachere Kurve mit derselben Spitze zieht. Ein Stauchen
über eine CSS-Transform hätte den Strich und die Körnung mitverzerrt; hier wird die Zeichnung
wirklich mit den neuen Proportionen gemalt. Willst du sie zusätzlich dünner, dann über
`data-pen-width`.

### Wichtig zu `permanent` und `nonpermanent`

Diese zwei Zeichnungen sind auf dem Desktop **2400 bzw. 3716 px breit** — sie hängen dort weit
über den Bildschirmrand hinaus. Presst man sie in 390 px, wird ein Haarstrich daraus (gemessen:
Strichbreite 0,34 bzw. 0,53 gegenüber 3,6 im Original). Zwei Wege:

- **Überhang beibehalten** (näher am Original): Box breiter als der Viewport machen, z. B.
  `width: 900px` mit negativem `margin-left`, und am Seitencontainer `overflow: hidden`.
  Dann brauchst du auch die größere Textur: `data-texture="grain2048"`.
- **Strich dicker stellen**: `data-pen-width="1.2"` (oder was gefällt) statt der Automatik.

### Wann der Strich malt

Standard: **scroll-gescrubbt**. Der Strich wächst beim Runterscrollen mit und verschwindet beim
Hochscrollen wieder — wie im Prototyp.

```html
data-stroke-scrub="1.0 0.45"
```

Erste Zahl: der Strich fängt an, wenn die Boxoberkante bei **100 % der Bildschirmhöhe** steht
(= gerade am unteren Rand auftaucht). Zweite Zahl: fertig gemalt bei **45 %** (etwa Bildmitte).
Kleinere zweite Zahl = später fertig. Beides sind Bildschirmhöhen, keine Pixel — deshalb
funktioniert es auf jedem Gerät.

Alternativ einmal durchmalen statt scrubben:

```html
data-stroke-once data-stroke-duration="1000"
```

Bei aktivem *Bewegung reduzieren* im Betriebssystem wird der Strich immer sofort fertig gezeigt.

### Alle Attribute der Striche

| Attribut | Wirkung | Standard |
|---|---|---|
| `data-edding-stroke` | Preset (siehe Tabelle) | — |
| `data-stroke-color` | Farbe überschreiben | je Preset |
| `data-stroke-scrub` | Scroll-Fenster in Bildschirmhöhen | `1.0 0.45` |
| `data-stroke-once` | einmal durchmalen statt scrubben | aus |
| `data-stroke-duration` | Dauer dafür in ms | `1000` |
| `data-pen-width` | Strichbreite; `auto` skaliert mit der Box | `auto` |
| `data-pen-angle` | Winkel der Keilspitze in Grad | 45 bzw. 36 |
| `data-pen-grunge` | Rauheit der Kanten, 0–1 | je Preset |
| `data-pen-grain` | Korngröße in px | je Preset |
| `data-mask-strength` | wie stark die Körnung durchschlägt, 0–1 | 0.7 / 1.0 / 0.27 |
| `data-mask-contrast` | Kontrast der Körnung | 0.95 / 2.0 |
| `data-texture` | `grain` \| `grain2048` \| `rough` | je Preset |
| `data-margin-x` / `-y` | Innenrand als Anteil, 0–0.5 | je Preset |
| `data-stroke-scale` | Zoom, proportional | `1` |
| `data-stroke-scale-x` | Breite stauchen/strecken | `1` |
| `data-stroke-scale-y` | Höhe stauchen/strecken | `1` |
| `data-stroke-offset-x` | Versatz seitlich, Anteil der Boxbreite | `0` |
| `data-stroke-offset-y` | Versatz hoch/runter, Anteil der Boxhöhe | `0` |
| `data-stroke-reverse` | Zeichenrichtung umkehren | je Preset |
| `data-trim-head` | wie weit der Kopf malt, Anteil | je Preset |
| `data-trim-tail-start` | ab wann hinten radiert wird | je Preset |
| `data-trim-tail-range` | wie schnell radiert wird | je Preset |
| `data-trim-tail-max` | wie viel höchstens wegradiert wird | 0.85 bzw. 1.0 |
| `data-stroke-debug` | schreibt Messwerte in die Browser-Konsole | aus |
| `data-stroke-svg` | eigene SVG-Zeichnung als Quelltext | — |

---

## 3. Der 3D-Stift-Slider

### Markup

**Die Karte baust du EINMAL.** Du markierst darin die Textstellen, und das Modul schreibt beim
Umschalten nur die Texte um — genauso macht es der Desktop-Prototyp. Die vier Textsätze liegen
in einem unsichtbaren Datenblock.

```html
<div data-edding-pen-slider="hitze">

  <!-- Deine gestylte Karte, einmal gebaut. Nur die Textstellen markieren: -->
  <div class="karte">
    <p data-pen-field="headline">edding 2000 C Permanentmarker</p>
    <p data-pen-field="body">Die aufgetragene Farbe widersteht Hitze bis 300° Celsius.</p>
    <span data-pen-field="temp" data-pen-count-up>300</span>° C
    <p data-pen-field="label">Hitzebeständig</p>
    <a href="#">Zum Produkt</a>
  </div>

  <div data-pen-canvas style="aspect-ratio:990/770"></div>

  <button data-pen-prev aria-label="Vorheriger Stift">‹</button>
  <button data-pen-next aria-label="Nächster Stift">›</button>

  <!-- Die vier Textsätze. Wird automatisch ausgeblendet. -->
  <div data-pen-data>
    <div data-pen-slide>
      <span data-pen-field="headline">edding 2000 C Permanentmarker</span>
      <span data-pen-field="body">Die aufgetragene Farbe widersteht Hitze bis 300° Celsius. Sie ist auch UV-beständig.</span>
      <span data-pen-field="temp">300</span>
      <span data-pen-field="label">Hitzebeständig</span>
    </div>
    <div data-pen-slide>
      <span data-pen-field="headline">edding 8300 Industry Permanentmarker</span>
      <span data-pen-field="body">Hitzebeständige Tinte für raue und glatte Oberflächen.</span>
      <span data-pen-field="temp">400</span>
      <span data-pen-field="label">Hitzebeständig</span>
    </div>
    <div data-pen-slide>
      <span data-pen-field="headline">edding 50 Paint Marker</span>
      <span data-pen-field="body">Hitzebeständige Farbe für den industriellen Einsatz.</span>
      <span data-pen-field="temp">250</span>
      <span data-pen-field="label">Hitzebeständig</span>
    </div>
    <div data-pen-slide>
      <span data-pen-field="headline">edding 750 Paint Marker</span>
      <span data-pen-field="body">Hitzebeständige, glänzend deckende Beschichtung.</span>
      <span data-pen-field="temp">200</span>
      <span data-pen-field="label">Hitzebeständig</span>
    </div>
  </div>

</div>
```

So baust du das im Designer:

1. **Die Karte** wie gewohnt bauen. An jedem Text-Element, das wechseln soll, unter
   *Settings → Custom attributes* ein `data-pen-field` mit einem frei gewählten Namen setzen
   (`headline`, `body`, `temp`, `label` — die Namen musst du nur im Datenblock gleich schreiben).
2. **Der Datenblock**: ein Div mit `data-pen-data`, darin vier Divs mit `data-pen-slide`, in jedem
   je ein Text-Element pro Feldname. Ungestylt, reiner Text — das Modul blendet den ganzen Block
   aus. Reihenfolge = Stift-Reihenfolge (2000 C → 8300 → 50 → 750).
3. **Weicher Wechsel** (optional): das Modul setzt für 250 ms die Klasse `is-swapping` am
   äußeren Slider-Div. Im Designer eine Custom-CSS-Regel dafür:

   ```css
   [data-pen-field] { transition: opacity .25s ease, transform .25s ease; }
   .is-swapping [data-pen-field] { opacity: 0; transform: translateX(-12px); }
   ```

   Ohne diese Regel wechselt der Text einfach hart — funktioniert auch.
4. **Hochzählende Zahl**: am Ziel-Element zusätzlich `data-pen-count-up` (ohne Wert). Die Zahl
   zählt dann in 450 ms zum neuen Wert hoch, statt zu springen.

Zwei Dinge, die schiefgehen können:

- **Die Attribute für Zoom (`data-pen-fov`, `data-pen-shift-y`) gehören an das äußere
  `data-edding-pen-slider`-Div**, nicht an das Canvas-Div — dort werden sie nicht gelesen.
- **Die Pfeil-Buttons nicht *in* das Canvas-Div legen.** Die Zeichenfläche wird darüber gelegt und
  fängt die Klicks ab. Daneben ist richtig.

**Alternative ohne Datenblock:** wenn du kein `data-pen-field` verwendest, fällt das Modul auf den
einfachen Weg zurück — vier fertig gestylte `data-pen-slide`-Blöcke, von denen der aktive
eingeblendet wird. Dann pflegst du das Kartenlayout allerdings viermal.

Zwei Presets:

| Wert | Was | Zusätzlich nötig |
|---|---|---|
| `hitze` | oberes Karussell des Prototyps | — |
| `wasser` | unteres Karussell, andere Kamera, gespiegelte Reihenfolge | `data-pen-fov="1.3" data-pen-shift-x="0.2" data-pen-shift-y="-0.12"` |

**Warum `wasser` die drei Zusatzwerte braucht:** die Kamera ist für eine 990×770-Fläche
eingerichtet. Bei 390 px läuft der vorderste Stift auf Position 3 und 4 unten aus dem Bild
(nachgemessen bis 23 % unter den Rand). Die Werte weiten den Bildwinkel und verschieben die
Kamera so, dass alle vier Positionen mit Rand im Bild sitzen — die linkslastige Komposition des
Originals bleibt erhalten. Bei `hitze` sitzt alles von sich aus richtig.

### Bedienung

Nur die zwei Pfeil-Buttons, kein Scroll-Eingriff und kein Endlos-Loop: die vier Stifte sitzen auf
einem 76°-Bogen, ein Sprung von Stift 4 zurück auf 1 würde sichtbar zurückrotieren. Am Anfang
und Ende setzt das Modul deshalb `aria-disabled="true"` und die Klasse `is-disabled` auf den
jeweiligen Button — die kannst du im Designer als Combo-Klasse stylen (z. B. `opacity: 0.35`).

### Textwechsel

Standard `data-pen-slides-mode="inline"`: das Modul legt die vier Blöcke übereinander und blendet
den aktiven ein. **Funktioniert ohne jedes Styling.**

Alternative `data-pen-slides-mode="class"`: das Modul setzt nur die Klasse `is-active`, das
Ein-/Ausblenden machst du selbst im Designer.

`data-pen-count-up="300"` an einem Element im Slide zählt beim Wechsel weich auf 300 hoch
(450 ms) — wie das Thermometer im Prototyp.

### Alle Attribute des Sliders

| Attribut | Wirkung | Standard |
|---|---|---|
| `data-edding-pen-slider` | `hitze` \| `wasser` | — |
| `data-pen-canvas` | am Kind, in das die 3D-Fläche kommt | — |
| `data-pen-prev` / `data-pen-next` | an den Buttons | — |
| `data-pen-slide` | an jedem der vier Textblöcke bzw. Datensätze | — |
| `data-pen-field` | an jeder Textstelle, die wechseln soll (Name frei) | — |
| `data-pen-data` | am Container mit den vier Datensätzen | — |
| `data-pen-swap-ms` | Dauer des Textwechsels in ms, 0 = hart | `250` |
| `data-pen-dot` | optional, direkte Sprungpunkte | — |
| `data-pen-count-up` | am Ziel-Feld: Zahl hochzählen statt springen | — |
| `data-pen-slides-mode` | `inline` \| `class` | `inline` |
| `data-pen-fov` | Bildwinkel; >1 = mehr im Bild | `1` |
| `data-pen-shift-x` / `-y` | Kamera seitlich / hoch verschieben | `0` |
| `data-pen-debug` | Messwerte in die Konsole | aus |

---

## 4. Das Bild-Karussell (Kapitel 6)

Der Pinselstrich malt sich und gibt darunter vier Fotos frei, die **beim Scrollen** durchwechseln.

```html
<section data-edding-image-brush>
  <div data-brush-sticky>

    <div data-brush-canvas style="aspect-ratio:1280/677"></div>

    <div data-brush-image data-src="…/staubig.jpg"></div>
    <div data-brush-image data-src="…/oelig.jpg"></div>
    <div data-brush-image data-src="…/rostig.jpg"></div>
    <div data-brush-image data-src="…/nass.jpg"></div>

    <div data-brush-word>Staubig</div>
    <div data-brush-word>Ölig</div>
    <div data-brush-word>Rostig</div>
    <div data-brush-word>Nass</div>

  </div>
</section>
```

**Die Höhe der äußeren Sektion setzt das Modul selbst** (`100svh` + Scrubstrecke) — du brauchst
dort keine Höhe einzustellen. `data-brush-sticky` bekommt automatisch `position: sticky; top: 0`.

Lässt du die `data-brush-image`-Elemente weg, nimmt das Modul die vier aufbereiteten Fotos vom
CDN. Willst du eigene: leere Div-Blöcke mit `data-src` und der Bild-URL.

> **Nimm `data-src` an einem Div, nicht `src` an einem `<img>`.** Gemessen: mit `<img src>` holt
> Chrome die vier Fotos (~480 KB) schon beim Seitenaufruf, sogar mit `loading="lazy"` und obwohl
> der Abschnitt mehrere Bildschirme weiter unten liegt. Mit `data-src` lädt sie ausschließlich das
> Modul, und zwar erst wenn die Sektion in Reichweite kommt.

Die vier `data-brush-word`-Elemente sind optional. Sie sollten übereinander liegen
(`position: absolute` in einem Rahmen mit `overflow: hidden`); das Modul fährt sie synchron zum
Bildwechsel 150 px hoch bzw. von unten herein.

| Attribut | Wirkung | Standard |
|---|---|---|
| `data-edding-image-brush` | an der äußeren Sektion | — |
| `data-brush-sticky` | am Kind, das kleben bleibt | — |
| `data-brush-canvas` | am Kind für die Zeichenfläche | — |
| `data-brush-image` + `data-src` | je Foto, in Reihenfolge | die vier vom CDN |
| `data-brush-word` | optional, je Wort | — |
| `data-hold-px` | Standzeit pro Bild in Scroll-px | `200` |
| `data-xfade-px` | Länge der Überblendung | `300` |
| `data-reveal-px` | Strecke, auf der der Strich malt | `360` |
| `data-scrub-px` | Gesamtstrecke; sonst aus den drei Werten | `2060` |
| `data-word-shift` | Weg der Wörter in px | `150` |
| `data-brush-offset-y` | Zeichnung vertikal verschieben | `0` |
| `data-brush-debug` | Messwerte in die Konsole | aus |

---

## 5. Drei Fallen

**1. Die Box braucht Breite UND Höhe.**
Ohne Höhe ist die Box 0 px hoch und es erscheint nichts. Deshalb `aspect-ratio` statt einer
festen Pixelhöhe — dann passt die Höhe bei jeder Breite. Das Modul schreibt in diesem Fall eine
Warnung in die Konsole.

**2. Stapelung.**
Die Canvas liegt absolut in deiner Box, die Box braucht also `position: relative`. Soll etwas
**über** dem Strich liegen (Headline, Panel), braucht dieses Element ebenfalls
`position: relative` und einen höheren `z-index` — sonst entscheidet allein die Reihenfolge im
Markup.

**3. `100vh` auf Mobile.**
Adressleiste ein- und ausblenden ändert `vh` und verschiebt damit jede klebende Höhe. Benutze
`svh` oder `dvh`. Die Module rechnen ohnehin nicht mit gespeicherten Scroll-Werten, sondern immer
mit der aktuellen Position der Box.

### Wenn etwas nicht erscheint

| Symptom | Ursache | Lösung |
|---|---|---|
| Nichts zu sehen, Warnung „Box hat keine Größe" | Box ohne Höhe | `aspect-ratio` setzen |
| Nichts zu sehen, keine Warnung | Strich noch nicht im Scroll-Fenster | `data-stroke-scrub` prüfen, z. B. `1.2 0.6` |
| Strich viel zu fett | `data-pen-width` steht auf einer festen Zahl | auf `auto` stellen oder weglassen |
| Strich ohne Körnung, Konsolenfehler mit „SecurityError" | Textur von einer Domain ohne CORS | bei den jsDelivr-URLs bleiben |
| Slider bleibt leer | Konsole prüfen: WebGL verfügbar? | im Zweifel `data-pen-debug` setzen |
| Stift läuft aus dem Bild | Canvas-Verhältnis weicht von 990/770 ab | `data-pen-fov` erhöhen, mit `data-pen-shift-x/-y` nachschieben |
| Änderung kommt nicht an | jsDelivr-Cache | dass `@v1` fest ist, ist Absicht; für Neues neuen Tag holen |

---

## 6. Selbst nachjustieren

Alle Werte hängen an Attributen — du änderst sie im Designer, lädst neu, fertig. Kein Eingriff
in den Code.

Am nützlichsten:

- **`data-stroke-debug`** bzw. **`data-pen-debug`** / **`data-brush-debug`** an das Element hängen.
  In der Browser-Konsole stehen dann Boxgröße, berechnete Strichbreite, Scroll-Fenster und die
  geladene Textur-URL.
- In der Konsole liegt außerdem **`window.__edding`** mit allen Modulen. Damit kannst du direkt
  ausprobieren, ohne zu scrollen:

```js
__edding.strokes[0].setProgress(0.5)   // ersten Strich auf halb gemalt stellen
__edding.sliders[0].next()             // Slider einen Stift weiter
__edding.strokes.map(s => s.penWidth)  // welche Strichbreiten gerade gelten
```

### Gemessene Strichbreiten bei 390 px

Zur Orientierung, falls du `data-pen-width` fest setzen willst. Links der Prototyp-Wert
(Desktop), rechts was die Automatik bei einer 350 px breiten Box daraus macht:

| Preset | Desktop | bei 350 px |
|---|---|---|
| `hitze` | 3.6 | 0.81 |
| `wasser` | 3.6 | 0.94 |
| `permanent` | 3.6 | 0.34 |
| `nonpermanent` | 3.6 | 0.53 |
| `dirty` | 2.33 | 0.38 |
| `darum` | 1.84 | 0.85 |
| Bild-Karussell | 5 | 1.37 |

### Zur Körnung

Die Korn-Textur ist ein 1024×1024-Ausschnitt der 26-MB-Originaldatei. Ausschnitt statt
Verkleinerung, weil die Textur pixelgenau gekachelt wird — verkleinern hätte die Körnung feiner
gemacht. Gemessen ist der Ausschnitt etwas kontrastreicher als der Durchschnitt der ganzen
Originaldatei (Streuung 0,143 gegen 0,106), das Korn wirkt also eine Spur kräftiger.
Wenn dich das störst: **`data-mask-strength="0.55"`** trifft die Original-Körnung genau
(nachgemessen 0,108).

Wird eine Strich-Box breiter als **512 px**, fängt die Textur an sich zu wiederholen. Dann
`data-texture="grain2048"` setzen.

---

## 7. Was geladen wird

Beim Seitenaufruf sind es **~420 KB** — die Korn-Textur (387 KB) und der Code. Alles andere kommt
erst, wenn der jeweilige Abschnitt in Reichweite kommt:

| Erst bei Bedarf | Größe | Wofür |
|---|---|---|
| three.js + GLTFLoader | 388 KB | sobald ein Slider naht |
| 4 Stiftmodelle | 1,05 MB | dito |
| Umgebungstextur | 33 KB | dito (Spiegelungen) |
| zweite Korn-Textur | 446 KB | nur für `dirty` |
| 4 Fotos | 484 KB | nur fürs Bild-Karussell |

Zum Vergleich: im Prototyp sind dieselben Assets **44 MB**. Die Stiftmodelle sind von 3,87 auf
1,05 MB geschrumpft, allein durch das Verkleinern der eingebackenen Texturen — Szenegraph,
Node-Namen und die Kappen-Animation sind dabei nachgemessen unverändert.

Die 3D-Slider rendern außerdem nur, solange sie im Bild sind. Im Prototyp laufen zwei
WebGL-Schleifen dauerhaft; auf einem Telefon ist das der teuerste Posten überhaupt.

---

## 8. Zum Testen ohne Webflow

Im Repo liegen vier Seiten:

- **`test/regler.html`** — der Regler: Zeichnung, Boxform, Zoom, Stauchen, Versatz, Strichbreite
  und Körnung live einstellen, unten den fertigen Attribut-Block kopieren. **Das ist die Seite,
  mit der du arbeitest.**
- **`test/pen-felder.html`** — der 3D-Slider im Feld-Modus, als Vorlage zum Nachbauen.
- **`test/mobile.html`** — alle Module mit den dokumentierten Attributen, lokale Dateien.
- **`test/cdn.html`** — dasselbe, aber alles von jsDelivr. Das ist der Aufbau, der Webflow
  entspricht.

Beide brauchen einen lokalen Server (`python3 -m http.server` im Repo-Ordner), weil ES-Module
nicht über `file://` laufen.
