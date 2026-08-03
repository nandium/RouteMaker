import { API_PATHS, MAX_ROUTE_NAME_LENGTH, STORAGE_KEYS } from '../src/client-contract.js';
import type { Gym, Metadata } from '../src/client-contract.js';
import { iconSvg } from '../src/icons.js';
import { loginPath, WEB_PATHS } from '../src/web-routes.js';
import { MAX_SOURCE_IMAGE_BYTES, renderRouteImage } from './canvas.js';
import { detectHolds } from './detector.js';
import { browserRequest } from './http.js';
import { createMarkingEditor } from './marking-editor.js';
import { ROUTE_MARKING } from './route-annotations.js';
import { element, field, setStatus } from './shared.js';
import { readStorage } from './storage.js';

function detectorIcon() {
  const icon = element('span', 'editor-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML = iconSvg('detect', 'currentColor');
  return icon;
}

export function mountEditor(root: HTMLElement, gyms: Gym[], metadata: Metadata) {
  // A photo generation owns its async load/detection work. Publishing snapshots
  // for that generation so later UI changes cannot alter the image being uploaded.
  const sessionToken = readStorage(STORAGE_KEYS.session);
  if (!sessionToken) {
    location.replace(loginPath(WEB_PATHS.newRoute));
    return;
  }

  const form = element('section', 'tool-card editor');
  const name = field('Route name');
  name.input.maxLength = MAX_ROUTE_NAME_LENGTH;
  const grade = element('select');
  metadata.grades.forEach((value) => {
    const option = element('option', '', value);
    option.value = value;
    grade.append(option);
  });
  grade.value = metadata.default_grade;
  const gym = element('select');
  gyms.forEach((item) => {
    const option = element('option', '', item.name);
    option.value = item.id;
    gym.append(option);
  });

  const file = element('input');
  file.id = 'route-photo';
  file.className = 'file-input';
  file.type = 'file';
  file.accept = 'image/jpeg,image/png,image/webp';
  const preview = element('div', 'preview');
  preview.hidden = true;
  preview.setAttribute('role', 'group');
  preview.setAttribute(
    'aria-label',
    'Wall photo hold editor. Use arrow keys to position a marker, then press Enter to add it.'
  );
  preview.tabIndex = 0;
  const image = element('img');
  image.alt = 'Selected climbing wall';
  preview.append(image);

  const filePicker = element('label', 'file-picker');
  filePicker.htmlFor = file.id;
  const fileIcon = element('span', 'file-picker__icon', '↑');
  fileIcon.setAttribute('aria-hidden', 'true');
  const fileCopy = element('span', 'file-picker__copy');
  const fileName = element('strong', '', 'Choose a wall photo');
  const fileLimit = element(
    'span',
    '',
    `JPEG, PNG or WebP · up to ${MAX_SOURCE_IMAGE_BYTES / 1024 / 1024} MB`
  );
  fileCopy.append(fileName, fileLimit);
  filePicker.append(fileIcon, fileCopy, element('span', 'file-picker__action', 'Browse'));

  const status = element('p', 'tool-status');
  const detect = element('button', 'icon-button hold-editor__detect');
  detect.append(detectorIcon(), element('span', '', 'Detect'));
  detect.setAttribute('aria-label', 'Auto-detect holds');
  const submit = element('button', '', 'Publish route');
  const markingEditor = createMarkingEditor(preview, status);
  markingEditor.actions.prepend(detect);

  let imageObjectUrl = '';
  let photoVersion = 0;
  let detecting = false;
  let publishing = false;
  let published = false;

  const isEditorLocked = () => publishing || published || detecting;
  const syncControls = () => {
    const locked = publishing || published;
    const editorLocked = isEditorLocked();
    file.disabled = editorLocked;
    name.input.disabled = locked;
    grade.disabled = locked;
    gym.disabled = locked;
    detect.disabled = editorLocked;
    submit.disabled = editorLocked;
    markingEditor.setLocked(editorLocked);
  };

  const resetPhoto = () => {
    photoVersion += 1;
    file.value = '';
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = '';
    image.onload = null;
    image.onerror = null;
    image.removeAttribute('src');
    preview.hidden = true;
    markingEditor.clear();
    fileName.textContent = 'Choose a wall photo';
  };

  file.onchange = () => {
    if (isEditorLocked()) return;
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_SOURCE_IMAGE_BYTES) {
      resetPhoto();
      return setStatus(
        status,
        `Choose a source photo no larger than ${MAX_SOURCE_IMAGE_BYTES / 1024 / 1024} MB.`,
        true
      );
    }
    const version = ++photoVersion;
    fileName.textContent = selected.name;
    setStatus(status, 'Photo ready. Detect holds, then tap the holds used by the route.');
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = URL.createObjectURL(selected);
    image.onload = () => {
      if (version !== photoVersion) return;
      if (
        image.naturalWidth < ROUTE_MARKING.minimumSourceDimension ||
        image.naturalHeight < ROUTE_MARKING.minimumSourceDimension
      ) {
        resetPhoto();
        setStatus(
          status,
          `Choose a photo at least ${ROUTE_MARKING.minimumSourceDimension} pixels wide and tall.`,
          true
        );
        return;
      }
      preview.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      preview.hidden = false;
      markingEditor.redraw();
    };
    image.onerror = () => {
      if (version !== photoVersion || publishing || published) return;
      resetPhoto();
      setStatus(status, 'That image could not be opened. Choose another photo.', true);
    };
    image.src = imageObjectUrl;
    markingEditor.clear();
  };

  detect.onclick = async () => {
    if (isEditorLocked()) return;
    const selected = file.files?.[0];
    if (!selected) return setStatus(status, 'Choose a photo first.', true);
    const version = photoVersion;
    const restoreFocus = document.activeElement === detect;
    detecting = true;
    syncControls();
    setStatus(status, 'Starting local hold detection…');
    try {
      const result = await detectHolds(selected, (message) => {
        if (version === photoVersion && !publishing) setStatus(status, message);
      });
      if (version !== photoVersion || publishing || published) return;
      markingEditor.replaceCandidates(result);
      setStatus(
        status,
        `Found ${result.length} possible holds. Choose a hold type, then tap route holds.`
      );
    } catch (error) {
      if (version === photoVersion && !publishing && !published) {
        setStatus(status, error instanceof Error ? error.message : 'Detection failed', true);
      }
    } finally {
      detecting = false;
      syncControls();
      if (restoreFocus) detect.focus();
    }
  };

  submit.onclick = async () => {
    if (isEditorLocked()) return;
    const selected = file.files?.[0];
    if (!selected) return setStatus(status, 'Choose a photo first.', true);
    const markings = markingEditor.snapshot();
    if (!markings.annotations.length) {
      return setStatus(status, 'Select at least one route hold first.', true);
    }
    const routeName = name.input.value.trim();
    if (!routeName) {
      name.input.focus();
      return setStatus(status, 'Name the route before publishing.', true);
    }
    const snapshot = {
      file: selected,
      photoVersion,
      ...markings,
      name: routeName,
      gymId: gym.value,
      grade: grade.value,
      token: sessionToken,
    };
    publishing = true;
    syncControls();
    submit.textContent = 'Publishing…';
    try {
      setStatus(status, 'Preparing the published image…');
      const rendered = await renderRouteImage(
        snapshot.file,
        snapshot.annotations,
        snapshot.showSequence,
        metadata.max_image_bytes,
        metadata.max_image_dimension
      );
      if (snapshot.photoVersion !== photoVersion) {
        throw new Error('The selected photo changed while publishing. Try again.');
      }
      if (rendered.size > metadata.max_image_bytes) {
        throw new Error(
          `The rendered JPEG is ${(rendered.size / 1024 / 1024).toFixed(1)} MB; choose a smaller photo.`
        );
      }
      const data = new FormData();
      data.append('name', snapshot.name);
      data.append('gym_id', snapshot.gymId);
      data.append('owner_grade', snapshot.grade);
      data.append('image', rendered, rendered.name);
      await browserRequest(API_PATHS.routes, {
        method: 'POST',
        token: snapshot.token,
        body: data,
      });
      published = true;
      setStatus(status, 'Route published. It is now visible in the feed.');
    } catch (error) {
      if ((error as { status?: number }).status === 401) {
        location.assign(loginPath(WEB_PATHS.newRoute));
        return;
      }
      setStatus(status, error instanceof Error ? error.message : 'Publish failed', true);
    } finally {
      publishing = false;
      syncControls();
      submit.textContent = published ? 'Route published' : 'Publish route';
    }
  };

  const gradeLabel = element('label', 'tool-field');
  gradeLabel.append(element('span', '', 'Grade'), grade);
  const gymLabel = element('label', 'tool-field');
  gymLabel.append(element('span', '', 'Gym'), gym);
  const photoField = element('div', 'tool-field tool-field--wide');
  photoField.append(
    file,
    filePicker,
    element('p', 'tool-note', `Compressed to ${metadata.max_image_bytes / 1024} KiB on publish.`)
  );
  const publish = element('div', 'tool-publish');
  publish.append(submit);
  form.append(
    element('h2', '', 'Route details'),
    name.wrapper,
    gymLabel,
    gradeLabel,
    element('p', 'tool-section-title', 'Wall photo'),
    photoField,
    markingEditor.element,
    preview,
    publish
  );
  syncControls();

  const cleanup = (event: PageTransitionEvent) => {
    // BFCache restores the same live editor; tearing it down here would leave a
    // revoked preview URL and a disconnected resize observer after Back.
    if (event.persisted) return;
    window.removeEventListener('pagehide', cleanup);
    photoVersion += 1;
    markingEditor.destroy();
    image.onload = null;
    image.onerror = null;
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = '';
  };
  window.addEventListener('pagehide', cleanup);
  root.append(form);
}
