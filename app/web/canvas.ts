import { type Annotation, layoutTape, ROUTE_MARKING } from './route-annotations.js';
import { annotationLabel } from './route-annotation-labels.js';

const JPEG_QUALITIES = [0.82, 0.68, 0.54];
const RENDER_STYLE = {
  fallbackDimensions: [1280, 1024],
  labelFontScale: 4,
  labelHeightScale: 5,
  labelPaddingScale: 1.5,
  labelStrokeScale: 0.5,
  minimumLabelFont: 12,
  minimumLabelHeight: 18,
  minimumMarkerEdge: 1,
  minimumMarkerStroke: 3,
  markerEdgeScale: 0.5,
  markerStrokeScale: 180,
  tapeEdgeWidth: 2,
} as const;
export const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

function themeColor(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function drawLabel(
  context: CanvasRenderingContext2D,
  label: string,
  centerX: number,
  centerY: number,
  canvasWidth: number,
  canvasHeight: number,
  stroke: number
) {
  const padding = stroke * RENDER_STYLE.labelPaddingScale;
  const height = Math.max(RENDER_STYLE.minimumLabelHeight, stroke * RENDER_STYLE.labelHeightScale);
  const width = Math.max(height, context.measureText(label).width + padding * 2);
  const left = Math.max(0, Math.min(canvasWidth - width, centerX - width / 2));
  const top = Math.max(0, Math.min(canvasHeight - height, centerY - height / 2));
  context.fillStyle = themeColor('--rm-route-label-background', '#ffffff');
  context.strokeStyle = themeColor('--rm-route-label-ink', '#111111');
  context.lineWidth = Math.max(1, stroke * RENDER_STYLE.labelStrokeScale);
  context.fillRect(left, top, width, height);
  context.strokeRect(left, top, width, height);
  context.fillStyle = themeColor('--rm-route-label-ink', '#111111');
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(label, left + width / 2, top + height / 2);
}

function drawTape(
  context: CanvasRenderingContext2D,
  annotation: Annotation,
  canvasWidth: number,
  canvasHeight: number
) {
  for (const [kind, count] of [
    ['start', annotation.start_tapes],
    ['finish', annotation.finish_tapes],
  ] as const) {
    layoutTape(annotation, count, kind, canvasWidth, canvasHeight).forEach((strip) => {
      context.save();
      context.beginPath();
      strip.points.forEach(([x, y], index) => {
        const pointX = strip.left + x;
        const pointY = strip.top + y;
        if (index === 0) context.moveTo(pointX, pointY);
        else context.lineTo(pointX, pointY);
      });
      context.closePath();
      context.fillStyle = themeColor('--rm-route-tape', '#080808');
      context.strokeStyle = themeColor('--rm-route-tape-edge', '#ffffff');
      context.lineWidth = RENDER_STYLE.tapeEdgeWidth;
      context.lineJoin = 'round';
      context.fill();
      context.stroke();
      context.restore();
    });
  }
}

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
  showSequence: boolean,
  maxBytes: number,
  maxDimension: number
): Promise<File> {
  const decoded = await decodeImage(source);
  if (
    decoded.width < ROUTE_MARKING.minimumSourceDimension ||
    decoded.height < ROUTE_MARKING.minimumSourceDimension
  ) {
    decoded.close();
    throw new Error(
      `Choose a photo at least ${ROUTE_MARKING.minimumSourceDimension} pixels wide and tall.`
    );
  }
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
      ...RENDER_STYLE.fallbackDimensions.map((dimension) => Math.min(maxDimension, dimension)),
    ]) {
      const size = fitCanvasSize(decoded.width, decoded.height, maxSize);
      if (size.width === previousWidth && size.height === previousHeight) continue;
      previousWidth = size.width;
      previousHeight = size.height;
      canvas.width = size.width;
      canvas.height = size.height;
      context.drawImage(decoded.source, 0, 0, size.width, size.height);
      const stroke = Math.max(
        RENDER_STYLE.minimumMarkerStroke,
        Math.round(Math.min(size.width, size.height) / RENDER_STYLE.markerStrokeScale)
      );
      const markerColor = themeColor('--rm-route-selection', '#0b6fe8');
      const markerEdgeColor = themeColor('--rm-route-selection-edge', '#111111');
      const markerEdge = Math.max(
        RENDER_STYLE.minimumMarkerEdge,
        Math.round(stroke * RENDER_STYLE.markerEdgeScale)
      );
      context.lineWidth = stroke;
      context.font = `900 ${Math.max(
        RENDER_STYLE.minimumLabelFont,
        stroke * RENDER_STYLE.labelFontScale
      )}px sans-serif`;
      annotations.forEach((annotation) => {
        const x = annotation.x * size.width;
        const y = annotation.y * size.height;
        const width = annotation.width * size.width;
        const height = annotation.height * size.height;
        context.setLineDash(
          annotation.use === 'foot'
            ? [stroke * 3, stroke * 2]
            : annotation.use === 'any'
              ? [stroke, stroke * 1.5]
              : []
        );
        context.strokeStyle = markerEdgeColor;
        context.lineWidth = stroke + markerEdge * 2;
        context.strokeRect(x, y, width, height);
        context.strokeStyle = markerColor;
        context.lineWidth = stroke;
        context.strokeRect(x, y, width, height);
        context.setLineDash([]);
        drawTape(context, annotation, size.width, size.height);
        drawLabel(
          context,
          annotationLabel(annotation, annotations, showSequence),
          x + width / 2,
          y + height / 2,
          size.width,
          size.height,
          stroke
        );
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
