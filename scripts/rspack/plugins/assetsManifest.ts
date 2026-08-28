import type { Compilation } from '@rspack/core';
import type { FileDescriptor, ManifestPluginOptions } from 'rspack-manifest-plugin';

// Must match webassets.AssetsManifestFile on the Go side.
export const ASSETS_MANIFEST_FILE = 'assets-manifest.json';

// Hot module replacement patches are transport, not application code. rspack-manifest-plugin
// strips them from its own `files` list but builds `entries` from an unfiltered
// entrypoint.getFiles(), so without this the backend would render a patch into index.html as a
// regular <script>, out of order and with no integrity hash. webpack-assets-manifest filters
// the same way.
const HOT_UPDATE = /\.hot-update\.(js|mjs|json)$/;

export interface ManifestEntrypoints {
  [entrypointName: string]: {
    assets: Record<string, string[]>;
  };
}

export interface ManifestAssetEntry {
  src: string;
  integrity: string | undefined;
}

export interface ManifestAssets {
  [fileName: string]: ManifestAssetEntry;
}

/**
 * Generate an assets manifest in the shape that webassets.go expects.
 * Only contains files for the entrypoints.
 */
export function generateAssetsManifest(
  _seed: unknown,
  files: FileDescriptor[],
  entries: Record<string, string[]>,
  { compilation }: { compilation: Compilation }
) {
  const rawPublicPath = compilation.outputOptions.publicPath;
  const publicPath = typeof rawPublicPath === 'string' && rawPublicPath !== 'auto' ? rawPublicPath : '';

  const entrypoints: ManifestEntrypoints = {};
  for (const [name, entryFiles] of Object.entries(entries)) {
    entrypoints[name] = { assets: {} };

    for (const file of entryFiles) {
      if (HOT_UPDATE.test(file)) {
        continue;
      }

      const extension = file.slice(file.lastIndexOf('.') + 1);
      entrypoints[name].assets[extension] ??= [];
      entrypoints[name].assets[extension].push(publicPath + file);
    }
  }

  const manifestAssets: ManifestAssets = {};
  for (const file of files) {
    if (file.isInitial) {
      manifestAssets[file.name] = { src: file.path, integrity: file.integrity };
    }
  }

  return {
    entrypoints,
    ...manifestAssets,
  };
}

export const assetsManifestOptions: ManifestPluginOptions = {
  fileName: ASSETS_MANIFEST_FILE,
  generate: generateAssetsManifest,
};
