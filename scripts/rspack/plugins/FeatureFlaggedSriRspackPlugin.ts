import rspack, { type Compilation, type Compiler } from '@rspack/core';

// Rspack port of scripts/webpack/plugins/FeatureFlaggedSriPlugin.ts.
//
// The webpack original taps the legacy `mainTemplate.hooks.jsonpScript` template hook and
// wraps the `script.integrity = ...` assignment in a feature-flag check before codegen.
// rspack has no mainTemplate/jsonpScript hook (the runtime is generated in Rust), so this
// version rewrites the emitted runtime-chunk asset instead: it finds every
// `<target>.integrity = <expr>` assignment injected by rspack's native
// SubresourceIntegrityPlugin and rewrites it to
// `window.__grafanaAssetSriChecksEnabled && (<target>.integrity = <expr>)`.
// The expression form (rather than an if-block) stays valid inside minified comma
// chains such as `s.integrity=r.sriHashes[e],s.crossOrigin="anonymous"`.
//
// Stage choice: the native SRI plugin mutates the runtime chunk before
// PROCESS_ASSETS_STAGE_REPORT (verified in the Phase 1 probe); we patch at
// PROCESS_ASSETS_STAGE_REPORT but MUST be registered before AssetsManifestRspackPlugin
// (same stage — taps run in registration order) so the manifest hashes the patched bytes.

const PLUGIN_NAME = 'FeatureFlaggedSRIPlugin';
const FEATURE_FLAG_GATE = 'window.__grafanaAssetSriChecksEnabled';

export default class FeatureFlaggedSriRspackPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => this.wrapIntegrityAssignments(compilation)
      );
    });
  }

  wrapIntegrityAssignments(compilation: Compilation): void {
    const logger = compilation.getLogger(PLUGIN_NAME);

    const runtimeJsFiles = new Set<string>();
    for (const chunk of compilation.chunks) {
      if (!chunk.hasRuntime()) {
        continue;
      }
      for (const file of chunk.files) {
        if (/\.m?js$/.test(file)) {
          runtimeJsFiles.add(file);
        }
      }
    }

    let wrappedCount = 0;
    for (const file of runtimeJsFiles) {
      const asset = compilation.getAsset(file);
      if (!asset) {
        continue;
      }
      const source = asset.source.source().toString();
      const { patched, count } = gateIntegrityAssignments(source);
      if (count > 0) {
        compilation.updateAsset(file, new rspack.sources.RawSource(patched));
        logger.log(`wrapped ${count} SRI integrity assignment(s) in feature flag in ${file}`);
        wrappedCount += count;
      }
    }

    if (wrappedCount === 0) {
      logger.warn('no `.integrity =` assignment found in any runtime chunk — SRI feature-flag gating was NOT applied');
    }
  }
}

// Rewrites every `<target>.integrity = <expr>` into
// `window.__grafanaAssetSriChecksEnabled && (<target>.integrity = <expr>)`.
// Works on both minified (`s.integrity=c[e]`) and unminified
// (`script.integrity = __webpack_require__.sriHashes[chunkId];`) runtimes.
export function gateIntegrityAssignments(source: string): { patched: string; count: number } {
  // `.integrity` followed by `=` but not `==`/`===` (and not preceded by =/!/<:>, i.e. a
  // plain assignment, not a comparison).
  const assignmentRe = /\.integrity\s*=(?![=])/g;
  const matches = [...source.matchAll(assignmentRe)];
  let patched = source;
  let count = 0;

  // Patch right-to-left so earlier match indices stay valid.
  for (const match of matches.reverse()) {
    const dotIndex = match.index;

    // Walk back over the assignment target (e.g. `script` / `s` / `n.script`).
    let start = dotIndex;
    while (start > 0 && /[A-Za-z0-9_$.]/.test(patched[start - 1])) {
      start--;
    }
    if (start === dotIndex) {
      // No target identifier — not an assignment we understand; skip.
      continue;
    }

    // Already gated (idempotency guard for repeated processAssets runs).
    const before = patched.slice(Math.max(0, start - FEATURE_FLAG_GATE.length - 4), start);
    if (before.includes(FEATURE_FLAG_GATE)) {
      continue;
    }

    const exprStart = dotIndex + match[0].length;
    const exprEnd = findExpressionEnd(patched, exprStart);
    const statement = patched.slice(start, exprEnd);
    patched = patched.slice(0, start) + `${FEATURE_FLAG_GATE}&&(${statement})` + patched.slice(exprEnd);
    count++;
  }

  return { patched, count };
}

// Finds the end of the right-hand-side expression starting at `from`: scans forward
// tracking bracket depth and string literals, stopping at a top-level `,`, `;`, newline,
// or an unbalanced closing bracket.
function findExpressionEnd(source: string, from: number): number {
  let depth = 0;
  let i = from;
  while (i < source.length) {
    const ch = source[i];
    if (ch === '"' || ch === "'" || ch === '`') {
      i = skipStringLiteral(source, i);
      continue;
    }
    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      if (depth === 0) {
        return i;
      }
      depth--;
    } else if (depth === 0 && (ch === ',' || ch === ';' || ch === '\n')) {
      return i;
    }
    i++;
  }
  return i;
}

// Returns the index just past the closing quote. Handles backslash escapes; does not
// handle `${}` nesting in template literals (not present in the SRI runtime code).
function skipStringLiteral(source: string, openIndex: number): number {
  const quote = source[openIndex];
  let i = openIndex + 1;
  while (i < source.length) {
    if (source[i] === '\\') {
      i += 2;
      continue;
    }
    if (source[i] === quote) {
      return i + 1;
    }
    i++;
  }
  return i;
}
