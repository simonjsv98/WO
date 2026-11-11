import { formatSeconds } from '../lib/format';
import type {
  BlockTemplate,
  BlockType,
  Days,
  PlanItem,
  Program,
  ResolvedBlock,
  ResolvedItem,
  ResolvedSession,
  Role,
  SessionTemplate,
  TimerSpec,
  Version,
  WeekInfo,
} from '../lib/types';
import { EXERCISES, getExercise } from './exercises';

export const BLOCK_LABEL: Record<BlockType, string> = {
  warmup: 'Uppvärmning',
  power: 'Kraftutveckling',
  strength: 'Styrka',
  conditioning: 'Finisher',
  cooldown: 'Nedvarvning',
};

export const VERSION_LABEL: Record<Version, string> = { gym: 'Gym', home: 'Hemma' };
export const VERSION_EQUIPMENT: Record<Version, string> = {
  gym: 'Ställning, skivstång, hantlar, kettlebells, kabelmaskin och gummiband',
  home: 'Hantlar eller kettlebells och gummiband',
};

/* ------------------------------------------------------------------ */
/* Fasernas byggstenar                                                  */
/* ------------------------------------------------------------------ */

type Four<T> = [T, T, T, T];
/** Samma plats i passet, en övning för gym och en för hemma. */
type Slot = [gym: string, home: string];

type SlotKey =
  | 'jumpA'
  | 'jumpB'
  | 'throwA'
  | 'throwB'
  | 'squatMain'
  | 'squatAcc'
  | 'hingeMain'
  | 'hingeAcc'
  | 'lungeA'
  | 'lungeB'
  | 'hpushMain'
  | 'hpushAcc'
  | 'vpushMain'
  | 'vpushAcc'
  | 'hpullMain'
  | 'hpullAcc'
  | 'vpullMain'
  | 'vpullAcc'
  | 'coreA'
  | 'coreB'
  | 'carry'
  | 'extra';

const SLOT_ROLE: Record<SlotKey, Role> = {
  jumpA: 'power',
  jumpB: 'power',
  throwA: 'power',
  throwB: 'power',
  squatMain: 'main',
  hingeMain: 'main',
  hpushMain: 'main',
  vpushMain: 'main',
  hpullMain: 'main',
  vpullMain: 'main',
  squatAcc: 'acc',
  hingeAcc: 'acc',
  lungeA: 'acc',
  lungeB: 'acc',
  hpushAcc: 'acc',
  vpushAcc: 'acc',
  hpullAcc: 'acc',
  vpullAcc: 'acc',
  coreA: 'core',
  coreB: 'core',
  carry: 'core',
  extra: 'extra',
};

type FinisherKey = 'core' | 'emom' | 'amrap' | 'cardio';
/** Övning i en finisher: [gym, hemma, mål]. Tomt mål betyder att timern styr. */
type FinisherItem = [gym: string, home: string, target: string];

interface PhaseDef {
  name: string;
  tagline: string;
  description: string;
  schemes: Record<Role, Four<string>>;
  coreTime: Four<string>;
  rest: Record<Role, number>;
  slots: Record<SlotKey, Slot>;
  finishers: Record<FinisherKey, FinisherItem[]>;
}

const WEEKS: Four<WeekInfo> = [
  { title: 'Start', focus: 'Lär dig fasens rörelser och hitta dina startvikter. Lämna tre repetitioner i tanken.' },
  { title: 'Bygg', focus: 'Mer volym. Lägg på lite vikt där förra veckan kändes lätt.' },
  { title: 'Topp', focus: 'Fasens tyngsta vecka. Färre repetitioner, högre belastning.' },
  { title: 'Lätt', focus: 'Mindre volym, samma kvalitet. Du ska gå härifrån piggare än du kom.' },
];

const FINISHER_TITLE: Record<FinisherKey, string> = {
  core: 'Bålcirkel',
  emom: 'Varje minut',
  amrap: 'Max antal varv',
  cardio: 'Intervaller',
};

