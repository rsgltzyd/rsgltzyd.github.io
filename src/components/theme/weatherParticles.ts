/**
 * Lightweight zero-dependency 2D Canvas ink particle layer for WeatherBackdrop.
 * Renders depth-layered rain + ripples, drifting snow, daylight dust motes,
 * night stardust + occasional meteors, and overcast breeze wisps.
 */

import type { EditionId, WeatherKind } from './clock';
import type { ResolvedTheme, ThemeChangeDetail } from './ThemeController';
import { isWeatherKind } from './weather';

type ParticleKind = 'rain' | 'snow' | 'dust' | 'star' | 'fog';

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  depth: number;
  size: number;
  length: number;
  alpha: number;
  phase: number;
  swayAmp: number;
  swayFreq: number;
  fade: number;
  retiring: boolean;
  splashY: number;
  isWisp: boolean;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  duration: number;
  maxRx: number;
  alpha: number;
}

interface Meteor {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  duration: number;
  length: number;
  alpha: number;
}

interface SceneState {
  weather: WeatherKind;
  theme: ResolvedTheme;
  edition: EditionId;
}

function parseCssColor(raw: string, fallback: [number, number, number]): [number, number, number] {
  const s = raw.trim();
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
    } else if (hex.length >= 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
    }
  }
  const rgbMatch = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
  if (rgbMatch) {
    const r = Math.round(Number(rgbMatch[1]));
    const g = Math.round(Number(rgbMatch[2]));
    const b = Math.round(Number(rgbMatch[3]));
    if (Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b)) return [r, g, b];
  }
  return fallback;
}

function isEdition(value: string | null): value is EditionId {
  return value === 'morning' || value === 'day' || value === 'evening' || value === 'night';
}

function countForScene(scene: SceneState, isMobile: boolean): number {
  const scale = isMobile ? 0.52 : 1;
  if (scene.weather === 'rain') return Math.round(56 * scale);
  if (scene.weather === 'snow') return Math.round(52 * scale);
  if (scene.weather === 'cloudy') return Math.round(22 * scale);
  return scene.theme === 'dark' ? Math.round(16 * scale) : Math.round(24 * scale);
}

function particleKindForScene(scene: SceneState): ParticleKind {
  if (scene.weather === 'rain') return 'rain';
  if (scene.weather === 'snow') return 'snow';
  if (scene.weather === 'cloudy') return 'fog';
  return scene.theme === 'dark' ? 'star' : 'dust';
}

