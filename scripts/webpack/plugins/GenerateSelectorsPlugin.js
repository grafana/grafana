const { execSync } = require('child_process');
const pluginName = 'GenerateSelectorsPlugin';
const versionedSelectorsPath = 'packages/grafana-e2e-selectors/src/selectors';
const cmd = 'yarn generate-e2e-selectors';

class GenerateSelectorsPlugin {
  apply(compiler) {
    compiler.hooks.watchRun.tap(pluginName, (comp) => {
      if (comp.modifiedFiles) {
        const changedFiles = [...comp.modifiedFiles];
        if (changedFiles.some((file) => file.includes(versionedSelectorsPath))) {
          console.log('Regenerating e2e selectors...');
          try {
            const stdout = execSync(cmd, { encoding: 'utf-8' });
            console.log(stdout);
          } catch (e) {
            console.error(e);
          }
        }
      }
    });
  }
}

module.exports = GenerateSelectorsPlugin;
