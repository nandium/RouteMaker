import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allByRole, byRole, installDom, queryByRole } from '../test-dom.js';
import { createPreviewLayer } from './preview-layer.js';
import { type Annotation, routeLabels } from './route-annotations.js';

let size = { width: 1000, height: 600 };

const rect = (width: number, height: number) =>
  ({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height }) as DOMRect;

const hold = (
  overrides: Partial<Annotation> = {},
  tapes = { start: 0, finish: 0 }
): Annotation => ({
  x: 0.4,
  y: 0.4,
  width: 0.1,
  height: 0.1,
  use: 'any',
  order: 1,
  tapes,
  ...overrides,
});

function mount() {
  const handlers = {
    onActivateHold: vi.fn(),
    onRemoveTape: vi.fn(),
    onAddAt: vi.fn(),
    onAddBox: vi.fn(),
  };
  const layer = createPreviewLayer(handlers);
  const preview = layer.element;
  preview.getBoundingClientRect = () => rect(size.width, size.height);
  layer.show('blob:photo', { width: 1000, height: 600 });
  document.body.append(preview);
  return {
    preview,
    handlers,
    layer,
    draw: (annotations: Annotation[]) => layer.draw(annotations, routeLabels(annotations, true)),
    holdButton: (name: string | RegExp) => byRole<HTMLButtonElement>(preview, 'button', name),
    key: (key: string, init: KeyboardEventInit = {}) =>
      preview.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...init })),
    pointer: (type: string, x: number, y: number, pointerType = 'mouse') => {
      const event = new window.MouseEvent(type, {
        bubbles: true,
        button: 0,
        clientX: x,
        clientY: y,
      });
      Object.defineProperty(event, 'pointerType', { value: pointerType });
      preview.dispatchEvent(event);
    },
  };
}

