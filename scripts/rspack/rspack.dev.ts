import { getPackagesSync } from '@manypkg/get-packages';
import rspack, { type Configuration } from '@rspack/core';
import type { Configuration as DevServerConfiguration } from '@rspack/dev-server';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
import ESLintPlugin from 'eslint-rspack-plugin';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { RspackManifestPlugin } from 'rspack-manifest-plugin';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { merge } from 'webpack-merge';
import WebpackBar from 'webpackbar';

import { getEnvConfig } from '../cli/env-util.ts';

import { assetsManifestOptions } from './plugins/assetsManifest.ts';
import common, { PUBLIC_PATH, type Env } from './rspack.common.ts';

const require = createRequire(import.meta.url);

// To speed up rspack and prevent unnecessary rebuilds we ignore decoupled packages
function getDecoupledPlugins(): string[] {
  const { packages } = getPackagesSync(process.cwd());
  return packages.filter((pkg) => pkg.dir.includes('plugins/datasource')).map((pkg) => `${pkg.dir}/**`);
}

// When linking scenes for development, resolve the path to the src directory for sourcemaps
function scenesModule(): string {
  const scenesPath = path.resolve('./node_modules/@grafana/scenes');
  try {
    const status = fs.lstatSync(scenesPath);
    if (status.isSymbolicLink()) {
      console.log(`scenes is linked to local scenes repo`);
      return path.resolve(scenesPath + '/src');
    }
  } catch (error) {
    console.error(`Error checking scenes path: ${error instanceof Error ? error.message : String(error)}`);
  }
  return scenesPath;
}
const decoupledPlugins = getDecoupledPlugins();

// The dev server and the backend both need to agree on one origin. `[frontend_dev] server_url`
// in the ini is that single source of truth: the dev server listens on it, and the backend
// renders it into index.html as the asset origin.
function getDevServerOrigin(): { hostname: string; port: number } {
  const grafanaRoot = path.resolve(import.meta.dirname, '../..');
  const raw = getEnvConfig(grafanaRoot).frontend_dev_server_url;

  if (typeof raw !== 'string' || raw === '') {
    throw new Error(
      'Cannot start the dev server: `[frontend_dev] server_url` is not set. Restore it in conf/defaults.ini, or set it in conf/custom.ini.'
    );
  }

  const { hostname, port } = new URL(raw);
  if (!/^\d+$/.test(port) || Number(port) <= 0) {
    throw new Error(`Cannot start the dev server: \`[frontend_dev] server_url\` (${raw}) names no port.`);
  }

  return { hostname, port: Number(port) };
}

function getDevServer(): DevServerConfiguration {
  const { hostname, port } = getDevServerOrigin();
  const grafanaRoot = path.resolve(import.meta.dirname, '../..');

  return {
    port,
    hot: true,

    // Grafana points the browser here for everything under `public/`, the same way it points
    // at a CDN in production. Only the build output lives in the compiler, so the rest of the
    // tree - fonts, core plugin bundles, images - has to be served from disk.
    static: {
      directory: path.resolve(grafanaRoot, 'public'),
      publicPath: '/public',
      watch: false,
    },

    // Everything the page loads from here is cross-origin, and fonts, `fetch`ed JSON and hot
    // update manifests are all CORS requests. The server only ever listens on loopback.
    headers: { 'Access-Control-Allow-Origin': '*' },

    // Nothing travels further than loopback, so gzipping megabytes of dev bundle is pure cost.
    compress: false,

    // Checked against the request Host, and against the Origin the HMR client connects with -
    // whichever name the contributor opened Grafana under. Listing the loopback aliases beats
    // disabling the check with 'all', which would leave the dev server open to DNS rebinding.
    allowedHosts: [...new Set([hostname, 'localhost', '127.0.0.1'])],

    client: {
      // The page is served by Grafana on another port, so the client cannot infer where its
      // socket lives. Point it back at this server.
      webSocketURL: `ws://${hostname}:${port}/ws`,
    },

    devMiddleware: {
      publicPath: `/${PUBLIC_PATH}`,

      // Nothing is written to disk. The backend reads the manifest from this server over HTTP,
      // and falls back to whatever `yarn build:rspack` last left in public/build/rspack.
      writeToDisk: false,
    },
  };
}

export default (env: Env = {}) => {
  const hmr = Boolean(Number(env.hmr));

  const devConfig: Configuration = {
    devtool: 'source-map',
    mode: 'development',

    // If we enabled watch option via CLI
    watchOptions: {
      ignored: ['**/node_modules', ...decoupledPlugins],
    },

    resolve: {
      alias: {
        // Packages linked for development need react to be resolved from the same location
        react: path.resolve('./node_modules/react'),

        // This is required to correctly resolve react-router-dom when linking with
        //  local version of @grafana/scenes
        'react-router-dom': path.resolve('./node_modules/react-router-dom'),
        '@grafana/scenes': scenesModule(),
      },
    },

    output: {
      pathinfo: false,
    },

    optimization: {
      moduleIds: 'named',
      runtimeChunk: true,
      removeEmptyChunks: false,
      splitChunks: false,
    },

    plugins: [
      new rspack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('development'),
        },
      }),
      new RspackManifestPlugin(assetsManifestOptions),
      new WebpackBar({
        color: '#eb7b18',
        name: 'Grafana',
      }),
    ],

    stats: 'minimal',
  };

  if (hmr) {
    devConfig.devServer = getDevServer();
    devConfig.plugins?.push(new ReactRefreshRspackPlugin());

    // `rspack serve` turns lazy compilation on for web-only builds unless the config says
    // otherwise, and its client posts to a root-relative /_rspack/lazy/trigger. The page is
    // served by Grafana, so that lands there instead and every dynamic import fails.
    // Compiling everything up front costs about two seconds.
    devConfig.lazyCompilation = false;
  }

  if (Number(env.liveReload)) {
    // Live reload has no rspack equivalent; the webpack plugin crashes rspack 2 at apply time.
    console.warn('[rspack.dev] --env liveReload=1 is not supported by the rspack build; ignoring.');
  }

  if (!Number(env.noTsCheck)) {
    const nativeTypeScriptPackageJson = require.resolve('@typescript/native/package.json');
    devConfig.plugins?.push(
      new TsCheckerRspackPlugin({
        async: true, // don't block rspack emit
        typescript: {
          tsgo: true,
          typescriptPath: nativeTypeScriptPackageJson,
          mode: 'write-references',
          memoryLimit: 8192,
          diagnosticOptions: {
            semantic: true,
            syntactic: true,
          },
        },
      })
    );
  }

  if (!Number(env.noLint)) {
    devConfig.plugins?.push(
      new ESLintPlugin({
        cache: true,
        lintDirtyModulesOnly: true, // don't lint on start, only lint changed files
        extensions: ['.ts', '.tsx'],
        configType: 'flat',
        // Replaces `failOnError: false`, dropped in eslint-rspack-plugin 5.x: lint problems
        // are printed and the build still succeeds.
        severity: { error: 'warning' },
      })
    );
  }

  return merge(common({ ...env, hmr: hmr ? '1' : undefined }), devConfig);
};
