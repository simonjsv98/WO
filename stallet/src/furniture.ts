import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import * as D from './dimensions';
import { box, rod } from './build';
import type { Materials } from './textures';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Mjuk dyna med rundade kanter, mittpunkt i (x, y, z). */
function cushion(w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(w, h, d) * 0.28), m);
  mesh.position.set(x, y, z);
  return mesh;
}

/** Ställer en möbel på golvet. Möbler byggs med framsidan mot +z och mitten i origo. */
function place(group: THREE.Group, at: { x: number; z: number; turn?: number }) {
  group.position.set(at.x, 0, at.z);
  group.rotation.y = THREE.MathUtils.degToRad(at.turn ?? 0);
  return group;
}

/* --------------------------------------------------------------- matgrupp */

/** Pinnstol. */
function buildChair(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const wood = m.darkWood;
  const s = 0.21;
  g.add(box(-s, s, 0.42, 0.455, -s, s, wood));
  for (const sx of [-1, 1]) {
    // Benen spretar lite utåt.
    g.add(rod(v(sx * 0.2, 0, 0.2), v(sx * 0.16, 0.42, 0.16), 0.017, wood));
    g.add(rod(v(sx * 0.2, 0, -0.21), v(sx * 0.16, 0.42, -0.16), 0.017, wood));
    g.add(rod(v(sx * 0.18, 0.455, -0.18), v(sx * 0.2, 0.9, -0.25), 0.015, wood));
  }
  for (const x of [-0.1, -0.035, 0.035, 0.1]) {
    g.add(rod(v(x, 0.455, -0.18), v(x * 1.1, 0.88, -0.248), 0.008, wood));
  }
  g.add(box(-0.23, 0.23, 0.86, 0.93, -0.262, -0.238, wood));
  return g;
}

function buildDiningGroup(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const { tableLength: len, tableWidth: wid } = D.furniture.dining;
  const hl = len / 2;
  const hw = wid / 2;

  g.add(box(-hl, hl, 0.72, 0.76, -hw, hw, m.tableTop));
  g.add(box(-hl + 0.08, hl - 0.08, 0.62, 0.72, -hw + 0.08, hw - 0.08, m.darkWood));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(rod(v(sx * (hl - 0.1), 0, sz * (hw - 0.1)), v(sx * (hl - 0.12), 0.62, sz * (hw - 0.12)), 0.03, m.darkWood));
    }
  }

  // Två stolar per långsida och en på varje kortsida.
  const side = hw + 0.28;
  const end = hl + 0.3;
  const seats: [number, number, number][] = [
    [-len / 4, -side, 0],
    [len / 4, -side, 0],
    [-len / 4, side, 180],
    [len / 4, side, 180],
    [-end, 0, 90],
    [end, 0, -90],
  ];
  for (const [x, z, turn] of seats) g.add(place(buildChair(m), { x, z, turn }));
  return g;
}

/* -------------------------------------------------------------- soffgrupp */

/** Soffa eller fåtölj med ljus läderklädsel på stomme av rundvirke. */
function buildSeating(width: number, seats: number, m: Materials): THREE.Group {
  const g = new THREE.Group();
  const hw = width / 2;
  const depth = 0.85;
  const front = depth / 2;
  const back = -depth / 2;
  const arm = 0.09;

  // Stomme: fyra ben, armstöd och ram av rundvirke.
  for (const sx of [-1, 1]) {
    const x = sx * (hw - arm / 2);
    g.add(rod(v(x, 0, front - 0.06), v(x, 0.56, front - 0.06), 0.045, m.pine));
    g.add(rod(v(x, 0, back + 0.06), v(x, 0.62, back + 0.06), 0.045, m.pine));
    g.add(rod(v(x, 0.56, front), v(x, 0.6, back + 0.02), 0.04, m.pine));
  }
  g.add(rod(v(-hw + arm, 0.2, front - 0.06), v(hw - arm, 0.2, front - 0.06), 0.035, m.pine));
  g.add(rod(v(-hw + arm, 0.2, back + 0.06), v(hw - arm, 0.2, back + 0.06), 0.035, m.pine));

  // Dynor.
  const inner = width - 2 * arm - 0.04;
  const w = inner / seats;
  for (let i = 0; i < seats; i++) {
    const x = -inner / 2 + w * (i + 0.5);
    g.add(cushion(w - 0.02, 0.2, 0.62, x, 0.34, 0.06, m.leather));
    const backrest = cushion(w - 0.02, 0.5, 0.2, x, 0.66, back + 0.2, m.leather);
    backrest.rotation.x = -0.2;
    g.add(backrest);
  }
  return g;
}

