import { useEffect, useRef, useState } from '@lynx-js/react';

import { errorMessage } from '../../../http.js';
import { useApp } from '../app-context.js';

type State<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

export type Load<T> = State<T> & {
  /** Loads again. Data already on screen stays until the new data replaces it. */
  reload(): void;
  /** Changes loaded data in place, e.g. after a mutation. Ignored until the data is ready. */
  update(change: (data: T) => T): void;
};

/** Runs `load` on mount and whenever `deps` change; responses to superseded loads are dropped. */
export function useLoad<T>(load: () => Promise<T>, deps: readonly unknown[]): Load<T> {
  const { sessionExpired } = useApp();
  const [state, setState] = useState<State<T>>({ status: 'loading' });
  // Numbers the requests so that only the newest one may answer.
  const newest = useRef(0);

  const fetchData = () => {
    const request = ++newest.current;
    load().then(
      (data) => request === newest.current && setState({ status: 'ready', data }),
      (error) => {
        if (request !== newest.current) return;
        sessionExpired(error);
        // A failed refresh keeps the data already shown.
        setState((previous) =>
          previous.status === 'ready' ? previous : { status: 'error', message: errorMessage(error) }
        );
      }
    );
  };

  useEffect(() => {
    setState((previous) => (previous.status === 'loading' ? previous : { status: 'loading' }));
    fetchData();
    return () => {
      newest.current++;
    };
  }, deps);

  return {
    ...state,
    reload() {
      setState((previous) => (previous.status === 'ready' ? previous : { status: 'loading' }));
      fetchData();
    },
    update: (change) =>
      setState((previous) =>
        previous.status === 'ready' ? { status: 'ready', data: change(previous.data) } : previous
      ),
  };
}
