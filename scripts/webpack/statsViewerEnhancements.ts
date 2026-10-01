const MARKER = '/* grafana-stats-viewer-enhancements-v1 */';
const SEARCH_MARKER = '/* grafana-stats-viewer-search-v1 */';
const MATCH_MARKER = '/* grafana-stats-viewer-nonempty-matches-v1 */';

export function enhanceStatsViewer(html: string): string {
  return enhanceSearchMatches(enhanceSearchHighlights(enhanceSelection(html)));
}

// The analyzer has no report customization hook. Check these getters explicitly so
// a viewer upgrade cannot silently disable the search behavior.
function enhanceSelection(html: string): string {
  if (html.includes(MARKER)) {
    return html;
  }

  const sizeGetter = /get foundModulesSize\(\)\{return this\.foundModules\.reduce\([^{}]*\)\}/g;
  const highlightGetter = /get highlightedModules\(\)\{return new Set\(([$\w]+)\.foundModules\)\}/g;
  const sizeMatches = [...html.matchAll(sizeGetter)];
  const highlightMatches = [...html.matchAll(highlightGetter)];

  if (sizeMatches.length !== 1 || highlightMatches.length !== 1) {
    throw new Error('Cannot enhance bundle stats: webpack-bundle-analyzer viewer getters changed.');
  }

  const store = highlightMatches[0][1];

  return html
    .replace(
      sizeGetter,
      () => `${MARKER}
get foundModulesSize() {
  const matched = new Set(this.foundModules);
  const size = node => matched.has(node)
    ? node[this.activeSize] || 0
    : (node.groups || []).reduce((sum, child) => sum + size(child), 0);
  return this.visibleChunks.reduce((sum, chunk) => sum + size(chunk), 0);
}`
    )
    .replace(
      highlightGetter,
      () => `get highlightedModules() {
  const matched = new Set(${store}.foundModules);
  const covered = node => matched.has(node)
    || !!(node.groups && node.groups.length && node.groups.every(covered));
  for (const chunk of ${store}.visibleChunks) {
    if (covered(chunk)) {
      matched.add(chunk);
    }
  }
  return matched;
}`
    );
}

function enhanceSearchMatches(html: string): string {
  if (html.includes(MATCH_MARKER)) {
    return html;
  }

  const getter = /get foundModulesByChunk\(\)\{[\s\S]*?(?=get foundModules\(\))/g;
  const matches = [...html.matchAll(getter)];
  const source = matches[0]?.[0];
  const declaration = /const ([$\w]+)=this\.searchQueryRegexp;/;
  const variable = source?.match(declaration)?.[1];
  if (matches.length !== 1 || !source || !variable) {
    throw new Error('Cannot enhance bundle stats: webpack-bundle-analyzer search getter changed.');
  }

  const calls = new RegExp(variable.replace(/\$/g, '\\$') + '\\.test\\(', 'g');
  if ([...source.matchAll(calls)].length !== 2) {
    throw new Error('Cannot enhance bundle stats: webpack-bundle-analyzer search match calls changed.');
  }

  // matchAll advances through zero-length matches by Unicode code point. A match
  // must consume text to contribute to selection, highlighting, or size totals.
  const replacement = source.replace(calls, 'hasSearchMatch(').replace(
    declaration,
    () => `${MATCH_MARKER}
const searchMatcher = new RegExp(this.searchQueryRegexp.source, "giu");
const hasSearchMatch = text => {
  for (const match of text.matchAll(searchMatcher)) {
    if (match[0].length > 0) {
      return true;
    }
  }
  return false;
};`
  );
  return html.replace(getter, () => replacement);
}

function enhanceSearchHighlights(html: string): string {
  if (html.includes(SEARCH_MARKER)) {
    return html;
  }

  const loop = /let ([$\w]+),([$\w]+);do\{\2=\1,\1=([$\w]+)\.exec\(([$\w]+)\)\}while\(\1\);/g;
  const matches = [...html.matchAll(loop)];
  if (matches.length !== 1) {
    throw new Error('Cannot enhance bundle stats: webpack-bundle-analyzer title highlight loop changed.');
  }

  const [, match, lastMatch, regexp, text] = matches[0];
  // exec() does not advance past empty matches. Unicode regexes require advancing
  // by a complete code point, otherwise exec() can return the same match again.
  return html.replace(
    loop,
    () => `${SEARCH_MARKER}
let ${match}, ${lastMatch};
while ((${match} = ${regexp}.exec(${text}))) {
  if (${match}[0].length > 0) {
    ${lastMatch} = ${match};
  }
  if (!${regexp}.global) {
    break;
  }
  if (${match}[0].length === 0) {
    ${regexp}.lastIndex = ${match}.index + (${text}.codePointAt(${match}.index) > 65535 ? 2 : 1);
  }
}
`
  );
}
