import { FIGURE_SCENES } from './scenes';

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

  function setScene(index: number) {
    currentIndex = (index + FIGURE_SCENES.length) % FIGURE_SCENES.length;
    const scene = FIGURE_SCENES[currentIndex];

    // Update buttons
    buttons.forEach((btn) => {
      const isCurrent = btn.getAttribute('data-scene') === scene.id;
      btn.setAttribute('aria-pressed', isCurrent ? 'true' : 'false');
    });

    // Update caption and svg aria
    caption.textContent = `“${scene.line}”`;
    svg.setAttribute('aria-label', `简笔画：${scene.label}`);

    // Rebuild paths with stroke animation
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;

    pathsGroup.innerHTML = scene.paths
      .map((d, i) => {
        const delay = prefersReduced ? '0s' : `${(i * 0.05).toFixed(2)}s`;
        const transition = prefersReduced ? 'none' : `stroke-dashoffset 0.5s ease ${delay}`;
        return `<path d="${d}" pathLength="1" style="stroke-dasharray: 1; stroke-dashoffset: 1; transition: ${transition};" />`;
      })
      .join('');

    if (animTimer !== null) clearTimeout(animTimer);
    animTimer = window.setTimeout(() => {
      const renderedPaths = pathsGroup.querySelectorAll<SVGPathElement>('path');
      renderedPaths.forEach((p) => {
        p.style.strokeDashoffset = '0';
      });
    }, 30);
  }

  function onClick(e: MouseEvent) {
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const sceneBtn = target.closest<HTMLButtonElement>('[data-scene]');
    if (sceneBtn) {
      const id = sceneBtn.getAttribute('data-scene');
      const idx = FIGURE_SCENES.findIndex((s) => s.id === id);
      if (idx !== -1) setScene(idx);
      return;
    }

    const deltaBtn = target.closest<HTMLButtonElement>('[data-figure-delta]');
    if (deltaBtn) {
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

  return () => {
    card.removeEventListener('click', onClick);
    stage.removeEventListener('pointerdown', onPointerDown);
    stage.removeEventListener('pointerup', onPointerUp);
    stage.removeEventListener('pointercancel', onPointerCancel);
    stage.removeEventListener('pointerdown', onDeltaPointerDown);
    if (animTimer !== null) clearTimeout(animTimer);
  };
}
