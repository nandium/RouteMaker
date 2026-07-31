import * as ort from 'onnxruntime-web/wasm';

import {
  decodeYoloOutputs,
  MODEL_DATA_URL,
  MODEL_INPUT_SIZE,
  MODEL_URL,
  type YoloOutput,
} from './yolo.js';

type WorkerRequest = { type: 'infer'; id: number; image: Blob };
type WorkerResponse =
  | { type: 'progress'; id: number; message: string }
  | { type: 'result'; id: number; boxes: ReturnType<typeof decodeYoloOutputs> }
  | { type: 'error'; id: number; message: string };

let sessionPromise: Promise<ort.InferenceSession> | null = null;

function post(message: WorkerResponse) {
  self.postMessage(message);
}

async function loadSession(id: number) {
  if (!sessionPromise) {
    post({ type: 'progress', id, message: 'Loading the hold detector…' });
    // One thread keeps deployment and browser security requirements simple.
    // The tiny model still runs interactively; loading its weights dominates.
    ort.env.wasm.numThreads = 1;
    sessionPromise = ort.InferenceSession.create(MODEL_URL, {
      executionProviders: ['wasm'],
      externalData: [
        {
          path: MODEL_DATA_URL.slice(MODEL_DATA_URL.lastIndexOf('/') + 1),
          data: MODEL_DATA_URL,
        },
      ],
      graphOptimizationLevel: 'all',
    })
      .then((session) => {
        post({ type: 'progress', id, message: 'Hold detector ready.' });
        return session;
      })
      .catch((error) => {
        // A rejected session must not poison later detection attempts.
        sessionPromise = null;
        throw error;
      });
  }
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
    const data = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
    const plane = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
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

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  if (event.data.type !== 'infer') return;
  const { id } = event.data;
  try {
    const session = await loadSession(id);
    post({ type: 'progress', id, message: 'Preparing the image…' });
    const input = await imageTensor(event.data.image);
    post({ type: 'progress', id, message: 'Finding holds…' });
    const feeds = { [session.inputNames[0]]: input };
    const output = await session.run(feeds);
    const outputs: YoloOutput[] = Object.values(output).map((tensor) => ({
      data: tensor.data as ArrayLike<number>,
      dims: tensor.dims,
    }));
    post({ type: 'result', id, boxes: decodeYoloOutputs(outputs) });
  } catch (error) {
    post({
      type: 'error',
      id,
      message: error instanceof Error ? error.message : 'Detection failed.',
    });
  }
};
