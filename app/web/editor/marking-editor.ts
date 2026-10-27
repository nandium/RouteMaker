import { element, iconButton, textElement, type Tone } from '../dom.js';
import { type MarkMode, MODES, modeGlyph } from './mark-modes.js';
import { createPreviewLayer, type MarkerFocus } from './preview-layer.js';
import {
  type Annotation,
  annotationAt,
  annotationFromBox,
  type Box,
  candidate,
  clearSelection,
  cloneAnnotation,
  type HoldUse,
  holdUseLabel,
  nextOrder,
  routeLabels,
  selectedAnnotations,
  type Size,
  TAPE_LIMIT,
  type TapeKind,
  tapeTotal,
} from './route-annotations.js';

/** Everything the editor holds, selected or not; what a draft keeps. */
export type MarkingState = { annotations: Annotation[]; showSequence: boolean };

const capitalised = (text: string) => text[0].toUpperCase() + text.slice(1);

function numbersSwitch() {
  const node = element('button', 'switch');
  node.type = 'button';
  node.setAttribute('role', 'switch');
  const track = element('span', 'switch__track');
  track.append(element('span', 'switch__knob'));
  const state = element('span');
  state.setAttribute('aria-hidden', 'true');
  const text = element('span');
  text.append('Numbers ', state);
  node.append(track, text);
  return {
    node,
    show(on: boolean) {
      node.setAttribute('aria-checked', String(on));
      state.textContent = on ? 'on' : 'off';
    },
  };
}

/**
 * Hold boundaries, selection and tape on the wall photo, with undo and redo. It makes the
 * pieces (the photo with its markings, the mode picker, the history buttons, the summary) and
 * leaves their arrangement to the page. `say` reports to the page's status line; `onChange`
 * listeners hear every change the user makes to the markings.
 */
