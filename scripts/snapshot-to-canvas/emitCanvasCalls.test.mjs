import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSnapshotJson, parseJestSnapshot, eventsToCanvasScript } from './emitCanvasCalls.mjs';

test('parseSnapshotJson accepts Jest trailing commas', () => {
  const raw = `[
  {
    "a": 1,
  },
]`;
  assert.deepEqual(parseSnapshotJson(raw), [{ a: 1 }]);
});

test('parseJestSnapshot reads canvas event array exports', () => {
  const snap = `// Jest Snapshot v1
exports[\`drawMarkers test events 1\`] = \`
[
  {
    "props": {},
    "type": "save",
  },
]\`;
`;
  const map = parseJestSnapshot(snap);
  assert.equal(map.size, 1);
  const ev = map.get('drawMarkers test events 1');
  assert.deepEqual(ev, [{ type: 'save', props: {} }]);
});

test('eventsToCanvasScript emits save', () => {
  const script = eventsToCanvasScript([{ type: 'save', props: {} }], { contextName: 'c' });
  assert.match(script, /c\.save\(\)/);
});
