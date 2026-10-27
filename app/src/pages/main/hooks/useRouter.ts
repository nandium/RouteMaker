import { useEffect, useState } from '@lynx-js/react';

import { navigation } from '../../../host.js';
import { type Page, pathOf } from '../../../web-pages.js';

/** `reset` starts a new back stack, as a top-level tab does. */
export type NavMode = 'push' | 'replace' | 'reset';

export const HOME: Page = { name: 'gyms' };

/**
 * The back stack, mirrored to host history. Where the host owns history, Back defers to it.
 * `resolve` may swap a requested page for another the visitor is allowed to see; the swap
 * replaces the page in the stack and in history, and is what `page` returns from the first render.
 */
export function useRouter(initial: Page, resolve: (page: Page) => Page) {
  const [stack, setStack] = useState<Page[]>([initial]);
  const requested = stack[stack.length - 1];
  const page = resolve(requested);

  useEffect(() => {
    if (page === requested) return;
    setStack((pages) => [...pages.slice(0, -1), page]);
    navigation.replace(pathOf(page));
  }, [page, requested]);

  return {
    page,
    canGoBack: stack.length > 1,
    go(next: Page, mode: NavMode = 'push') {
      setStack((pages) =>
        mode === 'push'
          ? [...pages, next]
          : mode === 'replace'
            ? [...pages.slice(0, -1), next]
            : [next]
      );
      (mode === 'replace' ? navigation.replace : navigation.push)(pathOf(next));
    },
    back() {
      if (navigation.back(pathOf(stack[stack.length - 2] ?? HOME))) return;
      setStack((pages) => (pages.length > 1 ? pages.slice(0, -1) : [HOME]));
    },
    /** Takes over a page the host has already navigated to. */
    adopt: (next: Page) => setStack([next]),
  };
}
