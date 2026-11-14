/**
 * Alla mått för stallet, i meter. Modellen byggs helt utifrån de här värdena.
 *
 * Koordinater: origo är hörnet mellan köksgaveln och soffväggen.
 *   x går längs soffväggen, från köksgaveln mot gaveln med plywooddörren.
 *   z går tvärs över rummet, från soffväggen mot långväggen med plankdörren.
 *   y är höjd över golvet.
 *
 * Rummets mått kommer från en lidarskanning (2026-11-14). I skanningen är rummet inte
 * helt rätvinkligt: soffväggen är 9,76 m, långväggen 9,44 m, köksgaveln 7,93 m och bortre
 * gaveln 8,12 m. Modellen är en rektangel med medelvärdena, och allt annat är inpassat i
 * den, så enskilda lägen kan skilja någon decimeter mot verkligheten längst ut i hörnen.
 * Höjder är mätta från golvet, som lutar och buktar ungefär ±5 cm.
 */

export const room = {
  length: 9.6,
  width: 8.03,
  /** Murens tjocklek syns inte i skanningen (den är gjord inifrån) och är antagen. */
  wallThickness: 0.4,
  /** Murkrönets höjd – väggarna går lite förbi takbrädorna. */
  wallTop: 2.4,
};

/**
 * Bjälklaget. Takbjälkarna går tvärs över rummet och är skarvade över bärlinan, så de
 * ligger på olika ställen och är olika höga på var sida om den. `xs` är mittlägen.
 */
export const ceiling = {
  /** Underkant takbrädor. */
  boards: 2.24,
  boardThickness: 0.03,
  /** Från soffväggen till bärlinan. Bjälken vid 6,98 ligger över nya rummets vägg. */
  sofaJoists: { xs: [0.5, 1.28, 2.06, 2.84, 3.66, 5.3, 6.1, 6.98, 8.1], height: 0.16, width: 0.15 },
  /** Från bärlinan till långväggen. */
  kitchenJoists: {
    xs: [0.66, 1.42, 2.22, 3.0, 3.72, 4.6, 5.46, 6.28, 7.0, 7.58, 8.36, 9.2],
    height: 0.22,
    width: 0.17,
  },
  /** Omålad rundstock närmast gaveln, över plywooddörren. */
  logX: 9.05,
  logRadius: 0.09,
};

/** Underkant takbjälkar på soffsidan respektive kökssidan. */
export const sofaJoistBottom = ceiling.boards - ceiling.sofaJoists.height;
export const kitchenJoistBottom = ceiling.boards - ceiling.kitchenJoists.height;

/** Bärlinan: längsgående balk som bär upp takbjälkarna, på svarta stolpar. */
export const beam = {
  z: 4.68,
  width: 0.2,
  /** Underkant bärlina – det är här man slår i huvudet. */
  bottom: 1.77,
  postSize: 0.17,
  postXs: [2.25, 3.43, 4.75, 7.65],
};

export const beamBottom = beam.bottom;

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

/** Hur långt in i muren fönsterkarmarna sitter, mätt från väggens insida. */
export const windowInset = 0.1;

/** Soffväggen, z = 0. */
export const sofaWall: WallOpening[] = [
  { id: 'S1', from: 1.74, to: 2.74, sill: 1.27, top: 1.87, kind: 'window', panes: 2 },
  { id: 'S2', from: 5.18, to: 6.18, sill: 1.2, top: 1.82, kind: 'window', panes: 2 },
];

/** Köksgaveln, x = 0. Lägen i z. */
export const kitchenGable: WallOpening[] = [
  { id: 'A3', from: 1.4, to: 2.37, sill: 1.23, top: 1.83, kind: 'window', panes: 2 },
  { id: 'vit dörr', from: 3.02, to: 4.01, sill: 0, top: 1.88, kind: 'whiteDoor' },
  { id: 'K2', from: 5.1, to: 5.9, sill: 1.05, top: 1.87, kind: 'window', panes: 1 },
  { id: 'K1', from: 7.13, to: 7.9, sill: 1.05, top: 1.85, kind: 'window', panes: 1 },
];

