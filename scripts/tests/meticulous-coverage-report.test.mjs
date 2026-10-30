import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { toIstanbul, writeTeamReport } from '../meticulous-coverage-report.mjs';

const file = {
  path: 'public/example.ts',
  executedLines: 1,
  executableLines: 2,
  executedRanges: [[1, 1]],
  executableRanges: [[1, 2]],
};
const originalSource = 'const covered = 1;\nconst uncovered = 2;\n';

test('represents only executable lines with binary hit counts', () => {
  assert.deepEqual(toIstanbul(file, originalSource), {
    path: 'public/example.ts',
    statementMap: {
      1: { start: { line: 1, column: 0 }, end: { line: 1, column: 18 } },
      2: { start: { line: 2, column: 0 }, end: { line: 2, column: 20 } },
    },
    s: { 1: 1, 2: 0 },
    fnMap: {},
    f: {},
    branchMap: {},
    b: {},
  });
});

test('rejects mismatched source and line counts', () => {
  assert.throws(() => toIstanbul({ ...file, executableRanges: [[1, 100]] }, originalSource), /do not match/);
  assert.throws(() => toIstanbul({ ...file, executedLines: 2 }, originalSource), /disagree/);
});

test('generates real Monocart HTML using committed source, not working-tree edits', async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), 'meticulous-report-'));
  const git = (...args) => execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    await mkdir(path.join(repoRoot, 'public'));
    await writeFile(path.join(repoRoot, file.path), originalSource);
    git('add', '.');
    git(
      '-c',
      'user.name=Coverage Test',
      '-c',
      'user.email=coverage@example.com',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'Fixture'
    );
    const commitSha = git('rev-parse', 'HEAD');
    await writeFile(path.join(repoRoot, file.path), 'WRONG_WORKING_TREE_SOURCE');
    const outputDir = path.join(repoRoot, 'report');
    await mkdir(path.join(outputDir, 'html'), { recursive: true });
    await writeFile(path.join(outputDir, 'html/stale-test.ts.html'), 'Old excluded test report');
    const reportURL = await writeTeamReport(
      { source: { testRunId: 'run-1', commitSha }, files: [file] },
      '@grafana/test',
      { repoRoot, outputDir }
    );
    assert.ok(reportURL.endsWith('/html/index.html'));
    const index = await readFile(path.join(outputDir, 'html/index.html'), 'utf8');
    assert.match(index, /window.metricsToShow = \["lines"\]/);
    assert.match(index, /Line coverage only/);
    assert.match(index, new RegExp(commitSha));
    const htmlFiles = await readdir(path.join(outputDir, 'html'), { recursive: true });
    assert.equal(htmlFiles.includes('stale-test.ts.html'), false);
    const sourcePage = htmlFiles.find((name) => name.endsWith('example.ts.html'));
    assert.ok(sourcePage);
    const html = await readFile(path.join(outputDir, 'html', sourcePage), 'utf8');
    assert.match(html, /covered/);
    assert.match(html, /uncovered/);
    assert.match(html, /50%/);
    assert.match(html, /class="cstat-no"/);
    assert.doesNotMatch(html, /WRONG_WORKING_TREE_SOURCE/);
    assert.doesNotMatch(html, /<span class="quiet">(?:Statements|Branches|Functions)<\/span>/);
    await assert.rejects(
      writeTeamReport({ source: { commitSha: '0'.repeat(40) }, files: [file] }, '@grafana/test', {
        repoRoot,
        outputDir,
      }),
      /Fetch the coverage run's commit/
    );
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test('does not create a report for a team with no coverage', async () => {
  assert.equal(await writeTeamReport({ source: {}, files: [] }, '@grafana/test', { repoRoot: '/unused' }), null);
});
