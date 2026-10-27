import * as ort from 'onnxruntime-web/wasm';

// From src/ directly: this runs in a worker, which has no session storage to import.
import { errorMessage } from '../../src/http.js';
import {
  decodeYoloOutputs,
  MODEL_INPUT_SIZE,
  type DetectorRequest,
  type DetectorResponse,
  type YoloOutput,
} from './yolo.js';

// A hashed asset URL, so it caches immutably under /static/.
const MODEL_URL = new URL('../model/holds-yolov4-tiny-fp16.onnx', import.meta.url).href;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

const post = (message: DetectorResponse) => self.postMessage(message);

function loadSession() {
  // One thread avoids cross-origin isolation; loading the weights dominates anyway.
  ort.env.wasm.numThreads = 1;
  sessionPromise ??= ort.InferenceSession.create(MODEL_URL, {
    executionProviders: ['wasm'],
    // Folds the fp16 weight casts into float32 constants once, at session creation.
    graphOptimizationLevel: 'all',
  }).catch((error) => {
    // Don't cache a failed load; allow retry.
    sessionPromise = null;
    throw error;
  });
  return sessionPromise;
}

async function imageTensor(image: Blob) {
  if (typeof createImageBitmap !== 'function' || typeof OffscreenCanvas !== 'function') {
    throw new Error('This browser cannot run local image detection in a worker.');
  }
  const bitmap = await createImageBitmap(image, { imageOrientation: 'from-image' });
  try {
    const canvas = new OffscreenCanvas(MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Could not prepare the image for detection.');
    context.drawImage(bitmap, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const pixels = context.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE).data;
    const plane = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
    const data = new Float32Array(3 * plane);
    for (let index = 0; index < plane; index += 1) {
      data[index] = pixels[index * 4] / 255;
      data[plane + index] = pixels[index * 4 + 1] / 255;
      data[plane * 2 + index] = pixels[index * 4 + 2] / 255;
    }
    return new ort.Tensor('float32', data, [1, 3, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE]);
  } finally {
    bitmap.close();
  }
}

self.onmessage = async ({ data: { image } }: MessageEvent<DetectorRequest>) => {
  try {
    if (!sessionPromise) post({ type: 'progress', stage: 'loading' });
    const session = await loadSession();
    post({ type: 'progress', stage: 'preparing' });
    const input = await imageTensor(image);
    post({ type: 'progress', stage: 'detecting' });
    const output = await session.run({ [session.inputNames[0]]: input });
    const heads: YoloOutput[] = Object.values(output).map((tensor) => ({
      data: tensor.data as ArrayLike<number>,
      dims: tensor.dims,
    }));
    post({ type: 'result', boxes: decodeYoloOutputs(heads) });
  } catch (error) {
    post({
      type: 'error',
      message: errorMessage(error),
    });
  }
};
