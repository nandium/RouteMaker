import { MAX_IMAGE_BYTES } from '../../src/client-contract.js';
import { createStatus, element, iconNode, setStatus, textElement } from '../dom.js';
import type { Size } from './route-annotations.js';

const MIB = 1024 * 1024;
/** What the browser can reasonably decode, mark and re-encode. */
const SOURCE_LIMITS = { minDimension: 64, maxPixels: 50_000_000, maxBytes: 15 * MIB };
const SOURCE_LIMIT_MIB = SOURCE_LIMITS.maxBytes / MIB;

/** A photo that has loaded and can be marked; `size` is as the browser displays it. */
export type Photo = { file: File; url: string; size: Size };

/** Why a photo of this size cannot be marked, or null when it is usable. */
function sourceProblem({ width, height }: Size) {
  if (width < SOURCE_LIMITS.minDimension || height < SOURCE_LIMITS.minDimension) {
    return `Choose a photo at least ${SOURCE_LIMITS.minDimension} pixels wide and tall.`;
  }
  if (width * height > SOURCE_LIMITS.maxPixels) {
    return `Choose a photo under ${SOURCE_LIMITS.maxPixels / 1_000_000} megapixels.`;
  }
  return null;
}

const fileSize = (bytes: number) =>
  bytes >= MIB ? `${(bytes / MIB).toFixed(1)} MiB` : `${Math.max(1, Math.round(bytes / 1024))} KiB`;

/** A button-looking label for the hidden file input. */
function pickerLabel(input: HTMLInputElement, text: string, size: 'lg' | 'sm') {
  const label = element(
    'label',
    `btn btn--${size === 'lg' ? 'primary' : 'secondary'} btn--${size}`
  );
  label.htmlFor = input.id;
  label.append(iconNode('photo'), text);
  return label;
}

/**
 * The wall-photo field: picks a file, checks that it can be marked, and keeps the chosen photo
 * and its object URL. `onPhoto` listeners hear the photo once it is usable, and null whenever
 * there is none (before a new one has loaded, and when the old one is dropped). A photo that
 * cannot be used is explained under the field.
 */
export function createPhotoPicker() {
  const listeners: Array<(photo: Photo | null) => void> = [];
  const announce = (photo: Photo | null) => listeners.forEach((listener) => listener(photo));
  const file = element('input', 'sr-only photo-picker__input');
  file.id = 'route-photo';
  file.type = 'file';
  file.accept = 'image/jpeg,image/png,image/webp';

  const drop = element('div', 'drop');
  drop.append(
    iconNode('upload', 'drop__icon'),
    textElement('p', 'Choose a wall photo', 'drop__title display display--md'),
    textElement(
      'p',
      `JPEG, PNG or WebP, up to ${SOURCE_LIMIT_MIB} MiB, at least ${SOURCE_LIMITS.minDimension} px on both sides. Compressed to ${MAX_IMAGE_BYTES / 1024} KiB on publish.`,
      'drop__text'
    ),
    pickerLabel(file, 'Choose photo', 'lg')
  );

  const chip = element('div', 'file-chip');
  chip.hidden = true;
  const fileName = element('strong', 'file-chip__name');
  const fileMeta = element('span', 'file-chip__meta');
  const chipText = element('div', 'file-chip__text');
  chipText.append(fileName, fileMeta);
  chip.append(iconNode('photo', 'file-chip__icon'), chipText, pickerLabel(file, 'Change', 'sm'));

  const problem = createStatus();
  const field = element('div', 'photo-picker');
  field.append(file, drop, chip, problem);

  let photo: Photo | null = null;
  /** The object URL of the latest choice, which may still be loading. */
  let url = '';

  const showFile = (selected: File | null, size?: Size) => {
    drop.hidden = selected !== null;
    chip.hidden = selected === null;
    if (!selected) return;
    fileName.textContent = selected.name;
    fileMeta.textContent = size
      ? `${fileSize(selected.size)} · ${size.width}×${size.height} · will be compressed to ${MAX_IMAGE_BYTES / 1024} KiB`
      : 'Opening…';
  };

  const reject = (message: string) => {
    clear();
    setStatus(problem, message, 'error');
  };

  const clear = () => {
    if (url) URL.revokeObjectURL(url);
    url = '';
    photo = null;
    file.value = '';
    problem.hidden = true;
    showFile(null);
    announce(null);
  };

  const load = (selected: File) => {
    if (url) URL.revokeObjectURL(url);
    photo = null;
    url = URL.createObjectURL(selected);
    const chosen = url;
    problem.hidden = true;
    showFile(selected);
    announce(null);

    // Load it to learn its size, ignoring the answer if another photo was chosen meanwhile.
    const probe = new Image();
    probe.onload = () => {
      if (url !== chosen) return;
      // naturalWidth/Height follow EXIF rotation, matching what the user marks.
      const size = { width: probe.naturalWidth, height: probe.naturalHeight };
      const tooSmallOrLarge = sourceProblem(size);
      if (tooSmallOrLarge) return reject(tooSmallOrLarge);
      photo = { file: selected, url: chosen, size };
      showFile(selected, size);
      announce(photo);
    };
    probe.onerror = () => {
      if (url === chosen) reject('That image could not be opened. Choose another photo.');
    };
    probe.src = chosen;
  };

  /** Use `selected` as the photo, as if it had been picked in the dialog. */
  const choose = (selected: File) => {
    if (selected.size > SOURCE_LIMITS.maxBytes) {
      reject(`Choose a source photo no larger than ${SOURCE_LIMIT_MIB} MiB.`);
      return;
    }
    load(selected);
  };

  file.onchange = () => {
    // Cancelling the dialog empties the input in some browsers; keep the current photo then.
    const selected = file.files?.[0];
    if (selected) choose(selected);
  };

  return {
    element: field,
    get photo() {
      return photo;
    },
    choose,
    onPhoto(listener: (photo: Photo | null) => void) {
      listeners.push(listener);
    },
    setDisabled(disabled: boolean) {
      file.disabled = disabled;
      field.classList.toggle('is-disabled', disabled);
    },
    clear,
  };
}
