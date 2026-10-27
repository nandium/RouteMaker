import { fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library';
import { expect, test, vi } from 'vitest';

import { ApiError } from '../../../http.js';
import { type AppContextValue, AppContext } from '../app-context.js';
import { useLoad } from '../hooks/useLoad.js';
import { settle } from './helpers.js';

const stubApp = (sessionExpired: AppContextValue['sessionExpired']): AppContextValue => ({
  colorScheme: 'light',
  themePreference: 'system',
  setThemePreference: vi.fn(),
  wideLayout: false,
  fontScale: 1,
  reducedMotion: false,
  auth: null,
  signIn: vi.fn(),
  signOut: vi.fn(),
  setUser: vi.fn(),
  sessionExpired,
  go: vi.fn(),
  back: vi.fn(),
  notify: vi.fn(),
  working: false,
  run: vi.fn(),
  openSheet: vi.fn(),
  closeSheet: vi.fn(),
  openInBrowser: vi.fn(),
});

function Probe({ id, load }: { id: string; load: (id: string) => Promise<string> }) {
  const state = useLoad(() => load(id), [id]);
  return (
    <view>
      <text>
        {state.status === 'ready'
          ? state.data
          : state.status === 'error'
            ? `error: ${state.message}`
            : 'loading'}
      </text>
      <view bindtap={state.reload} aria-label="reload" />
    </view>
  );
}

function mount(app: AppContextValue, id: string, load: (id: string) => Promise<string>) {
  const ui = (value: string) => (
    <AppContext.Provider value={app}>
      <Probe id={value} load={load} />
    </AppContext.Provider>
  );
  const view = render(ui(id));
  return {
    queries: getQueriesForElement(elementTree.root!),
    change: (value: string) => view.rerender(ui(value)),
  };
}

test('ignores a response that arrives after its inputs changed', async () => {
  const pending: Record<string, (value: string) => void> = {};
  const load = (id: string) => new Promise<string>((resolve) => (pending[id] = resolve));
  const { queries, change } = mount(
    stubApp(() => false),
    'a',
    load
  );

  change('b');
  pending.b('second');
  expect(await queries.findByText('second')).toBeInTheDocument();
  pending.a('first');
  await settle();

  expect(queries.getByText('second')).toBeInTheDocument();
});

test('reports a failure and lets the session policy see it', async () => {
  const sessionExpired = vi.fn(() => false);
  const failure = new ApiError('offline', 503);
  const { queries } = mount(stubApp(sessionExpired), 'a', () => Promise.reject(failure));

  expect(await queries.findByText('error: offline')).toBeInTheDocument();
  expect(sessionExpired).toHaveBeenCalledWith(failure);
});

test('keeps the data on screen while it reloads, and replaces it when the new data arrives', async () => {
  let answer: (value: string) => void = () => {};
  let calls = 0;
  const load = () =>
    ++calls === 1 ? Promise.resolve('first') : new Promise<string>((resolve) => (answer = resolve));
  const { queries } = mount(
    stubApp(() => false),
    'a',
    load
  );
  expect(await queries.findByText('first')).toBeInTheDocument();

  fireEvent.tap(queries.getByLabelText('reload'));
  await settle();
  expect(queries.getByText('first')).toBeInTheDocument();

  answer('second');
  expect(await queries.findByText('second')).toBeInTheDocument();
});

test('shows loading again when a failed load is retried', async () => {
  let answer: (value: string) => void = () => {};
  let calls = 0;
  const load = () =>
    ++calls === 1
      ? Promise.reject(new ApiError('offline', 503))
      : new Promise<string>((resolve) => (answer = resolve));
  const { queries } = mount(
    stubApp(() => false),
    'a',
    load
  );
  expect(await queries.findByText('error: offline')).toBeInTheDocument();

  fireEvent.tap(queries.getByLabelText('reload'));

  expect(await queries.findByText('loading')).toBeInTheDocument();
  answer('recovered');
  expect(await queries.findByText('recovered')).toBeInTheDocument();
});
