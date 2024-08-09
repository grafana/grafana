import react from '@vitejs/plugin-react-swc';
import { move, remove } from 'fs-extra';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { visualizer } from 'rollup-plugin-visualizer';
import { defineConfig, splitVendorChunkPlugin, type PluginOption } from 'vite';
import EnvironmentPlugin from 'vite-plugin-environment';

const require = createRequire(import.meta.url);
const shouldMinify = process.env.NO_MINIFY === '1' ? false : 'esbuild';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  root: 'public',
  build: {
    // use manifest for backend integration in production
    manifest: 'public/build/.vite/manifest.json',
    rollupOptions: {
      input: ['./public/app/index.ts', './public/sass/grafana.dark.scss', './public/sass/grafana.light.scss'],
    },
    outDir: 'build_tmp',
    assetsDir: 'public/build',
    minify: shouldMinify,
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
    }),
    { ...moveAssets(), apply: 'build' },
    { ...visualizer(), apply: 'build' } as PluginOption,
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
  return {
    name: 'move-assets',
    async closeBundle() {
      try {
        console.log('Moving assets to build folder...');
        const __dirname = fileURLToPath(new URL('.', import.meta.url));
        const buildPath = resolve(__dirname, 'public/build');
        const buildTmpPath = resolve(__dirname, 'public/build_tmp/public/build');
        await move(buildTmpPath, buildPath, { overwrite: true });
        await remove(resolve(__dirname, 'public/build_tmp'));
      } catch (error) {
        console.error('Failed to move assets', error);
      }
    },
  };
}
