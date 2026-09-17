const assert = require('node:assert/strict');
const test = require('node:test');

const { PrReport } = require('./PrReport');

const { esc, fixesCell, issueCommentsCell } = PrReport;

const CONFIG = {
  repo: 'o/n',
  team: 'o/squad',
  teamOrg: 'o',
  teamSlug: 'squad',
};

function reportData() {
  return {
    prs: [
      {
        number: 7,
        title: 'Fix the thing [urgent]',
        url: 'https://github.com/o/n/pull/7',
        author: 'alice',
        authorType: 'First-time contributor',
        reviewers: ['bob', 'o/squad'],
        labels: ['area/frontend', 'type/bug'],
        changedFiles: 3,
        churn: 165,
        sizeFromChurn: 'size/medium',
        sizeFromLabels: 'size/large',
        fixes: {
          total: 2,
          issues: [
            { number: 1, url: 'https://github.com/o/n/issues/1', type: ['type/bug'], comments: 3 },
            { number: 2, url: 'https://github.com/o/n/issues/2', comments: 0 },
          ],
        },
        mergeable: 'Conflicts',
        status: 'Changes requested',
        ciStatus: 'Fail',
        age: '3d',
        updated: '1h',
      },
      {
        number: 8,
        title: 'Bare',
        url: 'https://github.com/o/n/pull/8',
        author: 'carol',
        authorType: 'Member',
        reviewers: [],
        labels: [],
        status: '',
        ciStatus: '',
      },
    ],
    run: { scope: { members: new Set(['alice', 'carol']) } },
    contributions: [
      { type: 'First-time contributor', count: 1 },
      { type: 'Member', count: 1 },
    ],
    generatedAt: '2026-09-16T10:11:12.000Z',
  };
}

// Check the full Markdown output so changes to any column are visible.
test('render: the whole document, column by column', () => {
  const markdown = new PrReport(CONFIG).render(reportData());

  assert.equal(
    markdown,
    `# Open PR contributors

Source: [o/n pull requests](https://github.com/o/n/pulls)

Generated 2026-09-16 @10:11:12

2 open PRs from [@o/squad](https://github.com/orgs/o/teams/squad) (2 members), authored by a member, or requesting review from that team or a member.

Contributions:

- First-time contributor: 1
- Member: 1

| # | Status | Mergeable | CI | Age | Last Updated | PR | Author | Contributor type | Files changed | Churn | Size from churn | Size from labels | Fixes / unblocks | Issue comments | Reviewers | Labels |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Changes requested | Conflicts | Fail | 3d | 1h ago | [Fix the thing \\[urgent\\]](https://github.com/o/n/pull/7) | [alice](https://github.com/alice) | First-time contributor | 3 | 165 | size/medium | size/large | 1. [#1](https://github.com/o/n/issues/1) (type/bug)<br>2. [#2](https://github.com/o/n/issues/2) | 1. [#1](https://github.com/o/n/issues/1): 3<br>2. [#2](https://github.com/o/n/issues/2): 0 | bob, o/squad | area/frontend, type/bug |
| 2 |  |  |  |  |  | [Bare](https://github.com/o/n/pull/8) | [carol](https://github.com/carol) | Member |  |  |  |  |  |  |  |  |
`
  );
});

test('render: uses the supplied timestamp and leaves the report untouched', () => {
  const data = reportData();
  data.generatedAt = '2026-09-23T12:34:56.000Z';
  const before = structuredClone(data);
  const markdown = new PrReport(CONFIG).render(data);
  assert.match(markdown, /Generated 2026-09-23 @12:34:56/);
  assert.deepEqual(data, before);
});

test('render: an empty queue still has a header and no PR rows', () => {
  const data = { ...reportData(), prs: [], contributions: [] };
  const markdown = new PrReport(CONFIG).render(data);
  assert.match(markdown, /0 open PRs/);
  assert.equal(markdown.split('\n').filter((line) => line.startsWith('|')).length, 2);
});

test('render: size labels escape Markdown punctuation', () => {
  const data = reportData();
  data.prs[0].sizeFromLabels = 'size/[S|M]\\L';

  assert.ok(new PrReport(CONFIG).render(data).includes('| size/\\[S\\|M\\]\\\\L |'));
  assert.equal(data.prs[0].sizeFromLabels, 'size/[S|M]\\L');
});

test('render: missing authors use the placeholder', () => {
  const data = reportData();
  data.prs[0].author = '';
  assert.match(new PrReport(CONFIG).render(data), /\| \(none\) \| First-time contributor/);
});

