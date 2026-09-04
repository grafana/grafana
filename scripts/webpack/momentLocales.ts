// Imports the language constants rather than LANGUAGES from `../languages.ts`, because that
// module uses extensionless relative imports which node cannot resolve when it loads the
// webpack config. Every constant here feeds LANGUAGES, and momentLocales.test.ts asserts that
// the allowlist covers every entry of LANGUAGES so the two cannot drift apart.
import * as languageConstants from '../../packages/grafana-i18n/src/constants.ts';

/** Not a language; the pseudo locale is only used for translation QA. */
const NOT_A_LANGUAGE = new Set(['PSEUDO_LOCALE']);

function getSupportedLanguageCodes(): string[] {
  return Object.entries(languageConstants)
    .filter(([name, code]) => !NOT_A_LANGUAGE.has(name) && typeof code === 'string')
    .map(([, code]) => code);
}

/**
 * moment resolves a locale by lowercasing the requested tag and then trying progressively
 * shorter prefixes: `moment.locale('pt-BR')` looks for `pt-br`, then `pt`. So the set of
 * locale files moment can ever ask for is every prefix of every language Grafana supports.
 *
 * Prefixes moment does not ship (`zh-hans`, `zh`, `fr-fr`, ...) are simply absent from the
 * require context and cost nothing.
 */
export function getMomentLocaleCandidates(): string[] {
  const candidates = new Set<string>();

  for (const code of getSupportedLanguageCodes()) {
    const parts = code.toLowerCase().split('-');
    for (let i = parts.length; i > 0; i--) {
      candidates.add(parts.slice(0, i).join('-'));
    }
  }

  // moment has `en` built in and never loads it from ./locale.
  candidates.delete('en');

  return [...candidates].sort();
}

/**
 * Matches the requests moment makes into its `./locale` context, restricted to the languages
 * Grafana ships. Bundling all ~137 locales instead costs ~300 KiB in the initial chunks.
 */
export function getMomentLocaleRegExp(): RegExp {
  const alternation = getMomentLocaleCandidates()
    .map((locale) => locale.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|');

  return new RegExp(`^\\./(${alternation})$`);
}
