import * as THREE from 'three';
import * as D from './dimensions';
import type { Materials } from './textures';

export type Axis = 'x' | 'y' | 'z';

/**
 * Lägger ut texturen efter verkliga mått i stället för per sida, så att mönstret
 * hänger ihop över skarvar. `along` är virkets längdriktning (ådringen följer den).
 */
function projectUV(geo: THREE.BufferGeometry, scaleU: number, scaleV: number, along: Axis) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const read = (i: number, axis: Axis) =>
    axis === 'x' ? pos.getX(i) : axis === 'y' ? pos.getY(i) : pos.getZ(i);
  for (let i = 0; i < pos.count; i++) {
    const ax = Math.abs(nor.getX(i));
    const ay = Math.abs(nor.getY(i));
    const az = Math.abs(nor.getZ(i));
    let tangents: [Axis, Axis];
    if (ay >= ax && ay >= az) tangents = ['x', 'z'];
    else if (ax >= az) tangents = ['z', 'y'];
    else tangents = ['x', 'y'];
    if (tangents[1] === along) tangents.reverse();
    uv.setXY(i, read(i, tangents[0]) / scaleU, read(i, tangents[1]) / scaleV);
  }
  uv.needsUpdate = true;
}

interface BoxOptions {
  /** Hur många meter en texturbild täcker. */
  scale?: number;
  along?: Axis;
}

/** Låda mellan två hörn, i den omgivande gruppens koordinater. */
export function box(
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z0: number,
  z1: number,
  material: THREE.Material,
  { scale = 1, along = 'x' }: BoxOptions = {},
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0));
  geo.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  projectUV(geo, scale, scale, along);
  return new THREE.Mesh(geo, material);
}

/** Rör eller rundstock mellan två punkter. */
export function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material) {
  const length = from.distanceTo(to);
  const geo = new THREE.CylinderGeometry(radius, radius, length, 16);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    to.clone().sub(from).normalize(),
  );
  return mesh;
}

/* ---------------------------------------------------------------- murväggar */

/** En öppning uttryckt längs väggens egen axel (u). */
interface LocalOpening extends D.WallOpening {
  u0: number;
  u1: number;
}

/**
 * Väggens lokala koordinater: x löper längs väggen, y uppåt, insidan ligger i z = 0
 * och muren sträcker sig utåt till z = -tjocklek. Rummet ligger alltså på +z-sidan.
 */
function buildWall(
  length: number,
  cornerOverlap: number,
  openings: LocalOpening[],
  m: Materials,
): THREE.Group {
  const group = new THREE.Group();
  const t = D.room.wallThickness;
  const top = D.room.wallTop;
  const plaster = (u0: number, u1: number, y0: number, y1: number) =>
    group.add(box(u0, u1, y0, y1, -t, 0, m.plaster, { scale: 2.4 }));

  let cursor = -cornerOverlap;
  for (const o of [...openings].sort((a, b) => a.u0 - b.u0)) {
    plaster(cursor, o.u0, 0, top);
    if (o.sill > 0) plaster(o.u0, o.u1, 0, o.sill);
    plaster(o.u0, o.u1, o.top, top);
    cursor = o.u1;

    if (o.kind === 'window') group.add(buildWindow(o, m));
    else if (o.kind === 'whiteDoor') group.add(buildWhiteDoor(o, m));
    else if (o.kind === 'plywoodDoor') group.add(buildPlywoodDoor(o, m));
    else group.add(buildPlankDoor(o, m));
  }
  plaster(cursor, length + cornerOverlap, 0, top);
  return group;
}

/** Fönstret sitter långt ut i muren, så att den djupa nischen syns inifrån. */
function buildWindow(o: LocalOpening, m: Materials): THREE.Group {
  const g = new THREE.Group();
  const zIn = -0.24;
  const zOut = -0.3;
  const f = 0.055;
  const wood = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(box(u0, u1, y0, y1, zOut, zIn, m.whitePaint));
  wood(o.u0, o.u0 + f, o.sill, o.top);
  wood(o.u1 - f, o.u1, o.sill, o.top);
  // De liggande delarna och mittposten går mellan de stående, utan att överlappa dem.
  wood(o.u0 + f, o.u1 - f, o.sill, o.sill + f);
  wood(o.u0 + f, o.u1 - f, o.top - f, o.top);
  if (o.panes === 2) {
    const mid = (o.u0 + o.u1) / 2;
    wood(mid - 0.03, mid + 0.03, o.sill + f, o.top - f);
  }
  g.add(box(o.u0 + f, o.u1 - f, o.sill + f, o.top - f, -0.275, -0.265, m.glass));
  if (o.lintel) g.add(box(o.u0 - 0.12, o.u1 + 0.12, o.top, o.top + 0.15, -0.02, 0.012, m.lintel));
  return g;
}

