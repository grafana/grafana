import { getPackagesSync } from '@manypkg/get-packages';
import ESLintPlugin from 'eslint-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import fs from 'node:fs';
import path from 'node:path';
import webpack, { type Configuration } from 'webpack';
import WebpackAssetsManifest from 'webpack-assets-manifest';
import LiveReloadPlugin from 'webpack-livereload-plugin';
import { merge } from 'webpack-merge';
import WebpackBar from 'webpackbar';

import common, { type Env } from './webpack.common.ts';

// webpack does not correctly export named ESM bindings — destructure from the default import
const { DefinePlugin, EnvironmentPlugin } = webpack;

// To speed up webpack and prevent unnecessary rebuilds we ignore decoupled packages
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
        react: path.resolve('./node_modules/react'),

        // This is required to correctly resolve react-router-dom when linking with
        //  local version of @grafana/scenes
        'react-router-dom': path.resolve('./node_modules/react-router-dom'),
        '@grafana/scenes': scenesModule(),
      },
    },

    // https://webpack.js.org/guides/build-performance/#output-without-path-info
    output: {
      pathinfo: false,
    },

    // https://webpack.js.org/guides/build-performance/#avoid-extra-optimization-steps
    optimization: {
      moduleIds: 'named',
      runtimeChunk: true,
      removeAvailableModules: false,
      removeEmptyChunks: false,
      splitChunks: false,
    },

    // enable persistent cache for faster cold starts
    cache: {
      type: 'filesystem',
      name: 'grafana-default-development',
      buildDependencies: {
        config: [import.meta.filename],
      },
    },

    plugins: [
      new DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify('development'),
        },
      }),
      new WebpackAssetsManifest({
        entrypoints: true,
        integrity: true,
        integrityHashes: ['sha384', 'sha512'],
        publicPath: true,
        output: env.react19 ? 'assets-manifest-react19.json' : 'assets-manifest.json',
      }),
      new WebpackBar({
        color: '#eb7b18',
        name: 'Grafana',
      }),
    ],

    stats: 'minimal',
  };

  if (Number(env.liveReload)) {
    devConfig.plugins?.push(
      new LiveReloadPlugin({
        appendScriptTag: true,
        useSourceHash: true,
        hostname: 'localhost',
        protocol: 'http',
        port: 35750,
      })
    );
  }

  if (!Number(env.noTsCheck)) {
    devConfig.plugins?.push(
      new ForkTsCheckerWebpackPlugin({
        async: true, // don't block webpack emit
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
        failOnError: false,
      })
    );
  }

  return merge(common(env), devConfig);
};