function buildCoffeeTable(m: Materials): THREE.Group {
  const g = new THREE.Group();
  g.add(box(-0.5, 0.5, 0.43, 0.46, -0.3, 0.3, m.whitePaint));
  g.add(box(-0.46, 0.46, 0.36, 0.43, -0.26, 0.26, m.whitePaint));
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(box(sx * 0.44 - 0.02, sx * 0.44 + 0.02, 0, 0.36, sz * 0.24 - 0.02, sz * 0.24 + 0.02, m.whitePaint));
    }
  }
  return g;
}

/* -------------------------------------------------------------------- kök */

/**
 * Öppen köksbänk av furu. Lokalt: x längs bänken, väggen i z = 0 och framkanten i z = djupet.
 * `gaps` är sträckor (i x) där hyllorna utelämnas för att ge plats åt en maskin.
 */
function buildCounter(length: number, m: Materials, gaps: [number, number][] = []): THREE.Group {
  const g = new THREE.Group();
  const k = D.furniture.kitchen;
  const depth = k.counterDepth;
  const top = k.counterHeight;
  g.add(box(0, length, top - 0.035, top, 0, depth + 0.02, m.pine, { scale: 1.5 }));

  const bays = Math.max(1, Math.round(length / 0.95));
  for (let i = 0; i <= bays; i++) {
    const x = Math.min(Math.max((i / bays) * length, 0.035), length - 0.035);
    g.add(box(x - 0.035, x + 0.035, 0, top - 0.035, depth - 0.045, depth, m.pine, { along: 'y' }));
    g.add(box(x - 0.035, x + 0.035, 0, top - 0.035, 0.01, 0.055, m.pine, { along: 'y' }));
  }
  g.add(box(0, length, top - 0.11, top - 0.035, depth - 0.03, depth - 0.008, m.pine));

  // Hyllor i två höjder, uppdelade runt maskinerna.
  const spans: [number, number][] = [];
  let cursor = 0;
  for (const [a, b] of [...gaps].sort((p, q) => p[0] - q[0])) {
    if (a > cursor) spans.push([cursor, a]);
    cursor = b;
  }
  if (cursor < length) spans.push([cursor, length]);
  for (const [a, b] of spans) {
    for (const y of [0.14, 0.5]) g.add(box(a, b, y, y + 0.022, 0.02, depth - 0.02, m.pine, { scale: 1.5 }));
  }
  return g;
}

