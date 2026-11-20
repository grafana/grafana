globalThis.onmessage = async () => {
  // Dynamic import forces the publicPath runtime requirement into the worker runtime.
  await import('./lazy.js');
};
