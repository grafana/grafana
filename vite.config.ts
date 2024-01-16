import react from '@vitejs/plugin-react-swc';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const require = createRequire(import.meta.url);

// This is a Vite plugin for handling angular templates.
// https://vitejs.dev/guide/api-plugin.html#simple-examples

// The webpack output from https://github.com/WearyMonkey/ngtemplate-loader looks like this:
// var code = "\n<div class=\"graph-annotation\">\n\t<div class=\"graph-annotation__header\">\n\t\t<div class=\"graph-annotation__user\" bs-tooltip=\"'Created by {{ctrl.login}}'\">\n\t\t</div>\n\n\t\t<div class=\"graph-annotation__title\">\n\t\t\t<span ng-if=\"!ctrl.event.id\">Add annotation</span>\n\t\t\t<span ng-if=\"ctrl.event.id\">Edit annotation</span>\n\t\t</div>\n\n    <div class=\"graph-annotation__time\">{{ctrl.timeFormated}}</div>\n\t</div>\n\n\t<form name=\"ctrl.form\" class=\"graph-annotation__body text-center\">\n\t\t<div style=\"display: inline-block\">\n\t\t\t<div class=\"gf-form gf-form--v-stretch\">\n\t\t\t\t<span class=\"gf-form-label width-7\">Description</span>\n\t\t\t\t<textarea class=\"gf-form-input width-20\" rows=\"2\" ng-model=\"ctrl.event.text\" placeholder=\"Description\"></textarea>\n\t\t\t</div>\n\n\t\t\t<div class=\"gf-form\">\n\t\t\t\t<span class=\"gf-form-label width-7\">Tags</span>\n\t\t\t\t<bootstrap-tagsinput ng-model=\"ctrl.event.tags\" tagclass=\"label label-tag\" placeholder=\"add tags\">\n\t\t\t\t</bootstrap-tagsinput>\n\t\t\t</div>\n\n\t\t\t<div class=\"gf-form-button-row\">\n\t\t\t\t<button type=\"submit\" class=\"btn btn-primary\" ng-click=\"ctrl.save()\">Save</button>\n\t\t\t\t<button ng-if=\"ctrl.event.id && ctrl.canDelete()\" type=\"submit\" class=\"btn btn-danger\" ng-click=\"ctrl.delete()\">Delete</button>\n\t\t\t\t<a class=\"btn-text\" ng-click=\"ctrl.close();\">Cancel</a>\n\t\t\t</div>\n\t\t</div>\n\t</form>\n</div>\n";
// Exports
// var _module_exports =code;;
// var path = 'public/app/features/annotations/partials/event_editor.html';
// window.angular.module('ng').run(['$templateCache', function(c) { c.put(path, _module_exports) }]);
// module.exports = path;
function angularHtmlImport() {
  return {
    name: 'transform-angular-html',
    transform(src, id) {
      if (/^.*\.html$/g.test(id)) {
        const result = `let path = '${id}'; angular.module('ng').run(['$templateCache', c => { c.put(path, \`${src}\`) }]); export default path;`;
        return { code: result, map: null };
      }
    },
  };
}

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
  },
  server: {
    // vite binds to ipv6 by default... and that doesn't work for me locally on mac...
    host: '0.0.0.0',
    port: 5173,
  },
  plugins: [react(), angularHtmlImport()],
  optimizeDeps: {
    // fix for $ is not a function
    exclude: ['jquery'],
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
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json'],
  },
});
