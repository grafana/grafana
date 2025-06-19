// @ts-check

const fs = require('fs');
const path = require('path');

const PLUGIN_TYPES = ['datasource', 'panel'];

/** @returns {Array<{type: string, name: string}>} */
function getNonDecoupledPlugins() {
  const pluginsSrcDir = path.resolve(__dirname, '../../../public/app/plugins');

  const nonDecoupledPlugins = [];

  for (const pluginType of PLUGIN_TYPES) {
    const pluginTypeDir = path.join(pluginsSrcDir, pluginType);

    const plugins = fs.readdirSync(pluginTypeDir);

    for (const plugin of plugins) {
      const pluginPath = path.join(pluginTypeDir, plugin);
      const packageJsonPath = path.join(pluginPath, 'package.json');

      if (fs.statSync(pluginPath).isDirectory() && !fs.existsSync(packageJsonPath)) {
        nonDecoupledPlugins.push({
          type: pluginType,
          name: plugin,
        });
      }
    }
  }

  return nonDecoupledPlugins;
}

module.exports = {
  getNonDecoupledPlugins,
};
