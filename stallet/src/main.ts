import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
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
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xcfd6d4);

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

/* -------------------------------------------------------------------- ljus */

const hemisphere = new THREE.HemisphereLight(0xffffff, 0xd9d3c6, 1.35);
const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
sun.position.set(-6, 14, -5);
scene.add(hemisphere, sun);

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

/** Växlar mellan dagsljus med lysrör och kvällsljus med mysbelysning. */
function applyMood(evening: boolean) {
  (scene.background as THREE.Color).set(evening ? 0x121a2a : 0xcfd6d4);
  materials.ground.color.set(evening ? 0x1c2620 : 0x7f8a6c);
  hemisphere.color.set(evening ? 0x7088b8 : 0xffffff);
  hemisphere.groundColor.set(evening ? 0x3a3631 : 0xd9d3c6);
  hemisphere.intensity = evening ? 0.42 : 1.35;
  sun.color.set(evening ? 0x8fa6d8 : 0xfff4e0);
  sun.intensity = evening ? 0.12 : 0.9;
  renderer.toneMappingExposure = evening ? 1.25 : 1.05;
  document.body.classList.toggle('evening', evening);

  for (const light of fluorescents) light.intensity = evening ? 0 : 3;
  materials.tube.emissiveIntensity = evening ? 0 : 1.6;
  for (const light of cozy) light.intensity = evening ? light.userData.watts * 0.085 : 0;
  materials.linenShade.emissiveIntensity = evening ? 0.9 : 0.05;
  materials.enamelInside.emissiveIntensity = evening ? 0.6 : 0.03;
  materials.bulb.emissiveIntensity = evening ? 2.2 : 0.1;
  materials.flame.emissiveIntensity = evening ? 2.6 : 0.4;
  materials.ember.emissiveIntensity = evening ? 1.6 : 0.5;
  materials.glass.emissive.set(evening ? 0x24324f : 0xdfeaea);
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
scene.add(labels);

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

const state = { evening: true, cutaway: true, joists: true, furniture: true, labels: true };

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
}

function resize() {
  const { clientWidth: w, clientHeight: h } = canvas;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
}

const clock = new THREE.Clock();
function frame() {
  resize();
  walk(Math.min(clock.getDelta(), 0.1));
  controls.update();
  updateCutaway();
  renderer.render(scene, camera);
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
    sources: lighting.sources,
    look(position: [number, number, number], target: [number, number, number], fov: number) {
      setView({ name: '', position, target, fov });
    },
  },
});
