const { RsdoctorWebpackPlugin } = require('@rsdoctor/webpack-plugin');
const fs = require('fs');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const { merge } = require('webpack-merge');

function pathContains(node, regexp) {
  if (regexp.test(node.label)) { return true; }

  if (node.groups != null) {
    for (let i = 0; i < node.groups.length; i++) {
      if (pathContains(node.groups[i], regexp)) { return true; }
    }
  }

  return false;
}

const prodConfig = require('./webpack.prod.js');

const excludeRegExp = /@kusto|monaco-editor|public\/locales/;

class FilterStats {
  apply(compiler) {
    compiler.hooks.done.tap('FilterStats', (stats) => {

      let statsHTML = fs.readFileSync('public/build/bundle-stats.html', 'utf8');
      let filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (m, head, data, tail) => {
        let nodes = JSON.parse(data);
        let filtered = nodes.filter(node => !pathContains(node, excludeRegExp));
        return head + JSON.stringify(filtered) + tail;
      });

      fs.writeFileSync('public/build/bundle-stats-filtered.html', filteredStatsHTML);
    });
  }
}

module.exports = (env = {}) => {
  const config = {
    plugins: [
      new BundleAnalyzerPlugin({
        analyzerMode: 'static',
        reportFilename: 'bundle-stats.html',
        openAnalyzer: false,
        generateStatsFile: false,
      }),
      new FilterStats(),
    ]
  };

  // yarn build:stats --env doctor
  if (env.doctor) {
    config.plugins.push(
      new RsdoctorWebpackPlugin({
        supports: {
          // disable rsdoctor bundle-analyser
          generateTileGraph: false,
        },
      })
    );
  }

  // disable hashing in output filenames to make them easier to identify
  // yarn build:stats --env doctor --env namedChunks
  if (env.namedChunks) {
    config.optimization = {
      chunkIds: 'named',
    };
    config.output = {
      filename: '[name].js',
      chunkFilename: '[name].js',
    };
  }

  return merge(prodConfig(env), config);
};
