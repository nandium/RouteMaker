import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS, DEFAULT_GRADE } from '../../src/client-contract.js';
import type { Gym } from '../../src/client-contract.js';
import { ApiError, browserRequest } from '../http.js';
import { STORAGE_KEYS } from '../storage.js';
import {
  allByRole,
  byRole,
  installDom,
  queryByRole,
  queryByText,
  settle,
  statusLine,
  stubImage,
  stubNavigation,
} from '../test-dom.js';
import { detectHolds } from './detector.js';
import type { Draft, DraftStore } from './draft-store.js';
import { mountEditor } from './editor.js';
import { renderRouteImages } from './route-image.js';

vi.mock('./detector.js', () => ({ detectHolds: vi.fn() }));
vi.mock('./editor.css', () => ({}));
vi.mock('./route-image.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./route-image.js')>()),
  renderRouteImages: vi.fn(),
}));
vi.mock('../http.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../http.js')>()),
  browserRequest: vi.fn(),
}));

const gym = (id: string, name: string): Gym => ({
  id,
  name,
  address: '1 Test Street',
  country_code: 'SG',
  latitude: 1.3,
  longitude: 103.8,
  status: 'approved',
});
const gyms = [gym('gym', 'Test Gym'), gym('other', 'Other Gym')];
const jpeg = (name: string) => new File(['jpeg'], name, { type: 'image/jpeg' });
const detection = { x: 0.4, y: 0.4, width: 0.1, height: 0.1, confidence: 0.9 };
/** A little longer than the editor waits for a pause in editing before it saves. */
const AUTOSAVE_WAIT_MS = 500;
/** Longer than a hint stays in the dock. */
const HINT_WAIT_MS = 5000;

let navigation: ReturnType<typeof stubNavigation>;
let images: ReturnType<typeof stubImage>;

/** An in-memory stand-in for the device's draft storage. */
function fakeDrafts(initial: Draft | null = null) {
  let draft = initial;
  return {
    load: vi.fn(async () => draft),
    save: vi.fn(async (details, photo?: File) => {
      draft = { photo: photo ?? draft!.photo, details };
    }),
    clear: vi.fn(async () => {
      draft = null;
    }),
  } satisfies DraftStore;
}

function mount(options: { gyms?: Gym[]; drafts?: ReturnType<typeof fakeDrafts> } = {}) {
  const root = document.createElement('main');
  document.body.append(root);
  const drafts = options.drafts ?? fakeDrafts();
  mountEditor(root, options.gyms ?? gyms, 'u1', drafts);
  const photoInput = root.querySelector<HTMLInputElement>('input[type="file"]')!;
  // Found by label even while hidden, which a role query would skip.
  const stage = root.querySelector<HTMLElement>('[aria-label^="Wall photo hold editor"]')!;
  if (stage) stage.getBoundingClientRect = () => ({ width: 1000, height: 600 }) as DOMRect;
  const dock = root.querySelector<HTMLElement>('[aria-label="Tools and publish"]')!;
  const control = (name: string | RegExp) => byRole<HTMLButtonElement>(root, 'button', name);
  const gradeInput = (grade: string) =>
    allByRole<HTMLInputElement>(root, 'radio').find((radio) => radio.value === grade)!;

  return {
    root,
    drafts,
    stage,
    dock,
    control,
    gradeInput,
    holds: () => allByRole<HTMLButtonElement>(root, 'button', /route hold|Detected hold/),
    nameField: () => byRole<HTMLInputElement>(root, 'textbox', 'Route name'),
    gymSelect: () => byRole<HTMLSelectElement>(root, 'combobox', 'Gym'),
    chosenGrade: () =>
      allByRole<HTMLInputElement>(root, 'radio').find((radio) => radio.checked)?.value,
    publishButton: () => queryByRole<HTMLButtonElement>(root, 'button', /^Publish|^Publishing/),
    /** The message the editor is showing, wherever it sits. */
    status: () => statusLine(root),
    /** Pick a file and let the browser report its size. */
    choosePhoto(
      size = { width: 1600, height: 960 },
      file = new File(['photo'], 'wall.jpg', { type: 'image/jpeg' })
    ) {
      Object.defineProperty(photoInput, 'files', { configurable: true, value: [file] });
      photoInput.dispatchEvent(new window.Event('change', { bubbles: true }));
      images.load(size);
      return file;
    },
    photoInput,
    submit: () => root.querySelector('form')!.requestSubmit(),
    async detect() {
      control(/^Detect holds/).click();
      await settle();
    },
  };
}

