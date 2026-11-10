/**
 * Nine figure scenes in viewBox 0 0 240 200.
 * Standing: head r=18, chin = top+36, hip ~132, feet 178, ground ~181.
 */

export interface FigureMorph {
  dur: string;
  values: readonly string[];
}

export interface FigureSpin {
  dur: string;
}

export interface FigureLive {
  className: string;
  delay?: string;
  wrap?: string;
  origin?: string;
  paths: readonly string[];
  morph?: FigureMorph;
  spin?: FigureSpin;
}

export interface FigureScene {
  id: string;
  label: string;
  line: string;
  paths: readonly string[];
  live?: readonly FigureLive[];
}

export type SceneItem =
  | { kind: 'path'; d: string }
  | {
      kind: 'group';
      className: string;
      delay?: string;
      wrap?: string;
      origin?: string;
      paths: string[];
      morph?: FigureMorph;
      spin?: FigureSpin;
    };

export const GROUND_PATH = 'M14 182 Q70 178 120 181 T226 180';

function face(
  cx: number,
  top: number,
  mouth: 'smile' | 'line' | 'oh' | 'smirk',
  look: 'ahead' | 'up' | 'down' = 'ahead',
): string[] {
  const eyeY = look === 'up' ? top + 13 : look === 'down' ? top + 17 : top + 15;
  const eye = look === 'up' ? 'l1 -3' : look === 'down' ? 'l0 2' : 'l0 3';
  const mouthY = top + 25;
  const paths = [
    `M${cx} ${top} a18 18 0 1 0 0.1 0`,
    `M${cx - 7} ${eyeY} ${eye}`,
    `M${cx + 7} ${eyeY} ${eye}`,
  ];
  if (mouth === 'smile') paths.push(`M${cx - 9} ${mouthY} q9 8 18 0`);
  if (mouth === 'line') paths.push(`M${cx - 8} ${mouthY + 1} l16 0`);
  if (mouth === 'oh') paths.push(`M${cx - 3} ${mouthY + 3} a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0`);
  if (mouth === 'smirk') paths.push(`M${cx - 8} ${mouthY} q8 -3 16 2`);
  return paths;
}

function wheel(cx: number, cy: number, r: number): FigureLive {
  const hub = 3.4;
  const rim = [
    `M${-r} 0 a${r} ${r} 0 1 0 ${r * 2} 0 a${r} ${r} 0 1 0 ${-r * 2} 0`,
    `M${-hub} 0 a${hub} ${hub} 0 1 0 ${hub * 2} 0 a${hub} ${hub} 0 1 0 ${-hub * 2} 0`,
  ];
  const spokes = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return `M${num(hub * c)} ${num(hub * s)} L${num(r * c)} ${num(r * s)}`;
  });
  return {
    className: 'figure-wheel',
    wrap: `translate(${cx} ${cy})`,
    paths: [...rim, ...spokes],
  };
}

function toGroup(part: FigureLive): SceneItem {
  return {
    kind: 'group',
    className: part.className,
    delay: part.delay,
    wrap: part.wrap,
    origin: part.origin,
    paths: [...part.paths],
    morph: part.morph,
    spin: part.spin,
  };
}

function num(v: number): string {
  return (Math.round(v * 10) / 10).toString();
}

/** Hip → knee → pedal. Foot rides the crank circle; knee follows a natural oval so both legs stay readable. */
function pedalStroke(angle: number): string {
  const hipX = 98;
  const hipY = 114;
  const px = 108 + 18 * Math.cos(angle);
  const py = 156 + 18 * Math.sin(angle);
  const kx = 104 + 16 * Math.cos(angle);
  const ky = 140 + 6 * Math.sin(angle);
  const sole = 9;
  return `M${hipX} ${hipY} L${num(kx)} ${num(ky)} L${num(px)} ${num(py)} M${num(px)} ${num(py)} L${num(px + sole)} ${num(py + 1)}`;
}

function pedalLive(phase: number): FigureLive {
  const frames = 12;
  const values = Array.from({ length: frames + 1 }, (_, i) =>
    pedalStroke(phase + (i / frames) * Math.PI * 2),
  );
  return {
    className: 'figure-pedal',
    paths: [values[0]],
    morph: { dur: '1.2s', values },
  };
}

