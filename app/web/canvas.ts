import type { Annotation } from '../src/client-contract.js';

const JPEG_QUALITIES = [0.82, 0.68, 0.54];
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

export function fitCanvasSize(width: number, height: number, max: number) {
  const scale = Math.min(1, max / width, max / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function renderRouteImage(
  source: Blob,
  annotations: readonly Annotation[],
  maxBytes: number,
  maxDimension: number
): Promise<File> {
  const decoded = await decodeImage(source);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    decoded.close();
    throw new Error('Could not prepare the published image.');
  }
  let previousWidth = 0;
  let previousHeight = 0;
  try {
    for (const maxSize of [
      maxDimension,
      Math.min(maxDimension, 1280),
      Math.min(maxDimension, 1024),
    ]) {
      const size = fitCanvasSize(decoded.width, decoded.height, maxSize);
      if (size.width === previousWidth && size.height === previousHeight) continue;
      previousWidth = size.width;
      previousHeight = size.height;
      canvas.width = size.width;
      canvas.height = size.height;
      context.drawImage(decoded.source, 0, 0, size.width, size.height);
      const stroke = Math.max(3, Math.round(Math.min(size.width, size.height) / 180));
      const markerColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--rm-accent')
        .trim();
      context.lineWidth = stroke;
      context.font = `900 ${Math.max(12, stroke * 4)}px sans-serif`;
      context.textBaseline = 'top';
      annotations.forEach((annotation, index) => {
        const x = annotation.x * size.width;
        const y = annotation.y * size.height;
        const width = annotation.width * size.width;
        const height = annotation.height * size.height;
        context.strokeStyle = markerColor;
        context.fillStyle = markerColor;
        context.strokeRect(x, y, width, height);
        context.fillText(String(index + 1), x + stroke, y + stroke);
      });
      for (const quality of JPEG_QUALITIES) {
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Could not encode the image.'))),
            'image/jpeg',
            quality
          );
        });
        if (blob.size <= maxBytes) return new File([blob], 'route.jpg', { type: 'image/jpeg' });
      }
    }
    throw new Error('This photo cannot be compressed enough to publish.');
  } finally {
    decoded.close();
  }
}

async function decodeImage(source: Blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(source, { imageOrientation: 'from-image' });
    return {
      source: bitmap as CanvasImageSource,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(source);
  const image = document.createElement('img');
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('This browser could not read the route image.'));
      image.src = url;
    });
    return {
      source: image as CanvasImageSource,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}
