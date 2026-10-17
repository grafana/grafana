import { type TransferListItem, Worker } from 'node:worker_threads';

export class PoolBusyError extends Error {}
export class PoolTimeoutError extends Error {}
export class WorkerCrashError extends Error {}

interface Job<TPayload, TResult> {
  id: number;
  payload: TPayload;
  transfer: TransferListItem[];
  resolve: (value: TResult) => void;
  reject: (err: Error) => void;
}

interface Slot<TPayload, TResult> {
  worker: Worker;
  job?: Job<TPayload, TResult>;
  timer?: NodeJS.Timeout;
}

export interface PoolOptions {
  size: number;
  queueLimit: number;
  timeoutMs: number;
}

/**
 * Runs payloads on a fixed set of worker threads, one at a time per worker. A timed-out worker is terminated rather than
 * left running, because transforms are synchronous and cannot observe cancellation.
 */
export class WorkerPool<TPayload, TResult> {
  private readonly slots: Array<Slot<TPayload, TResult>> = [];
  private readonly queue: Array<Job<TPayload, TResult>> = [];
  private nextId = 0;
  private closed = false;
  private readonly workerFile: string;
  private readonly options: PoolOptions;

  constructor(workerFile: string, options: PoolOptions) {
    this.workerFile = workerFile;
    this.options = options;
    for (let i = 0; i < options.size; i++) {
      this.slots.push(this.spawn());
    }
  }

  /** transfer lists buffers in payload to move to the worker instead of copying. */
  run(payload: TPayload, transfer: TransferListItem[] = []): Promise<TResult> {
    if (this.closed) {
      return Promise.reject(new Error('pool is closed'));
    }
    if (this.queue.length >= this.options.queueLimit && !this.slots.some((s) => !s.job)) {
      return Promise.reject(new PoolBusyError(`queue limit ${this.options.queueLimit} reached`));
    }

    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, payload, transfer, resolve, reject });
      this.dispatch();
    });
  }

  get stats() {
    return { size: this.slots.length, busy: this.slots.filter((s) => s.job).length, queued: this.queue.length };
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const job of this.queue.splice(0)) {
      job.reject(new Error('pool is closed'));
    }
    await Promise.all(
      this.slots.map((slot) => {
        this.finish(slot)?.reject(new Error('pool is closed'));
        return slot.worker.terminate();
      })
    );
  }

  private spawn(): Slot<TPayload, TResult> {
    const slot: Slot<TPayload, TResult> = { worker: new Worker(this.workerFile) };

    slot.worker.on('message', (msg: { id: number; result: TResult }) => {
      if (slot.job?.id !== msg.id) {
        return;
      }
      this.finish(slot)?.resolve(msg.result);
      this.dispatch();
    });

    slot.worker.on('error', (err) => this.replace(slot, new WorkerCrashError(err.message)));
    slot.worker.on('exit', (code) => this.replace(slot, new WorkerCrashError(`worker exited with code ${code}`)));

    return slot;
  }

  private dispatch() {
    for (const slot of this.slots) {
      if (slot.job) {
        continue;
      }
      const job = this.queue.shift();
      if (!job) {
        return;
      }
      slot.job = job;
      slot.timer = setTimeout(() => {
        this.replace(slot, new PoolTimeoutError(`transform exceeded ${this.options.timeoutMs}ms`));
      }, this.options.timeoutMs);
      slot.worker.postMessage({ id: job.id, payload: job.payload }, job.transfer);
    }
  }

  private finish(slot: Slot<TPayload, TResult>): Job<TPayload, TResult> | undefined {
    const job = slot.job;
    clearTimeout(slot.timer);
    slot.job = undefined;
    slot.timer = undefined;
    return job;
  }

  private replace(slot: Slot<TPayload, TResult>, err: Error) {
    const index = this.slots.indexOf(slot);
    if (index === -1 || this.closed) {
      return;
    }
    this.finish(slot)?.reject(err);
    slot.worker.removeAllListeners();
    slot.worker.terminate();
    this.slots[index] = this.spawn();
    this.dispatch();
  }
}
