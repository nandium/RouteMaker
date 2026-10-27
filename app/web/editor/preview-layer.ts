import { plural } from '../../src/plural.js';
import { element } from '../dom.js';
import { createSvg, markShapes, paintSvg } from './burn-in.js';
import {
  type Annotation,
  type Box,
  clamp,
  holdUseLabel,
  type PixelBox,
  type Size,
  TAPE_KINDS,
  type TapeKind,
  toPixels,
} from './route-annotations.js';
import { publishedSize } from './route-image.js';
import { layoutTape } from './tape-layout.js';

/** Smallest comfortable tap target, in pixels. The stylesheet's `--hit-min` is the same size. */
const MINIMUM_HIT_TARGET = 44;
const KEYBOARD_STEP = 0.02;
const KEYBOARD_LARGE_STEP = 0.1;
/** A pointer that moves less than this between press and release is a tap, not a drag. */
const MINIMUM_DRAW_PIXELS = 12;
/**
 * On touch a swipe scrolls the page, so drawing a box starts only after the finger has rested
 * this long without moving more than the slop.
 */
const TOUCH_DRAW_DELAY_MS = 250;
const TOUCH_SLOP_PIXELS = 8;

/** A button over the photo; `area` is the shape it stands for, as fractions of the photo. */
type Spot = { area: Box; activate: () => void };

export type MarkerFocus = { annotation: Annotation; kind?: TapeKind };

type PreviewHandlers = {
  /** A hold's boundary was activated. */
  onActivateHold(annotation: Annotation): void;
  onRemoveTape(annotation: Annotation, kind: TapeKind): void;
  /** Bare wall was tapped, or the keyboard cursor confirmed; position is 0-1 within the photo. */
  onAddAt(x: number, y: number): void;
  /** A box was dragged out on bare wall; corners are 0-1 within the photo. */
  onAddBox(startX: number, startY: number, endX: number, endY: number): void;
};

/** Grow `box` to the minimum tap size around its centre, kept inside the container. */
function expandedHitTarget(box: PixelBox, container: Size) {
  const width = Math.min(container.width, Math.max(MINIMUM_HIT_TARGET, box.width));
  const height = Math.min(container.height, Math.max(MINIMUM_HIT_TARGET, box.height));
  return {
    left: clamp(box.left - (width - box.width) / 2, 0, container.width - width),
    top: clamp(box.top - (height - box.height) / 2, 0, container.height - height),
    width,
    height,
  };
}

/** How far `value` is outside the range `low` to `high`; 0 inside it. */
const distanceOutside = (value: number, low: number, high: number) =>
  Math.max(low - value, 0, value - high);

/**
 * Hit areas overlap on crowded holds, so a tap goes to the nearest visible shape (ties: the
 * one whose centre is nearer) rather than to whichever area was drawn last.
 */
function nearestSpot(x: number, y: number, spots: readonly Spot[], container: Size) {
  let nearest: { spot: Spot; edge: number; center: number } | undefined;
  for (const spot of spots) {
    const box = toPixels(spot.area, container);
    const hit = expandedHitTarget(box, container);
    const inside =
      x >= hit.left && x <= hit.left + hit.width && y >= hit.top && y <= hit.top + hit.height;
    if (!inside) continue;
    const edge = Math.hypot(
      distanceOutside(x, box.left, box.left + box.width),
      distanceOutside(y, box.top, box.top + box.height)
    );
    const center = Math.hypot(x - (box.left + box.width / 2), y - (box.top + box.height / 2));
    if (!nearest || edge < nearest.edge || (edge === nearest.edge && center < nearest.center)) {
      nearest = { spot, edge, center };
    }
  }
  return nearest?.spot;
}

/** The smallest box holding all of `boxes`, as fractions of `space`. */
function enclosing(boxes: readonly PixelBox[], space: Size): Box {
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  const bottom = Math.max(...boxes.map((box) => box.top + box.height));
  return {
    x: left / space.width,
    y: top / space.height,
    width: (right - left) / space.width,
    height: (bottom - top) / space.height,
  };
}

/**
 * The wall photo with its markings and interactive layer: the markings are drawn by the same
 * code that burns them into the published photo, hold and tape buttons sit over them at touch
 * size, bare wall takes taps and drag-to-draw, and arrow keys move a cursor. It owns its
 * container (`element`) and reports what the user did through its handlers; what a tap
 * means (the mode) and undo are the caller's.
 */
