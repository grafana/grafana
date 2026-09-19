const assert = require('node:assert/strict');
const test = require('node:test');

const { PullRequestPresenter, describeType } = require('./PullRequestPresenter');

const presenter = new PullRequestPresenter();

test('present: churn uses the normalized total without changing the cached record', () => {
  const pr = { number: 7, churn: { additions: 120, deletions: 45, total: 165 } };
  assert.equal(presenter.present(pr).churn, 165);
  assert.deepEqual(pr, { number: 7, churn: { additions: 120, deletions: 45, total: 165 } });
  assert.equal(presenter.present({ number: 7, churn: { additions: 0, deletions: 0, total: 0 } }).churn, 0);
});

test('present: churn is unknown when the normalized total is missing', () => {
  for (const counts of [{}, { additions: 5 }, { deletions: 5 }, { additions: 5, deletions: 5 }]) {
    assert.equal(presenter.present({ number: 7, churn: counts }).churn, undefined);
  }
});

function isoMinutesAgo(minutes) {
  return new Date(Date.now() - minutes * 60000).toISOString();
}

test('present: a full row keeps its shape and swaps every value for a word', () => {
  const presented = presenter.present({
    number: 7,
    title: 'Fix the thing',
    url: 'https://github.com/o/n/pull/7',
    author: 'alice',
    authorType: 'FIRST_TIME_CONTRIBUTOR',
    status: 'CHANGES_REQUESTED',
    mergeable: 'CONFLICTING',
    ciStatus: 'FAILURE',
    createdAt: isoMinutesAgo(60 * 24 * 3),
    updatedAt: isoMinutesAgo(90),
    sizeFromLabels: 'size/large',
    fixes: { total: 1, issues: [{ number: 1, url: 'u1', type: ['type/bug'], comments: 4 }] },
    reviewers: ['bob'],
    labels: ['area/frontend'],
  });

  assert.deepEqual(presented, {
    number: 7,
    title: 'Fix the thing',
    url: 'https://github.com/o/n/pull/7',
    author: 'alice',
    authorType: 'First-time contributor',
    status: 'Changes requested',
    mergeable: 'Conflicts',
    ciStatus: 'Fail',
    age: '3d',
    updated: '1h',
    changedFiles: undefined,
    churn: undefined,
    sizeFromChurn: undefined,
    sizeFromLabels: 'size/large',
    fixes: { total: 1, issues: [{ number: 1, url: 'u1', type: ['type/bug'], comments: 4 }] },
    reviewers: ['bob'],
    labels: ['area/frontend'],
  });
});

// Markdown needs blank cells; the JSON renderer removes empty fields.
test('present: a bare row answers every key, blank or empty', () => {
  assert.deepEqual(presenter.present({ number: 7 }), {
    number: 7,
    title: '',
    url: '',
    author: '',
    authorType: '',
    status: '',
    mergeable: '',
    ciStatus: undefined,
    age: '',
    updated: '',
    changedFiles: undefined,
    churn: undefined,
    sizeFromChurn: undefined,
    sizeFromLabels: '',
    fixes: undefined,
    reviewers: [],
    labels: [],
  });
});

test('present: the contributor type keeps its GitHub spelling when the queue cannot rank it', () => {
  assert.equal(presenter.present({ number: 7, authorType: 'MEMBER' }).authorType, 'Member');
  assert.equal(presenter.present({ number: 7, authorType: 'SOMETHING_NEW' }).authorType, 'SOMETHING_NEW');
});

test('present: every association GitHub can send reads as prose', () => {
  const labelOf = (authorType) => presenter.present({ number: 7, authorType }).authorType;

  assert.equal(labelOf('FIRST_TIME_CONTRIBUTOR'), 'First-time contributor');
  assert.equal(labelOf('FIRST_TIMER'), 'First-timer');
  assert.equal(labelOf('CONTRIBUTOR'), 'Contributor');
  assert.equal(labelOf('MEMBER'), 'Member');
  assert.equal(labelOf('COLLABORATOR'), 'Collaborator');
  assert.equal(labelOf('OWNER'), 'Owner');
  assert.equal(labelOf('NONE'), 'None');
  assert.equal(labelOf('MANNEQUIN'), 'Mannequin');
});

