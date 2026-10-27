import type { ReactNode } from '@lynx-js/react';

import { useApp } from '../app-context.js';
import type { Load } from '../hooks/useLoad.js';
import { Button } from './Button.js';
import { State } from './State.js';

/**
 * Shows a load's progress and failure; `children` receives the data once it has arrived.
 * `loading` stands in for the content meanwhile, and `failure` titles the error shown if it fails;
 * a screen the visitor navigated to also offers a way `back` from that error.
 */
export function Async<T>({
  state,
  loading,
  failure,
  back = false,
  children,
}: {
  state: Load<T>;
  loading: ReactNode;
  failure: string;
  back?: boolean;
  children: (data: T) => ReactNode;
}) {
  const app = useApp();
  if (state.status === 'loading') return <>{loading}</>;
  if (state.status === 'error') {
    return (
      <State failed title={failure} body={state.message}>
        <Button size="lg" block icon="refresh" onTap={state.reload}>
          Try again
        </Button>
        {back && (
          <Button kind="secondary" size="lg" block icon="back" onTap={app.back}>
            Back
          </Button>
        )}
      </State>
    );
  }
  return <>{children(state.data)}</>;
}
