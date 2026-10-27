import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { allByRole, installDom, queryByText, stubImage } from '../test-dom.js';
import { createPhotoPicker } from './photo-picker.js';

let images: ReturnType<typeof stubImage>;

function mount() {
  const onPhoto = vi.fn();
  const picker = createPhotoPicker();
  picker.onPhoto(onPhoto);
  document.body.append(picker.element);
  const input = picker.element.querySelector<HTMLInputElement>('input[type="file"]')!;
  const problem = () => allByRole(picker.element, 'alert')[0]?.textContent ?? null;
  return {
    picker,
    onPhoto,
    input,
    problem,
    /** The invitation to choose a photo, while there is none. */
    invitation: () => queryByText(picker.element, 'Choose a wall photo'),
    /** The line naming the chosen photo. */
    chosen: () => queryByText(picker.element, 'wall.jpg'),
    chooseInDialog(file: File) {
      Object.defineProperty(input, 'files', { configurable: true, value: [file] });
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    },
    cancelDialog() {
      Object.defineProperty(input, 'files', { configurable: true, value: [] });
      input.dispatchEvent(new window.Event('change', { bubbles: true }));
    },
  };
}

const jpeg = (name = 'wall.jpg') => new File(['photo'], name, { type: 'image/jpeg' });

describe('photo picker', () => {
  beforeEach(() => {
    installDom();
    images = stubImage();
    vi.spyOn(URL, 'createObjectURL').mockReturnValueOnce('blob:first').mockReturnValue('blob:next');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for a photo until there is one', () => {
    const { invitation, chosen, input } = mount();

    expect(invitation()).not.toBeNull();
    expect(chosen()).toBeNull();
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    expect(queryByText(document.body, 'up to 15 MiB')).not.toBeNull();
  });

  it('offers the photo once the browser has read its size, and shows what it is', () => {
    const { chooseInDialog, picker, onPhoto, invitation } = mount();
    const file = jpeg();

    chooseInDialog(file);
    expect(picker.photo).toBeNull();
    expect(onPhoto).toHaveBeenLastCalledWith(null);
    expect(queryByText(document.body, 'Opening…')).not.toBeNull();

    images.load({ width: 1600, height: 960 });

    const photo = { file, url: 'blob:first', size: { width: 1600, height: 960 } };
    expect(picker.photo).toEqual(photo);
    expect(onPhoto).toHaveBeenLastCalledWith(photo);
    expect(invitation()).toBeNull();
    expect(queryByText(document.body, 'wall.jpg')).not.toBeNull();
    expect(
      queryByText(document.body, '1 KiB · 1600×960 · will be compressed to 512 KiB')
    ).not.toBeNull();
  });

  it('shows a large file in MiB', () => {
    const { chooseInDialog } = mount();
    const big = jpeg();
    Object.defineProperty(big, 'size', { value: 3.2 * 1024 * 1024 });

    chooseInDialog(big);
    images.load();

    expect(queryByText(document.body, '3.2 MiB')).not.toBeNull();
  });

  it('takes a file handed to it, such as a saved draft', () => {
    const { picker, onPhoto } = mount();
    const file = jpeg('saved.jpg');

    picker.choose(file);
    images.load({ width: 800, height: 600 });

    expect(onPhoto).toHaveBeenLastCalledWith({
      file,
      url: 'blob:first',
      size: { width: 800, height: 600 },
    });
  });

  it('can be told to ignore choices while the page is busy', () => {
    const { picker, input } = mount();

    picker.setDisabled(true);
    expect(input.disabled).toBe(true);
    expect(picker.element.classList.contains('is-disabled')).toBe(true);

    picker.setDisabled(false);
    expect(input.disabled).toBe(false);
  });

  it.each([
    [{ width: 63, height: 800 }, 'at least 64 pixels'],
    [{ width: 9000, height: 9000 }, 'megapixels'],
  ])('rejects a %j photo, explains why and releases it', (size, message) => {
    const { chooseInDialog, picker, problem, onPhoto, invitation } = mount();
    chooseInDialog(jpeg());

    images.load(size);

    expect(problem()).toContain(message);
    expect(picker.photo).toBeNull();
    expect(invitation()).not.toBeNull();
    expect(onPhoto).not.toHaveBeenCalledWith(expect.objectContaining({ url: 'blob:first' }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('rejects a file over the source limit before decoding it', () => {
    const { chooseInDialog, problem } = mount();
    const huge = jpeg('huge.jpg');
    Object.defineProperty(huge, 'size', { value: 16 * 1024 * 1024 });

    chooseInDialog(huge);

    expect(problem()).toContain('no larger than 15 MiB');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    expect(images.images).toHaveLength(0);
  });

  it('reports an unreadable image', () => {
    const { chooseInDialog, picker, problem } = mount();
    chooseInDialog(jpeg());

    images.fail();

    expect(problem()).toContain('could not be opened');
    expect(picker.photo).toBeNull();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
  });

  it('stops showing a problem once another photo is chosen', () => {
    const { chooseInDialog, problem } = mount();
    chooseInDialog(jpeg());
    images.fail();
    expect(problem()).not.toBeNull();

    chooseInDialog(jpeg('again.jpg'));

    expect(problem()).toBeNull();
  });

  it('keeps the current photo when the file dialog is cancelled', () => {
    const { chooseInDialog, cancelDialog, picker } = mount();
    chooseInDialog(jpeg());
    images.load();

    cancelDialog();

    expect(picker.photo).not.toBeNull();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it('releases the previous photo when another is chosen', () => {
    const { chooseInDialog, picker } = mount();
    chooseInDialog(jpeg());
    images.load();

    chooseInDialog(jpeg('second.jpg'));

    expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:first');
    expect(picker.photo).toBeNull();
  });

  it('ignores a slow load that a newer choice has replaced', () => {
    const { chooseInDialog, picker } = mount();
    chooseInDialog(jpeg('slow.jpg'));
    const [slow] = images.images;
    chooseInDialog(jpeg('quick.jpg'));
    images.load({ width: 800, height: 600 });

    slow.naturalWidth = 100;
    slow.naturalHeight = 100;
    slow.onload?.();

    expect(picker.photo).toMatchObject({ url: 'blob:next', size: { width: 800, height: 600 } });
  });

  it('forgets the photo and frees it when cleared', () => {
    const { chooseInDialog, picker, onPhoto, input, invitation } = mount();
    chooseInDialog(jpeg());
    images.load();

    picker.clear();

    expect(picker.photo).toBeNull();
    expect(onPhoto).toHaveBeenLastCalledWith(null);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
    expect(input.value).toBe('');
    expect(invitation()).not.toBeNull();
  });
});
