// Natives Three.js-Karussell-Rig (Neubau, Nutzer-Vorgabe): Kreis-Pivot in der Mitte,
// jeder Stift haengt in einem eigenen "Socket"-Group AM Kreismittelpunkt. Dadurch gibt es
// zwei unabhaengige Bewegungsarten:
//   1. pivot.rotation.y dreht den GANZEN Kreis -> alle Stifte drehen mit (Karussell).
//   2. socket[i].rotation.y verschiebt EINEN Stift entlang des Kreises (Einzel-Animation).
// Beide sind reine Rotationen um die senkrechte Achse durch den Kreismittelpunkt, also
// starre Bewegungen - kein Stift wird verzerrt, Beschriftung bleibt lesbar.
//
// Der Ruhe-Zustand (alle Offsets 0, pivot 0) reproduziert EXAKT den bekannt-guten oberen
// Karussell-Stand: dieselben Stift-Weltposen und dieselbe Kamera, die frueher als gut
// bestaetigt waren. Die Platzierung nutzt weiterhin die bewaehrte "rig-Matrix"-Methode
// (Ziel-Weltmatrix * Inverse(bodyNode-Lokalmatrix) + Yaw um die eigene Achse), damit
// Koerper und Kappe relativ zueinander unveraendert bleiben.

// WEBFLOW-PORT: keine Importmap.
// Der Prototyp loest 'three' und 'three/addons/' ueber eine <script type="importmap"> in jeder
// HTML-Seite auf. Die muesste garantiert VOR jedem Modul-Script stehen - in Webflow/Slater nicht
// zuverlaessig erzwingbar. Der Kern kommt deshalb per absoluter URL direkt vom CDN.
//
// Der GLTFLoader kann das NICHT genauso: die Addon-Dateien von three importieren den Kern
// selbst mit dem Bare-Specifier 'three', eine absolute URL fuer den Loader allein reicht also
// nicht (daran ist der erste Versuch gescheitert). Er liegt deshalb unter src/vendor/ mit
// umgeschriebenem Import - Begruendung und Herkunft stehen im Kopf jener Dateien.
// Version durchgehend r160.1, exakt die des Prototyps.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';

// Kreismittelpunkt (three.js-Koordinaten, aus der BezierCircle-Hilfskurve in Blender).
const CIRCLE_CENTER = new THREE.Vector3(2.3550360202789307, 0, 0.0025328397750854492);

// Bekannt-guter oberer Stand ("wie es war"): pro Stift Weltposition + Weltrotation, die
// frueher als korrekt bestaetigt waren. Reihenfolge = Karussell-Index (0 = vorne/aktiv).
// Diese Posen brauchen zusaetzlich den PEN_YAW_UPPER (270 Grad), weil sie aus einer
// frueheren Extraktion stammen, die den finalen Yaw noch NICHT enthielt.
export const PENS_UPPER = [
  {
    key: '2000c', url: 'assets/models/edding_2000c_reoriented.glb',
    position: [0.7108259201049805, 0.006630327552556992, -0.0020480696111917496],
    quaternion: [0.5850213170051575, -0.3971776068210602, -0.5850212574005127, 0.3971777856349945],
  },
  {
    key: '8300', url: 'assets/models/edding_8300.glb',
    position: [0.8641248941421509, 0.0096205472946167, -0.7181776165962219],
    quaternion: [0.6686713695526123, -0.5197265148162842, -0.41984865069389343, 0.32632818818092346],
  },
  {
    key: '50', url: 'assets/models/edding_50.glb',
    position: [1.3314776420593262, 0.01981109380722046, -1.2692335844039917],
    quaternion: [0.7274273037910461, -0.5939787030220032, -0.26611995697021484, 0.21729937195777893],
  },
  {
    key: '750', url: 'assets/models/edding_750.glb',
    position: [1.9704675674438477, 0.015121638774871826, -1.5969667434692383],
    quaternion: [0.7440445423126221, -0.655665397644043, -0.09637496620416641, 0.08492729067802429],
  },
];

