const assert = require('node:assert/strict');
const test = require('node:test');

const { PullRequestNormalizer } = require('./PullRequestNormalizer');

const normalizer = new PullRequestNormalizer({ teamOrg: 'grafana' });

test('changedFiles preserves zero and cached values and precedes churn', () => {
  const cached = { number: 7, changedFiles: 10 };
  const fresh = normalizer.fromGraphQL({ number: 7, changedFiles: 0, additions: 0, deletions: 0 }, cached);
  assert.equal(fresh.changedFiles, 0);
  assert.equal(Object.keys(fresh).indexOf('changedFiles') + 1, Object.keys(fresh).indexOf('churn'));
  assert.equal(normalizer.fromGraphQL({ number: 7 }, cached).changedFiles, 10);
  assert.equal(Object.hasOwn(normalizer.fromGraphQL({ number: 7 }, { number: 7 }), 'changedFiles'), false);
});

test('sizeFromChurn uses additions plus deletions at each boundary independently of labels', () => {
  for (const [additions, deletions, size] of [
    [0, 0, 'size/small'],
    [20, 29, 'size/small'],
    [20, 30, 'size/medium'],
    [300, 299, 'size/medium'],
    [300, 300, 'size/large'],
    [1000, 100, 'size/large'],
  ]) {
    const pr = normalizer.fromGraphQL(
      { number: 7, additions, deletions, labels: { nodes: [{ name: 'size/XL' }] } },
      { number: 7, churn: { additions: 1, deletions: 1, size: 'size/small' } }
    );
    assert.deepEqual(pr.churn, { additions, deletions, total: additions + deletions });
    assert.equal(pr.sizeFromChurn, size);
    assert.equal(Object.keys(pr).indexOf('churn') + 1, Object.keys(pr).indexOf('sizeFromChurn'));
    assert.equal(Object.keys(pr).indexOf('sizeFromChurn') + 1, Object.keys(pr).indexOf('sizeFromLabels'));
    assert.equal(pr.sizeFromLabels, 'size/XL');
    assert.equal(Object.hasOwn(pr, 'size'), false);
  }
});

test('partial diff counts stay unclassified', () => {
  for (const counts of [{ additions: 0 }, { deletions: 600 }]) {
    const pr = normalizer.fromGraphQL({ number: 7, ...counts }, { number: 7 });
    assert.deepEqual(pr.churn, counts);
    assert.equal(Object.hasOwn(pr, 'sizeFromChurn'), false);
  }
});

test('legacy cached size migrates to sizeFromLabels when labels are omitted', () => {
  const pr = normalizer.fromGraphQL({ number: 7 }, { number: 7, size: 'size/S' });
  assert.equal(pr.sizeFromLabels, 'size/S');
  assert.equal(Object.hasOwn(pr, 'size'), false);
});

test('diff counts remain raw, preserve zero, and use cached values only when omitted', () => {
  const cached = { number: 7, churn: { additions: 120, deletions: 45, total: 165 } };
  const fresh = normalizer.fromGraphQL(
    { number: 7, additions: 0, deletions: 2, labels: { nodes: [{ name: 'size/S' }] } },
    cached
  );
  assert.deepEqual(fresh.churn, { additions: 0, deletions: 2, total: 2 });
  assert.equal(fresh.sizeFromChurn, 'size/small');
  assert.equal(Object.hasOwn(fresh, 'additions'), false);
  assert.equal(Object.hasOwn(fresh, 'deletions'), false);
  assert.equal(Object.keys(fresh).indexOf('sizeFromChurn') + 1, Object.keys(fresh).indexOf('sizeFromLabels'));
  const fallback = normalizer.fromGraphQL({ number: 7 }, cached);
  assert.deepEqual(fallback.churn, { additions: 120, deletions: 45, total: 165 });
  assert.equal(fallback.sizeFromChurn, 'size/medium');
});

