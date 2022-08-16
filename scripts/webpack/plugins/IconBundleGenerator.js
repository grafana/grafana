const fs = require('fs');
const os = require('os');
const path = require('path');
const webpack = require('webpack');

const iconsBundleGenerator = require('../../../packages/grafana-ui/scripts/generate-icon-bundle');
const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-bundle'));
const tempFile = path.join(workingDir, 'icons-bundle-generated.ts');

function IconsBundleGenerator() {
  const iconsBundleFile = iconsBundleGenerator({ outputPath: tempFile, verbose: false });
  return new webpack.NormalModuleReplacementPlugin(/iconBundle\.ts/, iconsBundleFile);
}

module.exports = IconsBundleGenerator;
