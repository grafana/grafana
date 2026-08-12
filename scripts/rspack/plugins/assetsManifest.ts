import type { Compilation } from '@rspack/core';
import { createHash } from 'node:crypto';
import type { FileDescriptor, Manifest, ManifestPluginOptions } from 'rspack-manifest-plugin';

// Options for rspack-manifest-plugin, which replaces webpack-assets-manifest. That library
// reaches into webpack internals rspack doesn't expose and throws on any asset/resource
// module, so it cannot be used here at all — see assetsManifest.test.ts.
//
// `generate` reshapes the plugin's file list into the manifest contract consumed by
// pkg/api/webassets/webassets.go: every top-level value carries { src, integrity } and
// `entrypoints.<name>.assets.{js,css}` lists the entry files in load order, prefixed with
// the public path.
//
// Only entrypoint-reachable files get an entry. readWebAssets resolves integrity for the
// files listed under `entrypoints` and never reads anything else, so a broader manifest is
// dead weight.

const MANIFEST_NAME = 'assets-manifest.json';

// Digests are computed here rather than read from FileDescriptor.integrity, which is populated
// only by SubresourceIntegrityPlugin. webpack.dev.ts emits these same two hashes today with no
// SRI plugin registered, so computing preserves that behaviour where trusting the field would
// change it. It is also cheaper: SRI hashes every chunk, including async ones, to build the
// runtime's sriHashes map, while the manifest only needs entrypoint-reachable files.
export const INTEGRITY_HASHES = ['sha384', 'sha512'] as const;

interface EntrypointAssets {
  js?: string[];
  css?: string[];
}

function isServable(file: string): boolean {
  return !file.endsWith('.map') && !file.includes('.hot-update.');
}

export function generateAssetsManifest(
  _seed: Record<string, unknown>,
  files: FileDescriptor[],
  entries: Record<string, string[]>,
  { compilation }: { compilation: Compilation }
): Manifest {
  const rawPublicPath = compilation.outputOptions.publicPath;
  const publicPath = typeof rawPublicPath === 'string' && rawPublicPath !== 'auto' ? rawPublicPath : '';

  const entrypoints: Record<string, { assets: EntrypointAssets }> = {};
  for (const [name, entryFiles] of Object.entries(entries)) {
    const servable = entryFiles.filter(isServable);
    const js = servable.filter((file) => /\.m?js$/.test(file)).map((file) => `${publicPath}${file}`);
    const css = servable.filter((file) => file.endsWith('.css')).map((file) => `${publicPath}${file}`);
    const assets: EntrypointAssets = {};
    if (js.length > 0) {
      assets.js = js;
    }
    if (css.length > 0) {
      assets.css = css;
    }
    entrypoints[name] = { assets };
  }

  const reachable = new Set(
    Object.values(entrypoints).flatMap((entry) => [...(entry.assets.js ?? []), ...(entry.assets.css ?? [])])
  );

  const manifest: Manifest = {};
  for (const file of files) {
    if (!reachable.has(file.path)) {
      continue;
    }
    // file.path carries publicPath; compilation.getAsset keys on the raw output filename.
    const asset = compilation.getAsset(file.path.slice(publicPath.length));
    if (!asset) {
      throw new Error(`assets-manifest: no emitted asset for entrypoint file ${file.path}`);
    }
    const buffer = asset.source.buffer();
    const integrity = INTEGRITY_HASHES.map(
      (algo) => `${algo}-${createHash(algo).update(buffer).digest('base64')}`
    ).join(' ');
    manifest[file.name] = { src: file.path, integrity };
  }

  const sorted: Manifest = {};
  for (const key of Object.keys(manifest).sort()) {
    sorted[key] = manifest[key];
  }
  sorted.entrypoints = entrypoints;
  return sorted;
}

export const assetsManifestOptions: ManifestPluginOptions = {
  fileName: MANIFEST_NAME,
  generate: generateAssetsManifest,
};