test('every field the node carries lands on the row', () => {
  const node = {
    number: 7,
    title: 'Fix the thing',
    url: 'https://github.com/o/n/pull/7',
    author: { login: 'alice' },
    authorAssociation: 'MEMBER',
    mergeable: 'MERGEABLE',
    reviewDecision: 'APPROVED',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'SUCCESS' } } }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr, {
    number: 7,
    title: 'Fix the thing',
    url: 'https://github.com/o/n/pull/7',
    author: 'alice',
    authorType: 'MEMBER',
    reviewers: [],
    labels: [],
    mergeable: 'MERGEABLE',
    status: 'APPROVED',
    ciStatus: 'SUCCESS',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  });
});

// Cache records keep raw GitHub values under the report field names.
test('the values stay raw, and the words are left to the present phase', () => {
  const node = {
    number: 7,
    authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
    mergeable: 'CONFLICTING',
    reviewDecision: 'CHANGES_REQUESTED',
    commits: { nodes: [{ commit: { statusCheckRollup: { state: 'FAILURE' } } }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.equal(pr.authorType, 'FIRST_TIME_CONTRIBUTOR');
  assert.equal(pr.mergeable, 'CONFLICTING');
  assert.equal(pr.status, 'CHANGES_REQUESTED');
  assert.equal(pr.ciStatus, 'FAILURE');
});

test('a bare node produces no keys for the fields it never mentioned', () => {
  const pr = normalizer.fromGraphQL({ number: 7 }, { number: 7 });

  assert.deepEqual(pr, {
    number: 7,
    reviewers: [],
    labels: [],
    status: '',
    ciStatus: '',
  });
});

test('the cached value survives a field the node omits', () => {
  const cached = {
    number: 7,
    title: 'Cached title',
    url: 'cached-url',
    author: 'alice',
    authorType: 'MEMBER',
    mergeable: 'MERGEABLE',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
  };

  const pr = normalizer.fromGraphQL({ number: 7 }, cached);

  assert.equal(pr.title, 'Cached title');
  assert.equal(pr.url, 'cached-url');
  assert.equal(pr.author, 'alice');
  assert.equal(pr.authorType, 'MEMBER');
  assert.equal(pr.mergeable, 'MERGEABLE');
  assert.equal(pr.createdAt, '2026-01-01T00:00:00Z');
  assert.equal(pr.updatedAt, '2026-01-02T00:00:00Z');
});

// An explicit null clears the cached author when an account has been deleted.
test('an explicitly null author clears the cached one', () => {
  const pr = normalizer.fromGraphQL({ number: 7, author: null }, { number: 7, author: 'alice' });

  assert.equal(pr.author, null);
});

// Fetched empty states clear cached approvals and CI results.
test('review decision and CI state fall back to blank, never to the cached value', () => {
  const cached = { number: 7, status: 'APPROVED', ciStatus: 'SUCCESS' };

  const pr = normalizer.fromGraphQL({ number: 7 }, cached);

  assert.equal(pr.status, '');
  assert.equal(pr.ciStatus, '');
});

test('fields the row no longer holds never survive from the cache', () => {
  const cached = { number: 7, issueTypes: ['type/bug'], ciFail: ['build'], prLabels: ['area/frontend'] };

  const pr = normalizer.fromGraphQL({ number: 7 }, cached);

  assert.equal('issueTypes' in pr, false);
  assert.equal('ciFail' in pr, false);
  assert.equal('prLabels' in pr, false);
});

test('reviewers list the reviews first, then the outstanding requests', () => {
  const node = {
    number: 7,
    latestReviews: { nodes: [{ author: { login: 'bob' } }] },
    reviewRequests: { nodes: [{ requestedReviewer: { login: 'carol' } }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.reviewers, ['bob', 'carol']);
});

test('reviewers never include the author, whatever the casing', () => {
  const node = {
    number: 7,
    author: { login: 'Alice' },
    latestReviews: { nodes: [{ author: { login: 'alice' } }, { author: { login: 'bob' } }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.reviewers, ['bob']);
});

test('a reviewer who both reviewed and is re-requested appears once, in its first spelling', () => {
  const node = {
    number: 7,
    latestReviews: { nodes: [{ author: { login: 'Bob' } }] },
    reviewRequests: { nodes: [{ requestedReviewer: { login: 'bob' } }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.reviewers, ['Bob']);
});

test('a requested team reads as org/slug, and an unreadable reviewer is skipped', () => {
  const node = {
    number: 7,
    reviewRequests: { nodes: [{ requestedReviewer: { slug: 'dashboards-squad' } }, { requestedReviewer: null }, {}] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.reviewers, ['grafana/dashboards-squad']);
});

test('labels are kept as plain names', () => {
  const node = { number: 7, labels: { nodes: [{ name: 'area/dashboards' }, { name: 'type/bug' }] } };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.labels, ['area/dashboards', 'type/bug']);
});

test('size is extracted while all labels remain in their original order', () => {
  const node = {
    number: 7,
    labels: { nodes: [{ name: 'size/M' }, { name: 'area/dashboards' }, { name: 'size/L' }] },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.equal(pr.sizeFromLabels, 'size/M');
  assert.deepEqual(pr.labels, ['size/M', 'area/dashboards', 'size/L']);
});

test('the cached size survives when labels are omitted', () => {
  const pr = normalizer.fromGraphQL({ number: 7 }, { number: 7, sizeFromLabels: 'size/S' });

  assert.equal(pr.sizeFromLabels, 'size/S');
});

test('fetched labels without a size clear the cached size', () => {
  for (const nodes of [[], [{ name: 'type/bug' }]]) {
    const pr = normalizer.fromGraphQL({ number: 7, labels: { nodes } }, { number: 7, sizeFromLabels: 'size/S' });

    assert.equal(Object.hasOwn(pr, 'sizeFromLabels'), false);
  }
});

test('a fetched size replaces the cached size', () => {
  const pr = normalizer.fromGraphQL(
    { number: 7, labels: { nodes: [{ name: 'size/L' }] } },
    { number: 7, sizeFromLabels: 'size/S' }
  );

  assert.equal(pr.sizeFromLabels, 'size/L');
});

test('comment counts stay on the issue they were counted on, zero included', () => {
  const node = {
    number: 7,
    closingIssuesReferences: {
      totalCount: 3,
      nodes: [
        { number: 1, url: 'u1', comments: { totalCount: 3 } },
        { number: 2, url: 'u2', comments: { totalCount: 0 } },
        { number: 3, url: 'u3' },
      ],
    },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.fixes.issues, [
    { number: 1, url: 'u1', comments: 3 },
    { number: 2, url: 'u2', comments: 0 },
    { number: 3, url: 'u3' },
  ]);
  assert.equal('issueComments' in pr, false);
});

// The total may exceed the returned issues because the query limits the list.
test('fixed issues keep their number and url, and an incomplete one is dropped', () => {
  const node = {
    number: 7,
    closingIssuesReferences: {
      totalCount: 3,
      nodes: [{ number: 1, url: 'u1' }, { number: 2 }, { url: 'u3' }],
    },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.fixes, { total: 3, issues: [{ number: 1, url: 'u1' }] });
});

test('the issue type wins over the issue labels, and both are deduped', () => {
  const node = {
    number: 7,
    closingIssuesReferences: {
      totalCount: 1,
      nodes: [
        {
          number: 1,
          url: 'u1',
          issueType: { name: 'type/bug' },
          labels: { nodes: [{ name: 'Type/Bug' }, { name: 'type/regression' }, { name: 'area/dashboards' }] },
        },
      ],
    },
  };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.fixes.issues[0].type, ['type/bug', 'type/regression']);
});

test("the PR's own type labels are used only when the issue has none", () => {
  const node = {
    number: 7,
    labels: { nodes: [{ name: 'type/bug' }, { name: 'area/dashboards' }] },
    closingIssuesReferences: { totalCount: 1, nodes: [{ number: 1, url: 'u1' }] },
  };

  assert.deepEqual(normalizer.fromGraphQL(node, { number: 7 }).fixes.issues[0].type, ['type/bug']);

  const typed = {
    ...node,
    closingIssuesReferences: { totalCount: 1, nodes: [{ number: 1, url: 'u1', issueType: { name: 'type/epic' } }] },
  };
  assert.deepEqual(normalizer.fromGraphQL(typed, { number: 7 }).fixes.issues[0].type, ['type/epic']);
});

test('an issue with no type at all carries no type key', () => {
  const node = { number: 7, closingIssuesReferences: { totalCount: 1, nodes: [{ number: 1, url: 'u1' }] } };

  const pr = normalizer.fromGraphQL(node, { number: 7 });

  assert.deepEqual(pr.fixes.issues, [{ number: 1, url: 'u1' }]);
});

// Zero clears cached fixes; an omitted total keeps them.
test('the cached fixes survive a node that says nothing about closing issues', () => {
  const cached = { number: 7, fixes: { total: 2, issues: [{ number: 1, url: 'u1' }] } };

  const pr = normalizer.fromGraphQL({ number: 7 }, cached);

  assert.deepEqual(pr.fixes, { total: 2, issues: [{ number: 1, url: 'u1' }] });
});

test('a node that fixes nothing clears the cached fixes', () => {
  const cached = { number: 7, fixes: { total: 2, issues: [{ number: 1, url: 'u1' }] } };

  const pr = normalizer.fromGraphQL({ number: 7, closingIssuesReferences: { totalCount: 0, nodes: [] } }, cached);

  assert.deepEqual(pr.fixes, { total: 0, issues: [] });
});

test('the cached row is left untouched', () => {
  const cached = { number: 7, title: 'Cached title', reviewers: ['bob'] };

  const pr = normalizer.fromGraphQL({ number: 7, title: 'New title' }, cached);

  assert.deepEqual(cached, { number: 7, title: 'Cached title', reviewers: ['bob'] });
  assert.equal(pr.title, 'New title');
});

// Reusing the normalizer must not carry data from one PR to the next.
test('one instance normalizes many nodes without carrying anything between them', () => {
  const first = normalizer.fromGraphQL({ number: 1, labels: { nodes: [{ name: 'size/XS' }] } }, { number: 1 });
  const second = normalizer.fromGraphQL({ number: 2 }, { number: 2 });

  assert.equal(first.sizeFromLabels, 'size/XS');
  assert.equal(second.sizeFromLabels, undefined);
  assert.deepEqual(second.reviewers, []);
  assert.deepEqual(second, normalizer.fromGraphQL({ number: 2 }, { number: 2 }));
});

test('the team org it was built with is what prefixes a team reviewer', () => {
  const other = new PullRequestNormalizer({ teamOrg: 'acme' });
  const node = { number: 7, reviewRequests: { nodes: [{ requestedReviewer: { slug: 'squad' } }] } };

  assert.deepEqual(other.fromGraphQL(node, { number: 7 }).reviewers, ['acme/squad']);
  assert.deepEqual(normalizer.fromGraphQL(node, { number: 7 }).reviewers, ['grafana/squad']);
});

test('normalizeLogins: logins are lower-cased, trimmed, deduped and sorted', () => {
  assert.deepEqual(PullRequestNormalizer.normalizeLogins([' Bravo', 'alpha', 'ALPHA', '']), ['alpha', 'bravo']);
});

test('normalizeLogins: empty input and blank logins produce no members', () => {
  assert.deepEqual(PullRequestNormalizer.normalizeLogins([]), []);
  assert.deepEqual(PullRequestNormalizer.normalizeLogins(['', '  ', '\t']), []);
});

test('normalizeLogins: the source list stays untouched', () => {
  const logins = [' Bravo', 'alpha', 'ALPHA', ''];
  const before = [...logins];
  PullRequestNormalizer.normalizeLogins(logins);
  assert.deepEqual(logins, before);
});