const FINISHER_INTRO: Record<FinisherKey, string> = {
  core: 'Rotera mellan övningarna utan att stressa. Kvalitet i varje sekund.',
  emom: 'Ny övning varje hel minut. Vila den tid som blir över.',
  amrap: 'Så många varv som möjligt på tiden. Räkna varven.',
  cardio: 'Arbeta på en nivå du precis klarar att hålla hela vägen.',
};

const intervals = (workSec: number, restSec: number, rounds: number): TimerSpec => ({
  kind: 'intervals',
  workSec,
  restSec,
  rounds,
});

const FINISHER_TIMER: Record<FinisherKey, Four<TimerSpec>> = {
  core: [intervals(30, 15, 6), intervals(35, 15, 6), intervals(40, 20, 9), intervals(30, 30, 6)],
  emom: [8, 10, 12, 8].map((minutes) => ({ kind: 'emom', minutes })) as Four<TimerSpec>,
  amrap: [6, 8, 10, 5].map((minutes) => ({ kind: 'amrap', minutes })) as Four<TimerSpec>,
  cardio: [intervals(60, 60, 6), intervals(60, 60, 8), intervals(60, 45, 10), intervals(60, 90, 5)],
};

const PHASES: PhaseDef[] = [
  {
    name: 'Grund',
    tagline: 'Rörelsekvalitet och arbetskapacitet',
    description:
      'Fasen bygger basen: kontrollerade lyft med lite fler repetitioner, enkla hopp och kast och gott om bålarbete. Fokus ligger på teknik och på att vänja kroppen vid upplägget.',
    schemes: {
      main: ['3x8', '4x8', '4x6', '2x8'],
      acc: ['2x10', '3x10', '3x12', '2x10'],
      power: ['3x4', '3x5', '4x4', '2x4'],
      core: ['2x8', '3x8', '3x10', '2x8'],
      extra: ['2x15', '3x15', '3x15', '2x15'],
    },
    coreTime: ['2x30s', '3x30s', '3x40s', '2x30s'],
    rest: { main: 120, acc: 75, power: 60, core: 45, extra: 45 },
    slots: {
      jumpA: ['box-jump', 'jump-squat'],
      jumpB: ['skater-jump', 'skater-jump'],
      throwA: ['med-ball-chest-pass', 'plyo-pushup'],
      throwB: ['med-ball-slam', 'kb-swing'],
      squatMain: ['back-squat', 'goblet-squat'],
      squatAcc: ['goblet-squat', 'heel-elevated-goblet-squat'],
      hingeMain: ['rdl', 'rdl'],
      hingeAcc: ['hip-thrust', 'glute-bridge'],
      lungeA: ['split-squat', 'reverse-lunge'],
      lungeB: ['lateral-lunge', 'lateral-lunge'],
      hpushMain: ['db-bench-press', 'floor-press'],
      hpushAcc: ['pushup', 'pushup'],
      vpushMain: ['half-kneeling-press', 'half-kneeling-press'],
      vpushAcc: ['db-shoulder-press', 'db-shoulder-press'],
      hpullMain: ['db-row', 'db-row'],
      hpullAcc: ['inverted-row', 'band-row'],
      vpullMain: ['lat-pulldown', 'band-pulldown'],
      vpullAcc: ['pullup', 'band-pulldown'],
      coreA: ['dead-bug', 'dead-bug'],
      coreB: ['side-plank', 'side-plank'],
      carry: ['farmer-carry', 'suitcase-carry'],
      extra: ['face-pull', 'band-pull-apart'],
    },
    finishers: {
      core: [
        ['dead-bug', 'dead-bug', ''],
        ['side-plank', 'side-plank', ''],
        ['farmer-carry', 'plank', ''],
      ],
      emom: [
        ['hanging-knee-raise', 'mountain-climber', '10'],
        ['pushup', 'pushup', '8'],
      ],
      amrap: [
        ['burpee', 'burpee', '6'],
        ['kb-swing', 'kb-swing', '12'],
        ['mountain-climber', 'mountain-climber', '20'],
      ],
      cardio: [['cardio-machine', 'jump-rope', '']],
    },
  },
  {
    name: 'Styrka',
    tagline: 'Tyngre lyft, färre repetitioner',
    description:
      'Nu byts huvudlyften mot tyngre varianter och repetitionerna sjunker. Vilan blir längre, hoppen går på längden och finishern kräver mer av hela kroppen.',
    schemes: {
      main: ['4x6', '5x5', '5x4', '3x4'],
      acc: ['3x8', '3x8', '4x6', '2x8'],
      power: ['3x3', '4x3', '5x3', '3x3'],
      core: ['3x8', '3x10', '3x12', '2x8'],
      extra: ['2x12', '3x12', '3x15', '2x12'],
    },
    coreTime: ['3x30s', '3x40s', '3x45s', '2x30s'],
    rest: { main: 150, acc: 90, power: 75, core: 45, extra: 45 },
    slots: {
      jumpA: ['broad-jump', 'broad-jump'],
      jumpB: ['box-jump', 'pogo'],
      throwA: ['med-ball-slam', 'push-press'],
      throwB: ['plyo-pushup', 'plyo-pushup'],
      squatMain: ['front-squat', 'heel-elevated-goblet-squat'],
      squatAcc: ['step-up', 'step-up'],
      hingeMain: ['deadlift', 'kb-deadlift'],
      hingeAcc: ['single-leg-rdl', 'single-leg-rdl'],
      lungeA: ['reverse-lunge', 'walking-lunge'],
      lungeB: ['split-squat', 'split-squat'],
      hpushMain: ['bench-press', 'pushup'],
      hpushAcc: ['db-bench-press', 'floor-press'],
      vpushMain: ['overhead-press', 'db-shoulder-press'],
      vpushAcc: ['half-kneeling-press', 'half-kneeling-press'],
      hpullMain: ['barbell-row', 'db-row'],
      hpullAcc: ['db-row', 'band-row'],
      vpullMain: ['pullup', 'band-pulldown'],
      vpullAcc: ['lat-pulldown', 'band-pulldown'],
      coreA: ['pallof-press', 'pallof-press'],
      coreB: ['hollow-hold', 'hollow-hold'],
      carry: ['suitcase-carry', 'suitcase-carry'],
      extra: ['face-pull', 'band-pull-apart'],
    },
    finishers: {
      core: [
        ['hollow-hold', 'hollow-hold', ''],
        ['bird-dog', 'bird-dog', ''],
        ['suitcase-carry', 'suitcase-carry', ''],
      ],
      emom: [
        ['kb-swing', 'kb-swing', '12'],
        ['burpee', 'burpee', '6'],
      ],
      amrap: [
        ['thruster', 'thruster', '8'],
        ['inverted-row', 'band-row', '10'],
        ['jump-squat', 'jump-squat', '8'],
      ],
      cardio: [['cardio-machine', 'shuttle-run', '']],
    },
  },
  {
    name: 'Kraft',
    tagline: 'Snabbhet och explosivitet',
    description:
      'Fasen växlar upp tempot. Fler set med hopp och kast, tunga huvudlyft med få repetitioner och finishers som går fort. Varje repetition ska göras med avsikt.',
    schemes: {
      main: ['4x5', '5x4', '5x3', '3x3'],
      acc: ['3x8', '3x10', '3x8', '2x8'],
      power: ['4x3', '5x3', '5x4', '3x3'],
      core: ['3x8', '3x10', '3x12', '2x8'],
      extra: ['2x15', '3x15', '3x20', '2x15'],
    },
    coreTime: ['3x30s', '3x40s', '3x45s', '2x30s'],
    rest: { main: 150, acc: 75, power: 75, core: 45, extra: 45 },
    slots: {
      jumpA: ['box-jump', 'jump-squat'],
      jumpB: ['broad-jump', 'skater-jump'],
      throwA: ['med-ball-chest-pass', 'plyo-pushup'],
      throwB: ['push-press', 'push-press'],
      squatMain: ['back-squat', 'goblet-squat'],
      squatAcc: ['front-squat', 'thruster'],
      hingeMain: ['deadlift', 'rdl'],
      hingeAcc: ['kb-swing', 'kb-swing'],
      lungeA: ['walking-lunge', 'walking-lunge'],
      lungeB: ['step-up', 'step-up'],
      hpushMain: ['bench-press', 'floor-press'],
      hpushAcc: ['pushup', 'pushup'],
      vpushMain: ['overhead-press', 'db-shoulder-press'],
      vpushAcc: ['half-kneeling-press', 'half-kneeling-press'],
      hpullMain: ['barbell-row', 'db-row'],
      hpullAcc: ['inverted-row', 'band-row'],
      vpullMain: ['pullup', 'band-pulldown'],
      vpullAcc: ['lat-pulldown', 'band-pulldown'],
      coreA: ['hanging-knee-raise', 'hollow-hold'],
      coreB: ['bear-crawl', 'bear-crawl'],
      carry: ['farmer-carry', 'suitcase-carry'],
      extra: ['face-pull', 'band-pull-apart'],
    },
    finishers: {
      core: [
        ['plank', 'plank', ''],
        ['bear-crawl', 'bear-crawl', ''],
        ['side-plank', 'side-plank', ''],
      ],
      emom: [
        ['burpee', 'burpee', '8'],
        ['jump-squat', 'jump-squat', '10'],
      ],
      amrap: [
        ['kb-swing', 'kb-swing', '15'],
        ['pushup', 'pushup', '10'],
        ['mountain-climber', 'mountain-climber', '20'],
      ],
      cardio: [['cardio-machine', 'burpee', '']],
    },
  },
];

