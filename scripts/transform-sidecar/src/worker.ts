import { parentPort } from 'node:worker_threads';

import { BadRequestError, parseTransformRequest, runTransformRequest, type StageTimings } from './transform';

export type WorkerResult =
  | { ok: true; body: string; timings: StageTimings }
  | { ok: false; kind: 'bad_request' | 'transform_error'; message: string };

if (!parentPort) {
  throw new Error('worker.ts must run as a worker thread');
}
const port = parentPort;

// Parsing and serializing here, not in the server thread, keeps large payloads off the event loop
// that serves health checks.
port.on('message', async ({ id, payload }: { id: number; payload: string }) => {
  let result: WorkerResult;
  try {
    const timings: StageTimings = {};
    let start = performance.now();
    const request = parseTransformRequest(payload);
    timings.parse = performance.now() - start;

    const response = await runTransformRequest(request, timings);

    start = performance.now();
    const body = JSON.stringify(response);
    timings.stringify = performance.now() - start;
    result = { ok: true, body, timings };
  } catch (err) {
    result = {
      ok: false,
      kind: err instanceof BadRequestError ? 'bad_request' : 'transform_error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
  port.postMessage({ id, result });
});
