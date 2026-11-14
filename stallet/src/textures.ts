import * as THREE from 'three';

/** Litet deterministiskt slumptal så att ytorna ser likadana ut varje gång. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Draw = (ctx: CanvasRenderingContext2D, size: number, rnd: () => number) => void;

function canvasTexture(seed: number, draw: Draw, size = 512): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size, mulberry32(seed));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

/** Mjuka fläckar som bryter upp en jämn färg. */
function blotches(
  ctx: CanvasRenderingContext2D,
  size: number,
  rnd: () => number,
  count: number,
  colors: string[],
  maxRadius: number,
  alpha: number,
) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = (0.3 + rnd() * 0.7) * maxRadius;
    const color = colors[Math.floor(rnd() * colors.length)];
    // Ritas om runt kanterna så att mönstret går att upprepa utan skarvar.
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        const g = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r);
        g.addColorStop(0, color);
        g.addColorStop(1, color + '00'); // samma färg, genomskinlig – annars blir det mörka ringar
        ctx.globalAlpha = alpha * (0.4 + rnd() * 0.6);
        ctx.fillStyle = g;
        ctx.fillRect(x + dx - r, y + dy - r, r * 2, r * 2);
      }
    }
  }
  ctx.globalAlpha = 1;
}

/** Ådring: tunna streck längs u (vågrätt i bilden). */
function grain(
  ctx: CanvasRenderingContext2D,
  size: number,
  rnd: () => number,
  count: number,
  color: string,
  alpha: number,
) {
  ctx.strokeStyle = color;
  for (let i = 0; i < count; i++) {
    const y = rnd() * size;
    ctx.globalAlpha = alpha * rnd();
    ctx.lineWidth = 0.5 + rnd() * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    const wobble = (rnd() - 0.5) * 6;
    ctx.bezierCurveTo(size * 0.33, y + wobble, size * 0.66, y - wobble, size, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

/** Vitkalkad mur. En bild motsvarar 2,4 × 2,4 m, med svaga blockskift i nederdelen. */
const plaster: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#e8e4d6';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 90, ['#f6f3ea', '#d6d0bf', '#cfc8b4'], 70, 0.22);
  const m = s / 2.4;
  ctx.strokeStyle = '#7d7566';
  ctx.lineWidth = 1.2;
  for (let h = 0.3, row = 0; h <= 1.5; h += 0.3, row++) {
    const y = s - h * m;
    ctx.globalAlpha = 0.2 - row * 0.025;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(s, y);
    ctx.stroke();
    for (let x = (row % 2) * 0.3 * m; x < s; x += 0.6 * m) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 0.3 * m);
      ctx.stroke();
    }
  }
  // Smutsigare ner mot golvet.
  ctx.globalAlpha = 1;
  const g = ctx.createLinearGradient(0, s * 0.72, 0, s);
  g.addColorStop(0, 'rgba(90,82,70,0)');
  g.addColorStop(1, 'rgba(90,82,70,0.28)');
  ctx.fillStyle = g;
  ctx.fillRect(0, s * 0.72, s, s * 0.28);
  // Flagor där putsen släppt.
  ctx.fillStyle = '#6f685c';
  for (let i = 0; i < 40; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.3;
    ctx.fillRect(rnd() * s, s * (0.25 + rnd() * 0.75), 1 + rnd() * 5, 1 + rnd() * 3);
  }
  ctx.globalAlpha = 1;
};

/** Sprucket betonggolv. En bild motsvarar 4 × 4 m. */
const concrete: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#8d8982';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 140, ['#a19c93', '#77736c', '#6b6862', '#958f84'], 60, 0.3);
  ctx.strokeStyle = '#4f4c47';
  for (let i = 0; i < 9; i++) {
    let x = rnd() * s;
    let y = rnd() * s;
    let dir = rnd() * Math.PI * 2;
    ctx.globalAlpha = 0.35 + rnd() * 0.3;
    ctx.lineWidth = 0.8 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      dir += (rnd() - 0.5) * 0.9;
      x += Math.cos(dir) * 16;
      y += Math.sin(dir) * 16;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#e4e1d8';
  for (let i = 0; i < 260; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.4;
    ctx.fillRect(rnd() * s, rnd() * s, 1 + rnd() * 2.5, 1 + rnd() * 2.5);
  }
  ctx.globalAlpha = 1;
};

/** Vitmålat trä, ådring längs u. */
const whiteWood: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#ebe7da';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 40, ['#f7f4ec', '#d5cfbe'], 80, 0.25);
  grain(ctx, s, rnd, 70, '#a39a86', 0.3);
  blotches(ctx, s, rnd, 6, ['#a8763f'], 18, 0.35);
};

/** Vitmålade takbrädor. En bild motsvarar 2 × 2 m med nio brädor i bredd. */
const whiteBoards: Draw = (ctx, s, rnd) => {
  whiteWood(ctx, s, rnd);
  const boards = 9;
  for (let i = 0; i < boards; i++) {
    const y = (i / boards) * s;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#4c463b';
    ctx.fillRect(0, y, s, 1.6);
    ctx.globalAlpha = 0.12 * rnd();
    ctx.fillStyle = rnd() > 0.5 ? '#8d846f' : '#ffffff';
    ctx.fillRect(0, y, s, s / boards);
    // Skarv mitt på brädan.
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = '#4c463b';
    ctx.fillRect(rnd() * s, y, 1.4, s / boards);
  }
  ctx.globalAlpha = 1;
};

