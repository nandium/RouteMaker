import { fireEvent } from '@lynx-js/react/testing-library';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { resetHost, sessionStore, startApp, tapLabel } from './helpers.js';

beforeEach(() => resetHost({ initialPage: { name: 'account' } }));
afterEach(() => vi.useRealTimers());

// The testing environment's node references cannot invoke UI methods, so stand in for them.
const testQuery = lynx.createSelectorQuery() as unknown as { selectUniqueID(id: number): object };
const nodeRefs = Object.getPrototypeOf(testQuery.selectUniqueID(0));
const exec = vi.fn();
const invoke = vi.fn(() => ({ exec }));
beforeEach(() => {
  invoke.mockClear();
  exec.mockClear();
  nodeRefs.invoke = invoke;
});

function focusEvent(name: 'focus' | 'blur') {
  const event = new window.Event(`bindEvent:${name}`, { bubbles: true });
  return Object.assign(event, { detail: {}, eventName: name, eventType: 'bindEvent' });
}

async function focus(label: string, queries: Parameters<typeof tapLabel>[0]) {
  await queries.findByLabelText(label);
  fireEvent(
    lynx.createSelectorQuery().select(`[aria-label="${label}"]`) as unknown as Element,
    focusEvent('focus')
  );
}

test('brings a field into view once the keyboard has taken its room', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  vi.useFakeTimers();

  await focus('Display name', queries);
  expect(invoke).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(400);

  expect(invoke).toHaveBeenCalledWith({
    method: 'scrollIntoView',
    params: { scrollIntoViewOptions: { block: 'center', behavior: 'smooth' } },
  });
  expect(exec).toHaveBeenCalledOnce();
});

test('does the same for a field in a sheet', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  await tapLabel(queries, 'Delete account…');
  vi.useFakeTimers();

  await focus('Password', queries);
  await vi.advanceTimersByTimeAsync(400);

  expect(invoke).toHaveBeenCalledOnce();
});

test('rings the field it is typing in, and only that one', async () => {
  sessionStore('saved-token');
  const { queries } = startApp();
  await queries.findByText('Delete account');
  const boxes = () => Array.from(elementTree.root!.querySelectorAll('.input-box'));

  await focus('Display name', queries);

  expect(boxes()[0].className).toContain('is-focus');
  expect(boxes().filter((box) => box.className.includes('is-focus'))).toHaveLength(1);
});
