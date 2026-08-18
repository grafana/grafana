import { createServer } from 'http-server';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import open from 'open';
import type { Compiler } from 'webpack';

const STATS_PATH = 'public/build/bundle-stats.html';
const STATS_PATH_FILT = 'public/build/bundle-stats-filtered.html';
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

      await updateReport();

      // Editors often emit several watch events per save.
      let filterTimer: NodeJS.Timeout | undefined;
      fs.watch(import.meta.dirname, (_eventType, filename) => {
        if (filename?.toString() !== STATS_FILTER_FILENAME) {
          return;
        }
        clearTimeout(filterTimer);
        filterTimer = setTimeout(() => void updateReport(), 50);
      });

      const server = createServer({
        root: 'public/build',
        cache: -1,
      });
      server.listen(8080, '127.0.0.1', () => {
        const reportUrl = new URL('/bundle-stats-filtered.html', 'http://127.0.0.1:8080');
        void open(reportUrl.toString());
      });
    });
  }
}

async function updateReport() {
  try {
    if (!FILTER_STATS) {
      fs.copyFileSync(STATS_PATH, STATS_PATH_FILT);
      return;
    }

    const { statsFilter } = await importStatsFilter();
    const includeFilenames = filenamesFromRequestUrls(statsFilter.requestUrls);
    const statsHTML = fs.readFileSync(STATS_PATH, 'utf8');
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

    fs.writeFileSync(STATS_PATH_FILT, filteredStatsHTML);
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
