import { API_PATHS, ROUTE_FORM } from '../../src/client-contract.js';
import type { Gym, Route } from '../../src/client-contract.js';
import { WEB_PATHS } from '../../src/web-pages.js';
import {
  button,
  createStatus,
  element,
  gradeTag,
  iconNode,
  linkButton,
  setStatus,
  submitButton,
  textElement,
  type Tone,
} from '../dom.js';
import { browserRequest, errorMessage, isUnauthorized } from '../http.js';
import { redirectToLogin, storedSession } from '../session.js';
import { detectHolds } from './detector.js';
import { createDetailsForm } from './details-form.js';
import { createDraftAutosave } from './draft-autosave.js';
import { createDraftStore, type DraftStore } from './draft-store.js';
import './editor.css';
import { createMarkingEditor, type MarkingState } from './marking-editor.js';
import { createPhotoPicker } from './photo-picker.js';
import { renderRouteImages } from './route-image.js';
import { stepHead } from './step.js';

type Phase = 'idle' | 'detecting' | 'publishing' | 'published';

const NO_PHOTO_HINT = 'Choose a photo to start marking holds.';
/** How long a hint stays in the dock before it folds away; problems and successes stay. */
const HINT_VISIBLE_MS = 4000;

function noGymsCard() {
  const card = element('section', 'card');
  card.append(
    createStatus('No approved gyms yet. Request one on the gym map, then come back.'),
    linkButton('Request a gym', WEB_PATHS.gymMap)
  );
  return card;
}

