import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import * as D from './dimensions';
import { buildNewRoom, buildShell, buildStructure } from './build';
import { buildFurniture } from './furniture';
import { buildLighting } from './lighting';
import { createMaterials } from './textures';
import './style.css';

const { length: L, width: W } = D.room;

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
// Skuggorna räknas bara om när något i scenen ändras – rummet står ju still.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd6d4);
// Mjukt omgivningsljus och svaga speglingar i blanka ytor.
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

/** Etiketter och måttlinjer ritas ovanpå den färdiga bilden, utanför efterbehandlingen. */
const overlay = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 200);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.minDistance = 0.2;
controls.maxDistance = 60;

/* ------------------------------------------------------------------ modell */

const materials = createMaterials();
const shell = buildShell(materials);
const structure = buildStructure(materials);
const newRoom = buildNewRoom(materials);
const furniture = buildFurniture(materials);
const lighting = buildLighting(materials);

// Namn som följer med i exporten, så att delarna går att hitta i andra program.
shell.floor.name = 'Golv';
shell.sofaWall.name = 'Soffvagg';
shell.kitchenWall.name = 'Langvagg';
shell.kitchenGable.name = 'Koksgavel';
shell.farGable.name = 'Bortre gavel';
structure.boards.name = 'Takbrador';
structure.joists.name = 'Takbjalkar';
structure.frame.name = 'Barlina';
structure.lamps.name = 'Lysror';
newRoom.name = 'Nya rummet';
furniture.name = 'Mobler';
lighting.group.name = 'Lampor';

/** Allt som hör till själva byggnaden – det är den här gruppen som exporteras. */
const model = new THREE.Group();
model.name = 'Stallet';
model.add(
  shell.floor,
  shell.sofaWall,
  shell.kitchenWall,
  shell.kitchenGable,
  shell.farGable,
  structure.boards,
  structure.joists,
  structure.frame,
  structure.lamps,
  newRoom,
  furniture,
  lighting.group,
);
scene.add(model);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), materials.ground);
ground.rotation.x = -Math.PI / 2;
ground.position.set(L / 2, -0.16, W / 2);
scene.add(ground);

// Några träd och buskar runt huset, så att det finns något att se genom fönstren.
const foliage = new THREE.MeshStandardMaterial({ color: 0x3f5a34, roughness: 1 });
const trunk = new THREE.MeshStandardMaterial({ color: 0x3b2f26, roughness: 1 });
{
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const angle = (i / 26) * Math.PI * 2 + rnd() * 0.2;
    const distance = 9 + rnd() * 9;
    const x = L / 2 + Math.cos(angle) * (distance + L / 2 - 3);
    const z = W / 2 + Math.sin(angle) * (distance + W / 2 - 3);
    const height = 3 + rnd() * 5;
    const tree = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, height * 0.45, 8), trunk);
    stem.position.y = height * 0.22;
    tree.add(stem);
    for (let k = 0; k < 3; k++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(height * (0.22 + rnd() * 0.1), 1), foliage);
      crown.position.set((rnd() - 0.5) * height * 0.2, height * (0.5 + k * 0.17), (rnd() - 0.5) * height * 0.2);
      crown.scale.y = 1.2;
      tree.add(crown);
    }
    tree.position.set(x, -0.16, z);
    scene.add(tree);
  }
}

/* -------------------------------------------------------------------- ljus */

const hemisphere = new THREE.HemisphereLight(0xffffff, 0xd9d3c6, 1.0);
// Solen står lågt och lyser in genom soffväggens fönster, så att det blir solfläckar på golvet.
const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
sun.position.set(L / 2 + 2.5, 6, -9);
sun.target.position.set(L / 2, 0, W / 2);
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -8;
sun.shadow.camera.right = 8;
sun.shadow.camera.top = 8;
sun.shadow.camera.bottom = -8;
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 40;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.radius = 2.5;
scene.add(hemisphere, sun, sun.target);

// Allt i modellen både kastar och tar emot skugga, utom glas och det som själv lyser.
const noShadow = new Set<THREE.Material>([materials.glass, materials.bulb, materials.flame, materials.tube, materials.ember]);
model.traverse((object) => {
  const mesh = object as THREE.Mesh;
  if (!mesh.isMesh) return;
  mesh.receiveShadow = true;
  mesh.castShadow = !noShadow.has(mesh.material as THREE.Material);
});

