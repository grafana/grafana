const {
  DROP_TOLERANCE_PCT,
  generateMarkdown,
  getOverallStatus,
  getStatusIcon,
  hasToleratedDrop,
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

function coverage(pcts: Partial<Metrics> = {}) {
  return { team: '@grafana/dataviz-squad', summary: summary(pcts), files: {} };
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

  describe('generateMarkdown', () => {
    it('reports a tolerated drop as passing and explains the tolerance', () => {
      const markdown = generateMarkdown(coverage({ branches: 64.58 }), coverage({ branches: 64.57 }));

      expect(markdown).toContain('## Test Coverage Checks 🟡 Passed within tolerance');
      expect(markdown).toContain('| Branches | 64.58% | 64.57% | -0.01% | 🟡 Within tolerance |');
      expect(markdown).toContain('Drops of 0.02% or less are tolerated');
    });

    it('reports a larger drop as failing', () => {
      const markdown = generateMarkdown(coverage({ branches: 64.58 }), coverage({ branches: 64.4 }));

      expect(markdown).toContain('## Test Coverage Checks ❌ Failed');
      expect(markdown).toContain('| Branches | 64.58% | 64.40% | -0.18% | ❌ Fail |');
      expect(markdown).not.toContain('are tolerated');
    });

    it('reports unchanged coverage as passing', () => {
      const markdown = generateMarkdown(coverage(), coverage());

      expect(markdown).toContain('## Test Coverage Checks ✅ Passed');
      expect(markdown).not.toContain('Within tolerance');
    });
  });
});