test('describeType: all GitHub associations read as their label', () => {
  assert.equal(describeType('FIRST_TIME_CONTRIBUTOR'), 'First-time contributor');
  assert.equal(describeType('FIRST_TIMER'), 'First-timer');
  assert.equal(describeType('CONTRIBUTOR'), 'Contributor');
  assert.equal(describeType('MEMBER'), 'Member');
  assert.equal(describeType('COLLABORATOR'), 'Collaborator');
  assert.equal(describeType('OWNER'), 'Owner');
  assert.equal(describeType('NONE'), 'None');
  assert.equal(describeType('MANNEQUIN'), 'Mannequin');
});

test('describeType: an unexpected type keeps its raw name and says so', () => {
  assert.equal(describeType('SOMETHING_ELSE'), 'SOMETHING_ELSE (unknown type)');
});

// PR rows and contribution counts should use the same descriptions.
test('describeType words a known type the same way present does', () => {
  for (const type of [
    'FIRST_TIME_CONTRIBUTOR',
    'FIRST_TIMER',
    'CONTRIBUTOR',
    'MEMBER',
    'COLLABORATOR',
    'OWNER',
    'NONE',
    'MANNEQUIN',
  ]) {
    assert.equal(describeType(type), presenter.present({ number: 7, authorType: type }).authorType);
  }
});

// Keep the total even when no issue details were returned.
test('present: a fix total with no issues behind it survives on its own', () => {
  assert.deepEqual(presenter.present({ number: 7, fixes: { total: 3, issues: [] } }).fixes, { total: 3 });
  assert.equal(presenter.present({ number: 7, fixes: { total: 0, issues: [] } }).fixes, undefined);
});

function statusOf(status) {
  return presenter.present({ number: 7, status }).status;
}

test('present: known review decisions read as prose, anything else is blank', () => {
  assert.equal(statusOf('APPROVED'), 'Approved');
  assert.equal(statusOf('CHANGES_REQUESTED'), 'Changes requested');
  assert.equal(statusOf('REVIEW_REQUIRED'), 'Review required');
  assert.equal(statusOf('SOMETHING_ELSE'), '');
  assert.equal(statusOf(''), '');
  assert.equal(statusOf(undefined), '');
});

function mergeableOf(mergeable) {
  return presenter.present({ number: 7, mergeable }).mergeable;
}

test('present: known mergeable states read as prose, anything else is blank', () => {
  assert.equal(mergeableOf('MERGEABLE'), 'Mergeable');
  assert.equal(mergeableOf('CONFLICTING'), 'Conflicts');
  assert.equal(mergeableOf('UNKNOWN'), 'Unknown');
  assert.equal(mergeableOf('SOMETHING_ELSE'), '');
  assert.equal(mergeableOf(undefined), '');
});

function ciOf(status) {
  return presenter.present({ number: 7, ciStatus: status }).ciStatus;
}

// Unknown CI states leave ciStatus absent.
test('present: the five CI states GitHub sends read as three words, anything else drops out', () => {
  assert.equal(ciOf('SUCCESS'), 'Pass');
  assert.equal(ciOf('FAILURE'), 'Fail');
  assert.equal(ciOf('ERROR'), 'Fail');
  assert.equal(ciOf('PENDING'), 'Pending');
  assert.equal(ciOf('EXPECTED'), 'Pending');
  assert.equal(ciOf('WHATEVER'), undefined);
  assert.equal(ciOf(''), undefined);
  assert.equal(ciOf(undefined), undefined);
});

function ageOf(createdAt) {
  return presenter.present({ number: 7, createdAt }).age;
}

