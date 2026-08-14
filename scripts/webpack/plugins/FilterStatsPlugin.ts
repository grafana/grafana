import fs from 'fs';
import type { Compiler } from 'webpack';

const STATS_PATH = 'public/build/bundle-stats.html';
const STATS_PATH_FILT = 'public/build/bundle-stats-filtered.html';

interface BundleNode {
  label: string;
  parsedSize: number;
  groups?: BundleNode[];
}

export class FilterStatsPlugin {
  // exclusion regexp
  exclude: RegExp | null = null;

  // we should only filter out bundles where the matched descendent occupies more than 75% of the bundle's size
  // this way we don't ignore a composite bundle when some previously-decoupled & excluded component accidentally moves into it
  minDominance = 0.75;

  constructor({ exclude = null, minDominance = 0.75 }: { exclude?: RegExp | null; minDominance?: number } = {}) {
    this.exclude = exclude;
    this.minDominance = minDominance;
  }

  apply(compiler: Compiler) {
    compiler.hooks.done.tap('FilterStatsPlugin', () => {
      if (this.exclude == null) {
        fs.copyFileSync(STATS_PATH, STATS_PATH_FILT);
      } else {
        const exclude = this.exclude;
        const statsHTML = fs.readFileSync(STATS_PATH, 'utf8');
        const filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (_, head, data, tail) => {
          const nodes: BundleNode[] = JSON.parse(data);
          const filtered = nodes.filter((node) => !this.pathContains(node, node.parsedSize, exclude));
          return head + JSON.stringify(filtered) + tail;
        });

        fs.writeFileSync(STATS_PATH_FILT, filteredStatsHTML);
      }
    });
  }

  pathContains(node: BundleNode, rootParsedSize: number, exclude: RegExp): boolean {
    if (node.parsedSize / rootParsedSize >= this.minDominance) {
      if (exclude.test(node.label)) {
        return true;
      }

      if (node.groups != null) {
        for (let i = 0; i < node.groups.length; i++) {
          if (this.pathContains(node.groups[i], rootParsedSize, exclude)) {
            return true;
          }
        }
      }
    }

    return false;
  }
}
