import { describe, expect, it } from 'vitest';

import { requireEnv } from './env.mjs';

describe('requireEnv', () => {
  it('returns the value of a variable that is set', () => {
    expect(requireEnv({ GITHUB_SHA: 'abc' }, 'GITHUB_SHA')).toBe('abc');
  });

  it.each([[undefined], ['']])('fails with a clear message when the variable is %j', (value) => {
    expect(() => requireEnv({ GITHUB_SHA: value }, 'GITHUB_SHA')).toThrow('GITHUB_SHA is not set.');
  });
});
