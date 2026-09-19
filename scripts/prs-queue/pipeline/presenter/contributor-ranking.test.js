const assert = require('node:assert/strict');
const test = require('node:test');

const { contributorCounts } = require('./contributor-ranking');

function pr(number, authorType) {
  return { number, authorType };
}

// Keep raw associations for ranking; the presenter supplies display labels.
test('contributorCounts: one entry per association, in rank order', () => {
  const counts = contributorCounts([
    pr(1, 'MEMBER'),
    pr(2, 'FIRST_TIME_CONTRIBUTOR'),
    pr(3, 'MEMBER'),
    pr(4, 'CONTRIBUTOR'),
  ]);

  assert.deepEqual(counts, [
    { type: 'FIRST_TIME_CONTRIBUTOR', count: 1 },
    { type: 'CONTRIBUTOR', count: 1 },
    { type: 'MEMBER', count: 2 },
  ]);
});

test('contributorCounts: an unknown association sorts last', () => {
  const counts = contributorCounts([pr(1, 'WHATEVER'), pr(2, 'MEMBER')]);

  assert.deepEqual(counts, [
    { type: 'MEMBER', count: 1 },
    { type: 'WHATEVER', count: 1 },
  ]);
});

test('contributorCounts: no PRs means no entries', () => {
  assert.deepEqual(contributorCounts([]), []);
});