/** Gaveln med plywooddörren, x = rummets längd. Lägen i z. */
export const farGable: WallOpening[] = [
  { id: 'plywooddörr', from: 2.68, to: 3.98, sill: 0, top: 2.05, kind: 'plywoodDoor' },
  { id: 'B1', from: 5.64, to: 6.55, sill: 1.25, top: 1.75, kind: 'window', panes: 2, lintel: true },
];

/** Långväggen mitt emot soffan, z = rummets bredd. Lägen i x. */
export const kitchenWall: WallOpening[] = [
  { id: 'plankdörr', from: 6.6, to: 7.45, sill: 0.24, top: 2.0, kind: 'plankDoor' },
];

/** Det nya isolerade rummet i hörnet soffvägg / bortre gavel. Insidan är inte skannad. */
export const newRoom = {
  /** Väggen mot soffhörnan ligger vid det här x-värdet (utsidan). */
  frontX: 6.93,
  /** Rummets bredd ut från soffväggen (yttersida sidovägg). */
  depthZ: 2.45,
  wallThickness: 0.095,
  studSpacing: 0.6,
  /** Dörröppningen i sidoväggen, mätt från väggens hörn. */
  doorFrom: 0.92,
  doorWidth: 0.87,
  doorHeight: 2.04,
  /**
   * 'plaster' = färdigt: vitputsade väggar med golvlist och dörrfoder, avloppsrören inbyggda.
   * 'studs' = som i fotona: reglar, gul isolering och synliga avloppsrör.
   */
  finish: 'plaster' as 'plaster' | 'studs',
};

/** Träramp upp till plankdörren. */
export const ramp = { width: 1.05, length: 1.5, rise: 0.24 };

/** Lysrörsraden i köksdelen sitter längs det här z-värdet, från x = 0,7 till 7,0. */
export const lampRow = { z: 6.35, fromX: 0.7, toX: 7.0 };

/** Lysrörsarmaturer: mittpunkt, riktning och underkant på det de sitter i. */
export const lamps: { x: number; z: number; along: 'x' | 'z'; top: number }[] = [
  { x: 1.6, z: lampRow.z, along: 'x', top: kitchenJoistBottom },
  { x: 3.6, z: lampRow.z, along: 'x', top: kitchenJoistBottom },
  { x: 5.8, z: lampRow.z, along: 'x', top: kitchenJoistBottom },
  { x: 8.1, z: 3.4, along: 'z', top: sofaJoistBottom },
  { x: room.length - 0.3, z: 6.3, along: 'z', top: beamBottom + 0.12 },
];

