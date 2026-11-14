import { fitCanvas } from './canvas';
import type { Direction, Game, GameContext, Input, Palette, Phase } from './types';

const CELL = 20;
const BASE_W = 360;
const BASE_H = 240;
const COLS = Math.floor(BASE_W / CELL);

interface Point {
  x: number;
  y: number;
}

const DIRV: Record<Direction, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

function placeFood(body: Point[], rows: number): Point {
  const free: Point[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!body.some((p) => p.x === x && p.y === y)) free.push({ x, y });
    }
  }
  if (!free.length) return { x: 10, y: 6 };
  return free[Math.floor(Math.random() * free.length)];
}

function isOpposite(a: Point, b: Point): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function veil(ctx: CanvasRenderingContext2D, bg: string, _fg: string, _text: string, height: number) {
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BASE_W, height);
  ctx.globalAlpha = 1;
}

export function createSnake(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let body: Point[] = [];
  let dir: Point = DIRV.right;
  let queue: Point[] = [];
  let food: Point = { x: 10, y: 6 };
  let acc = 0;
  let last = 0;
  let raf = 0;
  let eatPulse = 0;
  let eatPos = { x: 0, y: 0 };
  let rows = Math.floor(BASE_H / CELL);

  const report = () => {
    context?.onState({ phase, score, lives: null });
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
    acc = 0;
  };

  const resetState = () => {
    const startY = Math.min(6, rows - 1);
    body = [{ x: 5, y: startY }, { x: 4, y: startY }, { x: 3, y: startY }];
    dir = DIRV.right;
    queue = [];
    food = placeFood(body, rows);
    acc = 0;
    last = 0;
    score = 0;
    eatPulse = 0;
  };

  const clampState = () => {
    body = body.map((p) => ({
      x: Math.max(0, Math.min(COLS - 1, p.x)),
      y: Math.max(0, Math.min(rows - 1, p.y)),
    }));
    food = {
      x: Math.max(0, Math.min(COLS - 1, food.x)),
      y: Math.max(0, Math.min(rows - 1, food.y)),
    };
  };

  const draw = (msg?: string) => {
    if (!context || !palette) return;
    const view = fitCanvas(context.canvas);
    if (!view) return;
    const scale = view.width / BASE_W;
    const fieldH = view.height / scale;
    const nextRows = Math.max(6, Math.floor(fieldH / CELL));
    if (nextRows !== rows) {
      rows = nextRows;
      clampState();
    }
    const { ctx } = view;
    const width = COLS * CELL;
    const height = rows * CELL;
    ctx.scale(scale, scale);

    // Background
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, width, height);

    // Dotted grid
    ctx.fillStyle = palette.muted;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < COLS; x++) {
        ctx.fillRect(x * CELL + CELL / 2 - 0.5, y * CELL + CELL / 2 - 0.5, 1, 1);
      }
    }

    // Food (apple with stem)
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1, 5.5, 0, Math.PI * 2);
    ctx.moveTo(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 - 5);
    ctx.quadraticCurveTo(food.x * CELL + CELL / 2 + 2, food.y * CELL + CELL / 2 - 8, food.x * CELL + CELL / 2 + 5, food.y * CELL + CELL / 2 - 8);
    ctx.stroke();

    // Eat pulse particle
    if (eatPulse > 0) {
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = eatPulse;
      ctx.beginPath();
      ctx.arc(eatPos.x, eatPos.y, (1 - eatPulse) * 16 + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Snake body
    ctx.lineWidth = 10;
    ctx.beginPath();
    body.forEach((p, i) => {
      const cx = p.x * CELL + CELL / 2;
      const cy = p.y * CELL + CELL / 2;
      if (i) ctx.lineTo(cx, cy);
      else ctx.moveTo(cx, cy);
    });
    if (body.length === 1) ctx.lineTo(body[0].x * CELL + CELL / 2 + 0.1, body[0].y * CELL + CELL / 2);
    ctx.stroke();

    // Snake eye
    const h = body[0];
    ctx.fillStyle = palette.surface;
    ctx.beginPath();
    ctx.arc(
      h.x * CELL + CELL / 2 + dir.x * 2 - dir.y * 2,
      h.y * CELL + CELL / 2 + dir.y * 2 + dir.x * 2,
      1.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (msg) {
      veil(ctx, palette.surface, palette.ink, msg, height);
    }
  };

  const loop = (time: number) => {
    if (phase !== 'playing' || !context || !palette) return;
    if (!last) last = time;
    const dt = Math.min(100, time - last);
    last = time;
    acc += dt;

    if (eatPulse > 0) {
      eatPulse = Math.max(0, eatPulse - dt * 0.004);
    }

    const tick = Math.max(108, 148 - score * 2);
    while (acc >= tick) {
      acc -= tick;
      if (queue.length) {
        const next = queue.shift()!;
        if (!isOpposite(next, dir)) {
          dir = next;
          context.playSound?.('hit');
        }
      }
      const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      const ate = head.x === food.x && head.y === food.y;

      if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= rows) {
        phase = 'over';
        context.playSound?.('over');
        report();
        draw(`撞到了，得分 ${score}`);
        stop();
        return;
      }

      const check = ate ? body : body.slice(0, -1);
      if (check.some((s) => s.x === head.x && s.y === head.y)) {
        phase = 'over';
        context.playSound?.('over');
        report();
        draw(`撞到了，得分 ${score}`);
        stop();
        return;
      }

      body = [head, ...body];
      if (ate) {
        score += 1;
        eatPos = { x: food.x * CELL + CELL / 2, y: food.y * CELL + CELL / 2 + 1 };
        eatPulse = 1;
        context.playSound?.('score');
        food = placeFood(body, rows);
        report();
      } else {
        body.pop();
      }
    }

    draw();
    raf = requestAnimationFrame(loop);
  };

  return {
    init(c) {
      context = c;
      palette = c.palette;
      resetState();
      phase = 'idle';
      report();
      draw('点“开始”，用方向键或 WASD 移动');
    },
    start() {
      resetState();
      phase = 'playing';
      context?.playSound?.('start');
      report();
      stop();
      raf = requestAnimationFrame(loop);
    },
    pause() {
      if (phase !== 'playing') return;
      phase = 'paused';
      stop();
      report();
      draw('已暂停');
    },
    resume() {
      if (phase !== 'paused') return;
      phase = 'playing';
      last = 0;
      report();
      stop();
      raf = requestAnimationFrame(loop);
    },
    reset() {
      stop();
      resetState();
      phase = 'idle';
      report();
      draw('点“开始”，用方向键或 WASD 移动');
    },
    destroy() {
      stop();
      context = null;
      palette = null;
    },
    input(action: Input) {
      if (action.kind === 'dir' || action.kind === 'direction') {
        const d = action.kind === 'dir' ? action.dir : action.direction;
        const v = DIRV[d];
        if (v) {
          const lastPlanned = queue[queue.length - 1] ?? dir;
          if (v.x === lastPlanned.x && v.y === lastPlanned.y) return;
          if (isOpposite(v, lastPlanned)) return;
          if (queue.length >= 2) return;
          queue.push(v);
        }
      }
    },
    setTheme(p: Palette) {
      palette = p;
    },
    render() {
      if (phase === 'idle') draw('点“开始”，用方向键或 WASD 移动');
      else if (phase === 'paused') draw('已暂停');
      else if (phase === 'over') draw(`撞到了，得分 ${score}`);
      else draw();
    },
    resize() {
      this.render();
    },
  };
}
