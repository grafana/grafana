import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isMainModule } from './main.mjs';

function createScripts() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'is-main-module-')));
  const folder = join(dir, 'scripts');
  mkdirSync(folder);
  const script = join(folder, 'script.mts');
  const other = join(folder, 'other.mts');
  writeFileSync(script, '');
  writeFileSync(other, '');
  return { dir, folder, script, other, url: pathToFileURL(script).href };
}

describe('isMainModule', () => {
  it('is true when the module is the file the process was started with', () => {
    const { script, url } = createScripts();

    expect(isMainModule(url, script)).toBe(true);
  });

  it('is true when the process was started through a symlink to the file', () => {
    const { dir, script, url } = createScripts();
    const link = join(dir, 'link.mts');
    symlinkSync(script, link);

    expect(isMainModule(url, link)).toBe(true);
  });

  it('is true when the process was started through a symlinked folder, which would otherwise make a script do nothing', () => {
    const { dir, folder, url } = createScripts();
    const linkedFolder = join(dir, 'linked-scripts');
    symlinkSync(folder, linkedFolder);

    expect(isMainModule(url, join(linkedFolder, 'script.mts'))).toBe(true);
  });

  it('is false when the process was started with another file, as when a test imports the module', () => {
    const { other, url } = createScripts();

    expect(isMainModule(url, other)).toBe(false);
  });

  it('is false when there is no entry point', () => {
    const { url } = createScripts();

    expect(isMainModule(url, '')).toBe(false);
  });
});
