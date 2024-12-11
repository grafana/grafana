import { getPackagesSync } from '@manypkg/get-packages';
import react from '@vitejs/plugin-react-swc';
import { move, remove } from 'fs-extra';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, splitVendorChunkPlugin, createLogger } from 'vite';
import EnvironmentPlugin from 'vite-plugin-environment';

const require = createRequire(import.meta.url);
const getEnvConfig = require('./scripts/webpack/env-util.cjs');
const shouldMinify = process.env.NO_MINIFY === '1' ? false : 'esbuild';

const allWorkspaceDependencies = getAllWorkspaceDependencies();

const frontendDevEnvSettings = getEnvConfig();

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  json: {
    // Stringify JSON so that we don't lose translation keys with hyphens in them
    // TODO: Why?! Fix this/work out a better way
    stringify: true,
  },
  root: 'public',
  build: {
    // use manifest for backend integration in production
    manifest: 'public/build/.vite/manifest.json',
    rollupOptions: {
      input: [
        // trustedTypePolicies.ts is a special case because it needs to be loaded before the index.js and vendor.js
        // otherwise the policy is not applied and grafana fails to load.
        './public/app/core/trustedTypePolicies.ts',
        './public/app/index.ts',
        './public/sass/grafana.dark.scss',
        './public/sass/grafana.light.scss',
      ],
      output: {
        manualChunks(id) {
          if (id.includes('@braintree/sanitize-url')) {
            return 'braintree';
          }
        },
      },
    },
    outDir: 'build_tmp',
    assetsDir: 'public/build',
    minify: shouldMinify,
  },
  css: {
    preprocessorOptions: {
      scss: {
        silenceDeprecations: ['import', 'global-builtin', 'legacy-js-api'],
      },
    },
  },
  server: {
    // vite binds to ipv6 by default... and that doesn't work for me locally on mac...
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    angularHtmlImport(),
    EnvironmentPlugin({
      // these are default values in case NODE_ENV is not set in the environment
      NODE_ENV: command === 'build' ? 'production' : 'development',
      // Expose frontend_dev_* settings from ini files
      ...frontendDevEnvSettings,
    }),
    { ...moveAssets(), apply: 'build' },
    ...(process.env.ANALYZE_BUNDLE ? [visualizer()] : []),
  ],
  optimizeDeps: {
    include: [
      'monaco-editor/esm/vs/editor/editor.worker',
      'monaco-editor/esm/vs/language/css/css.worker',
      'monaco-editor/esm/vs/language/html/html.worker',
      'monaco-editor/esm/vs/language/json/json.worker',
      'monaco-editor/esm/vs/language/typescript/ts.worker',
      '@kusto/monaco-kusto/release/esm/kusto.worker',
      '@kusto/language-service/bridge.min',
      'jquery',
    ],
    exclude: [...allWorkspaceDependencies],
  },
  resolve: {
    alias: [
      // some of data source plugins use global Prism object to add the language definition
      // we want to have same Prism object in core and in grafana/ui
      {
        find: 'prismjs',
        replacement: require.resolve('prismjs'),
      },
      // some sub-dependencies use a different version of @emotion/react and generate warnings
      // in the browser about @emotion/react loaded twice. We want to only load it once
      { find: '@emotion/react', replacement: require.resolve('@emotion/react') },
      // due to our webpack configuration not understanding package.json `exports`
      // correctly we must alias this package to the correct file
      // the alternative to this alias is to copy-paste the file into our
      // source code and miss out in updates
      {
        find: '@locker/near-membrane-dom/custom-devtools-formatter',
        replacement: require.resolve('@locker/near-membrane-dom/custom-devtools-formatter.js'),
      },
      // yarn link: protocol aliases
      {
        find: /^app/,
        replacement: fileURLToPath(new URL('./public/app', import.meta.url)),
      },
      {
        find: /^vendor/,
        replacement: fileURLToPath(new URL('./public/vendor', import.meta.url)),
      },
      // teach vite how to resolve @grafana/schema
      {
        find: /^@grafana\/schema\/dist\/esm\/(.*)$/,
        replacement: '@grafana/schema/src/$1',
      },
    ],
  },
  experimental: {
    // Support CDN asset paths
    renderBuiltUrl(filename: string, { hostType }) {
      return { relative: true };
    },
  },
}));

/**
 * This is a Vite plugin for handling angular templates.
 * https://vitejs.dev/guide/api-plugin.html#simple-examples
 *
 * The webpack output from https://github.com/WearyMonkey/ngtemplate-loader looks like this:
 * var code = "\n<div class=\"graph-annotation\">\n\t<div class=\"graph-annotation__header\">\n\t\t</div></div>\n";
 * Exports
 * var _module_exports =code;;
 * var path = 'public/app/features/annotations/partials/event_editor.html';
 * window.angular.module('ng').run(['$templateCache', function(c) { c.put(path, _module_exports) }]);
 * module.exports = path;
 */

function angularHtmlImport() {
  const htmlComponentFile = /\.html\?inline$/;
  return {
    name: 'transform-angular-html',
    async transform(src, id) {
      if (htmlComponentFile.test(id)) {
        const cleanId = id.replace(/\?inline$/, '');
        const idParts = cleanId.split('/public/');
        const path = `public/${idParts[idParts.length - 1]}`;
        const html = JSON.stringify(src);
        const result = `const path = '${path}';
const htmlTemplate = ${html};
angular.module('ng').run(['$templateCache', c => { c.put(path, htmlTemplate) }]); export default path;`;
        return { code: result, map: null };
      } else {
        return;
      }
    },
  };
}

/**
 * This is a Vite plugin for moving assets to the build folder.
 * Due to Vite expecting html files to be in the root of the project
 * and the manifest generating paths using the assetDir, we build to a temp folder first
 * then move it to the build folder.
 */

function moveAssets() {
  const assetsLogger = createLogger(undefined, { prefix: '[assets]' });
  return {
    name: 'move-assets',
    async closeBundle() {
      try {
        assetsLogger.info('Moving assets to build folder...', { timestamp: true });
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        const buildPath = resolve(__dirname, 'public/build');
        const buildTmpPath = resolve(__dirname, 'public/build_tmp/public/build');
        await move(buildTmpPath, buildPath, { overwrite: true });
        await remove(resolve(__dirname, 'public/build_tmp'));
      } catch (error) {
        assetsLogger.error('Failed to move assets', { timestamp: true });
        assetsLogger.error(error, { timestamp: true });
        console.error('Failed to move assets', error);
      }
    },
  };
}

/**
 * For a given package, get all deps/dev dependencies that are workspace packages
 * so we can make sure to not optimise them away in the build
 */
function getWorkspaceDependencies(deps: Record<string, string>) {
  const initial: string[] = [];
  return Object.entries(deps).reduce((acc, [name, version]) => {
    if (version.startsWith('workspace:')) {
      acc.push(name);
    }
    return acc;
  }, initial);
}

/**
 * Get a unique list of all workspace dependencies/devDependencies that are linked in to the workspace
 */
function getAllWorkspaceDependencies() {
  const { packages } = getPackagesSync(process.cwd());

  const INITIAL_DEPS: string[] = [];
  const allDeps = packages.reduce((acc, { packageJson }) => {
    return [
      ...acc,
      ...getWorkspaceDependencies(packageJson.dependencies || {}),
      ...getWorkspaceDependencies(packageJson.devDependencies || {}),
    ];
  }, INITIAL_DEPS);

  return [...new Set(allDeps)];
}
