/**
 * Theme state. The head anti-flash script in BlogLayout.astro duplicates the
 * key, the three exact mode strings, and the dark fallback. Keep them aligned.
 * theme-color hex values match --paper in global.css.
 */

export const THEME_STORAGE_KEY = 'yl-theme-mode-v1';

export const THEME_MODES = ['light', 'dark', 'auto'] as const;

export type ThemeMode = (typeof THEME_MODES)[number];

export type ResolvedTheme = 'light' | 'dark';

export interface ThemeChangeDetail {
  mode: ThemeMode;
  resolved: ResolvedTheme;
}

const DEFAULT_MODE: ThemeMode = 'dark';

const THEME_COLOR: Record<ResolvedTheme, string> = {
  dark: '#202120',
  light: '#ffffff',
};

const controllers = new WeakMap<Document, () => void>();

let lifecycleBound = false;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'auto';
}

function openStorage(view: Window): Storage | null {
  try {
    return view.localStorage;
  } catch {
    return null;
  }
}

export function readStoredThemeMode(storage: Storage | null): ThemeMode {
  if (!storage) return DEFAULT_MODE;
  try {
    const value = storage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(value) ? value : DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function writeThemeMode(storage: Storage | null, mode: ThemeMode): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

function openColorSchemeQuery(view: Window): MediaQueryList | null {
  try {
    return view.matchMedia('(prefers-color-scheme: dark)');
  } catch {
    return null;
  }
}

function systemPrefersDark(media: MediaQueryList | null): boolean {
  if (!media) return true;
  try {
    return media.matches === true;
  } catch {
    return true;
  }
}

export function resolveTheme(mode: ThemeMode, prefersDark: boolean): ResolvedTheme {
  if (mode === 'auto') return prefersDark ? 'dark' : 'light';
  return mode;
}

function statusText(mode: ThemeMode, resolved: ResolvedTheme, unsaved: boolean): string {
  let label: string;
  if (mode === 'auto') {
    label = resolved === 'dark' ? '自动，当前深色' : '自动，当前浅色';
  } else {
    label = resolved === 'dark' ? '当前深色' : '当前浅色';
  }
  return unsaved ? `${label}，仅本次有效` : label;
}

export function initThemeController(
  doc: Document = document,
  options?: { trustHead?: boolean },
): () => void {
  const view = doc.defaultView;
  if (!view) return () => {};

  const previous = controllers.get(doc);
  if (previous) previous();

  const root = doc.documentElement;
  const storage = openStorage(view);
  const media = openColorSchemeQuery(view);
  const headMode = root.getAttribute('data-theme-mode');
  const trustHead = options?.trustHead !== false;
  // First load keeps the head script's choice so the bundle does not flip it.
  // A bfcache restore re-reads storage: another tab may have changed the key
  // while this document was frozen, and the head script does not run again.
  let mode: ThemeMode = trustHead && isThemeMode(headMode) ? headMode : readStoredThemeMode(storage);
  let unsaved = false;

  const apply = (notify: boolean) => {
    const resolved = resolveTheme(mode, mode === 'auto' ? systemPrefersDark(media) : false);
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-theme-mode', mode);
    root.style.colorScheme = resolved;

    const themeColor = doc.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute('content', THEME_COLOR[resolved]);

    const buttons = doc.querySelectorAll('button[data-theme-choice]');
    buttons.forEach((button) => {
      const choice = button.getAttribute('data-theme-choice');
      button.setAttribute('aria-pressed', choice === mode ? 'true' : 'false');
    });

    const status = doc.querySelector('[data-theme-status]');
    if (status) status.textContent = statusText(mode, resolved, unsaved);

    if (notify) {
      root.dispatchEvent(
        new CustomEvent<ThemeChangeDetail>('themechange', {
          bubbles: true,
          detail: { mode, resolved },
        }),
      );
    }
  };

  const onSystemChange = () => {
    if (mode !== 'auto') return;
    apply(true);
  };

  const onStorage = (event: StorageEvent) => {
    if (event.storageArea && storage && event.storageArea !== storage) return;
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    mode = isThemeMode(event.newValue) ? event.newValue : DEFAULT_MODE;
    unsaved = false;
    apply(true);
  };

  const onClick = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button[data-theme-choice]');
    if (!(button instanceof HTMLButtonElement) || !doc.contains(button)) return;
    const choice = button.getAttribute('data-theme-choice');
    if (!isThemeMode(choice)) return;
    mode = choice;
    unsaved = !writeThemeMode(storage, mode);
    apply(true);
  };

  if (media) media.addEventListener('change', onSystemChange);
  view.addEventListener('storage', onStorage);
  doc.addEventListener('click', onClick);

  const cleanup = () => {
    if (media) media.removeEventListener('change', onSystemChange);
    view.removeEventListener('storage', onStorage);
    doc.removeEventListener('click', onClick);
    if (controllers.get(doc) === cleanup) controllers.delete(doc);
  };

  controllers.set(doc, cleanup);
  apply(true);

  if (!lifecycleBound) {
    lifecycleBound = true;
    view.addEventListener('pagehide', () => {
      controllers.get(doc)?.();
    });
    view.addEventListener('pageshow', (event) => {
      if (event.persisted) initThemeController(doc, { trustHead: false });
    });
  }

  return cleanup;
}
