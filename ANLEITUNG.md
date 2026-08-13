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
  const BASE = 'https://cdn.jsdelivr.net/gh/tobrandung/edding-webflow-mobile@v9/';
  const m = await import(BASE + 'src/edding-webflow.js');
  m.initEdding({ assetBase: BASE + 'assets/' });
</script>
```

Falls Slater `type="module"` nicht durchlässt, geht auch die klassische Variante:

```js
const BASE = 'https://cdn.jsdelivr.net/gh/tobrandung/edding-webflow-mobile@v9/';
import(BASE + 'src/edding-webflow.js').then(m => m.initEdding({ assetBase: BASE + 'assets/' }));
```

Das ist alles. Repo: <https://github.com/tobrandung/edding-webflow-mobile>

> **Zum `@v9`:** die Version ist fest verdrahtet, damit sich nichts von selbst ändert. Wenn du
> eine neue Fassung brauchst, wird ein neuer Tag gesetzt und du tauschst die Nummer.
> Nimm **nicht** `@main` — das liegt bis zu 12 Stunden im jsDelivr-Cache, Änderungen kommen
> also verzögert an.
>
> **Änderungen:** v2 brachte Zoom, Stauchen und Versatz für die Striche
> (`data-stroke-scale`, `data-stroke-scale-x/-y`, `data-stroke-offset-x/-y`).
> v3–v5 bringen den Feld-Modus für den 3D-Slider: die Karte einmal bauen, die vier Textfassungen
> als `data-pen-2/3/4` direkt an der Textstelle, und die Karte darf außerhalb des Sliders liegen.
> v6 macht den Textwechsel weich (Maske, kein CSS mehr nötig) — **wenn du die alte
> `is-swapping`-Regel in Webflow hast, lösche sie**, siehe Abschnitt 3.
> v7 lässt die Striche dem Scrollen weich nachlaufen (`data-stroke-smooth`).
> v9 gibt dem Bild-Karussell `data-brush-sticky-top` - damit rastet der Block frueher ein
> (siehe Abschnitt 4).
> v8 behebt das Flackern: die Deckkraft eines Strichs hing daran, wie weit er gemalt war,
> dadurch wurde er beim Scrollen hell und dunkel. Nichts davon musst du im Designer
> einstellen.
> Wenn du noch eine ältere Nummer eingebunden hast, tausche sie.

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

### Weicher Nachlauf (Smoothing) — seit `@v7` an

Der Strich hängt nicht mehr starr am Scrollwert, sondern läuft ihm weich nach — wie ein
Webflow-/GSAP-Scrub. Das ist standardmäßig an, du brauchst nichts zu setzen.

```html
data-stroke-smooth="0.12"    <!-- Sekunden. 0 schaltet ab (starr wie vorher). -->
```

Der Wert ist eine **Zeitkonstante in Sekunden**, keine Dauer: nach etwa dieser Zeit sind rund
zwei Drittel der Strecke zum Scrollwert aufgeholt, der Rest klingt aus. Größer = träger und
weicher, kleiner = direkter. Zum Anfassen: `0.05` ist fast direkt, `0.25` deutlich schleppend.

Warum das den Unterschied macht: ein Mausrad rastet grob, und ohne Nachlauf ist jede Rastung ein
Sprung im Strich. Gerechnet wird zeitbasiert, nicht pro Frame — auf einem 120-Hz-Bildschirm holt
der Strich also nicht doppelt so schnell auf wie auf einem mit 60 Hz.

### Alle Attribute der Striche

| Attribut | Wirkung | Standard |
|---|---|---|
| `data-edding-stroke` | Preset (siehe Tabelle) | — |
| `data-stroke-color` | Farbe überschreiben | je Preset |
| `data-stroke-scrub` | Scroll-Fenster in Bildschirmhöhen | `1.0 0.45` |
| `data-stroke-smooth` | Nachlauf in Sekunden, `0` = starr | `0.12` |
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

**Die Karte baust du EINMAL, und du kopierst nichts.** Die vier Textfassungen hängen als
Attribute direkt an dem Element, das sie betreffen. Kein Datenblock, keine zusätzlichen
Elemente.

```html
<div data-edding-pen-slider="hitze">

  <!-- Deine gestylte Karte. An jeder Textstelle, die wechseln soll:
       data-pen-field + die Fassungen für Stift 2, 3, 4. -->
  <div class="karte">
    <p data-pen-field="headline"
       data-pen-2="edding 8300 Industry Permanentmarker"
       data-pen-3="edding 50 Paint Marker"
       data-pen-4="edding 750 Paint Marker">edding 2000 C Permanentmarker</p>

    <p data-pen-field="body"
       data-pen-2="Hitzebeständige Tinte für raue und glatte Oberflächen."
       data-pen-3="Hitzebeständige Farbe für den industriellen Einsatz."
       data-pen-4="Hitzebeständige, glänzend deckende Beschichtung.">Die aufgetragene Farbe widersteht Hitze bis 300° Celsius. Sie ist auch UV-beständig.</p>

    <span data-pen-field="temp" data-pen-count-up
          data-pen-2="400" data-pen-3="250" data-pen-4="200">300</span>° C

    <p data-pen-field="label">Hitzebeständig</p>

    <a href="#">Zum Produkt</a>
  </div>

  <div data-pen-canvas style="aspect-ratio:990/770"></div>

  <button data-pen-prev aria-label="Vorheriger Stift">‹</button>
  <button data-pen-next aria-label="Nächster Stift">›</button>