/** Vit dörr i svart karm (köksgaveln). */
function buildWhiteDoor(o: LocalOpening, m: Materials): THREE.Group {
  const g = new THREE.Group();
  const f = 0.07;
  const frame = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(box(u0, u1, y0, y1, -0.12, 0.012, m.blackPaint));
  frame(o.u0, o.u0 + f, 0, o.top);
  frame(o.u1 - f, o.u1, 0, o.top);
  frame(o.u0 + f, o.u1 - f, o.top - f, o.top);
  g.add(box(o.u0 + f, o.u1 - f, 0.02, o.top - f, -0.1, -0.06, m.whitePaint));
  g.add(box(o.u1 - f - 0.12, o.u1 - f - 0.09, 0.95, 1.08, -0.06, -0.035, m.blackPaint));
  return g;
}

/** Tvådelad plywooddörr i ny träram, med brun överliggare (bortre gaveln). */
function buildPlywoodDoor(o: LocalOpening, m: Materials): THREE.Group {
  const g = new THREE.Group();
  const outer = 0.04;
  const f = 0.075;
  const black = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(box(u0, u1, y0, y1, -0.14, 0.008, m.blackPaint));
  black(o.u0, o.u0 + outer, 0, o.top);
  black(o.u1 - outer, o.u1, 0, o.top);
  black(o.u0 + outer, o.u1 - outer, o.top - outer, o.top);

  const a = o.u0 + outer;
  const b = o.u1 - outer;
  const top = o.top - outer;
  const wood = (u0: number, u1: number, y0: number, y1: number, along: Axis) =>
    g.add(box(u0, u1, y0, y1, -0.1, -0.02, m.newWood, { along }));
  wood(a, a + f, 0.04, top, 'y');
  wood(b - f, b, 0.04, top, 'y');
  wood(a + f, b - f, top - f, top, 'x');
  wood(a + f, b - f, 0.04, 0.04 + f, 'x');

  const split = 0.98;
  const panel = (y0: number, y1: number) =>
    g.add(box(a + f, b - f, y0, y1, -0.09, -0.05, m.plywood, { scale: 1.2 }));
  panel(0.04 + f, split - 0.006);
  panel(split + 0.006, top - f);
  g.add(box(b - f - 0.16, b - f - 0.135, 1.15, 1.38, -0.05, -0.025, m.blackPaint));

  // Brun överliggare som sticker ut förbi karmen.
  g.add(box(o.u0 - 0.25, o.u1 + 0.3, o.top, o.top + 0.15, -0.02, 0.03, m.doorWood, { scale: 1.5 }));
  return g;
}

/** Gammal brun plankdörr, upphöjd från golvet (långväggen). */
function buildPlankDoor(o: LocalOpening, m: Materials): THREE.Group {
  const g = new THREE.Group();
  const f = 0.05;
  const frame = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(box(u0, u1, y0, y1, -0.1, 0.008, m.blackPaint));
  frame(o.u0, o.u0 + f, o.sill, o.top);
  frame(o.u1 - f, o.u1, o.sill, o.top);
  frame(o.u0 + f, o.u1 - f, o.top - f, o.top);
  g.add(box(o.u0 + f, o.u1 - f, o.sill, o.top - f, -0.08, -0.04, m.plankDoor, { along: 'x' }));
  for (const y of [o.sill + 0.18, (o.sill + o.top) / 2, o.top - 0.25]) {
    g.add(box(o.u0 + f, o.u1 - f, y - 0.06, y + 0.06, -0.04, -0.015, m.plankDoor, { along: 'y' }));
  }
  return g;
}

export interface Shell {
  /** Ytterväggarna var för sig, så att de kan gömmas när kameran står utanför. */
  sofaWall: THREE.Group;
  kitchenWall: THREE.Group;
  kitchenGable: THREE.Group;
  farGable: THREE.Group;
  floor: THREE.Group;
}

