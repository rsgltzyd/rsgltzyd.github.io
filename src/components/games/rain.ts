import type { Game, GameContext, Input, Palette, Phase } from './types';

const GW = 360;
const GH = 200;

interface Drop {
  x: number;
  y: number;
  len: number;
  v: number;
}

export function createRain(): Game {
  let context: GameContext | null = null;
  let palette: Palette | null = null;
  let phase: Phase = 'idle';
  let score = 0;
  let px = GW / 2;
  let left = false;
  let right = false;
  let tilt = 0;
  let drops: Drop[] = [];
  let raf = 0;
  let last = 0;
  let spawn = 0;
  let alive = true;
  let lastMilestone = 0;

  const report = () => {
    context?.onState({ phase, score: Math.floor(score), lives: null });
  };

  const stop = () => {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    last = 0;
  };

  const resetState = () => {
    px = GW / 2;
    score = 0;
    alive = true;
    left = false;
    right = false;
    tilt = 0;
    last = 0;
    spawn = 0;
    lastMilestone = 0;
    drops = [
      { x: 70, y: 30, len: 14, v: 0 },
      { x: 150, y: 70, len: 18, v: 0 },
      { x: 250, y: 40, len: 12, v: 0 },
      { x: 310, y: 90, len: 16, v: 0 },
    ];
  };

  const draw = (hint?: string) => {
    if (!context || !palette) return;
    const canvas = context.canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== GW * dpr || canvas.height !== GH * dpr) {
      canvas.width = GW * dpr;
      canvas.height = GH * dpr;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Background
    ctx.fillStyle = palette.surface;
    ctx.fillRect(0, 0, GW, GH);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Ground line
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(8, GH - 12);
    ctx.quadraticCurveTo(GW / 2, GH - 15, GW - 8, GH - 11);
    ctx.stroke();

    // Rain drops
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = 1.8;
    for (const d of drops) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.len * 0.25, d.y + d.len);
      ctx.stroke();
    }

    // Stick figure with tilt
    const py = GH - 40;
    ctx.save();
    ctx.translate(px, py + 14);
    ctx.rotate(tilt);
    ctx.translate(-px, -(py + 14));

    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py - 8, 7, 0, Math.PI * 2);
    ctx.moveTo(px, py - 1);
    ctx.lineTo(px, py + 14);
    ctx.moveTo(px - 9, py + 5);
    ctx.lineTo(px + 9, py + 5);
    ctx.moveTo(px, py + 14);
    ctx.lineTo(px - 6, py + 27);
    ctx.moveTo(px, py + 14);
    ctx.lineTo(px + 6, py + 27);
    ctx.stroke();

    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (alive) {
      ctx.arc(px, py - 7, 3.2, 0.2, Math.PI - 0.2);
    } else {
      // Dead eyes
      ctx.moveTo(px - 4, py - 9);
      ctx.lineTo(px - 1, py - 6);
      ctx.moveTo(px - 1, py - 9);
      ctx.lineTo(px - 4, py - 6);
      ctx.moveTo(px + 1, py - 9);
      ctx.lineTo(px + 4, py - 6);
      ctx.moveTo(px + 4, py - 9);
      ctx.lineTo(px + 1, py - 6);
      // straight mouth
      ctx.moveTo(px - 3, py - 4);
      ctx.lineTo(px + 3, py - 4);
    }
    ctx.stroke();
    ctx.restore();

    // Hint text
    if (hint) {
      ctx.fillStyle = palette.muted;
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(hint, GW / 2, 64);
    }
  };

  const loop = (time: number) => {
    if (phase !== 'playing' || !context || !palette) return;
    if (!last) last = time;
    const dt = Math.min(40, time - last) / 16.7;
    last = time;

    const speed = 3.4;
    const targetTilt = left ? -0.12 : right ? 0.12 : 0;
    tilt += (targetTilt - tilt) * 0.2;

    if (left) px -= speed * dt;
    if (right) px += speed * dt;
    px = Math.max(12, Math.min(GW - 12, px));

    spawn -= dt;
    if (spawn <= 0) {
      drops.push({
        x: 10 + Math.random() * (GW - 20),
        y: -20,
        len: 12 + Math.random() * 10,
        v: 2.2 + Math.random() * 1.2 + score * 0.05,
      });
      spawn = Math.max(5, 16 - score * 0.3);
    }

    for (const d of drops) {
      d.y += d.v * dt;
    }
    drops = drops.filter((d) => d.y < GH);

    const py = GH - 40;
    for (const d of drops) {
      const tipX = d.x - d.len * 0.25;
      const tipY = d.y + d.len;
      if (Math.abs(tipX - px) < 9 && tipY > py - 15 && d.y < py + 27) {
        alive = false;
        break;
      }
    }

    score += 0.05 * dt;
    const currentScore = Math.floor(score);
    if (currentScore > 0 && currentScore % 15 === 0 && currentScore !== lastMilestone) {
      lastMilestone = currentScore;
      context.playSound?.('score');
    }
    report();

    if (!alive) {
      phase = 'over';
      context.playSound?.('over');
      report();
      draw('被雨线碰到了');
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
      draw('点“开始”，或聚焦后按空格');
    },
    start() {
      resetState();
      phase = 'playing';
      alive = true;
      drops = [];
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
      tilt = 0;
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
      draw('点“开始”，或聚焦后按空格');
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
        px = Math.max(12, Math.min(GW - 12, action.x));
      } else if (action.kind === 'release') {
        left = false;
        right = false;
      }
    },
    setTheme(p: Palette) {
      palette = p;
    },
    render() {
      if (phase === 'idle') draw('点“开始”，或聚焦后按空格');
      else if (phase === 'paused') draw('已暂停');
      else if (phase === 'over') draw('被雨线碰到了');
      else draw();
    },
    resize() {
      this.render();
    },
  };
}