test('present: durations are coarse, and the largest unit wins', () => {
  assert.equal(ageOf(isoMinutesAgo(5)), '5m');
  assert.equal(ageOf(isoMinutesAgo(90)), '1h');
  assert.equal(ageOf(isoMinutesAgo(60 * 25)), '1d');
  assert.equal(ageOf(isoMinutesAgo(60 * 24 * 3)), '3d');
});

// A brand new PR should not look like one with no timestamp at all.
test('present: anything under a minute still reads as 1m', () => {
  assert.equal(ageOf(isoMinutesAgo(0)), '1m');
});

test('present: a missing, unparseable or future date is blank', () => {
  assert.equal(ageOf(undefined), '');
  assert.equal(ageOf(''), '');
  assert.equal(ageOf('not-a-date'), '');
  assert.equal(ageOf(isoMinutesAgo(-60)), '');
});

// `age` and `updated` are the same duration read off two fields, so both have to be wired up.
test('present: age comes from createdAt and updated from updatedAt', () => {
  const presented = presenter.present({
    number: 7,
    createdAt: isoMinutesAgo(60 * 24 * 2),
    updatedAt: isoMinutesAgo(5),
  });

  assert.equal(presented.age, '2d');
  assert.equal(presented.updated, '5m');
});

// A fixed time makes reported durations reproducible.
test('present: the durations are measured from the instant given, not from the wall clock', () => {
  const pr = { number: 7, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-15T12:00:00Z' };

  const presented = presenter.present(pr, new Date('2026-09-16T00:00:00Z'));

  assert.equal(presented.age, '15d');
  assert.equal(presented.updated, '12h');
});

test('present: a later instant makes the same PR older', () => {
  const pr = { number: 7, createdAt: '2026-09-01T00:00:00Z' };

  assert.equal(presenter.present(pr, new Date('2026-09-02T00:00:00Z')).age, '1d');
  assert.equal(presenter.present(pr, new Date('2026-10-01T00:00:00Z')).age, '30d');
});

test('present: the instant defaults to now', () => {
  assert.equal(presenter.present({ number: 7, createdAt: isoMinutesAgo(90) }).age, '1h');
});

// Use the same time for every row, including near a minute boundary.
test('presentAll: every row is measured from the same instant', () => {
  const prs = [
    { number: 7, createdAt: '2026-09-01T00:00:00Z' },
    { number: 8, createdAt: '2026-09-15T23:59:59Z' },
  ];

  const presented = presenter.presentAll(prs, new Date('2026-09-16T00:00:00Z'));

  assert.deepEqual(
    presented.map((pr) => pr.age),
    ['15d', '1m']
  );
});

test('presentAll: one presented row per PR, in the order given', () => {
  const presented = presenter.presentAll([
    { number: 7, title: 'First' },
    { number: 8, title: 'Second' },
  ]);

  assert.deepEqual(
    presented.map((pr) => [pr.number, pr.title]),
    [
      [7, 'First'],
      [8, 'Second'],
    ]
  );
});

// Do not let the array index become the time argument when presenting a list.
test('presentAll: a row is presented exactly as present would on its own', () => {
  const pr = { number: 7, status: 'APPROVED', ciStatus: 'SUCCESS' };

  assert.deepEqual(presenter.presentAll([pr]), [presenter.present(pr)]);
  assert.deepEqual(presenter.presentAll([]), []);
});

test('present: preserves computed size separately from the label size immediately after churn', () => {
  const pr = {
    number: 7,
    churn: { additions: 120, deletions: 45, total: 165 },
    sizeFromChurn: 'size/medium',
    sizeFromLabels: 'size/L',
  };
  const before = structuredClone(pr);
  const presented = presenter.present(pr);
  assert.equal(presented.churn, 165);
  assert.equal(presented.sizeFromChurn, 'size/medium');
  assert.equal(presented.sizeFromLabels, 'size/L');
  assert.equal(Object.keys(presented).indexOf('churn') + 1, Object.keys(presented).indexOf('sizeFromChurn'));
  assert.deepEqual(pr, before);
});