describe('route editor', () => {
  beforeEach(() => {
    // The editor's waits (autosave, hints) pass only when a test says so.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    installDom('http://localhost/routes/new');
    images = stubImage();
    vi.clearAllMocks();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:wall');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    navigation = stubNavigation();
    localStorage.setItem(STORAGE_KEYS.session, 'test-session');
    vi.mocked(detectHolds).mockResolvedValue([detection]);
    vi.mocked(renderRouteImages).mockResolvedValue({
      photo: jpeg('route.jpg'),
      thumbnail: jpeg('thumbnail.jpg'),
    });
    vi.mocked(browserRequest).mockResolvedValue({ id: 'route-1' });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('the form', () => {
    it('offers the approved gyms and the default grade', () => {
      const { gymSelect, chosenGrade, root } = mount();

      expect([...gymSelect().options].map((option) => option.textContent)).toEqual([
        'Test Gym',
        'Other Gym',
      ]);
      expect(chosenGrade()).toBe(DEFAULT_GRADE);
      expect(allByRole(root, 'radio')).toHaveLength(18);
    });

    it('counts the characters of the name', () => {
      const { nameField, root } = mount();

      nameField().value = 'Hush';
      nameField().dispatchEvent(new window.Event('input', { bubbles: true }));

      expect(queryByText(root, '4/80')).not.toBeNull();
    });

    it('preselects the gym named in the address and says so', () => {
      installDom('http://localhost/routes/new?gym=other');
      const { gymSelect, root } = mount();

      expect(gymSelect().value).toBe('other');
      expect(
        queryByText(root, 'Preselected from Other Gym. Change it if the route is elsewhere.')
      ).not.toBeNull();
    });

    it('ignores an unknown gym in the address', () => {
      installDom('http://localhost/routes/new?gym=nowhere');
      const { gymSelect, root } = mount();

      expect(gymSelect().value).toBe('gym');
      expect(queryByText(root, 'Preselected')).toBeNull();
    });

    it('points to the gym map when there is no gym to publish to', () => {
      const { root } = mount({ gyms: [] });

      expect(queryByRole(root, 'combobox', 'Gym')).toBeNull();
      expect(queryByRole(root, 'button', /^Publish/)).toBeNull();
      expect(byRole(root, 'link', 'Request a gym').getAttribute('href')).toBe('/gyms/map');
    });
  });

  describe('choosing a photo', () => {
    it('shows the photo at its own aspect ratio, with the tools to mark it', () => {
      const { choosePhoto, stage, dock, root, status } = mount();
      expect(stage.hidden).toBe(true);
      expect(dock.hidden).toBe(true);
      expect(queryByText(root, 'Your photo appears here')).not.toBeNull();

      choosePhoto({ width: 1600, height: 960 });

      expect(stage.hidden).toBe(false);
      expect(stage.style.aspectRatio).toBe('1600 / 960');
      expect(dock.hidden).toBe(false);
      expect(queryByText(root, 'Your photo appears here')).toBeNull();
      expect(queryByText(root, 'wall.jpg')).not.toBeNull();
      expect(status().textContent).toContain('Photo ready');
    });

    it('keeps a photo that cannot be marked off the wall and says why', () => {
      const { choosePhoto, stage, root } = mount();

      choosePhoto({ width: 63, height: 800 });

      expect(stage.hidden).toBe(true);
      expect(byRole(root, 'alert').textContent).toContain('at least 64 pixels');
    });

    it('starts the markings over when another photo is chosen', async () => {
      const { choosePhoto, detect, holds } = mount();
      choosePhoto();
      await detect();
      expect(holds()).toHaveLength(1);

      choosePhoto();

      expect(holds()).toHaveLength(0);
    });
  });

  describe('feedback', () => {
    it('shows in the dock while there is a photo to mark, where it is always in view', () => {
      const { choosePhoto, dock, status } = mount();
      expect(dock.contains(status())).toBe(false);

      choosePhoto();

      expect(dock.contains(status())).toBe(true);
    });

    it('goes back into the page when the photo goes, so the hint is there to read', () => {
      const { choosePhoto, control, dock, status } = mount();
      choosePhoto();

      control('Discard draft').click();

      expect(dock.contains(status())).toBe(false);
      expect(status().textContent).toBe('Choose a photo to start marking holds.');
    });

    it('folds a hint away after a few seconds, to keep the dock short', () => {
      const { choosePhoto, status } = mount();

      choosePhoto();
      expect(status().classList.contains('is-idle')).toBe(false);
      vi.advanceTimersByTime(HINT_WAIT_MS);

      expect(status().classList.contains('is-idle')).toBe(true);
    });

    it('brings the hint back, in full, with the next message', () => {
      const { choosePhoto, control, status } = mount();
      choosePhoto();
      vi.advanceTimersByTime(HINT_WAIT_MS);

      control('Hand only').click();
      control('Delete boundary').click();

      expect(status().classList.contains('is-idle')).toBe(false);
    });

    it('keeps a problem up', () => {
      const { choosePhoto, control, stage, status } = mount();
      choosePhoto();
      control(/^Start tape/).click();
      for (let tap = 0; tap < 5; tap += 1) {
        stage.dispatchEvent(
          new window.MouseEvent('click', { bubbles: true, clientX: 500, clientY: 300, detail: 1 })
        );
      }
      vi.advanceTimersByTime(HINT_WAIT_MS);

      expect(status().textContent).toContain('already at its 4-strip limit');
      expect(status().classList.contains('is-idle')).toBe(false);
    });
  });

  describe('detecting holds', () => {
    it('states the one-off model download before it is pressed', () => {
      const { choosePhoto, control } = mount();
      choosePhoto();

      const note = document.getElementById(
        control('Detect holds').getAttribute('aria-describedby')!
      );

      expect(note!.textContent).toContain('about 11 MB, once');
    });

    it('offers the detected holds and keeps focus on the button', async () => {
      const { choosePhoto, control, detect, holds, status } = mount();
      const file = choosePhoto();
      control('Detect holds').focus();

      await detect();

      expect(detectHolds).toHaveBeenCalledWith(file, expect.any(Function));
      expect(holds().map((node) => node.getAttribute('aria-label'))).toEqual([
        'Detected hold 1 of 1, not selected',
      ]);
      expect(status().textContent).toContain('Found 1 possible holds');
      expect(document.activeElement).toBe(control('Detect holds'));
    });

    it('locks the editor while it runs, shows its progress, and unlocks after', async () => {
      let finish!: (holds: (typeof detection)[]) => void;
      vi.mocked(detectHolds).mockImplementation((_image, onProgress) => {
        onProgress('Loading the hold detector…');
        return new Promise((resolve) => (finish = resolve));
      });
      const { choosePhoto, control, photoInput, stage, status, holds } = mount();
      choosePhoto();

      control('Detect holds').click();

      expect(photoInput.disabled).toBe(true);
      expect(control('Detecting…').disabled).toBe(true);
      expect(control('Detecting…').classList.contains('is-busy')).toBe(true);
      expect(control('Undo last change').disabled).toBe(true);
      expect(control('Any limb').disabled).toBe(true);
      expect(stage.getAttribute('aria-busy')).toBe('true');
      expect(stage.classList.contains('is-scanning')).toBe(true);
      expect(status().textContent).toBe('Loading the hold detector…');

      finish([detection]);
      await settle();

      expect(photoInput.disabled).toBe(false);
      expect(control('Any limb').disabled).toBe(false);
      expect(stage.getAttribute('aria-busy')).toBe('false');
      expect(holds()).toHaveLength(1);
    });

    it('fails without blocking: holds can still be placed by hand, or detection tried again', async () => {
      vi.mocked(detectHolds).mockRejectedValueOnce(new Error('Worker crashed'));
      const { choosePhoto, control, detect, root, holds, stage, status } = mount();
      choosePhoto();

      await detect();
      expect(byRole(root, 'alert').textContent).toBe(
        'Hold detection stopped. You can still place holds by hand, or try again.'
      );
      expect(control('Detect holds').disabled).toBe(false);
      expect(stage.getAttribute('aria-busy')).toBe('false');
      expect(control('Any limb').disabled).toBe(false);
      stage.dispatchEvent(
        new window.MouseEvent('click', { bubbles: true, clientX: 500, clientY: 300, detail: 1 })
      );
      expect(holds()).toHaveLength(1);

      await detect();
      expect(holds()).toHaveLength(1);
      expect(status().textContent).toContain('Found 1 possible holds');
    });
  });

  describe('publishing', () => {
    async function readyToPublish() {
      const page = mount();
      const file = page.choosePhoto({ width: 1600, height: 960 });
      await page.detect();
      page.holds()[0].click();
      page.nameField().value = '  Test route  ';
      return { ...page, file };
    }

    it('asks for a photo, a route hold and a name, in that order', async () => {
      const page = mount();
      page.submit();
      expect(page.status().textContent).toBe('Choose a photo first.');

      page.choosePhoto();
      page.submit();
      expect(page.status().textContent).toBe('Select at least one route hold first.');

      await page.detect();
      page.holds()[0].click();
      page.submit();
      expect(page.status().textContent).toBe('Name the route before publishing.');
      expect(document.activeElement).toBe(page.nameField());
      expect(renderRouteImages).not.toHaveBeenCalled();
    });

    it('puts the missing name under the name field, and takes it away when one is typed', async () => {
      const page = mount();
      page.choosePhoto();
      await page.detect();
      page.holds()[0].click();

      page.submit();

      const name = page.nameField();
      expect(name.getAttribute('aria-invalid')).toBe('true');
      const described = document.getElementById(
        name.getAttribute('aria-describedby')!.split(' ').pop()!
      );
      expect(described!.textContent).toBe('Name the route before publishing.');

      name.value = 'Hush';
      name.dispatchEvent(new window.Event('input', { bubbles: true }));

      expect(name.hasAttribute('aria-invalid')).toBe(false);
    });

    it('renders the photo and thumbnail and uploads both with the session token', async () => {
      const { file, submit, root } = await readyToPublish();
      byRole(root, 'switch').click();

      submit();
      await settle();

      expect(renderRouteImages).toHaveBeenCalledWith(
        file,
        { width: 1600, height: 960 },
        [expect.objectContaining({ use: 'any', order: 1 })],
        false
      );
      const [path, init] = vi.mocked(browserRequest).mock.calls[0];
      const body = init!.body as FormData;
      expect(path).toBe(API_PATHS.routes);
      expect(init).toMatchObject({ method: 'POST', token: 'test-session' });
      expect(
        Object.fromEntries(
          [...body.entries()].map(([key, value]) => [
            key,
            typeof value === 'string' ? value : value.name,
          ])
        )
      ).toEqual({
        name: 'Test route',
        gym_id: 'gym',
        owner_grade: DEFAULT_GRADE,
        image: 'route.jpg',
        thumbnail: 'thumbnail.jpg',
      });
    });

    it('publishes to the gym and grade the climber chose', async () => {
      const { submit, gymSelect, gradeInput } = await readyToPublish();
      gymSelect().value = 'other';
      gradeInput('V7').click();

      submit();
      await settle();

      const body = vi.mocked(browserRequest).mock.calls[0][1]!.body as FormData;
      expect([body.get('gym_id'), body.get('owner_grade')]).toEqual(['other', 'V7']);
    });

    it('locks the form while uploading and ignores a second submit', async () => {
      let finish!: (route: { id: string }) => void;
      vi.mocked(browserRequest).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const { submit, publishButton, nameField, photoInput, control, gradeInput } =
        await readyToPublish();

      submit();
      await settle();
      submit();
      await settle();

      expect(browserRequest).toHaveBeenCalledOnce();
      expect(publishButton()!.disabled).toBe(true);
      expect(queryByText(publishButton()!, 'Publishing…')).not.toBeNull();
      expect(queryByText(publishButton()!, ' route')).toBeNull();
      expect(publishButton()!.classList.contains('is-busy')).toBe(true);
      expect(nameField().disabled).toBe(true);
      expect(gradeInput('V1').disabled).toBe(true);
      expect(photoInput.disabled).toBe(true);
      expect(control('Undo last change').disabled).toBe(true);

      finish({ id: 'route-1' });
      await settle();
    });

    it('links to the new route, and "Add another" starts afresh in the same gym and grade', async () => {
      const {
        submit,
        root,
        publishButton,
        nameField,
        gymSelect,
        stage,
        dock,
        holds,
        choosePhoto,
        gradeInput,
      } = await readyToPublish();
      gymSelect().value = 'other';
      gradeInput('V7').click();

      submit();
      await settle();

      expect(byRole(root, 'link', 'View route').getAttribute('href')).toBe('/routes/route-1');
      expect(byRole(root, 'heading', 'Route published')).toBeTruthy();
      expect(queryByText(root, 'Test route · Other Gym')).not.toBeNull();
      expect(queryByText(root, 'V7')).not.toBeNull();
      expect(nameField().disabled).toBe(true);
      expect(dock.hidden).toBe(true);

      byRole(root, 'button', 'Add another').click();

      expect(nameField().value).toBe('');
      expect(nameField().disabled).toBe(false);
      expect(gymSelect().value).toBe('other');
      expect(gradeInput('V7').checked).toBe(true);
      expect(stage.hidden).toBe(true);
      expect(holds()).toHaveLength(0);
      expect(queryByRole(root, 'heading', 'Route published')).toBeNull();
      choosePhoto();
      expect(stage.hidden).toBe(false);
      expect(publishButton()!.textContent).toBe('Publish route');
      expect(publishButton()!.disabled).toBe(false);
    });

    it('shows a failed upload, allows another attempt, and returns focus to Publish', async () => {
      vi.mocked(browserRequest).mockRejectedValueOnce(
        new ApiError('Daily route limit reached', 429)
      );
      const { submit, root, publishButton, nameField, control } = await readyToPublish();
      control(/^Publish/).focus();

      submit();
      await settle();

      expect(byRole(root, 'alert').textContent).toBe('Daily route limit reached');
      expect(publishButton()!.disabled).toBe(false);
      expect(publishButton()!.textContent).toBe('Publish route');
      expect(publishButton()!.classList.contains('is-busy')).toBe(false);
      expect(nameField().disabled).toBe(false);
      expect(document.activeElement).toBe(publishButton());
    });

    it('shows a rendering failure the same way', async () => {
      vi.mocked(renderRouteImages).mockRejectedValueOnce(
        new Error('This photo cannot be compressed enough to publish.')
      );
      const { submit, root } = await readyToPublish();

      submit();
      await settle();

      expect(byRole(root, 'alert').textContent).toContain('cannot be compressed');
      expect(browserRequest).not.toHaveBeenCalled();
    });

    it('keeps the draft when the session is rejected, then sends the visitor to sign in', async () => {
      vi.mocked(browserRequest).mockRejectedValueOnce(new ApiError('Session expired.', 401));
      const { submit, root, drafts } = await readyToPublish();
      drafts.save.mockClear();

      submit();
      await settle();

      expect(drafts.save).toHaveBeenCalledOnce();
      expect(drafts.save.mock.calls[0][0]).toMatchObject({ name: '  Test route  ' });
      expect(navigation.assign).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew');
      expect(queryByRole(root, 'alert')).toBeNull();
    });

    it('keeps the draft when the session vanished before publishing', async () => {
      const { submit, drafts } = await readyToPublish();
      drafts.save.mockClear();
      localStorage.removeItem(STORAGE_KEYS.session);

      submit();
      await settle();

      expect(drafts.save).toHaveBeenCalledOnce();
      expect(navigation.assign).toHaveBeenCalledWith('/login?next=%2Froutes%2Fnew');
      expect(renderRouteImages).not.toHaveBeenCalled();
    });
  });

  describe('drafts', () => {
    const savedDraft = (): Draft => ({
      photo: jpeg('saved.jpg'),
      details: {
        name: 'Hush',
        gymId: 'other',
        grade: 'V7',
        markings: {
          showSequence: false,
          annotations: [
            { ...detection, use: 'hand', order: 1, tapes: { start: 1, finish: 0 } },
            {
              x: 0.1,
              y: 0.1,
              width: 0.1,
              height: 0.1,
              use: null,
              order: null,
              tapes: { start: 0, finish: 0 },
            },
          ],
        },
      },
    });

    it('keeps the photo as soon as it loads, and says so', async () => {
      const { choosePhoto, drafts, root } = mount();

      const file = choosePhoto();
      await settle();

      expect(drafts.save).toHaveBeenCalledWith(
        expect.objectContaining({ name: '', gymId: 'gym', grade: DEFAULT_GRADE }),
        file
      );
      expect(queryByText(root, 'Draft saved on this device')).not.toBeNull();
    });

    it('keeps markings and details after a pause in editing, without the photo again', async () => {
      const { choosePhoto, detect, holds, nameField, drafts } = mount();
      choosePhoto();
      await settle();
      drafts.save.mockClear();

      await detect();
      holds()[0].click();
      nameField().value = 'Hush';
      nameField().dispatchEvent(new window.Event('input', { bubbles: true }));
      expect(drafts.save).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);

      expect(drafts.save).toHaveBeenCalledOnce();
      const [details, photo] = drafts.save.mock.calls[0];
      expect(photo).toBeUndefined();
      expect(details.name).toBe('Hush');
      expect(details.markings.annotations).toMatchObject([{ use: 'any', order: 1 }]);
    });

    it('warns when the draft cannot be kept', async () => {
      const drafts = fakeDrafts();
      drafts.save.mockRejectedValue(new Error('Quota exceeded'));
      const { choosePhoto, root } = mount({ drafts });

      choosePhoto();
      await settle();

      expect(queryByText(root, 'This draft could not be saved on this device')).not.toBeNull();
    });

    it('sends the photo again with the next save when the first could not be stored', async () => {
      const drafts = fakeDrafts();
      drafts.save.mockRejectedValueOnce(new Error('Quota exceeded'));
      const { choosePhoto, nameField, root } = mount({ drafts });
      const file = choosePhoto();
      await settle();
      expect(queryByText(root, 'could not be saved')).not.toBeNull();

      nameField().value = 'Hush';
      nameField().dispatchEvent(new window.Event('input', { bubbles: true }));
      await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);

      expect(drafts.save.mock.calls.map((call) => call[1])).toEqual([file, file]);
      expect(queryByText(root, 'Draft saved on this device')).not.toBeNull();
      expect(await drafts.load()).toMatchObject({ photo: file });
    });

    it('brings back the photo, markings and details after a reload', async () => {
      const { root, nameField, gymSelect, chosenGrade, holds, status, control } = mount({
        drafts: fakeDrafts(savedDraft()),
      });
      await settle();

      images.load({ width: 900, height: 1200 });
      await settle();

      expect(nameField().value).toBe('Hush');
      expect(gymSelect().value).toBe('other');
      expect(chosenGrade()).toBe('V7');
      expect(queryByText(root, 'saved.jpg')).not.toBeNull();
      expect(holds().map((node) => node.getAttribute('aria-label'))).toEqual([
        'Hand only route hold, marker H, 1 start tape',
        'Detected hold 2 of 2, not selected',
      ]);
      expect(byRole(root, 'switch').getAttribute('aria-checked')).toBe('false');
      expect(control('Undo last change').disabled).toBe(true);
      expect(status().textContent).toContain('Restored your draft');
      expect(queryByText(root, 'Draft saved on this device')).not.toBeNull();
    });

    it('does not write back the photo it has just restored', async () => {
      const drafts = fakeDrafts(savedDraft());
      mount({ drafts });
      await settle();

      images.load({ width: 900, height: 1200 });
      await settle();

      expect(drafts.save).toHaveBeenCalledOnce();
      expect(drafts.save.mock.calls[0][1]).toBeUndefined();
    });

    it('lets the address choose the gym over the draft', async () => {
      installDom('http://localhost/routes/new?gym=gym');
      const { gymSelect } = mount({ drafts: fakeDrafts(savedDraft()) });
      await settle();

      images.load();

      expect(gymSelect().value).toBe('gym');
    });

    it('leaves a photo the climber has already chosen alone', async () => {
      const drafts = fakeDrafts(savedDraft());
      const page = mount({ drafts });
      page.choosePhoto();
      await settle();

      expect(page.nameField().value).toBe('');
    });

    it('drops an unusable draft photo like any other', async () => {
      const { root } = mount({ drafts: fakeDrafts(savedDraft()) });
      await settle();

      images.fail();

      expect(byRole(root, 'alert').textContent).toContain('could not be opened');
    });

    it('does not give the next photo the markings of a draft photo that would not open', async () => {
      const { root, holds, choosePhoto, stage } = mount({ drafts: fakeDrafts(savedDraft()) });
      await settle();
      images.fail();
      expect(byRole(root, 'alert')).toBeTruthy();

      choosePhoto({ width: 1600, height: 960 }, jpeg('other.jpg'));

      expect(stage.hidden).toBe(false);
      expect(holds()).toHaveLength(0);
    });

    it('is removed when the route is published', async () => {
      const { choosePhoto, detect, holds, nameField, submit, drafts } = mount();
      choosePhoto();
      await detect();
      holds()[0].click();
      nameField().value = 'Hush';

      submit();
      await settle();

      expect(drafts.clear).toHaveBeenCalledOnce();
    });

    it('is not saved after the route is out, even by an edit that was waiting', async () => {
      const { choosePhoto, detect, holds, nameField, submit, drafts } = mount();
      choosePhoto();
      await detect();
      holds()[0].click();
      nameField().value = 'Hush';
      submit();
      await settle();
      drafts.save.mockClear();

      await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);

      expect(drafts.save).not.toHaveBeenCalled();
    });

    it('is removed, with the form reset, when the climber discards it', async () => {
      const { choosePhoto, nameField, control, drafts, stage, holds } = mount();
      choosePhoto();
      nameField().value = 'Hush';

      control('Discard draft').click();
      await settle();

      expect(confirm).toHaveBeenCalledOnce();
      expect(drafts.clear).toHaveBeenCalledOnce();
      expect(nameField().value).toBe('');
      expect(stage.hidden).toBe(true);
      expect(holds()).toHaveLength(0);
    });

    it('stays when discarding is not confirmed', async () => {
      vi.stubGlobal(
        'confirm',
        vi.fn(() => false)
      );
      const { choosePhoto, control, drafts, stage } = mount();
      choosePhoto();

      control('Discard draft').click();
      await settle();

      expect(drafts.clear).not.toHaveBeenCalled();
      expect(stage.hidden).toBe(false);
    });

    it('is cleared by "Add another" too, and not brought back by a stale save', async () => {
      const { choosePhoto, detect, holds, nameField, submit, root, drafts } = mount();
      choosePhoto();
      await detect();
      holds()[0].click();
      nameField().value = 'Hush';
      submit();
      await settle();
      drafts.save.mockClear();

      byRole(root, 'button', 'Add another').click();
      await vi.advanceTimersByTimeAsync(AUTOSAVE_WAIT_MS);

      expect(drafts.save).not.toHaveBeenCalled();
    });
  });
});
