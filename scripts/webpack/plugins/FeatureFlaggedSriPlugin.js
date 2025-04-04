// @ts-check
const webpack = require('webpack');

/** @typedef {import('webpack/lib/Compiler.js')} Compiler */

const PLUGIN_NAME = 'FeatureFlaggedSRIPlugin';
const FEATURE_TOGGLE_WRAP = [
  'if (window.grafanaBootData && window.grafanaBootData.settings && window.grafanaBootData.settings.featureToggles && window.grafanaBootData.settings.featureToggles.assetSriChecks) {',
  '}',
];

/**
 * Webpack plugin that wraps Webpack runtime integrity checks in a feature flag
 * This allows us to disable SRI checks in both the initial chunks but also in the
 * dynamically loaded chunks.
 */
class FeatureFlaggedSRIPlugin {
  /**
   * @param {Compiler} compiler The webpack compiler instance
   */
  apply(compiler) {
    compiler.hooks.afterPlugins.tap(PLUGIN_NAME, (compiler) => {
      const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
      compiler.hooks.thisCompilation.tap(
        {
          name: PLUGIN_NAME,
        },
        (compilation) => {
          const { mainTemplate } = compilation;
          mainTemplate.hooks.jsonpScript.tap(
            PLUGIN_NAME,
            /**
             * @param {string} source
             */
            (source) => {
              if (source.includes('script.integrity =')) {
                logger.log('FeatureFlaggedSRIPlugin: Wrapping SRI checks in feature flag');
                return createFeatureFlaggedSRITemplate(source);
              }
              return source;
            }
          );
        }
      );
    });
  }
}

/**
 * Creates a template string wrapping the integrity and crossorigin attributes in a feature flag
 * @param {string} source The original webpack template source
 * @returns {string} The modified template source
 */
function createFeatureFlaggedSRITemplate(source) {
  const lines = source.split('\n');
  const integrityAttributeLineNumber = lines.findIndex((line) => line.includes('script.integrity ='));
  const [prefix, suffix] = FEATURE_TOGGLE_WRAP;
  return webpack.Template.asString([
    ...lines.slice(0, integrityAttributeLineNumber),
    prefix,
    webpack.Template.indent(lines.slice(integrityAttributeLineNumber)),
    suffix,
  ]);
}

module.exports = FeatureFlaggedSRIPlugin;
