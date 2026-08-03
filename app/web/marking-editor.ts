import { iconSvg, type IconName } from '../src/icons.js';
import { annotationLabel, holdUseLabel } from './route-annotation-labels.js';
import {
  annotationAt,
  annotationFromBox,
  type Annotation,
  expandedHitTarget,
  type HoldUse,
  layoutTape,
  nearestVisualTarget,
  type PixelBox,
  ROUTE_MARKING,
  selectedAnnotations,
  tapeBounds,
  type TapeKind,
  tapeTotal,
} from './route-annotations.js';
import { element, setStatus } from './shared.js';

type EditorTool = HoldUse | TapeKind | 'delete';
type AnnotationCandidate = Pick<Annotation, 'x' | 'y' | 'width' | 'height'>;
type EditorSnapshot = {
  annotations: Annotation[];
  nextOrder: number;
};
type PointerAction = {
  box: PixelBox;
  hitBox: PixelBox;
  value: () => void;
};

const EDITOR_TOOLS: ReadonlyArray<{
  value: EditorTool;
  label: string;
  shortLabel: string;
  detail: string;
  icon: IconName;
}> = [
  {
    value: 'any',
    label: holdUseLabel('any'),
    shortLabel: 'Any',
    detail: 'Hands or feet',
    icon: 'any',
  },
  {
    value: 'hand',
    label: holdUseLabel('hand'),
    shortLabel: 'Hand',
    detail: 'Hands only',
    icon: 'hand',
  },
  {
    value: 'foot',
    label: holdUseLabel('foot'),
    shortLabel: 'Foot',
    detail: 'Feet only',
    icon: 'foot',
  },
  {
    value: 'delete',
    label: 'Delete boundary',
    shortLabel: 'Delete box',
    detail: 'Tap any box',
    icon: 'boundaryDelete',
  },
  {
    value: 'start',
    label: 'Start tape',
    shortLabel: 'Start',
    detail: `Up to ${ROUTE_MARKING.maxStartTapes} strips`,
    icon: 'tapeStart',
  },
  {
    value: 'finish',
    label: 'Finish tape',
    shortLabel: 'Finish',
    detail: `Up to ${ROUTE_MARKING.maxFinishTapes} strips`,
    icon: 'tapeFinish',
  },
];

