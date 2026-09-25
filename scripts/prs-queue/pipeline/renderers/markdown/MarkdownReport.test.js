const assert = require('node:assert/strict');
const test = require('node:test');

const { MarkdownReport } = require('./MarkdownReport');

const COLUMNS = [
  { header: '#', cell: (row, index) => index + 1 },
  { header: 'PR', cell: (row) => row.title },
  { header: 'Reviewers', cell: (row) => (row.reviewers ?? []).join(', ') },
];

function reportWith(columns = COLUMNS) {
  return new MarkdownReport({ title: 'Open PR contributors', tableColumns: columns });
}

test('renderTable: header and separator have one cell per column', () => {
  assert.equal(reportWith().renderTable([]), '| # | PR | Reviewers |\n| --- | --- | --- |');
});

test('renderTable: no rows means no body lines', () => {
  assert.equal(reportWith().renderTable([]).split('\n').length, 2);
});

test('renderTable: one line per row, in the order given', () => {
  const table = reportWith().renderTable([{ title: 'b' }, { title: 'a', reviewers: ['x', 'y'] }]);
  assert.deepEqual(table.split('\n').slice(2), ['| 1 | b |  |', '| 2 | a | x, y |']);
});

test('renderTable: cells receive the row and its zero-based index', () => {
  const seen = [];
  const columns = [
    {
      header: 'Seen',
      cell: (row, index) => {
        seen.push([row.title, index]);
        return row.title;
      },
    },
  ];
  reportWith(columns).renderTable([{ title: 'a' }, { title: 'b' }]);
  assert.deepEqual(seen, [
    ['a', 0],
    ['b', 1],
  ]);
});

test('renderTable: empty cells keep the column alignment', () => {
  const table = reportWith().renderTable([{ title: '' }]);
  assert.equal(table.split('\n')[2], '| 1 |  |  |');
});

test('renderTable: cells are emitted verbatim, markdown included', () => {
  const columns = [{ header: 'PR', cell: (row) => `[${row.title}](${row.url})` }];
  const table = reportWith(columns).renderTable([{ title: 'a \\| b', url: 'https://x/1' }]);
  assert.equal(table.split('\n')[2], '| [a \\| b](https://x/1) |');
});

test('render: title, sections and table are separated by blank lines', () => {
  const md = reportWith().render({ sections: ['Source: x', '- Member: 1'], rows: [{ title: 'a' }] });
  assert.equal(
    md,
    [
      '# Open PR contributors',
      '',
      'Source: x',
      '',
      '- Member: 1',
      '',
      '| # | PR | Reviewers |',
      '| --- | --- | --- |',
      '| 1 | a |  |',
      '',
    ].join('\n')
  );
});

test('render: empty and missing sections are dropped', () => {
  const md = reportWith().render({ sections: ['', null, 'kept'] });
  assert.equal(md, '# Open PR contributors\n\nkept\n\n| # | PR | Reviewers |\n| --- | --- | --- |\n');
});

test('render: sections and rows both default to empty', () => {
  assert.equal(reportWith().render({}), '# Open PR contributors\n\n| # | PR | Reviewers |\n| --- | --- | --- |\n');
});