test('render: HTML in titles and labels stays literal while report links and line breaks remain intact', () => {
  const data = reportData();
  data.prs[0].title = 'Fix <Select> rendering &amp; sizing';
  data.prs[0].labels = ['area/<forms> & inputs'];

  const markdown = new PrReport(CONFIG).render(data);

  assert.ok(markdown.includes('[Fix &lt;Select&gt; rendering &amp;amp; sizing](https://github.com/o/n/pull/7)'));
  assert.ok(markdown.includes('area/&lt;forms&gt; &amp; inputs'));
  assert.ok(markdown.includes('[#1](https://github.com/o/n/issues/1) (type/bug)<br>2. [#2]'));
});

test('esc: HTML tags and existing character references remain literal text', () => {
  assert.equal(esc('<Select> & </Select>'), '&lt;Select&gt; &amp; &lt;/Select&gt;');
  assert.equal(esc('&lt;Select&gt; &#60;'), '&amp;lt;Select&amp;gt; &amp;#60;');
});

test('esc: the characters that would break a table cell or a link are escaped', () => {
  assert.equal(esc('a | b'), 'a \\| b');
  assert.equal(esc('[x]'), '\\[x\\]');
  assert.equal(esc('a \\ b'), 'a \\\\ b');
});

// Escape existing backslashes before adding escapes for Markdown punctuation.
test('esc: a literal backslash-pipe keeps both characters escaped', () => {
  assert.equal(esc('a \\| b'), 'a \\\\\\| b');
});

test('esc: text that needs no escaping is unchanged', () => {
  assert.equal(esc('plain title (with parens)'), 'plain title (with parens)');
});

test('esc: non-strings are coerced', () => {
  assert.equal(esc(7), '7');
});

test('fixesCell: a PR that fixes nothing is blank', () => {
  assert.equal(fixesCell(undefined), '');
  assert.equal(fixesCell({ total: 0 }), '');
});

test('fixesCell: one numbered link per issue, separated so a cell breaks the line', () => {
  const fixes = {
    total: 2,
    issues: [
      { number: 1, url: 'https://github.com/o/n/issues/1' },
      { number: 2, url: 'https://github.com/o/n/issues/2' },
    ],
  };
  assert.equal(
    fixesCell(fixes),
    '1. [#1](https://github.com/o/n/issues/1)<br>2. [#2](https://github.com/o/n/issues/2)'
  );
});

test('fixesCell: a partial list shows how many issues are displayed', () => {
  assert.equal(fixesCell({ total: 3, issues: [{ number: 7, url: 'u' }] }), '1. [#7](u)<br>displaying 1 of 3');
});

test('fixesCell: issue types follow the link, escaped and comma-joined', () => {
  const fixes = { total: 1, issues: [{ number: 1, url: 'u', type: ['type/bug', 'a|b'] }] };
  assert.equal(fixesCell(fixes), '1. [#1](u) (type/bug, a\\|b)');
});

// The total comes from GitHub's `totalCount`, so it can outrun the issues the query returned.
test('fixesCell: no fetched issues shows displaying zero of the total', () => {
  assert.equal(fixesCell({ total: 3, issues: [] }), 'displaying 0 of 3');
  assert.equal(fixesCell({ total: 3 }), 'displaying 0 of 3');
});

test('issueCommentsCell: one numbered link per issue, separated so a cell breaks the line', () => {
  const fixes = {
    total: 2,
    issues: [
      { number: 1, url: 'https://github.com/o/n/issues/1', comments: 3 },
      { number: 2, url: 'https://github.com/o/n/issues/2', comments: 0 },
    ],
  };
  assert.equal(
    issueCommentsCell(fixes),
    '1. [#1](https://github.com/o/n/issues/1): 3<br>2. [#2](https://github.com/o/n/issues/2): 0'
  );
});

// Keep issue numbers, links, and separators consistent across both columns.
test('issueCommentsCell: the numbered items line up with the ones fixesCell builds', () => {
  const fixes = {
    total: 2,
    issues: [
      { number: 1, url: 'u1', comments: 2 },
      { number: 2, url: 'u2', comments: 0 },
    ],
  };

  const opening = (cell) => cell.split('<br>').map((item) => item.slice(0, item.indexOf(')') + 1));
  assert.deepEqual(opening(issueCommentsCell(fixes)), ['1. [#1](u1)', '2. [#2](u2)']);
  assert.deepEqual(opening(fixesCell(fixes)), ['1. [#1](u1)', '2. [#2](u2)']);
});

// Numbered by its place in the issue list, so the item keeps the number the other cell gives it.
test('issueCommentsCell: an issue whose count is unknown is left out, number and all', () => {
  const fixes = {
    total: 2,
    issues: [
      { number: 1, url: 'u1' },
      { number: 2, url: 'u2', comments: 2 },
    ],
  };
  assert.equal(issueCommentsCell(fixes), '2. [#2](u2): 2');
});

test('issueCommentsCell: a PR that fixes nothing is blank', () => {
  assert.equal(issueCommentsCell({ total: 1, issues: [] }), '');
  assert.equal(issueCommentsCell(undefined), '');
});
