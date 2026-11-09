/**
 * Game modal floating window controller.
 * Replaces native fullscreen with a centered floating modal window:
 * - Contains only the current game frame
 * - Site masthead remains visible above the backdrop
 * - Dismissible via Esc, backdrop click, or close button
 */

export type ScreenMode = 'off' | 'modal';

export interface FullscreenHooks {
  frame: HTMLElement;
  button: HTMLButtonElement;
  closeBtn?: HTMLButtonElement | null;
  backdrop?: HTMLElement | null;
  label?: HTMLElement | null;
  onChange: (mode: ScreenMode) => void;
}

export function bindFullscreen(hooks: FullscreenHooks): () => void {
  const { frame, button, closeBtn, backdrop, label } = hooks;
  const doc = frame.ownerDocument;
  const view = doc.defaultView;
  if (!view) return () => {};

  let mode: ScreenMode = 'off';
  let returnFocus: HTMLElement | null = null;

  const show = (next: ScreenMode) => {
    mode = next;
    const isModal = next === 'modal';
    frame.classList.toggle('is-modal', isModal);
    frame.setAttribute('aria-modal', isModal ? 'true' : 'false');
    if (label) label.hidden = !isModal;
    if (backdrop) backdrop.hidden = !isModal;
    button.setAttribute('aria-expanded', isModal ? 'true' : 'false');
    button.setAttribute('title', isModal ? '退出浮层窗口 (Esc)' : '居中浮层窗口');
    hooks.onChange(next);
  };

  const exitModal = () => {
    if (mode === 'off') return;
    doc.body.style.overflow = '';
    show('off');
    returnFocus?.focus();
  };

  const enterModal = () => {
    returnFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
    doc.body.style.overflow = 'hidden';
    show('modal');
    frame.focus();
  };

  const onToggle = () => {
    if (mode === 'off') enterModal();
    else exitModal();
  };

  const onKey = (event: KeyboardEvent) => {
    if (mode !== 'modal') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      exitModal();
      return;
    }
    if (event.key !== 'Tab') return;

    const items = [...frame.querySelectorAll<HTMLElement>('button, [href], [tabindex="0"]')].filter(
      (item) => !item.hasAttribute('disabled') && !item.hasAttribute('hidden'),
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

  button.addEventListener('click', onToggle);
  backdrop?.addEventListener('click', exitModal);
  closeBtn?.addEventListener('click', exitModal);
  view.addEventListener('keydown', onKey);

  show('off');

  return () => {
    button.removeEventListener('click', onToggle);
    backdrop?.removeEventListener('click', exitModal);
    closeBtn?.removeEventListener('click', exitModal);
    view.removeEventListener('keydown', onKey);
    doc.body.style.overflow = '';
    frame.classList.remove('is-modal');
  };
}
