/**
 * Manual scene index. Previous and next wrap. No timer.
 * Reduced motion sets the stroke immediately and does not queue a replay.
 */

import { FIGURE_SCENES, sceneIndex } from './scenes';

const mounts = new WeakMap<HTMLElement, () => void>();

function prefersReducedMotion(view: Window): MediaQueryList | null {
  try {
    return view.matchMedia('(prefers-reduced-motion: reduce)');
  } catch {
    return null;
  }
}

export function initFigure(root: HTMLElement): () => void {
  const previous = mounts.get(root);
  if (previous) previous();

  const view = root.ownerDocument.defaultView;
  if (!view) return () => {};

  const svg = root.querySelector('[data-figure-svg]');
  const title = root.querySelector('[data-figure-title]');
  const group = root.querySelector('[data-figure-paths]');
  const caption = root.querySelector('[data-figure-caption]');
  if (!(svg instanceof SVGSVGElement) || !title || !(group instanceof SVGGElement) || !caption) {
    return () => {};
  }

  const motion = prefersReducedMotion(view);
  let index = 0;
  let generation = 0;

  const draw = () => {
    const scene = FIGURE_SCENES[index];
    const token = ++generation;
    title.textContent = `${scene.label}。${scene.line}`;
    svg.setAttribute('aria-label', title.textContent);
    caption.textContent = scene.line;
    group.replaceChildren();

    const reduce = motion?.matches === true;
    scene.paths.forEach((d, pathIndex) => {
      const path = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('pathLength', '1');
      path.style.strokeDasharray = '1';
      path.style.strokeDashoffset = reduce ? '0' : '1';
      group.append(path);
      if (reduce) return;
      const animation = path.animate(
        [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }],
        { duration: 560, delay: pathIndex * 36, fill: 'forwards', easing: 'ease-out' },
      );
      animation.onfinish = () => {
        if (generation === token) path.style.strokeDashoffset = '0';
      };
    });

    root.querySelectorAll('button[data-scene]').forEach((button) => {
      const id = button.getAttribute('data-scene');
      button.setAttribute('aria-pressed', id === scene.id ? 'true' : 'false');
    });
  };

  const go = (next: number) => {
    index = (next + FIGURE_SCENES.length) % FIGURE_SCENES.length;
    generation += 1;
    group.querySelectorAll('path').forEach((path) => {
      path.getAnimations().forEach((animation) => animation.cancel());
    });
    draw();
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const delta = target.closest('button[data-figure-delta]');
    if (delta instanceof HTMLButtonElement && root.contains(delta)) {
      go(index + Number(delta.getAttribute('data-figure-delta')));
      return;
    }
    const sceneButton = target.closest('button[data-scene]');
    if (sceneButton instanceof HTMLButtonElement && root.contains(sceneButton)) {
      const id = sceneButton.getAttribute('data-scene');
      if (id) go(sceneIndex(id));
    }
  };

  const onMotion = () => {
    generation += 1;
    group.querySelectorAll('path').forEach((path) => {
      path.getAnimations().forEach((animation) => animation.cancel());
      path.style.strokeDashoffset = motion?.matches ? '0' : path.style.strokeDashoffset;
    });
    if (motion?.matches) {
      group.querySelectorAll('path').forEach((path) => {
        path.style.strokeDashoffset = '0';
      });
    }
  };

  root.addEventListener('click', onClick);
  motion?.addEventListener('change', onMotion);
  draw();

  const cleanup = () => {
    generation += 1;
    root.removeEventListener('click', onClick);
    motion?.removeEventListener('change', onMotion);
    group.querySelectorAll('path').forEach((path) => {
      path.getAnimations().forEach((animation) => animation.cancel());
    });
    if (mounts.get(root) === cleanup) mounts.delete(root);
  };
  mounts.set(root, cleanup);
  return cleanup;
}