// Dagsljus: lysrören. Kvällsljus: mysbelysningen.
const fluorescents = D.lamps.map((lamp) => {
  const light = new THREE.PointLight(0xfff0d0, 3, 8, 1.6);
  light.position.set(lamp.x, lamp.top - 0.25, lamp.z);
  return light;
});

/**
 * Varje lampa får en egen ljuskälla. Ljusslingan och de levande ljusen slås ihop till
 * några få, så att antalet ljuskällor håller sig rimligt även på en telefon.
 */
function warmLights(): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  const add = (position: THREE.Vector3, color: number, watts: number) => {
    const light = new THREE.PointLight(color, 0, 0, 2);
    light.position.copy(position);
    light.userData.watts = watts;
    lights.push(light);
  };
  const merge = (kind: string, groups: number) => {
    const list = lighting.sources.filter((s) => s.kind === kind);
    const size = Math.ceil(list.length / groups);
    for (let i = 0; i < list.length; i += size) {
      const part = list.slice(i, i + size);
      const center = new THREE.Vector3();
      for (const s of part) center.add(new THREE.Vector3(...s.position));
      center.multiplyScalar(1 / part.length);
      add(center, part[0].color, part.reduce((sum, s) => sum + s.watts, 0));
    }
  };
  for (const s of lighting.sources) {
    if (s.kind === 'lamp' || s.kind === 'fire') add(new THREE.Vector3(...s.position), s.color, s.watts);
  }
  merge('string', 3);
  merge('candle', 3);
  return lights;
}
const cozy = warmLights();
scene.add(...fluorescents, ...cozy);

// Några av lamporna kastar skugga: taklampan över matbordet, en kökslampa, golvlampan och
// braskaminen. Fler än så orkar inte grafikkortet med.
const shadowCasters = [0, 2, 4, 13].map((i) => cozy[i]);
for (const light of shadowCasters) {
  light.shadow.mapSize.set(512, 512);
  light.shadow.camera.near = 0.06;
  light.shadow.camera.far = 12;
  light.shadow.bias = -0.004;
  light.shadow.normalBias = 0.03;
  light.shadow.radius = 4;
}

/** Himmel som en mjuk toning från horisonten och uppåt. */
function sky(top: string, horizon: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  const gradient = ctx.createLinearGradient(0, 0, 0, 256);
  gradient.addColorStop(0, top);
  gradient.addColorStop(0.62, horizon);
  gradient.addColorStop(1, horizon);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 256);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
const skies = { day: sky('#8fb0d2', '#e4ebee'), evening: sky('#070b18', '#3b3a55') };

/** Växlar mellan dagsljus med lysrör och kvällsljus med mysbelysning. */
function applyMood(evening: boolean) {
  scene.background = evening ? skies.evening : skies.day;
  materials.ground.color.set(evening ? 0x1c2620 : 0x7f8a6c);
  hemisphere.color.set(evening ? 0x7088b8 : 0xffffff);
  hemisphere.groundColor.set(evening ? 0x3a3631 : 0xd9d3c6);
  hemisphere.intensity = evening ? 0.2 : 0.36;
  scene.environmentIntensity = evening ? 0.1 : 0.3;
  sun.intensity = evening ? 0 : 14;
  sun.castShadow = !evening;
  for (const light of shadowCasters) light.castShadow = evening;
  renderer.toneMappingExposure = evening ? 1.05 : 0.95;
  document.body.classList.toggle('evening', evening);

  for (const light of fluorescents) light.intensity = evening ? 0 : 1.5;
  materials.tube.emissiveIntensity = evening ? 0 : 1.6;
  for (const light of cozy) light.intensity = evening ? light.userData.watts * 0.068 : 0;
  materials.linenShade.emissiveIntensity = evening ? 0.9 : 0.05;
  materials.enamelInside.emissiveIntensity = evening ? 0.6 : 0.03;
  materials.bulb.emissiveIntensity = evening ? 2.2 : 0.1;
  materials.flame.emissiveIntensity = evening ? 2.6 : 0.4;
  materials.ember.emissiveIntensity = evening ? 1.6 : 0.5;
  materials.glass.emissive.set(evening ? 0x24324f : 0xdfeaea);
  materials.glass.emissiveIntensity = evening ? 0.45 : 0.12;
  materials.glass.opacity = evening ? 0.4 : 0.2;
  foliage.color.set(evening ? 0x0c120e : 0x3f5a34);
  materials.glass.color.set(evening ? 0x5a6a88 : 0xeaf2f2);
}

