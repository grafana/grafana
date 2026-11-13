import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { writeOutputs } from './github-output.mjs';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('writeOutputs', () => {
  it('appends name=value lines to the file GITHUB_OUTPUT points at, keeping what is already there', () => {
    const file = join(mkdtempSync(join(tmpdir(), 'github-output-')), 'output');
    writeFileSync(file, 'earlier=1\n');

    writeOutputs({ packages: '[{"name":"a"}]', sha: 'abc' }, { GITHUB_OUTPUT: file });

    expect(readFileSync(file, 'utf8')).toBe('earlier=1\npackages=[{"name":"a"}]\nsha=abc\n');
  });

  it('prints the lines instead when GITHUB_OUTPUT is not set, so a script can be run by hand', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    writeOutputs({ sha: 'abc' }, {});

    expect(write).toHaveBeenCalledWith('sha=abc\n');
  });

  it('rejects a value that spans several lines, which the name=value format cannot hold', () => {
    expect(() => writeOutputs({ tagged: 'a\nb' }, {})).toThrow('Output tagged must be a single line.');
  });
});
