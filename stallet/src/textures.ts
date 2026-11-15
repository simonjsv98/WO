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

/* ------------------------------------------------------------------- brus */

/**
 * En ruta sömlöst brus i flera skalor (värden 0–1), som alla ytor lånar av: det ger
 * färgerna naturlig ojämnhet och ytorna relief. Räknas ut en gång.
 */
const NOISE = 512;
const noise = (() => {
  const rnd = mulberry32(99);
  const out = new Float32Array(NOISE * NOISE);
  let total = 0;
  for (let octave = 0, period = 4, weight = 1; octave < 6; octave++, period *= 2, weight *= 0.55) {
    const lattice = new Float32Array(period * period);
    for (let i = 0; i < lattice.length; i++) lattice[i] = rnd();
    const cell = NOISE / period;
    for (let y = 0; y < NOISE; y++) {
      const fy = y / cell;
      const y0 = Math.floor(fy) % period;
      const y1 = (y0 + 1) % period;
      const ty = fy - Math.floor(fy);
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < NOISE; x++) {
        const fx = x / cell;
        const x0 = Math.floor(fx) % period;
        const x1 = (x0 + 1) % period;
        const tx = fx - Math.floor(fx);
        const sx = tx * tx * (3 - 2 * tx);
        const top = lattice[y0 * period + x0] * (1 - sx) + lattice[y0 * period + x1] * sx;
        const bottom = lattice[y1 * period + x0] * (1 - sx) + lattice[y1 * period + x1] * sx;
        out[y * NOISE + x] += (top * (1 - sy) + bottom * sy) * weight;
      }
    }
    total += weight;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
})();

/** Bruset i punkten (u, v), där 1 är en hel ruta. Heltalsfaktorer håller det sömlöst. */
function noiseAt(u: number, v: number): number {
  const x = Math.floor((((u % 1) + 1) % 1) * NOISE);
  const y = Math.floor((((v % 1) + 1) % 1) * NOISE);
  return noise[y * NOISE + x];
}

interface Surface {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

/**
 * Ritar en yta och ger tillbaka både färgbild och reliefbild. Ritfunktionerna är skrivna
 * för 512 pixlar; `detail` ritar samma sak i högre upplösning. Efteråt läggs brus på
 * färgen (stora fläckar och fin kornighet), och reliefen tas från bildens ljushet – mörka
 * streck som skarvar, sprickor och ådring blir då fåror.
 */
function surface(seed: number, draw: Draw, detail = 1, mottle = 0.08, grit = 0.04): Surface {
  const size = 512 * detail;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.scale(detail, detail);
  draw(ctx, 512, mulberry32(seed));
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  const image = ctx.getImageData(0, 0, size, size);
  const px = image.data;
  const relief = document.createElement('canvas');
  relief.width = relief.height = size;
  const rctx = relief.getContext('2d')!;
  const rimage = rctx.createImageData(size, size);
  const rpx = rimage.data;
  const ou = (seed * 0.137) % 1;
  const ov = (seed * 0.291) % 1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const large = noiseAt(u + ou, v + ov) - 0.5;
      const fine = noiseAt(u * 7 + ov, v * 7 + ou) - 0.5;
      const i = (y * size + x) * 4;
      const gain = 1 + large * 2 * mottle + fine * 2 * grit;
      const r = Math.min(255, px[i] * gain);
      const g = Math.min(255, px[i + 1] * gain);
      const b = Math.min(255, px[i + 2] * gain);
      px[i] = r;
      px[i + 1] = g;
      px[i + 2] = b;
      const height = Math.min(255, (0.299 * r + 0.587 * g + 0.114 * b) * 0.85 + fine * 36 + 30);
      rpx[i] = rpx[i + 1] = rpx[i + 2] = height;
      rpx[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  rctx.putImageData(rimage, 0, 0);

  const finish = (c: HTMLCanvasElement, color: boolean) => {
    const tex = new THREE.CanvasTexture(c);
    if (color) tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = 8;
    return tex;
  };
  return { map: finish(canvas, true), bump: finish(relief, false) };
}

/** Bara brus som relief, för enfärgade ytor som läder, gjutjärn och målat trä. */
const grainBump = (() => {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const h = noiseAt((x / 256) * 6, (y / 256) * 6) * 150 + noiseAt(x / 256, y / 256) * 105;
      const i = (y * 256 + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = h;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
})();

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

/** Trasmatta: täta ränder tvärs över mattan och ljusa varptrådar längs den. En bild = 1 m. */
function ragRug(palette: string[]): Draw {
  return (ctx, s, rnd) => {
    for (let x = 0; x < s; ) {
      const w = 3 + Math.floor(rnd() * 11);
      ctx.fillStyle = palette[Math.floor(rnd() * palette.length)];
      ctx.fillRect(x, 0, w, s);
      x += w;
    }
    ctx.fillStyle = '#efe6d2';
    for (let y = 0; y < s; y += 8) {
      ctx.globalAlpha = 0.25 + rnd() * 0.2;
      ctx.fillRect(0, y, s, 1.5);
    }
    ctx.globalAlpha = 1;
  };
}

function standard(s: Surface, roughness = 0.95, bumpScale = 1.2): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: s.map, bumpMap: s.bump, bumpScale, roughness, metalness: 0 });
}

