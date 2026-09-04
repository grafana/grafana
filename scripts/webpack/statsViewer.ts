import { createServer } from 'http-server';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import open from 'open';
import type { Compiler } from 'webpack';

const STATS_FILENAME = 'bundle-stats.html';
const STATS_FILENAME_FILT = 'bundle-stats-filtered.html';
const STATS_FILTER_FILENAME = 'statsFilter.ts';
const STATS_FILTER_PATH = path.join(import.meta.dirname, STATS_FILTER_FILENAME);

const FILTER_STATS = process.env.SMOLSTATS === '1';

interface BundleNode {
  label: string;
  parsedSize: number;
  groups?: BundleNode[];
}

interface StatsFilter {
  exclude: RegExp | null;
  minDominance: number;
  requestUrls: string;
}

export class StatsViewerPlugin {
  apply(compiler: Compiler) {
    compiler.hooks.done.tapPromise('StatsViewerPlugin', async (stats) => {
      if (stats.hasErrors()) {
        return;
      }

      // BundleAnalyzerPlugin writes its report into the compilation output directory, so
      // read that rather than being told where it is. `outputPath` is only assigned once
      // every plugin has been applied, which is why it is read here and not in `apply`.
      const { outputPath } = compiler;
      const statsPath = path.join(outputPath, STATS_FILENAME);
      const statsPathFilt = path.join(outputPath, STATS_FILENAME_FILT);

      await updateReport(statsPath, statsPathFilt);

      // Editors often emit several watch events per save.
      let filterTimer: NodeJS.Timeout | undefined;
      fs.watch(import.meta.dirname, (_eventType, filename) => {
        if (filename?.toString() !== STATS_FILTER_FILENAME) {
          return;
        }
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => void updateReport(statsPath, statsPathFilt), 50);
      });

      const server = createServer({
        root: outputPath,
        cache: -1,
      });
      server.listen(8080, '127.0.0.1', () => {
        const reportUrl = new URL(`/${STATS_FILENAME_FILT}`, 'http://127.0.0.1:8080');
        void open(reportUrl.toString());
      });
    });
  }
}

async function updateReport(statsPath: string, statsPathFilt: string) {
  try {
    if (!FILTER_STATS) {
      fs.copyFileSync(statsPath, statsPathFilt);
      return;
    }

    const { statsFilter } = await importStatsFilter();
    const includeFilenames = filenamesFromRequestUrls(statsFilter.requestUrls);
    const statsHTML = fs.readFileSync(statsPath, 'utf8');
    const filteredStatsHTML = statsHTML.replace(/(window.chartData = )(\[.*?\])(;)/, (_, head, data, tail) => {
      const nodes: BundleNode[] = JSON.parse(data);
      const { exclude, minDominance } = statsFilter;
      let filtered = nodes;

      if (exclude != null) {
        filtered = filtered.filter((node) => !pathContains(node, node.parsedSize, exclude, minDominance));
      }

      if (includeFilenames.size > 0) {
        filtered = filtered.filter((node) => includeFilenames.has(lastSegment(node.label)));
      }

      return head + JSON.stringify(filtered) + tail;
    });

    fs.writeFileSync(statsPathFilt, filteredStatsHTML);
  } catch (err) {
    console.error(err);
  }
}

async function importStatsFilter(): Promise<{ statsFilter: StatsFilter }> {
  const url = pathToFileURL(STATS_FILTER_PATH);
  url.searchParams.set('t', String(Date.now()));
  return import(url.href);
}

function lastSegment(s: string): string {
  return s.slice(s.lastIndexOf('/') + 1);
}

function filenamesFromRequestUrls(urls: string): Set<string> {
  return new Set(
    urls
      .split('\n')
      .map((line) => lastSegment(line.trim().replace(/\?.*$/, '')))
      .filter((name) => name)
  );
}

function pathContains(node: BundleNode, rootParsedSize: number, exclude: RegExp, minDominance: number): boolean {
  if (node.parsedSize / rootParsedSize >= minDominance) {
    if (exclude.test(node.label)) {
      return true;
    }

    if (node.groups != null) {
      for (let i = 0; i < node.groups.length; i++) {
        if (pathContains(node.groups[i], rootParsedSize, exclude, minDominance)) {
          return true;
        }
      }
    }
  }

  return false;
}
