const fs = require('fs');
const os = require('os');
const path = require('path');
const webpack = require('webpack');

const iconsBundleGenerator = require('../../../packages/grafana-ui/scripts/generate-icon-bundle');
const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-bundle'));
const tempFile = path.join(workingDir, 'icons-bundle-generated.ts');

console.log(tempFile);

function IconsBundleGenerator() {
  const iconsBundleFile = iconsBundleGenerator(tempFile);
  return new webpack.NormalModuleReplacementPlugin(/iconBundle\.ts/, iconsBundleFile);
}

module.exports = IconsBundleGenerator;
