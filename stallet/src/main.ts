import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as D from './dimensions';
import { buildNewRoom, buildShell, buildStructure } from './build';
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
);
scene.add(model);

const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), materials.ground);
ground.rotation.x = -Math.PI / 2;
ground.position.set(L / 2, -0.16, W / 2);
scene.add(ground);

/* -------------------------------------------------------------------- ljus */

scene.add(new THREE.HemisphereLight(0xffffff, 0xd9d3c6, 1.35));
const sun = new THREE.DirectionalLight(0xfff4e0, 0.9);
sun.position.set(-6, 14, -5);
scene.add(sun);
for (const lamp of D.lamps) {
  const light = new THREE.PointLight(0xfff0d0, 3, 8, 1.6);
  light.position.set(lamp.x, lamp.top - 0.25, lamp.z);
  scene.add(light);
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
const meters = (n: number) => `${n.toFixed(1).replace('.', ',')} m`;

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
  ['Matplats', 1.6, 2.4],
  ['Soffhörna', 5.3, 1.6],
  ['Nytt rum', (D.newRoom.frontX + L) / 2, D.newRoom.depthZ / 2],
  ['Förråd', 9.1, 6.4],
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
  { name: 'Översikt', position: [-5.5, 10.5, 15.5], target: [5, 0.6, 4], fov: 42, exterior: true },
  { name: 'Plan', position: [5, 27, 4.01], target: [5, 0, 4], fov: 30, exterior: true },
  { name: 'Från köket', position: [2.2, EYE, 6.65], target: [4.7, 1.35, 4.95], fov: 78 },
  { name: 'Soffhörnan', position: [4.9, EYE, 4.2], target: [4.9, 1.3, 1.2], fov: 78 },
  { name: 'Köksgaveln', position: [4.4, EYE, 4.3], target: [1.4, 1.3, 4.3], fov: 78 },
  { name: 'Köket', position: [5.2, EYE, 4.9], target: [2.6, 1.3, 6.9], fov: 78 },
  { name: 'Nya rummet', position: [4.9, EYE, 3.2], target: [7.8, 1.3, 2.4], fov: 78 },
  { name: 'Förrådet', position: [7.2, EYE, 4.45], target: [9.5, 1.3, 6.4], fov: 78 },
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

const state = { cutaway: true, joists: true, labels: true };

const panel = document.querySelector<HTMLDivElement>('#panel')!;
panel.innerHTML = `
  <details ${window.innerWidth >= 700 ? 'open' : ''}>
    <summary>Stallet <span>${L} × ${W} m</span></summary>
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
  ['cutaway', 'Öppna upp utifrån'],
  ['joists', 'Takbjälkar'],
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

panel.querySelector('[data-export]')?.addEventListener('click', () => {
  const visibility = model.children.map((child) => child.visible);
  model.children.forEach((child) => (child.visible = true));
  new GLTFExporter().parse(
    model,
    (result) => {
      const blob = new Blob([result as ArrayBuffer], { type: 'model/gltf-binary' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'stallet.glb';
      link.click();
      URL.revokeObjectURL(link.href);
    },
    (error) => console.error(error),
    { binary: true },
  );
  model.children.forEach((child, i) => (child.visible = visibility[i]));
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

/** Göm det som står mellan kameran och rummet, så att man kan titta in utifrån. */
function updateCutaway() {
  const p = camera.position;
  const open = state.cutaway;
  shell.sofaWall.visible = !open || p.z > 0;
  shell.kitchenWall.visible = !open || p.z < W;
  shell.kitchenGable.visible = !open || p.x > 0;
  shell.farGable.visible = !open || p.x < L;
  const above = p.y > D.ceiling.boards;
  structure.boards.visible = !(open && above);
  structure.joists.visible = state.joists;
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
    look(position: [number, number, number], target: [number, number, number], fov: number) {
      setView({ name: '', position, target, fov });
    },
  },
});
