/**
 * Fullscreen is off, native, or inpage. A rejected or missing API
 * becomes inpage and the visible label says 页面内大屏.
 * Entering or leaving does not reset the game.
 */

export type ScreenMode = 'off' | 'native' | 'inpage';

export interface FullscreenHooks {
  frame: HTMLElement;
  button: HTMLButtonElement;
  label: HTMLElement;
  onChange: (mode: ScreenMode) => void;
}

export function bindFullscreen(hooks: FullscreenHooks): () => void {
  const { frame, button, label } = hooks;
  const doc = frame.ownerDocument;
  const view = doc.defaultView;
  if (!view) return () => {};

  let mode: ScreenMode = 'off';
  let scrollY = 0;
  let inerted: HTMLElement[] = [];
  let returnFocus: HTMLElement | null = null;

  const show = (next: ScreenMode) => {
    mode = next;
    frame.classList.toggle('is-inpage', next === 'inpage');
    frame.classList.toggle('is-native', next === 'native');
    frame.setAttribute('aria-modal', next === 'off' ? 'false' : 'true');
    label.hidden = next !== 'inpage';
    button.textContent = next === 'off' ? '全屏' : '退出';
    hooks.onChange(next);
  };

  const releaseInpage = () => {
    inerted.forEach((node) => node.removeAttribute('inert'));
    inerted = [];
    doc.documentElement.style.overflow = '';
    const body = doc.body;
    body.style.position = '';
    body.style.top = '';
    body.style.left = '';
    body.style.right = '';
    body.style.width = '';
    view.scrollTo(0, scrollY);
  };

  const enterInpage = () => {
    scrollY = view.scrollY;
    returnFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const body = doc.body;
    let node: HTMLElement | null = frame;
    while (node && node !== body) {
      const parent: HTMLElement | null = node.parentElement;
      if (!parent) break;
      [...parent.children].forEach((child) => {
        if (child === node || !(child instanceof HTMLElement)) return;
        child.setAttribute('inert', '');
        inerted.push(child);
      });
      node = parent;
    }
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.left = '0';
    body.style.right = '0';
    body.style.width = '100%';
    show('inpage');
    button.focus();
  };

  const exit = async () => {
    if (mode === 'native') {
      try {
        await doc.exitFullscreen();
      } catch {
        return;
      }
      return;
    }
    if (mode === 'inpage') {
      releaseInpage();
      show('off');
      returnFocus?.focus();
    }
  };

  const enter = async () => {
    returnFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    const request = frame.requestFullscreen?.bind(frame);
    if (!request || doc.fullscreenEnabled === false) {
      enterInpage();
      return;
    }
    try {
      await request();
    } catch {
      if (doc.fullscreenElement !== frame) enterInpage();
    }
  };

  const onClick = () => {
    if (mode === 'off') void enter();
    else void exit();
  };

  const onFull = () => {
    if (doc.fullscreenElement === frame) {
      show('native');
      return;
    }
    if (mode === 'native') show('off');
  };

  const onKey = (event: KeyboardEvent) => {
    if (mode !== 'inpage') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      void exit();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...frame.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]')].filter(
      (item) => !item.hasAttribute('disabled'),
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = doc.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  button.addEventListener('click', onClick);
  doc.addEventListener('fullscreenchange', onFull);
  doc.addEventListener('fullscreenerror', () => {
    if (mode === 'off') enterInpage();
  });
  view.addEventListener('keydown', onKey);
  show('off');

  return () => {
    button.removeEventListener('click', onClick);
    doc.removeEventListener('fullscreenchange', onFull);
    view.removeEventListener('keydown', onKey);
    if (mode === 'inpage') releaseInpage();
    if (doc.fullscreenElement === frame) {
      void doc.exitFullscreen().catch(() => {});
    }
  };
}