export const PHASE_TEMPLATE_COUNT = PHASES.length;

/* ------------------------------------------------------------------ */
/* Veckans upplägg för två, tre och fyra pass                           */
/* ------------------------------------------------------------------ */

type Focus = 'lower' | 'upper' | 'total';

interface DayDef {
  name: string;
  focus: string;
  estMin: number;
  body: Focus;
  power: SlotKey[];
  /** En ensam nyckel är en vanlig övning, ett par är ett superset. */
  strength: (SlotKey | [SlotKey, SlotKey])[];
  finisher: FinisherKey;
}

const SPLITS: Record<Days, DayDef[]> = {
  4: [
    {
      name: 'Underkropp 1',
      focus: 'Knäböj som huvudlyft, höft och enbensstyrka',
      estMin: 60,
      body: 'lower',
      power: ['jumpA'],
      strength: ['squatMain', ['hingeAcc', 'coreA'], ['lungeA', 'carry']],
      finisher: 'core',
    },
    {
      name: 'Överkropp 1',
      focus: 'Horisontell press och vertikalt drag',
      estMin: 55,
      body: 'upper',
      power: ['throwA'],
      strength: [['hpushMain', 'vpullMain'], ['vpushAcc', 'hpullAcc'], 'extra'],
      finisher: 'emom',
    },
    {
      name: 'Underkropp 2',
      focus: 'Höftfällning som huvudlyft och rörelser i sidled',
      estMin: 60,
      body: 'lower',
      power: ['jumpB'],
      strength: ['hingeMain', ['lungeB', 'coreB'], 'squatAcc'],
      finisher: 'amrap',
    },
    {
      name: 'Överkropp 2',
      focus: 'Press över huvudet, rodd och kondition',
      estMin: 55,
      body: 'upper',
      power: ['throwB'],
      strength: [['vpushMain', 'hpullMain'], ['hpushAcc', 'vpullAcc'], 'coreA'],
      finisher: 'cardio',
    },
  ],
  3: [
    {
      name: 'Helkropp 1',
      focus: 'Knäböj, press och rodd',
      estMin: 60,
      body: 'total',
      power: ['jumpA'],
      strength: ['squatMain', ['hpushMain', 'hpullAcc'], ['lungeA', 'coreA']],
      finisher: 'core',
    },
    {
      name: 'Helkropp 2',
      focus: 'Höftfällning, press över huvudet och drag',
      estMin: 60,
      body: 'total',
      power: ['throwA'],
      strength: ['hingeMain', ['vpushMain', 'vpullMain'], ['lungeB', 'carry']],
      finisher: 'emom',
    },
    {
      name: 'Helkropp 3',
      focus: 'Atletisk helkropp med hög puls i slutet',
      estMin: 55,
      body: 'total',
      power: ['jumpB'],
      strength: [['squatAcc', 'hpullMain'], ['hingeAcc', 'hpushAcc'], 'coreB'],
      finisher: 'amrap',
    },
  ],
  2: [
    {
      name: 'Helkropp 1',
      focus: 'Knäböj, press och rodd',
      estMin: 60,
      body: 'total',
      power: ['jumpA'],
      strength: ['squatMain', ['hpushMain', 'hpullMain'], ['hingeAcc', 'coreA']],
      finisher: 'core',
    },
    {
      name: 'Helkropp 2',
      focus: 'Höftfällning, press över huvudet och drag',
      estMin: 60,
      body: 'total',
      power: ['throwA'],
      strength: ['hingeMain', ['vpushMain', 'vpullMain'], ['lungeA', 'carry']],
      finisher: 'amrap',
    },
  ],
};

