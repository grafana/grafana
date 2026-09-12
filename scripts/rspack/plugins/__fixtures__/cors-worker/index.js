const worker = new Worker(new URL('./worker.js', import.meta.url));
worker.postMessage('ping');