function buildKitchen(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const k = D.furniture.kitchen;
  const W = D.room.width;
  const depth = k.counterDepth;
  const top = k.counterHeight;

  /* Bänken längs långväggen. Lokalt x räknas från bänkens fria ände in mot hörnet. */
  const longLength = k.longRunToX;
  const u = (x: number) => longLength - x;
  const long = buildCounter(longLength, m, [[u(k.ovenX[1]), u(k.ovenX[0])]]);
  long.position.set(longLength, 0, W);
  long.rotation.y = Math.PI;
  g.add(long);

  // Inbyggnadsugn under bänken, med kokplatta ovanpå.
  const [o0, o1] = [u(k.ovenX[1]), u(k.ovenX[0])];
  long.add(box(o0, o1, 0.2, 0.8, 0.06, depth - 0.01, m.steel));
  long.add(box(o0 + 0.03, o1 - 0.03, 0.24, 0.66, depth - 0.012, depth, m.ovenGlass));
  long.add(box(o0 + 0.06, o1 - 0.06, 0.63, 0.65, depth, depth + 0.035, m.steel));
  for (let i = 0; i < 3; i++) {
    const x = o0 + 0.14 + i * 0.16;
    long.add(rod(v(x, 0.74, depth - 0.01), v(x, 0.74, depth + 0.02), 0.018, m.steel));
  }
  const hob = (o0 + o1) / 2 - 0.1;
  long.add(box(hob - 0.26, hob + 0.26, top, top + 0.07, 0.14, 0.44, m.appliance));
  for (const dx of [-0.13, 0.13]) {
    long.add(rod(v(hob + dx, top + 0.07, 0.29), v(hob + dx, top + 0.078, 0.29), 0.085, m.ovenGlass));
  }

  // Mikron står på mellanhyllan.
  const [m0, m1] = [u(k.microwaveX[1]), u(k.microwaveX[0])];
  long.add(box(m0, m1, 0.522, 0.79, 0.14, 0.5, m.appliance));
  long.add(box(m0 + 0.02, m1 - 0.13, 0.545, 0.77, 0.5, 0.505, m.ovenGlass));

  // Redskapslisten på väggen ovanför bänken, med lite som hänger.
  long.add(box(0.1, longLength - 0.15, 1.5, 1.57, 0, 0.022, m.pine));
  const hanging: [number, number, THREE.Material][] = [
    [0.45, 0.1, m.enamelBlue],
    [0.75, 0.12, m.enamelBlue],
    [1.1, 0.11, m.steel],
    [1.5, 0.07, m.pine],
    [1.85, 0.09, m.steel],
    [2.3, 0.08, m.darkWood],
    [2.65, 0.1, m.enamelBlue],
  ];
  for (const [x, r, material] of hanging) {
    long.add(rod(v(x, 1.5, 0.03), v(x, 1.44 - r, 0.03), 0.006, m.steel));
    long.add(rod(v(x, 1.36 - r, 0.025), v(x, 1.36 - r, 0.055), r, material));
  }

  /* Bänken längs köksgaveln, från långväggens bänk och ner förbi diskhon. */
  const gableStart = W - depth;
  const gableLength = gableStart - k.gableRunToZ;
  const gable = buildCounter(gableLength, m);
  gable.position.set(0, 0, gableStart);
  gable.rotation.y = Math.PI / 2;
  g.add(gable);

  // Vit diskho i keramik som sticker upp genom bänken.
  const [s0, s1] = [gableStart - k.sinkZ[1], gableStart - k.sinkZ[0]];
  gable.add(box(s0, s1, 0.66, top + 0.03, 0.1, depth + 0.05, m.appliance));
  gable.add(box(s0 + 0.04, s1 - 0.04, top + 0.03, top + 0.034, 0.14, depth + 0.01, m.steel));

  /* Kyl/frys och det blå vitrinskåpet står efter bänken längs långväggen. */
  const [f0, f1] = k.fridgeX;
  g.add(box(f0, f1, 0.02, 1.45, W - 0.62, W - 0.04, m.appliance));
  g.add(box(f0, f1, 1.02, 1.03, W - 0.625, W - 0.62, m.steel));
  g.add(box(f0 + 0.03, f0 + 0.05, 0.75, 0.98, W - 0.65, W - 0.62, m.steel));
  g.add(box(f0 + 0.03, f0 + 0.05, 1.07, 1.3, W - 0.65, W - 0.62, m.steel));

  const [h0, h1] = k.hutchX;
  const blue = m.bluePaint;
  g.add(box(h0, h1, 0.08, 0.9, W - 0.5, W - 0.02, blue));
  g.add(box(h0 - 0.02, h1 + 0.02, 0.9, 0.935, W - 0.53, W - 0.02, m.darkWood));
  for (const x of [h0 + 0.08, h1 - 0.08]) g.add(rod(v(x, 0, W - 0.42), v(x, 0.08, W - 0.42), 0.04, blue));
  // Överskåp på gavlar med öppen nisch emellan.
  g.add(box(h0, h1, 0.935, 1.28, W - 0.06, W - 0.02, m.darkWood));
  g.add(box(h0, h0 + 0.04, 0.935, 2.0, W - 0.36, W - 0.02, blue));
  g.add(box(h1 - 0.04, h1, 0.935, 2.0, W - 0.36, W - 0.02, blue));
  g.add(box(h0, h1, 1.28, 2.0, W - 0.36, W - 0.02, blue));
  g.add(box(h0 - 0.03, h1 + 0.03, 2.0, 2.06, W - 0.4, W - 0.02, blue));
  const mid = (h0 + h1) / 2;
  for (const [a, b] of [
    [h0 + 0.1, mid - 0.04],
    [mid + 0.04, h1 - 0.1],
  ]) {
    g.add(box(a, b, 1.36, 1.92, W - 0.364, W - 0.36, m.cabinetInside));
    g.add(box(a, b, 1.36, 1.92, W - 0.372, W - 0.368, m.glass));
  }
  // Luckor och lådor antyds med smala lister.
  g.add(box(mid - 0.008, mid + 0.008, 0.12, 0.62, W - 0.505, W - 0.5, m.darkWood));
  g.add(box(h0 + 0.04, h1 - 0.04, 0.66, 0.672, W - 0.505, W - 0.5, m.darkWood));
  return g;
}

