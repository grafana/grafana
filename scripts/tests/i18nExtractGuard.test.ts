import { spawnSync } from 'child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

// `scripts/cli/runI18nExtract.mjs` detects extraction errors by matching i18next-cli's output,
// because no config option makes them fatal. That makes it coupled to i18next-cli's output format,
// so these tests run the real extractor over a fixture rather than testing the matching in
// isolation. If an i18next-cli upgrade changes the format, this fails instead of the guard
// silently going quiet — which is the whole failure mode being guarded against.

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const GUARD = path.join(REPO_ROOT, 'scripts', 'cli', 'runI18nExtract.mjs');
const I18NEXT_CLI = path.join(REPO_ROOT, 'node_modules', '.bin', 'i18next-cli');

const CONFIG = `export default {
  locales: ['en-US'],
  extract: {
    input: ['src/**/*.{tsx,ts}'],
    output: 'locales/{{language}}/{{namespace}}.json',
    defaultNS: 'fixture',
  },
};
`;

const CONFLICTING_KEYS = `export const parent = () => t('fixture.conflict.parent', 'Parent');
export const child = () => t('fixture.conflict.parent.child', 'Child');
`;

const CLEAN_KEYS = `export const ok = () => t('fixture.clean.label', 'Label');
`;

const fixtureDirs: string[] = [];

/** Writes a throwaway extraction fixture and returns its directory. */
function createFixture(source: string) {
  // The fixture lives outside the repo so extraction can't write into tracked locale files.
  // It therefore can't resolve `i18next-cli` for a `defineConfig` import — hence a plain object,
  // which is all `defineConfig` returns anyway.
  const dir = mkdtempSync(path.join(tmpdir(), 'i18n-extract-guard-'));
  fixtureDirs.push(dir);
  mkdirSync(path.join(dir, 'src'));
  writeFileSync(path.join(dir, 'i18next.config.mjs'), CONFIG);
  writeFileSync(path.join(dir, 'src', 'Keys.tsx'), source);
  return dir;
}

function extract(cwd: string, { guarded }: { guarded: boolean }) {
  const args = guarded ? [GUARD, 'node', I18NEXT_CLI, 'extract'] : [I18NEXT_CLI, 'extract'];
  const result = spawnSync('node', args, { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterAll(() => {
  for (const dir of fixtureDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('runI18nExtract guard', () => {
  jest.setTimeout(60_000);

  it('fails when a nesting conflict drops a key, naming both keys', () => {
    const { status, output } = extract(createFixture(CONFLICTING_KEYS), { guarded: true });

    expect(status).not.toBe(0);
    expect(output).toContain('fixture.conflict.parent.child');
    expect(output).toContain('fixture.conflict.parent');
  });

  it('passes when extraction reports no errors', () => {
    const { status, output } = extract(createFixture(CLEAN_KEYS), { guarded: true });

    expect(status).toBe(0);
    expect(output).toContain('Extraction complete');
  });

  // Documents why the guard exists. If this starts failing, i18next-cli has made extraction
  // errors fatal on its own and the guard can be removed.
  it('is still needed, because i18next-cli exits 0 on a nesting conflict', () => {
    const { status, output } = extract(createFixture(CONFLICTING_KEYS), { guarded: false });

    expect(status).toBe(0);
    expect(output).toContain('Nesting conflict');
  });

  it('does not mask a non-zero exit from the wrapped command', () => {
    const result = spawnSync('node', [GUARD, 'node', '-e', 'process.exit(42)'], { encoding: 'utf8' });

    expect(result.status).toBe(42);
  });

  it('detects errors even when i18next-cli colours its output', () => {
    const emitColouredError = `const { styleText } = require('util');
      console.error(styleText('red', 'Error: Nesting conflict: key "a.b.c" conflicts with existing key "a.b".'));`;
    const result = spawnSync('node', [GUARD, 'node', '-e', emitColouredError], {
      encoding: 'utf8',
      env: { ...process.env, FORCE_COLOR: '1' },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('conflicts with existing key');
  });
});
