const {
  DROP_TOLERANCE_PCT,
  formatDelta,
  buildCoverageResult,
  getOverallStatus,
  getStatusIcon,
  hasToleratedDrop,
  getFilesWithDecreasedCoverage,
  getFilesWithIncreasedCoverage,
  renderTeamMarkdown,
} = require('../compare-coverage-by-codeowner.js');

type Metrics = { lines: number; statements: number; functions: number; branches: number };

function summary(pcts: Partial<Metrics> = {}) {
  const { lines = 80, statements = 80, functions = 80, branches = 80 } = pcts;
  return {
    lines: { pct: lines },
    statements: { pct: statements },
    functions: { pct: functions },
    branches: { pct: branches },
  };
}

function coverage(pcts: Partial<Metrics> = {}, files: Record<string, unknown> = {}) {
  return { team: '@grafana/dataviz-squad', summary: summary(pcts), files };
}

function fileMetrics(pcts: Partial<Metrics> = {}) {
  const { lines = 80, statements = 80, functions = 80, branches = 80 } = pcts;
  return {
    lines: { pct: lines },
    statements: { pct: statements },
    functions: { pct: functions },
    branches: { pct: branches },
  };
}

describe('compare-coverage-by-codeowner', () => {
  it('tolerates drops of up to 0.02 percentage points', () => {
    expect(DROP_TOLERANCE_PCT).toBe(0.02);
  });

  describe('getStatusIcon', () => {
    it('passes when coverage improves or is unchanged', () => {
      expect(getStatusIcon(80, 80)).toBe('✅ Pass');
      expect(getStatusIcon(80, 80.01)).toBe('✅ Pass');
    });

    it('marks drops within tolerance', () => {
      expect(getStatusIcon(64.58, 64.57)).toBe('🟡 Within tolerance');
      expect(getStatusIcon(64.58, 64.56)).toBe('🟡 Within tolerance');
    });

    it('fails drops larger than the tolerance', () => {
      expect(getStatusIcon(64.58, 64.55)).toBe('❌ Fail');
      expect(getStatusIcon(80, 79)).toBe('❌ Fail');
    });
  });

  describe('formatDelta', () => {
    it('rounds each side before diffing so it agrees with classifyChange at the boundary', () => {
      // Raw delta here is -0.014, which would round to -0.01 and look like a
      // regression past tolerance if not rounded first — but each side rounds
      // to a 0.02 drop, i.e. tolerated.
      expect(formatDelta(79.951, 79.965)).toBe('-0.02%');
    });

    it('renders an explicit zero delta rather than a bare dash', () => {
      expect(formatDelta(80, 80)).toBe('±0.00%');
    });
  });

  describe('getOverallStatus', () => {
    it('passes when every metric is within tolerance', () => {
      const main = summary({ branches: 64.58 });
      const pr = summary({ branches: 64.56 });
      expect(getOverallStatus(main, pr)).toBe(true);
      expect(hasToleratedDrop(main, pr)).toBe(true);
    });

    it('fails when any metric drops beyond the tolerance', () => {
      expect(getOverallStatus(summary({ branches: 64.58 }), summary({ branches: 64.5 }))).toBe(false);
    });

    it('reports no tolerated drop when all metrics hold', () => {
      expect(hasToleratedDrop(summary(), summary())).toBe(false);
    });
  });

  describe('getFilesWithDecreasedCoverage', () => {
    it('flags a file with any metric decreased', () => {
      const main = coverage({}, { 'a.ts': fileMetrics({ lines: 90 }) });
      const pr = coverage({}, { 'a.ts': fileMetrics({ lines: 85 }) });
      expect(getFilesWithDecreasedCoverage(main, pr)).toEqual([
        { path: 'a.ts', main: fileMetrics({ lines: 90 }), pr: fileMetrics({ lines: 85 }) },
      ]);
    });

    it('ignores new files with no main-branch baseline', () => {
      const main = coverage({}, {});
      const pr = coverage({}, { 'a.ts': fileMetrics({ lines: 50 }) });
      expect(getFilesWithDecreasedCoverage(main, pr)).toEqual([]);
    });
  });

  describe('getFilesWithIncreasedCoverage', () => {
    it('flags a file with every metric held or improved and at least one improved', () => {
      const main = coverage({}, { 'a.ts': fileMetrics({ lines: 80 }) });
      const pr = coverage({}, { 'a.ts': fileMetrics({ lines: 90 }) });
      const [result] = getFilesWithIncreasedCoverage(main, pr);
      expect(result.path).toBe('a.ts');
      expect(result.totalIncrease).toBe(10);
    });

    it('excludes a file that also regressed on another metric', () => {
      const main = coverage({}, { 'a.ts': fileMetrics({ lines: 80, branches: 80 }) });
      const pr = coverage({}, { 'a.ts': fileMetrics({ lines: 90, branches: 70 }) });
      expect(getFilesWithIncreasedCoverage(main, pr)).toEqual([]);
    });

    it('sorts by total increase descending', () => {
      const main = coverage(
        {},
        {
          'small.ts': fileMetrics({ lines: 80 }),
          'big.ts': fileMetrics({ lines: 80 }),
        }
      );
      const pr = coverage(
        {},
        {
          'small.ts': fileMetrics({ lines: 81 }),
          'big.ts': fileMetrics({ lines: 95 }),
        }
      );
      const paths = getFilesWithIncreasedCoverage(main, pr).map((r) => r.path);
      expect(paths).toEqual(['big.ts', 'small.ts']);
    });
  });

  describe('buildCoverageResult', () => {
    it('reports a tolerated drop as passing and includes the tolerance status', () => {
      const result = buildCoverageResult(coverage({ branches: 64.58 }), coverage({ branches: 64.57 }));

      expect(result.status).toBe('tolerated');
      expect(result.metrics).toContainEqual({
        metric: 'Branches',
        main: 64.58,
        pr: 64.57,
        delta: '-0.01%',
        status: '🟡 Within tolerance',
      });
    });

    it('reports a larger drop as failing', () => {
      const result = buildCoverageResult(coverage({ branches: 64.58 }), coverage({ branches: 64.4 }));

      expect(result.status).toBe('fail');
      expect(result.metrics).toContainEqual({
        metric: 'Branches',
        main: 64.58,
        pr: 64.4,
        delta: '-0.18%',
        status: '❌ Fail',
      });
    });

    it('reports unchanged coverage as passing', () => {
      const result = buildCoverageResult(coverage(), coverage());
      expect(result.status).toBe('pass');
    });

    it('includes decreased and increased file details', () => {
      const main = coverage(
        { branches: 64.58 },
        {
          'worse.ts': fileMetrics({ lines: 90 }),
          'better.ts': fileMetrics({ lines: 80 }),
        }
      );
      const pr = coverage(
        { branches: 64.4 },
        {
          'worse.ts': fileMetrics({ lines: 70 }),
          'better.ts': fileMetrics({ lines: 95 }),
        }
      );

      const result = buildCoverageResult(main, pr, { artifactUrl: 'https://example.test/report', prSha: 'abc123' });

      expect(result.decreasedFiles).toEqual([
        { path: 'worse.ts', cells: { lines: { main: 90, pr: 70 }, statements: null, functions: null, branches: null } },
      ]);
      expect(result.decreasedFilesTotal).toBe(1);
      expect(result.increasedFilesTop).toEqual([{ path: 'better.ts', totalIncrease: 15 }]);
      expect(result.increasedFilesTotal).toBe(1);
      expect(result.artifactUrl).toBe('https://example.test/report');
    });
  });

  describe('renderTeamMarkdown', () => {
    // The skip-label reminder and the run-locally command are identical for every
    // team, so they're written once by the coverage-summary job instead — this
    // block should never repeat them.
    it('never includes the skip-label reminder or a run-locally command, for any status', () => {
      const fail = renderTeamMarkdown(buildCoverageResult(coverage({ lines: 80 }), coverage({ lines: 70 })));
      const tolerated = renderTeamMarkdown(
        buildCoverageResult(coverage({ branches: 64.58 }), coverage({ branches: 64.57 }))
      );
      const pass = renderTeamMarkdown(buildCoverageResult(coverage(), coverage()));

      for (const markdown of [fail, tolerated, pass]) {
        expect(markdown).not.toContain('no-check-frontend-test-coverage');
        expect(markdown).not.toContain('Run locally');
      }
    });

    it('mentions the tolerance for a tolerated drop but not for a failure or a clean pass', () => {
      const tolerated = renderTeamMarkdown(
        buildCoverageResult(coverage({ branches: 64.58 }), coverage({ branches: 64.57 }))
      );
      const fail = renderTeamMarkdown(buildCoverageResult(coverage({ lines: 80 }), coverage({ lines: 70 })));
      const pass = renderTeamMarkdown(buildCoverageResult(coverage(), coverage()));

      expect(tolerated).toContain('tolerated');
      expect(fail).not.toContain('tolerated');
      expect(pass).not.toContain('tolerated');
    });

    it('renders a full block for a passing team, not just a compact row', () => {
      const result = buildCoverageResult(coverage(), coverage());
      const markdown = renderTeamMarkdown(result);

      expect(markdown).toContain('### ✅ @grafana/dataviz-squad');
      expect(markdown).toContain('| Metric | Main | PR | Change | Status |');
    });

    it('includes the HTML report link and the file-by-file breakdown when files decreased', () => {
      const main = coverage({}, { 'worse.ts': fileMetrics({ lines: 90 }) });
      const pr = coverage({}, { 'worse.ts': fileMetrics({ lines: 70 }) });
      const result = buildCoverageResult(main, pr, { artifactUrl: 'https://example.test/report' });
      const markdown = renderTeamMarkdown(result);

      expect(markdown).toContain('[Full HTML coverage report](https://example.test/report)');
      expect(markdown).toContain('<details><summary>Files with decreased coverage (1)</summary>');
      expect(markdown).toContain('worse.ts');
    });

    it('summarizes increases as a single compact line, separate from any decreases', () => {
      const main = coverage({}, { 'better.ts': fileMetrics({ lines: 80 }) });
      const pr = coverage({}, { 'better.ts': fileMetrics({ lines: 95 }) });
      const result = buildCoverageResult(main, pr);
      const markdown = renderTeamMarkdown(result);

      expect(markdown).toContain('📈 1 file(s) improved');
      expect(markdown).toContain('better.ts');
      expect(markdown).not.toContain('<details>');
    });
  });
});
