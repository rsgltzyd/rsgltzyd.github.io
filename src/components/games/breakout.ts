import type { Game, GameContext, Input, Palette, Phase } from './types';

const BW = 360;
const BH = 240;
const PAD_Y = 222;
const PAD_H = 6;
const BALL_R = 4;
const PAD_W = 64;

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  len: number;
  rot: number;
  alpha: number;
}

function makeBricks(): Brick[] {
  const out: Brick[] = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 8; c++) {
      out.push({ x: 22 + c * 40, y: 30 + r * 18, w: 36, h: 12 });
    }
  }
  return out;
}

function veil(ctx: CanvasRenderingContext2D, bg: string, _fg: string, _text: string) {
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, BW, BH);
  ctx.globalAlpha = 1;
}

export function createBreakout(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let lives = 3;
  let padX = (BW - PAD_W) / 2;
  let ball: Ball = { x: BW / 2, y: PAD_Y - BALL_R - 2, vx: 1.8, vy: -3.3 };
  let bricks: Brick[] = makeBricks();
  let particles: Particle[] = [];
  let left = false;
  let right = false;
  let last = 0;
  let raf = 0;

  const serve = (px: number): Ball => ({
    x: px + PAD_W / 2,
    y: PAD_Y - BALL_R - 2,
    vx: (Math.random() < 0.5 ? -1 : 1) * 1.8,
    vy: -3.3,
  });

  const report = () => {
    context?.onState({ phase, score, lives });
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const resetState = () => {
    padX = (BW - PAD_W) / 2;
    ball = serve(padX);
    bricks = makeBricks();
    particles = [];
    lives = 3;
    score = 0;
    left = false;
    right = false;
    last = 0;
  };

  const spawnParticles = (brick: Brick) => {
    const cx = brick.x + brick.w / 2;
    const cy = brick.y + brick.h / 2;
    for (let i = 0; i < 4; i++) {
      const ang = (Math.PI * 2 * i) / 4 + Math.random() * 0.5;
      const sp = 1.2 + Math.random() * 2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        len: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        alpha: 1,
      });
    }
  };

  const draw = (msg?: string) => {
    if (!context || !palette) return;
    const canvas = context.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== BW * dpr || canvas.height !== BH * dpr) {
      canvas.width = BW * dpr;
      canvas.height = BH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, BW, BH);

    // Bricks
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const b of bricks) {
      ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w, b.h);
      if ((b.y - 30) % 36 === 0) {
        ctx.beginPath();
        ctx.moveTo(b.x + 6, b.y + b.h - 3);
        ctx.lineTo(b.x + 12, b.y + 3);
        ctx.stroke();
      }
    }

    // Brick shatter particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.strokeStyle = palette.ink;
      ctx.lineWidth = 1.2;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.beginPath();
      ctx.moveTo(-p.len / 2, 0);
      ctx.lineTo(p.len / 2, 0);
      ctx.stroke();
      ctx.restore();
    }

    // Paddle
    ctx.lineWidth = PAD_H;
    ctx.beginPath();
    ctx.moveTo(padX + PAD_H / 2, PAD_Y + PAD_H / 2);
    ctx.lineTo(padX + PAD_W - PAD_H / 2, PAD_Y + PAD_H / 2);
    ctx.stroke();

    // Ball
    ctx.fillStyle = palette.ink;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();

    if (msg) {
      veil(ctx, palette.surface, palette.ink, msg);
    }
  };

  const stepBall = (dt: number) => {
    let hit = 0;
    const n = Math.max(1, Math.ceil(dt * 2));
    for (let s = 0; s < n; s++) {
      const px = ball.x;
      const py = ball.y;
      ball.x += (ball.vx * dt) / n;
      ball.y += (ball.vy * dt) / n;

      if (ball.x < BALL_R) {
        ball.x = BALL_R;
        ball.vx = Math.abs(ball.vx);
        context?.playSound?.('hit');
      }
      if (ball.x > BW - BALL_R) {
        ball.x = BW - BALL_R;
        ball.vx = -Math.abs(ball.vx);
        context?.playSound?.('hit');
      }
      if (ball.y < BALL_R) {
        ball.y = BALL_R;
        ball.vy = Math.abs(ball.vy);
        context?.playSound?.('hit');
      }

      // Paddle collision
      if (
        ball.vy > 0 &&
        ball.y + BALL_R >= PAD_Y &&
        py + BALL_R <= PAD_Y + 1 &&
        ball.x >= padX - BALL_R &&
        ball.x <= padX + PAD_W + BALL_R
      ) {
        const off = (ball.x - (padX + PAD_W / 2)) / (PAD_W / 2);
        const sp = Math.hypot(ball.vx, ball.vy);
        const ang = Math.max(-1, Math.min(1, off)) * 1.05;
        ball.vx = sp * Math.sin(ang);
        ball.vy = -sp * Math.cos(ang);
        ball.y = PAD_Y - BALL_R;
        context?.playSound?.('hit');
      }

      // Ball lost
      if (ball.y - BALL_R > BH) {
        return { lost: true, hit };
      }

      // Brick collision
      const i = bricks.findIndex(
        (k) =>
          ball.x + BALL_R > k.x &&
          ball.x - BALL_R < k.x + k.w &&
          ball.y + BALL_R > k.y &&
          ball.y - BALL_R < k.y + k.h,
      );
      if (i >= 0) {
        const k = bricks[i];
        const wasInX = px + BALL_R > k.x && px - BALL_R < k.x + k.w;
        if (wasInX) {
          ball.vy = -ball.vy;
          ball.y = py;
        } else {
          ball.vx = -ball.vx;
          ball.x = px;
        }
        spawnParticles(k);
        bricks = bricks.filter((_, j) => j !== i);
        hit++;
        context?.playSound?.('break');
      }
    }
    return { lost: false, hit };
  };

  const loop = (time: number) => {
    if (phase !== 'playing' || !context || !palette) return;
    if (!last) last = time;
    const dt = Math.min(40, time - last) / 16.7;
    last = time;

    const speed = 4.2;
    if (left) padX -= speed * dt;
    if (right) padX += speed * dt;
    padX = Math.max(0, Math.min(BW - PAD_W, padX));

    // Update particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha = Math.max(0, p.alpha - 0.03 * dt);
    }
    particles = particles.filter((p) => p.alpha > 0);

    const r = stepBall(dt);
    if (r.hit) {
      score += r.hit;
      report();
    }

    if (bricks.length === 0) {
      phase = 'won';
      context.playSound?.('win');
      report();
      draw(`全部打碎了！得分 ${score}`);
      stop();
      return;
    }

    if (r.lost) {
      lives -= 1;
      if (lives <= 0) {
        phase = 'over';
        context.playSound?.('over');
        report();
        draw(`球掉了，得分 ${score}`);
        stop();
        return;
      }
      ball = serve(padX);
      phase = 'paused';
      context.playSound?.('hit');
      report();
      draw(`球掉了，还剩 ${lives} 次机会，空格继续`);
      stop();
      return;
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
      draw('点“开始”，左右键移动挡板');
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
      left = false;
      right = false;
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
      draw('点“开始”，左右键移动挡板');
    },
    destroy() {
      stop();
      context = null;
      palette = null;
    },
    input(action: Input) {
      if (action.kind === 'hold-x') {
        if (action.dir === 'left') left = action.active;
        else if (action.dir === 'right') right = action.active;
      } else if (action.kind === 'direction') {
        if (action.direction === 'left') {
          left = action.held ?? true;
          right = false;
        } else if (action.direction === 'right') {
          right = action.held ?? true;
          left = false;
        }
      } else if (action.kind === 'point') {
        padX = Math.max(0, Math.min(BW - PAD_W, action.x - PAD_W / 2));
      } else if (action.kind === 'release') {
        left = false;
        right = false;
      }
    },
    setTheme(p: Palette) {
      palette = p;
    },
    render() {
      if (phase === 'idle') draw('点“开始”，左右键移动挡板');
      else if (phase === 'paused') draw('已暂停');
      else if (phase === 'over') draw(`球掉了，得分 ${score}`);
      else if (phase === 'won') draw(`全部打碎了！得分 ${score}`);
      else draw();
    },
    resize() {
      this.render();
    },
  };
}
