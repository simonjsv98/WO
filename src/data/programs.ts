import type {
  BlockTemplate,
  BlockType,
  PlanItem,
  Program,
  ResolvedBlock,
  ResolvedItem,
  ResolvedSession,
  Scheme,
  TimerSpec,
  WeekInfo,
} from '../lib/types';
import { formatSeconds } from '../lib/format';
import { getExercise } from './exercises';

export const BLOCK_LABEL: Record<BlockType, string> = {
  warmup: 'Uppvärmning',
  power: 'Kraft',
  strength: 'Styrka',
  conditioning: 'Kondition & bål',
  cooldown: 'Nedvarvning',
};

const it = (exerciseId: string, scheme: Scheme, restSec?: number, note?: string): PlanItem => ({
  exerciseId,
  scheme,
  restSec,
  note,
});

const intervals = (workSec: number, restSec: number, rounds: number): TimerSpec => ({
  kind: 'intervals',
  workSec,
  restSec,
  rounds,
});
const emom = (minutes: number): TimerSpec => ({ kind: 'emom', minutes });
const amrap = (minutes: number): TimerSpec => ({ kind: 'amrap', minutes });

const warmup = (items: PlanItem[]): BlockTemplate => ({ type: 'warmup', format: 'list', items });
const cooldown = (items: PlanItem[]): BlockTemplate => ({ type: 'cooldown', format: 'list', items });
const power = (items: PlanItem[]): BlockTemplate => ({
  type: 'power',
  format: 'sets',
  intro: 'Få repetitioner med maximal fart. Vila tills du är helt redo för nästa set.',
  items,
});
const strength = (items: PlanItem[]): BlockTemplate => ({
  type: 'strength',
  format: 'sets',
  intro: 'Välj en vikt där du har ett par repetitioner kvar när setet är slut.',
  items,
});

const WEEKS: [WeekInfo, WeekInfo, WeekInfo, WeekInfo] = [
  { title: 'Grund', focus: 'Lär dig rörelserna och hitta dina startvikter. Lämna tre repetitioner i tanken.' },
  { title: 'Bygg', focus: 'Mer volym. Lägg på lite vikt där förra veckan kändes lätt.' },
  { title: 'Topp', focus: 'Månadens tyngsta vecka. Färre repetitioner, högre belastning.' },
  { title: 'Lätt', focus: 'Halva volymen, samma kvalitet. Du ska gå härifrån piggare än du kom.' },
];

/* ------------------------------------------------------------------ */
/* Program 1 – Atlet (gym, fyra pass i veckan)                         */
/* ------------------------------------------------------------------ */

