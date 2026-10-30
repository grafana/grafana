jest.mock('node:child_process', () => ({ execFile: jest.fn() }));
jest.mock('node:fs/promises', () => ({ readFile: jest.fn() }));

const { execFile } = require('node:child_process');
const { readFile } = require('node:fs/promises');
const path = require('node:path');

jest.unstable_mockModule('node:child_process', () => ({ execFile }));
jest.unstable_mockModule('node:fs/promises', () => ({ readFile }));
const writeTeamReport = jest.fn();
jest.unstable_mockModule('../meticulous-coverage-report.mjs', () => ({ writeTeamReport }));

let runCli, parseCoveragePage, fetchCoverage, renderReport, runReport;
beforeAll(async () => {
  ({ runCli, parseCoveragePage, fetchCoverage, renderReport, runReport } = await import(
    '../meticulous-coverage-by-codeowner.mjs'
  ));
});

const HEADER = 'repoFilePath\texecutedLines\texecutableLines\tuncoveredLines\n';
const source = { testRunId: 'run-1', commitSha: 'abc123', filesFailedToParse: 0 };
const manifest = {
  './public/a.ts': ['@grafana/a', '@grafana/b'],
  'public/b.ts': ['@grafana/a'],
  'public/empty.ts': ['@grafana/empty'],
  'public/unknown.ts': ['@grafana/no-data'],
  'public/personal.ts': ['@someone'],
};
const coverage = {
  source,
  files: [
    { path: 'public/a.ts', executedLines: 10, executableLines: 10 },
    { path: 'public/b.ts', executedLines: 0, executableLines: 90 },
    { path: 'public/empty.ts', executedLines: 0, executableLines: 0 },
    { path: 'public/personal.ts', executedLines: 2, executableLines: 4 },
    { path: 'public/missing.ts', executedLines: 3, executableLines: 6 },
  ],
};

