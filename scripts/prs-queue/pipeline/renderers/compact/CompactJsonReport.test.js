const assert = require('node:assert/strict');
const test = require('node:test');

const { CompactJsonReport } = require('./CompactJsonReport');

// Use presented values here; translating GitHub states belongs to the presenter.
function renderPr(pr) {
  const report = new CompactJsonReport({ repo: 'grafana/grafana', team: 'grafana/dashboards-squad' });
  const { prs } = JSON.parse(report.render({ prs: [pr] }));
  return prs[0];
}

test('render: output is a single line of JSON ending in a newline', () => {
  const report = new CompactJsonReport({ repo: 'grafana/grafana', team: 'grafana/dashboards-squad' });

  const out = report.render({ prs: [] });

  assert.equal(out.split('\n').length, 2);
  assert.ok(out.endsWith('\n'));
  assert.doesNotThrow(() => JSON.parse(out));
});

test('render: payload carries the repo and team it was given', () => {
  const report = new CompactJsonReport({ repo: 'o/n', team: 'o/slug' });

  const payload = JSON.parse(report.render({ prs: [] }));

  assert.equal(payload.repo, 'o/n');
  assert.equal(payload.team, 'o/slug');
});

// Each PR already includes its contributor type.
test('render: the payload does not repeat the contributor types as a header field', () => {
  const report = new CompactJsonReport({ repo: 'o/n', team: 'o/slug' });

  const payload = JSON.parse(report.render({ prs: [{ number: 7, authorType: 'Member' }] }));

  assert.equal('contributorTypes' in payload, false);
  assert.equal(payload.prs[0].authorType, 'Member');
});

test('render: total counts the PRs, which are emitted in the order given', () => {
  const report = new CompactJsonReport({ repo: 'grafana/grafana', team: 'grafana/dashboards-squad' });

  const payload = JSON.parse(report.render({ prs: [{ number: 2 }, { number: 1 }] }));

  assert.equal(payload.total, 2);
  assert.deepEqual(
    payload.prs.map((pr) => pr.number),
    [2, 1]
  );
});

test('renderPr (static): one PR is one bare object on a single line', () => {
  const out = CompactJsonReport.renderPr({ number: 7, title: 'a', url: 'u', author: 'x' });

  assert.equal(out.split('\n').length, 2);
  assert.ok(out.endsWith('\n'));
  assert.deepEqual(JSON.parse(out), { number: 7, title: 'a', url: 'u', author: 'x' });
});

test('renderPr (static): the object is what the queue payload puts in prs', () => {
  const pr = { number: 7, title: 'a', url: 'u', author: 'x', authorType: 'Member', labels: [] };
  const report = new CompactJsonReport({ repo: 'o/n', team: 'o/slug' });

  assert.deepEqual(JSON.parse(CompactJsonReport.renderPr(pr)), JSON.parse(report.render({ prs: [pr] })).prs[0]);
});

test('renderPr: a fully populated PR keeps every field, nesting included', () => {
  const pr = {
    number: 7,
    title: 'Fix the thing',
    url: 'https://github.com/o/n/pull/7',
    author: 'someone',
    authorType: 'Member',
    status: 'Changes requested',
    mergeable: 'Conflicts',
    ciStatus: 'Fail',
    age: '3d',
    updated: '1h',
    sizeFromLabels: 'size/XL',
    fixes: { total: 1, issues: [{ number: 1, url: 'https://github.com/o/n/issues/1', comments: 4 }] },
    reviewers: ['a', 'b'],
    labels: ['area/dashboards'],
  };

  assert.deepEqual(renderPr(pr), pr);
});

test('renderPr: a bare PR keeps only the fields it actually has', () => {
  const presented = {
    number: 7,
    title: 'a',
    url: 'u',
    author: 'x',
    authorType: '',
    status: '',
    mergeable: '',
    ciStatus: undefined,
    age: '',
    updated: '',
    sizeFromLabels: '',
    fixes: undefined,
    reviewers: [],
    labels: [],
  };

  assert.deepEqual(renderPr(presented), { number: 7, title: 'a', url: 'u', author: 'x' });
});

test('renderPr: null, undefined and empty-string fields are dropped', () => {
  const pr = renderPr({ number: 7, title: '', url: null, author: undefined, status: '', mergeable: null });

  assert.deepEqual(Object.keys(pr), ['number']);
});

// Omit empty lists as well as null values.
test('renderPr: empty lists are dropped, and a list with anything in it is kept', () => {
  assert.deepEqual(Object.keys(renderPr({ number: 7, reviewers: [], labels: [] })), ['number']);
  assert.deepEqual(renderPr({ number: 7, labels: ['type/bug'] }).labels, ['type/bug']);
});

test('renderPr: each fixed issue keeps its own comment count, zero included', () => {
  const fixes = {
    total: 2,
    issues: [
      { number: 1, url: 'u1', comments: 4 },
      { number: 2, url: 'u2', comments: 0 },
    ],
  };

  assert.deepEqual(renderPr({ number: 7, fixes }).fixes, fixes);
  assert.equal('issueComments' in renderPr({ number: 7, fixes }), false);
});