/* --------------------------------------------------------------- etiketter */

function textSprite(text: string, size: number, dark = false): THREE.Sprite {
  const pad = 18;
  const font = '600 44px system-ui, -apple-system, "Segoe UI", sans-serif';
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  ctx.font = font;
  c.width = Math.ceil(ctx.measureText(text).width) + pad * 2;
  c.height = 72;
  ctx.font = font;
  ctx.fillStyle = dark ? 'rgba(14,15,13,0.82)' : 'rgba(255,255,255,0.86)';
  ctx.beginPath();
  ctx.roundRect(0, 0, c.width, c.height, 16);
  ctx.fill();
  ctx.fillStyle = dark ? '#f3f1ea' : '#0e0f0d';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }),
  );
  sprite.scale.set((size * c.width) / c.height, size, 1);
  sprite.renderOrder = 10;
  return sprite;
}

const labels = new THREE.Group();
const meters = (n: number) => `${n.toFixed(2).replace('.', ',')} m`;

function dimensionLine(a: THREE.Vector3, b: THREE.Vector3, text: string) {
  const mat = new THREE.LineBasicMaterial({ color: 0x0e0f0d });
  const side = new THREE.Vector3().subVectors(b, a).normalize().cross(new THREE.Vector3(0, 1, 0));
  const tick = side.multiplyScalar(0.25);
  const points = [a, b, a.clone().add(tick), a.clone().sub(tick), b.clone().add(tick), b.clone().sub(tick)];
  labels.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), mat));
  const sprite = textSprite(text, 0.5, true);
  sprite.position.copy(a).add(b).multiplyScalar(0.5);
  labels.add(sprite);
}

dimensionLine(new THREE.Vector3(0, 0, -2), new THREE.Vector3(L, 0, -2), meters(L));
dimensionLine(new THREE.Vector3(-2, 0, 0), new THREE.Vector3(-2, 0, W), meters(W));

const zoneLabels: [string, number, number][] = [
  ['Kök', 1.8, 6.4],
  ['Matplats', D.furniture.dining.x, D.furniture.dining.z],
  ['Soffhörna', D.furniture.coffeeTable.x, D.furniture.coffeeTable.z],
  ['Nytt rum', (D.newRoom.frontX + L) / 2, D.newRoom.depthZ / 2],
  ['Förråd', L - 0.9, 6.4],
  ['Soffvägg', L / 2, -0.5],
  ['Köksgavel', -0.5, W / 2],
  ['Långvägg med plankdörr', L / 2, W + 0.5],
  ['Gavel med plywooddörr', L + 0.5, W / 2],
];
for (const [text, x, z] of zoneLabels) {
  const sprite = textSprite(text, 0.36);
  sprite.position.set(x, 1.1, z);
  labels.add(sprite);
}
overlay.add(labels);

/* -------------------------------------------------------------------- vyer */

interface View {
  name: string;
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  /** Vy utifrån: backa kameran på smala skärmar så att hela huset får plats. */
  exterior?: boolean;
}

/** Ögonhöjd för vyerna inifrån. */
const EYE = 1.55;

