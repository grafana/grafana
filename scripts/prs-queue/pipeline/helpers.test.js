const assert = require('node:assert/strict');
const test = require('node:test');

const { newestUpdatedAt, numbersIn, parseRepo, parseTeam } = require('./helpers');

test('parseRepo: trims the input and returns the owner, name and qualified repo', () => {
  assert.deepEqual(parseRepo('  my-org/my.repo  '), { owner: 'my-org', name: 'my.repo', repo: 'my-org/my.repo' });
});

test('parseTeam: accepts qualified teams and defaults bare slugs to grafana', () => {
  assert.deepEqual(parseTeam('  acme/my-team  '), { teamOrg: 'acme', teamSlug: 'my-team' });
  assert.deepEqual(parseTeam('  my-team  '), { teamOrg: 'grafana', teamSlug: 'my-team' });
});

test('numbersIn: deduplicates PR numbers without mutating the source rows', () => {
  const prs = [{ number: 7 }, { number: 8 }, { number: 7 }];
  const before = structuredClone(prs);
  assert.deepEqual(numbersIn(prs), new Set([7, 8]));
  assert.deepEqual(numbersIn([]), new Set());
  assert.deepEqual(prs, before);
});

test('newestUpdatedAt: the newest search timestamp wins regardless of search order', () => {
  const prs = [
    { number: 7, updatedAt: '2026-09-15T00:00:00Z' },
    { number: 7, updatedAt: '2026-09-17T00:00:00Z' },
    { number: 7, updatedAt: '2026-09-16T00:00:00Z' },
    { number: 8, updatedAt: '2026-09-14T00:00:00Z' },
  ];
  const before = structuredClone(prs);
  const expected = new Map([
    [7, '2026-09-17T00:00:00Z'],
    [8, '2026-09-14T00:00:00Z'],
  ]);
  assert.deepEqual(newestUpdatedAt(prs), expected);
  assert.deepEqual(newestUpdatedAt([...prs].reverse()), expected);
  assert.deepEqual(prs, before);
});

test('newestUpdatedAt: absent timestamps never replace known timestamps', () => {
  assert.deepEqual(
    newestUpdatedAt([
      { number: 7 },
      { number: 7, updatedAt: '2026-09-17T00:00:00Z' },
      { number: 7, updatedAt: '' },
      { number: 8 },
    ]),
    new Map([[7, '2026-09-17T00:00:00Z']])
  );
  assert.deepEqual(newestUpdatedAt([]), new Map());
});
