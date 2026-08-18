const { buildCoverageResult } = require('../compare-coverage-by-codeowner.js');
const { generateRunSummary } = require('../generate-coverage-run-summary.js');

function metrics(pcts: Partial<Record<'lines' | 'statements' | 'functions' | 'branches', number>> = {}) {
  const { lines = 80, statements = 80, functions = 80, branches = 80 } = pcts;
  return {
    lines: { pct: lines },
    statements: { pct: statements },
    functions: { pct: functions },
    branches: { pct: branches },
  };
}

function result(team: string, mainPcts = {}, prPcts = {}, files: Record<string, unknown> = {}, meta = {}) {
  return buildCoverageResult(
    { team, summary: metrics(mainPcts), files },
    { team, summary: metrics(prPcts), files },
    meta
  );
}

describe('generate-coverage-run-summary', () => {
  it('reports no affected teams when the results list is empty', () => {
    expect(generateRunSummary([])).toContain('No opted-in codeowners were affected');
  });

  it('groups a failing team under "Coverage regressions" with the skip-label reminder close by', () => {
    const failing = result('@grafana/dataviz-squad', { lines: 80 }, { lines: 70 });
    const summary = generateRunSummary([failing]);

    expect(summary).toContain('## Coverage regressions');
    expect(summary).toContain('### ❌ @grafana/dataviz-squad');

    const regressionIndex = summary.indexOf('### ❌ @grafana/dataviz-squad');
    const skipLabelIndex = summary.indexOf('no-check-frontend-test-coverage');
    const passingIndex = summary.indexOf('## ✅ Passing teams');

    expect(skipLabelIndex).toBeGreaterThan(regressionIndex);
    // The skip-label callout must land before the file-by-file details / next
    // section, i.e. right next to the failure, not buried at the bottom.
    expect(skipLabelIndex).toBeLessThan(passingIndex === -1 ? summary.length : passingIndex);
  });

  it('lists a tolerated team as a regression without the skip-label reminder', () => {
    const tolerated = result('@grafana/dataviz-squad', { branches: 64.58 }, { branches: 64.57 });
    const summary = generateRunSummary([tolerated]);

    expect(summary).toContain('### 🟡 @grafana/dataviz-squad');
    expect(summary).not.toContain('no-check-frontend-test-coverage');
  });

  it('lists passing teams in a compact table, separate from regressions', () => {
    const passing = result('@grafana/dataviz-squad');
    const summary = generateRunSummary([passing]);

    expect(summary).not.toContain('## Coverage regressions');
    expect(summary).toContain('## ✅ Passing teams');
    expect(summary).toContain('| @grafana/dataviz-squad | — | — | — | — |');
  });

  it('summarizes coverage increases compactly, after the regressions section', () => {
    const main = { team: '@grafana/dataviz-squad', summary: metrics(), files: { 'better.ts': metrics({ lines: 80 }) } };
    const pr = { team: '@grafana/dataviz-squad', summary: metrics(), files: { 'better.ts': metrics({ lines: 95 }) } };
    const withIncrease = buildCoverageResult(main, pr);

    const summary = generateRunSummary([withIncrease]);
    const regressionsIndex = summary.indexOf('## Coverage regressions');
    const increasesIndex = summary.indexOf('## 📈 Coverage increases');

    expect(increasesIndex).toBeGreaterThan(-1);
    expect(summary).toContain('better.ts');
    expect(regressionsIndex).toBe(-1); // nothing failed here, so no regressions section at all
  });

  it('lists not-affected teams compactly at the end', () => {
    const notAffected = { team: '@grafana/dataviz-squad', affected: false };
    const summary = generateRunSummary([notAffected]);

    expect(summary).toContain('No opted-in codeowners were affected');
  });

  it('sorts multiple not-affected teams by name without crashing', () => {
    // Regression test: sorting must happen on the result objects (which carry
    // .team) before mapping down to plain team-name strings — sorting after the
    // map crashes because the comparator expects an object with `.team`. A
    // single not-affected team can't catch this: Array.prototype.sort never
    // invokes the comparator for arrays of 0 or 1 elements.
    const notAffected = [
      { team: '@grafana/grafana-frontend-navigation', affected: false },
      { team: '@grafana/datapro', affected: false },
    ];
    const summary = generateRunSummary(notAffected);

    expect(summary).toContain('@grafana/datapro, @grafana/grafana-frontend-navigation');
  });

  it('sorts multiple not-affected teams alongside affected ones without crashing', () => {
    const passing = result('@grafana/dataviz-squad');
    const notAffected = [
      { team: '@grafana/grafana-frontend-navigation', affected: false },
      { team: '@grafana/datapro', affected: false },
    ];
    const summary = generateRunSummary([passing, ...notAffected]);

    expect(summary).toContain(
      "Not affected by this PR's changes: @grafana/datapro, @grafana/grafana-frontend-navigation"
    );
  });
});
