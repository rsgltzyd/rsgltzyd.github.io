import { FIGURE_SCENES, sceneItems, scenePathCount, type FigureScene } from './scenes';

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function pathMarkup(d: string, index: number, animate: boolean, inner = ''): string {
  const close = inner ? `>${inner}</path>` : ' />';
  if (!animate) {
    return `<path d="${d}" pathLength="1" style="stroke-dasharray: 1; stroke-dashoffset: 0; transition: none;"${close}`;
  }
  const delay = `${(index * 0.05).toFixed(2)}s`;
  return `<path d="${d}" pathLength="1" style="stroke-dasharray: 1; stroke-dashoffset: 1; transition: stroke-dashoffset 0.5s ease ${delay};"${close}`;
}

function morphMarkup(values: readonly string[], dur: string): string {
  return `<animate attributeName="d" dur="${dur}" repeatCount="indefinite" begin="indefinite" calcMode="linear" values="${values.join(';')}" />`;
}

function spinMarkup(dur: string): string {
  return `<animateTransform attributeName="transform" type="rotate" from="0 0 0" to="360 0 0" dur="${dur}" repeatCount="indefinite" begin="indefinite" />`;
}

function renderScene(scene: FigureScene, animate: boolean): string {
  let index = 0;
  return sceneItems(scene)
    .map((item) => {
      if (item.kind === 'path') {
        return pathMarkup(item.d, index++, animate);
      }
      const styles: string[] = [];
      if (item.delay) styles.push(`--live-delay: ${item.delay}`);
      if (item.origin) styles.push(`transform-origin: ${item.origin}`);
      const styleAttr = styles.length ? ` style="${styles.join('; ')}"` : '';
      const spin = item.spin ? spinMarkup(item.spin.dur) : '';
      const inner = item.paths
        .map((d, i) =>
          pathMarkup(d, index++, animate, i === 0 && item.morph ? morphMarkup(item.morph.values, item.morph.dur) : ''),
        )
        .join('');
      const group = `<g class="figure-live ${item.className}"${styleAttr}>${spin}${inner}</g>`;
      return item.wrap ? `<g transform="${item.wrap}">${group}</g>` : group;
    })
    .join('');
}

function drawInMs(pathCount: number): number {
  return Math.max(0, pathCount - 1) * 50 + 500;
}

