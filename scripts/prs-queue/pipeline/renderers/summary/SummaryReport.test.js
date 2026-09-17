const assert = require('node:assert/strict');
const test = require('node:test');

const { SummaryReport } = require('./SummaryReport');

function prWithType(number, authorType) {
  return { number, authorType };
}

function scopeWith({ members = [], createdByTeamMembers = [], fromTeam = [], fromIndividualMember = [] } = {}) {
  return {
    members: new Set(members),
    createdByTeamMembers: new Set(createdByTeamMembers),
    reviewRequests: { fromTeam: new Set(fromTeam), fromIndividualMember: new Set(fromIndividualMember) },
  };
}

function render(run, paths = {}) {
  const report = new SummaryReport({
    repo: 'grafana/grafana',
    team: 'grafana/dashboards-squad',
    cachePath: 'output/cache/x.cache.json',
    outputPath: 'output/reports/open-prs.md',
    ...paths,
  });
  const { contributions = [], ...state } = run;
  return report.render({
    run: { prs: [], scope: scopeWith(), added: 0, removed: 0, refetched: 0, reused: 0, ...state },
    contributions,
  });
}

test('render: pretty-printed JSON ending in a newline', () => {
  const out = render({});

  assert.ok(out.endsWith('\n'));
  assert.ok(out.includes('\n  "repo"'));
  assert.doesNotThrow(() => JSON.parse(out));
});

test('render: the payload carries the repo and team it was given', () => {
  const payload = JSON.parse(render({}, { repo: 'o/n', team: 'o/slug' }));

  assert.equal(payload.repo, 'o/n');
  assert.equal(payload.team, 'o/slug');
});

test('render: members are listed in alphabetical order, not the order the set held them', () => {
  const payload = JSON.parse(render({ scope: scopeWith({ members: ['zoe', 'ann', 'bob'] }) }));

  assert.deepEqual(payload.members, ['ann', 'bob', 'zoe']);
});

// Overlapping searches must not count the same PR twice.
test('render: the total is the PRs loaded, not the sum of the three searches', () => {
  const payload = JSON.parse(
    render({
      prs: [prWithType(1, 'MEMBER'), prWithType(2, 'MEMBER')],
      scope: scopeWith({ createdByTeamMembers: [1, 2], fromTeam: [2], fromIndividualMember: [1, 2] }),
    })
  );

  assert.deepEqual(payload.prs, {
    total: 2,
    createdByTeamMembers: 2,
    reviewRequests: { fromTeam: 1, fromIndividualMember: 2 },
  });
});

test('render: preserves the supplied contribution counts and order', () => {
  const payload = JSON.parse(
    render({
      contributions: [
        { type: 'First-time contributor', count: 1 },
        { type: 'Contributor', count: 1 },
        { type: 'Member', count: 2 },
      ],
    })
  );

  assert.deepEqual(Object.entries(payload.contributions), [
    ['First-time contributor', 1],
    ['Contributor', 1],
    ['Member', 2],
  ]);
});

test('render: an unknown type is flagged in its own key', () => {
  const payload = JSON.parse(
    render({
      contributions: [
        { type: 'Member', count: 1 },
        { type: 'SOMETHING_ELSE (unknown type)', count: 1 },
      ],
    })
  );

  assert.deepEqual(payload.contributions, { Member: 1, 'SOMETHING_ELSE (unknown type)': 1 });
});

test('render: the cache block reports what the run did, zeros included', () => {
  const payload = JSON.parse(render({ refetched: 34, reused: 30, added: 2, removed: 0 }));

  assert.deepEqual(payload.cache, {
    refetched: 34,
    reused: 30,
    added: 2,
    removed: 0,
    path: 'output/cache/x.cache.json',
  });
});

// The output service supplies display paths; the renderer should leave them unchanged.
test('render: both paths are emitted verbatim', () => {
  const payload = JSON.parse(render({}, { cachePath: 'a/b.cache.json', outputPath: 'c/d.md' }));

  assert.equal(payload.cache.path, 'a/b.cache.json');
  assert.equal(payload.output, 'c/d.md');
});

test('render: a run that found nothing still answers every field', () => {
  const payload = JSON.parse(render({}));

  assert.deepEqual(payload.members, []);
  assert.equal(payload.prs.total, 0);
  assert.deepEqual(payload.contributions, {});
});