const views: View[] = [
  { name: 'Översikt', position: [-5.5, 10.5, 15.5], target: [L / 2, 0.6, W / 2], fov: 42, exterior: true },
  { name: 'Plan', position: [L / 2, 24, W / 2 + 0.01], target: [L / 2, 0, W / 2], fov: 30, exterior: true },
  { name: 'Från köket', position: [2.2, EYE, 6.65], target: [4.7, 1.35, 4.95], fov: 78 },
  { name: 'Soffhörnan', position: [3.5, EYE, 4.1], target: [5.6, 1.1, 1.4], fov: 78 },
  { name: 'Köksgaveln', position: [4.0, EYE, 3.9], target: [1.2, 1.3, 4.0], fov: 78 },
  { name: 'Köket', position: [5.2, EYE, 5.1], target: [2.6, 1.3, 7.0], fov: 78 },
  { name: 'Nya rummet', position: [4.9, EYE, 3.3], target: [7.4, 1.3, 2.4], fov: 78 },
  { name: 'Förrådet', position: [6.8, EYE, 4.4], target: [9.0, 1.3, 6.4], fov: 78 },
];

function setView(view: View) {
  resize();
  camera.position.set(...view.position);
  controls.target.set(...view.target);
  if (view.exterior && camera.aspect < 1.3) {
    const back = camera.position.clone().sub(controls.target).multiplyScalar(1.3 / camera.aspect);
    camera.position.copy(controls.target).add(back);
  }
  camera.fov = view.fov;
  camera.updateProjectionMatrix();
  controls.update();
}

/* ------------------------------------------------------------------- panel */

const state = { evening: true, quality: true, cutaway: true, joists: true, furniture: true, labels: true };

const panel = document.querySelector<HTMLDivElement>('#panel')!;
panel.innerHTML = `
  <details ${window.innerWidth >= 700 ? 'open' : ''}>
    <summary>Stallet <span>${meters(L)} × ${meters(W)}</span></summary>
    <div class="row" data-views></div>
    <div class="row" data-toggles></div>
    <div class="row" data-export-row><button data-export>Ladda ner som GLB</button></div>
  </details>
`;

const viewRow = panel.querySelector('[data-views]')!;
for (const view of views) {
  const button = document.createElement('button');
  button.textContent = view.name;
  button.addEventListener('click', () => setView(view));
  viewRow.append(button);
}

const toggleRow = panel.querySelector('[data-toggles]')!;
const toggles: [keyof typeof state, string][] = [
  ['evening', 'Kvällsljus'],
  ['quality', 'Hög kvalitet'],
  ['cutaway', 'Öppna upp utifrån'],
  ['joists', 'Takbjälkar'],
  ['furniture', 'Möbler'],
  ['labels', 'Etiketter'],
];
for (const [key, text] of toggles) {
  const label = document.createElement('label');
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = state[key];
  input.dataset.key = key;
  input.addEventListener('change', () => (state[key] = input.checked));
  label.append(input, text);
  toggleRow.append(label);
}

document.querySelector<HTMLDivElement>('#hint')!.textContent =
  'Dra för att snurra · nyp eller scrolla för att zooma · två fingrar eller högerklick för att flytta · WASD går runt';

// Inbäddad i en annan sida (t.ex. en delad länk) får sidan inte starta nedladdningar,
// så där visas ingen knapp som inte skulle göra något.
if (window.self !== window.top) panel.querySelector('[data-export-row]')!.remove();

/** Sant medan exporten pågår, så att inget göms undan mitt i den. */
let exporting = false;

panel.querySelector('[data-export]')?.addEventListener('click', async () => {
  // Exporten läser modellen i flera steg. Allt ska vara med, även det som just nu är
  // bortvalt för att kameran står utanför.
  exporting = true;
  model.children.forEach((child) => (child.visible = true));
  furniture.visible = lighting.group.visible = state.furniture;
  try {
    const result = await new GLTFExporter().parseAsync(model, { binary: true });
    const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'stallet.glb';
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error(error);
  } finally {
    exporting = false;
  }
});

/* ---------------------------------------------------------- gå runt (WASD) */

const keys = new Set<string>();
window.addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
window.addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());

function walk(dt: number) {
  const forward = Number(keys.has('w') || keys.has('arrowup')) - Number(keys.has('s') || keys.has('arrowdown'));
  const sideways = Number(keys.has('d') || keys.has('arrowright')) - Number(keys.has('a') || keys.has('arrowleft'));
  if (!forward && !sideways) return;
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  dir.y = 0;
  dir.normalize();
  const right = new THREE.Vector3(-dir.z, 0, dir.x);
  const step = dir.multiplyScalar(forward).add(right.multiplyScalar(sideways)).multiplyScalar(2.2 * dt);
  camera.position.add(step);
  controls.target.add(step);
}

