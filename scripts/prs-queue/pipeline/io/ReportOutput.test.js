const assert = require('node:assert/strict');
const test = require('node:test');

const { ReportOutput } = require('./ReportOutput');

const config = {
  repo: 'o/n',
  team: 'o/squad',
  teamOrg: 'o',
  teamSlug: 'squad',
  root: '/workspace',
  outputPath: '/workspace/output/reports/queue.md',
};
const report = {
  prs: [],
  contributions: [],
  generatedAt: '2026-09-17T10:00:00Z',
  run: {
    prs: [],
    added: 0,
    removed: 0,
    refetched: 0,
    reused: 0,
    scope: {
      members: new Set(),
      createdByTeamMembers: new Set(),
      reviewRequests: { fromTeam: new Set(), fromIndividualMember: new Set() },
    },
  },
};

test('JSON output uses the injected stream without touching files', () => {
  const lines = [];
  const output = new ReportOutput({ files: {}, stdout: { write: (text) => lines.push(text) } });
  output.writePr({ number: 7 });
  output.writeJson(config, [{ number: 8 }]);
  assert.deepEqual(JSON.parse(lines[0]), { number: 7 });
  assert.equal(JSON.parse(lines[1]).prs[0].number, 8);
});

test('Markdown output creates the folder and writes the file before reporting success', async () => {
  const calls = [];
  const output = new ReportOutput({
    files: {
      mkdir: async (...args) => calls.push(['mkdir', ...args]),
      writeFile: async (...args) => calls.push(['file', ...args]),
    },
    stdout: { write: (text) => calls.push(['stdout', text]) },
    diagnostics: { log: () => {} },
  });
  const prepared = { ...report, contributions: [{ type: 'Member', count: 3 }] };
  await output.writeMarkdown(config, prepared, '/workspace/output/cache/prs/queue.cache.json');
  assert.deepEqual(
    calls.map(([kind]) => kind),
    ['mkdir', 'file', 'stdout']
  );
  assert.deepEqual(calls[0], ['mkdir', '/workspace/output/reports', { recursive: true }]);
  assert.equal(calls[1][1], config.outputPath);
  assert.match(calls[1][2], /# Open PR contributors/);
  assert.match(calls[1][2], /- Member: 3/);
  const summary = JSON.parse(calls[2][1]);
  assert.deepEqual(summary.contributions, { Member: 3 });
  assert.equal(summary.output, 'output/reports/queue.md');
  assert.equal(summary.cache.path, 'output/cache/prs/queue.cache.json');
});

test('a file write failure does not emit a summary', async () => {
  const error = new Error('Disk full');
  const output = new ReportOutput({
    files: {
      mkdir: async () => {},
      writeFile: async () => {
        throw error;
      },
    },
    stdout: { write: () => assert.fail('unexpected summary') },
    diagnostics: { log: () => {} },
  });
  await assert.rejects(output.writeMarkdown(config, report, '/cache.json'), (caught) => caught === error);
});
