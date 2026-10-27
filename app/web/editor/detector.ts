import { errorMessage } from '../http.js';
import type { Detection, DetectorRequest, DetectorResponse, DetectorStage } from './yolo.js';

/** Model download and session creation, which dominate first use. */
const LOAD_TIMEOUT_MS = 120_000;
/** Image preparation plus one inference pass. */
const INFERENCE_TIMEOUT_MS = 30_000;

const STAGE_MESSAGES: Record<DetectorStage, string> = {
  loading: 'Loading the hold detector…',
  preparing: 'Preparing the image…',
  detecting: 'Finding holds…',
};

type Request = {
  onProgress: (message: string) => void;
  resolve: (boxes: Detection[]) => void;
  reject: (error: Error) => void;
};

// One worker for the whole session: it keeps the loaded model between detections. The editor
// runs one detection at a time, so there is a single current request and a single timeout.
let worker: Worker | null = null;
let current: Request | null = null;
let timeout: ReturnType<typeof setTimeout> | undefined;

/** Drop a crashed or stalled worker so the next detection starts a fresh one. */
function fail(error: Error) {
  clearTimeout(timeout);
  worker?.terminate();
  worker = null;
  const request = current;
  current = null;
  request?.reject(error);
}

function watch(ms: number) {
  clearTimeout(timeout);
  timeout = setTimeout(() => fail(new Error('Hold detection timed out. Try again.')), ms);
}

function handleMessage({ data }: MessageEvent<DetectorResponse>) {
  const request = current;
  if (!request) return;
  if (data.type === 'progress') {
    request.onProgress(STAGE_MESSAGES[data.stage]);
    watch(data.stage === 'loading' ? LOAD_TIMEOUT_MS : INFERENCE_TIMEOUT_MS);
    return;
  }
  clearTimeout(timeout);
  current = null;
  if (data.type === 'error') request.reject(new Error(data.message));
  else request.resolve(data.boxes);
}

function getWorker() {
  if (worker) return worker;
  const created = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
  created.addEventListener('message', handleMessage);
  created.addEventListener('error', () => fail(new Error('Hold detection stopped.')));
  created.addEventListener('messageerror', () =>
    fail(new Error('Hold detection returned an unreadable response.'))
  );
  worker = created;
  return created;
}

export function detectHolds(
  image: Blob,
  onProgress: (message: string) => void
): Promise<Detection[]> {
  if (current) return Promise.reject(new Error('Hold detection is already running.'));
  return new Promise((resolve, reject) => {
    current = { onProgress, resolve, reject };
    watch(LOAD_TIMEOUT_MS);
    try {
      getWorker().postMessage({ image } satisfies DetectorRequest);
    } catch (error) {
      fail(new Error(errorMessage(error)));
    }
  });
}
