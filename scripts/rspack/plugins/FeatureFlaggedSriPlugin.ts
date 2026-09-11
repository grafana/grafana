import { type Compiler } from '@rspack/core';

const PLUGIN_NAME = 'FeatureFlaggedSRIPlugin';
const LOAD_SCRIPT_RUNTIME_MODULE_NAME = 'load_script';

// Match on both script.integrity and script.crossOrigin.
const SRI_ATTRIBUTES_REGEX =
  /(?<indent>[ \t]*)(?<sriAttributes>script\.integrity = .+;\r?\n[ \t]*script\.crossOrigin = .+;)/;

export default class FeatureFlaggedSRIPlugin {
  apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.runtimeModule.tap(PLUGIN_NAME, (module) => {
        if (module.name !== LOAD_SCRIPT_RUNTIME_MODULE_NAME || !module.source) {
          return;
        }

        const source = module.source.source.toString();
        if (!SRI_ATTRIBUTES_REGEX.test(source)) {
          return;
        }

        logger.log('FeatureFlaggedSRIPlugin: Wrapping SRI checks in feature flag');
        const wrapped = source.replace(
          SRI_ATTRIBUTES_REGEX,
          '$<indent>if (window.__grafanaAssetSriChecksEnabled) {\n$<indent>$<sriAttributes>\n$<indent>}'
        );
        module.source.source = Buffer.from(wrapped, 'utf-8');
      });
    });
  }
}