/* ------------------------------------------------------------- braskamin */

/** Braskamin i gjutjärn på ben, med glasad lucka och rökrör. */
function buildStove(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const iron = m.castIron;
  const w = 0.26;
  const d = 0.22;

  // Eldstadsplan på golvet.
  g.add(box(-0.38, 0.38, 0, 0.006, -0.36, 0.62, m.hearth));

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(rod(v(sx * (w - 0.04), 0, sz * (d - 0.04)), v(sx * (w - 0.06), 0.2, sz * (d - 0.06)), 0.025, iron));
    }
  }
  g.add(box(-w - 0.02, w + 0.02, 0.18, 0.22, -d - 0.02, d + 0.06, iron));
  g.add(box(-w, w, 0.22, 0.74, -d, d, iron));
  g.add(box(-w - 0.025, w + 0.025, 0.74, 0.775, -d - 0.025, d + 0.03, iron));
  // Lucka med glas där glöden syns, och handtag.
  g.add(box(-w + 0.04, w - 0.04, 0.27, 0.69, d, d + 0.02, iron));
  g.add(box(-w + 0.1, w - 0.1, 0.36, 0.62, d + 0.02, d + 0.024, m.ember));
  g.add(rod(v(w - 0.07, 0.42, d + 0.045), v(w - 0.07, 0.56, d + 0.045), 0.011, m.steel));
  // Sidornas gjutna speglar.
  for (const sx of [-1, 1]) {
    g.add(box(sx * w - 0.006, sx * w + 0.006, 0.3, 0.66, -d + 0.05, d - 0.05, iron));
  }

  const pipeZ = -d + 0.1;
  if (D.furniture.stove.flue === 'ceiling') {
    // Rökrör rakt upp genom taket, med en täckplåt mot takbrädorna.
    const ceiling = D.ceiling.boards;
    g.add(rod(v(0, 0.775, pipeZ), v(0, ceiling, pipeZ), 0.065, iron));
    g.add(rod(v(0, ceiling - 0.012, pipeZ), v(0, ceiling, pipeZ), 0.15, iron));
  } else {
    // Rökrör rakt upp och sedan bakåt in i väggen.
    const bend = 1.55;
    g.add(rod(v(0, 0.775, pipeZ), v(0, bend, pipeZ), 0.065, iron));
    g.add(rod(v(0, bend, pipeZ + 0.065), v(0, bend, -d - 0.3), 0.065, iron));
    g.add(rod(v(0, bend, -d - 0.2), v(0, bend, -d - 0.215), 0.1, iron));
  }
  return g;
}

/* -------------------------------------------------------------- vedspis */

/**
 * Inmurad vedspis i hörnet. Byggs i hörnets koordinater: x längs soffväggen ut från
 * köksgaveln, z ut i rummet. Murstocken står innerst i hörnet och spisen bredvid.
 */