export function buildShell(m: Materials): Shell {
  const { length: L, width: W, wallThickness: t } = D.room;
  const forward = (list: D.WallOpening[]): LocalOpening[] =>
    list.map((o) => ({ ...o, u0: o.from, u1: o.to }));
  const reversed = (list: D.WallOpening[], size: number): LocalOpening[] =>
    list.map((o) => ({ ...o, u0: size - o.to, u1: size - o.from }));

  // Soffväggen, z = 0: väggens axel sammanfaller med x.
  const sofaWall = buildWall(L, t, forward(D.sofaWall), m);

  // Långväggen, z = W: vänd ett halvt varv, väggens axel går mot -x.
  const kitchenWall = buildWall(L, t, reversed(D.kitchenWall, L), m);
  kitchenWall.position.set(L, 0, W);
  kitchenWall.rotation.y = Math.PI;

  // Köksgaveln, x = 0: väggens axel går mot -z.
  const kitchenGable = buildWall(W, 0, reversed(D.kitchenGable, W), m);
  kitchenGable.position.set(0, 0, W);
  kitchenGable.rotation.y = Math.PI / 2;

  // Bortre gaveln, x = L: väggens axel går mot +z.
  const farGable = buildWall(W, 0, forward(D.farGable), m);
  farGable.position.set(L, 0, 0);
  farGable.rotation.y = -Math.PI / 2;

  const floor = new THREE.Group();
  floor.add(box(-t, L + t, -0.15, 0, -t, W + t, m.concrete, { scale: 4 }));
  for (const z of D.floorJoints) {
    floor.add(box(0.3, D.newRoom.frontX - 0.3, 0, 0.004, z - 0.02, z + 0.02, m.groove));
  }

  // Rampen upp till plankdörren.
  const door = D.kitchenWall[0];
  const angle = Math.atan2(D.ramp.rise, D.ramp.length);
  const rampGeo = new THREE.BoxGeometry(D.ramp.width, 0.045, Math.hypot(D.ramp.rise, D.ramp.length));
  projectUV(rampGeo, 1, 1, 'x');
  const rampMesh = new THREE.Mesh(rampGeo, m.rampPlanks);
  rampMesh.rotation.x = -angle;
  rampMesh.position.set((door.from + door.to) / 2, D.ramp.rise / 2 - 0.01, W - D.ramp.length / 2);
  floor.add(rampMesh);

  return { sofaWall, kitchenWall, kitchenGable, farGable, floor };
}

/* ---------------------------------------------------------------- bjälklag */

export interface Structure {
  /** Takbrädorna – göms när man tittar ner i rummet uppifrån. */
  boards: THREE.Group;
  /** Takbjälkar, reglar och rundstock. */
  joists: THREE.Group;
  /** Bärlina och stolpar. */
  frame: THREE.Group;
  /** Lysrör och kabelrör. */
  lamps: THREE.Group;
}

