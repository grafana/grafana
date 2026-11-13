import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { assertBudget, createAllocationLedger, inspectTar, packageIdentity, verifyIntegrity } from './installer.mjs';

function tar(entries) {
  const buffers = [];
  for (const { name, text = '', type = '0', link = '' } of entries) {
    const data = Buffer.from(text);
    const h = Buffer.alloc(512);
    h.write(name, 0, 100);
    h.write('0000644\0', 100);
    h.write(data.length.toString(8).padStart(11, '0') + '\0', 124);
    h.fill(32, 148, 156);
    h.write(type, 156);
    h.write(link, 157, 100);
    h.write(h.reduce((a, b) => a + b, 0).toString(8).padStart(6, '0') + '\0 ', 148);
    buffers.push(h, data, Buffer.alloc((512 - data.length % 512) % 512));
  }
  return Buffer.concat([...buffers, Buffer.alloc(1024)]);
}

test('snapshot identity retains scoped names and removes peer suffixes only for archive identity', () => {
  assert.deepEqual(packageIdentity('@scope/name@1.2.3(patch_hash=abc)(react@19.2.8)'), { name: '@scope/name', version: '1.2.3', base: '@scope/name@1.2.3' });
});
test('integrity rejects changed downloads', () => {
  const b = Buffer.from('package bytes');
  const sri = 'sha512-' + createHash('sha512').update(b).digest('base64');
  verifyIntegrity(b, sri);
  assert.throws(() => verifyIntegrity(Buffer.from('wrong'), sri), /integrity mismatch/);
});
test('archive inspection counts expanded bytes and block overhead before writes', () => {
  const result = inspectTar(tar([{ name: 'package/lib/file.js', text: 'abc' }, { name: 'package/lib/file.js.map', text: '{}' }]));
  assert.equal(result.expandedBytes, 5);
  assert(result.reservedBytes > 8192);
  assert.deepEqual(result.entries.map(e => e.name), ['lib/file.js', 'lib/file.js.map']);
});
test('archive rejects traversal, absolute paths, devices, duplicates and escaping links', () => {
  for (const e of [
    { name: 'package/../bad' }, { name: '/package/bad' }, { name: 'package/device', type: '3' },
    { name: 'package/link', type: '2', link: '../../bad' },
    { name: 'package/link', type: '1', link: 'package/../../bad' },
  ]) assert.throws(() => inspectTar(tar([e])));
  assert.throws(() => inspectTar(tar([{ name: 'package/a' }, { name: 'package/a' }])), /Duplicate/);
  assert.throws(() => inspectTar(tar([{ name: 'package/a', type: '2', link: 'b' }, { name: 'package/a/x' }])), /through link/);
});
test('archive rejects corrupt headers and truncated contents', () => {
  const b = tar([{ name: 'package/a', text: 'abc' }]);
  b[0] = 0;
  assert.throws(() => inspectTar(b), /checksum/);
  assert.throws(() => inspectTar(tar([{ name: 'package/a', text: 'abc' }]).subarray(0, 513)), /size/);
});
test('archive permits safe internal symlinks and hardlinks', () => {
  const a = inspectTar(tar([{ name: 'package/a', text: 'x' }, { name: 'package/b', type: '2', link: 'a' }, { name: 'package/c', type: '1', link: 'package/a' }]));
  assert.equal(a.entries[1].target, 'a');
  assert.equal(a.entries[2].target, 'a');
});
test('incremental accounting scans only the modified subtree twice per package', () => {
  const sizes = new Map();
  const measured = [];
  const ledger = createAllocationLedger({ dependencies: 100, task: 200 }, (file) => {
    measured.push(file);
    return sizes.get(file) || 0;
  });
  for (let i = 0; i < 100; i++) {
    const file = `/nonexistent-installer-fixture/package-${i}`;
    ledger.mutate(file, true, () => sizes.set(file, 10));
    assert.deepEqual(measured.slice(-2), [file, file]);
  }
  assert.equal(measured.length, 200);
  assert.deepEqual(ledger.snapshot(5000), { dependencies: 1100, task: 1200, free: 5000 });
  ledger.mutate('/nonexistent-installer-fixture/plan', false, () => sizes.set('/nonexistent-installer-fixture/plan', 50));
  assert.deepEqual(ledger.snapshot(4950), { dependencies: 1100, task: 1250, free: 4950 });
});

test('incremental accounting includes partial writes after failure and releases removed bytes', () => {
  let size = 0;
  const ledger = createAllocationLedger({ dependencies: 0, task: 0 }, () => size);
  assert.throws(() => ledger.mutate('/nonexistent-installer-fixture/package', true, () => {
    size = 100;
    throw new Error('interrupted');
  }), /interrupted/);
  assert.deepEqual(ledger.snapshot(1000), { dependencies: 100, task: 100, free: 1000 });
  ledger.mutate('/nonexistent-installer-fixture/package', true, () => { size = 0; });
  assert.deepEqual(ledger.snapshot(1100), { dependencies: 0, task: 0, free: 1100 });
});

test('all three disk ceilings include the pending allocation', () => {
  const limits = { dependenciesAndScratch: 1000, task: 1400, minimumFree: 220 };
  assertBudget({ dependencies: 800, task: 900, free: 500 }, 100, limits);
  for (const u of [
    { dependencies: 950, task: 950, free: 500 },
    { dependencies: 800, task: 1350, free: 500 },
    { dependencies: 800, task: 900, free: 300 },
  ]) assert.throws(() => assertBudget(u, 100, limits), /DISK BUDGET/);
});