export function initFigure(card: HTMLElement): () => void {
  const svgEl = card.querySelector<SVGSVGElement>('[data-figure-svg]');
  const pathsEl = card.querySelector<SVGGElement>('[data-figure-paths]');
  const captionEl = card.querySelector<HTMLElement>('[data-figure-caption]');
  const buttons = card.querySelectorAll<HTMLButtonElement>('[data-scene]');

  if (!svgEl || !pathsEl || !captionEl) return () => {};
  const svg = svgEl;
  const pathsGroup = pathsEl;
  const caption = captionEl;

  let currentIndex = 0;
  let animTimer: number | null = null;
  let liveTimer: number | null = null;
  let meteorTimer: number | null = null;
  let holdTimer: number | null = null;
  let holdRepeat: number | null = null;
  let holdPointerId: number | null = null;
  /** Timestamp of the last arrow step that came from a pointer, so the click that follows pointerup does not step again. */
  let lastPointerStepAt = 0;
  let introPlayed = false;
  let userInteracted = false;
  let introObserver: IntersectionObserver | null = null;
  const holdDelayMs = 420;
  const holdIntervalMs = 320;

  function clearTimers() {
    if (animTimer !== null) {
      clearTimeout(animTimer);
      animTimer = null;
    }
    if (liveTimer !== null) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
    if (meteorTimer !== null) {
      clearTimeout(meteorTimer);
      meteorTimer = null;
    }
    pathsGroup.querySelectorAll('.figure-meteor.is-falling').forEach((meteor) => {
      meteor.classList.remove('is-falling');
    });
  }

  function revealPaths() {
    const renderedPaths = pathsGroup.querySelectorAll<SVGPathElement>('path');
    renderedPaths.forEach((path) => {
      path.style.strokeDashoffset = '0';
    });
  }

  function startLiveMotion() {
    if (prefersReducedMotion()) return;
    const scene = FIGURE_SCENES[currentIndex];
    if (!scene.live?.length) return;
    card.classList.add('is-live');
    pathsGroup.querySelectorAll('animate, animateTransform').forEach((node) => {
      try {
        (node as SVGAnimationElement).beginElement();
      } catch {
        /* SMIL begin can throw if the element is not ready */
      }
    });
    startMeteors();
  }

  /** Fire one meteor at a time, each after a fresh random pause. */
  function startMeteors() {
    const meteors = Array.from(pathsGroup.querySelectorAll<SVGGElement>('.figure-meteor'));
    if (!meteors.length) return;
    const fire = () => {
      const meteor = meteors[Math.floor(Math.random() * meteors.length)];
      meteor.style.setProperty('--meteor-dur', `${(0.9 + Math.random() * 0.35).toFixed(2)}s`);
      meteor.classList.remove('is-falling');
      void meteor.getBoundingClientRect();
      meteor.classList.add('is-falling');
      meteorTimer = window.setTimeout(fire, 2800 + Math.random() * 4000);
    };
    meteorTimer = window.setTimeout(fire, 1100 + Math.random() * 1700);
  }

  function setScene(index: number) {
    currentIndex = (index + FIGURE_SCENES.length) % FIGURE_SCENES.length;
    const scene = FIGURE_SCENES[currentIndex];
    const animate = !prefersReducedMotion();

    buttons.forEach((btn) => {
      const isCurrent = btn.getAttribute('data-scene') === scene.id;
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });

    caption.textContent = `“${scene.line}”`;
    svg.setAttribute('aria-label', `简笔画：${scene.label}`);

    clearTimers();
    card.classList.remove('is-live');
    pathsGroup.innerHTML = renderScene(scene, animate);
    if (!animate) {
      startLiveMotion();
      return;
    }

    const pathCount = scenePathCount(scene);
    animTimer = window.setTimeout(() => {
      animTimer = null;
      revealPaths();
      liveTimer = window.setTimeout(() => {
        liveTimer = null;
        startLiveMotion();
      }, drawInMs(pathCount));
    }, 30);
  }

  function playIntro() {
    if (introPlayed || userInteracted) return;
    introPlayed = true;
    if (prefersReducedMotion()) {
      revealPaths();
      return;
    }
    setScene(currentIndex);
  }

  function watchIntroVisibility() {
    if (introPlayed || userInteracted) return;
    if (typeof IntersectionObserver === 'undefined') {
      playIntro();
      return;
    }
    introObserver = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        introObserver?.disconnect();
        introObserver = null;
        playIntro();
      },
      { threshold: 0.2 },
    );
    introObserver.observe(card);
  }

  function onWindowLoad() {
    watchIntroVisibility();
  }

  function markInteracted() {
    userInteracted = true;
    introObserver?.disconnect();
    introObserver = null;
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const sceneBtn = target.closest<HTMLButtonElement>('[data-scene]');
    if (sceneBtn) {
      const id = sceneBtn.getAttribute('data-scene');
      const idx = FIGURE_SCENES.findIndex((s) => s.id === id);
      if (idx !== -1) {
        markInteracted();
        setScene(idx);
      }
      return;
    }

    const deltaBtn = target.closest<HTMLButtonElement>('[data-figure-delta]');
    if (deltaBtn) {
      // A pointer press already steps on pointerdown and may repeat while held.
      // Keyboard activation has no recent pointer step, so it still goes through here.
      if (Date.now() - lastPointerStepAt < 700) return;
      stepDelta(parseInt(deltaBtn.getAttribute('data-figure-delta') || '0', 10));
    }
  }

  function stepDelta(delta: number) {
    if (!delta) return;
    markInteracted();
    setScene(currentIndex + delta);
  }

  function notePointerStep() {
    lastPointerStepAt = Date.now();
  }

  function stopHold() {
    if (holdTimer !== null) {
      clearTimeout(holdTimer);
      holdTimer = null;
    }
    if (holdRepeat !== null) {
      clearInterval(holdRepeat);
      holdRepeat = null;
    }
    holdPointerId = null;
  }

  let swipe: { x: number; y: number } | null = null;
  const stage = card.querySelector<HTMLElement>('[data-pose-stage]') ?? card;

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-figure-delta], [data-scene]')) return;
    swipe = { x: e.clientX, y: e.clientY };
  }

  function onPointerUp(e: PointerEvent) {
    const start = swipe;
    swipe = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    markInteracted();
    setScene(currentIndex + (dx < 0 ? 1 : -1));
  }

  function onPointerCancel() {
    swipe = null;
  }

  function onDeltaPointerDown(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (holdPointerId !== null) return;
    const deltaBtn = (e.target as HTMLElement | null)?.closest<HTMLButtonElement>('[data-figure-delta]');
    if (!deltaBtn) return;
    // Keep this press from starting a swipe on the drawing.
    e.stopPropagation();
    if (e.cancelable) e.preventDefault();
    const delta = parseInt(deltaBtn.getAttribute('data-figure-delta') || '0', 10);
    if (!delta) return;
    holdPointerId = e.pointerId;
    try {
      deltaBtn.setPointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    notePointerStep();
    stepDelta(delta);
    holdTimer = window.setTimeout(() => {
      holdTimer = null;
      if (holdPointerId === null) return;
      notePointerStep();
      stepDelta(delta);
      holdRepeat = window.setInterval(() => {
        if (holdPointerId === null) {
          stopHold();
          return;
        }
        notePointerStep();
        stepDelta(delta);
      }, holdIntervalMs);
    }, holdDelayMs);
  }

  function onDeltaPointerEnd(e: PointerEvent) {
    if (holdPointerId === null || e.pointerId !== holdPointerId) return;
    stopHold();
  }

  function onDeltaContextMenu(e: Event) {
    const target = e.target as HTMLElement | null;
    if (!target?.closest('[data-figure-delta]')) return;
    e.preventDefault();
  }

  card.addEventListener('click', onClick);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  stage.addEventListener('pointerdown', onDeltaPointerDown);
  stage.addEventListener('pointerup', onDeltaPointerEnd);
  stage.addEventListener('pointercancel', onDeltaPointerEnd);
  stage.addEventListener('lostpointercapture', onDeltaPointerEnd);
  stage.addEventListener('contextmenu', onDeltaContextMenu);

  if (document.readyState === 'complete') {
    watchIntroVisibility();
  } else {
    window.addEventListener('load', onWindowLoad);
  }

  return () => {
    card.removeEventListener('click', onClick);
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('pointercancel', onPointerCancel);
    stage.removeEventListener('pointerdown', onDeltaPointerDown);
    stage.removeEventListener('pointerup', onDeltaPointerEnd);
    stage.removeEventListener('pointercancel', onDeltaPointerEnd);
    stage.removeEventListener('lostpointercapture', onDeltaPointerEnd);
    stage.removeEventListener('contextmenu', onDeltaContextMenu);
    window.removeEventListener('load', onWindowLoad);
    introObserver?.disconnect();
    introObserver = null;
    stopHold();
    clearTimers();
  };
}
