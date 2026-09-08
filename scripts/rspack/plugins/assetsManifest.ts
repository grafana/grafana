import type { Compilation } from '@rspack/core';
import type { FileDescriptor, ManifestPluginOptions } from 'rspack-manifest-plugin';

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
  fileName: 'assets-manifest.json',
  generate: generateAssetsManifest,
};
