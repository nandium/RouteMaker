import type { Detection } from './yolo.js';

type DetectorMessage = {
  type: 'progress' | 'result' | 'error';
  id: number;
  message?: string;
  boxes?: Detection[];
};

type PendingRequest = {
  onProgress: (message: string) => void;
  resolve: (boxes: Detection[]) => void;
  reject: (error: Error) => void;
};

let detectorWorker: Worker | null = null;
let detectorRequest = 0;
const pending = new Map<number, PendingRequest>();

function workerFailure(error: Error) {
  const activeWorker = detectorWorker;
  detectorWorker = null;
  activeWorker?.terminate();
  for (const request of pending.values()) request.reject(error);
  pending.clear();
}

function handleMessage(event: MessageEvent<DetectorMessage>) {
  const result = event.data;
  const request = pending.get(result.id);
  if (!request) return;
  if (result.type === 'progress') {
    request.onProgress(result.message ?? 'Detecting holds…');
    return;
  }
  pending.delete(result.id);
  if (result.type === 'error') request.reject(new Error(result.message ?? 'Detection failed.'));
  else request.resolve(result.boxes ?? []);
}

function getWorker() {
  if (detectorWorker) return detectorWorker;
  const worker = new Worker(new URL('./model-worker.ts', import.meta.url), { type: 'module' });
  worker.addEventListener('message', handleMessage);
  worker.addEventListener('error', () => workerFailure(new Error('Hold detection stopped.')));
  worker.addEventListener('messageerror', () =>
    workerFailure(new Error('Hold detection returned an unreadable response.'))
  );
  detectorWorker = worker;
  return worker;
}

export function detectHolds(
  image: Blob,
  onProgress: (message: string) => void
): Promise<Detection[]> {
  const worker = getWorker();
  const id = ++detectorRequest;
  return new Promise((resolve, reject) => {
    pending.set(id, { onProgress, resolve, reject });
    try {
      worker.postMessage({ type: 'infer', id, image });
    } catch (error) {
      pending.delete(id);
      reject(error instanceof Error ? error : new Error('Could not start hold detection.'));
    }
  });
}
