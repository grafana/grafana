import rspack, { type Compilation, type Compiler } from '@rspack/core';
import { createHash } from 'node:crypto';

// Replacement for webpack-assets-manifest, which reaches into webpack internals rspack
// doesn't expose and throws on any asset/resource module. Reproduces the manifest
// contract consumed by pkg/api/webassets/webassets.go: every top-level value carries
// { src, integrity } and `entrypoints.<name>.assets.{js,css}` lists the entry files in
// order, prefixed with the public path.
//
// Only entrypoint-reachable files get an entry. readWebAssets resolves integrity for the
// files listed under `entrypoints` and never reads anything else, so a broader manifest
// is dead weight. webpack emits every asset in dev only because webpack.dev.ts omits the
// transform that webpack.prod.ts applies — an omission rather than a decision.

const MANIFEST_NAME = 'assets-manifest.json';
const INTEGRITY_HASHES = ['sha384', 'sha512'] as const;
const PLUGIN_NAME = 'AssetsManifestPlugin';

interface ManifestEntry {
  src: string;
  integrity: string;
}

function isHotUpdate(file: string): boolean {
  return file.includes('.hot-update.');
}

export default class AssetsManifestPlugin {
  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => this.emitManifest(compilation)
      );
    });
  }

  emitManifest(compilation: Compilation): void {
    const rawPublicPath = compilation.outputOptions.publicPath;
    const publicPath = typeof rawPublicPath === 'string' && rawPublicPath !== 'auto' ? rawPublicPath : '';

    const integrityFor = (file: string): string | undefined => {
      const asset = compilation.getAsset(file);
      if (!asset) {
        return undefined;
      }
      const buffer = asset.source.buffer();
      return INTEGRITY_HASHES.map((algo) => `${algo}-${createHash(algo).update(buffer).digest('base64')}`).join(' ');
    };

    // entrypoints: { <name>: { assets: { js: [...], css: [...] } } }
    const entrypoints: Record<string, { assets: Record<string, string[]> }> = {};
    for (const [name, entrypoint] of compilation.entrypoints) {
      const files = entrypoint.getFiles().filter((file) => !file.endsWith('.map') && !isHotUpdate(file));
      const js = files.filter((file) => /\.m?js$/.test(file)).map((file) => `${publicPath}${file}`);
      const css = files.filter((file) => file.endsWith('.css')).map((file) => `${publicPath}${file}`);
      const assets: Record<string, string[]> = {};
      if (js.length > 0) {
        assets.js = js;
      }
      if (css.length > 0) {
        assets.css = css;
      }
      entrypoints[name] = { assets };
    }

    // Human-friendly top-level keys, mirroring webpack-assets-manifest: chunk assets are
    // keyed as `<chunkName><ext>` (e.g. app.js, app.js.map); anything else keeps its
    // output filename. The Go backend ignores these key names — only `entrypoints` and
    // the { src, integrity } value shape matter.
    const keyByFile = new Map<string, string>();
    for (const chunk of compilation.chunks) {
      if (!chunk.name) {
        continue;
      }
      for (const file of [...chunk.files, ...chunk.auxiliaryFiles]) {
        const ext = file.match(/\.(m?js|css)(\.map)?$/)?.[0];
        if (ext) {
          keyByFile.set(file, `${chunk.name}${ext}`);
        }
      }
    }

    const files = new Set<string>();
    for (const entrypoint of compilation.entrypoints.values()) {
      for (const file of entrypoint.getFiles()) {
        if (!file.endsWith('.map') && !isHotUpdate(file)) {
          files.add(file);
        }
      }
    }

    const entries: Record<string, ManifestEntry> = {};
    for (const file of files) {
      const integrity = integrityFor(file);
      if (integrity === undefined) {
        continue;
      }
      entries[keyByFile.get(file) ?? file] = { src: `${publicPath}${file}`, integrity };
    }

    const manifest: Record<string, ManifestEntry | typeof entrypoints> = {};
    for (const key of Object.keys(entries).sort()) {
      manifest[key] = entries[key];
    }
    manifest.entrypoints = entrypoints;

    compilation.emitAsset(MANIFEST_NAME, new rspack.sources.RawSource(JSON.stringify(manifest, null, 2)));
  }
}
