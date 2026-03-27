const fs = require('fs');

const STATS_PATH = 'public/build/bundle-stats.html';
const STATS_PATH_FILT = 'public/build/bundle-stats-filtered.html';

class FilterStatsPlugin {
  // exclusion regexp
  exclude = null;

  // we should only filter out bundles where the matched descendent occupies more than 75% of the bundle's size
  // this way we don't ignore a composite bundle when some previously-decoupled & excluded component accidentally moves into it
  minDominance = 0.75;

  constructor({ exclude = null, minDominance = 0.75 }) {
    this.exclude = exclude;
    this.minDominance = minDominance;
  }
  apply(compiler) {
    compiler.hooks.done.tap('FilterStatsPlugin', () => {
      if (this.exclude == null) {
        fs.copyFileSync(STATS_PATH, STATS_PATH_FILT);
      } else {
        let statsHTML = fs.readFileSync(STATS_PATH, 'utf8');
        let filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (m, head, data, tail) => {
          let nodes = JSON.parse(data);
          let filtered = nodes.filter((node) => !this.pathContains(node, node.parsedSize));
          return head + JSON.stringify(filtered) + tail;
        });

        fs.writeFileSync(STATS_PATH_FILT, filteredStatsHTML);
      }
    });
  }
  pathContains(node, rootParsedSize) {
    if (node.parsedSize / rootParsedSize >= this.minDominance) {
      if (this.exclude.test(node.label)) {
        return true;
      }

      if (node.groups != null) {
        for (let i = 0; i < node.groups.length; i++) {
          if (this.pathContains(node.groups[i], rootParsedSize)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}

exports.FilterStatsPlugin = FilterStatsPlugin;