function createParticle(
  kind: ParticleKind,
  width: number,
  height: number,
  immediateFade: boolean,
  initialScatter: boolean,
): Particle {
  const depth = 0.15 + Math.random() * 0.85;
  const fade = immediateFade ? 1 : 0;
  const phase = Math.random() * Math.PI * 2;

  if (kind === 'rain') {
    const length = 14 + depth * 34;
    return {
      kind,
      x: Math.random() * (width + 80) - 40,
      y: initialScatter ? Math.random() * height : -length - Math.random() * 80,
      vx: 30 + depth * 44,
      vy: 240 + depth * 380,
      depth,
      size: 0.7 + depth * 0.5,
      length,
      alpha: 0.06 + depth * 0.18,
      phase,
      swayAmp: 0,
      swayFreq: 0,
      fade,
      retiring: false,
      splashY: height - (12 + Math.random() * 36),
      isWisp: false,
    };
  }

  if (kind === 'snow') {
    return {
      kind,
      x: Math.random() * width,
      y: initialScatter ? Math.random() * height : -10 - Math.random() * 60,
      vx: 8 + depth * 18,
      vy: 18 + depth * 36,
      depth,
      size: 1.1 + depth * 2.1,
      length: 0,
      alpha: 0.16 + depth * 0.24,
      phase,
      swayAmp: 10 + (1 - depth) * 16,
      swayFreq: 0.6 + Math.random() * 0.8,
      fade,
      retiring: false,
      splashY: 0,
      isWisp: false,
    };
  }

  if (kind === 'dust') {
    const rightBiased = Math.random() < 0.6;
    const x = rightBiased ? width * (0.45 + Math.random() * 0.55) : Math.random() * width;
    const y = rightBiased ? height * (0.04 + Math.random() * 0.56) : Math.random() * height;
    return {
      kind,
      x,
      y,
      vx: 4 + Math.random() * 8,
      vy: -3 - Math.random() * 6,
      depth,
      size: 0.9 + Math.random() * 1.4,
      length: 0,
      alpha: 0.06 + Math.random() * 0.12,
      phase,
      swayAmp: 5 + Math.random() * 6,
      swayFreq: 0.4 + Math.random() * 0.5,
      fade,
      retiring: false,
      splashY: 0,
      isWisp: false,
    };
  }

  if (kind === 'star') {
    const edgeBand = Math.random() < 0.55;
    const x = edgeBand
      ? Math.random() < 0.5
        ? Math.random() * width * 0.24
        : width * (0.76 + Math.random() * 0.24)
      : Math.random() * width;
    const y = edgeBand ? Math.random() * height * 0.85 : Math.random() * height * 0.42;
    return {
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      depth,
      size: 0.9 + Math.random() * 1.3,
      length: 0,
      alpha: 0.14 + Math.random() * 0.2,
      phase,
      swayAmp: 0,
      swayFreq: 0.8 + Math.random() * 0.9,
      fade,
      retiring: false,
      splashY: 0,
      isWisp: false,
    };
  }

  // 'fog' (cloudy breeze motes & fine wisps moving left-to-right)
  const isWisp = Math.random() < 0.35;
  return {
    kind,
    x: initialScatter ? Math.random() * width : -40 - Math.random() * 80,
    y: Math.random() * height * 0.9,
    vx: 26 + depth * 36,
    vy: (Math.random() - 0.5) * 4,
    depth,
    size: isWisp ? 0.85 : 1.0 + depth * 1.3,
    length: isWisp ? 18 + Math.random() * 26 : 0,
    alpha: 0.08 + depth * 0.1,
    phase,
    swayAmp: 3 + Math.random() * 4,
    swayFreq: 0.5 + Math.random() * 0.5,
    fade,
    retiring: false,
    splashY: 0,
    isWisp,
  };
}