export function buildStructure(m: Materials): Structure {
  const { length: L, width: W } = D.room;
  const c = D.ceiling;
  const nook = D.storageNook;

  const boards = new THREE.Group();
  const top = c.boards + c.boardThickness;
  boards.add(box(0, nook.fromX, c.boards, top, 0, W, m.whiteBoards, { scale: 2 }));
  boards.add(box(nook.fromX, L, c.boards, top, 0, nook.fromZ, m.whiteBoards, { scale: 2 }));
  boards.add(box(nook.fromX, L, c.boards, top, nook.fromZ, W, m.darkBoards, { scale: 2 }));

  const joists = new THREE.Group();
  for (const x of c.joistXs) {
    joists.add(
      box(x - c.joistWidth / 2, x + c.joistWidth / 2, D.joistBottom, c.boards, 0, W, m.whiteWood, {
        scale: 1.5,
        along: 'z',
      }),
    );
  }
  const logY = c.boards - c.logRadius;
  const logEnd = D.beam.z - D.beam.width / 2;
  joists.add(
    rod(new THREE.Vector3(c.logX, logY, 0), new THREE.Vector3(c.logX, logY, logEnd), c.logRadius, m.oldWood),
  );
  for (const x of nook.timberXs) {
    joists.add(
      box(x - 0.03, x + 0.03, D.beamBottom + 0.02, D.joistBottom, nook.fromZ, W, m.newWood, {
        along: 'z',
      }),
    );
  }

  const frame = new THREE.Group();
  const b = D.beam;
  frame.add(
    box(0, L, D.beamBottom, D.joistBottom, b.z - b.width / 2, b.z + b.width / 2, m.flakedPaint, {
      scale: 1.2,
    }),
  );
  for (const x of b.postXs) {
    const h = b.postSize / 2;
    frame.add(box(x - h, x + h, 0, D.beamBottom, b.z - h, b.z + h, m.tar, { along: 'y' }));
  }

  const lamps = new THREE.Group();
  for (const lamp of D.lamps) {
    const fixture = new THREE.Group();
    fixture.add(box(-0.62, 0.62, -0.05, 0, -0.045, 0.045, m.fixture));
    const tube = rod(new THREE.Vector3(-0.59, -0.065, 0), new THREE.Vector3(0.59, -0.065, 0), 0.016, m.tube);
    fixture.add(tube);
    fixture.position.set(lamp.x, lamp.top, lamp.z);
    if (lamp.along === 'z') fixture.rotation.y = Math.PI / 2;
    lamps.add(fixture);
  }
  // Kabelröret som armaturerna i köksdelen sitter på.
  lamps.add(
    rod(
      new THREE.Vector3(0.05, D.joistBottom - 0.012, 6.1),
      new THREE.Vector3(7.2, D.joistBottom - 0.012, 6.1),
      0.012,
      m.fixture,
    ),
  );

  return { boards, joists, frame, lamps };
}

/* ------------------------------------------------------- det nya rummet */

/**
 * Regelvägg med synlig isolering. Lokalt: x längs väggen, väggen ligger mellan
 * z = -tjocklek och z = 0. `door` är en öppning mätt längs väggen.
 */
function buildStudWall(
  length: number,
  height: number,
  m: Materials,
  door?: { from: number; to: number; top: number },
): THREE.Group {
  const g = new THREE.Group();
  const t = D.newRoom.wallThickness;
  const stud = 0.045;
  const wool = (u0: number, u1: number, y0: number, y1: number) =>
    g.add(box(u0, u1, y0, y1, -t + 0.012, -0.012, m.insulation, { scale: 1.2 }));
  const wood = (u0: number, u1: number, y0: number, y1: number, along: Axis) =>
    g.add(box(u0, u1, y0, y1, -t, 0, m.newWood, { along }));

  if (door) {
    wool(0, door.from, 0, height);
    wool(door.from, door.to, door.top, height);
    wool(door.to, length, 0, height);
    wood(door.from - stud, door.from, 0, height, 'y');
    wood(door.to, door.to + stud, 0, height, 'y');
    wood(door.from, door.to, door.top, door.top + stud, 'x');
  } else {
    wool(0, length, 0, height);
  }

  for (let u = 0; u <= length - stud + 1e-6; u += D.newRoom.studSpacing) {
    if (door && u > door.from - 2 * stud && u < door.to + stud) continue;
    wood(u, u + stud, 0, height, 'y');
  }
  wood(length - stud, length, 0, height, 'y');
  wood(0, length, height - stud, height, 'x');

  // Stålskena mot golvet (bruten i dörröppningen).
  const track = (u0: number, u1: number) => g.add(box(u0, u1, 0, 0.035, -t - 0.004, 0.004, m.steel));
  if (door) {
    track(0, door.from - stud);
    track(door.to + stud, length);
  } else {
    track(0, length);
  }
  return g;
}

/**
 * Det nya rummet färdigt: släta vitputsade väggar på båda sidor, golvlist och vitt
 * dörrfoder. Avloppsrören är inbyggda och syns inte.
 */
