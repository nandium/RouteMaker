import { createRequire } from 'node:module';
import { vi } from 'vitest';

type DomWindow = Window & typeof globalThis;
const { JSDOM } = createRequire(import.meta.url)('jsdom') as {
  JSDOM: new (html?: string, options?: { url?: string }) => { window: DomWindow };
};

const GLOBALS = [
  'window',
  // Vite rewrites `new URL(..., import.meta.url)` to resolve against `self.location`.
  'self',
  'document',
  'location',
  'history',
  'localStorage',
  'navigator',
  'customElements',
  'getComputedStyle',
  'DOMException',
  'Node',
  'Element',
  'HTMLElement',
  'Event',
  'CustomEvent',
  'KeyboardEvent',
  'MouseEvent',
  'SubmitEvent',
  'Blob',
  'File',
  'FormData',
  'Option',
  'MutationObserver',
] as const;

/**
 * Browser code runs against jsdom, installed as globals per test. A per-file
 * `// @vitest-environment jsdom` docblock does not work: the Lynx vitest plugin runs its own
 * setup first and fails with "lynx is not defined". Call `vi.unstubAllGlobals()` afterwards.
 */
let previous: DomWindow | undefined;

export function installDom(url = 'http://localhost/') {
  // The last test's window is closed, so its timers cannot fire into this one.
  previous?.close();
  const { window } = new JSDOM('', { url });
  previous = window;
  for (const name of GLOBALS) vi.stubGlobal(name, window[name]);
  return window;
}

/**
 * jsdom cannot navigate, so `location.reload/assign/replace` become spies while everything else
 * (path, query, hash) still reads the real, history-backed location.
 */
export function stubNavigation() {
  const navigation = { reload: vi.fn(), assign: vi.fn(), replace: vi.fn() };
  const real = window.location;
  vi.stubGlobal(
    'location',
    new Proxy(
      {},
      {
        get(_target, property) {
          if (property in navigation) return navigation[property as keyof typeof navigation];
          const value = Reflect.get(real, property);
          return typeof value === 'function' ? value.bind(real) : value;
        },
      }
    )
  );
  return navigation;
}

/**
 * `matchMedia` whose results the test controls. Queries are matched by substring, so
 * `{ dark: false }` answers `(prefers-color-scheme: dark)`.
 */
export function stubMatchMedia(initial: Record<string, boolean>) {
  const state = new Map(Object.entries(initial));
  const lists = new Map<string, { matches: boolean; listeners: Set<() => void> }>();
  const keyFor = (query: string) => [...state.keys()].find((key) => query.includes(key)) ?? query;
  vi.stubGlobal('matchMedia', (query: string) => {
    const key = keyFor(query);
    const entry = lists.get(key) ?? { matches: false, listeners: new Set<() => void>() };
    entry.matches = state.get(key) ?? false;
    lists.set(key, entry);
    return {
      get matches() {
        return entry.matches;
      },
      addEventListener: (_type: string, listener: () => void) => entry.listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        entry.listeners.delete(listener),
    };
  });
  return {
    set(key: string, matches: boolean) {
      state.set(key, matches);
      const entry = lists.get(key);
      if (!entry) return;
      entry.matches = matches;
      entry.listeners.forEach((listener) => listener());
    },
  };
}

type StubImage = {
  onload?: () => void;
  onerror?: () => void;
  naturalWidth: number;
  naturalHeight: number;
  src: string;
};

/**
 * `Image` that never loads by itself. The test settles the most recent one: `load` reports the
 * natural size, `fail` an unreadable file.
 */
export function stubImage() {
  const images: StubImage[] = [];
  vi.stubGlobal(
    'Image',
    class implements StubImage {
      onload?: () => void;
      onerror?: () => void;
      naturalWidth = 0;
      naturalHeight = 0;
      src = '';
      constructor() {
        images.push(this);
      }
    }
  );
  return {
    images,
    load(size = { width: 1600, height: 960 }) {
      const image = images.at(-1)!;
      image.naturalWidth = size.width;
      image.naturalHeight = size.height;
      image.onload?.();
    },
    fail: () => images.at(-1)!.onerror?.(),
  };
}