export function mountEditor(
  main: HTMLElement,
  gyms: Gym[],
  owner: string,
  drafts: DraftStore = createDraftStore(owner)
) {
  if (!gyms.length) {
    main.append(noGymsCard());
    return;
  }

  const form = element('form', 'editor');
  // The steps (photo, holds, name) are checked in order and reported through the status line.
  form.noValidate = true;
  let phase: Phase = 'idle';

  // Step 1: details. Step 2: photo.
  const details = createDetailsForm(gyms);
  const picker = createPhotoPicker();
  const photoStep = element('section', 'step');
  photoStep.append(stepHead(2, 'Wall photo'), picker.element);

  // Step 3: the pieces of the workbench, which the stylesheet arranges.
  const status = createStatus(NO_PHOTO_HINT);
  let hintTimer: ReturnType<typeof setTimeout> | undefined;
  const say = (message: string, tone: Tone = 'info') => {
    clearTimeout(hintTimer);
    setStatus(status, message, tone);
    if (tone === 'info') {
      hintTimer = setTimeout(() => status.classList.add('is-idle'), HINT_VISIBLE_MS);
    }
  };
  const marking = createMarkingEditor(say);
  const autosave = createDraftAutosave(drafts, () => {
    const photo = picker.photo;
    if (!photo || phase === 'published') return null;
    return { photo: photo.file, details: { ...details.read(), markings: marking.forDraft() } };
  });

  const empty = element('div', 'stage-empty');
  empty.append(
    iconNode('photo', 'stage-empty__icon'),
    textElement('p', 'Your photo appears here', 'stage-empty__title'),
    textElement('p', 'Choose a wall photo in step 2.')
  );

  const discard = button('Discard draft', 'quiet', 'sm');
  discard.classList.add('draft-bar__discard');
  const draftBar = element('div', 'draft-bar');
  draftBar.append(autosave.note, discard);

  const detect = button('', 'secondary', 'sm');
  const detectLabel = textElement('span', 'Detect holds');
  detect.append(iconNode('detect'), detectLabel);
  const modelCost = textElement(
    'p',
    'The first time, Detect downloads the hold detector (about 11 MB, once). You can also mark holds by hand.',
    'workbench__hint'
  );
  modelCost.id = 'detect-cost';
  detect.setAttribute('aria-describedby', modelCost.id);
  const bar = element('div', 'workbench__bar');
  bar.append(detect, ...marking.actions);

  // "Publish" alone on a phone, where the dock is tight; "Publish route" where there is room.
  const submit = submitButton('', 'primary', 'lg');
  submit.classList.add('dock__submit');
  const submitLabel = textElement('span', 'Publish');
  const submitMore = textElement('span', ' route', 'btn__more');
  submit.append(iconNode('check'), submitLabel, submitMore);
  const publish = element('div', 'dock__publish');
  publish.append(submit);
  const dockFoot = element('div', 'dock__foot');
  dockFoot.append(marking.summary, publish);
  const dock = element('div', 'dock');
  dock.setAttribute('role', 'region');
  dock.setAttribute('aria-label', 'Tools and publish');
  dock.append(marking.modes, dockFoot);
  const finished = element('div', 'workbench__finished');

  const side = element('div', 'workbench__side');
  side.append(stepHead(3, 'Mark the holds'), draftBar, bar, modelCost, status, finished, dock);
  const workbench = element('div', 'workbench');
  workbench.append(side, empty, marking.stage);
  const marksStep = element('section', 'step');
  marksStep.append(workbench);

  const editing = () => picker.photo !== null && phase !== 'published';

  /** What shows depends on whether there is a photo, and on whether the route is out. */
  const updateLayout = () => {
    for (const part of [draftBar, bar, modelCost, dock]) part.hidden = !editing();
    // While editing, feedback sits in the dock, which is always in view; otherwise in the flow.
    if (editing()) dock.prepend(status);
    else side.insertBefore(status, finished);
  };

  /** Disabling controls drops the focus; it returns to the control that had it. */
  let focusBeforeBusy: HTMLElement | null = null;
  const setPhase = (next: Phase) => {
    if (phase === 'idle' && next !== 'idle') {
      const active = document.activeElement;
      focusBeforeBusy = active instanceof HTMLElement && form.contains(active) ? active : null;
    }
    phase = next;
    const busy = phase !== 'idle';
    const detecting = phase === 'detecting';
    const publishing = phase === 'publishing';
    picker.setDisabled(busy);
    detect.disabled = submit.disabled = discard.disabled = busy;
    details.setLocked(publishing || phase === 'published');
    marking.setLocked(busy, detecting);
    detectLabel.textContent = detecting ? 'Detecting…' : 'Detect holds';
    detect.classList.toggle('is-busy', detecting);
    detect.setAttribute('aria-busy', String(detecting));
    submitLabel.textContent = publishing ? 'Publishing…' : 'Publish';
    submitMore.hidden = publishing;
    submit.classList.toggle('is-busy', publishing);
    updateLayout();
    if (phase === 'idle') {
      focusBeforeBusy?.focus();
      focusBeforeBusy = null;
    }
  };

  /** The draft being brought back; its markings apply only to its own photo. */
  let restoring: { photo: File; markings: MarkingState } | undefined;
  /** Set once the climber picks a photo, after which a saved draft is no longer offered. */
  let photoChosen = false;

  picker.onPhoto((photo) => {
    photoChosen = true;
    empty.hidden = photo !== null;
    if (!photo) {
      marking.removePhoto();
      say(NO_PHOTO_HINT);
      updateLayout();
      return;
    }
    marking.showPhoto(photo.url, photo.size);
    const restored = restoring?.photo === photo.file ? restoring.markings : undefined;
    restoring = undefined;
    if (restored) marking.restore(restored);
    say(
      restored
        ? 'Restored your draft: the photo and markings saved on this device.'
        : 'Photo ready. Detect holds, or choose a hold type and tap the wall.'
    );
    updateLayout();
    void autosave.save();
  });
  marking.onChange(autosave.schedule);
  details.onInput(autosave.schedule);

  /** A fresh form, for another route or after discarding; gym and grade stay. */
  const startOver = () => {
    restoring = undefined;
    details.clearName(); // its input event schedules a save, which finds no photo ...
    picker.clear();
    finished.replaceChildren();
    setPhase('idle');
    void autosave.clear(); // ... and this, last, drops any save still waiting
  };
  discard.onclick = () => {
    if (!confirm('Discard this draft? Its photo and markings are deleted from this device.'))
      return;
    startOver();
    details.focusName();
  };

  detect.onclick = async () => {
    const photo = picker.photo;
    if (!photo) return; // the button is only there once there is a photo
    setPhase('detecting');
    say('Starting local hold detection…');
    try {
      const holds = await detectHolds(photo.file, say);
      marking.replaceCandidates(holds);
      say(`Found ${holds.length} possible holds. Choose a hold type, then tap route holds.`);
    } catch {
      say('Hold detection stopped. You can still place holds by hand, or try again.', 'error');
    } finally {
      setPhase('idle');
    }
  };

  const showPublished = (route: Route, routeName: string) => {
    const title = element('div');
    title.append(
      textElement('h3', 'Route published', 'display display--lg'),
      textElement('p', `${routeName} · ${details.gymName()}`, 'field__hint')
    );
    const heading = element('div', 'finished__head');
    heading.append(gradeTag(details.read().grade, 'tag--large tag--pinned'), title);
    const view = linkButton('View route', WEB_PATHS.route(route.id));
    const another = button('Add another', 'secondary');
    // The gym and grade stay: climbers usually log several routes from one wall.
    another.onclick = () => {
      startOver();
      details.focusName();
    };
    const actions = element('div', 'finished__actions');
    actions.append(view, another);
    finished.replaceChildren(heading, actions);
    say('Route published. It is now visible in the feed.', 'success');
    view.focus();
  };

  /** Signing in leaves the page, so the draft is stored first and comes back with the climber. */
  const signInAgain = async () => {
    await autosave.save();
    redirectToLogin();
  };

  form.onsubmit = async (event) => {
    event.preventDefault();
    if (phase !== 'idle') return;
    const photo = picker.photo;
    if (!photo) return say('Choose a photo first.', 'error');
    const holds = marking.forPublish();
    if (!holds.annotations.length) return say('Select at least one route hold first.', 'error');
    const { name, gymId, grade } = details.read();
    const routeName = name.trim();
    if (!routeName) {
      details.rejectName('Name the route before publishing.');
      return say('Name the route before publishing.', 'error');
    }
    const token = storedSession();
    if (!token) return signInAgain();

    setPhase('publishing');
    try {
      say('Preparing the published image…');
      const images = await renderRouteImages(
        photo.file,
        photo.size,
        holds.annotations,
        holds.showSequence
      );
      const body = new FormData();
      body.append(ROUTE_FORM.name, routeName);
      body.append(ROUTE_FORM.gym_id, gymId);
      body.append(ROUTE_FORM.owner_grade, grade);
      body.append(ROUTE_FORM.image, images.photo, images.photo.name);
      body.append(ROUTE_FORM.thumbnail, images.thumbnail, images.thumbnail.name);
      const route = await browserRequest<Route>(API_PATHS.routes, { method: 'POST', token, body });
      setPhase('published');
      void autosave.clear();
      showPublished(route, routeName);
    } catch (error) {
      setPhase('idle');
      if (isUnauthorized(error)) return signInAgain();
      say(errorMessage(error), 'error');
    }
  };

  form.append(details.element, photoStep, marksStep);
  setPhase('idle');
  main.append(form);

  // A draft left on this device comes back, unless the climber has already picked a photo.
  void autosave
    .load()
    .then((draft) => {
      if (!draft || photoChosen) return;
      restoring = { photo: draft.photo, markings: draft.details.markings };
      details.write(draft.details);
      picker.choose(draft.photo);
    })
    .catch(() => undefined);
}