export function createMarkingEditor(say: (message: string, tone?: Tone) => void) {
  const changeListeners: Array<() => void> = [];
  const annotations: Annotation[] = [];
  const undoStack: Annotation[][] = [];
  const redoStack: Annotation[][] = [];
  let activeMode: MarkMode = MODES[0].mode;
  let showSequence = true;
  let locked = false;

  const summary = element('div', 'summary');
  summary.setAttribute('role', 'group');
  const undo = iconButton('undo', 'Undo last change');
  const redo = iconButton('redo', 'Redo last change');
  const reset = iconButton('reset', 'Clear route markings');
  const sequence = numbersSwitch();
  const modeButtons: Array<{ mode: MarkMode; button: HTMLButtonElement }> = [];
  const tapeCounts = new Map<TapeKind, HTMLElement>();

  const layer = createPreviewLayer({
    onActivateHold: activateHold,
    onRemoveTape: removeTape,
    onAddAt: (x, y) =>
      addBoundary(
        (use, order) => annotationAt(x, y, use, order),
        'Standard hold boundary added. Drag on empty wall space to draw an exact box.'
      ),
    onAddBox: (startX, startY, endX, endY) =>
      addBoundary(
        (use, order) => annotationFromBox(startX, startY, endX, endY, use, order),
        'Custom hold boundary drawn.'
      ),
  });

  const copy = () => annotations.map(cloneAnnotation);

  const syncControls = () => {
    undo.disabled = locked || undoStack.length === 0;
    redo.disabled = locked || redoStack.length === 0;
    reset.disabled = locked || selectedAnnotations(annotations).length === 0;
    sequence.node.disabled = locked;
    for (const { mode, button } of modeButtons) {
      button.disabled = locked;
      button.setAttribute('aria-pressed', String(mode === activeMode));
      if (mode.type === 'tape') {
        const used = tapeTotal(annotations, mode.kind);
        button.classList.toggle('is-full', used >= TAPE_LIMIT[mode.kind]);
        button.setAttribute(
          'aria-label',
          `${capitalised(mode.kind)} tape, ${used} of ${TAPE_LIMIT[mode.kind]} used`
        );
        tapeCounts.get(mode.kind)!.textContent = `${used}/${TAPE_LIMIT[mode.kind]}`;
      }
    }
  };

  const redraw = (focus?: MarkerFocus) => {
    layer.draw(annotations, routeLabels(annotations, showSequence), focus);
    const holds = selectedAnnotations(annotations).length;
    const tapes = {
      start: tapeTotal(annotations, 'start'),
      finish: tapeTotal(annotations, 'finish'),
    };
    const item = (value: string, name: string) => {
      const node = element('span', 'summary__item');
      node.append(
        textElement('span', value, 'summary__value display display--md'),
        textElement('span', name)
      );
      return node;
    };
    summary.replaceChildren(
      item(String(holds), holds === 1 ? 'hold' : 'holds'),
      item(`${tapes.start}/${TAPE_LIMIT.start}`, 'start'),
      item(`${tapes.finish}/${TAPE_LIMIT.finish}`, 'finish')
    );
    summary.setAttribute(
      'aria-label',
      `${holds} ${holds === 1 ? 'hold' : 'holds'}, ${tapes.start} of ${TAPE_LIMIT.start} start tape, ${tapes.finish} of ${TAPE_LIMIT.finish} finish tape`
    );
    sequence.show(showSequence);
    syncControls();
  };

  /** Show a change the user made, and tell the page. */
  const commit = (focus?: MarkerFocus) => {
    redraw(focus);
    changeListeners.forEach((listener) => listener());
  };

  /** Record the current markings so that the change about to be made can be undone. */
  const remember = () => {
    undoStack.push(copy());
    redoStack.length = 0;
  };

  const mutate = (change: () => void, focus?: MarkerFocus) => {
    remember();
    change();
    commit(focus);
  };

  const tapeLimitReached = (kind: TapeKind) => {
    if (tapeTotal(annotations, kind) < TAPE_LIMIT[kind]) return false;
    say(
      `${capitalised(kind)} tape is already at its ${TAPE_LIMIT[kind]}-strip limit. Remove a strip or undo the last change.`,
      'error'
    );
    return true;
  };

  function removeTape(annotation: Annotation, kind: TapeKind) {
    mutate(() => (annotation.tapes[kind] -= 1), { annotation, kind });
    say(`${capitalised(kind)} tape removed.`);
  }

  /** Apply the active mode to a hold's boundary. */
  function activateHold(annotation: Annotation) {
    switch (activeMode.type) {
      case 'delete':
        mutate(() => annotations.splice(annotations.indexOf(annotation), 1));
        say('Hold boundary deleted. Undo restores it.');
        return;
      case 'tape': {
        const { kind } = activeMode;
        if (tapeLimitReached(kind)) return;
        mutate(
          () => {
            if (!annotation.use) {
              annotation.use = 'any';
              annotation.order = nextOrder(annotations);
            }
            // A hold is either a start or a finish, never both.
            annotation.tapes[kind === 'start' ? 'finish' : 'start'] = 0;
            annotation.tapes[kind] += 1;
          },
          { annotation }
        );
        say(
          `Added a ${kind} tape strip. ${tapeTotal(annotations, kind)} of ${TAPE_LIMIT[kind]} used.`,
          'success'
        );
        return;
      }
      case 'use': {
        const { use } = activeMode;
        const unmarking = annotation.use === use;
        mutate(
          () => {
            if (unmarking) {
              clearSelection(annotation);
            } else {
              if (!annotation.use) annotation.order = nextOrder(annotations);
              annotation.use = use;
            }
          },
          { annotation }
        );
        const marker = routeLabels(annotations, showSequence).get(annotation);
        say(
          unmarking
            ? 'Hold unmarked.'
            : `Marked hold ${marker} as ${holdUseLabel(use).toLowerCase()}.`
        );
      }
    }
  }

  function addBoundary(create: (use: HoldUse, order: number) => Annotation, confirmation: string) {
    if (activeMode.type === 'delete') return say('Tap a hold boundary to delete it.');
    const tapeKind = activeMode.type === 'tape' ? activeMode.kind : null;
    if (tapeKind && tapeLimitReached(tapeKind)) return;
    const use = activeMode.type === 'use' ? activeMode.use : 'any';
    mutate(() => {
      const annotation = create(use, nextOrder(annotations));
      if (tapeKind) annotation.tapes[tapeKind] = 1;
      annotations.push(annotation);
    });
    say(confirmation);
  }

  const replaceAnnotations = (next: readonly Annotation[]) =>
    annotations.splice(0, annotations.length, ...next.map(cloneAnnotation));

  /** Go to the latest markings in `from`, keeping the current ones in `to`. */
  const travel = (from: Annotation[][], to: Annotation[][], message: string) => {
    const target = from.pop();
    if (!target) return;
    to.push(copy());
    replaceAnnotations(target);
    commit();
    say(message);
  };
  undo.onclick = () => travel(undoStack, redoStack, 'Last route change undone.');
  redo.onclick = () => travel(redoStack, undoStack, 'Change redone.');
  reset.onclick = () => {
    mutate(() => annotations.forEach(clearSelection));
    say('Route selections cleared. Detected holds are still available.');
  };
  sequence.node.onclick = () => {
    showSequence = !showSequence;
    commit();
    say(
      showSequence
        ? 'Showing sequence numbers.'
        : 'Showing hold type letters: H hand, F foot, A any limb.'
    );
  };

  const modes = element('div', 'tools');
  modes.setAttribute('role', 'group');
  modes.setAttribute('aria-label', 'Marking tools');
  for (const { mode, label, short, detail } of MODES) {
    const button = element('button', 'tool');
    button.type = 'button';
    button.setAttribute('aria-label', label);
    const text = element('span', 'tool__text');
    text.append(
      textElement('span', short, 'tool__short'),
      textElement('span', label, 'tool__label'),
      textElement('span', detail, 'tool__detail')
    );
    button.append(modeGlyph(mode), text);
    if (mode.type === 'tape') {
      const count = element('span', 'tool__count');
      tapeCounts.set(mode.kind, count);
      button.append(count);
    }
    button.onclick = () => {
      activeMode = mode;
      layer.setDragEnabled(mode.type !== 'delete');
      syncControls();
      if (mode.type === 'delete') {
        say('Delete boundary active. Tap any boundary to remove it; Undo restores it.');
      }
    };
    modeButtons.push({ mode, button });
    modes.append(button);
  }
  redraw();

  /** Replace the markings and forget the history: a new photo, or a restored draft. */
  const load = (next: readonly Annotation[], sequenceOn = showSequence) => {
    replaceAnnotations(next);
    showSequence = sequenceOn;
    undoStack.splice(0);
    redoStack.splice(0);
    redraw();
  };

  return {
    /** The wall photo the markings sit on. */
    stage: layer.element,
    /** Undo, redo, clear and the numbers switch, for the page to lay out. */
    actions: [undo, redo, reset, sequence.node],
    modes,
    summary,
    /** Show a new photo, with no markings on it. */
    showPhoto(url: string, size: Size) {
      load([]);
      layer.show(url, size);
    },
    removePhoto() {
      load([]);
      layer.hide();
    },
    replaceCandidates(boxes: readonly Box[]) {
      remember();
      replaceAnnotations(boxes.map(candidate));
      commit();
    },
    /** The selected holds, as published. */
    forPublish() {
      return { annotations: selectedAnnotations(annotations).map(cloneAnnotation), showSequence };
    },
    /** All markings, selected or not, for a draft. */
    forDraft(): MarkingState {
      return { annotations: copy(), showSequence };
    },
    restore: (state: MarkingState) => load(state.annotations, state.showSequence),
    onChange(listener: () => void) {
      changeListeners.push(listener);
    },
    /** While locked nothing can be changed; `scanning` shows the detector at work. */
    setLocked(value: boolean, scanning = false) {
      locked = value;
      layer.setLocked(value, scanning);
      syncControls();
    },
  };
}