const fixed = (exerciseId: string, scheme: string): PlanItem => ({ exerciseId, scheme });

const WARMUP: Record<Focus, PlanItem[]> = {
  lower: [
    fixed('pulse', '180s'),
    fixed('cat-cow', '8'),
    fixed('lunge-rotation', '5/sida'),
    fixed('ankle-rock', '10/sida'),
    fixed('glute-bridge', '2x10'),
    fixed('pogo', '2x15'),
  ],
  upper: [
    fixed('pulse', '180s'),
    fixed('cat-cow', '8'),
    fixed('t-spine-rotation', '8/sida'),
    fixed('band-pull-apart', '2x15'),
    fixed('scap-pushup', '2x10'),
    fixed('inchworm', '6'),
  ],
  total: [
    fixed('pulse', '180s'),
    fixed('hip-90-90', '8/sida'),
    fixed('leg-swings', '10/sida'),
    fixed('deep-squat-hold', '45s'),
    fixed('scap-pushup', '2x10'),
    fixed('inchworm', '6'),
  ],
};

const COOLDOWN: Record<Focus, PlanItem[]> = {
  lower: [fixed('couch-stretch', '60s/sida'), fixed('pigeon', '60s/sida'), fixed('belly-breathing', '120s')],
  upper: [
    fixed('pec-stretch', '45s/sida'),
    fixed('lat-stretch', '60s'),
    fixed('thread-needle', '45s/sida'),
    fixed('box-breathing', '120s'),
  ],
  total: [
    fixed('hamstring-stretch', '45s/sida'),
    fixed('childs-pose', '60s'),
    fixed('couch-stretch', '60s/sida'),
    fixed('belly-breathing', '120s'),
  ],
};

