import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { availableParallelism } from 'node:os';
import { join } from 'node:path';

import { PoolBusyError, PoolTimeoutError, WorkerPool } from './pool';
import { supportedTransformations } from './transform';
import { type WorkerResult } from './worker';

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer, got "${raw}"`);
  }
  return value;
}

const config = {
  host: process.env.TRANSFORM_SIDECAR_HOST ?? '127.0.0.1',
  port: envInt('TRANSFORM_SIDECAR_PORT', 8095),
  workers: envInt('TRANSFORM_SIDECAR_WORKERS', Math.min(4, availableParallelism())),
  queueLimit: envInt('TRANSFORM_SIDECAR_QUEUE_LIMIT', 64),
  timeoutMs: envInt('TRANSFORM_SIDECAR_TIMEOUT_MS', 10_000),
  maxBodyBytes: envInt('TRANSFORM_SIDECAR_MAX_BODY_BYTES', 64 * 1024 * 1024),
};

function log(level: 'info' | 'error', msg: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(JSON.stringify({ level, msg, ...fields }) + '\n');
}

class BodyTooLargeError extends Error {}

function readBody(req: IncomingMessage, limit: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        // Drain instead of destroying the socket, so the client still receives the 413.
        req.removeAllListeners('data');
        req.resume();
        reject(new BodyTooLargeError(`body exceeds ${limit} bytes`));
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res: ServerResponse, status: number, body: string | object) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

const pool = new WorkerPool<string, WorkerResult>(join(__dirname, 'worker.cjs'), {
  size: config.workers,
  queueLimit: config.queueLimit,
  timeoutMs: config.timeoutMs,
});

async function handleTransform(req: IncomingMessage, res: ServerResponse) {
  const start = performance.now();
  let status: number;
  let body: string | object;

  try {
    const result = await pool.run(await readBody(req, config.maxBodyBytes));
    if (result.ok) {
      status = 200;
      body = result.body;
    } else {
      status = result.kind === 'bad_request' ? 400 : 422;
      body = { error: result.message };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof BodyTooLargeError) {
      status = 413;
    } else if (err instanceof PoolBusyError) {
      status = 503;
    } else if (err instanceof PoolTimeoutError) {
      status = 504;
    } else {
      status = 500;
    }
    body = { error: message };
  }

  send(res, status, body);
  log(status >= 500 ? 'error' : 'info', 'transform', { status, durationMs: Math.round(performance.now() - start) });
}

const server = createServer((req, res) => {
  const route = `${req.method} ${req.url}`;
  switch (route) {
    case 'POST /transform':
      handleTransform(req, res);
      return;
    case 'GET /transformations':
      send(res, 200, { transformations: supportedTransformations() });
      return;
    case 'GET /health':
      send(res, 200, { status: 'ok', pool: pool.stats });
      return;
    default:
      send(res, 404, { error: `no route for ${route}` });
  }
});

server.listen(config.port, config.host, () => {
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  log('info', 'listening', { host: config.host, port, workers: config.workers, timeoutMs: config.timeoutMs });
});

function shutdown(signal: string) {
  log('info', 'shutting down', { signal });
  server.close();
  pool.close().finally(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