/** Mörka, omålade takbrädor i förrådshörnan. */
const darkBoards: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#4a3a2b';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 40, ['#5d4a37', '#33271c'], 80, 0.4);
  grain(ctx, s, rnd, 90, '#241a11', 0.5);
  ctx.fillStyle = '#1c140d';
  for (let i = 0; i < 9; i++) ctx.fillRect(0, (i / 9) * s, s, 2);
};

/** Bärlinan: vit färg som flagnat och visar mörkt trä. */
const flakedPaint: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#e6e2d5';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 30, ['#f5f2ea', '#cdc6b3'], 70, 0.3);
  // Flagorna är avlånga i virkets längdriktning och ritas om över kanten så att mönstret upprepas snyggt.
  ctx.fillStyle = '#3d362d';
  for (let i = 0; i < 420; i++) {
    const x = rnd() * s;
    const y = rnd() * s;
    const w = 5 + rnd() * rnd() * 42;
    const h = 0.8 + rnd() * 3;
    const tilt = (rnd() - 0.5) * 0.3;
    ctx.globalAlpha = 0.3 + rnd() * 0.55;
    for (const dx of [-s, 0, s]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y, w, h, tilt, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  grain(ctx, s, rnd, 50, '#2a241d', 0.35);
};

/** Tjärade, svarta stolpar. */
const tar: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#16130f';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 30, ['#2b251d', '#0a0907'], 60, 0.6);
  grain(ctx, s, rnd, 80, '#4a4136', 0.4);
  grain(ctx, s, rnd, 12, '#b8b0a0', 0.25);
};

/** Gul mineralull. */
const insulation: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#e2cf63';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 260, ['#f0e184', '#cdb548', '#d9c45a', '#f4e89a'], 34, 0.45);
};

/** Väderbiten plywood. */
const plywood: Draw = (ctx, s, rnd) => {
  ctx.fillStyle = '#7d6f5e';
  ctx.fillRect(0, 0, s, s);
  blotches(ctx, s, rnd, 50, ['#93846f', '#5f5345'], 70, 0.4);
  ctx.strokeStyle = '#4a4034';
  for (let i = 0; i < 46; i++) {
    const y = rnd() * s;
    const amp = 6 + rnd() * 26;
    const phase = rnd() * 6;
    ctx.globalAlpha = 0.25 + rnd() * 0.35;
    ctx.lineWidth = 0.8 + rnd() * 1.4;
    ctx.beginPath();
    for (let x = 0; x <= s; x += 8) {
      const yy = y + Math.sin((x / s) * Math.PI * 2 * (1 + (i % 3)) + phase) * amp;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
};

/** Stående plank. En bild motsvarar 1 × 1 m med åtta plankor i bredd. */
function planks(base: string, light: string, dark: string): Draw {
  return (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    const count = 8;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * s;
      ctx.globalAlpha = 0.25 * rnd();
      ctx.fillStyle = rnd() > 0.5 ? light : dark;
      ctx.fillRect(x, 0, s / count, s);
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(s, 0);
    ctx.rotate(Math.PI / 2);
    grain(ctx, s, rnd, 120, dark, 0.45);
    ctx.restore();
    ctx.fillStyle = dark;
    for (let i = 0; i < count; i++) ctx.fillRect((i / count) * s, 0, 2, s);
  };
}

/** Obehandlat trä med ådring längs u. */
function rawWood(base: string, light: string, dark: string): Draw {
  return (ctx, s, rnd) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, s, s);
    blotches(ctx, s, rnd, 30, [light, dark], 70, 0.25);
    grain(ctx, s, rnd, 110, dark, 0.4);
  };
}

function standard(map: THREE.Texture, roughness = 0.95): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map, roughness, metalness: 0 });
}

function flat(color: number, roughness = 0.8, metalness = 0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export function createMaterials() {
  return {
    plaster: standard(canvasTexture(1, plaster)),
    concrete: standard(canvasTexture(2, concrete, 1024)),
    whiteWood: standard(canvasTexture(3, whiteWood)),
    whiteBoards: standard(canvasTexture(4, whiteBoards)),
    darkBoards: standard(canvasTexture(5, darkBoards)),
    flakedPaint: standard(canvasTexture(6, flakedPaint)),
    tar: standard(canvasTexture(7, tar), 0.85),
    insulation: standard(canvasTexture(8, insulation), 1),
    plywood: standard(canvasTexture(9, plywood)),
    plankDoor: standard(canvasTexture(10, planks('#4b3323', '#6a4a31', '#22160d'))),
    rampPlanks: standard(canvasTexture(11, planks('#6f6152', '#8b7c69', '#3a3027'))),
    newWood: standard(canvasTexture(12, rawWood('#d8b98a', '#ecd3a8', '#a9814f'))),
    oldWood: standard(canvasTexture(13, rawWood('#6b5d4d', '#8a7a66', '#342a20'))),
    doorWood: standard(canvasTexture(14, rawWood('#a55f2b', '#c47c3e', '#6d3a15')), 0.5),
    whitePaint: flat(0xf1eee6, 0.6),
    blackPaint: flat(0x15130f, 0.7),
    steel: flat(0xa7abad, 0.45, 0.6),
    drainPipe: flat(0x7b7f82, 0.6),
    lintel: flat(0x8a8377, 1),
    groove: flat(0x3d3a36, 1),
    brass: flat(0xb08a3c, 0.35, 0.8),
    fixture: flat(0xf3f1ea, 0.5),
    tube: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3d6, emissiveIntensity: 1.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0xeaf2f2,
      emissive: 0xdfeaea,
      emissiveIntensity: 0.55,
      transparent: true,
      opacity: 0.55,
      roughness: 0.2,
    }),
    ground: flat(0x7f8a6c, 1),
  };
}

export type Materials = ReturnType<typeof createMaterials>;
