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
export function generateAssetsManifest(publicPath: string, files: FileDescriptor[], entries: Record<string, string[]>) {
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

/**
 * `publicPath` is a literal prefix rather than output.publicPath, which is 'auto' and carries no
 * value at build time. The backend renders manifest paths verbatim into <script src> and
 * <link href>, where a bare filename breaks every non-root route — so it must agree with the
 * build's output directory: disk layout, URL and CDN path are one string.
 */
export function createAssetsManifestOptions(publicPath: string): ManifestPluginOptions {
  return {
    fileName: 'assets-manifest.json',
    // Prefixes the per-file `src` values; the entrypoint lists are prefixed by generate below.
    publicPath,
    generate: (_seed, files, entries) => generateAssetsManifest(publicPath, files, entries),
  };
}
