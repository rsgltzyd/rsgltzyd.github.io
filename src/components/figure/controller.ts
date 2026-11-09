import { FIGURE_SCENES, type FigureScene } from './scenes';

export function initFigure(card: HTMLElement): () => void {
  const svg = card.querySelector<SVGSVGElement>('[data-figure-svg]');
  const pathsGroup = card.querySelector<SVGGElement>('[data-figure-paths]');
  const caption = card.querySelector<HTMLElement>('[data-figure-caption]');
  const buttons = card.querySelectorAll<HTMLButtonElement>('[data-scene]');
  const deltaButtons = card.querySelectorAll<HTMLButtonElement>('[data-figure-delta]');

  if (!svg || !pathsGroup || !caption) return () => {};

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
    caption.textContent = scene.line;
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

  let touchStartX = 0;
  let touchStartY = 0;

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  }

  function onTouchEnd(e: TouchEvent) {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Horizontal swipe threshold: at least 32px and more horizontal than vertical
    if (Math.abs(dx) > 32 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (dx < 0) {
        // Swipe left -> next scene
        setScene(currentIndex + 1);
      } else {
        // Swipe right -> previous scene
        setScene(currentIndex - 1);
      }
    }
  }

  card.addEventListener('click', onClick);
  card.addEventListener('touchstart', onTouchStart, { passive: true });
  card.addEventListener('touchend', onTouchEnd, { passive: true });

  return () => {
    card.removeEventListener('click', onClick);
    card.removeEventListener('touchstart', onTouchStart);
    card.removeEventListener('touchend', onTouchEnd);
    if (animTimer !== null) clearTimeout(animTimer);
  };
}
