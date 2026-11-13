import { describe, expect, it } from 'vitest';

import { run, stderrOf } from './shell.mjs';

describe('run', () => {
  it('throws when the command fails, and the error text can be read with stderrOf', () => {
    let caught: unknown;
    try {
      run('node', ['-e', 'console.error("boom"); process.exit(3)']);
    } catch (error) {
      caught = error;
    }

    expect(stderrOf(caught)).toContain('boom');
  });
});
