import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allByRole, byRole, installDom, queryByRole } from '../test-dom.js';
import { createMarkingEditor } from './marking-editor.js';

const oneHold = [{ x: 0.4, y: 0.4, width: 0.1, height: 0.1 }];

function mount() {
  const say = vi.fn();
  const onChange = vi.fn();
  const editor = createMarkingEditor(say);
  editor.onChange(onChange);
  const { stage } = editor;
  stage.getBoundingClientRect = () =>
    ({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 600,
      width: 1000,
      height: 600,
    }) as DOMRect;
  editor.showPhoto('blob:wall', { width: 1000, height: 600 });
  document.body.append(...editor.actions, editor.modes, editor.summary, stage);
  onChange.mockClear();
  return {
    editor,
    stage,
    say,
    onChange,
    control: (name: string | RegExp) => byRole<HTMLButtonElement>(document.body, 'button', name),
    tool: (name: string) => byRole<HTMLButtonElement>(editor.modes, 'button', name),
    holds: () =>
      allByRole<HTMLButtonElement>(stage, 'button', /hold/).filter(
        (node) => !/^Remove/.test(node.getAttribute('aria-label')!)
      ),
    tapes: (kind: 'start' | 'finish') =>
      allByRole<HTMLButtonElement>(stage, 'button', new RegExp(`^Remove one of .* ${kind} tape`)),
    numbers: () => byRole<HTMLButtonElement>(document.body, 'switch'),
    summary: () => editor.summary.getAttribute('aria-label'),
    key: (key: string) =>
      stage.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true })),
  };
}