export function createPreviewLayer(handlers: PreviewHandlers) {
  const stage = element('div', 'stage');
  stage.hidden = true;
  stage.setAttribute('role', 'group');
  stage.setAttribute(
    'aria-label',
    'Wall photo hold editor. Use arrow keys to position a marker, then press Enter to add it.'
  );
  stage.tabIndex = 0;
  const photo = element('img', 'stage__photo');
  photo.alt = 'Selected climbing wall';
  const marks = createSvg({ width: 1, height: 1 }, []);
  marks.classList.add('stage__marks');
  const hits = element('div', 'stage__hits');
  const cursor = element('span', 'stage__cursor');
  cursor.setAttribute('aria-hidden', 'true');
  const draft = element('span', 'stage__draft');
  draft.hidden = true;
  draft.setAttribute('aria-hidden', 'true');
  const scan = element('span', 'stage__scan');
  scan.setAttribute('aria-hidden', 'true');
  stage.append(photo, marks, hits, cursor, draft, scan);

  /** The pixel space the markings are drawn in: the photo as it will be published. */
  let space: Size = { width: 1, height: 1 };
  let annotations: readonly Annotation[] = [];
  let labels: ReadonlyMap<Annotation, string> = new Map();
  let spots: Spot[] = [];
  let locked = false;
  let dragEnabled = true;

  /** Taps and clicks both end up here: the nearest shape under the point, else bare wall. */
  const activateAt = (clientX: number, clientY: number) => {
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const spot = nearestSpot(x, y, spots, rect);
    if (spot) spot.activate();
    else handlers.onAddAt(x / rect.width, y / rect.height);
  };

  function addSpot(area: Box, label: string, activate: () => void, className: string) {
    const spot = element('button', className);
    spot.type = 'button';
    spot.setAttribute('aria-label', label);
    Object.assign(spot.style, {
      left: `${(area.x + area.width / 2) * 100}%`,
      top: `${(area.y + area.height / 2) * 100}%`,
      width: `${area.width * 100}%`,
      height: `${area.height * 100}%`,
    });
    spot.disabled = locked;
    // detail === 0 is a keyboard activation; a pointer click may have meant a neighbour.
    spot.onclick = (event) => {
      event.stopPropagation();
      if (event.detail === 0) activate();
      else activateAt(event.clientX, event.clientY);
    };
    spots.push({ area, activate });
    return spot;
  }

  function holdSpot(annotation: Annotation, index: number) {
    const { use } = annotation;
    const marker = labels.get(annotation);
    const tapes = TAPE_KINDS.filter((kind) => annotation.tapes[kind])
      .map((kind) => plural(annotation.tapes[kind], `${kind} tape`))
      .join(', ');
    const label = use
      ? [`${holdUseLabel(use)} route hold`, marker && `marker ${marker}`, tapes]
          .filter(Boolean)
          .join(', ')
      : `Detected hold ${index + 1} of ${annotations.length}, not selected`;
    const spot = addSpot(
      annotation,
      label,
      () => handlers.onActivateHold(annotation),
      'stage__hold'
    );
    spot.setAttribute('aria-pressed', String(use !== null));
    spot.dataset.annotationIndex = String(index);
    return spot;
  }

  function tapeSpot(annotation: Annotation, index: number, kind: TapeKind) {
    const strips = layoutTape(annotation, kind, space, 0);
    if (!strips.length) return null;
    const marker = labels.get(annotation);
    const holdName = annotation.use ? holdUseLabel(annotation.use) : 'route';
    const label = [
      `Remove one of ${plural(strips.length, `${kind} tape strip`)} on ${holdName} hold`,
      marker && `marker ${marker}`,
    ]
      .filter(Boolean)
      .join(', ');
    const spot = addSpot(
      enclosing(strips, space),
      label,
      () => handlers.onRemoveTape(annotation, kind),
      'stage__tape'
    );
    spot.dataset.annotationIndex = String(index);
    spot.dataset.tapeKind = kind;
    return spot;
  }

  /**
   * Redraw the markings and rebuild the buttons; `focus` names the one to refocus. Focus that
   * was on a button that no longer exists (a deleted hold) moves to the wall, not to the page.
   */
  function draw(
    nextAnnotations: readonly Annotation[],
    nextLabels: ReadonlyMap<Annotation, string>,
    focus?: MarkerFocus
  ) {
    annotations = nextAnnotations;
    labels = nextLabels;
    spots = [];
    const hadFocus = hits.contains(document.activeElement);
    paintSvg(marks, space, markShapes(annotations, labels, space));
    const buttons: HTMLButtonElement[] = [];
    let toFocus: HTMLButtonElement | undefined;
    const add = (button: HTMLButtonElement | null, annotation: Annotation, kind?: TapeKind) => {
      if (!button) return;
      buttons.push(button);
      if (focus?.annotation === annotation && focus.kind === kind) toFocus = button;
    };
    annotations.forEach((annotation, index) => {
      add(holdSpot(annotation, index), annotation);
      for (const kind of TAPE_KINDS) add(tapeSpot(annotation, index, kind), annotation, kind);
    });
    hits.replaceChildren(...buttons);
    if (toFocus) toFocus.focus();
    else if (hadFocus) stage.focus();
  }

  // Pointer input on bare wall (hold and tape buttons handle their own clicks).
  let cursorX = 0.5;
  let cursorY = 0.5;
  let drag: { pointerId: number; x: number; y: number } | undefined;
  /** A finger that has touched down and may become a drag if it rests long enough. */
  let pendingTouch:
    { pointerId: number; x: number; y: number; timer: ReturnType<typeof setTimeout> } | undefined;
  // A drag or tap is handled on pointerup; the click that browsers fire after it must not
  // repeat it. A click with no pointer behind it (assistive technology) is still a tap, and a
  // touch drag fires no click at all, so the flag is cleared as soon as the click would have run.
  let swallowClick = false;

  const showCursor = () => {
    cursor.style.left = `${cursorX * 100}%`;
    cursor.style.top = `${cursorY * 100}%`;
  };
  const pointIn = (clientX: number, clientY: number) => {
    const rect = stage.getBoundingClientRect();
    return {
      x: clamp(clientX - rect.left, 0, rect.width),
      y: clamp(clientY - rect.top, 0, rect.height),
      width: rect.width,
      height: rect.height,
    };
  };
  const endDrag = () => {
    drag = undefined;
    draft.hidden = true;
  };
  const cancelPendingTouch = () => {
    if (pendingTouch) clearTimeout(pendingTouch.timer);
    pendingTouch = undefined;
  };
  const place = (box: PixelBox) =>
    Object.assign(draft.style, {
      left: `${box.left}px`,
      top: `${box.top}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    });
  const beginDrag = (pointerId: number, clientX: number, clientY: number) => {
    const point = pointIn(clientX, clientY);
    drag = { pointerId, x: point.x, y: point.y };
    place({ left: point.x, top: point.y, width: 0, height: 0 });
    draft.hidden = false;
    stage.setPointerCapture?.(pointerId);
  };
  const usable = () => !locked && !stage.hidden;

  stage.onclick = (event) => {
    if (!usable()) return;
    if (swallowClick) {
      swallowClick = false;
      return;
    }
    activateAt(event.clientX, event.clientY);
  };
  stage.onpointerdown = (event) => {
    const onButton = event.target instanceof Node && hits.contains(event.target);
    if (!usable() || !dragEnabled || event.button !== 0 || onButton) return;
    const { pointerId, clientX, clientY } = event;
    if (event.pointerType !== 'touch') return beginDrag(pointerId, clientX, clientY);
    pendingTouch = {
      pointerId,
      x: clientX,
      y: clientY,
      timer: setTimeout(() => {
        pendingTouch = undefined;
        beginDrag(pointerId, clientX, clientY);
      }, TOUCH_DRAW_DELAY_MS),
    };
  };
  stage.onpointermove = (event) => {
    if (
      pendingTouch?.pointerId === event.pointerId &&
      Math.hypot(event.clientX - pendingTouch.x, event.clientY - pendingTouch.y) > TOUCH_SLOP_PIXELS
    ) {
      cancelPendingTouch(); // a swipe: the page scrolls
    }
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointIn(event.clientX, event.clientY);
    place({
      left: Math.min(drag.x, point.x),
      top: Math.min(drag.y, point.y),
      width: Math.abs(point.x - drag.x),
      height: Math.abs(point.y - drag.y),
    });
  };
  // Once a box is being drawn the finger must not also scroll the page.
  stage.addEventListener(
    'touchmove',
    (event) => {
      if (drag) event.preventDefault();
    },
    { passive: false }
  );
  stage.onpointerup = (event) => {
    cancelPendingTouch();
    if (!drag || drag.pointerId !== event.pointerId) return;
    const start = drag;
    const point = pointIn(event.clientX, event.clientY);
    endDrag();
    swallowClick = true;
    setTimeout(() => {
      swallowClick = false;
    });
    if (Math.hypot(point.x - start.x, point.y - start.y) < MINIMUM_DRAW_PIXELS) {
      activateAt(event.clientX, event.clientY);
    } else {
      handlers.onAddBox(
        start.x / point.width,
        start.y / point.height,
        point.x / point.width,
        point.y / point.height
      );
    }
  };
  stage.onpointercancel = () => {
    cancelPendingTouch();
    endDrag();
  };
  stage.onkeydown = (event) => {
    if (event.target !== stage || !usable()) return;
    const step = event.shiftKey ? KEYBOARD_LARGE_STEP : KEYBOARD_STEP;
    const move = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (move) {
      event.preventDefault();
      cursorX = clamp(cursorX + move[0], 0, 1);
      cursorY = clamp(cursorY + move[1], 0, 1);
      showCursor();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onAddAt(cursorX, cursorY);
    }
  };
  showCursor();

  return {
    element: stage,
    /** Show a photo of this size (as the browser displays it), with no markings yet. */
    show(url: string, size: Size) {
      photo.src = url;
      stage.style.aspectRatio = `${size.width} / ${size.height}`;
      space = publishedSize(size);
      stage.hidden = false;
    },
    hide() {
      stage.hidden = true;
      photo.removeAttribute('src');
    },
    draw,
    /** Locked, the wall takes no input; `scanning` adds the detector's progress sweep. */
    setLocked(value: boolean, scanning = false) {
      locked = value;
      stage.classList.toggle('is-locked', value);
      stage.classList.toggle('is-scanning', value && scanning);
      stage.setAttribute('aria-busy', String(value));
      stage.setAttribute('aria-disabled', String(value));
      hits.querySelectorAll('button').forEach((node) => (node.disabled = value));
    },
    /** Dragging out a box is off while the delete mode is active. */
    setDragEnabled(value: boolean) {
      dragEnabled = value;
      stage.classList.toggle('is-delete', !value);
    },
  };
}
