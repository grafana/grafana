import type { Compiler, StatsValue } from '@rspack/core';

// webpack's `stats.toJson()` reports the whole graph by default; rspack's reports a summary
// with no assets, chunks or modules. `all: true` restores them, but also folds them into
// synthetic `assets by path` tree nodes that bundle analysers skip straight past, so the
// grouping goes back off.
export const fullStatsOptions: StatsValue = {
  all: true,
  source: false,
  groupAssetsByChunk: false,
  groupAssetsByEmitStatus: false,
  groupAssetsByExtension: false,
  groupAssetsByInfo: false,
  groupAssetsByPath: false,
  groupModulesByAttributes: false,
  groupModulesByCacheStatus: false,
  groupModulesByExtension: false,
  groupModulesByLayer: false,
  groupModulesByPath: false,
  groupModulesByType: false,
};

/**
 * Makes `stats.toJson()` return what webpack's returns.
 *
 * webpack-bundle-analyzer calls it with no arguments and expects webpack's defaults back;
 * under rspack it gets a summary and reports an empty bundle. Callers that ask for
 * particular stats options still get exactly those.
 *
 * Console output is unaffected: `Stats.toString` resolves its own options and reads the
 * compilation directly rather than going through this method.
 *
 * Register before the plugin that consumes the stats, so this `done` tap runs first.
 */
export function widenStatsForAnalyzer(this: Compiler) {
  this.hooks.done.tap('WidenStatsForAnalyzer', (stats) => {
    const toJson = stats.toJson.bind(stats);
    stats.toJson = (options, forToString) => toJson(options ?? fullStatsOptions, forToString);
  });
}
