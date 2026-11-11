const { build } = require('esbuild');
const path = require('node:path');

// The opaque-origin frame cannot share Grafana's module runtime or fetch chunks.
module.exports = function textPanelRuntime() {
  const done = this.async();
  build({
    absWorkingDir: this.rootContext,
    entryPoints: [this.resourcePath],
    bundle: true,
    write: false,
    metafile: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
    conditions: ['@grafana-app/source'],
    // UI uses Emotion; unused chart CSS imports from its barrel have no place in this isolated document.
    loader: { '.svg': 'text', '.css': 'empty' },
    define: { 'process.env.NODE_ENV': '"production"' },
  }).then(
    (result) => {
      for (const input of Object.keys(result.metafile.inputs)) {
        this.addDependency(path.resolve(this.rootContext, input));
      }
      done(null, `export default ${JSON.stringify(result.outputFiles[0].text)};`);
    },
    (error) => done(error)
  );
};
