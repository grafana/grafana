import { existsSync } from 'fs';
import moment from 'moment';
import path from 'path';

import { LANGUAGES } from '../../packages/grafana-i18n/src/languages.ts';
import { getMomentLocaleCandidates, getMomentLocaleRegExp } from '../webpack/momentLocales.ts';

const MOMENT_LOCALE_DIR = path.join(__dirname, '../../node_modules/moment/locale');

describe('moment locale allowlist', () => {
  const candidates = getMomentLocaleCandidates();
  const regexp = getMomentLocaleRegExp();

  it('covers every locale moment actually resolves for a supported language', () => {
    for (const { code } of LANGUAGES) {
      // Whatever locale moment settles on for this language must survive the allowlist,
      // otherwise the webpack context drops the file and dates silently fall back to English.
      const resolved = moment.locale(code);

      if (resolved === 'en') {
        // moment has no locale for this tag and falls back to its built-in English.
        continue;
      }

      expect(regexp.test(`./${resolved}`)).toBe(true);
    }
  });

  it('only keeps locales moment can be asked for', () => {
    // A candidate that does not exist on disk is harmless, but one that exists and is not
    // reachable from LANGUAGES is dead weight in the bundle.
    const reachable = new Set<string>();
    for (const { code } of LANGUAGES) {
      const parts = code.toLowerCase().split('-');
      for (let i = parts.length; i > 0; i--) {
        reachable.add(parts.slice(0, i).join('-'));
      }
    }

    for (const candidate of candidates) {
      expect(reachable.has(candidate)).toBe(true);
    }
  });

  it('is much smaller than bundling everything', () => {
    const onDisk = candidates.filter((locale) => existsSync(path.join(MOMENT_LOCALE_DIR, `${locale}.js`)));

    expect(onDisk.length).toBeGreaterThan(0);
    expect(onDisk.length).toBeLessThan(30);
  });
});