function buildPlasteredRoom(m: Materials, door: { from: number; to: number; top: number }): THREE.Group {
  const g = new THREE.Group();
  const r = D.newRoom;
  const L = D.room.length;
  const t = r.wallThickness;
  const x0 = r.frontX;
  const z1 = r.depthZ;
  const wall = (xa: number, xb: number, ya: number, yb: number, za: number, zb: number) =>
    g.add(box(xa, xb, ya, yb, za, zb, m.masonry, { scale: 2.4 }));

  // Väggen mot soffhörnan (under en takbjälke) och sidoväggen med dörröppningen.
  wall(x0, x0 + t, 0, D.joistBottom, 0, z1);
  const sx = x0 + t;
  const top = D.ceiling.boards;
  wall(sx, sx + door.from, 0, top, z1 - t, z1);
  wall(sx + door.from, sx + door.to, door.top, top, z1 - t, z1);
  wall(sx + door.to, L, 0, top, z1 - t, z1);

  // Golvlist längs utsidorna.
  const skirt = 0.08;
  g.add(box(x0 - 0.012, x0, 0, skirt, 0, z1, m.whitePaint));
  g.add(box(x0 - 0.012, sx + door.from, 0, skirt, z1, z1 + 0.012, m.whitePaint));
  g.add(box(sx + door.to, L, 0, skirt, z1, z1 + 0.012, m.whitePaint));

  // Dörrfoder på båda sidor om väggen.
  const f = 0.07;
  for (const [za, zb] of [
    [z1, z1 + 0.014],
    [z1 - t - 0.014, z1 - t],
  ]) {
    g.add(box(sx + door.from - f, sx + door.from, 0, door.top + f, za, zb, m.whitePaint));
    g.add(box(sx + door.to, sx + door.to + f, 0, door.top + f, za, zb, m.whitePaint));
    g.add(box(sx + door.from, sx + door.to, door.top, door.top + f, za, zb, m.whitePaint));
  }
  return g;
}

export function buildNewRoom(m: Materials): THREE.Group {
  const group = new THREE.Group();
  const r = D.newRoom;
  const L = D.room.length;
  const sideLength = L - r.frontX - r.wallThickness;
  const door = { from: r.doorFrom, to: r.doorFrom + r.doorWidth, top: r.doorHeight };

  if (r.finish === 'plaster') {
    group.add(buildPlasteredRoom(m, door));
  } else {
    // Reglväggen mot soffhörnan står under en takbjälke.
    const front = buildStudWall(r.depthZ, D.joistBottom, m);
    front.position.set(r.frontX, 0, 0);
    front.rotation.y = -Math.PI / 2;
    group.add(front);
    // Tvärregeln som sitter utanpå väggen i midjehöjd.
    group.add(box(r.frontX - 0.022, r.frontX, 1.12, 1.19, 0.15, r.depthZ - 0.3, m.newWood, { along: 'z' }));

    // Sidoväggen med dörren, mot gången till plywooddörren. Går upp mellan bjälkarna.
    const side = buildStudWall(sideLength, D.ceiling.boards, m, door);
    side.position.set(r.frontX + r.wallThickness, 0, r.depthZ);
    group.add(side);

    // Avloppsrör i hörnet mot soffväggen.
    const px = r.frontX - 0.09;
    group.add(rod(new THREE.Vector3(px, 0, 0.1), new THREE.Vector3(px, D.joistBottom, 0.1), 0.055, m.drainPipe));
    group.add(rod(new THREE.Vector3(px, 0.34, 0.12), new THREE.Vector3(px, 0.27, 1.0), 0.04, m.drainPipe));
    group.add(rod(new THREE.Vector3(px, 0.27, 1.0), new THREE.Vector3(px, 0.266, 1.05), 0.048, m.drainPipe));
  }

  // Dörrbladet: brun spegeldörr med mässingsknopp.
  const leaf = new THREE.Group();
  const w = 0.825;
  const h = 2.04;
  leaf.add(box(0, w, 0, h, -0.02, 0.02, m.doorWood, { along: 'y' }));
  const panel = (y0: number, y1: number) => {
    leaf.add(box(0.12, w - 0.12, y0, y1, 0.02, 0.028, m.doorWood, { along: 'y' }));
    leaf.add(box(0.12, w - 0.12, y0, y1, -0.028, -0.02, m.doorWood, { along: 'y' }));
  };
  panel(0.2, 0.85);
  panel(0.98, 1.22);
  panel(1.35, 1.9);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), m.brass);
  knob.position.set(0.07, 1.02, 0.055);
  leaf.add(knob);
  leaf.position.set(
    r.frontX + r.wallThickness + door.from + (r.doorWidth - w) / 2,
    0.01,
    r.depthZ - r.wallThickness / 2,
  );
  group.add(leaf);

  return group;
}
