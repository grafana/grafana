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

  it('gives the command extra environment variables without changing the current process', () => {
    const output = run('node', ['-e', 'process.stdout.write(process.env.RELEASE_SHELL_TEST ?? "unset")'], {
      RELEASE_SHELL_TEST: 'given',
    });

    expect(output).toBe('given');
    expect(process.env.RELEASE_SHELL_TEST).toBeUndefined();
  });
});
