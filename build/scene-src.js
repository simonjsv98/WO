/* 3D-modellen av landet. Byggs till ../scene.js med `npm run build` (esbuild + three.js).
   Koordinater i meter: x längs landets bredd (väst → öst), y från framsidan (söder, där grinden och rabatten är) bakåt.
   I 3D: X = x - W/2, Z = D/2 - y (framsidan närmast kameran), Y uppåt. */
import {
  WebGLRenderer, Scene, PerspectiveCamera, Color, Fog, HemisphereLight, DirectionalLight, Group, Mesh,
  BoxGeometry, PlaneGeometry, CylinderGeometry, ConeGeometry, IcosahedronGeometry, DodecahedronGeometry, TorusGeometry,
  SphereGeometry, MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial, LineSegments, BufferGeometry, Float32BufferAttribute,
  InstancedMesh, Object3D, Raycaster, Vector2, Vector3, CanvasTexture, RepeatWrapping, SRGBColorSpace, PCFSoftShadowMap,
  ACESFilmicToneMapping, DoubleSide, MathUtils, Shape, ExtrudeGeometry, Box3
} from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

const C = {
  sky: 0xdcebf5, grass: 0x86a95a, chips: 0xc6a77c, soil: 0x3d2d22, wood: 0xc9a06e, white: 0xeeebe4,
  rust: 0x9a4a22, post: 0xa0602f, bamboo: 0xcdb57d, fleece: 0xffffff, red: 0xb8352a, compost: 0xc4532c, stone: 0x9b978f,
  select: 0x8cc152
};

// Speckled texture so ground surfaces don't look flat.
function speckle(base, dots, size = 256, n = 2600) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[i % dots.length];
    const w = 1 + Math.random() * 3, h = 1 + Math.random() * 2;
    g.save(); g.translate(Math.random() * size, Math.random() * size); g.rotate(Math.random() * Math.PI);
    g.fillRect(-w / 2, -h / 2, w, h); g.restore();
  }
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping; t.colorSpace = SRGBColorSpace; t.anisotropy = 4;
  return t;
}

const mat = (color, extra = {}) => new MeshStandardMaterial({ color, roughness: .9, metalness: 0, ...extra });

// Plant shapes. Each is a unit geometry; size and growth scale it.
const GEO = {
  blades: new ConeGeometry(.045, .42, 5).translate(0, .21, 0),
  rosette: new IcosahedronGeometry(.16, 0).scale(1, .55, 1).translate(0, .07, 0),
  feathery: new ConeGeometry(.1, .32, 6).translate(0, .16, 0),
  mound: new IcosahedronGeometry(.26, 1).scale(1, .7, 1).translate(0, .14, 0),
  brassica: new IcosahedronGeometry(.27, 1).scale(1, .8, 1).translate(0, .2, 0),
  tall: new CylinderGeometry(.12, .2, 1.1, 7).translate(0, .55, 0),
  vine: new CylinderGeometry(.06, .09, 1.2, 6).translate(0, .6, 0),
  big: new IcosahedronGeometry(.42, 1).scale(1, .45, 1).translate(0, .16, 0),
  flower: new IcosahedronGeometry(.11, 0).translate(0, .32, 0),
  bush: new IcosahedronGeometry(.22, 0).translate(0, .2, 0),
  stalk: new CylinderGeometry(.05, .07, 1.5, 6).translate(0, .75, 0),
  leaf: new IcosahedronGeometry(.5, 1).scale(1, .5, 1).translate(0, .3, 0)
};
const FLOWER_STEM = new CylinderGeometry(.012, .012, .32, 4).translate(0, .16, 0);

