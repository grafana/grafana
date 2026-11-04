// Collected samples measure allocation churn, not just surviving objects.
const inspector = require('node:inspector');
const fs = require('node:fs');
const zlib = require('node:zlib');
const v8 = require('node:v8');
module.exports.checkpoint = async () => {};
if (process.env.SHARD1_ALLOCATION_PROFILE) {
  const prefix = `${process.env.SHARD1_ALLOCATION_PROFILE}.${process.pid}`;
  const session = new inspector.Session();
  session.connect();
  const options = {
    samplingInterval: 1048576,
    includeObjectsCollectedByMajorGC: true,
    includeObjectsCollectedByMinorGC: true,
  };
  const post = (method, params = {}) => new Promise((resolve, reject) => {
    session.post(method, params, (error, result) => error ? reject(error) : resolve(result));
  });
  let phase = 'startup-imports';
  const write = (result) => fs.writeFileSync(`${prefix}.${phase}.heapprofile.gz`, zlib.gzipSync(JSON.stringify(result.profile)));
  session.post('HeapProfiler.startSampling', options, (error) => { if (error) throw error; });
  module.exports.checkpoint = async (next) => {
    write(await post('HeapProfiler.stopSampling'));
    phase = next;
    await post('HeapProfiler.startSampling', options);
  };
  const retention = [];
  const retain = (label) => {
    const before = process.memoryUsage();
    if (global.gc) global.gc();
    retention.push({ label, before, after: process.memoryUsage(), spaces: v8.getHeapSpaceStatistics() });
  };
  module.exports.retention = retain;
  process.once('beforeExit', () => { retain('beforeExit'); });
  process.once('exit', () => {
    session.post('HeapProfiler.stopSampling', (error, result) => {
      if (error) { console.error(error); return; }
      write(result);
    });
    fs.writeFileSync(`${prefix}.retention.json`, JSON.stringify({ forcedGc: Boolean(global.gc), retention }, null, 2));
    session.disconnect();
  });
}