/** A `ResizeObserver` the test fires by hand. */
export function stubResizeObserver() {
  const callbacks = new Set<() => void>();
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        callbacks.add(callback);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  return { fire: () => callbacks.forEach((callback) => callback()) };
}

/**
 * Promise flush for chained awaits inside handlers. It keeps the real `setTimeout`, so it still
 * works in a test that has faked the clock.
 */
const realSetTimeout = setTimeout;
export const settle = () => new Promise<void>((resolve) => realSetTimeout(resolve));

const ROLE_SELECTORS: Record<string, string> = {
  button: 'button:not([role]), [role="button"]',
  switch: '[role="switch"]',
  radio: 'input[type="radio"]',
  link: 'a[href]',
  textbox: 'input:not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea',
  combobox: 'select',
  status: '[role="status"]',
  alert: '[role="alert"]',
  group: '[role="group"]',
  dialog: '[role="dialog"]',
  region: '[role="region"]',
  search: '[role="search"]',
  navigation: 'nav',
  img: 'img',
  heading: 'h1, h2, h3',
};

/**
 * aria-label, else the label that names the control (by `for`, or wrapping it), else the
 * element's own text.
 */
function accessibleName(node: Element) {
  const label = node.getAttribute('aria-label');
  if (label) return label;
  if (node.tagName !== 'BUTTON') {
    const named =
      (node.id && node.ownerDocument.querySelector(`label[for="${node.id}"]`)) ||
      node.closest('label');
    if (named) return (named.querySelector('span')?.textContent ?? named.textContent)?.trim() ?? '';
  }
  return node.textContent?.trim() ?? '';
}

const matchesName = (node: Element, name?: string | RegExp) => {
  if (name === undefined) return true;
  const actual = accessibleName(node);
  return typeof name === 'string' ? actual === name : name.test(actual);
};

/**
 * Every element with the ARIA role (and accessible name, when given), as a user would find it:
 * nothing that is, or sits inside, a `hidden` element.
 */
export function allByRole<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  role: string,
  name?: string | RegExp
) {
  return [...root.querySelectorAll<T>(ROLE_SELECTORS[role])].filter(
    (node) => !node.closest('[hidden]') && matchesName(node, name)
  );
}

/** The one element with the role and name; throws unless exactly one matches. */
export function byRole<T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  role: string,
  name?: string | RegExp
) {
  const matches = allByRole<T>(root, role, name);
  if (matches.length !== 1) {
    throw new Error(`Expected one ${role} named ${String(name)}, found ${matches.length}.`);
  }
  return matches[0];
}

export const queryByRole = <T extends HTMLElement = HTMLElement>(
  root: ParentNode,
  role: string,
  name?: string | RegExp
) => allByRole<T>(root, role, name)[0] ?? null;

/** The first status message showing, whether it announces progress or an error. */
export const statusLine = (root: ParentNode) =>
  root.querySelector<HTMLElement>('.status:not([hidden])')!;

/** The first visible element with text of its own that matches (not one inside a hidden part). */
export function queryByText(root: ParentNode, text: string | RegExp) {
  const matches = (value: string) =>
    typeof text === 'string' ? value.includes(text) : text.test(value);
  return (
    [...root.querySelectorAll<HTMLElement>('*')].find(
      (node) =>
        !node.closest('[hidden]') &&
        [...node.childNodes].some(
          (child) => child.nodeType === 3 && matches(child.textContent ?? '')
        )
    ) ?? null
  );
}

/** The text of `node` as it shows: nothing from a `hidden` part. */
export function visibleText(node: Node): string {
  if (node.nodeType === 3) return node.textContent ?? '';
  if (node instanceof Element && node.hasAttribute('hidden')) return '';
  return [...node.childNodes].map(visibleText).join('');
}
