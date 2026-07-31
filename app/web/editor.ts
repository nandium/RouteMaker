import { API_PATHS, STORAGE_KEYS } from '../src/client-contract.js';
import type { Annotation, Gym, Metadata } from '../src/client-contract.js';
import { loginPath, WEB_PATHS } from '../src/web-routes.js';
import { MAX_SOURCE_IMAGE_BYTES, renderRouteImage } from './canvas.js';
import { browserRequest } from './http.js';
import { readStorage } from './storage.js';
import { detectHolds } from './detector.js';
import { element, field, setStatus } from './shared.js';

const DEFAULT_MARKER_SIZE = { width: 0.08, height: 0.06 } as const;

function markerAt(x: number, y: number): Annotation {
  const { width, height } = DEFAULT_MARKER_SIZE;
  return {
    x: Math.min(1 - width, Math.max(0, x - width / 2)),
    y: Math.min(1 - height, Math.max(0, y - height / 2)),
    width,
    height,
  };
}

export function mountEditor(root: HTMLElement, gyms: Gym[], metadata: Metadata) {
  // A photo generation owns its async load/detection work. Publishing snapshots
  // that generation so later UI changes cannot alter the image being uploaded.
  const sessionToken = readStorage(STORAGE_KEYS.session);
  if (!sessionToken) {
    location.replace(loginPath(WEB_PATHS.newRoute));
    return;
  }
  const form = element('section', 'tool-card editor');
  const name = field('Route name');
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
  preview.setAttribute('role', 'button');
  preview.setAttribute('aria-label', 'Add a hold marker to the wall photo');
  preview.tabIndex = 0;
  const image = element('img');
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
  const annotations: Annotation[] = [];
  let imageObjectUrl = '';
  let photoVersion = 0;
  let detecting = false;
  let publishing = false;
  let published = false;

  const redraw = () => {
    preview.querySelectorAll('.marker').forEach((marker) => marker.remove());
    annotations.forEach((annotation, index) => {
      const marker = element('span', 'marker', String(index + 1));
      marker.setAttribute('role', 'img');
      marker.setAttribute('aria-label', `Hold marker ${index + 1}`);
      Object.assign(marker.style, {
        left: `${annotation.x * 100}%`,
        top: `${annotation.y * 100}%`,
        width: `${annotation.width * 100}%`,
        height: `${annotation.height * 100}%`,
      });
      preview.append(marker);
    });
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
    annotations.splice(0);
    redraw();
    fileName.textContent = 'Choose a wall photo';
  };
  file.onchange = () => {
    if (publishing || published) return;
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
    setStatus(status, 'Photo ready. Add markers manually or use auto-detect.');
    if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    imageObjectUrl = URL.createObjectURL(selected);
    image.onload = () => {
      if (version !== photoVersion) return;
      preview.style.aspectRatio = `${image.naturalWidth} / ${image.naturalHeight}`;
      preview.hidden = false;
    };
    image.onerror = () => {
      if (version !== photoVersion || publishing || published) return;
      resetPhoto();
      setStatus(status, 'That image could not be opened. Choose another photo.', true);
    };
    image.src = imageObjectUrl;
    annotations.splice(0);
    redraw();
  };
  preview.onclick = (event) => {
    if (publishing || published || !file.files?.[0]) return;
    const bounds = preview.getBoundingClientRect();
    annotations.push(
      markerAt(
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height
      )
    );
    redraw();
  };
  preview.onkeydown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (publishing || published || !file.files?.[0]) return;
      annotations.push(markerAt(0.5, 0.5));
      redraw();
    }
  };

  const detect = element('button', 'secondary', 'Auto-detect holds');
  const undo = element('button', 'secondary', 'Undo last marker');
  const clear = element('button', 'secondary', 'Clear markers');
  const submit = element('button', '', 'Publish route');
  const status = element('p', 'tool-status');
  const syncControls = () => {
    const locked = publishing || published;
    file.disabled = locked;
    name.input.disabled = locked;
    grade.disabled = locked;
    gym.disabled = locked;
    undo.disabled = locked;
    clear.disabled = locked;
    detect.disabled = locked || detecting;
    submit.disabled = locked;
    preview.setAttribute('aria-disabled', String(locked));
  };
  detect.onclick = async () => {
    if (publishing || published || detecting) return;
    const selected = file.files?.[0];
    if (!selected) return setStatus(status, 'Choose a photo first.', true);
    const version = photoVersion;
    detecting = true;
    detect.disabled = true;
    setStatus(status, 'Starting local hold detection…');
    try {
      const result = await detectHolds(selected, (message) => {
        if (version === photoVersion && !publishing) setStatus(status, message);
      });
      if (version !== photoVersion || publishing || published) return;
      annotations.splice(
        0,
        annotations.length,
        ...result.map((box) => ({ x: box.x, y: box.y, width: box.width, height: box.height }))
      );
      redraw();
      setStatus(status, `Found ${annotations.length} possible holds. Tap to add more.`);
    } catch (error) {
      if (version === photoVersion && !publishing && !published) {
        setStatus(status, error instanceof Error ? error.message : 'Detection failed', true);
      }
    } finally {
      detecting = false;
      syncControls();
    }
  };
  undo.onclick = () => {
    if (publishing || published) return;
    annotations.pop();
    redraw();
  };
  clear.onclick = () => {
    if (publishing || published) return;
    annotations.splice(0);
    redraw();
  };
  submit.onclick = async () => {
    if (publishing || published) return;
    const selected = file.files?.[0];
    if (!selected) return setStatus(status, 'Choose a photo first.', true);
    if (!annotations.length)
      return setStatus(status, 'Place at least one hold marker first.', true);
    const snapshot = {
      file: selected,
      photoVersion,
      annotations: annotations.map((annotation) => ({ ...annotation })),
      name: name.input.value,
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
  syncControls();
  const gradeLabel = element('label', 'tool-field');
  gradeLabel.append(element('span', '', 'Grade'), grade);
  const gymLabel = element('label', 'tool-field');
  gymLabel.append(element('span', '', 'Gym'), gym);
  const photoField = element('div', 'tool-field tool-field--wide');
  photoField.append(
    file,
    filePicker,
    element(
      'p',
      'tool-note',
      `Published images are compressed to at most ${metadata.max_image_bytes / 1024} KiB.`
    )
  );
  const controls = element('div', 'tool-actions');
  controls.append(detect, undo, clear);
  const publish = element('div', 'tool-publish');
  publish.append(
    element('p', 'tool-note', 'Happy with the markers? Publish it to the feed.'),
    submit
  );
  form.append(
    element('h2', '', 'Route details'),
    name.wrapper,
    gymLabel,
    gradeLabel,
    element('p', 'tool-section-title', 'Wall photo'),
    photoField,
    controls,
    preview,
    publish,
    status
  );
  root.append(form);
}
