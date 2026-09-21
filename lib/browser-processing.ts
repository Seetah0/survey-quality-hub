/// <reference types="vite/client" />

// Vite provides a virtual default export for ?worker imports.
// oxlint-disable-next-line import/default
import PortalWorker from './portal.worker.ts?worker';

export function processInBrowser<T>(
  operation: string,
  data: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const worker = new PortalWorker();

    const stop = () => {
      worker.terminate();
      signal?.removeEventListener('abort', abort);
    };

    const abort = () => {
      stop();
      reject(new Error('CANCELLED'));
    };

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener('abort', abort, { once: true });

    worker.onmessage = ({ data }) => {
      stop();
      if (data.error) reject(new Error(data.error));
      else resolve(data.result as T);
    };

    worker.onerror = () => {
      stop();
      reject(new Error('PROCESSING_FAILED'));
    };

    worker.postMessage({ operation, data });
  });
}

export function downloadFile(
  data: BlobPart,
  name: string,
  type = 'application/octet-stream',
) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