function editorIcon(name: IconName) {
  const icon = element('span', 'editor-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconSvg(name, 'currentColor');
  return icon;
}

function copyAnnotations(annotations: readonly Annotation[]) {
  return annotations.map((annotation) => ({ ...annotation }));
}

export function createMarkingEditor(preview: HTMLElement, status: HTMLElement) {
  const annotations: Annotation[] = [];
  const history: EditorSnapshot[] = [];
  const toolButtons = new Map<EditorTool, HTMLButtonElement>();
  const selectionSummary = element('p', 'hold-editor__summary');
  selectionSummary.setAttribute('aria-live', 'polite');
  const undo = element('button', 'secondary icon-button');
  undo.append(editorIcon('undo'), element('span', '', 'Undo'));
  undo.setAttribute('aria-label', 'Undo last change');
  const reset = element('button', 'secondary icon-button');
  reset.append(editorIcon('reset'), element('span', '', 'Clear'));
  reset.setAttribute('aria-label', 'Clear route markings');
  const sequence = element('button', 'secondary sequence-toggle icon-button');
  sequence.append(editorIcon('sequence'), element('span', '', 'Numbers'));
  const keyboardCursor = element('span', 'preview-cursor');
  keyboardCursor.setAttribute('aria-hidden', 'true');
  const drawPreview = element('span', 'marker-draft');
  drawPreview.hidden = true;
  drawPreview.setAttribute('aria-hidden', 'true');
  preview.append(keyboardCursor, drawPreview);

  let activeTool: EditorTool = 'any';
  let showSequence = true;
  let nextOrder = 1;
  let keyboardX = 0.5;
  let keyboardY = 0.5;
  let locked = false;
  let pointerTargets: PointerAction[] = [];
  let dragStart:
    | {
        pointerId: number;
        x: number;
        y: number;
      }
    | undefined;
  let suppressNextPreviewClick = false;

  const routeAnnotations = () => selectedAnnotations(annotations);
  const moveKeyboardCursor = () => {
    keyboardCursor.style.left = `${keyboardX * 100}%`;
    keyboardCursor.style.top = `${keyboardY * 100}%`;
  };

  const syncControls = () => {
    undo.disabled = locked || history.length === 0;
    reset.disabled = locked || routeAnnotations().length === 0;
    sequence.disabled = locked;
    preview.setAttribute('aria-disabled', String(locked));
    preview
      .querySelectorAll<HTMLButtonElement>('.marker, .marker-tape')
      .forEach((button) => (button.disabled = locked));
    toolButtons.forEach((button, tool) => {
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(tool === activeTool));
    });
  };

  const redraw = (annotationToFocus?: Annotation, tapeToFocus?: TapeKind) => {
    preview.querySelectorAll('.marker, .marker-tape').forEach((marker) => marker.remove());
    pointerTargets = [];
    const bounds = preview.getBoundingClientRect();
    const selected = routeAnnotations();
    let markerToFocus: HTMLButtonElement | undefined;
    let tapeButtonToFocus: HTMLButtonElement | undefined;
    annotations.forEach((annotation, index) => {
      const marker = element(
        'button',
        `marker marker--${annotation.use ?? 'candidate'}`
      ) as HTMLButtonElement;
      marker.type = 'button';
      marker.dataset.annotationIndex = String(index);
      const label = annotation.use ? annotationLabel(annotation, annotations, showSequence) : '';
      const markerBox = {
        left: annotation.x * bounds.width,
        top: annotation.y * bounds.height,
        width: annotation.width * bounds.width,
        height: annotation.height * bounds.height,
      };
      const markerHit = expandedHitTarget(markerBox, bounds.width, bounds.height);
      const markerVisual = element('span', 'marker__box');
      Object.assign(markerVisual.style, {
        left: `${markerBox.left - markerHit.left}px`,
        top: `${markerBox.top - markerHit.top}px`,
        width: `${markerBox.width}px`,
        height: `${markerBox.height}px`,
      });
      if (label) markerVisual.append(element('span', 'marker__label', label));
      marker.append(markerVisual);
      const tapeDescription = [
        annotation.start_tapes ? `${annotation.start_tapes} start tape` : '',
        annotation.finish_tapes ? `${annotation.finish_tapes} finish tape` : '',
      ]
        .filter(Boolean)
        .join(', ');
      marker.setAttribute(
        'aria-label',
        annotation.use
          ? `${holdUseLabel(annotation.use)} route hold${label ? `, marker ${label}` : ''}${tapeDescription ? `, ${tapeDescription}` : ''}`
          : `Detected hold ${index + 1} of ${annotations.length}, not selected`
      );
      marker.setAttribute('aria-pressed', String(annotation.use !== null));
      Object.assign(marker.style, {
        left: `${markerHit.left}px`,
        top: `${markerHit.top}px`,
        width: `${markerHit.width}px`,
        height: `${markerHit.height}px`,
      });
      marker.onclick = (event) => {
        event.stopPropagation();
        if (event.detail === 0) applyTool(annotation);
        else activatePointer(event.clientX, event.clientY);
      };
      pointerTargets.push({
        box: markerBox,
        hitBox: markerHit,
        value: () => applyTool(annotation),
      });
      preview.append(marker);
      if (annotation === annotationToFocus) markerToFocus = marker;

      for (const [kind, count] of [
        ['start', annotation.start_tapes],
        ['finish', annotation.finish_tapes],
      ] as const) {
        const strips = layoutTape(annotation, count, kind, bounds.width, bounds.height);
        const cluster = tapeBounds(strips);
        if (!cluster) continue;
        const hit = expandedHitTarget(cluster, bounds.width, bounds.height);
        const tape = element('button', `marker-tape marker-tape--${kind}`) as HTMLButtonElement;
        tape.type = 'button';
        tape.dataset.annotationIndex = String(index);
        tape.dataset.tapeKind = kind;
        tape.setAttribute(
          'aria-label',
          `Remove one ${kind} tape strip from ${annotation.use ? holdUseLabel(annotation.use) : 'route'} hold${label ? `, marker ${label}` : ''}`
        );
        tape.onclick = (event) => {
          event.stopPropagation();
          const directRemoval =
            event.detail === 0 ||
            (event.target instanceof HTMLElement &&
              Boolean(event.target.closest('.marker-tape__strip, .marker-tape__remove')));
          if (directRemoval) removeTape(annotation, kind);
          else activatePointer(event.clientX, event.clientY);
        };
        pointerTargets.push({
          box: cluster,
          hitBox: hit,
          value: () => removeTape(annotation, kind),
        });
        Object.assign(tape.style, {
          left: `${hit.left}px`,
          top: `${hit.top}px`,
          width: `${hit.width}px`,
          height: `${hit.height}px`,
        });
        strips.forEach((strip) => {
          const visual = element('span', 'marker-tape__strip');
          Object.assign(visual.style, {
            clipPath: `polygon(${strip.points
              .map(([x, y]) => `${(x / strip.width) * 100}% ${(y / strip.height) * 100}%`)
              .join(', ')})`,
            left: `${strip.left - hit.left}px`,
            top: `${strip.top - hit.top}px`,
            width: `${strip.width}px`,
            height: `${strip.height}px`,
          });
          tape.append(visual);
        });
        const removeVisual = element('span', 'marker-tape__remove', '−');
        removeVisual.setAttribute('aria-hidden', 'true');
        tape.append(removeVisual);
        preview.append(tape);
        if (annotation === annotationToFocus && kind === tapeToFocus) tapeButtonToFocus = tape;
      }
    });

    const startCount = tapeTotal(annotations, 'start');
    const finishCount = tapeTotal(annotations, 'finish');
    selectionSummary.textContent = `${selected.length} holds · ${startCount}/${ROUTE_MARKING.maxStartTapes} start · ${finishCount}/${ROUTE_MARKING.maxFinishTapes} finish`;
    sequence.setAttribute(
      'aria-label',
      showSequence ? 'Hide sequence numbers' : 'Show sequence numbers'
    );
    sequence.setAttribute('aria-pressed', String(showSequence));
    const startButton = toolButtons.get('start');
    const finishButton = toolButtons.get('finish');
    if (startButton)
      startButton.querySelector('small')!.textContent =
        `${startCount}/${ROUTE_MARKING.maxStartTapes}`;
    if (finishButton)
      finishButton.querySelector('small')!.textContent =
        `${finishCount}/${ROUTE_MARKING.maxFinishTapes}`;
    syncControls();
    (tapeButtonToFocus ?? markerToFocus)?.focus();
  };

  const remember = () =>
    history.push({
      annotations: copyAnnotations(annotations),
      nextOrder,
    });

  const mutate = (change: () => void, annotationToFocus?: Annotation, tapeToFocus?: TapeKind) => {
    remember();
    change();
    redraw(annotationToFocus, tapeToFocus);
  };

  const selectForTape = (annotation: Annotation) => {
    if (annotation.use) return;
    annotation.use = 'any';
    annotation.order = nextOrder++;
  };

  const removeTape = (annotation: Annotation, kind: TapeKind) => {
    if (locked) return;
    const key = kind === 'start' ? 'start_tapes' : 'finish_tapes';
    if (!annotation[key]) return;
    mutate(
      () => {
        annotation[key] -= 1;
      },
      annotation,
      kind
    );
    setStatus(status, `${kind === 'start' ? 'Start' : 'Finish'} tape removed.`);
  };

  const applyTool = (annotation: Annotation) => {
    if (locked) return;
    if (activeTool === 'delete') {
      mutate(() => {
        annotations.splice(annotations.indexOf(annotation), 1);
      });
      setStatus(status, 'Hold boundary deleted. Undo restores it.');
      return;
    }
    if (activeTool === 'start' || activeTool === 'finish') {
      const key = activeTool === 'start' ? 'start_tapes' : 'finish_tapes';
      const oppositeKey = activeTool === 'start' ? 'finish_tapes' : 'start_tapes';
      const maximum =
        activeTool === 'start' ? ROUTE_MARKING.maxStartTapes : ROUTE_MARKING.maxFinishTapes;
      if (tapeTotal(annotations, activeTool) >= maximum) {
        setStatus(
          status,
          `${activeTool === 'start' ? 'Start' : 'Finish'} tape is already at its ${maximum}-strip limit. Remove a strip or undo the last change.`,
          true
        );
        return;
      }
      mutate(() => {
        selectForTape(annotation);
        annotation[oppositeKey] = 0;
        annotation[key] += 1;
      }, annotation);
      setStatus(
        status,
        activeTool === 'start'
          ? 'Start tape added. Start holds stay first; tap again for another strip.'
          : 'Finish tape added. Finish holds stay last; tap again for another strip.'
      );
      return;
    }
    const use = activeTool;
    mutate(() => {
      if (annotation.use === use) {
        annotation.use = null;
        annotation.order = null;
        annotation.start_tapes = 0;
        annotation.finish_tapes = 0;
      } else {
        if (!annotation.use) annotation.order = nextOrder++;
        annotation.use = use;
      }
    }, annotation);
  };

  const addBoundary = (
    create: (use: HoldUse, order: number) => Annotation,
    confirmation: string
  ) => {
    if (locked) return;
    if (activeTool === 'delete') {
      setStatus(status, 'Tap a hold boundary to delete it.');
      return;
    }
    if (activeTool === 'start' && tapeTotal(annotations, 'start') >= ROUTE_MARKING.maxStartTapes) {
      return setStatus(
        status,
        `Start tape is already at its ${ROUTE_MARKING.maxStartTapes}-strip limit.`,
        true
      );
    }
    if (
      activeTool === 'finish' &&
      tapeTotal(annotations, 'finish') >= ROUTE_MARKING.maxFinishTapes
    ) {
      return setStatus(
        status,
        `Finish tape is already at its ${ROUTE_MARKING.maxFinishTapes}-strip limit.`,
        true
      );
    }
    const use: HoldUse = activeTool === 'hand' || activeTool === 'foot' ? activeTool : 'any';
    mutate(() => {
      const annotation = create(use, nextOrder++);
      if (activeTool === 'start') annotation.start_tapes = 1;
      if (activeTool === 'finish') annotation.finish_tapes = 1;
      annotations.push(annotation);
    });
    setStatus(status, confirmation);
  };

  const addMarker = (x: number, y: number) =>
    addBoundary(
      (use, order) => annotationAt(x, y, use, order),
      'Standard hold boundary added. Drag on empty wall space to draw an exact box.'
    );

  const addDrawnMarker = (startX: number, startY: number, endX: number, endY: number) =>
    addBoundary(
      (use, order) => annotationFromBox(startX, startY, endX, endY, use, order),
      'Custom hold boundary drawn.'
    );

  const activatePointer = (clientX: number, clientY: number) => {
    const bounds = preview.getBoundingClientRect();
    const action = nearestVisualTarget(clientX - bounds.left, clientY - bounds.top, pointerTargets);
    if (action) action();
    else addMarker((clientX - bounds.left) / bounds.width, (clientY - bounds.top) / bounds.height);
  };

  preview.onclick = (event) => {
    if (locked || preview.hidden) return;
    if (suppressNextPreviewClick) {
      suppressNextPreviewClick = false;
      return;
    }
    activatePointer(event.clientX, event.clientY);
  };
  const previewPoint = (clientX: number, clientY: number) => {
    const bounds = preview.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(bounds.width, clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, clientY - bounds.top)),
      width: bounds.width,
      height: bounds.height,
    };
  };
  const clearDrawPreview = () => {
    dragStart = undefined;
    drawPreview.hidden = true;
  };
  preview.onpointerdown = (event) => {
    if (
      locked ||
      preview.hidden ||
      activeTool === 'delete' ||
      event.button !== 0 ||
      (event.target instanceof HTMLElement &&
        Boolean(event.target.closest('.marker, .marker-tape')))
    ) {
      return;
    }
    const point = previewPoint(event.clientX, event.clientY);
    dragStart = { pointerId: event.pointerId, x: point.x, y: point.y };
    Object.assign(drawPreview.style, {
      left: `${point.x}px`,
      top: `${point.y}px`,
      width: '0px',
      height: '0px',
    });
    drawPreview.hidden = false;
    preview.setPointerCapture?.(event.pointerId);
  };
  preview.onpointermove = (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const point = previewPoint(event.clientX, event.clientY);
    Object.assign(drawPreview.style, {
      left: `${Math.min(dragStart.x, point.x)}px`,
      top: `${Math.min(dragStart.y, point.y)}px`,
      width: `${Math.abs(point.x - dragStart.x)}px`,
      height: `${Math.abs(point.y - dragStart.y)}px`,
    });
  };
  preview.onpointerup = (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const start = dragStart;
    const point = previewPoint(event.clientX, event.clientY);
    const moved = Math.hypot(point.x - start.x, point.y - start.y);
    clearDrawPreview();
    suppressNextPreviewClick = true;
    window.setTimeout(() => {
      suppressNextPreviewClick = false;
    });
    if (moved < ROUTE_MARKING.minimumDrawPixels) {
      addMarker(point.x / point.width, point.y / point.height);
      return;
    }
    addDrawnMarker(
      start.x / point.width,
      start.y / point.height,
      point.x / point.width,
      point.y / point.height
    );
  };
  preview.onpointercancel = clearDrawPreview;
  preview.onkeydown = (event) => {
    if (event.target !== preview || locked || preview.hidden) return;
    const step = event.shiftKey ? ROUTE_MARKING.keyboardLargeStep : ROUTE_MARKING.keyboardStep;
    const movement = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    }[event.key];
    if (movement) {
      event.preventDefault();
      keyboardX = Math.max(0, Math.min(1, keyboardX + movement[0]));
      keyboardY = Math.max(0, Math.min(1, keyboardY + movement[1]));
      moveKeyboardCursor();
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      addMarker(keyboardX, keyboardY);
    }
  };

  undo.onclick = () => {
    if (locked) return;
    const previous = history.pop();
    if (!previous) return;
    annotations.splice(0, annotations.length, ...previous.annotations);
    nextOrder = previous.nextOrder;
    redraw();
    setStatus(status, 'Last route change undone.');
  };
  reset.onclick = () => {
    if (locked || !routeAnnotations().length) return;
    mutate(() => {
      annotations.forEach((annotation) => {
        annotation.use = null;
        annotation.order = null;
        annotation.start_tapes = 0;
        annotation.finish_tapes = 0;
      });
      nextOrder = 1;
    });
    setStatus(status, 'Route selections cleared. Detected holds are still available.');
  };
  sequence.onclick = () => {
    if (locked) return;
    showSequence = !showSequence;
    redraw();
  };

  const actions = element('div', 'tool-actions hold-editor__actions');
  actions.append(undo, reset, sequence);
  const tools = element('div', 'hold-editor');
  const toolList = element('div', 'hold-editor__tools');
  EDITOR_TOOLS.forEach((tool) => {
    const button = element('button', 'hold-tool') as HTMLButtonElement;
    button.type = 'button';
    button.setAttribute('aria-label', `${tool.label}: ${tool.detail}`);
    button.append(editorIcon(tool.icon), element('strong', '', tool.shortLabel));
    if (tool.value === 'start' || tool.value === 'finish') {
      button.append(element('small', '', tool.detail));
    }
    button.onclick = () => {
      if (locked) return;
      activeTool = tool.value;
      redraw();
      if (activeTool === 'delete') {
        setStatus(status, 'Delete box active. Tap any boundary to remove it; Undo restores it.');
      }
    };
    if (tool.value === 'delete') button.classList.add('hold-tool--delete');
    toolButtons.set(tool.value, button);
    toolList.append(button);
  });
  const markerFooter = element('div', 'hold-editor__footer');
  markerFooter.append(selectionSummary);
  tools.append(
    element('h3', '', 'Route markings'),
    element(
      'p',
      'tool-note',
      'Detect holds, then tap to mark or drag empty wall space to draw a box. Delete box removes boundaries; Clear keeps them.'
    ),
    actions,
    toolList,
    markerFooter,
    status
  );

  const resizeObserver = new ResizeObserver(() => {
    if (preview.hidden) return;
    const focused =
      document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const index = Number(focused?.dataset.annotationIndex);
    const annotationToFocus = Number.isInteger(index) ? annotations[index] : undefined;
    const tapeToFocus =
      focused?.dataset.tapeKind === 'start' || focused?.dataset.tapeKind === 'finish'
        ? focused.dataset.tapeKind
        : undefined;
    redraw(annotationToFocus, tapeToFocus);
  });
  resizeObserver.observe(preview);
  redraw();
  moveKeyboardCursor();

  return {
    actions,
    element: tools,
    clear() {
      annotations.splice(0);
      history.splice(0);
      nextOrder = 1;
      redraw();
    },
    replaceCandidates(candidates: readonly AnnotationCandidate[]) {
      remember();
      annotations.splice(
        0,
        annotations.length,
        ...candidates.map(({ x, y, width, height }) => ({
          x,
          y,
          width,
          height,
          use: null,
          order: null,
          start_tapes: 0,
          finish_tapes: 0,
        }))
      );
      nextOrder = 1;
      redraw();
    },
    redraw,
    snapshot() {
      return {
        annotations: copyAnnotations(routeAnnotations()),
        showSequence,
      };
    },
    setLocked(value: boolean) {
      locked = value;
      syncControls();
    },
    destroy() {
      resizeObserver.disconnect();
      preview.onclick = null;
      preview.onpointerdown = null;
      preview.onpointermove = null;
      preview.onpointerup = null;
      preview.onpointercancel = null;
      preview.onkeydown = null;
    },
  };
}
