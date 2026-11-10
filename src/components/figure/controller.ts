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
  let introPlayed = false;
  let userInteracted = false;
  let introObserver: IntersectionObserver | null = null;

  function clearTimers() {
    if (animTimer !== null) {
      clearTimeout(animTimer);
      animTimer = null;
    }
    if (liveTimer !== null) {
      clearTimeout(liveTimer);
      liveTimer = null;
    }
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
      markInteracted();
      const delta = parseInt(deltaBtn.getAttribute('data-figure-delta') || '0', 10);
      setScene(currentIndex + delta);
    }
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

  function onDeltaPointerDown(e: Event) {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-figure-delta]')) e.stopPropagation();
  }

  card.addEventListener('click', onClick);
  stage.addEventListener('pointerdown', onPointerDown);
  stage.addEventListener('pointerup', onPointerUp);
  stage.addEventListener('pointercancel', onPointerCancel);
  stage.addEventListener('pointerdown', onDeltaPointerDown);

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
    window.removeEventListener('load', onWindowLoad);
    introObserver?.disconnect();
    introObserver = null;
    clearTimers();
  };
}
