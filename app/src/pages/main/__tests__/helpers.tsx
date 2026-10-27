import { fireEvent, getQueriesForElement, render } from '@lynx-js/react/testing-library';
import { expect, vi } from 'vitest';

import { installHost, resetHost } from '../../../__tests__/support.js';
import { App } from '../App.js';
import { type Handlers, account, fakeApi } from './fakeApi.js';

export { installHost, resetHost };
export * from './fakeApi.js';

let rerenderApp = () => {};

function mountApp() {
  rerenderApp = () => rendered.rerender(<App />);
  const rendered = render(<App />);
  return getQueriesForElement(elementTree.root!);
}

/**
 * Starts the app against a fake API (`overrides` change what named endpoints answer).
 *
 * Order matters: set up everything the host provides first (`resetHost`, `sessionStore`,
 * `installHost`), because the app reads it as it mounts, and use `startApp` before the first query.
 */
export function startApp(overrides: Partial<Handlers> = {}) {
  const api = fakeApi(overrides);
  return { api, queries: mountApp() };
}

/** What a host's updateGlobalProps does: merge, then re-render the page. */
export function updateHostProps(props: object) {
  Object.assign(lynx.__globalProps, props);
  rerenderApp();
}

/**
 * Lets pending promises and timers (up to 20ms) run, for asserting that nothing happened. It is
 * a real wait because updates cross the test environment's simulated main and background
 * threads, so a microtask flush can return before a stray one would have landed.
 */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

type Queries = ReturnType<typeof getQueriesForElement>;

/**
 * Taps the closest labelled ancestor of the nth element showing `text`; a negative index counts
 * from the end, which reaches a button that shares its words with a heading or a tab above it.
 */
export async function tapText(queries: Queries, text: string, index = 0) {
  let target = (await queries.findAllByText(text)).at(index);
  while (target && !target.hasAttribute('accessibility-label')) target = target.parentElement!;
  expect(target).toBeTruthy();
  fireEvent.tap(target);
}

/** Taps the element a screen reader would call `label`. */
export async function tapLabel(queries: Queries, label: string) {
  fireEvent.tap(await queries.findByLabelText(label));
}

function inputEvent(name: 'input' | 'confirm', detail: object) {
  const event = new window.Event(`bindEvent:${name}`, { bubbles: true });
  return Object.assign(event, { detail, eventName: name, eventType: 'bindEvent' });
}

// Input events must target the element ref the runtime hands out for the selector.
async function fireOnField(queries: Queries, label: string, event: Event) {
  await queries.findByLabelText(label);
  fireEvent(
    lynx.createSelectorQuery().select(`[aria-label="${label}"]`) as unknown as Element,
    event
  );
}

export const enterField = (queries: Queries, label: string, value: string) =>
  fireOnField(queries, label, inputEvent('input', { value }));

export const confirmField = (queries: Queries, label: string) =>
  fireOnField(queries, label, inputEvent('confirm', {}));

/** The text typed into a labelled field. */
export const fieldValue = (queries: Queries, label: string) =>
  queries.getByLabelText(label).getAttribute('value');

/** Fills in and submits the sign-in form. */
export async function submitCredentials(queries: Queries) {
  await enterField(queries, 'Email', account.email);
  await enterField(queries, 'Password', 'valid-password');
  await tapText(queries, 'Sign in', -1);
}

export async function signIn(queries: Queries) {
  await tapText(queries, 'Guest');
  await submitCredentials(queries);
}

/** Gives the host a saved session, as a returning visitor would have; empty means none. */
export function sessionStore(token = '') {
  const store = { set: vi.fn(), clear: vi.fn() };
  installHost({
    RouteMakerSession: {
      getToken: (callback: (token: string) => void) => callback(token),
      setToken: store.set,
      clearToken: store.clear,
    },
  });
  return store;
}

/** The text of the notice, if one is showing. */
export const notice = () => elementTree.root!.querySelector('.notice-text')?.textContent;

/** Files a report against the route on screen. */
export async function reportRoute(queries: Queries, reason: string) {
  await tapText(queries, 'Report this route');
  await tapText(queries, reason);
  await tapText(queries, 'Send report');
}
