import * as THREE from 'three';
import * as D from './dimensions';
import { box, rod } from './build';
import type { Materials } from './textures';

/**
 * En ljuskälla i mysbelysningen. Samma lista används av visaren och av
 * raytracing-renderingen, så att lamporna lyser från samma ställen i båda.
 */
export interface LightSource {
  kind: 'lamp' | 'candle' | 'fire' | 'string';
  position: [number, number, number];
  color: number;
  /** Ungefär motsvarande glödlampa. */
  watts: number;
}

const WARM = 0xffc58a;
const CANDLE = 0xffa24d;

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Öppen, konisk eller rak skärm med mitten i (x, y, z). */
function shade(
  rTop: number,
  rBottom: number,
  height: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, height, 28, 1, true), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function bulb(x: number, y: number, z: number, radius: number, m: Materials) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 16, 12), m.bulb);
  mesh.position.set(x, y, z);
  return mesh;
}

export interface Lighting {
  group: THREE.Group;
  sources: LightSource[];
}

export function buildLighting(m: Materials): Lighting {
  const group = new THREE.Group();
  group.name = 'Lampor';
  const sources: LightSource[] = [];
  const cfg = D.lighting;
  const lamp = (x: number, y: number, z: number, watts: number) =>
    sources.push({ kind: 'lamp', position: [x, y, z], color: WARM, watts });

  /* Taklampor i sladd. */
  for (const p of cfg.pendants) {
    const linen = p.shade === 'linen';
    const height = linen ? 0.24 : 0.16;
    const rTop = linen ? 0.13 : 0.05;
    const rBottom = linen ? 0.27 : 0.17;
    const mid = p.bottom + height / 2;
    group.add(rod(v(p.x, p.bottom + height, p.z), v(p.x, D.ceiling.boards, p.z), 0.006, m.cord));
    group.add(shade(rTop, rBottom, height, p.x, mid, p.z, linen ? m.linenShade : m.enamelShade));
    if (!linen) group.add(shade(rTop - 0.004, rBottom - 0.004, height - 0.004, p.x, mid, p.z, m.enamelInside));
    group.add(rod(v(p.x, p.bottom + height - 0.01, p.z), v(p.x, p.bottom + height + 0.05, p.z), rTop, linen ? m.brass : m.enamelShade));
    group.add(bulb(p.x, p.bottom + 0.07, p.z, 0.04, m));
    lamp(p.x, p.bottom + 0.05, p.z, p.watts);
  }

  /* Golvlampor: träfot, stång och rak linneskärm. */
  for (const f of cfg.floorLamps) {
    group.add(rod(v(f.x, 0, f.z), v(f.x, 0.03, f.z), 0.15, m.darkWood));
    group.add(rod(v(f.x, 0.03, f.z), v(f.x, 1.36, f.z), 0.014, m.brass));
    group.add(shade(0.19, 0.22, 0.3, f.x, 1.47, f.z, m.linenShade));
    group.add(bulb(f.x, 1.44, f.z, 0.04, m));
    lamp(f.x, 1.44, f.z, f.watts);
  }

  /* Små bordslampor: keramikfot och konisk skärm, 0,3 m höga. */
  const smallLamp = (x: number, y: number, z: number, watts: number) => {
    group.add(rod(v(x, y, z), v(x, y + 0.015, z), 0.055, m.brass));
    group.add(rod(v(x, y + 0.015, z), v(x, y + 0.17, z), 0.028, m.wax));
    group.add(shade(0.06, 0.11, 0.13, x, y + 0.235, z, m.linenShade));
    group.add(bulb(x, y + 0.22, z, 0.025, m));
    lamp(x, y + 0.22, z, watts);
  };
  for (const t of cfg.tableLamps) smallLamp(t.x, t.y, t.z, t.watts);

  /* Fönsterlampor står på fönsterbänken, mitt i nischen. */
  const { length: L, width: W } = D.room;
  const windowWalls: [D.WallOpening[], (o: D.WallOpening) => [number, number]][] = [
    [D.sofaWall, (o) => [(o.from + o.to) / 2, -0.12]],
    [D.kitchenWall, (o) => [(o.from + o.to) / 2, W + 0.12]],
    [D.kitchenGable, (o) => [-0.12, (o.from + o.to) / 2]],
    [D.farGable, (o) => [L + 0.12, (o.from + o.to) / 2]],
  ];
  for (const [openings, at] of windowWalls) {
    for (const o of openings) {
      if (o.kind !== 'window' || !cfg.windowLamps.includes(o.id)) continue;
      const [x, z] = at(o);
      smallLamp(x, o.sill, z, 15);
    }
  }

  /* Vägglampor: mässingsarm och glaskupa. */
  for (const s of cfg.sconces) {
    // Väggens insida och riktningen in i rummet.
    const [wx, wz, nx, nz] =
      s.wall === 'kitchenGable'
        ? [0, s.at, 1, 0]
        : s.wall === 'farGable'
          ? [L, s.at, -1, 0]
          : [s.at, W, 0, -1];
    const tip = v(wx + nx * 0.14, s.y, wz + nz * 0.14);
    group.add(rod(v(wx, s.y, wz), v(wx + nx * 0.015, s.y, wz + nz * 0.015), 0.05, m.brass));
    group.add(rod(v(wx, s.y, wz), tip, 0.009, m.brass));
    group.add(bulb(tip.x, tip.y + 0.03, tip.z, 0.065, m));
    lamp(tip.x + nx * 0.05, tip.y + 0.03, tip.z + nz * 0.05, s.watts);
  }

  /* Levande ljus i mässingsstake. */
  for (const c of cfg.candles) {
    const top = c.y + c.height;
    group.add(rod(v(c.x, c.y, c.z), v(c.x, c.y + 0.012, c.z), 0.035, m.brass));
    group.add(rod(v(c.x, c.y + 0.012, c.z), v(c.x, top, c.z), 0.012, m.wax));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), m.flame);
    flame.scale.set(1, 2.2, 1);
    flame.position.set(c.x, top + 0.024, c.z);
    group.add(flame);
    sources.push({ kind: 'candle', position: [c.x, top + 0.03, c.z], color: CANDLE, watts: 3 });
  }

  /* Ljusslinga längs bärlinan. */
  const s = cfg.stringLights;
  const beamSide = D.beam.z - D.beam.width / 2 - 0.025;
  const count = Math.floor((s.toX - s.fromX) / s.spacing);
  for (let i = 0; i <= count; i++) {
    const x = s.fromX + i * s.spacing;
    // Slingan hänger i mjuka bågar mellan fästpunkterna.
    const sag = 0.05 * Math.sin((i / count) * Math.PI * 6) ** 2;
    const y = D.joistBottom - 0.06 - sag;
    group.add(bulb(x, y - 0.03, beamSide, 0.022, m));
    if (i < count) {
      const next = 0.05 * Math.sin(((i + 1) / count) * Math.PI * 6) ** 2;
      group.add(rod(v(x, y, beamSide), v(x + s.spacing, D.joistBottom - 0.06 - next, beamSide), 0.003, m.cord));
    }
    sources.push({ kind: 'string', position: [x, y - 0.03, beamSide - 0.03], color: WARM, watts: 2 });
  }

  /* Skenet från braskaminen och vedspisen. */
  // Ljuset sitter en bit framför kaminens lucka.
  const stove = D.furniture.stove;
  const facing = THREE.MathUtils.degToRad(stove.turn);
  const stoveX = stove.x + Math.sin(facing) * 0.3;
  const stoveZ = stove.z + Math.cos(facing) * 0.3;
  sources.push({ kind: 'fire', position: [stoveX, 0.5, stoveZ], color: 0xff7a2e, watts: 25 });

  // En lykta med ett ljus i, på golvet bredvid vedspisen.
  const lx = D.cookstoveReach + 0.3;
  group.add(box(lx - 0.09, lx + 0.09, 0, 0.012, 0.21, 0.39, m.cord));
  group.add(box(lx - 0.09, lx + 0.09, 0.3, 0.312, 0.21, 0.39, m.cord));
  for (const [dx, dz] of [
    [-0.085, -0.085],
    [0.085, -0.085],
    [-0.085, 0.085],
    [0.085, 0.085],
  ]) {
    group.add(rod(v(lx + dx, 0, 0.3 + dz), v(lx + dx, 0.3, 0.3 + dz), 0.005, m.cord));
  }
  group.add(rod(v(lx, 0.012, 0.3), v(lx, 0.14, 0.3), 0.03, m.wax));
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.009, 10, 8), m.flame);
  flame.scale.set(1, 2.2, 1);
  flame.position.set(lx, 0.165, 0.3);
  group.add(flame);
  sources.push({ kind: 'candle', position: [lx, 0.17, 0.3], color: CANDLE, watts: 3 });

  return { group, sources };
}