function crankLive(): FigureLive {
  const end = 18 * Math.cos(Math.PI / 4);
  return {
    className: 'figure-crank',
    wrap: 'translate(108 156)',
    spin: { dur: '1.2s' },
    paths: [`M${num(-end)} ${num(-end)} L${num(end)} ${num(end)}`],
  };
}

/** L-arm from the shoulder onto the keyboard; hands alternate press / lift. */
function typeStroke(side: 'far' | 'near', t: number): string {
  const phase = (side === 'near' ? t + 0.5 : t) % 1;
  const s = Math.sin(phase * Math.PI * 2);
  const press = s * 2.2;
  const slide = Math.cos(phase * Math.PI * 2) * 3;
  if (side === 'far') {
    const wy = 126 + press;
    const wx = 126 + slide;
    return `M76 96 L90 ${num(120 + press * 0.35)} L${num(wx)} ${num(wy)} L${num(wx + 9)} ${num(wy)}`;
  }
  const wy = 126 + press;
  const wx = 135 + slide;
  return `M76 96 L94 ${num(124 + press * 0.35)} L${num(wx)} ${num(wy)} L${num(wx + 11)} ${num(wy)}`;
}

function typeLive(side: 'far' | 'near'): FigureLive {
  const frames = 8;
  const values = Array.from({ length: frames + 1 }, (_, i) => typeStroke(side, i / frames));
  return {
    className: 'figure-type',
    paths: [values[0]],
    morph: { dur: '0.64s', values },
  };
}

/** Desk open book tilted toward reader. Spine from (142, 108) to (140, 128). */
const SPINE_TOP_X = 142;
const SPINE_TOP_Y = 108;
const SPINE_BOT_X = 140;
const SPINE_BOT_Y = 128;

const READ_PAGE_SPINE = `M${SPINE_TOP_X} ${SPINE_TOP_Y} Q${SPINE_TOP_X} ${SPINE_TOP_Y} ${SPINE_TOP_X} ${SPINE_TOP_Y} L${SPINE_BOT_X} ${SPINE_BOT_Y} Q${SPINE_BOT_X} ${SPINE_BOT_Y} ${SPINE_BOT_X} ${SPINE_BOT_Y}`;
const READ_HAND_HOLD = 'M78 96 L108 122 L166 118';
const READ_HAND_DROP = 'M78 96 L104 124 L136 122';

/** Curved leaf hinged at the book spine; lifts cleanly over the spread and settles flat. */
function pageTurnAt(t: number): string {
  const s = Math.sin(t * Math.PI);
  const c = Math.cos(t * Math.PI);
  const xCtrlTop = SPINE_TOP_X + c * 13;
  const yCtrlTop = 102 - s * 10;
  const xOuterTop = SPINE_TOP_X + c * 24;
  const yOuterTop = 104 - s * 12;
  const xOuterBot = SPINE_BOT_X + c * 26;
  const yOuterBot = 123 - s * 11;
  const xCtrlBot = SPINE_BOT_X + c * 13;
  const yCtrlBot = 123 - s * 8;
  return `M${SPINE_TOP_X} ${SPINE_TOP_Y} Q${num(xCtrlTop)} ${num(yCtrlTop)} ${num(xOuterTop)} ${num(yOuterTop)} L${num(xOuterBot)} ${num(yOuterBot)} Q${num(xCtrlBot)} ${num(yCtrlBot)} ${SPINE_BOT_X} ${SPINE_BOT_Y}`;
}

function readHandAt(t: number): string {
  const s = Math.sin(t * Math.PI);
  const c = Math.cos(t * Math.PI);
  const x = SPINE_TOP_X + c * 24;
  const y = 114 - s * 11;
  const ex = 102 + c * 6;
  const ey = 122 - s * 5;
  return `M78 96 L${num(ex)} ${num(ey)} L${num(x)} ${num(y)}`;
}

function pageLive(): FigureLive {
  const values = [
    READ_PAGE_SPINE,
    READ_PAGE_SPINE,
    READ_PAGE_SPINE,
    pageTurnAt(0.18),
    pageTurnAt(0.36),
    pageTurnAt(0.52),
    pageTurnAt(0.68),
    pageTurnAt(0.84),
    pageTurnAt(0.94),
    READ_PAGE_SPINE,
    READ_PAGE_SPINE,
  ];
  return {
    className: 'figure-page',
    paths: [values[0]],
    morph: { dur: '3.2s', values },
  };
}

