import { type Compilation, type Compiler, SubresourceIntegrityPlugin, WebpackError } from '@rspack/core';

const PLUGIN_NAME = 'FeatureFlaggedSRIPlugin';
const LOAD_SCRIPT_RUNTIME_MODULE_NAME = 'load_script';
const ESM_CHUNK_LOADING_RUNTIME_MODULE_NAME = 'module_chunk_loading';

// Match on both script.integrity and script.crossOrigin.
const SRI_ATTRIBUTES_REGEX =
  /(?<indent>[ \t]*)(?<sriAttributes>script\.integrity = .+;\r?\n[ \t]*script\.crossOrigin = .+;)/;

const ESM_CHUNK_IMPORT_REGEX = /\bimport\(\s*("\.\/"\s*\+\s*__webpack_require__\.u\(chunkId\))\s*\)/;

// A dynamic import() cannot carry an integrity attribute, so in ESM output the browser only
// checks lazy chunks against an import map's "integrity" entries. The map is added once, on the
// first chunk load, because sriHashes is not guaranteed to be populated when this module runs.
// Keys must be absolute URLs; the relative chunk specifier resolves against this runtime chunk.
// The first chunk loads before Grafana registers its default Trusted Types policy, so the map
// text needs a policy of its own. It only ever holds build-time chunk names and hashes.
const ESM_SRI_IMPORT_HELPER = `
var __grafanaSriImportMapAdded = false;
var __grafanaSriImport = (chunkSpecifier) => {
  if (!__grafanaSriImportMapAdded && typeof document !== 'undefined' && window.__grafanaAssetSriChecksEnabled) {
    __grafanaSriImportMapAdded = true;
    var baseUrl = new URL('./', import.meta.url).href;
    var entries = [];
    for (var sriChunkId in __webpack_require__.sriHashes) {
      entries.push(JSON.stringify(baseUrl + __webpack_require__.u(sriChunkId)) + ':' + JSON.stringify(__webpack_require__.sriHashes[sriChunkId]));
    }
    var importMap = document.createElement('script');
    importMap.type = 'importmap';
    var nonce = __webpack_require__.nc || window.nonce;
    if (nonce) {
      importMap.nonce = nonce;
    }
    var importMapText = '{"integrity":{' + entries.join(',') + '}}';
    if (typeof trustedTypes !== 'undefined' && trustedTypes.createPolicy) {
      importMapText = trustedTypes.createPolicy('grafana#sri-import-map', { createScript: (script) => script }).createScript(importMapText);
    }
    importMap.textContent = importMapText;
    document.head.appendChild(importMap);
  }
  return import(chunkSpecifier);
};
`;

export default class FeatureFlaggedSRIPlugin {
  apply(compiler: Compiler): void {
    const logger = compiler.getInfrastructureLogger(PLUGIN_NAME);
    const isSriEnabled = compiler.options.plugins.some((plugin) => plugin instanceof SubresourceIntegrityPlugin);

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      compilation.hooks.runtimeModule.tap(PLUGIN_NAME, (module) => {
        if (!module.source) {
          return;
        }

        if (module.name === LOAD_SCRIPT_RUNTIME_MODULE_NAME) {
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
          return;
        }

        if (module.name === ESM_CHUNK_LOADING_RUNTIME_MODULE_NAME && isSriEnabled) {
          const source = module.source.source.toString();
          if (!source.includes('import(')) {
            return;
          }

          if (!ESM_CHUNK_IMPORT_REGEX.test(source)) {
            reportUnpatchedChunkImport(compilation);
            return;
          }

          logger.log('FeatureFlaggedSRIPlugin: Loading ESM chunks through the SRI import map');
          const patched = ESM_SRI_IMPORT_HELPER + source.replace(ESM_CHUNK_IMPORT_REGEX, '__grafanaSriImport($1)');
          module.source.source = Buffer.from(patched, 'utf-8');
        }
      });
    });
  }
}

function reportUnpatchedChunkImport(compilation: Compilation): void {
  compilation.errors.push(
    new WebpackError(
      `${PLUGIN_NAME}: could not find the chunk import() in the ${ESM_CHUNK_LOADING_RUNTIME_MODULE_NAME} runtime module, ` +
        'so lazy chunks would load without SRI checks. The rspack runtime template has probably changed.'
    )
  );
}