describe('marking editor', () => {
  beforeEach(() => {
    installDom();
  });
  afterEach(() => vi.unstubAllGlobals());

  describe('marking holds', () => {
    it('marks and unmarks a hold with the chosen limb', () => {
      const { editor, tool, holds, say } = mount();
      editor.replaceCandidates(oneHold);

      tool('Hand only').click();
      holds()[0].click();
      expect(holds()[0].getAttribute('aria-label')).toBe('Hand only route hold, marker 1');
      expect(editor.forPublish().annotations).toMatchObject([{ use: 'hand', order: 1 }]);
      expect(say).toHaveBeenLastCalledWith('Marked hold 1 as hand only.');

      holds()[0].click();
      expect(holds()[0].getAttribute('aria-pressed')).toBe('false');
      expect(editor.forPublish().annotations).toEqual([]);
      expect(say).toHaveBeenLastCalledWith('Hold unmarked.');
    });

    it('adds a boundary where the keyboard cursor stops, with the active limb', () => {
      const { stage, tool, holds, key, say } = mount();
      tool('Foot only').click();
      stage.focus();

      key('ArrowRight');
      key('Enter');

      expect(holds()).toHaveLength(1);
      expect(holds()[0].getAttribute('aria-label')).toBe('Foot only route hold, marker F');
      expect(say).toHaveBeenCalledWith(expect.stringContaining('boundary added'));
    });

    it('numbers a new hold after the highest marker still in use', () => {
      const { editor, tool, holds } = mount();
      editor.replaceCandidates([
        { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        { x: 0.4, y: 0.1, width: 0.1, height: 0.1 },
        { x: 0.7, y: 0.1, width: 0.1, height: 0.1 },
      ]);
      tool('Hand only').click();
      holds()[0].click();
      holds()[1].click();

      holds()[0].click();
      holds()[2].click();

      expect(editor.forPublish().annotations.map(({ order }) => order)).toEqual([2, 3]);
    });

    it('clears selections but keeps the detected boundaries', () => {
      const { editor, control, holds } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();

      control('Clear route markings').click();

      expect(holds()[0].getAttribute('aria-label')).toContain('not selected');
      expect(control('Clear route markings').disabled).toBe(true);
    });
  });

  describe('the tools', () => {
    it('are six, each showing the mark it draws, with one pressed at a time', () => {
      const { tool, editor } = mount();

      expect(
        allByRole(editor.modes, 'button').map((node) => node.getAttribute('aria-label'))
      ).toEqual([
        'Any limb',
        'Hand only',
        'Foot only',
        'Start tape, 0 of 4 used',
        'Finish tape, 0 of 2 used',
        'Delete boundary',
      ]);
      expect(tool('Any limb').getAttribute('aria-pressed')).toBe('true');
      expect(tool('Hand only').querySelector('svg circle')).not.toBeNull();
      expect(editor.modes.getAttribute('role')).toBe('group');

      tool('Hand only').click();

      expect(tool('Any limb').getAttribute('aria-pressed')).toBe('false');
      expect(tool('Hand only').getAttribute('aria-pressed')).toBe('true');
    });

    it('count their tape as it is placed and flag a full set', () => {
      const { editor, tool, holds } = mount();
      editor.replaceCandidates(oneHold);
      tool('Finish tape, 0 of 2 used').click();

      holds()[0].click();
      expect(tool('Finish tape, 1 of 2 used').textContent).toContain('1/2');
      expect(tool('Finish tape, 1 of 2 used').classList.contains('is-full')).toBe(false);

      holds()[0].click();
      expect(tool('Finish tape, 2 of 2 used').classList.contains('is-full')).toBe(true);
    });
  });

  describe('deleting, undoing and redoing', () => {
    it('deletes a boundary on request and brings it back with undo', () => {
      const { editor, control, tool, holds, say } = mount();
      editor.replaceCandidates(oneHold);

      tool('Delete boundary').click();
      expect(say).toHaveBeenCalledWith(expect.stringContaining('Delete boundary active'));
      holds()[0].click();
      expect(holds()).toHaveLength(0);

      control('Undo last change').click();
      expect(holds()).toHaveLength(1);
    });

    it('redoes what was undone, until something new is done', () => {
      const { editor, control, holds, tool } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();
      expect(control('Redo last change').disabled).toBe(true);

      control('Undo last change').click();
      expect(editor.forPublish().annotations).toEqual([]);
      expect(control('Redo last change').disabled).toBe(false);

      control('Redo last change').click();
      expect(editor.forPublish().annotations).toHaveLength(1);
      expect(control('Redo last change').disabled).toBe(true);

      control('Undo last change').click();
      tool('Hand only').click();
      holds()[0].click();
      expect(control('Redo last change').disabled).toBe(true);
    });

    it('makes a detection undoable', () => {
      const { editor, control, holds } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();

      editor.replaceCandidates([
        { x: 0.1, y: 0.1, width: 0.1, height: 0.1 },
        { x: 0.7, y: 0.1, width: 0.1, height: 0.1 },
      ]);
      expect(holds()).toHaveLength(2);
      expect(editor.forPublish().annotations).toEqual([]);

      control('Undo last change').click();
      expect(holds()).toHaveLength(1);
      expect(editor.forPublish().annotations).toHaveLength(1);
    });

    it('has nothing to undo or clear on a new photo', () => {
      const { editor, control, holds } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();

      editor.showPhoto('blob:next', { width: 800, height: 800 });

      expect(holds()).toHaveLength(0);
      expect(control('Undo last change').disabled).toBe(true);
      expect(control('Redo last change').disabled).toBe(true);
      expect(control('Clear route markings').disabled).toBe(true);
    });

    it('hides the wall and forgets its markings when the photo is removed', () => {
      const { editor, stage, holds, control } = mount();
      editor.replaceCandidates(oneHold);

      editor.removePhoto();

      expect(stage.hidden).toBe(true);
      expect(holds()).toHaveLength(0);
      expect(control('Undo last change').disabled).toBe(true);
    });
  });

  describe('numbers', () => {
    it('are a switch between sequence numbers and limb letters', () => {
      const { editor, holds, tool, numbers, say } = mount();
      editor.replaceCandidates(oneHold);
      tool('Hand only').click();
      holds()[0].click();
      expect(numbers().getAttribute('aria-checked')).toBe('true');
      expect(holds()[0].getAttribute('aria-label')).toContain('marker 1');

      numbers().click();

      expect(numbers().getAttribute('aria-checked')).toBe('false');
      expect(holds()[0].getAttribute('aria-label')).toContain('marker H');
      expect(say).toHaveBeenLastCalledWith(expect.stringContaining('letters'));
      expect(editor.forPublish().showSequence).toBe(false);
    });
  });

  describe('tape', () => {
    it('caps a start tape group and reports the limit', () => {
      const { editor, tool, holds, tapes, say } = mount();
      editor.replaceCandidates(oneHold);
      tool('Start tape, 0 of 4 used').click();

      for (let tap = 0; tap < 5; tap += 1) holds()[0].click();

      expect(tapes('start')).toHaveLength(1);
      expect(tapes('start')[0].getAttribute('aria-label')).toContain('4 start tape strips');
      expect(say).toHaveBeenLastCalledWith(
        expect.stringContaining('already at its 4-strip limit'),
        'error'
      );
    });

    it('tells how many strips are used as each is added', () => {
      const { editor, tool, holds, say } = mount();
      editor.replaceCandidates(oneHold);
      tool('Start tape, 0 of 4 used').click();

      holds()[0].click();
      holds()[0].click();

      expect(say).toHaveBeenLastCalledWith('Added a start tape strip. 2 of 4 used.', 'success');
    });

    it('removes strips one at a time, undoably', () => {
      const { editor, control, tool, holds, tapes } = mount();
      editor.replaceCandidates(oneHold);
      tool('Start tape, 0 of 4 used').click();
      for (let tap = 0; tap < 3; tap += 1) holds()[0].click();

      tapes('start')[0].dispatchEvent(new window.MouseEvent('click', { bubbles: true, detail: 0 }));
      expect(tapes('start')[0].getAttribute('aria-label')).toContain('2 start tape strips');

      control('Undo last change').click();
      expect(tapes('start')[0].getAttribute('aria-label')).toContain('3 start tape strips');
    });

    it('drops the tape button once its last strip is removed', () => {
      const { editor, tool, holds, tapes } = mount();
      editor.replaceCandidates(oneHold);
      tool('Finish tape, 0 of 2 used').click();
      holds()[0].click();

      tapes('finish')[0].dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, detail: 0 })
      );

      expect(tapes('finish')).toHaveLength(0);
    });

    it('keeps start and finish exclusive on a hold and counts them', () => {
      const { editor, tool, holds, tapes, summary } = mount();
      editor.replaceCandidates(oneHold);
      tool('Start tape, 0 of 4 used').click();
      holds()[0].click();
      tool('Finish tape, 0 of 2 used').click();
      holds()[0].click();

      expect(tapes('start')).toHaveLength(0);
      expect(tapes('finish')).toHaveLength(1);
      expect(summary()).toBe('1 hold, 0 of 4 start tape, 1 of 2 finish tape');
    });

    it('selects an unselected hold when tape is added to it', () => {
      const { editor, tool, holds } = mount();
      editor.replaceCandidates(oneHold);
      tool('Start tape, 0 of 4 used').click();

      holds()[0].click();

      expect(editor.forPublish().annotations).toMatchObject([{ use: 'any', tapes: { start: 1 } }]);
    });
  });

  describe('drafts', () => {
    it('hands out every marking, selected or not, and takes them back', () => {
      const { editor, tool, holds, numbers } = mount();
      editor.replaceCandidates([...oneHold, { x: 0.7, y: 0.1, width: 0.1, height: 0.1 }]);
      tool('Hand only').click();
      holds()[0].click();
      numbers().click();
      const saved = editor.forDraft();
      expect(saved.annotations).toHaveLength(2);

      editor.showPhoto('blob:other', { width: 1000, height: 600 });
      expect(editor.forDraft().annotations).toEqual([]);
      editor.restore(saved);

      expect(holds()).toHaveLength(2);
      expect(editor.forPublish().annotations).toMatchObject([{ use: 'hand' }]);
      expect(numbers().getAttribute('aria-checked')).toBe('false');
    });

    it('starts a restored session with nothing to undo', () => {
      const { editor, holds, control } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();

      editor.restore(editor.forDraft());

      expect(control('Undo last change').disabled).toBe(true);
    });

    it('tells the page about each change the user makes, but not about restores', () => {
      const { editor, onChange, holds, control, numbers } = mount();
      editor.replaceCandidates(oneHold);
      holds()[0].click();
      control('Undo last change').click();
      control('Redo last change').click();
      numbers().click();
      control('Clear route markings').click();
      expect(onChange).toHaveBeenCalledTimes(6);

      onChange.mockClear();
      editor.restore({ annotations: [], showSequence: true });
      editor.showPhoto('blob:other', { width: 10, height: 10 });
      editor.removePhoto();

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('locking', () => {
    it('disables every control and the wall until unlocked', () => {
      const { editor, control, tool, holds, stage, key, numbers } = mount();
      editor.replaceCandidates(oneHold);
      stage.focus();

      editor.setLocked(true);
      key('Enter');

      expect(holds()).toHaveLength(1);
      expect(holds()[0].disabled).toBe(true);
      expect(tool('Hand only').disabled).toBe(true);
      expect(numbers().disabled).toBe(true);
      expect(control('Undo last change').disabled).toBe(true);

      editor.setLocked(false);
      key('Enter');
      expect(holds()).toHaveLength(2);
      expect(queryByRole(document.body, 'switch')!.hasAttribute('disabled')).toBe(false);
    });

    it('shows the detector sweeping the wall while it works', () => {
      const { editor, stage } = mount();

      editor.setLocked(true, true);

      expect(stage.classList.contains('is-scanning')).toBe(true);
    });
  });
});