export function initWeatherParticles(canvas: HTMLCanvasElement): () => void {
  const rawCtx = canvas.getContext('2d');
  const rawView = canvas.ownerDocument.defaultView;
  if (!rawCtx || !rawView) return () => {};
  const ctx = rawCtx;
  const view = rawView;

  const doc = canvas.ownerDocument;
  const root = doc.documentElement;
  const reducedQuery = view.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointerQuery = view.matchMedia('(pointer: fine)');

  let width = 1;
  let height = 1;
  let dpr = 1;
  let inkRgb: [number, number, number] = [232, 226, 213];
  let particles: Particle[] = [];
  let ripples: Ripple[] = [];
  let meteor: Meteor | null = null;
  let meteorCooldown = 4 + Math.random() * 5;
  let rafId: number | null = null;
  let lastTime = 0;
  let elapsed = 0;
  let disposed = false;

  let pointerX = -9999;
  let pointerY = -9999;
  let pointerVx = 0;
  let pointerVy = 0;
  let lastPointerX = 0;
  let lastPointerY = 0;
  let hasLastPointer = false;

  let lastScrollY = view.scrollY;
  let pendingScrollDelta = 0;

  function readScene(): SceneState {
    const wAttr = root.getAttribute('data-weather');
    const tAttr = root.getAttribute('data-theme');
    const eAttr = root.getAttribute('data-edition');
    return {
      weather: isWeatherKind(wAttr) ? wAttr : 'clear',
      theme: tAttr === 'light' ? 'light' : 'dark',
      edition: isEdition(eAttr) ? eAttr : tAttr === 'light' ? 'day' : 'night',
    };
  }

  let currentScene = readScene();
  let sceneKey = `${currentScene.weather}:${currentScene.theme}`;

  function refreshInk() {
    const fallback: [number, number, number] =
      currentScene.theme === 'light' ? [26, 25, 23] : [29, 39, 51];
    const computed = view.getComputedStyle(root).getPropertyValue('--ink');
    inkRgb = parseCssColor(computed, fallback);
  }

  function resizeCanvas() {
    dpr = Math.min(view.devicePixelRatio || 1, 2);
    width = Math.max(1, view.innerWidth);
    height = Math.max(1, view.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (const p of particles) {
      if (p.x > width + 60) p.x = Math.random() * width;
      if (p.y > height + 60) p.y = Math.random() * height;
    }

    const activeCount = particles.filter((p) => !p.retiring).length;
    const targetCount = countForScene(currentScene, width < 640);
    const kind = particleKindForScene(currentScene);
    const immediate = reducedQuery.matches;
    if (activeCount < targetCount) {
      for (let i = activeCount; i < targetCount; i += 1) {
        particles.push(createParticle(kind, width, height, immediate, true));
      }
    } else if (activeCount > targetCount) {
      let excess = activeCount - targetCount;
      for (let i = particles.length - 1; i >= 0 && excess > 0; i -= 1) {
        if (!particles[i].retiring) {
          particles[i].retiring = true;
          excess -= 1;
        }
      }
    }
  }

  function spawnSceneParticles(immediate: boolean) {
    for (const p of particles) {
      p.retiring = true;
    }
    const kind = particleKindForScene(currentScene);
    const total = countForScene(currentScene, width < 640);
    for (let i = 0; i < total; i += 1) {
      particles.push(createParticle(kind, width, height, immediate, true));
    }
    if (immediate) {
      particles = particles.filter((p) => !p.retiring);
      ripples = [];
      meteor = null;
    }
  }

  function centerAttenuation(x: number): number {
    if (width <= 980) return 1;
    return Math.abs(x - width * 0.5) < 380 ? 0.62 : 1;
  }

  function rgba(alpha: number): string {
    return `rgba(${inkRgb[0]}, ${inkRgb[1]}, ${inkRgb[2]}, ${alpha.toFixed(3)})`;
  }

  function stepAndRender(dt: number) {
    elapsed += dt;
    const isReduced = reducedQuery.matches;
    const scrollShift = Math.max(-60, Math.min(60, pendingScrollDelta));
    pendingScrollDelta = 0;

    pointerVx *= Math.exp(-dt * 4);
    pointerVy *= Math.exp(-dt * 4);

    ctx.clearRect(0, 0, width, height);

    const nextParticles: Particle[] = [];
    for (const p of particles) {
      if (p.retiring) {
        p.fade = Math.max(0, p.fade - dt * 1.7);
        if (p.fade <= 0) continue;
      } else if (p.fade < 1) {
        p.fade = isReduced ? 1 : Math.min(1, p.fade + dt * 1.6);
      }

      if (!isReduced && dt > 0) {
        const sway =
          p.swayAmp > 0 ? Math.sin(elapsed * p.swayFreq + p.phase) * p.swayAmp * dt : 0;

        p.x += p.vx * dt + sway;
        p.y += p.vy * dt - scrollShift * (0.08 + p.depth * 0.22);

        if (p.kind !== 'star' && (Math.abs(pointerVx) > 0.5 || Math.abs(pointerVy) > 0.5)) {
          const dx = p.x - pointerX;
          const dy = p.y - pointerY;
          const distSq = dx * dx + dy * dy;
          if (distSq < 110 * 110) {
            const influence = (1 - Math.sqrt(distSq) / 110) * (0.35 + p.depth * 0.45);
            p.x += pointerVx * influence * dt * 0.22;
            p.y += pointerVy * influence * dt * 0.14;
          }
        }

        if (p.kind === 'rain') {
          if (
            !p.retiring &&
            p.depth > 0.65 &&
            p.y >= p.splashY &&
            p.y < height - 8 &&
            Math.random() < 0.18
          ) {
            if (ripples.length < 12) {
              ripples.push({
                x: p.x,
                y: p.splashY,
                age: 0,
                duration: 0.45,
                maxRx: 7 + Math.random() * 4,
                alpha: p.alpha * 0.85,
              });
            }
            p.y = -p.length - Math.random() * 40;
            p.x = Math.random() * (width + 80) - 40;
          } else if (p.y - p.length > height + 20 || p.x > width + 80) {
            p.y = -p.length - Math.random() * 60;
            p.x = Math.random() * (width + 80) - 40;
          }
        } else if (p.kind === 'snow') {
          if (p.y > height + 16) {
            p.y = -10 - Math.random() * 30;
            p.x = Math.random() * width;
          }
          if (p.x > width + 20) p.x = -20;
          else if (p.x < -20) p.x = width + 20;
        } else if (p.kind === 'dust') {
          if (p.y < -12) p.y = height + 10;
          if (p.x > width + 16) p.x = -14;
        } else if (p.kind === 'fog') {
          if (p.x > width + 60) {
            p.x = -40 - Math.random() * 50;
            p.y = Math.random() * height * 0.9;
          }
          if (p.y < -20) p.y = height * 0.9;
          else if (p.y > height) p.y = 10;
        }
      }

      nextParticles.push(p);

      let drawAlpha = p.alpha * p.fade * centerAttenuation(p.x);
      if (p.kind === 'dust') {
        drawAlpha *= 0.6 + 0.4 * Math.sin(elapsed * 1.4 + p.phase);
      } else if (p.kind === 'star') {
        drawAlpha *= 0.45 + 0.55 * Math.sin(elapsed * p.swayFreq + p.phase);
      }
      if (drawAlpha <= 0.005) continue;

      if (p.kind === 'rain') {
        const slope = (p.vx / Math.max(1, p.vy)) * p.length;
        ctx.strokeStyle = rgba(drawAlpha);
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - slope, p.y - p.length);
        ctx.stroke();
      } else if (p.kind === 'snow') {
        ctx.fillStyle = rgba(drawAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.size >= 2.5) {
          const arm = p.size * 1.35;
          ctx.strokeStyle = rgba(drawAlpha * 0.65);
          ctx.lineWidth = 0.65;
          ctx.beginPath();
          ctx.moveTo(p.x - arm, p.y);
          ctx.lineTo(p.x + arm, p.y);
          ctx.moveTo(p.x - arm * 0.5, p.y - arm * 0.86);
          ctx.lineTo(p.x + arm * 0.5, p.y + arm * 0.86);
          ctx.moveTo(p.x - arm * 0.5, p.y + arm * 0.86);
          ctx.lineTo(p.x + arm * 0.5, p.y - arm * 0.86);
          ctx.stroke();
        }
      } else if (p.kind === 'fog') {
        if (p.isWisp) {
          ctx.strokeStyle = rgba(drawAlpha);
          ctx.lineWidth = p.size;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(p.x + p.length * 0.5, p.y - 2.5, p.x + p.length, p.y);
          ctx.stroke();
        } else {
          ctx.fillStyle = rgba(drawAlpha);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillStyle = rgba(drawAlpha);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    particles = nextParticles;

    // Rain ripples
    const nextRipples: Ripple[] = [];
    for (const r of ripples) {
      r.age += dt;
      if (r.age >= r.duration) continue;
      nextRipples.push(r);
      const t = r.age / r.duration;
      const rx = 2 + t * (r.maxRx - 2);
      const ry = 0.8 + t * 1.7;
      const alpha = r.alpha * (1 - t) * centerAttenuation(r.x);
      if (alpha <= 0.005) continue;
      ctx.strokeStyle = rgba(alpha);
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ripples = nextRipples;

    // Occasional meteor on clear nights
    if (!isReduced && currentScene.weather === 'clear' && currentScene.theme === 'dark') {
      if (!meteor) {
        meteorCooldown -= dt;
        if (meteorCooldown <= 0) {
          const fromRight = Math.random() < 0.55;
          meteor = {
            x: fromRight ? width * (0.68 + Math.random() * 0.25) : width * (0.08 + Math.random() * 0.2),
            y: height * (0.04 + Math.random() * 0.12),
            vx: 280 + Math.random() * 140,
            vy: 120 + Math.random() * 60,
            age: 0,
            duration: 0.85,
            length: 48 + Math.random() * 26,
            alpha: 0.42,
          };
          meteorCooldown = 9 + Math.random() * 7;
        }
      } else {
        meteor.age += dt;
        if (meteor.age >= meteor.duration) {
          meteor = null;
        } else {
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          const t = meteor.age / meteor.duration;
          const envelope = t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8;
          const alpha = meteor.alpha * Math.max(0, envelope);
          const mag = Math.hypot(meteor.vx, meteor.vy) || 1;
          const tx = meteor.x - (meteor.vx / mag) * meteor.length;
          const ty = meteor.y - (meteor.vy / mag) * meteor.length;
          const grad = ctx.createLinearGradient(tx, ty, meteor.x, meteor.y);
          grad.addColorStop(0, rgba(0));
          grad.addColorStop(1, rgba(alpha));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 1.1;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(meteor.x, meteor.y);
          ctx.stroke();
        }
      }
    } else if (currentScene.weather !== 'clear' || currentScene.theme !== 'dark') {
      meteor = null;
    }
  }

  function isPaused(): boolean {
    return (
      disposed ||
      reducedQuery.matches ||
      doc.hidden
    );
  }

  function stopLoop() {
    if (rafId !== null) {
      view.cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function tick(now: number) {
    if (isPaused()) {
      rafId = null;
      return;
    }
    const dt = lastTime === 0 ? 0.016 : Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    stepAndRender(dt);
    rafId = view.requestAnimationFrame(tick);
  }

  function syncLoop() {
    if (isPaused()) {
      stopLoop();
      if (reducedQuery.matches && !doc.hidden) {
        stepAndRender(0);
      }
      return;
    }
    if (rafId === null) {
      lastTime = 0;
      rafId = view.requestAnimationFrame(tick);
    }
  }

  function onThemeChange(event: Event) {
    const detail = (event as CustomEvent<ThemeChangeDetail>).detail;
    const nextScene: SceneState = detail
      ? { weather: detail.weather, theme: detail.resolved, edition: detail.edition }
      : readScene();
    const nextKey = `${nextScene.weather}:${nextScene.theme}`;
    currentScene = nextScene;
    refreshInk();
    if (nextKey !== sceneKey) {
      sceneKey = nextKey;
      spawnSceneParticles(reducedQuery.matches);
    }
    if (reducedQuery.matches) {
      stepAndRender(0);
    }
  }

  function onResize() {
    resizeCanvas();
    if (reducedQuery.matches) {
      stepAndRender(0);
    }
  }

  function onVisibility() {
    syncLoop();
  }

  function onReducedChange() {
    if (reducedQuery.matches) {
      particles = particles.filter((p) => !p.retiring);
      for (const p of particles) p.fade = 1;
    }
    syncLoop();
  }

  function onPointerMove(event: PointerEvent) {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (hasLastPointer) {
      pointerVx = Math.max(-180, Math.min(180, (event.clientX - lastPointerX) * 6));
      pointerVy = Math.max(-120, Math.min(120, (event.clientY - lastPointerY) * 6));
    }
    lastPointerX = event.clientX;
    lastPointerY = event.clientY;
    pointerX = event.clientX;
    pointerY = event.clientY;
    hasLastPointer = true;
  }

  function onScroll() {
    const nextY = view.scrollY;
    pendingScrollDelta += nextY - lastScrollY;
    lastScrollY = nextY;
  }

  refreshInk();
  resizeCanvas();
  spawnSceneParticles(reducedQuery.matches);

  view.addEventListener('resize', onResize, { passive: true });
  view.addEventListener('scroll', onScroll, { passive: true });
  doc.addEventListener('visibilitychange', onVisibility);
  doc.addEventListener('yl-theme-change', onThemeChange);
  reducedQuery.addEventListener('change', onReducedChange);
  if (finePointerQuery.matches) {
    view.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  syncLoop();

  return () => {
    disposed = true;
    stopLoop();
    view.removeEventListener('resize', onResize);
    view.removeEventListener('scroll', onScroll);
    doc.removeEventListener('visibilitychange', onVisibility);
    doc.removeEventListener('yl-theme-change', onThemeChange);
    reducedQuery.removeEventListener('change', onReducedChange);
    view.removeEventListener('pointermove', onPointerMove);
  };
}
