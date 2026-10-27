import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  MAX_THUMBNAIL_BYTES,
  MAX_THUMBNAIL_DIMENSION,
} from '../../src/client-contract.js';
import { loadDisplayFont } from '../fonts.js';
import { markShapes, paintCanvas } from './burn-in.js';
import {
  type Annotation,
  routeLabels,
  selectedAnnotations,
  type Size,
} from './route-annotations.js';

// The server rejects JPEGs over their byte limit: shrink quality first, then dimensions.
const JPEG_QUALITIES = [0.82, 0.68, 0.54];
const RUNG_SCALES = [1, 0.8, 0.64];

export function fitCanvasSize(width: number, height: number, max: number): Size {
  const scale = Math.min(1, max / width, max / height);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The markings of the selected holds, as they are burned into a photo of `size`. */
function publishedShapes(annotations: readonly Annotation[], showSequence: boolean, size: Size) {
  const selected = selectedAnnotations(annotations);
  return markShapes(selected, routeLabels(selected, showSequence), size);
}

/** The size the published photo has at best; the editor draws its markings in this space. */
export const publishedSize = ({ width, height }: Size) =>
  fitCanvasSize(width, height, MAX_IMAGE_DIMENSION);

/**
 * Decode once at the largest export size. A browser that ignores the resize options (or applies
 * them before EXIF rotation) returns other dimensions, so fall back to a full decode.
 */
async function decode(source: Blob, size: Size) {
  const bitmap = await createImageBitmap(source, {
    imageOrientation: 'from-image',
    resizeWidth: size.width,
    resizeHeight: size.height,
    resizeQuality: 'high',
  });
  if (bitmap.width === size.width && bitmap.height === size.height) return bitmap;
  bitmap.close();
  return createImageBitmap(source, { imageOrientation: 'from-image' });
}

const encodeJpeg = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode the image.'))),
      'image/jpeg',
      quality
    );
  });

type JpegSpec = { name: string; maxBytes: number; maxDimension: number };

const PHOTO: JpegSpec = {
  name: 'route.jpg',
  maxBytes: MAX_IMAGE_BYTES,
  maxDimension: MAX_IMAGE_DIMENSION,
};
const THUMBNAIL: JpegSpec = {
  name: 'thumbnail.jpg',
  maxBytes: MAX_THUMBNAIL_BYTES,
  maxDimension: MAX_THUMBNAIL_DIMENSION,
};

/** Draw the photo and markings at the largest rung of `spec` that encodes small enough. */
async function renderJpeg(
  bitmap: ImageBitmap,
  sourceSize: Size,
  annotations: readonly Annotation[],
  showSequence: boolean,
  { name, maxBytes, maxDimension }: JpegSpec
): Promise<File> {
  // Same dimensions at another rung would only repeat the same encode.
  const sizes = RUNG_SCALES.map((scale) =>
    fitCanvasSize(sourceSize.width, sourceSize.height, maxDimension * scale)
  ).filter(
    (size, index, all) =>
      index === 0 || size.width !== all[index - 1].width || size.height !== all[index - 1].height
  );
  const canvas = document.createElement('canvas');
  try {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not prepare the published image.');
    context.imageSmoothingQuality = 'high';
    for (const size of sizes) {
      canvas.width = size.width;
      canvas.height = size.height;
      // JPEG has no alpha: transparent PNG/WebP pixels would otherwise export as black.
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
      context.drawImage(bitmap, 0, 0, size.width, size.height);
      paintCanvas(context, publishedShapes(annotations, showSequence, size));
      for (const quality of JPEG_QUALITIES) {
        const blob = await encodeJpeg(canvas, quality);
        if (blob.size <= maxBytes) return new File([blob], name, { type: 'image/jpeg' });
      }
    }
    throw new Error('This photo cannot be compressed enough to publish.');
  } finally {
    // Free the backing store now; browsers cap total canvas memory.
    canvas.width = canvas.height = 0;
  }
}

/**
 * Burn the markings into the published photo and its thumbnail, both baseline JPEGs within the
 * server's limits. `sourceSize` is the photo's EXIF-rotated size as the browser displays it.
 */
export async function renderRouteImages(
  source: Blob,
  sourceSize: Size,
  annotations: readonly Annotation[],
  showSequence: boolean
) {
  // Labels are drawn in the display face, so it must be ready before the first one is.
  await loadDisplayFont();
  const bitmap = await decode(source, publishedSize(sourceSize));
  try {
    return {
      photo: await renderJpeg(bitmap, sourceSize, annotations, showSequence, PHOTO),
      thumbnail: await renderJpeg(bitmap, sourceSize, annotations, showSequence, THUMBNAIL),
    };
  } finally {
    bitmap.close();
  }
}