// Unteres Karussell ("andere Seite des Kreises"): live aus dem Blender-File extrahiert
// (Follow-Path-Rig + die vom Nutzer abgestimmte untere Kamera). Diese Weltposen enthalten
// die finale Ausrichtung bereits vollstaendig -> hier KEIN zusaetzlicher Yaw (penYawDeg=0).
export const PENS_LOWER = [
  {
    key: '2000c', url: 'assets/models/edding_2000c_reoriented.glb',
    position: [3.9923362731933594, 0, 0.04219388961791992],
    quaternion: [0.23889011144638062, 0.6563450694084167, 0.24476376175880432, 0.6724830269813538],
  },
  {
    key: '8300', url: 'assets/models/edding_8300.glb',
    position: [3.8152027130126953, 0, 0.7397833466529846],
    quaternion: [0.18792937695980072, 0.4895727038383484, 0.30513954162597656, 0.7949156761169434],
  },
  {
    key: '50', url: 'assets/models/edding_50.glb',
    position: [3.3591346740722656, 0, 1.2965339422225952],
    quaternion: [2.0678907475257802e-8, 0.3237098157405853, -7.074902885761958e-9, 0.94615638256073],
  },
  {
    key: '750', url: 'assets/models/edding_750.glb',
    position: [2.706780433654785, 0, 1.6008539199829102],
    quaternion: [0.029880337417125702, 0.10420506447553635, 0.2740129828453064, 0.9555968642234802],
  },
];

// Winkel-Schritt zwischen zwei benachbarten Stiften auf dem Kreis (die 4 Stifte sitzen
// 25.4 Grad auseinander). Karussell-Rotation = index * STEP_DEG * rotationSign.
const STEP_DEG = 25.4;

// Wie weit "hinten" der Kreis beim Reinfahren (Intro) startet, bevor er zur Ruhelage
// einrastet (Stifte kommen von ausserhalb des Bildes hereingedreht).
const INTRO_EXTRA_STEPS = 4.5;

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// Schnell rein, sehr sanft anhalten (Intro-Einfahrt).
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
// Weiches Beschleunigen/Abbremsen (Klick-Tween).
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Obere Kamera "wie es war" (bekannt-gut).
export const CAMERA_UPPER = {
  position: [-1.4742002487182617, 0.8940132856369019, 2.109125852584839],
  quaternion: [-0.14809714257717133, -0.24587832391262054, -0.038062289357185364, 0.9571636915206909],
};

// Untere Kamera, vom Nutzer in Blender abgestimmt (live extrahiert).
export const CAMERA_LOWER = {
  position: [2.1919798851013184, 1.1042978763580322, 4.700279712677002],
  quaternion: [-0.15796498954296112, -0.31462347507476807, -0.05320620909333229, 0.9344668388366699],
};
const CAMERA_HORIZONTAL_FOV_DEG = 54.43222311461495;

// WEBFLOW-PORT: assetBase.
// Im Prototyp stehen die Asset-Pfade relativ ohne fuehrenden Slash ('assets/models/...') und
// werden gegen die Seiten-URL aufgeloest. In Webflow liegt die Seite auf einer anderen Domain
// als die Dateien, deshalb bekommt das Rig eine Basis-URL und die Pfade sind nur noch
// Dateinamen. Faellt auf die Prototyp-Pfade zurueck, wenn keine Basis uebergeben wird - so
// laeuft die Datei auch unverändert im Prototyp-Ordner.
const DEFAULT_ASSET_BASE = 'assets/';
const PEN_DIR = 'pens/';
const ENV_FILE = 'env.jpg';

let sharedEnvTexture = null;
function loadSharedEnvTexture(assetBase) {
  if (!sharedEnvTexture) {
    sharedEnvTexture = new THREE.TextureLoader().load(assetBase + ENV_FILE);
    sharedEnvTexture.mapping = THREE.EquirectangularReflectionMapping;
    sharedEnvTexture.colorSpace = THREE.SRGBColorSpace;
  }
  return sharedEnvTexture;
}

