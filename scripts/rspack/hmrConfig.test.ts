import { describe, expect, it } from 'vitest';

import dev from './rspack.dev.ts';
import prod from './rspack.prod.ts';

// Hot module replacement changes the build in ways that are only safe behind a dev server:
// filenames lose their content hash, and the swc transform emits Fast Refresh calls that need a
// runtime only ReactRefreshRspackPlugin provides. These tests pin that those two always travel
// together, and that neither can be reached from the production config.

type Rule = { test?: unknown; use?: { options?: { jsc?: { transform?: { react?: Record<string, unknown> } } } } };

function inspect(config: unknown) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cfg = config as {
    output?: { filename?: unknown; chunkFilename?: unknown };
    module?: { rules?: Rule[] };
    plugins?: Array<{ constructor?: { name?: string }; options?: { filename?: unknown } } | undefined>;
    devServer?: unknown;
    lazyCompilation?: unknown;
  };

  const filename = cfg.output?.filename;
  const plugins = (cfg.plugins ?? []).filter((plugin) => plugin != null);
  const cssPlugin = plugins.find((plugin) => plugin.constructor?.name?.includes('CssExtract'));
  const swcRule = (cfg.module?.rules ?? []).find((rule) => String(rule.test) === String(/\.tsx?$/));

  return {
    appFilename: typeof filename === 'function' ? filename({ chunk: { name: 'app' } }) : filename,
    bootFilename: typeof filename === 'function' ? filename({ chunk: { name: 'boot' } }) : filename,
    chunkFilename: cfg.output?.chunkFilename,
    cssFilename: cssPlugin?.options?.filename,
    reactTransform: swcRule?.use?.options?.jsc?.transform?.react,
    hasRefreshPlugin: plugins.some((plugin) => plugin.constructor?.name?.includes('ReactRefresh')),
    devServer: cfg.devServer,
    lazyCompilation: cfg.lazyCompilation,
  };
}

const noChecks = { noTsCheck: '1', noLint: '1' } as const;

describe('the production config', () => {
  // `--env` is a user-facing CLI surface and `build:rspack:nominify` already chains flags onto
  // it, so a production build must ignore `hmr` rather than quietly honour it: the result
  // compiles clean but ships unhashed filenames and Fast Refresh calls with no runtime.
  it('ignores --env hmr=1 entirely', () => {
    const [plain] = prod({});
    const [withHmr] = prod({ hmr: '1' });

    expect(inspect(withHmr)).toEqual(inspect(plain));
    expect(inspect(withHmr).appFilename).toBe('[name].[contenthash].js');
    expect(inspect(withHmr).reactTransform).toEqual({ runtime: 'automatic' });
    expect(inspect(withHmr).hasRefreshPlugin).toBe(false);
  });
});

describe('the dev config without hmr', () => {
  // This is what `start:rspack:noHmr` runs, and what the frontend-service stack builds with.
  it('keeps content hashes and starts no dev server', () => {
    const built = inspect(dev(noChecks));

    expect(built.appFilename).toBe('[name].[contenthash].js');
    expect(built.chunkFilename).toBe('[name].[contenthash].js');
    expect(built.cssFilename).toBe('grafana.[name].[contenthash].css');
    expect(built.reactTransform).toEqual({ runtime: 'automatic' });
    expect(built.hasRefreshPlugin).toBe(false);
    expect(built.devServer).toBeUndefined();
  });
});

describe('the dev config with hmr', () => {
  it('drops content hashes, since hot updates patch stable names', () => {
    const built = inspect(dev({ ...noChecks, hmr: '1' }));

    expect(built.appFilename).toBe('[name].js');
    expect(built.chunkFilename).toBe('[name].js');
    expect(built.cssFilename).toBe('grafana.[name].css');
  });

  it('registers the Fast Refresh runtime alongside the transform that calls it', () => {
    const built = inspect(dev({ ...noChecks, hmr: '1' }));

    expect(built.reactTransform).toEqual({ runtime: 'automatic', development: true, refresh: true });
    expect(built.hasRefreshPlugin).toBe(true);
  });

  it('never hashes boot.js, which the Go template references by name', () => {
    expect(inspect(dev({ ...noChecks, hmr: '1' })).bootFilename).toBe('[name].js');
    expect(inspect(dev(noChecks)).bootFilename).toBe('[name].js');
  });

  it('binds the dev server to the configured host rather than every interface', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const devServer = inspect(dev({ ...noChecks, hmr: '1' })).devServer as {
      host?: string;
      port?: number;
      headers?: unknown;
      devMiddleware?: { publicPath?: string; writeToDisk?: boolean };
    };

    expect(devServer.host).toBe('localhost');
    expect(devServer.port).toBe(3333);
    // The path the Go side fetches the manifest from - see webassets.PublicPathFor.
    expect(devServer.devMiddleware?.publicPath).toBe('/public/build/rspack/');
    expect(devServer.devMiddleware?.writeToDisk).toBe(false);
  });

  it('reflects CORS only to loopback origins, never a wildcard', () => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const headers = (inspect(dev({ ...noChecks, hmr: '1' })).devServer as { headers: (req: unknown) => object })
      .headers;
    const forOrigin = (origin?: string) => headers({ headers: { origin } });

    expect(forOrigin('http://localhost:3000')).toEqual({
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      Vary: 'Origin',
    });
    expect(forOrigin('http://127.0.0.1:3000')).toHaveProperty('Access-Control-Allow-Origin');
    expect(forOrigin('https://evil.example')).toEqual({});
    expect(forOrigin('http://localhost.evil.example')).toEqual({});
    expect(forOrigin(undefined)).toEqual({});
  });

  it('compiles everything up front, because the lazy client posts to the wrong origin', () => {
    expect(inspect(dev({ ...noChecks, hmr: '1' })).lazyCompilation).toBe(false);
  });
});