const ATLET: Program = {
  id: 'atlet',
  name: 'Atlet',
  tagline: 'Styrka, kraft och kondition i gymmet',
  description:
    'Ett månadsprogram för dig som vill bli stark, snabb och uthållig på samma gång. Varje pass går från uppvärmning via explosiva rörelser och tung styrka till kondition, bål och nedvarvning.',
  level: 'Medel',
  equipment: 'Fullt utrustat gym',
  weeks: WEEKS,
  sessions: [
    {
      id: 'a',
      name: 'Underkropp',
      focus: 'Tung knäböj, höftfällning och ensidig benstyrka',
      estMin: 60,
      blocks: [
        warmup([
          it('pulse', '180s'),
          it('cat-cow', '8'),
          it('lunge-rotation', '5/sida'),
          it('glute-bridge', '2x10'),
          it('ankle-rock', '10/sida'),
        ]),
        power([
          it('box-jump', ['3x4', '4x4', '4x3', '3x3'], 60),
          it('kb-swing', ['3x8', '3x10', '4x8', '2x8'], 60),
        ]),
        strength([
          it('back-squat', ['3x8', '4x6', '5x5', '3x5'], 150),
          it('rdl', ['3x8', '3x8', '4x6', '2x8'], 120),
          it('split-squat', ['2x8/sida', '3x8/sida', '3x6/sida', '2x6/sida'], 90),
        ]),
        {
          type: 'conditioning',
          title: 'Bålcirkel',
          format: 'timer',
          timer: [intervals(30, 15, 6), intervals(35, 15, 6), intervals(40, 20, 9), intervals(30, 30, 6)],
          intro: 'Rotera mellan övningarna. Ett varv är alla tre.',
          items: [
            it('dead-bug', ''),
            it('side-plank', '', undefined, 'Byt sida varje varv'),
            it('farmer-carry', ''),
          ],
        },
        cooldown([it('couch-stretch', '60s/sida'), it('pigeon', '60s/sida'), it('belly-breathing', '120s')]),
      ],
    },
    {
      id: 'b',
      name: 'Överkropp',
      focus: 'Press och drag, tungt och kontrollerat',
      estMin: 55,
      blocks: [
        warmup([
          it('pulse', '180s'),
          it('t-spine-rotation', '8/sida'),
          it('band-pull-apart', '2x15'),
          it('scap-pushup', '2x10'),
          it('inchworm', '6'),
        ]),
        power([
          it('med-ball-chest-pass', ['3x5', '4x5', '4x4', '3x4'], 60),
          it('med-ball-slam', ['3x6', '3x8', '4x6', '2x6'], 60),
        ]),
        strength([
          it('bench-press', ['3x8', '4x6', '5x5', '3x5'], 150),
          it('pullup', ['3x6', '4x6', '5x5', '3x5'], 120, 'Använd gummiband eller extra vikt så att repetitionerna stämmer'),
          it('half-kneeling-press', ['2x8/sida', '3x8/sida', '3x6/sida', '2x8/sida'], 75),
          it('db-row', ['2x10/sida', '3x10/sida', '3x8/sida', '2x10/sida'], 75),
          it('face-pull', ['2x15', '3x15', '3x12', '2x15'], 45),
        ]),
        {
          type: 'conditioning',
          title: 'Bål varje minut',
          format: 'timer',
          timer: [emom(8), emom(10), emom(12), emom(8)],
          intro: 'Ny övning varje hel minut. Vila den tid som blir över.',
          items: [it('hanging-knee-raise', '10'), it('pallof-press', '8/sida')],
        },
        cooldown([
          it('pec-stretch', '45s/sida'),
          it('lat-stretch', '60s'),
          it('thread-needle', '45s/sida'),
          it('box-breathing', '120s'),
        ]),
      ],
    },
    {
      id: 'c',
      name: 'Atletisk helkropp',
      focus: 'Hopp, marklyft och rörelser i alla riktningar',
      estMin: 60,
      blocks: [
        warmup([
          it('jump-rope', '120s'),
          it('hip-90-90', '8/sida'),
          it('leg-swings', '10/sida'),
          it('deep-squat-hold', '45s'),
          it('pogo', '2x15'),
        ]),
        power([
          it('broad-jump', ['3x3', '4x3', '5x3', '3x3'], 75),
          it('skater-jump', ['3x5/sida', '3x6/sida', '4x5/sida', '2x5/sida'], 60),
        ]),
        strength([
          it('deadlift', ['3x6', '4x5', '5x3', '3x3'], 180),
          it('overhead-press', ['3x8', '4x6', '4x5', '2x6'], 120),
          it('reverse-lunge', ['2x8/sida', '3x8/sida', '3x6/sida', '2x6/sida'], 90),
          it('barbell-row', ['3x8', '3x10', '4x8', '2x8'], 90),
          it('lateral-lunge', ['2x8/sida', '2x8/sida', '3x6/sida', '2x6/sida'], 60),
        ]),
        {
          type: 'conditioning',
          title: 'Bär och håll',
          format: 'timer',
          timer: [intervals(30, 15, 6), intervals(35, 15, 6), intervals(40, 20, 9), intervals(30, 30, 6)],
          intro: 'Rotera mellan övningarna. Ett varv är alla tre.',
          items: [
            it('suitcase-carry', '', undefined, 'Byt hand varje varv'),
            it('hollow-hold', ''),
            it('bear-crawl', ''),
          ],
        },
        cooldown([it('hamstring-stretch', '45s/sida'), it('childs-pose', '60s'), it('belly-breathing', '120s')]),
      ],
    },
    {
      id: 'd',
      name: 'Kondition & bål',
      focus: 'Intervaller, lätt styrka och en hård avslutning',
      estMin: 50,
      blocks: [
        warmup([
          it('pulse', '300s'),
          it('lunge-rotation', '5/sida'),
          it('inchworm', '6'),
          it('glute-bridge', '2x10'),
        ]),
        power([it('jump-squat', ['3x5', '3x6', '4x5', '2x5'], 60)]),
        strength([
          it('step-up', ['2x10/sida', '3x10/sida', '3x8/sida', '2x8/sida'], 60),
          it('hip-thrust', ['3x10', '3x10', '4x8', '2x10'], 90),
          it('pushup', ['3x10', '3x12', '4x10', '2x10'], 60),
        ]),
        {
          type: 'conditioning',
          title: 'Intervaller',
          format: 'timer',
          timer: [intervals(60, 60, 6), intervals(60, 60, 8), intervals(60, 45, 10), intervals(60, 90, 5)],
          intro: 'Arbeta på en nivå du precis klarar att hålla hela vägen.',
          items: [it('cardio-machine', '')],
        },
        {
          type: 'conditioning',
          title: 'Avslutning',
          format: 'timer',
          timer: [amrap(6), amrap(8), amrap(10), amrap(5)],
          intro: 'Så många varv som möjligt på tiden. Räkna varven.',
          items: [it('burpee', '6'), it('kb-swing', '12'), it('mountain-climber', '20')],
        },
        cooldown([
          it('couch-stretch', '60s/sida'),
          it('pigeon', '60s/sida'),
          it('deep-squat-hold', '60s'),
          it('box-breathing', '120s'),
        ]),
      ],
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Program 2 – Hemma (minimal utrustning, tre pass i veckan)           */
/* ------------------------------------------------------------------ */

const HEMMA: Program = {
  id: 'hemma',
  name: 'Hemma',
  tagline: 'Tre pass i veckan med en kettlebell',
  description:
    'Samma upplägg som i gymmet men anpassat för vardagsrummet. Du behöver en kettlebell eller ett par hantlar och lite golvyta.',
  level: 'Nybörjare till medel',
  equipment: 'Kettlebell eller hantlar',
  weeks: WEEKS,
  sessions: [
    {
      id: 'a',
      name: 'Underkropp & bål',
      focus: 'Knäböj, enbensstyrka och stabil bål',
      estMin: 40,
      blocks: [
        warmup([
          it('pulse', '120s'),
          it('cat-cow', '8'),
          it('lunge-rotation', '5/sida'),
          it('glute-bridge', '2x10'),
        ]),
        power([
          it('jump-squat', ['3x5', '3x6', '4x5', '2x5'], 60),
          it('kb-swing', ['3x10', '3x12', '4x10', '2x10'], 60),
        ]),
        strength([
          it('goblet-squat', ['3x10', '4x8', '4x6', '2x8'], 90),
          it('single-leg-rdl', ['2x8/sida', '3x8/sida', '3x6/sida', '2x6/sida'], 75),
          it('reverse-lunge', ['2x10/sida', '3x10/sida', '3x8/sida', '2x8/sida'], 75),
          it('calf-raise', ['2x15', '3x15', '3x12', '2x12'], 45),
        ]),
        {
          type: 'conditioning',
          title: 'Bålcirkel',
          format: 'timer',
          timer: [intervals(30, 15, 6), intervals(35, 15, 6), intervals(40, 20, 9), intervals(30, 30, 6)],
          intro: 'Rotera mellan övningarna. Ett varv är alla tre.',
          items: [
            it('dead-bug', ''),
            it('plank', ''),
            it('side-plank', '', undefined, 'Byt sida varje varv'),
          ],
        },
        cooldown([it('couch-stretch', '60s/sida'), it('pigeon', '60s/sida'), it('belly-breathing', '120s')]),
      ],
    },
    {
      id: 'b',
      name: 'Överkropp & bål',
      focus: 'Armhävningar, rodd och press över huvudet',
      estMin: 40,
      blocks: [
        warmup([
          it('pulse', '120s'),
          it('t-spine-rotation', '8/sida'),
          it('scap-pushup', '2x10'),
          it('inchworm', '6'),
        ]),
        power([it('plyo-pushup', ['3x4', '3x5', '4x4', '2x4'], 60)]),
        strength([
          it('pushup', ['3x8', '4x8', '4x10', '2x8'], 75),
          it('db-row', ['3x10/sida', '4x8/sida', '4x6/sida', '2x8/sida'], 75),
          it('half-kneeling-press', ['2x8/sida', '3x8/sida', '3x6/sida', '2x8/sida'], 75),
          it('bird-dog', ['2x8/sida', '2x10/sida', '3x8/sida', '2x8/sida'], 45),
        ]),
        {
          type: 'conditioning',
          title: 'Bål varje minut',
          format: 'timer',
          timer: [emom(6), emom(8), emom(10), emom(6)],
          intro: 'Ny övning varje hel minut. Vila den tid som blir över.',
          items: [it('mountain-climber', '20'), it('dead-bug', '8/sida')],
        },
        cooldown([it('pec-stretch', '45s/sida'), it('thread-needle', '45s/sida'), it('childs-pose', '60s'), it('box-breathing', '120s')]),
      ],
    },
    {
      id: 'c',
      name: 'Helkropp & puls',
      focus: 'Sidledsrörelser, höftstyrka och en svettig avslutning',
      estMin: 40,
      blocks: [
        warmup([
          it('pulse', '120s'),
          it('hip-90-90', '8/sida'),
          it('leg-swings', '10/sida'),
          it('deep-squat-hold', '45s'),
        ]),
        power([
          it('skater-jump', ['3x5/sida', '3x6/sida', '4x5/sida', '2x5/sida'], 60),
          it('pogo', ['2x15', '3x15', '3x20', '2x15'], 45),
        ]),
        strength([
          it('thruster', ['3x8', '4x8', '4x6', '2x8'], 90),
          it('lateral-lunge', ['2x8/sida', '3x8/sida', '3x6/sida', '2x6/sida'], 75),
          it('glute-bridge', ['3x12', '3x15', '4x12', '2x12'], 45, 'Gör dem på ett ben om det känns lätt'),
        ]),
        {
          type: 'conditioning',
          title: 'Avslutning',
          format: 'timer',
          timer: [amrap(6), amrap(8), amrap(10), amrap(5)],
          intro: 'Så många varv som möjligt på tiden. Räkna varven.',
          items: [it('burpee', '5'), it('kb-swing', '10'), it('mountain-climber', '20')],
        },
        cooldown([it('hamstring-stretch', '45s/sida'), it('couch-stretch', '60s/sida'), it('belly-breathing', '120s')]),
      ],
    },
  ],
};

export const PROGRAMS: Program[] = [ATLET, HEMMA];
export const WEEK_COUNT = 4;

export function getProgram(id: string): Program {
  return PROGRAMS.find((p) => p.id === id) ?? PROGRAMS[0];
}

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

export function resolveSession(program: Program, week: number, sessionId: string): ResolvedSession | null {
  const tpl = program.sessions.find((s) => s.id === sessionId);
  if (!tpl) return null;

  const blocks: ResolvedBlock[] = tpl.blocks.map((block, bi) => {
    const items: ResolvedItem[] = block.items.map((item, ii) => {
      const parsed = parseScheme(pick<string>(item.scheme, week));
      return {
        key: `${bi}.${ii}`,
        exercise: getExercise(item.exerciseId),
        ...parsed,
        restSec: item.restSec ?? 60,
        note: item.note,
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

/** Kort beskrivning av en timer, t.ex. "6 × 30 s / 15 s". */
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
