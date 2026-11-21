import { describe, expect, it } from 'vitest';

import { tagFor } from './tags.mjs';

describe('tagFor', () => {
  it('joins the package name and version the way nx names tags of independent projects', () => {
    expect(tagFor('@grafana/plugin-compat', '0.11.0')).toBe('@grafana/plugin-compat@0.11.0');
  });
});
