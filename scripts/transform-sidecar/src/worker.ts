import { parentPort } from 'node:worker_threads';

import { dataFrameFromJSON } from '../../../packages/grafana-data/src/dataframe/DataFrameJSON';
import { type DataFrame } from '../../../packages/grafana-data/src/types/dataFrame';

import { arrowToDataFrame, dataFrameToArrow, readEnvelope, writeEnvelope } from './arrow';
import { BadRequestError, parseTransformRequest, toGoFrameJSON, transformFrames, type StageTimings } from './transform';

export type WireFormat = 'json' | 'arrow';

export interface WorkerPayload {
  format: WireFormat;
  bytes: Uint8Array;
}

export type WorkerResult =
  | { ok: true; body: string | Uint8Array; timings: StageTimings }
  | { ok: false; kind: 'bad_request' | 'transform_error'; message: string };

if (!parentPort) {
  throw new Error('worker.ts must run as a worker thread');
}
const port = parentPort;
const utf8Decoder = new TextDecoder();

// Decoding and encoding happen here, not in the server thread, so large payloads stay off the
// event loop that serves health checks.
port.on('message', async ({ id, payload }: { id: number; payload: WorkerPayload }) => {
  let result: WorkerResult;
  const transfer: ArrayBuffer[] = [];
  try {
    const timings: StageTimings = {};
    let mark = performance.now();
    const lap = (stage: string) => {
      const now = performance.now();
      timings[stage] = now - mark;
      mark = now;
    };

    let frames: DataFrame[];
    let request;
    if (payload.format === 'arrow') {
      const envelope = readEnvelope(payload.bytes);
      request = parseTransformRequest(envelope.header);
      lap('parse');
      frames = envelope.frames.map(arrowToDataFrame);
    } else {
      request = parseTransformRequest(utf8Decoder.decode(payload.bytes));
      lap('parse');
      frames = request.frames.map((frame) => dataFrameFromJSON(frame));
    }
    lap('decode');

    const output = await transformFrames(frames, request.transformations, request);
    lap('transform');

    let body: string | Uint8Array;
    if (payload.format === 'arrow') {
      body = writeEnvelope('{}', output.map(dataFrameToArrow));
      transfer.push(body.buffer instanceof ArrayBuffer ? body.buffer : new Uint8Array(body).buffer);
      lap('encode');
    } else {
      const response = { frames: output.map(toGoFrameJSON) };
      lap('encode');
      body = JSON.stringify(response);
      lap('stringify');
    }
    result = { ok: true, body, timings };
  } catch (err) {
    result = {
      ok: false,
      kind: err instanceof BadRequestError ? 'bad_request' : 'transform_error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
  port.postMessage({ id, result }, transfer);
});