/* ------------------------------------------------------------------- loop */

let mood: boolean | null = null;

/** Göm det som står mellan kameran och rummet, så att man kan titta in utifrån. */
function updateCutaway() {
  if (exporting) return;
  const p = camera.position;
  const open = state.cutaway;
  shell.sofaWall.visible = !open || p.z > 0;
  shell.kitchenWall.visible = !open || p.z < W;
  shell.kitchenGable.visible = !open || p.x > 0;
  shell.farGable.visible = !open || p.x < L;
  const above = p.y > D.ceiling.boards;
  structure.boards.visible = !(open && above);
  structure.joists.visible = state.joists;
  furniture.visible = state.furniture;
  lighting.group.visible = state.furniture;
  if (mood !== state.evening) {
    mood = state.evening;
    applyMood(mood);
  }
  structure.lamps.visible = state.joists || !above;
  // Etiketterna är till för vyerna utifrån; inne i rummet skulle de bara sväva i vägen.
  const inside = p.x > 0 && p.x < L && p.z > 0 && p.z < W && !above;
  labels.visible = state.labels && !inside;

  // Skuggorna räknas om när ljuset eller det som syns har ändrats.
  const signature = [mood, ...model.children.map((child) => child.visible)].join();
  if (signature !== shadowSignature) {
    shadowSignature = signature;
    renderer.shadowMap.needsUpdate = true;
  }
}
let shadowSignature = '';

/* --------------------------------------------------------- efterbehandling */

// Hög kvalitet: skuggning i hörn och skarvar (ambient occlusion) och ett svagt sken runt
// lamporna. Det kostar en del, så det slås av automatiskt om bilden börjar hacka.
const composer = new EffectComposer(
  renderer,
  new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }),
);
composer.addPass(new RenderPass(scene, camera));
const occlusion = new GTAOPass(scene, camera, 1, 1);
occlusion.updateGtaoMaterial({ radius: 0.4, distanceExponent: 1.5, thickness: 1.5, scale: 1.2, samples: 12 });
occlusion.blendIntensity = 0.85;
composer.addPass(occlusion);
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.22, 0.5, 0.92);
composer.addPass(bloom);
composer.addPass(new OutputPass());

const smoothness = { frames: 0, slow: 0, adaptive: true, sharp: true };
function watchSmoothness(dt: number) {
  if (!smoothness.adaptive || (!state.quality && !smoothness.sharp)) return;
  smoothness.frames++;
  if (smoothness.frames < 20) return; // de första bilderna är alltid långsamma
  smoothness.slow = dt > 0.06 ? smoothness.slow + 1 : Math.max(0, smoothness.slow - 1);
  if (smoothness.slow <= 25) return;
  smoothness.slow = 0;
  if (state.quality) {
    // Första steget: stäng av efterbehandlingen.
    state.quality = false;
    const box = panel.querySelector<HTMLInputElement>('input[data-key="quality"]');
    if (box) box.checked = false;
  } else {
    // Andra steget, om det fortfarande hackar: rita i lägre upplösning.
    smoothness.sharp = false;
    renderer.setPixelRatio(1);
  }
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const timer = new THREE.Timer();
function frame() {
  resize();
  timer.update();
  const dt = timer.getDelta();
  walk(Math.min(dt, 0.1));
  controls.update();
  updateCutaway();
  watchSmoothness(dt);
  if (state.quality) composer.render();
  else renderer.render(scene, camera);
  // Etiketterna ovanpå, utan att sudda bilden.
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(overlay, camera);
  renderer.autoClear = true;
  requestAnimationFrame(frame);
}

setView(views[0]);
frame();

// Används av skärmdumps-skriptet för att ställa kameran exakt.
Object.assign(window, {
  stallet: {
    views,
    setView,
    state,
    smoothness,
    sources: lighting.sources,
    look(position: [number, number, number], target: [number, number, number], fov: number) {
      setView({ name: '', position, target, fov });
    },
  },
});
