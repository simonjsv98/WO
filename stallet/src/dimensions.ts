/**
 * Alla mått för stallet, i meter. Ändra här när något är uppmätt på riktigt –
 * modellen byggs helt utifrån de här värdena.
 *
 * Koordinater: origo är hörnet mellan köksgaveln och soffväggen.
 *   x går längs soffväggen (10 m), från köksgaveln mot gaveln med plywooddörren.
 *   z går tvärs över rummet (8 m), från soffväggen mot långväggen med plankdörren.
 *   y är höjd över golvet.
 *
 * Yttermåtten 8 × 10 m är givna. Allt annat är uppskattat ur foton (ungefär ±0,4 m).
 */

export const room = {
  length: 10,
  width: 8,
  wallThickness: 0.4,
  /** Murkrönets höjd – väggarna går lite förbi takbrädorna. */
  wallTop: 2.5,
};

export const ceiling = {
  /** Underkant takbrädor. */
  boards: 2.35,
  boardThickness: 0.03,
  /** Takbjälkarna går tvärs över rummet (i z-led) och vilar på bärlinan. */
  joistHeight: 0.19,
  joistWidth: 0.16,
  joistXs: [0.85, 1.8, 2.75, 3.7, 4.65, 5.6, 6.55, 7.5, 8.45],
  /** Omålad rundstock närmast gaveln, över plywooddörren. */
  logX: 9.45,
  logRadius: 0.1,
};

export const joistBottom = ceiling.boards - ceiling.joistHeight;

/** Bärlinan: längsgående balk som bär upp takbjälkarna, på svarta stolpar. */
export const beam = {
  z: 4.7,
  width: 0.22,
  height: 0.24,
  postSize: 0.17,
  postXs: [2.6, 3.6, 4.6, 8.3],
};

export const beamBottom = joistBottom - beam.height;

export interface WallOpening {
  id: string;
  /** Läge längs väggen i världskoordinater (x för långväggar, z för gavlar). */
  from: number;
  to: number;
  sill: number;
  top: number;
  kind: 'window' | 'whiteDoor' | 'plywoodDoor' | 'plankDoor';
  /** Antal rutor i fönstret. */
  panes?: 1 | 2;
  /** Frilagd betongbalk ovanför öppningen. */
  lintel?: boolean;
}

/** Soffväggen, z = 0. */
export const sofaWall: WallOpening[] = [
  { id: 'S1', from: 2.0, to: 3.35, sill: 1.12, top: 1.82, kind: 'window', panes: 2 },
  { id: 'S2', from: 5.65, to: 6.75, sill: 1.12, top: 1.82, kind: 'window', panes: 2 },
];

/** Köksgaveln, x = 0. Lägen i z. */
export const kitchenGable: WallOpening[] = [
  { id: 'A3', from: 1.36, to: 2.46, sill: 1.05, top: 1.74, kind: 'window', panes: 2 },
  { id: 'vit dörr', from: 3.1, to: 3.95, sill: 0, top: 1.7, kind: 'whiteDoor' },
  { id: 'K2', from: 5.05, to: 5.9, sill: 0.95, top: 1.78, kind: 'window', panes: 1 },
  { id: 'K1', from: 7.05, to: 7.87, sill: 0.95, top: 1.78, kind: 'window', panes: 1 },
];

/** Gaveln med plywooddörren, x = 10. Lägen i z. */
export const farGable: WallOpening[] = [
  { id: 'plywooddörr', from: 2.9, to: 4.05, sill: 0, top: 2.0, kind: 'plywoodDoor' },
  { id: 'B1', from: 5.45, to: 6.45, sill: 1.25, top: 1.85, kind: 'window', panes: 2, lintel: true },
];

/** Långväggen mitt emot soffan, z = 8. Lägen i x. */
export const kitchenWall: WallOpening[] = [
  { id: 'plankdörr', from: 7.05, to: 8.0, sill: 0.3, top: 2.15, kind: 'plankDoor' },
];

/** Det nya isolerade rummet i hörnet soffvägg / bortre gavel. */
export const newRoom = {
  /** Reglväggen mot soffhörnan ligger vid det här x-värdet. */
  frontX: 7.5,
  /** Rummets bredd ut från soffväggen (yttersida sidovägg). */
  depthZ: 2.5,
  wallThickness: 0.095,
  studSpacing: 0.6,
  /** Dörröppningen i sidoväggen, mätt från reglväggens hörn. */
  doorFrom: 0.35,
  doorWidth: 0.87,
  doorHeight: 2.06,
  /**
   * 'plaster' = färdigt: vitputsade väggar med golvlist och dörrfoder, avloppsrören inbyggda.
   * 'studs' = som i fotona: reglar, gul isolering och synliga avloppsrör.
   */
  finish: 'plaster' as 'plaster' | 'studs',
};

/**
 * Skarvar i golvet längs stolpraden (z-lägen) – kanterna på den gamla gången/rännan
 * från när det var stall.
 */
export const floorJoints = [beam.z - 0.17, beam.z - 1.05];

/** Träramp upp till plankdörren. */
export const ramp = { width: 1.15, length: 1.9, rise: 0.3 };

/** Lysrörsarmaturer: mittpunkt, riktning och underkant på det de sitter i. */
export const lamps: { x: number; z: number; along: 'x' | 'z'; top: number }[] = [
  { x: 1.7, z: 6.1, along: 'x', top: joistBottom },
  { x: 4.2, z: 6.1, along: 'x', top: joistBottom },
  { x: 6.3, z: 6.1, along: 'x', top: joistBottom },
  { x: 8.45, z: 3.4, along: 'z', top: joistBottom },
  { x: 9.72, z: 6.3, along: 'z', top: beamBottom + 0.1 },
];

