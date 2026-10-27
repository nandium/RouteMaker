import { useEffect, useState } from '@lynx-js/react';

import { api } from '../../../api.js';
import type { AuthSession, User } from '../../../client-contract.js';
import { session } from '../../../host.js';
import { ApiError } from '../../../http.js';
import type { AppContextValue } from '../app-context.js';

const EXPIRED = 'Your saved session expired. Sign in again to continue.';
const RESTORE_FAILED = 'Could not restore your session. Check your connection.';

type State = {
  token: string | null;
  user: User | null;
  /** False until the host's saved session has been read and, if there is one, confirmed. */
  ready: boolean;
};

/** The signed-in account. A saved session survives network failures; only a 401 ends it. */
export function useSession(notify: AppContextValue['notify']) {
  const [state, setState] = useState<State>({ token: null, user: null, ready: false });

  // Confirms a saved token with the server. A network failure keeps the token (so a retry
  // can succeed) but leaves the visitor a guest until it does.
  const confirm = async (token: string) => {
    'background only';
    try {
      setState({ token, user: await api.me(token), ready: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        session.clear();
        setState({ token: null, user: null, ready: true });
      } else {
        setState({ token, user: null, ready: true });
        notify('error', RESTORE_FAILED, () => void confirm(token));
      }
    }
  };

  useEffect(() => {
    void session.load().then((token) => {
      if (token) void confirm(token);
      else setState({ token: null, user: null, ready: true });
    });
  }, []);

  const signOut = () => {
    session.clear();
    setState({ token: null, user: null, ready: true });
  };

  return {
    auth: state.token && state.user ? { token: state.token, user: state.user } : null,
    ready: state.ready,
    signIn({ token, user }: AuthSession) {
      session.save(token);
      setState({ token, user, ready: true });
    },
    signOut,
    setUser: (user: User) => setState((current) => ({ ...current, user })),
    sessionExpired(error: unknown) {
      'background only';
      if (!(error instanceof ApiError && error.status === 401 && state.token)) return false;
      signOut();
      notify('error', EXPIRED);
      return true;
    },
  };
}
