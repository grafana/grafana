import {
  type Compilation,
  type Compiler,
  RuntimeGlobals,
  SubresourceIntegrityPlugin,
  WebpackError,
} from '@rspack/core';

const PLUGIN_NAME = 'FeatureFlaggedSRIPlugin';
// rspack runtime module names live inside the native binding
const LOAD_SCRIPT_RUNTIME_MODULE_NAME = 'load_script';
const ESM_CHUNK_LOADING_RUNTIME_MODULE_NAME = 'module_chunk_loading';
const SRI_HASHES = `${RuntimeGlobals.require}.sriHashes`;
const SRI_ATTRIBUTES_REGEX =
  /(?<indent>[ \t]*)(?<sriAttributes>script\.integrity = .+;\r?\n[ \t]*script\.crossOrigin = .+;)/;
const ESM_CHUNK_IMPORT_REGEX = new RegExp(
  `\\bimport\\(\\s*("\\./"\\s*\\+\\s*${escapeRegExp(RuntimeGlobals.getChunkScriptFilename)}\\(chunkId\\))\\s*\\)`
);

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// import() can't carry integrity, so lazy chunks are checked through an import map instead.
// It is built on the first chunk load because sriHashes may not be populated before then, and it
// needs its own Trusted Types policy because Grafana registers the default one after that load.
const ESM_SRI_IMPORT_HELPER = `
var __grafanaSriImportMapAdded = false;
var __grafanaSriImport = (chunkSpecifier) => {
  if (!__grafanaSriImportMapAdded && typeof document !== 'undefined' && window.__grafanaAssetSriChecksEnabled) {
    __grafanaSriImportMapAdded = true;
    var baseUrl = new URL('./', import.meta.url).href;
    var entries = [];
    for (var sriChunkId in ${SRI_HASHES}) {
      entries.push(JSON.stringify(baseUrl + ${RuntimeGlobals.getChunkScriptFilename}(sriChunkId)) + ':' + JSON.stringify(${SRI_HASHES}[sriChunkId]));
    }
    var importMap = document.createElement('script');
    importMap.type = 'importmap';
    var nonce = ${RuntimeGlobals.scriptNonce} || window.nonce;
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