/** Förrådshörnan bakom sista stolpen har mörkt, omålat tak och två nyare reglar. */
export const storageNook = { fromX: 8.53, fromZ: beam.z + beam.width / 2, timberXs: [8.33, 9.83] };

/* ------------------------------------------------------------------ möbler */

/**
 * Möblernas lägen. `x`/`z` är mittpunkt på golvet och `turn` är vridning i grader
 * (0 = framsidan mot +z, 90 = mot +x, 180 = mot -z, -90 = mot -x).
 */
export const furniture = {
  /**
   * Matbord med sex stolar vid köksgaveln, nära hörnet mot soffväggen. Bordet står på
   * tvären, med långsidan ut från soffväggen.
   */
  dining: { x: 2.0, z: 2.2, turn: 90, tableLength: 1.8, tableWidth: 0.9 },

  /**
   * Soffgruppen i U-form: soffan med ryggen mot nya rummet, en fåtölj med ryggen mot
   * soffväggen mellan fönstren och en mittemot soffan, med soffbordet i mitten.
   */
  sofa: { x: 6.7, z: 1.6, turn: -90, width: 2.05 },
  coffeeTable: { x: 5.55, z: 1.65, turn: 90 },
  armchairs: [
    { x: 5.3, z: 0.6, turn: 0 },
    { x: 4.4, z: 2.05, turn: 75 },
  ],

  /** Köket: öppen bänk i vinkel i hörnet köksgavel / långvägg, sedan kyl och blått vitrinskåp. */
  kitchen: {
    counterDepth: 0.6,
    counterHeight: 0.9,
    /** Bänken längs långväggen går från hörnet ut till det här x-värdet. */
    longRunToX: 3.0,
    /** Bänken längs köksgaveln går från hörnet ner till det här z-värdet. */
    gableRunToZ: 4.85,
    ovenX: [1.4, 2.0],
    microwaveX: [2.25, 2.72],
    /** Diskhon sitter under fönstret K2. */
    sinkZ: [5.1, 5.85],
    fridgeX: [3.1, 3.65],
    hutchX: [3.85, 5.15],
  },

  /**
   * Braskamin i gjutjärn vid stolpraden, mellan andra och tredje stolpen, vänd mot
   * soff- och matdelen. Rökröret går rakt upp genom taket, strax intill bärlinan
   * (`flue: 'wall'` drar det i stället bakåt genom en vägg).
   */
  stove: { x: 4.0, z: 4.15, turn: 200, flue: 'ceiling' as 'ceiling' | 'wall' },

  /**
   * Husqvarna-vedspisen i hörnet köksgavel / soffvägg, upplyft till arbetshöjd och inmurad
   * i vitputsat murverk med murstock i hörnet. Ryggen står mot soffväggen.
   */
  cookstove: {
    /** Murstockens bredd längs soffväggen och djup ut från den. */
    chimneyWidth: 0.38,
    chimneyDepth: 0.5,
    /** Själva järnspisens bredd, djup och höjd till hällen. */
    width: 0.76,
    depth: 0.56,
    topHeight: 0.86,
    /** Murad sockel under spisen och murade kinder på sidorna. */
    plinthHeight: 0.26,
    cheek: 0.12,
  },
};

/* --------------------------------------------------------------- belysning */

/**
 * Mysbelysningen. Varje lampa har ett läge på golvet (`x`, `z`); höjder är över golvet.
 * `watts` är ungefär motsvarande glödlampa och styr hur starkt lampan lyser.
 */
export const lighting = {
  /** Taklampor i sladd: linneskärm över matbordet, emaljskärmar över köksbänken. */
  pendants: [
    { x: furniture.dining.x, z: furniture.dining.z, bottom: 1.5, shade: 'linen' as const, watts: 60 },
    { x: 0.42, z: 6.45, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
    { x: 1.0, z: 7.58, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
    { x: 2.2, z: 7.58, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
  ],
  /** Golvlampa bredvid fåtöljen vid soffväggen. */
  floorLamps: [{ x: 4.55, z: 0.45, watts: 40 }],
  /** Små lampor i fönsternischerna – en per fönster i soff- och matdelen. */
  windowLamps: ['S1', 'S2', 'A3', 'B1'],
  /** Bordslampa på vitrinskåpets bänkskiva. */
  tableLamps: [{ x: 4.5, y: 0.935, z: room.width - 0.3, watts: 25 }],
  /** Vägglampor: vid vita dörren, vid plywooddörren och i förrådshörnan. */
  sconces: [
    { wall: 'kitchenGable' as const, at: 4.35, y: 1.6, watts: 25 },
    { wall: 'farGable' as const, at: 4.45, y: 1.6, watts: 25 },
    { wall: 'kitchenWall' as const, at: 8.9, y: 1.6, watts: 25 },
  ],
  /** Levande ljus: tre på matbordet och två på soffbordet. */
  candles: [
    { x: furniture.dining.x - 0.25, y: 0.76, z: furniture.dining.z, height: 0.22 },
    { x: furniture.dining.x, y: 0.76, z: furniture.dining.z + 0.06, height: 0.27 },
    { x: furniture.dining.x + 0.25, y: 0.76, z: furniture.dining.z - 0.03, height: 0.19 },
    { x: furniture.coffeeTable.x - 0.15, y: 0.46, z: furniture.coffeeTable.z, height: 0.12 },
    { x: furniture.coffeeTable.x + 0.12, y: 0.46, z: furniture.coffeeTable.z + 0.08, height: 0.08 },
  ],
  /** Ljusslinga med klotlampor längs bärlinan, på sidan mot soff- och matdelen. */
  stringLights: { fromX: 0.4, toX: newRoom.frontX - 0.3, spacing: 0.45 },
};