</div>
```

So gehst du im Designer vor — an deinen bestehenden Elementen, es entsteht nichts Neues:

| Dein Element | Attribute unter *Settings → Custom attributes* |
|---|---|
| Headline (`heading-style-h4`) | `data-pen-field` = `headline`, dazu `data-pen-2`, `data-pen-3`, `data-pen-4` |
| Fließtext (`text-size-small`) | `data-pen-field` = `body`, dazu `data-pen-2/3/4` |
| Zahl (`count-up`) | `data-pen-field` = `temp`, `data-pen-count-up` (ohne Wert), dazu `data-pen-2/3/4` |
| Label (`text-size-tiny`) | `data-pen-field` = `label` — mehr nur, wenn der Text wechseln soll |

Drei Dinge, die Arbeit sparen:

- **`data-pen-1` brauchst du nicht.** Für Stift 1 bleibt der Text stehen, den du im Designer
  eingetippt hast. Setze es nur, wenn es davon abweichen soll.
- **Felder ohne `data-pen-*` bleiben unangetastet.** Das Label oben steht bei allen vier Stiften
  gleich, also braucht es nichts weiter.
- **Die Feldnamen sind frei.** `headline`/`body`/`temp`/`label` sind nur Beispiele; wichtig ist
  nur, dass jedes Feld einen eigenen Namen hat.

**Weicher Wechsel — brauchst du seit `@v6` nicht mehr selbst zu bauen.** Das Modul maskiert jedes
Feld: der alte Text fährt nach unten aus dem Sichtfenster, der neue kommt von unten wieder herein,
versetzt um 60 ms pro Feld. **Kein CSS nötig.**

> **Wenn du die alte Regel schon in Webflow stehen hast, lösche sie:**
> ```css
> [data-pen-field] { transition: opacity .25s ease, transform .25s ease; }
> .is-swapping [data-pen-field] { opacity: 0; transform: translateX(-12px); }
> ```
> Sie animiert gegen die Maske des Moduls — beides gleichzeitig wirkt zappelig. `is-swapping` wird
> nur noch gesetzt, wenn du den Maskenwechsel mit `data-pen-anim="none"` abschaltest.

Feinjustieren, alles am **Slider-Div**, alles optional:

| Attribut | Was | Standard |
|---|---|---|
| `data-pen-anim` | `mask` (Maskenwechsel) oder `none` (hart bzw. eigenes CSS) | `mask` |
| `data-pen-anim-out` | Dauer des Hinausfahrens in ms | `260` |
| `data-pen-anim-in` | Dauer des Hereinkommens in ms | `420` |
| `data-pen-anim-stagger` | Versatz zwischen den Feldern in ms, `0` = alle gleichzeitig | `60` |
| `data-pen-anim-dir` | `down` = raus nach unten, `up` = raus nach oben | `down` |
| `data-pen-anim-fade` | ohne Wert setzen: zusätzlich aus-/einblenden | aus |

Zwei Dinge, die dabei nicht offensichtlich sind:

- Das Modul legt in jedes Feld einen inneren `<span class="edding-pen__inner">` und maskiert das
  Feld per `clip-path` (nicht per `overflow`) — dadurch bleiben deine im Designer gesetzten
  Abstände unverändert. Nachgemessen: 0 px Versatz.
- Ist ein Feld ein Inline-Element, hebt das Modul es auf `inline-block` — sonst greift die Maske
  nicht. Wenn ein Feld dadurch plötzlich in einer eigenen Zeile sitzt, ist es in Webflow als
  Inline-Text gesetzt; ein Block- oder Inline-Block-Element als Feld nehmen.

**Hochzählende Zahl:** `data-pen-count-up` (ohne Wert) am Ziel-Feld. Die Zahl zählt dann in
450 ms zum neuen Wert hoch, statt zu springen.

Drei Dinge, die schiefgehen können:

- **Die Karte muss NICHT im Slider liegen.** Findet das Modul innerhalb von
  `data-edding-pen-slider` keine Felder, sucht es selbst nach oben — Elternteil um Elternteil,
  bis eines gefunden ist, das Felder enthält und nur einen Slider. Die typische
  Webflow-Struktur, bei der die Karte ein *Geschwister* des Slider-Blocks ist, funktioniert
  also von sich aus:

  ```
  padding-bottom
  ├── karte                 (data-pen-field-Attribute)
  └── slider-block          (data-edding-pen-slider + data-pen-canvas)
  ```

  Greift die Automatik nicht — etwa weil zwei Slider im selben Elternteil liegen —, setzt du
  `data-pen-target="<CSS-Selektor>"` am Slider auf ein Element, das Karte und Slider
  umschließt. In der Konsole zeigt `data-pen-debug` unter `felderGefunden` und `suchbereich`,
  was das Modul wirklich benutzt.
- **Die Zoom-Attribute (`data-pen-fov`, `data-pen-shift-y`) gehören an dasselbe Element** wie
  `data-edding-pen-slider`, nicht an das Canvas-Div — dort werden sie nicht gelesen.
- **Die Pfeil-Buttons nicht *in* das Canvas-Div legen.** Die Zeichenfläche wird darüber gelegt und
  fängt die Klicks ab. Daneben ist richtig.

**Zwei weitere Wege, die Texte zu hinterlegen**, falls dir Attribute für lange Fließtexte
unangenehm sind — beide funktionieren parallel, gesucht wird in dieser Reihenfolge:

1. `data-pen-1` … `data-pen-4` am Feld selbst (oben beschrieben).
2. Ein unsichtbarer Datenblock: ein Div mit `data-pen-data`, darin vier Divs mit
   `data-pen-slide`, in jedem je ein Text-Element mit demselben `data-pen-field`-Namen.
   Ungestylt, wird automatisch ausgeblendet.
3. Ganz ohne `data-pen-field`: vier fertig gestylte `data-pen-slide`-Blöcke, von denen der
   aktive eingeblendet wird. Dann pflegst du das Kartenlayout allerdings viermal.

Zwei Presets:

| Wert | Was | Zusätzlich nötig |
|---|---|---|
| `hitze` | oberes Karussell des Prototyps | — |
| `wasser` | unteres Karussell, andere Kamera, gespiegelte Reihenfolge | `data-pen-fov="1.3" data-pen-shift-x="0.2" data-pen-shift-y="-0.12"` |

**Achtung bei `wasser`:** dort ist die Stift-Reihenfolge gespiegelt (wie im Desktop-Prototyp) —
beim Laden steht **Stift 4** vorne, und „weiter" zählt abwärts. Die Nummern in `data-pen-1` … `-4`
bezeichnen weiterhin den Stift selbst (1 = 2000 C, 4 = 750), die Texte bleiben also richtig
zugeordnet. Nur: die Rückfall-Regel „Stift 1 nimmt den im Designer eingetippten Text" greift hier
erst am Ende der Reihe. Setz bei `wasser` deshalb alle vier Werte ausdrücklich, `data-pen-1`
eingeschlossen.

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
| `data-pen-2` … `-4` | am Feld: Text für Stift 2, 3, 4 | Feld bleibt |
| `data-pen-data` | am Container mit den vier Datensätzen | — |
| `data-pen-anim` | `mask` (weicher Maskenwechsel) \| `none` | `mask` |
| `data-pen-anim-out` / `-in` | Dauer raus / rein in ms | `260` / `420` |
| `data-pen-anim-stagger` | Versatz zwischen den Feldern in ms | `60` |
| `data-pen-anim-dir` | `down` \| `up` | `down` |
| `data-pen-anim-fade` | zusätzlich aus-/einblenden | aus |
| `data-pen-swap-ms` | nur bei `data-pen-anim="none"`: Dauer der `is-swapping`-Klasse | `250` |
| `data-pen-target` | CSS-Selektor: wo die Felder liegen, falls die Automatik daneben greift | automatisch |
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
dort keine Höhe einzustellen. `data-brush-sticky` bekommt automatisch `position: sticky` und den
`top`-Abstand; Sticky in Webflow einzustellen ist nicht nötig.

### Früher oder später einrasten

```html
data-brush-sticky-top="200"
```

Das ist der Abstand, in dem der Block unter dem oberen Bildschirmrand stehen bleibt — und
gleichzeitig der Regler für **wann** er einrastet. Ein **größerer** Wert heißt **früher**: der
Block trifft den Haltepunkt schon weiter unten auf dem Bildschirm. `0` (Standard) rastet erst ein,
wenn er ganz oben am Rand ankommt.

Steht auf deiner Seite oben eine feste Navigationsleiste, ist das auch der Wert, mit dem der Block
nicht darunter rutscht — dann die Höhe der Leiste eintragen.

Zwei Dinge macht das Modul dabei automatisch mit, damit nichts abgeschnitten wird:

- **Die Choreografie beginnt am Einrastpunkt**, nicht am Bildschirmrand. Sonst würde der Block
  erst festkleben und eine Weile nichts passieren.
- **Die Sektion wird um denselben Betrag höher.** Wer früher einrastet, löst sich auch früher —
  ohne den Zuschlag fehlte am Ende genau dieses Stück (nachgemessen: bei 200 px Versatz die
  letzten 200 px der Bildwechsel).

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
| `data-brush-sticky-top` | Abstand zum oberen Rand in px; **größer = früher einrasten** | `0` |
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