/** Förrådshörnan bakom sista stolpen har mörkt, omålat tak och två nyare reglar. */
export const storageNook = {
  fromX: 7.9,
  fromZ: beam.z + beam.width / 2,
  timberXs: [7.72, room.length - 0.18],
};

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
  dining: { x: 2.15, z: 1.8, turn: 90, tableLength: 1.9, tableWidth: 0.85 },

  /** Soffa mot soffväggen, soffbord och två fåtöljer vända mot soffan. */
  sofa: { x: 4.35, z: 0.55, turn: 0, width: 2.05 },
  coffeeTable: { x: 4.35, z: 1.75, turn: 0 },
  armchairs: [
    { x: 3.6, z: 3.0, turn: 168 },
    { x: 5.1, z: 3.05, turn: 192 },
  ],

  /** Köket: öppen bänk i vinkel i hörnet köksgavel / långvägg, sedan kyl och blått vitrinskåp. */
  kitchen: {
    counterDepth: 0.6,
    counterHeight: 0.9,
    /** Bänken längs långväggen går från hörnet ut till det här x-värdet. */
    longRunToX: 3.2,
    /** Bänken längs köksgaveln går från hörnet ner till det här z-värdet. */
    gableRunToZ: 4.78,
    ovenX: [1.5, 2.1],
    microwaveX: [2.4, 2.87],
    /** Diskhon sitter under fönstret K2. */
    sinkZ: [5.12, 5.87],
    fridgeX: [3.35, 3.9],
    hutchX: [4.15, 5.4],
  },

  /**
   * Braskamin i gjutjärn mot nya rummets vägg mot soffhörnan, 1,8 m ut från soffväggen
   * (vid tredje regeln i väggen) och vänd ut mot rummet. Ryggen står 0,3 m från väggen;
   * 0,22 är halva kaminens djup. Rökröret går rakt upp genom taket (`flue: 'wall'` drar
   * det i stället bakåt genom en vägg).
   */
  stove: {
    x: newRoom.frontX - 0.3 - 0.22,
    z: 3 * newRoom.studSpacing + 0.0225,
    turn: -90,
    flue: 'ceiling' as 'ceiling' | 'wall',
  },

  /**
   * Husqvarna-vedspisen i hörnet köksgavel / soffvägg, upplyft till arbetshöjd och inmurad
   * i vitputsat murverk. Spisen står 45 grader snett över hörnet, vänd ut mot rummet, med
   * murstocken innerst i hörnet och murade avställningsytor ut mot väggarna på var sida.
   */
  cookstove: {
    /** Själva järnspisens bredd, djup och höjd till hällen. */
    width: 0.76,
    depth: 0.56,
    topHeight: 0.86,
    /** Murad sockel under spisen och murade kinder på sidorna. */
    plinthHeight: 0.26,
    cheek: 0.12,
    /** Murad kant bakom spisen och hur långt murverket går förbi spisens framsida. */
    rim: 0.08,
    lip: 0.03,
    /** Murstockens sida (kvadratisk, innerst i hörnet). */
    chimney: 0.4,
  },
};

/** Hur långt vedspisens murverk når ut längs vardera väggen från hörnet. */
export const cookstoveReach =
  (furniture.cookstove.width +
    2 * furniture.cookstove.cheek +
    furniture.cookstove.rim +
    furniture.cookstove.depth +
    furniture.cookstove.lip) /
  Math.SQRT2;

/* --------------------------------------------------------------- belysning */

/**
 * Mysbelysningen. Varje lampa har ett läge på golvet (`x`, `z`); höjder är över golvet.
 * `watts` är ungefär motsvarande glödlampa och styr hur starkt lampan lyser.
 */
export const lighting = {
  /** Taklampor i sladd: linneskärm över matbordet, emaljskärmar över köksbänken. */
  pendants: [
    { x: furniture.dining.x, z: furniture.dining.z, bottom: 1.5, shade: 'linen' as const, watts: 60 },
    { x: 0.42, z: 6.5, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
    { x: 1.0, z: room.width - 0.42, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
    { x: 2.3, z: room.width - 0.42, bottom: 1.72, shade: 'enamel' as const, watts: 40 },
  ],
  /** Golvlampa vid soffans ena gavel. */
  floorLamps: [{ x: 3.05, z: 0.45, watts: 40 }],
  /** Små lampor i fönsternischerna – en per fönster i soff- och matdelen. */
  windowLamps: ['S1', 'S2', 'A3', 'B1'],
  /** Bordslampa på vitrinskåpets bänkskiva. */
  tableLamps: [{ x: 4.78, y: 0.935, z: room.width - 0.3, watts: 25 }],
  /** Vägglampor: vid vita dörren, vid plywooddörren och i förrådshörnan. */
  sconces: [
    { wall: 'kitchenGable' as const, at: 4.35, y: 1.6, watts: 25 },
    { wall: 'farGable' as const, at: 4.3, y: 1.6, watts: 25 },
    { wall: 'kitchenWall' as const, at: 8.5, y: 1.6, watts: 25 },
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