describe('preview layer', () => {
  beforeEach(() => {
    installDom();
    size = { width: 1000, height: 600 };
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('the photo', () => {
    it('is a labelled, focusable group that starts hidden', () => {
      const preview = createPreviewLayer({
        onActivateHold: vi.fn(),
        onRemoveTape: vi.fn(),
        onAddAt: vi.fn(),
        onAddBox: vi.fn(),
      }).element;

      expect(preview.hidden).toBe(true);
      expect(preview.getAttribute('role')).toBe('group');
      expect(preview.getAttribute('aria-label')).toContain('arrow keys');
      expect(preview.tabIndex).toBe(0);
    });

    it('shows a photo at its own aspect ratio and takes it away again', () => {
      const { layer, preview } = mount();
      const image = preview.querySelector('img')!;
      layer.show('blob:other', { width: 1600, height: 960 });

      expect(preview.hidden).toBe(false);
      expect(preview.style.aspectRatio).toBe('1600 / 960');
      expect(image.getAttribute('src')).toBe('blob:other');

      layer.hide();

      expect(preview.hidden).toBe(true);
      expect(image.hasAttribute('src')).toBe(false);
    });

    it('ignores the wall while hidden', () => {
      const { layer, handlers, key, preview } = mount();
      layer.hide();
      preview.focus();

      key('Enter');

      expect(handlers.onAddAt).not.toHaveBeenCalled();
    });
  });

  describe('bare wall', () => {
    it('moves a keyboard cursor and adds a boundary where it stops', () => {
      const { preview, handlers, key } = mount();
      preview.focus();

      key('ArrowRight');
      key('ArrowDown');
      key('Enter');

      expect(handlers.onAddAt).toHaveBeenCalledOnce();
      expect(handlers.onAddAt.mock.calls[0][0]).toBeCloseTo(0.52);
      expect(handlers.onAddAt.mock.calls[0][1]).toBeCloseTo(0.52);
    });

    it('takes bigger keyboard steps with shift and stays inside the photo', () => {
      const { handlers, key } = mount();

      for (let press = 0; press < 20; press += 1) key('ArrowLeft', { shiftKey: true });
      key(' ');

      expect(handlers.onAddAt).toHaveBeenCalledWith(0, 0.5);
    });

    it('turns a tap into a standard boundary, once', () => {
      const { preview, handlers, pointer } = mount();

      pointer('pointerdown', 300, 150);
      pointer('pointerup', 300, 150);
      preview.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 300, clientY: 150, detail: 1 })
      );

      expect(handlers.onAddAt).toHaveBeenCalledOnce();
      expect(handlers.onAddAt).toHaveBeenCalledWith(0.3, 0.25);
    });

    it('turns a drag into an exact box', () => {
      const { handlers, pointer } = mount();

      pointer('pointerdown', 100, 120);
      pointer('pointermove', 320, 260);
      pointer('pointerup', 320, 260);

      expect(handlers.onAddBox).toHaveBeenCalledWith(0.1, 0.2, 0.32, 260 / 600);
      expect(handlers.onAddAt).not.toHaveBeenCalled();
    });

    it('lets a click that no pointer produced add a boundary too', () => {
      const { preview, handlers } = mount();

      preview.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 500, clientY: 300, detail: 0 })
      );

      expect(handlers.onAddAt).toHaveBeenCalledWith(0.5, 0.5);
    });

    it('does not start a drag when dragging is switched off', () => {
      const { layer, handlers, pointer } = mount();
      layer.setDragEnabled(false);

      pointer('pointerdown', 100, 120);
      pointer('pointerup', 320, 260);

      expect(handlers.onAddBox).not.toHaveBeenCalled();
    });
  });

  describe('a tap', () => {
    it('goes to the nearest hold, as a click does', () => {
      const { draw, handlers, pointer, preview } = mount();
      const annotation = hold({ x: 0, y: 0, width: 0.005, height: 0.005 });
      draw([annotation]);

      pointer('pointerdown', 30, 30);
      pointer('pointerup', 30, 30);
      preview.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30, detail: 1 })
      );

      expect(handlers.onActivateHold).toHaveBeenCalledExactlyOnceWith(annotation);
      expect(handlers.onAddAt).not.toHaveBeenCalled();
    });

    it('adds a boundary only where there is bare wall', () => {
      const { draw, handlers, pointer } = mount();
      draw([hold({ x: 0, y: 0, width: 0.005, height: 0.005 })]);

      pointer('pointerdown', 600, 400);
      pointer('pointerup', 600, 400);

      expect(handlers.onAddAt).toHaveBeenCalledExactlyOnceWith(0.6, 400 / 600);
      expect(handlers.onActivateHold).not.toHaveBeenCalled();
    });
  });

  describe('touch', () => {
    // A little longer than a finger must rest before it starts drawing.
    const REST_MS = 300;
    beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }));
    afterEach(() => vi.useRealTimers());

    it('starts a box only after the finger has rested, so a swipe can scroll the page', () => {
      const { handlers, pointer, preview } = mount();

      pointer('pointerdown', 100, 120, 'touch');
      expect(preview.querySelector<HTMLElement>('.stage__draft')!.hidden).toBe(true);
      vi.advanceTimersByTime(REST_MS);
      pointer('pointermove', 320, 260, 'touch');
      pointer('pointerup', 320, 260, 'touch');

      expect(handlers.onAddBox).toHaveBeenCalledWith(0.1, 0.2, 0.32, 260 / 600);
    });

    it('does not draw when the finger moves before it has rested', () => {
      const { handlers, pointer } = mount();

      pointer('pointerdown', 100, 120, 'touch');
      pointer('pointermove', 100, 180, 'touch');
      vi.advanceTimersByTime(REST_MS);
      pointer('pointerup', 100, 200, 'touch');

      expect(handlers.onAddBox).not.toHaveBeenCalled();
      expect(handlers.onAddAt).not.toHaveBeenCalled();
    });

    it('leaves a tap to the click that follows it', () => {
      const { handlers, pointer, preview } = mount();

      pointer('pointerdown', 300, 150, 'touch');
      pointer('pointerup', 300, 150, 'touch');
      expect(handlers.onAddAt).not.toHaveBeenCalled();
      preview.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 300, clientY: 150, detail: 1 })
      );

      expect(handlers.onAddAt).toHaveBeenCalledExactlyOnceWith(0.3, 0.25);
    });

    it('stops the page scrolling while a box is being drawn, and only then', () => {
      const { pointer, preview } = mount();
      const move = () => {
        const event = new window.Event('touchmove', { bubbles: true, cancelable: true });
        preview.dispatchEvent(event);
        return event.defaultPrevented;
      };

      pointer('pointerdown', 100, 120, 'touch');
      expect(move()).toBe(false);
      vi.advanceTimersByTime(REST_MS);
      expect(move()).toBe(true);
      pointer('pointerup', 300, 300, 'touch');
      expect(move()).toBe(false);
    });

    it('draws at once with a mouse', () => {
      const { handlers, pointer } = mount();

      pointer('pointerdown', 100, 120, 'mouse');
      pointer('pointerup', 320, 260, 'mouse');

      expect(handlers.onAddBox).toHaveBeenCalledOnce();
    });
  });

  describe('holds', () => {
    it('names each boundary by its limb, marker and tape', () => {
      const { draw, preview } = mount();

      draw([
        hold({ use: 'hand' }, { start: 2, finish: 0 }),
        hold({ x: 0.1, use: null, order: null }),
      ]);

      expect(allByRole(preview, 'button').map((node) => node.getAttribute('aria-label'))).toEqual([
        'Hand only route hold, marker 1, 2 start tapes',
        'Remove one of 2 start tape strips on Hand only hold, marker 1',
        'Detected hold 2 of 2, not selected',
      ]);
      expect(byRole(preview, 'button', /^Detected hold/).getAttribute('aria-pressed')).toBe(
        'false'
      );
    });

    it('activates a hold from the keyboard', () => {
      const { draw, holdButton, handlers } = mount();
      const annotation = hold();
      draw([annotation]);

      holdButton(/route hold/).dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, detail: 0 })
      );

      expect(handlers.onActivateHold).toHaveBeenCalledWith(annotation);
    });

    it('places each button on its boundary, in percent of the photo', () => {
      const { draw, holdButton } = mount();
      draw([hold({ x: 0.2, y: 0.5, width: 0.1, height: 0.04 })]);

      const { style } = holdButton(/route hold/);

      expect([style.left, style.top, style.width, style.height]).toEqual([
        '25%',
        '52%',
        '10%',
        '4%',
      ]);
    });

    it('draws the markings over the photo, in the size the photo will be published at', () => {
      const { draw, layer, preview } = mount();
      layer.show('blob:big', { width: 3200, height: 1600 });

      draw([hold({ use: 'hand' })]);

      const marks = preview.querySelector('svg')!;
      expect(marks.getAttribute('viewBox')).toBe('0 0 1600 800');
      expect(marks.querySelectorAll('circle')).toHaveLength(2);
      expect(marks.querySelector('text')!.textContent).toBe('1');
    });

    it('lets a tap near a tiny boundary reach it, even at the photo edge', () => {
      const { draw, holdButton, handlers } = mount();
      const annotation = hold({ x: 0, y: 0, width: 0.005, height: 0.005 });
      draw([annotation]);

      holdButton(/route hold/).dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 30, clientY: 30, detail: 1 })
      );
      expect(handlers.onActivateHold).toHaveBeenCalledWith(annotation);

      holdButton(/route hold/).dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 60, clientY: 30, detail: 1 })
      );
      expect(handlers.onAddAt).toHaveBeenCalledOnce();
    });

    it('redraws without moving focus away from the hold being edited', () => {
      const { draw, preview, layer } = mount();
      const annotation = hold();
      draw([annotation]);

      layer.draw([annotation], routeLabels([annotation], true), { annotation });

      expect(document.activeElement).toBe(byRole(preview, 'button', /route hold/));
    });
  });

  describe('focus', () => {
    it('moves to the wall when the hold that had it is gone', () => {
      const { draw, holdButton, layer, preview } = mount();
      const annotation = hold();
      draw([annotation]);
      holdButton(/route hold/).focus();

      layer.draw([], routeLabels([], true));

      expect(document.activeElement).toBe(preview);
    });

    it('stays where it was when focus was not on a hold', () => {
      const { draw, layer, preview } = mount();
      const outside = document.createElement('button');
      document.body.append(outside);
      draw([hold()]);
      outside.focus();

      layer.draw([], routeLabels([], true));

      expect(document.activeElement).toBe(outside);
      expect(document.activeElement).not.toBe(preview);
    });
  });

  describe('tape', () => {
    it('removes a strip from the keyboard', () => {
      const { draw, preview, handlers } = mount();
      const annotation = hold({}, { start: 3, finish: 0 });
      draw([annotation]);

      byRole(preview, 'button', /Remove one of 3 start tape strips/).dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, detail: 0 })
      );

      expect(handlers.onRemoveTape).toHaveBeenCalledWith(annotation, 'start');
    });

    it('sends overlapping taps to the nearest visible shape', () => {
      const { draw, preview, handlers } = mount();
      const annotation = hold({}, { start: 1, finish: 0 });
      draw([annotation]);
      const tape = byRole(preview, 'button', /Remove one of/);
      const hit = (x: number, y: number) =>
        tape.dispatchEvent(
          new window.MouseEvent('click', { bubbles: true, clientX: x, clientY: y, detail: 1 })
        );
      const centre = {
        x: (Number.parseFloat(tape.style.left) / 100) * size.width,
        y: (Number.parseFloat(tape.style.top) / 100) * size.height,
      };

      // The middle of the hold is its own shape, even where tape's tap area reaches.
      hit(450, 270);
      expect(handlers.onActivateHold).toHaveBeenCalledWith(annotation);
      expect(handlers.onRemoveTape).not.toHaveBeenCalled();

      hit(centre.x, centre.y);
      expect(handlers.onRemoveTape).toHaveBeenCalledWith(annotation, 'start');
    });

    it('draws tape on the photo as well as giving it a button', () => {
      const { draw, preview } = mount();

      draw([hold({}, { start: 2, finish: 0 })]);

      const solid = [...preview.querySelectorAll('svg rect')].filter(
        (node) => node.getAttribute('fill') === '#2bd97c'
      );
      expect(solid).toHaveLength(2);
    });
  });

  describe('when locked', () => {
    it('disables the buttons and ignores the wall until unlocked', () => {
      const { layer, draw, preview, handlers, key, pointer } = mount();
      draw([hold({}, { start: 1, finish: 0 })]);
      preview.focus();

      layer.setLocked(true);
      key('Enter');
      pointer('pointerdown', 10, 10);
      pointer('pointerup', 10, 10);

      expect(allByRole<HTMLButtonElement>(preview, 'button').every((node) => node.disabled)).toBe(
        true
      );
      expect(handlers.onAddAt).not.toHaveBeenCalled();

      layer.setLocked(false);
      key('Enter');

      expect(allByRole<HTMLButtonElement>(preview, 'button').some((node) => node.disabled)).toBe(
        false
      );
      expect(handlers.onAddAt).toHaveBeenCalledOnce();
    });

    it('says so to assistive technology', () => {
      const { layer, preview } = mount();

      layer.setLocked(true);
      expect(preview.getAttribute('aria-disabled')).toBe('true');

      layer.setLocked(false);
      expect(preview.getAttribute('aria-disabled')).toBe('false');
    });

    it('dims the wall, and shows the detector sweeping it while it works', () => {
      const { layer, preview } = mount();

      layer.setLocked(true, true);
      expect(preview.classList.contains('is-locked')).toBe(true);
      expect(preview.classList.contains('is-scanning')).toBe(true);
      expect(preview.getAttribute('aria-busy')).toBe('true');

      layer.setLocked(true);
      expect(preview.classList.contains('is-scanning')).toBe(false);

      layer.setLocked(false);
      expect(preview.classList.contains('is-locked')).toBe(false);
      expect(preview.getAttribute('aria-busy')).toBe('false');
    });

    it('draws new buttons disabled', () => {
      const { layer, draw, preview } = mount();
      layer.setLocked(true);

      draw([hold()]);

      expect(byRole<HTMLButtonElement>(preview, 'button', /route hold/).disabled).toBe(true);
      expect(queryByRole(preview, 'button', /Remove/)).toBeNull();
    });
  });
});