function mockProcess(stdout, error = null) {
  jest.mocked(execFile).mockImplementationOnce((_command, _args, _options, callback) => {
    callback(error, { stdout, stderr: '' });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('parses reordered columns, CRLF, and repository-relative Windows paths', () => {
  expect(parseCoveragePage('executableLines\trepoFilePath\texecutedLines\r\n20\t.\\public\\a.ts\t5\r\n')).toEqual([
    { path: 'public/a.ts', executedLines: 5, executableLines: 20 },
  ]);
});

it.each([
  '',
  'unexpected output',
  `${HEADER}a.ts\t\t1\t1`,
  `${HEADER}a.ts\tNaN\t1\t1`,
  `${HEADER}a.ts\t2\t1\t0`,
  `${HEADER}a.ts\t-1\t1\t2`,
  `${HEADER}a.ts\t1.5\t2\t0.5`,
  `${HEADER}../a.ts\t1\t1\t0`,
  `${HEADER}/outside/a.ts\t1\t1\t0`,
])('rejects malformed coverage instead of printing misleading totals: %j', (output) => {
  expect(() => parseCoveragePage(output)).toThrow();
});

it('pins latest coverage to one run and fetches all pages, including uncovered files', async () => {
  const firstPage = HEADER + Array.from({ length: 1000 }, (_, i) => `file-${i}.ts\t1\t2\t1`).join('\n');
  const cli = jest
    .fn()
    .mockResolvedValueOnce(JSON.stringify(source))
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce(`${HEADER}last.ts\t0\t10\t10`);
  const result = await fetchCoverage(undefined, cli);
  expect(result.files).toHaveLength(1001);
  expect(result.files[1000]).toEqual({ path: 'last.ts', executedLines: 0, executableLines: 10 });
  expect(cli.mock.calls.map(([args]) => args)).toEqual([
    ['agent', 'js-coverage', '--project=grafana/grafana', '--latestForProject', '--summary', '--json'],
    [
      'agent',
      'js-coverage',
      '--project=grafana/grafana',
      '--testRunId=run-1',
      '--includeAllFiles',
      '--includeLineCounts',
      '--orderBy=repoFilePath',
      '--order=asc',
      '--limit=1000',
      '--offset=0',
    ],
    [
      'agent',
      'js-coverage',
      '--project=grafana/grafana',
      '--testRunId=run-1',
      '--includeAllFiles',
      '--includeLineCounts',
      '--orderBy=repoFilePath',
      '--order=asc',
      '--limit=1000',
      '--offset=1000',
    ],
  ]);
});

it('uses explicit run selection and accepts a header-only empty page', async () => {
  const cli = jest.fn().mockResolvedValueOnce(JSON.stringify(source)).mockResolvedValueOnce(HEADER);
  expect(await fetchCoverage('run-1', cli)).toEqual({ source, files: [] });
  expect(cli.mock.calls[0][0]).toEqual([
    'agent',
    'js-coverage',
    '--project=grafana/grafana',
    '--testRunId=run-1',
    '--summary',
    '--json',
  ]);
});

it.each([
  ['null', 'No successful test run'],
  ['{"status":"processing"}', 'still processing'],
  ['{}', 'Invalid Meticulous coverage run ID'],
  ['not json', 'Invalid Meticulous coverage summary'],
])('rejects unusable run summaries: %s', async (summary, error) => {
  await expect(fetchCoverage(undefined, jest.fn().mockResolvedValue(summary))).rejects.toThrow(error);
});

it('rejects repeated pages rather than double-counting or looping forever', async () => {
  const page = HEADER + Array.from({ length: 1000 }, (_, i) => `file-${i}.ts\t1\t1\t0`).join('\n');
  const cli = jest.fn().mockResolvedValueOnce(JSON.stringify(source)).mockResolvedValue(page);
  await expect(fetchCoverage(undefined, cli)).rejects.toThrow('Inconsistent Meticulous pagination');
});

it('propagates a failed later page instead of returning partial coverage', async () => {
  const page = HEADER + Array.from({ length: 1000 }, (_, i) => `file-${i}.ts\t1\t1\t0`).join('\n');
  const cli = jest
    .fn()
    .mockResolvedValueOnce(JSON.stringify(source))
    .mockResolvedValueOnce(page)
    .mockRejectedValueOnce(new Error('network failed'));
  await expect(fetchCoverage(undefined, cli)).rejects.toThrow('network failed');
});

it('reports weighted team totals, shared ownership, unknown data, and unique overall counts', () => {
  const report = renderReport(coverage, manifest);
  const rows = report
    .split('\n')
    .filter((line) => line.startsWith('@grafana') || line.startsWith('Overall') || line.startsWith('No Grafana'));
  expect(rows.map((row) => row.split(/ {2,}/))).toEqual([
    ['@grafana/a', '2', '10', '100', '10.00%'],
    ['@grafana/b', '1', '10', '10', '100.00%'],
    ['@grafana/empty', '1', '0', '0', 'N/A'],
    ['@grafana/no-data', '0', '0', '0', 'No coverage data'],
    ['No Grafana team / unmatched', '2', '5', '10', '50.00%'],
    ['Overall (unique files)', '5', '15', '110', '13.64%'],
  ]);
  expect(report).toContain('run run-1, commit abc123');
  expect(report).toContain('Ownership: current checkout');
});

it('prints a compact team summary without the per-file table', () => {
  const report = renderReport(coverage, manifest, '@grafana/a');
  expect(
    report
      .split('\n')
      .find((line) => line.startsWith('@grafana/a'))
      .split(/ {2,}/)
  ).toEqual(['@grafana/a', '2', '10', '100', '10.00%']);
  expect(report).not.toContain('public/a.ts');
});

it('rejects unknown teams', () => {
  expect(() => renderReport(coverage, manifest, '@grafana/typo')).toThrow('Codeowner "@grafana/typo" was not found');
});

it('warns when Meticulous could not parse source files', () => {
  expect(renderReport({ ...coverage, source: { ...source, filesFailedToParse: 2 } }, manifest)).toContain(
    'Warning: Meticulous could not parse 2 files; coverage may be incomplete.'
  );
});

it('keeps the token in the environment and redacts CLI failures', async () => {
  const env = { METICULOUS_API_TOKEN: 'secret-token' };
  mockProcess('3.4.0');
  expect(await runCli(['--version'], env)).toBe('3.4.0');
  expect(execFile).toHaveBeenCalledWith(
    'meticulous',
    ['--version'],
    {
      cwd: path.resolve(__dirname, '../..'),
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout: 12 * 60 * 1000,
    },
    expect.any(Function)
  );
  mockProcess('', Object.assign(new Error('secret-token'), { stderr: 'Unauthorized: secret-token' }));
  await expect(runCli(['agent', 'js-coverage'], env)).rejects.toThrow('Unauthorized: [REDACTED]');
});

it('provides installation instructions when CLI is absent', async () => {
  mockProcess('', Object.assign(new Error('not found'), { code: 'ENOENT' }));
  await expect(runCli(['--version'])).rejects.toThrow('npm install --global @alwaysmeticulous/cli@latest');
});

it('fails before manifest generation when token is missing', async () => {
  jest.replaceProperty(process, 'env', {});
  mockProcess('3.4.0');
  await expect(runReport()).rejects.toThrow('https://app.meticulous.ai/settings/grafana/projects/grafana/api-tokens');
  expect(execFile).toHaveBeenCalledTimes(1);
});

it('rejects invalid team before requesting remote coverage', async () => {
  jest.replaceProperty(process, 'env', { METICULOUS_API_TOKEN: 'secret-token' });
  mockProcess('3.4.0');
  mockProcess('manifest generated');
  jest.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
  await expect(runReport('@grafana/typo')).rejects.toThrow('Codeowner "@grafana/typo" was not found');
  expect(execFile).toHaveBeenCalledTimes(2);
});

it('imports without invoking the CLI', () => {
  const { spawnSync } = jest.requireActual('node:child_process');
  const { pathToFileURL } = require('node:url');
  const scriptURL = pathToFileURL(path.resolve(__dirname, '../meticulous-coverage-by-codeowner.mjs')).href;
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', `await import(${JSON.stringify(scriptURL)})`],
    {
      encoding: 'utf8',
      env: { PATH: '', METICULOUS_API_TOKEN: '' },
    }
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
  expect(result.stderr).toBe('');
});

it('prints help without CLI or authentication', () => {
  const { execFileSync } = jest.requireActual('node:child_process');
  const output = execFileSync(
    process.execPath,
    [path.resolve(__dirname, '../meticulous-coverage-by-codeowner.mjs'), '--help'],
    {
      encoding: 'utf8',
      env: { PATH: '', METICULOUS_API_TOKEN: '' },
    }
  );
  expect(output).toContain('pnpm test:coverage:meticulous:by-codeowner [team]');
  expect(output).toContain('--test-run-id');
});

it.each([true, false])('generates a team report with browser opening set to %s', async (shouldOpen) => {
  jest.replaceProperty(process, 'env', { METICULOUS_API_TOKEN: 'secret-token' });
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockProcess('3.4.0');
  mockProcess('manifest generated');
  mockProcess(JSON.stringify(source));
  mockProcess(`${HEADER.trimEnd()}\texecutedRanges\texecutableRanges\npublic/a.ts\t10\t10\t0\t1-10\t1-10`);
  writeTeamReport.mockResolvedValue('file:///tmp/team/html/index.html');
  jest.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
  await runReport('@grafana/a', undefined, shouldOpen);
  expect(writeTeamReport).toHaveBeenCalledWith(
    { source, files: [{ ...coverage.files[0], executedRanges: [[1, 10]], executableRanges: [[1, 10]] }] },
    '@grafana/a',
    { repoRoot: path.resolve(__dirname, '../..'), shouldOpen }
  );
  expect(log).toHaveBeenCalledWith('Coverage report saved to file:///tmp/team/html/index.html');
  expect(
    log.mock.calls[0][0]
      .split('\n')
      .find((line) => line.startsWith('@grafana/a'))
      .split(/ {2,}/)
  ).toEqual(['@grafana/a', '1', '10', '10', '100.00%']);
  expect(execFile.mock.calls[1].slice(0, 3)).toEqual([
    process.execPath,
    [path.resolve(__dirname, '../codeowners-manifest/index.js')],
    { cwd: path.resolve(__dirname, '../..') },
  ]);
});

it('prints no report when coverage retrieval fails', async () => {
  jest.replaceProperty(process, 'env', { METICULOUS_API_TOKEN: 'secret-token' });
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  mockProcess('3.4.0');
  mockProcess('manifest generated');
  mockProcess(JSON.stringify(source));
  mockProcess('', new Error('network failed'));
  jest.mocked(readFile).mockResolvedValue(JSON.stringify(manifest));
  await expect(runReport()).rejects.toThrow('network failed');
  expect(log).not.toHaveBeenCalled();
});

it('parses inclusive line ranges and empty ranges for uncovered files', () => {
  expect(
    parseCoveragePage(`${HEADER.trimEnd()}\texecutedRanges\texecutableRanges\npublic/a.ts\t0\t3\t3\t\t1;3-4\n`, true)
  ).toEqual([
    {
      path: 'public/a.ts',
      executedLines: 0,
      executableLines: 3,
      executedRanges: [],
      executableRanges: [
        [1, 1],
        [3, 4],
      ],
    },
  ]);
});

it.each(['0', '3-1', '1,no', '1-2-3'])('rejects invalid source ranges: %s', (range) => {
  expect(() =>
    parseCoveragePage(`${HEADER.trimEnd()}\texecutedRanges\texecutableRanges\na.ts\t1\t1\t0\t${range}\t1`, true)
  ).toThrow('Invalid Meticulous line range');
});

it('excludes Jest-ineligible files before team and overall reporting', async () => {
  const cli = jest
    .fn()
    .mockResolvedValueOnce(JSON.stringify(source))
    .mockResolvedValueOnce(
      `${HEADER}public/a.ts\t1\t2\t1\npublic/a.test.ts\t100\t100\t0\ne2e-playwright/helper.ts\t50\t100\t50\nscripts/tool.js\t50\t100\t50\npublic/types.ts\t5\t10\t5`
    );
  const result = await fetchCoverage(undefined, cli);
  expect(result.files).toEqual([{ path: 'public/a.ts', executedLines: 1, executableLines: 2 }]);
  const report = renderReport(result, manifest);
  expect(
    report
      .split('\n')
      .find((line) => line.startsWith('Overall'))
      .split(/ {2,}/)
  ).toEqual(['Overall (unique files)', '1', '1', '2', '50.00%']);
});

it('continues pagination when a whole page contains excluded files', async () => {
  const firstPage =
    HEADER + Array.from({ length: 1000 }, (_, i) => `e2e-playwright/helper-${i}.ts\t1\t2\t1`).join('\n');
  const cli = jest
    .fn()
    .mockResolvedValueOnce(JSON.stringify(source))
    .mockResolvedValueOnce(firstPage)
    .mockResolvedValueOnce(`${HEADER}public/a.ts\t1\t2\t1`);
  expect((await fetchCoverage(undefined, cli)).files).toEqual([
    { path: 'public/a.ts', executedLines: 1, executableLines: 2 },
  ]);
  expect(cli.mock.calls[2][0]).toContain('--offset=1000');
});