function buildSession(def: PhaseDef, day: DayDef, index: number, version: Version): SessionTemplate {
  const pickSlot = (key: SlotKey) => def.slots[key][version === 'gym' ? 0 : 1];
  const slotItem = (key: SlotKey, group: string, restSec?: number): PlanItem => ({
    exerciseId: pickSlot(key),
    role: SLOT_ROLE[key],
    group,
    restSec,
  });

  const strength: PlanItem[] = day.strength.flatMap((entry, i) => {
    const letter = 'ABCDE'[i];
    if (!Array.isArray(entry)) return [slotItem(entry, letter)];
    // I ett superset vilar man först efter den andra övningen.
    return [slotItem(entry[0], `${letter}1`, 0), slotItem(entry[1], `${letter}2`)];
  });

  const finisherItems: PlanItem[] = def.finishers[day.finisher].map(([gym, home, target]) =>
    fixed(version === 'gym' ? gym : home, target),
  );

  const blocks: BlockTemplate[] = [
    { type: 'warmup', format: 'list', items: WARMUP[day.body] },
    {
      type: 'power',
      format: 'sets',
      intro: 'Få repetitioner med maximal fart. Vila tills du är helt redo för nästa set.',
      items: day.power.map((key) => slotItem(key, '')),
    },
    {
      type: 'strength',
      format: 'sets',
      intro: 'Välj en vikt där du har ett par repetitioner kvar när setet är slut.',
      items: strength,
    },
    {
      type: 'conditioning',
      title: FINISHER_TITLE[day.finisher],
      format: 'timer',
      timer: FINISHER_TIMER[day.finisher],
      intro: FINISHER_INTRO[day.finisher],
      items: finisherItems,
    },
    { type: 'cooldown', format: 'list', items: COOLDOWN[day.body] },
  ];

  return { id: `d${index + 1}`, name: day.name, focus: day.focus, estMin: day.estMin, blocks };
}

