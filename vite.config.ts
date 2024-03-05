import react from '@vitejs/plugin-react-swc';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// https://vitejs.dev/config/
export default defineConfig({
  root: './public',
  build: {
    // use manifest for backend integration in production
    manifest: true,
    rollupOptions: {
      input: ['./public/app/index.ts', './public/sass/grafana.dark.scss', './public/sass/grafana.light.scss'],
    },
    outDir: './build',
    assetsDir: './assets',
  },
  server: {
    // vite binds to ipv6 by default... and that doesn't work for me locally on mac...
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [react(), angularHtmlImport()],
  optimizeDeps: {
    // fixes for dependencies that don't support esm
    include: ['jquery'],
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
});

/**
This is a Vite plugin for handling angular templates.
https://vitejs.dev/guide/api-plugin.html#simple-examples
 
The webpack output from https://github.com/WearyMonkey/ngtemplate-loader looks like this:
var code = "\n<div class=\"graph-annotation\">\n\t<div class=\"graph-annotation__header\">\n\t\t</div></div>\n";
Exports
var _module_exports =code;;
var path = 'public/app/features/annotations/partials/event_editor.html';
window.angular.module('ng').run(['$templateCache', function(c) { c.put(path, _module_exports) }]);
module.exports = path;
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