export function createPenRig(canvas, opts = {}) {
  // 2000c-Fix: seine gespeicherte Orientierung war schief (Alt-Export). Da alle GLBs
  // identisch orientiert + auf dem Nullpunkt zentriert sind, leiten wir 2000c aus einem
  // korrekt sitzenden Nachbarn (8300) ab: diesen entlang des Kreises zur 2000c-Position
  // "schieben" = starre Drehung um die senkrechte Achse durch den Kreismittelpunkt (rotiert
  // Position UND Orientierung gemeinsam). So sitzt 2000c zwangslaeufig genauso gerade wie
  // die anderen - gilt fuer SET A und SET B gleichermassen.
  const PENS = (opts.pens || PENS_UPPER).map(p => ({ ...p }));
  (() => {
    const target = PENS.find(p => p.key === '2000c');
    const ref = PENS.find(p => p.key === '8300');
    if (!target || !ref) return;
    const c = CIRCLE_CENTER;
    const refRadial = new THREE.Vector3(ref.position[0] - c.x, 0, ref.position[2] - c.z).normalize();
    const tgtRadial = new THREE.Vector3(target.position[0] - c.x, 0, target.position[2] - c.z).normalize();
    const Ry = new THREE.Quaternion().setFromUnitVectors(refRadial, tgtRadial);
    const q = new THREE.Quaternion(...ref.quaternion).premultiply(Ry);
    target.quaternion = [q.x, q.y, q.z, q.w];
  })();
  const camDef = opts.camera || CAMERA_UPPER;
  // reverseCaps: Kappen-Animation in umgekehrter Stift-Reihenfolge (nur 2. Karussell) -
  // die sichtbare Reihenfolge dort ist gespiegelt (750, 50, 8300, 2000c), deshalb muss der
  // Slider die Kappen in dieser Reihenfolge oeffnen, damit immer der vorderste offen ist.
  const reverseCaps = !!opts.reverseCaps;
  // Meldet main.js den ARRAY-Index des jeweils vordersten Stifts (fuer das UI-Panel) - bei
  // reverseCaps gespiegelt, damit das Panel den Stift beschreibt, den man vorne sieht.
  const onIndexChange = opts.onIndexChange || (() => {});
  const penYawDeg = opts.penYawDeg !== undefined ? opts.penYawDeg : 270;
  const rotationSign = opts.rotationSign !== undefined ? opts.rotationSign : 1;
  const stepRad = THREE.MathUtils.degToRad(STEP_DEG);
  const yawRad = THREE.MathUtils.degToRad(penYawDeg);

  // WEBFLOW-PORT: Basis-URL fuer GLBs + Umgebungstextur. Aus def.url wird nur der Dateiname
  // uebernommen, damit PENS_UPPER/PENS_LOWER unveraendert bleiben koennen.
  const assetBase = opts.assetBase || DEFAULT_ASSET_BASE;
  const penUrl = (def) => assetBase + PEN_DIR + def.url.split('/').pop();

  // WEBFLOW-PORT: Bildwinkel und Kamera-Versatz justierbar.
  // Der Bildausschnitt entsteht aus dem festen horizontalen Bildwinkel PLUS dem
  // Seitenverhaeltnis der Canvas. Auf einem 390px-Hochformat ist die Canvas anders
  // proportioniert als die 990x770 des Desktops, also sitzt die Stiftgruppe anders im Bild.
  // fovScale weitet/engt den Bildwinkel, shift verschiebt die Kamera in ihrer eigenen
  // Bildebene (rechts/oben), ohne die Blickrichtung zu drehen - beides ueber Attribute im
  // Designer einstellbar, statt im Code geraten zu werden.
  const hFovDeg = CAMERA_HORIZONTAL_FOV_DEG * (opts.fovScale !== undefined ? opts.fovScale : 1);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(hFovDeg, 1, 0.1, 100);
  camera.position.set(...camDef.position);
  camera.quaternion.set(...camDef.quaternion);
  if (opts.shiftX || opts.shiftY) {
    // In der Bildebene der Kamera verschieben: ihre lokale X- bzw. Y-Achse in Weltkoordinaten.
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    camera.position.addScaledVector(right, opts.shiftX || 0);
    camera.position.addScaledVector(up, opts.shiftY || 0);
  }

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  // WEBFLOW-PORT: Zustand der pausierbaren Render-Loop (Erklaerung unten bei setRunning).
  // Muss VOR dem ersten resize()-Aufruf stehen, weil requestRender() darauf zugreift.
  let rafId = 0;
  let running = false;
  let destroyed = false;
  let frames = 0;    // Zaehler, damit sich das Pausieren von aussen nachmessen laesst
  let dirty = true;  // "es hat sich etwas geaendert, einmal neu zeichnen"

  scene.environment = loadSharedEnvTexture(assetBase);
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x55524a, 1.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
  keyLight.position.set(3, 5, 4);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
  fillLight.position.set(-3, 2, -2);
  scene.add(fillLight);

  // pivot sitzt am Kreismittelpunkt - pivot.rotation.y dreht das ganze Karussell.
  const pivot = new THREE.Group();
  pivot.position.copy(CIRCLE_CENTER);
  scene.add(pivot);

  // Live justierbare Zustaende: Basisdrehung des ganzen Kreises (bringt die Stifte auf die
  // andere Seite) und Roll um die Laengsachse (Labels zur Kamera). Beide aendern NIE die
  // eigentlichen Stift-Rotationswerte - nur Kreis-Drehung bzw. reiner Laengsachsen-Roll.
  let baseRotationRad = THREE.MathUtils.degToRad(opts.baseRotationDeg || 0);
  let lastV = 0;
  // Roll um die Laengsachse: ein globaler Wert fuer alle Stifte, plus optional ein eigener
  // Wert je Stift (null = globalen Wert nutzen). Noetig, weil einzelne Stift-Modelle ihre
  // Laengsachse anders "gebacken" haben (z.B. 2000c auf Y statt X) und deshalb einen anderen
  // Roll-Winkel brauchen, damit ihr Label genauso zur Kamera schaut.
  let globalRollDeg = opts.penRollDeg || 0;
  const penRollDeg = new Array(PENS.length).fill(null);
  if (opts.penRolls) opts.penRolls.forEach((v, i) => { if (v !== undefined && v !== null) penRollDeg[i] = v; });
  function effectiveRoll(i) { return penRollDeg[i] !== null ? penRollDeg[i] : globalRollDeg; }

  // Zusaetzliche Kippkorrektur pro Stift (Grad, um die lokale X-Achse) - NUR fuer Modelle
  // noetig, die anders exportiert sind (2000c: keine gebackene Rotation, laengs Y) und
  // dadurch eine kleine Schieflage tragen, die kein reiner Roll wegbekommt.
  const penTiltDeg = new Array(PENS.length).fill(0);
  if (opts.penTilts) opts.penTilts.forEach((v, i) => { if (v !== undefined && v !== null) penTiltDeg[i] = v; });
  const penTiltAxis = new Array(PENS.length).fill('x'); // 'x' | 'y' | 'z'
  if (opts.penTiltAxes) opts.penTiltAxes.forEach((v, i) => { if (v) penTiltAxis[i] = v; });
  const AXIS_VEC = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };

  const loader = new GLTFLoader();
  const pens = new Array(PENS.length).fill(null);

  const loadOne = (def, i) => new Promise((resolve) => {
    loader.load(
      penUrl(def), // WEBFLOW-PORT: assetBase + pens/ + Dateiname statt des Prototyp-Pfads
      (gltf) => {
        const model = gltf.scene;

        // Koerper-Node (alles ausser "Cogwheel...") mit seiner gebackenen Lokal-Transform.
        const bodyNode = model.children.find(c => !c.name.toLowerCase().includes('cogwheel'));
        const bodyLocal = new THREE.Matrix4().compose(bodyNode.position, bodyNode.quaternion, bodyNode.scale);

        // Ziel-Weltpose relativ zum Kreismittelpunkt.
        const targetPos = new THREE.Vector3(
          def.position[0] - CIRCLE_CENTER.x,
          def.position[1] - CIRCLE_CENTER.y,
          def.position[2] - CIRCLE_CENTER.z
        );
        const targetQuat = new THREE.Quaternion(...def.quaternion);
        const targetMatrix = new THREE.Matrix4().compose(targetPos, targetQuat, new THREE.Vector3(1, 1, 1));

        // rig-Matrix bewegt den GESAMTEN Verbund (Koerper+Kappe unveraendert zueinander) so,
        // dass der Koerper exakt auf der Ziel-Weltpose landet.
        const rigMatrix = targetMatrix.clone().multiply(bodyLocal.clone().invert());
        const rig = new THREE.Group();
        rigMatrix.decompose(rig.position, rig.quaternion, rig.scale);

        // Yaw um die senkrechte Achse durch den eigenen Nullpunkt (bekannt-gut).
        const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yawRad);
        rig.position.sub(targetPos).applyQuaternion(yawQuat).add(targetPos);
        rig.quaternion.premultiply(yawQuat);

        // Laengsachse + Schwerpunkt des Stifts im Modell-Lokalsystem bestimmen (VOR dem
        // Einhaengen, solange model noch bei Identitaet steht - dann ist die Bounding-Box im
        // Modell-Lokalraum). Laengsachse = groesste Bounding-Box-Dimension.
        model.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        let longAxis;
        if (size.x >= size.y && size.x >= size.z) longAxis = new THREE.Vector3(1, 0, 0);
        else if (size.y >= size.z) longAxis = new THREE.Vector3(0, 1, 0);
        else longAxis = new THREE.Vector3(0, 0, 1);

        // rollGroup sitzt genau im Stift-Schwerpunkt; ein Roll um longAxis dreht den Stift
        // NUR um seine eigene Laengsachse "an Ort und Stelle" (fuer Labels-zur-Kamera).
        // Netto-Verschiebung = 0 bei roll=0 (rollGroup.position=center, model.position-=center),
        // also aendert das Einfuegen die bekannt-gute Platzierung nicht.
        const rollGroup = new THREE.Group();
        rollGroup.position.copy(center);
        model.position.sub(center);
        rollGroup.add(model);
        rig.add(rollGroup);

        // socket = Group AM Kreismittelpunkt; socket.rotation.y verschiebt NUR diesen einen
        // Stift entlang des Kreises (Einzel-Animation), unabhaengig von pivot.rotation.y.
        const socket = new THREE.Group();
        socket.add(rig);
        pivot.add(socket);

        let mixer = null, action = null, clipRange = [0, 1];
        const clip = gltf.animations && gltf.animations[0];
        if (clip) {
          mixer = new THREE.AnimationMixer(model);
          action = mixer.clipAction(clip);
          action.play();
          action.paused = true;
          clipRange = [clip.tracks[0] ? clip.tracks[0].times[0] : 0, clip.duration];
          action.time = clipRange[0];
          mixer.update(0);
        }

        pens[i] = { socket, rig, rollGroup, longAxis, mixer, action, clipRange, capT: 0 };
        applyRoll(pens[i], i);
        resolve();
      },
      undefined,
      (err) => { console.error('Pen-GLB laden fehlgeschlagen:', penUrl(def), err); resolve(); }
    );
  });

  const ready = Promise.all(PENS.map(loadOne));

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    camera.aspect = w / h;
    const hFovRad = THREE.MathUtils.degToRad(hFovDeg); // WEBFLOW-PORT: ggf. per fovScale skaliert
    const vFovRad = 2 * Math.atan(Math.tan(hFovRad / 2) / camera.aspect);
    camera.fov = THREE.MathUtils.radToDeg(vFovRad);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    requestRender(); // WEBFLOW-PORT
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  function applyPenCap(pen, capT) {
    if (!pen || !pen.action) return;
    pen.capT = capT;
    const [a, b] = pen.clipRange;
    pen.action.time = a + (b - a) * capT;
    pen.mixer.update(0);
  }

  // Karussell-Rotation: dreht den ganzen Kreis, sodass der Stift mit Index v vorne steht,
  // und faedet die Kappen nach Naehe zu v ein/aus (bei Ganzzahl genau ein Stift offen).
  function setVirtualIndex(v) {
    const clamped = Math.min(PENS.length - 1, Math.max(0, v));
    lastV = clamped;
    pivot.rotation.y = baseRotationRad + rotationSign * clamped * stepRad;
    pens.forEach((pen, i) => {
      // capIndex = Slider-Position, bei der DIESER Stift vorne steht (Kappe offen). Normal =
      // Array-Index; bei reverseCaps gespiegelt (2. Karussell: 750,50,8300,2000c).
      const capIndex = reverseCaps ? (PENS.length - 1 - i) : i;
      const capT = Math.min(1, Math.max(0, 1 - Math.abs(clamped - capIndex)));
      applyPenCap(pen, capT);
    });
    // Array-Index des vordersten Stifts an das UI-Panel melden.
    const s = Math.round(clamped);
    onIndexChange(reverseCaps ? (PENS.length - 1 - s) : s);
    requestRender(); // WEBFLOW-PORT
  }

  // Intro-Einfahrt (vor dem Pin-Punkt): Kreis startet INTRO_EXTRA_STEPS "hinter" der Ruhe-
  // lage und faehrt smooth ein; der vorderste Ruhe-Stift oeffnet im letzten Drittel die Kappe.
  function setIntroProgress(p) {
    const t = easeOutQuint(clamp01(p));
    pivot.rotation.y = baseRotationRad + rotationSign * (-INTRO_EXTRA_STEPS * stepRad * (1 - t));
    const frontArrayIndex = reverseCaps ? (PENS.length - 1) : 0;
    const capT = clamp01((t - 0.7) / 0.3);
    pens.forEach((pen, i) => applyPenCap(pen, i === frontArrayIndex ? capT : 0));
    requestRender(); // WEBFLOW-PORT
  }

  // Klick auf Pfeil: tweent virtualIndex einen Schritt weiter/zurueck (rein 3D, kein Scroll).
  let clickAnimId = 0;
  function stepByClick(dir) {
    const from = lastV;
    const to = Math.min(PENS.length - 1, Math.max(0, Math.round(from) + dir));
    if (to === from) return;
    const myId = ++clickAnimId;
    const start = performance.now();
    const duration = 700;
    function tick(now) {
      if (myId !== clickAnimId) return;
      const t = Math.min(1, (now - start) / duration);
      setVirtualIndex(from + (to - from) * easeInOutCubic(t));
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  // Einzel-Animation: verschiebt EINEN Stift um deltaDeg entlang des Kreises (revolviert ihn
  // um den Kreismittelpunkt), ohne die anderen zu beruehren. Fuer spaetere "coolere"
  // Karussell-Effekte gedacht (Nutzer-Idee).
  function setPenOffset(index, deltaDeg) {
    const pen = pens[index];
    if (pen) pen.socket.rotation.y = THREE.MathUtils.degToRad(deltaDeg);
  }

  // Basisdrehung des ganzen Kreises (Grad) - bringt die Stifte auf die andere Seite, ohne
  // ihre eigenen Rotationswerte anzufassen. Live justierbar.
  function setBaseRotation(deg) {
    baseRotationRad = THREE.MathUtils.degToRad(deg);
    setVirtualIndex(lastV);
  }

  // Setzt den Roll eines Stifts um SEINE Laengsachse (in place). Einzige erlaubte Aenderung
  // an der Stift-Orientierung (Labels zur Kamera).
  function applyRoll(pen, i) {
    if (!pen) return;
    const rollQ = new THREE.Quaternion().setFromAxisAngle(pen.longAxis, THREE.MathUtils.degToRad(effectiveRoll(i)));
    const tiltAxisVec = AXIS_VEC[penTiltAxis[i]];
    const tiltQ = new THREE.Quaternion().setFromAxisAngle(tiltAxisVec, THREE.MathUtils.degToRad(penTiltDeg[i]));
    // erst Roll (um Laengsachse), dann Kippkorrektur - beide im rollGroup-Elternframe.
    pen.rollGroup.quaternion.copy(tiltQ).multiply(rollQ);
    requestRender(); // WEBFLOW-PORT
  }

  // Globaler Roll fuer alle Stifte, die keinen eigenen Wert haben.
  function setRoll(deg) {
    globalRollDeg = deg;
    pens.forEach((pen, i) => applyRoll(pen, i));
  }

  // Eigener Roll fuer EINEN Stift (uebersteuert den globalen) - z.B. 2000c, dessen Laengs-
  // achse anders gebacken ist. Immer noch reiner Laengsachsen-Roll.
  function setPenRoll(index, deg) {
    penRollDeg[index] = deg;
    applyRoll(pens[index], index);
  }

  // Kippkorrektur eines Stifts (Grad, lokale X-Achse) - Ausnahme fuer schief exportierte
  // Modelle wie 2000c.
  function setPenTilt(index, deg) {
    penTiltDeg[index] = deg;
    applyRoll(pens[index], index);
  }

  // WEBFLOW-PORT: pausierbare Render-Loop.
  // Im Prototyp laeuft tick() ab dem ersten Frame ununterbrochen weiter - zwei Slider auf einer
  // Seite sind also zwei dauerhafte WebGL-Loops, auch wenn beide weit ausserhalb des Bildes
  // stehen. Auf dem Desktop faellt das nicht auf, auf Mobile ist es der teuerste Posten
  // ueberhaupt (Akku, Hitze, dadurch gedrosselte Scroll-Framerate). Jetzt rendert das Rig nur,
  // wenn es sichtbar ist ODER wenn sich gerade etwas bewegt.
  function renderOnce() {
    renderer.render(scene, camera);
    frames++;
    dirty = false;
  }

  function tick() {
    if (destroyed) return;
    rafId = requestAnimationFrame(tick);
    if (!running) return;
    renderOnce();
  }

  // "Etwas hat sich geaendert." Laeuft die Loop (Slider ist im Bild), zeichnet sie im naechsten
  // Frame; laeuft sie nicht, wird genau EINMAL sofort gezeichnet. Damit stimmt das Bild auch
  // dann, wenn von aussen etwas gesetzt wird, waehrend der Slider gerade pausiert ist.
  function requestRender() {
    dirty = true;
    if (!running && !destroyed) renderOnce();
  }

  // running=false haelt die Loop an, zeichnet aber noch einen letzten Frame, falls seit dem
  // letzten Render etwas veraendert wurde (sonst bliebe ein halb gedrehtes Karussell stehen).
  function setRunning(next) {
    if (destroyed || running === !!next) return;
    running = !!next;
    if (running) {
      if (!rafId) rafId = requestAnimationFrame(tick);
    } else if (dirty) {
      renderOnce();
    }
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    resizeObserver.disconnect();
    // Geometrien/Materialien/Texturen der geladenen Modelle freigeben. Die Umgebungstextur
    // bleibt bewusst stehen: sie ist modulweit geteilt (sharedEnvTexture) und wuerde einem
    // zweiten, noch lebenden Rig unter den Fuessen weggezogen.
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
      for (const m of mats) {
        for (const key of Object.keys(m)) {
          const v = m[key];
          if (v && v.isTexture) v.dispose();
        }
        m.dispose();
      }
    });
    renderer.dispose();
  }

  ready.then(() => {
    if (destroyed) return;
    setVirtualIndex(0);
    rafId = requestAnimationFrame(tick);
    renderOnce(); // erster Frame auch dann, wenn noch nicht "running" ist
  });

  // Debug-Zugriff pro Instanz (kein globales Ueberschreiben mehr).
  const api = {
    ready,
    setVirtualIndex,
    setIntroProgress,
    setPenOffset,
    setBaseRotation,
    setRoll,
    setPenRoll,
    setPenTilt,
    stepNext: () => stepByClick(1),
    stepPrev: () => stepByClick(-1),
    get pensCount() { return PENS.length; },
    // WEBFLOW-PORT
    setRunning,
    destroy,
    get frameCount() { return frames; },
    get isRunning() { return running; },
    _debug: { scene, pivot, pens, camera, THREE },
  };
  return api;
}
