/**
 * Ten manual scenes. Ids stay stable. No timed rotation.
 * Paths share viewBox 0 0 320 400. Round strokes, props stay inside the frame.
 */

export interface FigureScene {
  id: string;
  label: string;
  line: string;
  paths: string[];
}

const ground = 'M36 332h248';
const head = 'M142 78a26 26 0 1 0 52 0a26 26 0 1 0 -52 0';
const face = 'M158 90h2M180 90h2M160 104c6 6 14 6 20 0';
const body = 'M168 118c-1 30-8 54-5 86M163 204c-12 30-24 64-32 112M163 204c14 32 28 66 38 112';

export const FIGURE_SCENES: readonly FigureScene[] = [
  {
    id: 'wave',
    label: '挥手',
    line: '嗨，欢迎来玩。',
    paths: [
      ground,
      'M48 332c16 14 30 14 42 0',
      head, face, body,
      'M166 154c-24 10-44 8-62-2',
      'M170 148c22-8 40-32 54-62',
      'M222 84c8-10 16-8 18 1M224 88c10 0 14 6 12 13M222 96c8 8 8 14 4 20',
    ],
  },
  {
    id: 'read',
    label: '读书',
    line: '读一会儿，安静点。',
    paths: [
      ground,
      'M70 332h70c0-28 14-48 36-48h8c22 0 36 20 36 48h70',
      'M118 284h84M128 284c0-36 8-70 32-88',
      head, face,
      'M160 118c-8 24-6 48 4 70M196 118c8 24 6 48-2 70',
      'M150 168h48c8 10 8 22 0 32h-48c-8-10-8-22 0-32z',
      'M174 168v32',
      'M210 250c16-8 28-4 36 8c-10 4-20 2-28 6',
    ],
  },
  {
    id: 'rain',
    label: '撑伞',
    line: '下雨了，也出门走走。',
    paths: [
      ground,
      'M150 332c18 16 34 16 50 0',
      head, face, body,
      'M166 150c-28 6-48 4-64-6',
      'M168 146v-28',
      'M96 118c48-36 112-36 160 0c-20 8-46 12-80 12s-60-4-80-12z',
      'M40 70l10 22M70 48l10 22M250 60l10 22M280 90l8 18M120 40l8 18',
    ],
  },
  {
    id: 'draw',
    label: '画画',
    line: '画一个太阳，再画一片海。',
    paths: [
      ground,
      head, face, body,
      'M150 160c-20 16-30 20-48 8',
      'M100 168l-16 8 18 6',
      'M214 150h70v90h-70z',
      'M214 210h70',
      'M236 168a10 10 0 1 0 14 0',
      'M230 164l-6-8M256 164l6-8M232 186l-8 6M254 186l8 6',
    ],
  },
  {
    id: 'code',
    label: '写代码',
    line: '再改一行就收工。',
    paths: [
      ground,
      'M78 332h50M196 332h50',
      'M96 250h128v82H96z',
      'M150 220h24v30',
      head, face,
      'M156 118c-6 28 0 56 8 90M180 118c6 28 0 56-6 90',
      'M120 168c18 20 64 20 84 0',
      'M118 274h28M118 290h40M168 274l10 8-10 8M196 274l-10 8 10 8',
    ],
  },
  {
    id: 'music',
    label: '听音乐',
    line: '这首歌刚好合拍。',
    paths: [
      ground,
      head, face, body,
      'M150 92c-18 4-28 2-34-8M186 92c18 4 28 2 34-8',
      'M148 100c-8 10-6 16 2 18M188 100c8 10 6 16-2 18',
      'M166 150c22-6 40-28 48-18',
      'M214 132c8-16 18-10 16 2c10-18 22-8 16 6',
      'M250 96c6 10 4 18-2 22M268 78c6 10 4 18-2 22',
    ],
  },
  {
    id: 'bike',
    label: '骑车',
    line: '风从耳边过去。',
    paths: [
      ground,
      'M78 300a36 36 0 1 0 72 0a36 36 0 1 0 -72 0',
      'M190 300a36 36 0 1 0 72 0a36 36 0 1 0 -72 0',
      'M114 300l40-70 46 70M154 230h70',
      head, face,
      'M168 118c8 20 20 40 36 70',
      'M150 150c-20-6-36-4-48 8',
      'M40 150c30-8 50 0 70 8M36 170c28-4 48 2 64 6',
    ],
  },
  {
    id: 'water',
    label: '浇花',
    line: '多喝点水，快快长。',
    paths: [
      ground,
      head, face, body,
      'M166 160c24 8 40 20 48 40',
      'M214 200c10-4 22-2 28 8l-20 16c-6-6-8-12-8-24z',
      'M230 214c6 10 4 16 0 22M242 220c4 8 2 14-2 18',
      'M250 268c-16 20-8 48 10 64h36c18-16 26-44 10-64c-12 10-28 10-40 0z',
      'M268 268c0-28 6-48 0-70M258 210c8-16 20-16 28 0',
    ],
  },
  {
    id: 'stars',
    label: '看星星',
    line: '今晚的星星很亮。',
    paths: [
      ground,
      head, face, body,
      'M168 148c6-30 20-52 28-78',
      'M196 70l4 10 10 2-8 6 2 10-8-6-8 6 2-10-8-6 10-2z',
      'M64 70l3 8 8 1-6 5 2 8-7-4-7 4 2-8-6-5 8-1z',
      'M250 96l3 7 8 1-6 4 2 8-7-4-7 4 2-8-6-4 8-1z',
      'M40 120c20 8 28 8 40 0M250 150c16 6 24 6 36 0',
    ],
  },
  {
    id: 'kite',
    label: '放风筝',
    line: '再高一点！',
    paths: [
      ground,
      head, face, body,
      'M170 150c30-20 48-18 70-4',
      'M240 146c28-70 40-90 36-96',
      'M276 50l22 16-22 16-22-16z',
      'M276 66v28M254 66h44',
      'M268 94c8 10 6 16 2 22',
    ],
  },
];

export function sceneIndex(id: string): number {
  const index = FIGURE_SCENES.findIndex((scene) => scene.id === id);
  return index < 0 ? 0 : index;
}
