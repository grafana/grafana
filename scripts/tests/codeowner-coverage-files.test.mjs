import assert from 'node:assert/strict';
import { test } from 'node:test';

import coverageFiles from '../codeowners-manifest/coverage-files.js';

const { isCoverageSourceFile } = coverageFiles;

test('includes application JS and TypeScript source', () => {
  for (const filename of [
    'public/app/panel.ts',
    'packages/grafana-ui/src/Panel.tsx',
    'public/app/panel.js',
    'public/app/Panel.jsx',
    './public/app/panel.ts',
    'public\\app\\panel.ts',
  ]) {
    assert.equal(isCoverageSourceFile(filename), true, filename);
  }
});

test('excludes test infrastructure, generated files, and other Jest coverage exclusions', () => {
  for (const filename of [
    'public/app/panel.test.ts',
    'public/app/panel.spec.tsx',
    'public/test/helper.ts',
    'packages/grafana-ui/src/__mocks__/panel.ts',
    'public/app/panel.story.tsx',
    'public/app/panel.gen.ts',
    'public/app/panel.d.ts',
    'public/app/types.ts',
    'public/app/graveyard/panel.ts',
    'scripts/helper.js',
    'jest.config.codeowner.js',
    'packages/grafana-ui/jest.config.js',
    'public/app/plugins/panel/text/module.tsx',
    'e2e-playwright/panels-suite/table.spec.ts',
    'e2e-playwright/fixtures.ts',
    'e2e-playwright/test-plugins/panel/src/Panel.tsx',
    './e2e-playwright/helper.ts',
    'e2e-playwright\\helper.ts',
    'public/app/panel.css',
  ]) {
    assert.equal(isCoverageSourceFile(filename), false, filename);
  }
});
