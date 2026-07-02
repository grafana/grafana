import rspack, { type Compilation, type Compiler } from '@rspack/core';
import { createHash } from 'node:crypto';

// Spike replacement for webpack-assets-manifest (scripts/webpack/webpack.dev.ts), which
// relies on webpack internals rspack doesn't expose. Reproduces the manifest contract
// consumed by pkg/api/webassets/webassets.go: every top-level value carries
// { src, integrity } and `entrypoints.<name>.assets.{js,css}` lists the entry files in
// order, prefixed with the public path.
//
// mode 'dev': every emitted asset gets a top-level entry (matches the webpack dev output).
// mode 'prod': top-level entries are filtered to files reachable from entrypoints
// (matches the webpack prod output; Phase 2 uses this).

const INTEGRITY_HASHES = ['sha384', 'sha512'] as const;

export interface AssetsManifestRspackPluginOptions {
  mode: 'dev' | 'prod';
  react19: boolean;
}

interface ManifestEntry {
  src: string;
  integrity: string;
}

const PLUGIN_NAME = 'AssetsManifestRspackPlugin';

export default class AssetsManifestRspackPlugin {
  options: AssetsManifestRspackPluginOptions;

  constructor(options: AssetsManifestRspackPluginOptions) {
    this.options = options;
  }

  apply(compiler: Compiler): void {
    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation: Compilation) => {
      compilation.hooks.processAssets.tap(
        { name: PLUGIN_NAME, stage: rspack.Compilation.PROCESS_ASSETS_STAGE_REPORT },
        () => this.emitManifest(compilation)
      );
    });
  }

  emitManifest(compilation: Compilation): void {
    const manifestName = this.options.react19 ? 'assets-manifest-react19.json' : 'assets-manifest.json';
    const rawPublicPath = compilation.outputOptions.publicPath;
    const publicPath = typeof rawPublicPath === 'string' && rawPublicPath !== 'auto' ? rawPublicPath : '';

    const isHotUpdate = (file: string) => file.includes('.hot-update.');

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
      const files = entrypoint.getFiles().filter((f) => !f.endsWith('.map') && !isHotUpdate(f));
      const js = files.filter((f) => /\.m?js$/.test(f)).map((f) => `${publicPath}${f}`);
      const css = files.filter((f) => f.endsWith('.css')).map((f) => `${publicPath}${f}`);
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

    let files: string[];
    if (this.options.mode === 'prod') {
      const entryFiles = new Set<string>();
      for (const entrypoint of compilation.entrypoints.values()) {
        for (const file of entrypoint.getFiles()) {
          if (!file.endsWith('.map') && !isHotUpdate(file)) {
            entryFiles.add(file);
          }
        }
      }
      files = [...entryFiles];
    } else {
      files = compilation
        .getAssets()
        .map((asset) => asset.name)
        .filter((name) => name !== manifestName && !isHotUpdate(name));
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

    compilation.emitAsset(manifestName, new rspack.sources.RawSource(JSON.stringify(manifest, null, 2)));
  }
}
