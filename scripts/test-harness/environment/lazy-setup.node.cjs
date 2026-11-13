const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const rootDir = path.resolve(__dirname, '../../..');

test('shared setup fails the owning test for console errors during React cleanup', { timeout: 90000 }, () => {
  const directory = mkdtempSync(path.join(__dirname, '.lazy-setup-'));
  try {
    for (const [name, entry, reset] of [
      ['main', '@testing-library/react', false],
      ['pure', '@testing-library/react/pure', false],
      ['main-reset', '@testing-library/react', true],
      ['pure-reset', '@testing-library/react/pure', true],
    ]) {
      writeFileSync(path.join(directory, `${name}.test.js`), `
        const { render } = require(${JSON.stringify(entry)});
        const { createElement, useEffect } = require('react');
        function Probe() {
          useEffect(() => () => console.error('setup-cleanup-sentinel'), []);
          return createElement('div', null, 'cleanup probe');
        }
        describe('cleanup', () => {
          ${reset ? 'afterEach(() => jest.resetModules());' : ''}
          test.each([1, 2])('cleanup console error belongs to test %s', () => {
            render(createElement(Probe));
          });
        });
      `);
    }
    const config = {
      ...require('../../../jest.happy-dom.config'),
      rootDir,
      roots: [directory],
      testPathIgnorePatterns: ['/node_modules/'],
      cacheDirectory: path.join(directory, 'cache'),
      watchPlugins: [],
    };
    delete config.workerIdleMemoryLimit;
    const output = path.join(directory, 'results.json');
    const result = spawnSync(process.execPath, [
      require.resolve('jest/bin/jest'), '--config', JSON.stringify(config), '--runInBand', '--no-watch',
      '--json', '--outputFile', output,
    ], {
      cwd: rootDir, encoding: 'utf8', timeout: 80000,
      env: { ...process.env, CI: 'true', FORCE_COLOR: '0' },
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 1, result.stdout + result.stderr);
    const results = JSON.parse(readFileSync(output, 'utf8'));
    assert.equal(results.numFailedTests, 8, result.stdout + result.stderr);
    for (const suite of results.testResults) {
      assert.equal(suite.assertionResults.length, 2);
      for (const assertion of suite.assertionResults) {
        assert.equal(assertion.status, 'failed');
        assert.match(assertion.failureMessages.join('\n'), /setup-cleanup-sentinel/);
        assert.match(assertion.failureMessages.join('\n'), /console\.error/);
      }
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
