import type { WebpackAssetsManifest, Options, AssetsStorage } from 'webpack-assets-manifest';

interface EntrypointAssets {
  assets: { js?: string[]; css?: string[] };
}

function isEntrypointsMap(value: unknown): value is Record<string, EntrypointAssets> {
  return typeof value === 'object' && value !== null;
}

function isAssetEntry(value: unknown): value is { src: string } {
  return typeof value === 'object' && value !== null && 'src' in value;
}

export function manifestTransform(assets: AssetsStorage, manifest: WebpackAssetsManifest) {
  const entrypointsKey = manifest.options.entrypointsKey;
  if (typeof entrypointsKey !== 'string') {
    return assets;
  }

  const entrypointsValue = assets[entrypointsKey];
  const entrypointAssets = isEntrypointsMap(entrypointsValue)
    ? Object.values(entrypointsValue).flatMap((entry) => [...(entry.assets.js || []), ...(entry.assets.css || [])])
    : [];

  const filteredAssets = Object.entries(assets).filter(([assetFileName]) => {
    const asset = assets[assetFileName];
    return isAssetEntry(asset) && entrypointAssets.includes(asset.src);
  });
  const result = Object.fromEntries(filteredAssets);
  result[entrypointsKey] = entrypointsValue;

  return result;
}

export const manifestPluginOptions: Partial<Options> = {
  entrypoints: true,
  integrity: true,
  integrityHashes: ['sha384', 'sha512'],
  publicPath: true,
  // This transform filters down the assets to only include the ones that are part of the entrypoints
  // this is all that the backend requires.
  transform: manifestTransform,
  output: 'assets-manifest.json',
};