const cache = new Map<string, Program>();

export const programId = (phase: number, version: Version, days: Days): string => `f${phase}-${version}-${days}`;

/** Bygger programmet för en fas. Efter den sista mallen börjar mallarna om, med nytt fasnummer. */
export function buildProgram(phase: number, version: Version, days: Days): Program {
  const id = programId(phase, version, days);
  const hit = cache.get(id);
  if (hit) return hit;

  const def = PHASES[phase % PHASES.length];
  const program: Program = {
    id,
    phase,
    version,
    days,
    name: def.name,
    tagline: def.tagline,
    description: def.description,
    equipment: VERSION_EQUIPMENT[version],
    weeks: WEEKS,
    schemes: def.schemes,
    coreTime: def.coreTime,
    rest: def.rest,
    sessions: SPLITS[days].map((day, i) => buildSession(def, day, i, version)),
  };
  cache.set(id, program);
  return program;
}

/** Hittar programmet bakom ett sparat id. Okända id:n (t.ex. från en äldre version) ger null. */
export function programFromId(id: string): Program | null {
  const m = /^f(\d+)-(gym|home)-([234])$/.exec(id);
  return m ? buildProgram(Number(m[1]), m[2] as Version, Number(m[3]) as Days) : null;
}

export const phaseTitle = (phase: number): string => `Fas ${phase + 1} · ${PHASES[phase % PHASES.length].name}`;

export const phaseInfo = (phase: number): { name: string; tagline: string; description: string } =>
  PHASES[phase % PHASES.length];

/* ------------------------------------------------------------------ */
/* Upplösning av mall + vecka till ett konkret pass                     */
/* ------------------------------------------------------------------ */

export interface ParsedScheme {
  sets: number;
  target: string;
  targetReps: number | null;
  targetSec: number | null;
  perSide: boolean;
}

/** Tolkar "3x8", "2x10/sida", "60s", "45s/sida", "8" och "". */
export function parseScheme(raw: string): ParsedScheme {
  const m = /^(\d+)x(.+)$/.exec(raw.trim());
  const sets = m ? Number(m[1]) : 1;
  const rest = (m ? m[2] : raw).trim();
  const perSide = rest.endsWith('/sida');
  const side = perSide ? '/sida' : '';
  const time = /^(\d+)s/.exec(rest);
  if (time) {
    const sec = Number(time[1]);
    return { sets, target: `${formatSeconds(sec)}${side}`, targetReps: null, targetSec: sec, perSide };
  }
  const reps = /^(\d+)/.exec(rest);
  return { sets, target: rest, targetReps: reps ? Number(reps[1]) : null, targetSec: null, perSide };
}