function flat(color: number, roughness = 0.8, metalness = 0, bumpScale = 0): THREE.MeshStandardMaterial {
  const material = new THREE.MeshStandardMaterial({ color, roughness, metalness });
  if (bumpScale) {
    material.bumpMap = grainBump;
    material.bumpScale = bumpScale;
  }
  return material;
}

export function createMaterials() {
  const materials = {
    plaster: standard(surface(1, plaster, 2, 0.05, 0.03), 0.95, 1.1),
    concrete: standard(surface(2, concrete, 2, 0.16, 0.08), 0.7, 1.3),
    whiteWood: standard(surface(3, whiteWood, 2, 0.05, 0.03), 0.7, 1.0),
    whiteBoards: standard(surface(4, whiteBoards, 2, 0.05, 0.03), 0.75, 1.4),
    darkBoards: standard(surface(5, darkBoards)),
    flakedPaint: standard(surface(6, flakedPaint, 2, 0.06, 0.04), 0.8, 1.6),
    tar: standard(surface(7, tar), 0.85),
    insulation: standard(surface(8, insulation), 1),
    plywood: standard(surface(9, plywood)),
    plankDoor: standard(surface(10, planks('#4b3323', '#6a4a31', '#22160d'))),
    rampPlanks: standard(surface(11, planks('#6f6152', '#8b7c69', '#3a3027'))),
    newWood: standard(surface(12, rawWood('#d8b98a', '#ecd3a8', '#a9814f'))),
    oldWood: standard(surface(13, rawWood('#6b5d4d', '#8a7a66', '#342a20'))),
    doorWood: standard(surface(14, rawWood('#a55f2b', '#c47c3e', '#6d3a15')), 0.5),
    whitePaint: flat(0xf1eee6, 0.55, 0, 0.3),
    blackPaint: flat(0x15130f, 0.6, 0, 0.3),
    steel: flat(0xa7abad, 0.45, 0.6),
    drainPipe: flat(0x7b7f82, 0.6),
    lintel: flat(0x8a8377, 1),
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
    // Lampor
    linenShade: new THREE.MeshStandardMaterial({
      color: 0xf2e6cf,
      emissive: 0xffc98a,
      emissiveIntensity: 0.9,
      roughness: 0.9,
      side: THREE.DoubleSide,
    }),
    enamelShade: new THREE.MeshStandardMaterial({ color: 0x24362f, roughness: 0.35, metalness: 0.3, side: THREE.DoubleSide }),
    enamelInside: new THREE.MeshStandardMaterial({ color: 0xf4efe2, emissive: 0xffc98a, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide }),
    bulb: new THREE.MeshStandardMaterial({ color: 0xfff1d8, emissive: 0xffd9a0, emissiveIntensity: 2.2 }),
    flame: new THREE.MeshStandardMaterial({ color: 0xffe2a8, emissive: 0xffb347, emissiveIntensity: 2.6 }),
    wax: flat(0xf3eedf, 0.6),
    cord: flat(0x1b1a18, 0.7),
    // Inredning
    rugGreen: standard(surface(20, ragRug(['#d9cfb8', '#8fa07a', '#6f8463', '#c9a9a0', '#e6dcc6', '#4f5a48', '#b7b09a']), 2, 0.1, 0.12), 1, 3),
    rugBlue: standard(surface(21, ragRug(['#e3dccb', '#7b8ea3', '#56677d', '#c8c1b0', '#a9b4bd', '#3d4a5c', '#d7c6b2']), 2, 0.1, 0.12), 1, 3),
    velvet: flat(0x6b6f76, 0.9, 0, 0.8),
    wool: flat(0x3f4348, 1, 0, 1.2),
    sheepskin: flat(0xe9e2d2, 1, 0, 2.5),
    ceramic: flat(0xe9ecee, 0.25),
    apple: flat(0xb8402e, 0.45),
    bark: standard(surface(22, rawWood('#5a4636', '#77604b', '#2e2219')), 1, 3),
    // Möbler
    masonry: standard(surface(18, (ctx, size, rnd) => {
      ctx.fillStyle = '#f0ede3';
      ctx.fillRect(0, 0, size, size);
      blotches(ctx, size, rnd, 70, ['#fbf9f3', '#dedacd'], 60, 0.25);
    })),
    pine: standard(surface(15, rawWood('#dcc296', '#eed9b2', '#b08a58')), 0.8),
    darkWood: standard(surface(16, rawWood('#4a2e1e', '#6a4630', '#24140b')), 0.6),
    tableTop: standard(surface(17, rawWood('#d2b48a', '#e6cfa8', '#a37f52')), 0.6),
    leather: flat(0xd3c7ab, 0.5, 0, 0.6),
    bluePaint: flat(0x5a6d8c, 0.55, 0, 0.3),
    cabinetInside: flat(0xd9dcd8, 0.8),
    appliance: flat(0xf4f4f1, 0.35),
    ovenGlass: flat(0x0c0c0d, 0.15, 0.3),
    enamelBlue: flat(0x3f7aa6, 0.4),
    castIron: flat(0x1a1a1c, 0.5, 0.45, 0.5),
    hearth: flat(0x2b2c2e, 0.4, 0.5),
    ember: new THREE.MeshStandardMaterial({ color: 0x1a0800, emissive: 0xe0480a, emissiveIntensity: 1.1 }),
  };
  // Namnge materialen så att de går att känna igen efter export (t.ex. i Blender).
  for (const [name, material] of Object.entries(materials)) material.name = name;
  return materials;
}

export type Materials = ReturnType<typeof createMaterials>;
