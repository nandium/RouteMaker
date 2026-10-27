import { element, iconNode } from '../dom.js';
import type { Draft, DraftStore } from './draft-store.js';

/** Autosave waits for a pause in editing, so a burst of taps writes once. */
const SAVE_DELAY_MS = 400;

/** What is on screen now, as a draft: null when there is nothing worth keeping. */
type Collect = () => Draft | null;

/**
 * Keeps the route being made on this device. `collect` says what to keep; `schedule` saves it
 * after a pause, `save` at once. `note` tells the climber whether the draft is safe.
 */
export function createDraftAutosave(store: DraftStore, collect: Collect) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The photo the store holds. It is written again only when the photo is a different file. */
  let storedPhoto: File | undefined;

  const note = element('p', 'draft-note');
  note.hidden = true;
  const showNote = (saved: boolean) => {
    note.replaceChildren(
      iconNode(saved ? 'check-circle' : 'alert'),
      saved ? 'Draft saved on this device' : 'This draft could not be saved on this device'
    );
    note.hidden = false;
  };

  async function save() {
    clearTimeout(timer);
    const draft = collect();
    if (!draft) return;
    try {
      await store.save(draft.details, draft.photo === storedPhoto ? undefined : draft.photo);
      storedPhoto = draft.photo;
      showNote(true);
    } catch {
      showNote(false);
    }
  }

  return {
    note,
    /** The draft left on this device, if any; its photo counts as stored. */
    async load(): Promise<Draft | null> {
      const draft = await store.load();
      if (draft) storedPhoto = draft.photo;
      return draft;
    },
    schedule() {
      clearTimeout(timer);
      timer = setTimeout(() => void save(), SAVE_DELAY_MS);
    },
    save,
    /** Forget the draft, here and on the device; a save still waiting is dropped. */
    async clear() {
      clearTimeout(timer);
      storedPhoto = undefined;
      await store.clear().catch(() => undefined);
    },
  };
}