function pick<T>(value: T | T[], week: number): T {
  return Array.isArray(value) ? value[Math.min(week, value.length - 1)] : value;
}

const KNOWN = new Set(EXERCISES.map((e) => e.id));

/**
 * Gör om en passmall till ett konkret pass för en viss vecka.
 * `swaps` är användarens egna byten (programmets övning → ersättare) och
 * gäller bara övningar som loggas med set.
 */
export function resolveSession(
  program: Program,
  week: number,
  sessionId: string,
  swaps: Record<string, string> = {},
): ResolvedSession | null {
  const tpl = program.sessions.find((s) => s.id === sessionId);
  if (!tpl) return null;

  const blocks: ResolvedBlock[] = tpl.blocks.map((block, bi) => {
    const items: ResolvedItem[] = block.items.map((item, ii) => {
      const swapped = block.format === 'sets' ? swaps[item.exerciseId] : undefined;
      const exercise = getExercise(swapped && KNOWN.has(swapped) ? swapped : item.exerciseId);

      let raw: string;
      if (item.scheme !== undefined) {
        raw = pick<string>(item.scheme, week);
      } else {
        const role = item.role ?? 'acc';
        raw = (role === 'core' && exercise.tracking === 'time' ? program.coreTime : program.schemes[role])[week];
      }
      // Ensidiga övningar görs lika många gånger på varje sida.
      if (exercise.unilateral && raw && !raw.endsWith('/sida')) raw += '/sida';

      const note = item.note ?? (block.format === 'timer' && exercise.unilateral && !raw ? 'Byt sida varje varv' : undefined);

      return {
        key: `${bi}.${ii}`,
        exercise,
        baseExerciseId: item.exerciseId,
        group: item.group || null,
        ...parseScheme(raw),
        restSec: item.restSec ?? (item.role ? program.rest[item.role] : 60),
        note,
      };
    });
    return {
      key: `b${bi}`,
      type: block.type,
      title: block.title ?? BLOCK_LABEL[block.type],
      format: block.format,
      timer: block.timer ? pick<TimerSpec>(block.timer, week) : null,
      intro: block.intro,
      items,
    };
  });

  return { id: tpl.id, name: tpl.name, focus: tpl.focus, estMin: tpl.estMin, week, blocks };
}

/** Kort beskrivning av en timer, t.ex. "6 × 30 s arbete / 15 s vila". */
export function describeTimer(t: TimerSpec): string {
  switch (t.kind) {
    case 'intervals':
      return `${t.rounds} × ${t.workSec} s arbete / ${t.restSec} s vila`;
    case 'emom':
      return `Varje minut i ${t.minutes} min`;
    case 'amrap':
      return `Max antal varv på ${t.minutes} min`;
  }
}

export function timerTotalSec(t: TimerSpec): number {
  switch (t.kind) {
    case 'intervals':
      return t.rounds * (t.workSec + t.restSec) - t.restSec;
    case 'emom':
    case 'amrap':
      return t.minutes * 60;
  }
}

/** Text för en rad i passöversikten: "3 × 8", "10 reps/sida" eller "1 min/sida". */
export function describeItem(item: ResolvedItem, format: 'list' | 'sets' | 'timer'): string {
  if (!item.target) return '';
  if (format !== 'timer' && (item.sets > 1 || format === 'sets')) return `${item.sets} × ${item.target}`;
  if (item.targetSec !== null) return item.target;
  return `${item.targetReps} reps${item.perSide ? '/sida' : ''}`;
}
