import { getPackagesSync } from '@manypkg/get-packages';
import rspack, { type Configuration } from '@rspack/core';
import ESLintPlugin from 'eslint-rspack-plugin';
import fs from 'node:fs';
import path from 'node:path';
import { TsCheckerRspackPlugin } from 'ts-checker-rspack-plugin';
import { merge } from 'webpack-merge';
import WebpackBar from 'webpackbar';

import AssetsManifestRspackPlugin from './plugins/AssetsManifestRspackPlugin.ts';
import common, { type Env } from './rspack.common.ts';

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

export default (env: Env = {}) => {
  const devConfig: Configuration = {
    devtool: 'source-map',
    mode: 'development',

    // If we enabled watch option via CLI
    watchOptions: {
      ignored: ['/node_modules/', ...decoupledPlugins],
    },

    resolve: {
      alias: {
        // Packages linked for development need react to be resolved from the same location
        react: env.react19 ? path.resolve('./node_modules/react-19') : path.resolve('./node_modules/react'),

        // This is required to correctly resolve react-router-dom when linking with
        //  local version of @grafana/scenes
        'react-router-dom': path.resolve('./node_modules/react-router-dom'),
        '@grafana/scenes': scenesModule(),
      },
    },

    output: {
      pathinfo: false,
    },

    // Mirrors the dev optimization block in scripts/webpack/webpack.dev.ts.
    // `removeAvailableModules` is not supported by rspack and is omitted.
    optimization: {
      moduleIds: 'named',
      runtimeChunk: true,
      removeEmptyChunks: false,
      splitChunks: false,
    },

    // NOTE: no persistent cache for the spike — rspack's default in-memory cache only.

    plugins: [
      new rspack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('development'),
        },
      }),
      new AssetsManifestRspackPlugin({
        mode: 'dev',
        react19: Boolean(env.react19),
      }),
      new WebpackBar({
        color: '#eb7b18',
        name: 'Grafana',
      }),
    ],

    stats: 'minimal',
  };

  if (Number(env.liveReload)) {
    // webpack-livereload-plugin crashes under rspack 2 ("Cannot read properties of
    // undefined (reading 'tap')" at apply time) — skipped for the spike, see the
    // findings ledger. The webpack dev config still supports it.
    console.warn('[rspack.dev] --env liveReload=1 is not supported by the rspack spike config; ignoring.');
  }

  if (!Number(env.noTsCheck)) {
    devConfig.plugins?.push(
      new TsCheckerRspackPlugin({
        async: true, // don't block rspack emit
        typescript: {
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
        // eslint-rspack-plugin 5.x removed `failOnError`; this is the equivalent of
        // `failOnError: false` — errors are reported but don't fail the build.
        severity: { error: 'warning' },
      })
    );
  }

  return merge(common(env), devConfig);
};