function readHandLive(): FigureLive {
  const values = [
    READ_HAND_HOLD,
    READ_HAND_HOLD,
    READ_HAND_HOLD,
    readHandAt(0.16),
    readHandAt(0.35),
    readHandAt(0.52),
    readHandAt(0.72),
    readHandAt(0.9),
    readHandAt(1),
    READ_HAND_DROP,
    READ_HAND_HOLD,
  ];
  return {
    className: 'figure-read-hand',
    paths: [values[0]],
    morph: { dur: '3.2s', values },
  };
}

export function sceneItems(scene: FigureScene): SceneItem[] {
  const live = scene.live ?? [];
  const items: SceneItem[] = [];
  for (const part of live.filter((item) => item.className === 'figure-wheel')) {
    items.push(toGroup(part));
  }
  for (const d of scene.paths) items.push({ kind: 'path', d });
  for (const part of live.filter((item) => item.className !== 'figure-wheel')) {
    items.push(toGroup(part));
  }
  return items;
}

export function scenePathCount(scene: FigureScene): number {
  return sceneItems(scene).reduce(
    (n, item) => n + (item.kind === 'path' ? 1 : item.paths.length),
    0,
  );
}

export const FIGURE_SCENES: readonly FigureScene[] = [
  {
    id: 'wave',
    label: '打招呼',
    line: '嗨，欢迎来玩。',
    paths: [
      ...face(120, 40, 'smile'),
      'M120 76 L120 132',
      'M120 94 L98 122 L92 128',
      'M120 132 L106 178',
      'M106 178 L96 178',
      'M120 132 L135 178',
      'M135 178 L145 178',
    ],
    live: [
      {
        className: 'figure-wave',
        wrap: 'translate(120 94)',
        origin: '0% 100%',
        paths: ['M0 0 L24 -12 L32 -38', 'M40 -44 q6 5 2 12', 'M48 -52 q9 7 4 16'],
      },
    ],
  },
  {
    id: 'read',
    label: '读书',
    line: '读一会儿，安静点。',
    paths: [
      'M48 92 L54 148',
      'M48 92 L64 92',
      'M64 92 L68 148',
      'M54 148 L104 148',
      'M56 148 L52 178',
      'M68 148 L70 178',
      'M94 148 L94 178',
      'M102 148 L102 178',
      ...face(78, 38, 'smile', 'down'),
      'M76 74 L74 148',
      'M74 148 L82 178',
      'M82 178 L92 178',
      'M104 148 L116 178',
      'M116 178 L126 178',
      'M116 134 L226 134',
      'M126 134 L126 178',
      'M216 134 L216 178',
      'M76 96 L96 120 L118 122',
      'M142 108 Q129 102 118 106 L114 125 Q127 123 140 128',
      'M142 108 Q155 102 166 106 L168 125 Q155 123 140 128',
      'M142 108 L140 128',
      'M112 128 Q126 126 140 131 Q154 126 170 128',
      'M122 112 L136 113',
      'M121 117 L135 118',
      'M120 122 L132 123',
      'M146 113 L160 112',
      'M146 118 L161 117',
      'M146 123 L158 122',
      'M190 116 L208 116 L206 134 L192 134 Z',
      'M208 121 q7 2 0 9',
    ],
    live: [
      pageLive(),
      readHandLive(),
      { className: 'figure-steam', delay: '0s', paths: ['M196 111 q-3 -7 0 -11'] },
      { className: 'figure-steam', delay: '0.45s', paths: ['M202 111 q-2 -7 1 -11'] },
    ],
  },
  {
    id: 'rain',
    label: '撑伞',
    line: '下雨了，也出门走走。',
    paths: [
      'M64 42 Q128 2 192 42',
      'M64 42 q16 -8 32 0 q16 -8 32 0 q16 -8 32 0 q16 -8 32 0',
      'M128 22 L128 18',
      'M128 22 L128 114',
      'M128 114 q0 10 -11 10 q-6 0 -6 -5',
      ...face(102, 52, 'smile'),
      'M104 88 L108 136',
      'M106 104 L120 114 L128 108',
      'M106 104 L88 128',
      'M108 136 L94 178',
      'M94 178 L84 178',
      'M108 136 L122 178',
      'M122 178 L132 178',
      'M172 179 a22 3.5 0 1 0 44 0 a22 3.5 0 1 0 -44 0',
    ],
    live: [
      { className: 'figure-rain', delay: '0s', paths: ['M36 22 l-3 12'] },
      { className: 'figure-rain', delay: '0.18s', paths: ['M22 54 l-3 12'] },
      { className: 'figure-rain', delay: '0.4s', paths: ['M44 86 l-3 12'] },
      { className: 'figure-rain', delay: '0.58s', paths: ['M28 118 l-3 12'] },
      { className: 'figure-rain', delay: '0.08s', paths: ['M202 18 l-3 12'] },
      { className: 'figure-rain', delay: '0.28s', paths: ['M216 48 l-3 12'] },
      { className: 'figure-rain', delay: '0.46s', paths: ['M204 82 l-3 12'] },
      { className: 'figure-rain', delay: '0.66s', paths: ['M220 114 l-3 12'] },
    ],
  },
  {
    id: 'code',
    label: '写代码',
    line: '再改一行就收工。',
    paths: [
      'M48 92 L54 148',
      'M48 92 L64 92',
      'M64 92 L68 148',
      'M54 148 L104 148',
      'M56 148 L52 178',
      'M68 148 L70 178',
      'M94 148 L94 178',
      'M102 148 L102 178',
      ...face(78, 38, 'smile'),
      'M76 74 L74 148',
      'M74 148 L82 178',
      'M82 178 L92 178',
      'M104 148 L116 178',
      'M116 178 L126 178',
      'M116 134 L226 134',
      'M126 134 L126 178',
      'M216 134 L216 178',
      'M122 134 L124 125 L160 125 L162 134',
      'M128 128 L156 128',
      'M130 131 L152 131',
      'M156 54 L208 54 L212 114 L152 114 Z',
      'M182 114 L182 134',
      'M170 134 L194 134',
      'M170 72 L162 84 L170 96',
      'M194 72 L202 84 L194 96',
    ],
    live: [
      typeLive('far'),
      typeLive('near'),
      { className: 'figure-cursor', paths: ['M182 70 l0 28'] },
    ],
  },
  {
    id: 'music',
    label: '听音乐',
    line: '这首歌刚好合拍。',
    paths: [
      ...face(124, 40, 'smile'),
      'M105 52 Q124 22 143 52',
      'M101 54 a4.5 8 0 1 0 9 0 a4.5 8 0 1 0 -9 0',
      'M138 54 a4.5 8 0 1 0 9 0 a4.5 8 0 1 0 -9 0',
      'M124 76 L114 132',
      'M122 86 L102 112 L90 132',
      'M122 86 L142 92 L144 60',
      'M114 132 L96 158 L88 178',
      'M88 178 L76 178',
    ],
    live: [
      {
        className: 'figure-tap',
        wrap: 'translate(114 132)',
        origin: '0% 0%',
        paths: ['M0 0 L20 24 L34 46', 'M34 46 L48 44'],
      },
      {
        className: 'figure-note',
        delay: '0s',
        wrap: 'translate(158 52)',
        paths: ['M0 0 a3 2.2 0 1 0 6 0 a3 2.2 0 1 0 -6 0', 'M6 0 L6 -12 L12 -9'],
      },
      {
        className: 'figure-note',
        delay: '0.95s',
        wrap: 'translate(174 38)',
        paths: ['M0 0 a2.6 1.9 0 1 0 5.2 0 a2.6 1.9 0 1 0 -5.2 0', 'M5.2 0 L5.2 -10 L10 -7.5'],
      },
    ],
  },
  {
    id: 'bike',
    label: '骑车',
    line: '风从耳边过去。',
    paths: [
      'M74 159 L108 156 L98 118 Z',
      'M98 118 L146 112',
      'M108 156 L146 112',
      'M146 112 L168 161',
      'M95 108 L98 118',
      'M88 107 L103 109',
      'M146 112 L149 94',
      'M149 94 L141 92 L138 100',
      'M149 94 L154 93',
      'M101 156 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0',
      'M108 149 L76 155',
      'M108 163 L76 163',
      ...face(130, 38, 'smile'),
      'M122 74 L98 114',
      'M118 82 L134 94 L149 94',
      'M115 86 L130 98 L141 92',
    ],
    live: [
      wheel(74, 159, 21),
      wheel(168, 161, 21),
      pedalLive(Math.PI / 4 + Math.PI),
      crankLive(),
      pedalLive(Math.PI / 4),
      { className: 'figure-speed', delay: '0s', paths: ['M18 116 l18 0'] },
      { className: 'figure-speed', delay: '0.12s', paths: ['M10 132 l22 0'] },
      { className: 'figure-speed', delay: '0.24s', paths: ['M22 148 l12 0'] },
      { className: 'figure-wind', delay: '0s', paths: ['M208 48 q-16 2 -28 4'] },
      { className: 'figure-wind', delay: '0.14s', paths: ['M222 66 q-18 1 -26 3'] },
      { className: 'figure-wind', delay: '0.28s', paths: ['M214 88 q-16 3 -24 2'] },
      { className: 'figure-wind', delay: '0.08s', paths: ['M224 114 q-14 2 -22 4'] },
      { className: 'figure-wind', delay: '0.22s', paths: ['M218 138 q-12 3 -20 5'] },
      { className: 'figure-wind', delay: '0.36s', paths: ['M226 158 q-10 2 -16 4'] },
    ],
  },
  {
    id: 'stars',
    label: '看星星',
    line: '今晚的星星很亮。',
    paths: [
      ...face(86, 78, 'oh', 'up'),
      'M88 114 L116 168',
      'M92 124 L72 152 L64 178',
      'M96 122 L126 100 L148 74',
      'M116 168 L148 148 L174 178',
      'M174 178 L184 176',
      'M116 168 L144 178 L156 178',
      'M34 36 a16 16 0 1 0 18 22 a12 12 0 1 1 -18 -22',
    ],
    live: [
      { className: 'figure-star', delay: '0s', wrap: 'translate(64 26)', paths: ['M0 -6 L0 6', 'M-6 0 L6 0'] },
      { className: 'figure-star', delay: '0.4s', wrap: 'translate(166 28)', paths: ['M0 -5 L0 5', 'M-5 0 L5 0'] },
      { className: 'figure-star', delay: '0.85s', wrap: 'translate(208 62)', paths: ['M0 -4 L0 4', 'M-4 0 L4 0'] },
      { className: 'figure-star', delay: '1.15s', wrap: 'translate(118 22)', paths: ['M0 -3.5 L0 3.5', 'M-3.5 0 L3.5 0'] },
      { className: 'figure-meteor', paths: ['M216 14 L176 42'] },
    ],
  },
  {
    id: 'kite',
    label: '放风筝',
    line: '再高一点！',
    paths: [
      ...face(64, 50, 'smile', 'up'),
      'M68 86 L78 140',
      'M71 102 L92 98 L112 108',
      'M71 102 L94 116 L112 114',
      'M110 105 L116 105 L116 117 L110 117 Z',
      'M78 140 L62 178',
      'M62 178 L52 178',
      'M78 140 L96 178',
      'M96 178 L106 178',
      'M116 108 Q154 78 186 38',
    ],
    live: [
      {
        className: 'figure-cloud',
        wrap: 'translate(18 28)',
        paths: ['M0 0 q6 -10 16 -6 q6 -8 14 0 q8 0 6 8 Z'],
      },
      {
        className: 'figure-kite',
        wrap: 'translate(186 38)',
        origin: '0% 100%',
        paths: [
          'M0 0 L8 -24 L30 -34 L24 -8 Z',
          'M0 0 L30 -34',
          'M8 -24 L24 -8',
          'M0 0 q6 10 16 12 q8 2 14 10',
          'M10 8 l6 -3',
          'M22 15 l6 -3',
        ],
      },
    ],
  },
  {
    id: 'fish',
    label: '钓鱼',
    line: '再等一会儿就上钩。',
    paths: [
      'M8 176 Q14 150 42 148 L108 148 L112 176 Q60 182 8 176 Z',
      ...face(74, 36, 'smile'),
      'M74 72 L94 148',
      'M80 94 L100 116 L118 126',
      'M80 94 L104 122 L124 122',
      'M94 148 L104 176',
      'M104 176 L114 176',
      'M94 148 L110 148 L118 176',
      'M118 176 L128 176',
      'M112 130 Q158 88 198 54',
      'M198 54 L198 168',
      'M195 168 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0',
      'M128 176 Q156 173 184 176 T232 176',
    ],
    live: [
      {
        className: 'figure-ripple',
        delay: '0s',
        wrap: 'translate(198 171)',
        paths: ['M-12 0 a12 4 0 1 0 24 0 a12 4 0 1 0 -24 0'],
      },
      {
        className: 'figure-ripple',
        delay: '0.7s',
        wrap: 'translate(198 171)',
        paths: ['M-20 0 a20 6.5 0 1 0 40 0 a20 6.5 0 1 0 -40 0'],
      },
    ],
  },
];
