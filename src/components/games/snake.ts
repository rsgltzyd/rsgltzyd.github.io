import type { Direction, Game, GameContext, Input, Palette, Phase } from './types';

const SC = 24;
const SR = 16;
const W = 360;
const H = 240;

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

function placeFood(body: Point[]): Point {
  const free: Point[] = [];
  for (let y = 0; y < SR; y++) {
    for (let x = 0; x < SC; x++) {
      if (!body.some((p) => p.x === x && p.y === y)) free.push({ x, y });
    }
  }
  if (!free.length) return { x: 10, y: 6 };
  return free[Math.floor(Math.random() * free.length)];
}

function isOpposite(a: Point, b: Point): boolean {
  return a.x === -b.x && a.y === -b.y;
}

function veil(ctx: CanvasRenderingContext2D, bg: string, fg: string, text: string) {
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.fillStyle = fg;
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, W / 2, H / 2 + 5);
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
    body = [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }];
    dir = DIRV.right;
    queue = [];
    food = placeFood(body);
    acc = 0;
    last = 0;
    score = 0;
  };

  const draw = (msg?: string) => {
    if (!context || !palette) return;
    const canvas = context.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width = W * dpr;
      canvas.height = H * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, W, H);

    // Dotted grid
    ctx.fillStyle = palette.muted;
    for (let y = 0; y < SR; y++) {
      for (let x = 0; x < SC; x++) {
        ctx.fillRect(x * 20 + 9.5, y * 20 + 9.5, 1, 1);
      }
    }

    // Food (apple with stem)
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.arc(food.x * 20 + 10, food.y * 20 + 11, 5.5, 0, Math.PI * 2);
    ctx.moveTo(food.x * 20 + 10, food.y * 20 + 5);
    ctx.quadraticCurveTo(food.x * 20 + 12, food.y * 20 + 2, food.x * 20 + 15, food.y * 20 + 2);
    ctx.stroke();

    // Snake body
    ctx.lineWidth = 10;
    ctx.beginPath();
    body.forEach((p, i) => {
      const cx = p.x * 20 + 10;
      const cy = p.y * 20 + 10;
      if (i) ctx.lineTo(cx, cy);
      else ctx.moveTo(cx, cy);
    });
    if (body.length === 1) ctx.lineTo(body[0].x * 20 + 10.1, body[0].y * 20 + 10);
    ctx.stroke();

    // Snake eye
    const h = body[0];
    ctx.fillStyle = palette.surface;
    ctx.beginPath();
    ctx.arc(
      h.x * 20 + 10 + dir.x * 2 - dir.y * 2,
      h.y * 20 + 10 + dir.y * 2 + dir.x * 2,
      1.6,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (msg) {
      veil(ctx, palette.surface, palette.ink, msg);
    }
  };

  const loop = (time: number) => {
    if (phase !== 'playing' || !context || !palette) return;
    if (!last) last = time;
    const dt = Math.min(100, time - last);
    last = time;
    acc += dt;

    const tick = Math.max(90, 160 - score * 3);
    while (acc >= tick) {
      acc -= tick;
      if (queue.length) {
        const next = queue.shift()!;
        if (!isOpposite(next, dir)) dir = next;
      }
      const head = { x: body[0].x + dir.x, y: body[0].y + dir.y };
      const ate = head.x === food.x && head.y === food.y;

      if (head.x < 0 || head.y < 0 || head.x >= SC || head.y >= SR) {
        phase = 'over';
        report();
        draw(`撞到了，得分 ${score}`);
        stop();
        return;
      }

      const check = ate ? body : body.slice(0, -1);
      if (check.some((s) => s.x === head.x && s.y === head.y)) {
        phase = 'over';
        report();
        draw(`撞到了，得分 ${score}`);
        stop();
        return;
      }

      body = [head, ...body];
      if (ate) {
        score += 1;
        food = placeFood(body);
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
      if (action.kind === 'dir') {
        const v = DIRV[action.dir];
        if (v) {
          const lastPlanned = queue[queue.length - 1] ?? dir;
          if (!isOpposite(v, lastPlanned)) queue.push(v);
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