function buildCookstove(m: Materials): THREE.Group {
  const g = new THREE.Group();
  const c = D.furniture.cookstove;
  const iron = m.castIron;
  const white = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    g.add(box(x0, x1, y0, y1, z0, z1, m.masonry, { scale: 2.4 }));

  // Murstock från golv till tak.
  white(0, c.chimneyWidth, 0, D.ceiling.boards, 0, c.chimneyDepth);

  // Murverket som spisen sitter i: sockel, två kinder och en kant mot väggen.
  const a = c.chimneyWidth;
  const s0 = a + c.cheek;
  const s1 = s0 + c.width;
  const b = s1 + c.cheek;
  const back = 0.08;
  const front = back + c.depth;
  const top = c.topHeight;
  white(a, b, 0, c.plinthHeight, 0, front + 0.03);
  white(a, s0, c.plinthHeight, top, 0, front + 0.03);
  white(s1, b, c.plinthHeight, top, 0, front + 0.03);
  white(s0, s1, c.plinthHeight, top + 0.12, 0, back);

  // Järnspisen: kropp, häll med ringar och blank stång längs framkanten.
  g.add(box(s0, s1, c.plinthHeight, top - 0.03, back, front, iron));
  g.add(box(s0 - 0.015, s1 + 0.015, top - 0.03, top, back, front + 0.05, iron));
  for (const [x, r] of [
    [s0 + 0.2, 0.115],
    [s0 + 0.5, 0.095],
  ]) {
    g.add(rod(v(x, top, back + 0.3), v(x, top + 0.006, back + 0.3), r, m.hearth));
    g.add(rod(v(x, top, back + 0.3), v(x, top + 0.009, back + 0.3), r * 0.45, iron));
  }
  g.add(rod(v(s0 + 0.02, top - 0.05, front + 0.085), v(s1 - 0.02, top - 0.05, front + 0.085), 0.011, m.steel));
  for (const x of [s0 + 0.04, s1 - 0.04]) {
    g.add(rod(v(x, top - 0.05, front + 0.03), v(x, top - 0.05, front + 0.085), 0.008, m.steel));
  }

  // Framsidan: eldstadslucka och asklucka till vänster, ugnslucka till höger.
  const face = (x0: number, x1: number, y0: number, y1: number) =>
    g.add(box(x0, x1, y0, y1, front, front + 0.015, m.hearth));
  face(s0 + 0.06, s0 + 0.28, top - 0.3, top - 0.1);
  face(s0 + 0.06, s0 + 0.28, top - 0.47, top - 0.35);
  face(s0 + 0.36, s1 - 0.06, top - 0.47, top - 0.12);
  g.add(rod(v(s0 + 0.42, top - 0.17, front + 0.035), v(s1 - 0.12, top - 0.17, front + 0.035), 0.009, m.steel));
  g.add(rod(v(s0 + 0.17, top - 0.2, front + 0.015), v(s0 + 0.17, top - 0.2, front + 0.04), 0.014, m.steel));
  g.add(box(s0 + 0.46, s1 - 0.16, top - 0.36, top - 0.31, front + 0.015, front + 0.02, m.steel));

  // Rökröret från hällens bakkant in i murstocken.
  g.add(rod(v(s0 + 0.12, top, back + 0.09), v(s0 + 0.12, top + 0.42, back + 0.09), 0.055, iron));
  g.add(rod(v(s0 + 0.175, top + 0.42, back + 0.09), v(a - 0.02, top + 0.42, back + 0.09), 0.055, iron));
  return g;
}

/* ------------------------------------------------------------------------ */

export function buildFurniture(m: Materials): THREE.Group {
  const f = D.furniture;
  const group = new THREE.Group();
  group.name = 'Möbler';
  group.add(place(buildDiningGroup(m), f.dining));
  group.add(place(buildSeating(f.sofa.width, 3, m), f.sofa));
  group.add(place(buildCoffeeTable(m), f.coffeeTable));
  for (const chair of f.armchairs) group.add(place(buildSeating(0.9, 1, m), chair));
  group.add(buildKitchen(m));
  // Kaminen står med ryggen mot nya rummets vägg, mitt för en regel (45 mm bred).
  // 0,22 är halva kaminens djup.
  group.add(
    place(buildStove(m), {
      x: D.newRoom.frontX - f.stove.wallGap - 0.22,
      z: f.stove.stud * D.newRoom.studSpacing + 0.0225,
      turn: f.stove.turn,
    }),
  );
  group.add(buildCookstove(m));
  return group;
}
