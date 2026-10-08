import { parentPort } from 'node:worker_threads';

parentPort.on('message', ({ id, payload }) => {
  if (payload.crash) {
    process.exit(3);
  }
  if (payload.blockMs) {
    // Busy-wait so the worker cannot answer, like a synchronous transform over a huge frame.
    const until = Date.now() + payload.blockMs;
    while (Date.now() < until) {}
  }
  parentPort.postMessage({ id, result: payload.echo });
});