export function createScene(el, { onPick } = {}) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  // Full sharpness when still; while a finger turns the garden it draws at a lower resolution, which is much lighter.
  const FULL_DPR = Math.min(devicePixelRatio || 1, 2), MOVE_DPR = Math.min(FULL_DPR, 1);
  renderer.setPixelRatio(FULL_DPR);
  renderer.shadowMap.enabled = true;
  // Shadows are only redrawn when the sun, the plants or the garden change, not when the camera moves.
  renderer.shadowMap.autoUpdate = false;
  const dirtyShadows = () => { renderer.shadowMap.needsUpdate = true; };
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = SRGBColorSpace;
  el.appendChild(renderer.domElement);
  renderer.domElement.style.display = "block";
  renderer.domElement.style.touchAction = "none";

  const scene = new Scene();
  scene.background = new Color(C.sky);
  scene.fog = new Fog(C.sky, 28, 70);
  const camera = new PerspectiveCamera(38, 1, .1, 200);

  const hemi = new HemisphereLight(0xf4f8ff, 0x6a7a45, 1.25);
  scene.add(hemi);
  const sun = new DirectionalLight(0xfff3dc, 2.1);
  sun.position.set(-8, 14, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -.0004;
  sun.shadow.normalBias = .02;
  scene.add(sun, sun.target);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = .09;
  controls.maxPolarAngle = Math.PI * .47;
  controls.minDistance = 2;
  controls.maxDistance = 40;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.rotateSpeed = .8;

  const grassTex = speckle("#86a95a", ["#7b9d50", "#93b566", "#748f48", "#9bbd6e"], 256, 5000);
  const chipTex = speckle("#c6a77c", ["#b08f63", "#d8bc93", "#a27f55", "#e2cba6", "#8f6d48"], 256, 3800);
  const soilTex = speckle("#3d2d22", ["#33251b", "#4a372a", "#2b1f17", "#56402f"], 128, 1400);
  const ground = new Mesh(new PlaneGeometry(160, 160), mat(0xffffff, { map: grassTex }));
  grassTex.repeat.set(60, 60);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  let world = new Group();
  scene.add(world);
  let env = null;   // the trees around the garden, kept when the garden is rebuilt
  let beds = new Map();      // bed id -> { group, walls[], plants: Group, len, axis }
  let groups = new Map();    // any id -> its group, for the highlight ring
  let bounds = new Map();    // any id -> its box in 3D, kept after the static parts are merged (for tapping and the ring)
  let ring = null;
  let pickables = [];
  let size = { w: 10, d: 8 };
  let extra = { w: 0, d: 0, cx: 0, cz: 0 };
  let camDir = { x: .43, z: .9 };   // horizontal direction from the garden to the camera
  let selected = null;
  let firstFrame = true;

  /* ---------- Building the garden ---------- */
  function clear() {
    scene.remove(world);
    world.traverse(o => { if (o.isMesh || o.isLineSegments) { if (o.geometry && !Object.values(GEO).includes(o.geometry) && o.geometry !== FLOWER_STEM) o.geometry.dispose(); } });
    world = new Group();
    scene.add(world);
    beds = new Map();
    groups = new Map();
    bounds = new Map();
    ring = null;
    pickables = [];
  }
  const X = x => x - size.w / 2, Z = y => size.d / 2 - y;
  function box(w, h, d, material, x, y, z) {
    const m = new Mesh(new BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  // Rebar mesh between two corners on the ground, h high, as a grid of lines.
  function meshPanel(group, x1, y1, x2, y2, h, step = .2, y0 = .05) {
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < .05) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, pts = [];
    const P = (t, z) => [X(x1 + ux * t), z, Z(y1 + uy * t)];
    for (let t = 0; t <= len + 1e-6; t += step) pts.push(...P(t, y0), ...P(t, y0 + h));
    for (let z = y0; z <= y0 + h + 1e-6; z += step) pts.push(...P(0, z), ...P(len, z));
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    group.add(new LineSegments(g, new LineBasicMaterial({ color: C.rust, transparent: true, opacity: .55 })));
  }

  function fence(garden) {
    const { w, d } = garden, g = new Group(), H = 1.55;
    const gate = garden.gate || { side: "S", at: w - 1.5, w: 1 };
    const postMat = mat(C.post, { roughness: .8 });
    // Corners in order, with the side each edge belongs to.
    const sides = [["S", 0, 0, w, 0], ["E", w, 0, w, d], ["N", w, d, 0, d], ["W", 0, d, 0, 0]];
    for (const [side, ax, ay, bx, by] of sides) {
      const len = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / len, uy = (by - ay) / len;
      const spans = [];
      if (side === gate.side) {
        // "at" counts from the west (S/N) or from the front (E/W) edge.
        const along = side === "S" || side === "E" ? gate.at : len - gate.at - gate.w;
        spans.push([0, along], [along + gate.w, len]);
      } else spans.push([0, len]);
      for (const [a, b] of spans) {
        if (b - a < .05) continue;
        meshPanel(g, ax + ux * a, ay + uy * a, ax + ux * b, ay + uy * b, H - .1);
        const n = Math.max(1, Math.ceil((b - a) / 2.4));
        for (let i = 0; i <= n; i++) {
          const t = a + (b - a) * i / n;
          g.add(box(.075, H + .1, .075, postMat, X(ax + ux * t), (H + .1) / 2, Z(ay + uy * t)));
        }
      }
      if (side === gate.side) {
        // Gate: a wooden frame with a top beam and its own mesh, standing a little open.
        const along = side === "S" || side === "E" ? gate.at : len - gate.at - gate.w;
        const p1 = [ax + ux * along, ay + uy * along], p2 = [ax + ux * (along + gate.w), ay + uy * (along + gate.w)];
        const frame = mat(0x9a4e2a, { roughness: .8 });
        const gh = 2.0;
        for (const p of [p1, p2]) g.add(box(.09, gh, .09, frame, X(p[0]), gh / 2, Z(p[1])));
        const beam = box(gate.w + .2, .08, .09, frame, X((p1[0] + p2[0]) / 2), gh - .04, Z((p1[1] + p2[1]) / 2));
        if (side === "E" || side === "W") beam.rotation.y = Math.PI / 2;
        g.add(beam);
        // The door itself, swung 25° inwards.
        const door = new Group();
        const dw = gate.w - .06;
        door.add(box(.05, 1.5, .05, frame, 0, .8, 0), box(.05, 1.5, .05, frame, dw, .8, 0), box(dw, .05, .05, frame, dw / 2, 1.53, 0), box(dw, .05, .05, frame, dw / 2, .08, 0), box(dw, .05, .05, frame, dw / 2, .8, 0));
        const lines = new Group();
        meshPanelLocal(lines, dw, 1.4);
        door.add(lines);
        door.position.set(X(p1[0]), 0, Z(p1[1]));
        const base = side === "S" ? 0 : side === "N" ? Math.PI : side === "E" ? Math.PI / 2 : -Math.PI / 2;
        door.rotation.y = base + .45;
        g.add(door);
      }
    }
    world.add(g);
  }
  function meshPanelLocal(group, w, h, step = .15) {
    const pts = [];
    for (let t = 0; t <= w + 1e-6; t += step) pts.push(t, .1, 0, t, .1 + h, 0);
    for (let z = .1; z <= .1 + h + 1e-6; z += step) pts.push(0, z, 0, w, z, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    group.add(new LineSegments(g, new LineBasicMaterial({ color: C.rust })));
  }

  function groundPatch(garden) {
    // Wood chips inside the fence.
    const chips = new Mesh(new PlaneGeometry(garden.w, garden.d), mat(0xffffff, { map: chipTex }));
    chipTex.repeat.set(garden.w / 2, garden.d / 2);
    chips.rotation.x = -Math.PI / 2;
    chips.position.set(0, .006, 0);
    chips.receiveShadow = true;
    world.add(chips);
  }

  function bed(b) {
    if (b.finish === "stone") return stoneBed(b);
    const g = new Group(), h = b.h || .25, t = .045;
    const color = b.finish === "white" ? C.white : C.wood;
    const wall = mat(color, { roughness: .85 });
    g.add(
      box(b.w, h, t, wall, 0, h / 2, b.d / 2 - t / 2), box(b.w, h, t, wall, 0, h / 2, -b.d / 2 + t / 2),
      box(t, h, b.d - 2 * t, wall, b.w / 2 - t / 2, h / 2, 0), box(t, h, b.d - 2 * t, wall, -b.w / 2 + t / 2, h / 2, 0)
    );
    const soilMat = mat(0xffffff, { map: soilTex });
    const soil = box(b.w - 2 * t, h - .04, b.d - 2 * t, soilMat, 0, (h - .04) / 2, 0);
    soil.castShadow = false;
    g.add(soil);
    g.position.set(X(b.x + b.w / 2), 0, Z(b.y + b.d / 2));
    const walls = g.children.slice(0, 4);
    for (const m of g.children) { m.userData.bedId = b.id; pickables.push(m); }
    const plants = new Group();
    plants.userData.keep = true;
    plants.position.y = h - .04;
    g.add(plants);
    // Covers: hoops with fleece or net along the long side.
    const along = b.w >= b.d, L = along ? b.w : b.d, S = along ? b.d : b.w;
    if (b.cover === "fleece" || b.cover === "net") {
      const r = S / 2 - .02;
      const tunnel = new Mesh(new CylinderGeometry(r, r, L - .1, 24, 1, true, -Math.PI / 2, Math.PI),
        new MeshStandardMaterial({ color: C.fleece, transparent: true, opacity: b.cover === "fleece" ? .78 : .22, roughness: 1, side: DoubleSide, depthWrite: b.cover === "fleece" }));
      tunnel.rotation.z = Math.PI / 2;
      if (!along) tunnel.rotation.y = Math.PI / 2;
      tunnel.position.y = h;
      tunnel.castShadow = b.cover === "fleece";
      tunnel.userData.bedId = b.id; pickables.push(tunnel);
      g.add(tunnel);
      const hoopMat = mat(0xf3f3f0, { roughness: .5 });
      const n = Math.max(2, Math.round(L / .8));
      for (let i = 0; i <= n; i++) {
        const hoop = new Mesh(new TorusGeometry(r, .012, 6, 24, Math.PI), hoopMat);
        const p = -L / 2 + .06 + (L - .12) * i / n;
        if (along) { hoop.rotation.y = Math.PI / 2; hoop.position.set(p, h, 0); } else hoop.position.set(0, h, p);
        g.add(hoop);
      }
    } else if (b.cover === "hoops") {
      const r = S / 2 - .02, hoopMat = mat(0xf3f3f0, { roughness: .5 });
      const n = Math.max(2, Math.round(L / .9));
      for (let i = 0; i <= n; i++) {
        const hoop = new Mesh(new TorusGeometry(r, .012, 6, 24, Math.PI), hoopMat);
        const p = -L / 2 + .06 + (L - .12) * i / n;
        if (along) { hoop.rotation.y = Math.PI / 2; hoop.position.set(p, h, 0); } else hoop.position.set(0, h, p);
        g.add(hoop);
      }
    }
    if (b.trellis === "aframe") g.add(aframe(b, h, along));
    world.add(g);
    groups.set(b.id, g);
    beds.set(b.id, { group: g, walls, wallMat: wall, plants, data: b, h });
  }

  // Bamboo A-frame along the bed's long side, as on the pea bed.
  function aframe(b, h, along) {
    const g = new Group(), m = mat(C.bamboo, { roughness: .6 });
    const L = (along ? b.w : b.d) * .8, S = (along ? b.d : b.w) * .55, H = 1.9;
    const lean = Math.atan2(S / 2, H);
    const n = Math.max(3, Math.round(L / .3));
    for (let i = 0; i <= n; i++) {
      const p = -L / 2 + L * i / n;
      for (const s of [-1, 1]) {
        const cane = new Mesh(new CylinderGeometry(.012, .016, H / Math.cos(lean), 5), m);
        cane.position.set(p, h + H / 2, s * S / 4);
        cane.rotation.x = -s * lean;
        cane.castShadow = true;
        g.add(cane);
      }
    }
    for (const yy of [.35, H * .98]) {
      const bar = new Mesh(new CylinderGeometry(.012, .012, L + .2, 5), m);
      bar.rotation.z = Math.PI / 2;
      bar.position.set(0, h + yy, 0);
      if (yy < 1) { const b2 = bar.clone(); bar.position.z = S / 2 * (1 - yy / H) * .9; b2.position.set(0, h + yy, -S / 2 * (1 - yy / H) * .9); g.add(b2); }
      g.add(bar);
    }
    if (!along) g.rotation.y = Math.PI / 2;
    return g;
  }

  function item(it) {
    const g = new Group();
    if (it.type === "compost") {
      const m = mat(C.compost, { roughness: .85 }), t = .05, h = it.h || 1;
      // Open towards the garden: back and two sides, boards with gaps.
      for (let z = .08; z < h; z += .2) {
        g.add(box(it.w, .16, t, m, 0, z + .08, -it.d / 2 + t / 2));
        g.add(box(t, .16, it.d, m, -it.w / 2 + t / 2, z + .08, 0));
        g.add(box(t, .16, it.d, m, it.w / 2 - t / 2, z + .08, 0));
        if (z < .45) g.add(box(it.w, .16, t, m, 0, z + .08, it.d / 2 - t / 2));
      }
      const heap = new Mesh(new SphereGeometry(Math.min(it.w, it.d) * .42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x4b3a26));
      heap.scale.set(it.w / Math.min(it.w, it.d), .7, it.d / Math.min(it.w, it.d) * .9);
      heap.receiveShadow = true;
      g.add(heap);
    } else if (it.type === "obelisk") {
      const m = mat(C.red, { roughness: .7 }), H = it.h || 2.2, s = Math.min(it.w, it.d) * .5;
      const lean = Math.atan2(s, H);
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const leg = box(.05, H / Math.cos(lean), .05, m, sx * s / 4, H / 2, sz * s / 4);
        leg.rotation.set(-sz * lean * .5, 0, sx * lean * .5);
        g.add(leg);
      }
      for (const f of [.2, .45, .7]) {
        const w = s * (1 - f) + .04;
        for (const [rx, rz, rot] of [[0, w / 2, 0], [0, -w / 2, 0], [w / 2, 0, 1], [-w / 2, 0, 1]]) {
          const bar = box(w, .04, .04, m, rx, H * f, rz);
          if (rot) bar.rotation.y = Math.PI / 2;
          g.add(bar);
        }
      }
      const top = new Mesh(new ConeGeometry(.07, .25, 4), m);
      top.position.y = H + .1;
      g.add(top);
    } else if (it.type === "stool") {
      const m = mat(0xf4f2ee, { roughness: .6 });
      g.add(box(it.w, .04, it.d, m, 0, .45, 0));
      for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) g.add(box(.04, .45, .04, m, sx * (it.w / 2 - .04), .225, sz * (it.d / 2 - .04)));
    } else if (it.type === "border") {
      g.add(stoneEdge(it.w, it.d));
    } else if (it.type === "trellis") {
      const m = mat(C.bamboo, { roughness: .6 }), H = it.h || 2.1;
      const n = Math.max(2, Math.round(it.w / .25));
      for (let i = 0; i <= n; i++) {
        for (const s of [-1, 1]) {
          const cane = new Mesh(new CylinderGeometry(.012, .015, H, 5), m);
          cane.position.set(-it.w / 2 + it.w * i / n, H / 2, 0);
          cane.rotation.z = s * .18;
          g.add(cane);
        }
      }
    }
    g.position.set(X(it.x + it.w / 2), 0, Z(it.y + it.d / 2));
    if (it.rot) g.rotation.y = -it.rot * Math.PI / 180;
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.userData.itemId = it.id; pickables.push(o); } });
    world.add(g);
    groups.set(it.id, g);
  }

  // A bed edged with stones, flush with the grass.
  function stoneEdge(w, d) {
    const g = new Group();
    const soil = new Mesh(new PlaneGeometry(w, d), mat(0xffffff, { map: soilTex }));
    soil.rotation.x = -Math.PI / 2; soil.position.y = .012; soil.receiveShadow = true;
    g.add(soil);
    const per = 2 * (w + d), n = Math.round(per / .22);
    const stones = new InstancedMesh(new DodecahedronGeometry(.1, 0), mat(C.stone, { roughness: 1 }), n);
    const o = new Object3D();
    for (let i = 0; i < n; i++) {
      let t = i / n * per, x, z;
      if (t < w) { x = -w / 2 + t; z = d / 2; }
      else if ((t -= w) < d) { x = w / 2; z = d / 2 - t; }
      else if ((t -= d) < w) { x = w / 2 - t; z = -d / 2; }
      else { t -= w; x = -w / 2; z = -d / 2 + t; }
      const s = .6 + rand(i) * .9;
      o.position.set(x, .04, z); o.rotation.set(rand(i + 1) * 3, rand(i + 2) * 3, 0); o.scale.set(s, s * .7, s);
      o.updateMatrix(); stones.setMatrixAt(i, o.matrix);
    }
    stones.castShadow = stones.receiveShadow = true;
    g.add(stones);
    return g;
  }
  function stoneBed(b) {
    const g = stoneEdge(b.w, b.d);
    g.position.set(X(b.x + b.w / 2), 0, Z(b.y + b.d / 2));
    g.traverse(o => { if (o.isMesh) { o.userData.bedId = b.id; pickables.push(o); } });
    const plants = new Group();
    plants.userData.keep = true;
    plants.position.y = .01;
    g.add(plants);
    world.add(g);
    groups.set(b.id, g);
    // The ring of stones lights up when chosen.
    const stones = g.children[1];
    beds.set(b.id, { group: g, walls: [], wallMat: stones.material, plants, data: b, h: 0 });
  }

  /* ---------- What shades the garden: buildings and higher ground ----------
     Each obstacle stands on its own ground level (base, metres above the garden's ground). Buildings have a gable roof
     with the ridge along their longer side. */
  function obstacle(o) {
    const g = new Group();
    const cx = X(o.x + o.w / 2), cz = Z(o.y + o.d / 2);
    if (o.type === "terrace") {
      // Higher ground: flat on top, sloping down to its east edge (towards the garden) over ramp metres.
      // foot: the side (in the garden's axes) where the slope meets the garden's level. E = +x, W = −x, N = +y (back), S = −y.
      const foot = o.foot || "E", across = foot === "E" || foot === "W";
      const span = across ? o.w : o.d, depth = across ? o.d : o.w;
      const h = Math.max(.05, o.ridge || 1), ramp = Math.min(span, Math.max(.01, o.ramp || .01));
      const sh = new Shape();
      sh.moveTo(span / 2, 0); sh.lineTo(span / 2 - ramp, h); sh.lineTo(-span / 2, h); sh.lineTo(-span / 2, 0); sh.closePath();
      const geo = new ExtrudeGeometry(sh, { depth, bevelEnabled: false });
      geo.translate(0, 0, -depth / 2);
      const m = new Mesh(geo, new MeshStandardMaterial({ color: 0x9fb87a, map: grassTex, roughness: .95 }));
      m.rotation.y = { E: 0, W: Math.PI, N: Math.PI / 2, S: -Math.PI / 2 }[foot];
      m.position.set(cx, o.base || 0, cz);
      m.receiveShadow = m.castShadow = true;
      g.add(m);
    } else {
      const base = o.base || 0, e = o.eaves || 4, r = Math.max(e, o.ridge || e);
      const walls = mat(0x8E2B20, { roughness: .85 }), roof = mat(0x2C2C2E, { roughness: .7 });
      // The ground it stands on, if it is higher than the garden.
      if (base > .01) {
        const plinth = box(o.w + 1, base, o.d + 1, mat(0x6f5a3f, { roughness: 1 }), cx, base / 2, cz);
        g.add(plinth);
      }
      g.add(box(o.w, e, o.d, walls, cx, base + e / 2, cz));
      const alongZ = o.d >= o.w, span = (alongZ ? o.w : o.d) + .5, len = (alongZ ? o.d : o.w) + .5;
      const sh = new Shape();
      sh.moveTo(-span / 2, 0); sh.lineTo(span / 2, 0); sh.lineTo(0, r - e + .15); sh.closePath();
      const geo = new ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
      geo.translate(0, 0, -len / 2);
      const rm = new Mesh(geo, roof);
      rm.position.set(cx, base + e - .05, cz);
      if (!alongZ) rm.rotation.y = Math.PI / 2;
      rm.castShadow = rm.receiveShadow = true;
      g.add(rm);
    }
    g.traverse(m => { if (m.isMesh) { m.userData.obsId = o.id; pickables.push(m); } });
    world.add(g);
    groups.set(o.id, g);
  }

  /* ---------- Plants ---------- */
  function rand(i) { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  // One material per colour, shared by all plants of that colour.
  const plantMats = new Map();
  function plantMat(color) {
    if (!plantMats.has(color)) plantMats.set(color, mat(color, { roughness: .75 }));
    return plantMats.get(color);
  }
  function plantsFor(entry, list) {
    const { plants, data: b } = entry;
    for (const c of plants.children) if (c.isInstancedMesh) c.dispose();
    plants.clear();
    const along = b.w >= b.d, L = along ? b.w : b.d, S = along ? b.d : b.w;
    for (const p of list) {
      if (p.grow <= 0) continue;
      const shape = GEO[p.shape] ? p.shape : "rosette";
      const sp = Math.max(.08, p.spacing || .3);
      const from = (p.from ?? 0) * L, to = (p.to ?? 1) * L, segL = Math.max(.05, to - from - .08);
      const usableS = Math.max(.05, S - .14);
      const rows = Math.max(1, Math.floor(usableS / sp + .001)), cols = Math.max(1, Math.floor(segL / sp + .001));
      const n = Math.min(400, rows * cols);
      const leaf = plantMat(p.color || 0x5f9d3e);
      const inst = new InstancedMesh(GEO[shape], leaf, n);
      inst.castShadow = true; inst.receiveShadow = true;
      const o = new Object3D();
      let k = 0, flowers = [];
      for (let r = 0; r < rows && k < n; r++) for (let c = 0; c < cols && k < n; c++) {
        const a = -L / 2 + from + .04 + segL * (c + .5) / cols + (rand(k + p.seed) - .5) * sp * .25;
        const s2 = -usableS / 2 + usableS * (r + .5) / rows + (rand(k + p.seed + 9) - .5) * sp * .25;
        const s = (p.size || 1) * (.25 + .75 * p.grow) * (.85 + rand(k + p.seed + 3) * .3);
        if (along) o.position.set(a, 0, s2); else o.position.set(s2, 0, a);
        o.rotation.set(0, rand(k + p.seed + 5) * 6.28, shape === "blades" || shape === "feathery" ? (rand(k) - .5) * .25 : 0);
        o.scale.set(s, shape === "tall" || shape === "vine" || shape === "stalk" ? (.15 + .85 * p.grow) * (p.size || 1) : s, s);
        o.updateMatrix();
        inst.setMatrixAt(k, o.matrix);
        if (p.fruit && p.grow > .75) flowers.push(o.matrix.clone());
        k++;
      }
      inst.count = k;
      inst.userData.bedId = b.id;
      plants.add(inst);
      pickables.push(inst);
      // Fruit or flowers show once the crop is close to ready.
      if (flowers.length) {
        const fm = new InstancedMesh(GEO.flower, plantMat(p.fruit), flowers.length);
        flowers.forEach((m, i) => fm.setMatrixAt(i, m));
        fm.castShadow = true;
        plants.add(fm);
      }
    }
  }

  /* ---------- Camera ---------- */
  function frame(animate) {
    const span = Math.max(size.w + extra.w, (size.d + extra.d) * 1.2);
    const aspect = camera.aspect || 1;
    const dist = span * (aspect < 1 ? 1.45 : aspect < 1.4 ? 1.15 : .95) + 2;
    const to = new Vector3(camDir.x * dist * .88, dist * .62, camDir.z * dist * .88);
    controls.target.set(0, 0, 0);
    if (animate) {
      const from = to.clone().multiplyScalar(1.5).add(new Vector3(camDir.z * dist * .6, dist * .3, -camDir.x * dist * .6));
      camera.position.copy(from);
      const start = performance.now(), ms = 1300;
      const step = now => {
        const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(from, to, e);
        controls.update();
        render();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    } else { camera.position.copy(to); controls.update(); }
    controls.maxDistance = dist * 2.2;
  }

  /* ---------- Render loop: only while something moves ---------- */
  let raf = 0, alive = true;
  function render() { renderer.render(scene, camera); }
  let lowRes = false;
  function loop() {
    raf = 0;
    if (!alive) return;
    const moved = controls.update();
    if ((moved || dragging) && !lowRes && MOVE_DPR < FULL_DPR) { lowRes = true; renderer.setPixelRatio(MOVE_DPR); }
    if (!moved && !dragging && lowRes) { lowRes = false; renderer.setPixelRatio(FULL_DPR); }
    render();
    if (moved || dragging) raf = requestAnimationFrame(loop);
  }
  const kick = () => {
    // Keep the point the camera turns around near the garden, so it can't be lost off in the fields.
    const lim = Math.max(size.w, size.d) / 2 + 15, t = controls.target;
    t.x = Math.max(-lim, Math.min(lim, t.x)); t.z = Math.max(-lim, Math.min(lim, t.z)); t.y = Math.max(0, Math.min(6, t.y));
    if (!raf && alive) raf = requestAnimationFrame(loop);
  };
  controls.addEventListener("change", kick);
  let dragging = false;
  controls.addEventListener("start", () => { dragging = true; kick(); });
  controls.addEventListener("end", () => { dragging = false; kick(); });

  function resize() {
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = w + "px";
    renderer.domElement.style.height = h + "px";
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    render();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(el);

  /* ---------- Tap a bed ---------- */
  const ray = new Raycaster(), ptr = new Vector2();
  let down = null;
  renderer.domElement.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  renderer.domElement.addEventListener("pointerup", e => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
    down = null;
    if (moved > 8 || dt > 500) return;
    const r = renderer.domElement.getBoundingClientRect();
    ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    onPick && onPick(pickAt(ray));
  });

  // What the finger hit: the nearest box along the ray. Beds and things in the garden before buildings and higher ground.
  const hitP = new Vector3();
  function pickAt(r) {
    let best = null, bestD = Infinity, far = null, farD = Infinity;
    for (const [id, b] of bounds) {
      if (!r.ray.intersectBox(b.box, hitP)) continue;
      const d = hitP.distanceTo(r.ray.origin);
      if (b.big) { if (d < farD) { farD = d; far = id; } } else if (d < bestD) { bestD = d; best = id; }
    }
    return best || far;
  }
  // Glide the camera so the chosen thing is in the middle, keeping the angle; come closer if far away.
  let focusAnim = 0;
  function focus(id) {
    const b = bounds.get(id);
    if (!b || b.terrace) return;
    cancelAnimationFrame(focusAnim);
    const c = b.box.getCenter(new Vector3()); c.y = 0;
    const t0 = controls.target.clone(), p0 = camera.position.clone();
    const off = p0.clone().sub(t0), want = Math.max(6, Math.min(off.length(), b.box.getSize(new Vector3()).length() * 2.2 + 3));
    off.setLength(want);
    const t1 = c, p1 = c.clone().add(off);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { controls.target.copy(t1); camera.position.copy(p1); controls.update(); render(); return; }
    const start = performance.now(), ms = 650;
    const step = now => {
      const k = Math.min(1, (now - start) / ms), e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      controls.target.lerpVectors(t0, t1, e); camera.position.lerpVectors(p0, p1, e);
      controls.update(); render();
      if (k < 1) focusAnim = requestAnimationFrame(step);
    };
    focusAnim = requestAnimationFrame(step);
  }
  // Straight from above, or back to the usual view.
  let topView = false;
  function setTop(on) {
    topView = on;
    cancelAnimationFrame(focusAnim);
    const t0 = controls.target.clone(), p0 = camera.position.clone();
    const span = Math.max(size.w, size.d) * (camera.aspect < 1 ? 2.1 : 1.35) + 2;
    const t1 = on ? new Vector3(0, 0, 0) : new Vector3(0, 0, 0);
    let p1;
    if (on) { const a = Math.atan2(p0.x - t0.x, p0.z - t0.z); p1 = new Vector3(Math.sin(a) * .01, span, Math.cos(a) * .01); controls.maxPolarAngle = 0.0001; }
    else { controls.maxPolarAngle = Math.PI * .47; frame(true); return; }
    const start = performance.now(), ms = 700;
    const step = now => {
      const k = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - k, 3);
      controls.target.lerpVectors(t0, t1, e); camera.position.lerpVectors(p0, p1, e);
      controls.update(); render();
      if (k < 1) focusAnim = requestAnimationFrame(step); else controls.maxPolarAngle = .35;
    };
    focusAnim = requestAnimationFrame(step);
  }

  /* Everything that stands still (fence, bed frames, hoops, barn, compost...) is merged into one mesh per material,
     so the phone draws a handful of objects instead of hundreds. Plants and the ring stay separate. */
  function bake() {
    world.updateMatrixWorld(true);
    const buckets = new Map(), done = [];
    world.traverse(o => {
      if (o.isInstancedMesh || o.userData.keep || !(o.isMesh || o.isLineSegments)) return;
      let p = o.parent; while (p) { if (p.userData.keep) return; p = p.parent; }
      const m = o.material;
      const key = o.isLineSegments ? `L${m.color.getHex()}|${m.opacity}`
        : `M${m.type}|${m.color.getHex()}|${m.map ? m.map.uuid : ""}|${m.transparent}|${m.opacity}|${m.side}|${m.depthWrite}|${m.roughness}|${o.castShadow}|${o.receiveShadow}`;
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      g.clearGroups();
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      if (o.isMesh && !g.attributes.uv) g.setAttribute("uv", new Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      if (!buckets.has(key)) buckets.set(key, { obj: o, geos: [] });
      buckets.get(key).geos.push(g);
      done.push(o);
    });
    for (const o of done) { o.parent.remove(o); if (o.geometry && !Object.values(GEO).includes(o.geometry)) o.geometry.dispose(); }
    for (const { obj, geos } of buckets.values()) {
      const g = mergeGeometries(geos, false);
      geos.forEach(x => x.dispose());
      if (!g) continue;
      const m = obj.isLineSegments ? new LineSegments(g, obj.material) : new Mesh(g, obj.material);
      m.castShadow = obj.castShadow; m.receiveShadow = obj.receiveShadow;
      m.userData.baked = true;
      world.add(m);
    }
  }
  // Boxes for tapping and the ring, taken before the merge.
  function measure(garden) {
    const add = (id, g, extra) => { if (!g) return; const box = new Box3().setFromObject(g); if (!box.isEmpty()) bounds.set(id, { box, ...extra }); };
    for (const b of garden.beds) { const g = groups.get(b.id); add(b.id, g); const e = bounds.get(b.id); if (e) e.box.max.y = Math.max(e.box.max.y, .9); }
    for (const it of garden.items || []) add(it.id, groups.get(it.id));
    for (const o of garden.obstacles || []) add(o.id, groups.get(o.id), { big: true, terrace: o.type === "terrace" });
  }

  // Smooth growth: the plant list eases from the old growth to the new.
  let growAnim = 0;
  function setPlants(byBed, animate) {
    cancelAnimationFrame(growAnim);
    const targets = new Map(Object.entries(byBed));
    const prev = new Map([...beds].map(([id, e]) => [id, e.last || []]));
    const apply = t => {
      for (const [id, e] of beds) {
        const want = targets.get(id) || [];
        const was = prev.get(id) || [];
        const list = want.map(p => {
          const old = was.find(q => q.id === p.id);
          const g0 = old ? old.grow : 0;
          return { ...p, grow: g0 + (p.grow - g0) * t };
        });
        // Plants that disappear shrink away.
        for (const q of was) if (!want.find(p => p.id === q.id)) list.push({ ...q, grow: q.grow * (1 - t) });
        plantsFor(e, list);
        if (t >= 1) e.last = want;
      }
      dirtyShadows();
      render();
    };
    if (!animate) return apply(1);
    const start = performance.now(), ms = 420;
    const step = now => {
      const t = Math.min(1, (now - start) / ms), e = 1 - Math.pow(1 - t, 3);
      apply(e);
      if (t < 1) growAnim = requestAnimationFrame(step);
    };
    growAnim = requestAnimationFrame(step);
  }

  // The chosen bed (or thing) gets a glowing yellow ring on the ground around it, which settles in.
  let ringAnim = 0;
  function highlight(id) {
    selected = id;
    if (ring) { world.remove(ring); ring.traverse(m => m.geometry && m.geometry.dispose()); ring = null; }
    cancelAnimationFrame(ringAnim);
    const bx = id && bounds.get(id);
    if (bx && !bx.terrace) {
      const bb = bx.box;
      const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z, pad = .12, t = .09;
      const m = new MeshBasicMaterial({ color: 0xF2C94C, transparent: true, opacity: .95, depthWrite: false });
      ring = new Group();
      ring.userData.keep = true;
      const W = w + 2 * pad, Dd = d + 2 * pad;
      for (const [rw, rd, x, z] of [[W + t, t, 0, Dd / 2], [W + t, t, 0, -Dd / 2], [t, Dd, W / 2, 0], [t, Dd, -W / 2, 0]]) {
        const b = new Mesh(new BoxGeometry(rw, .04, rd), m);
        b.position.set(x, .03, z);
        ring.add(b);
      }
      ring.position.set((bb.min.x + bb.max.x) / 2, Math.max(0, bb.min.y), (bb.min.z + bb.max.z) / 2);
      world.add(ring);
      if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const start = performance.now();
        const step = now => {
          const k = Math.min(1, (now - start) / 320), e = 1 - Math.pow(1 - k, 3);
          ring.scale.set(1 + (1 - e) * .25, 1, 1 + (1 - e) * .25 * (W / Dd > 1 ? W / Dd : 1));
          m.opacity = .95 * e;
          render();
          if (k < 1) ringAnim = requestAnimationFrame(step);
        };
        ringAnim = requestAnimationFrame(step);
      }
    }
    render();
  }

  return {
    // Rebuilds the whole garden from data. plants: { bedId: [{ id, shape, color, size, spacing, from, to, grow, fruit, seed }] }
    build(garden, plants) {
      size = { w: garden.w, d: garden.d };
      clear();
      groundPatch(garden);
      fence(garden);
      for (const b of garden.beds) bed(b);
      for (const it of garden.items || []) item(it);
      for (const o of garden.obstacles || []) obstacle(o);
      // The camera looks at the garden from the side away from the largest building, a little from the side, so the
      // building stands behind the garden instead of in front of it.
      const big = (garden.obstacles || []).filter(o => o.type !== "terrace").sort((a, b) => b.w * b.d - a.w * a.d)[0];
      if (big) {
        const bx = X(big.x + big.w / 2), bz = Z(big.y + big.d / 2), l = Math.hypot(bx, bz) || 1;
        const a = Math.atan2(-bx / l, -bz / l) + .6;   // away from the building, turned 35°
        camDir = { x: Math.sin(a), z: Math.cos(a) };
      } else camDir = { x: .43, z: .9 };
      // Shadows cover the garden and whatever casts shade on it.
      let half = Math.max(garden.w, garden.d) / 2 + 3;
      if (env) half = Math.max(half, 45);   // nearby trees cast shadows on the garden too
      for (const o of (garden.obstacles || []).filter(o => o.type !== "terrace")) half = Math.max(half, Math.abs(X(o.x)) + 2, Math.abs(X(o.x + o.w)) + 2, Math.abs(Z(o.y)) + 2, Math.abs(Z(o.y + o.d)) + 2);
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half, near: 1, far: 140 });
      sun.shadow.camera.updateProjectionMatrix();
      measure(garden);
      bake();
      dirtyShadows();
      for (const e of beds.values()) e.last = [];
      setPlants(plants, false);
      if (selected) highlight(selected);
      if (firstFrame) { resize(); frame(!matchMedia("(prefers-reduced-motion: reduce)").matches); firstFrame = false; }
      render();
    },
    // The sun from the app: x and y are the horizontal direction to the sun in the garden's own axes, alt its height (radians).
    sun(dir) {
      const alt = dir.alt, up = Math.max(alt, -.2);
      const c = Math.cos(up);
      sun.target.position.set(0, 0, 0);
      sun.position.set(dir.x * c * 60, Math.sin(up) * 60, -dir.y * c * 60);
      const day = Math.max(0, Math.min(1, alt / .35));          // full light from 20° up
      const dawn = Math.max(0, Math.min(1, (alt + .1) / .2));   // twilight
      sun.intensity = alt > 0 ? .5 + 2 * day : 0;
      sun.color.setHSL(.09, .55 + .35 * (1 - day), .62 + .25 * day);
      hemi.intensity = .25 + .75 * dawn;
      const sky = new Color(0x1c2638).lerp(new Color(0xf2b98a), Math.min(1, dawn * 1.6)).lerp(new Color(C.sky), day);
      scene.background = sky; scene.fog.color = sky;
      dirtyShadows();
      render();
    },
    /* Trees around the garden from the height data: a crown on every 2 m where trees stand, as tall as measured.
       sur: { n, unit, ground, trees } with row 0 to the north and the garden's centre in the middle; orient: the compass
       bearing of the garden's back, to turn the world's east and north into the garden's axes. */
    surround(sur, orient) {
      if (env) { scene.remove(env); env.traverse(m => { if (m.geometry) m.geometry.dispose(); if (m.material) m.material.dispose(); }); env = null; }
      if (!sur) return;
      const n = sur.n, R = n / 2, o = orient * Math.PI / 180, co = Math.cos(o), so = Math.sin(o);
      const crowns = [];
      for (let r = 0; r < n - 1; r += 2) for (let c = 0; c < n - 1; c += 2) {
        let h = 0, gr = 0;
        for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) { const i = (r + dr) * n + c + dc; h = Math.max(h, sur.trees[i]); gr = Math.max(gr, sur.ground[i]); }
        h *= sur.unit; gr *= sur.unit;
        if (h < 2.5) continue;
        const e = c + 1 - R, nn = R - (r + 1);
        crowns.push([e * co - nn * so, e * so + nn * co, h, gr, crowns.length]);
      }
      env = new Group();
      const o3 = new Object3D(), col = new Color();
      // Crowns near the garden are rounder; the far ones use a simpler shape, which looks the same at a distance.
      const nearC = crowns.filter(c => Math.hypot(c[0], c[1]) < 30), farC = crowns.filter(c => Math.hypot(c[0], c[1]) >= 30);
      const crownMat = mat(0xffffff, { roughness: .9 });
      const instN = new InstancedMesh(new IcosahedronGeometry(1, 1), crownMat, Math.max(1, nearC.length));
      const instF = new InstancedMesh(new IcosahedronGeometry(1, 0), crownMat, Math.max(1, farC.length));
      instN.count = nearC.length; instF.count = farC.length;
      const trunks = new InstancedMesh(new CylinderGeometry(.12, .18, 1, 6).translate(0, .5, 0), mat(0x5b4632), crowns.length);
      const idx = new Map([...nearC.map((c, k) => [c[4], [instN, k]]), ...farC.map((c, k) => [c[4], [instF, k]])]);
      crowns.forEach(([dx, dy, h, gr, i]) => {
        const [inst, k] = idx.get(i);
        const ch = Math.max(1.6, Math.min(9, h * .55)), rad = 1.45 + rand(i) * .5;
        o3.position.set(dx + (rand(i + 7) - .5) * .6, gr + h - ch / 2, -dy + (rand(i + 9) - .5) * .6);
        o3.rotation.set(0, rand(i + 3) * 6, 0); o3.scale.set(rad, ch / 2, rad); o3.updateMatrix();
        inst.setMatrixAt(k, o3.matrix);
        inst.setColorAt(k, col.setHSL(.27 + rand(i + 5) * .06, .38 + rand(i + 1) * .2, .2 + rand(i + 2) * .1));
        o3.position.set(dx, gr, -dy); o3.rotation.set(0, 0, 0); o3.scale.set(1, Math.max(.1, h - ch * .8), 1); o3.updateMatrix();
        trunks.setMatrixAt(i, o3.matrix);
      });
      instN.castShadow = instN.receiveShadow = instF.castShadow = instF.receiveShadow = trunks.castShadow = true;
      env.add(instN, instF, trunks);
      scene.add(env);
      const half = 45;
      Object.assign(sun.shadow.camera, { left: -half, right: half, top: half, bottom: -half });
      sun.shadow.camera.updateProjectionMatrix();
      dirtyShadows();
      render();
    },
    plants(plants, animate = true) { setPlants(plants, animate && !matchMedia("(prefers-reduced-motion: reduce)").matches); },
    focus,
    top(on) { setTop(on); },
    select: highlight,
    reset() { frame(true); },
    resize,
    stats() { renderer.render(scene, camera); const i = renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs.length }; },
    dispose() {
      alive = false;
      ro.disconnect();
      cancelAnimationFrame(raf); cancelAnimationFrame(growAnim);
      controls.dispose();
      clear();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
