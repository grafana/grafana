/**
 * Browser-side baseline for TestTransformSidecarBenchmark (pkg/expr), plus the combined report.
 *
 * For each workload it times what a panel does today (parse the data source response, decode the
 * frames, run the transformations), and what it would do with a backend transform (parse and decode
 * the already-transformed response). It then merges these with the Go results into report.md.
 *
 * Usage: node dist/bench-browser.cjs <bench output dir> [iterations]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dataFrameFromJSON, type DataFrameJSON } from '../../../packages/grafana-data/src/dataframe/DataFrameJSON';
import { type DataTransformerConfig } from '../../../packages/grafana-data/src/types/transformations';
import { transformFrames } from '../src/transform';

interface GoResult {
  name: string;
  format: string;
  requestBytes: number;
  responseBytes: number;
  nativeLabel?: string;
  median: {
    goEncodeMs: number;
    sidecarHttpMs: number;
    sidecarStagesMs: Record<string, number>;
    goDecodeMs: number;
    pipelineMs: number;
    nativeMs?: number;
  };
  concurrency: { requests: number; p50Ms: number; p99Ms: number; maxRssBytes: number; errorsOrBusy: number };
}

interface BrowserResult {
  inputBytes: number;
  outputBytes: number;
  parseMs: number;
  decodeMs: number;
  transformMs: number;
  outputParseDecodeMs: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseInput(text: string): { transformations: DataTransformerConfig[]; input: DataFrameJSON[] } {
  const parsed: unknown = JSON.parse(text);
  if (!isRecord(parsed) || !Array.isArray(parsed.transformations) || !Array.isArray(parsed.input)) {
    throw new Error('not a benchmark input record');
  }
  return { transformations: parsed.transformations, input: parsed.input };
}

function parseFrames(text: string): DataFrameJSON[] {
  const parsed: unknown = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error('expected an array of frames');
  }
  return parsed;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function time<T>(fn: () => T): [T, number] {
  const start = performance.now();
  const value = fn();
  return [value, performance.now() - start];
}

async function measure(dir: string, name: string, iterations: number): Promise<BrowserResult> {
  const inputText = readFileSync(join(dir, `${name}.input.json`), 'utf8');
  const outputText = readFileSync(join(dir, `${name}.output.json`), 'utf8');
  const runs: BrowserResult[] = [];

  // The first run warms up V8.
  for (let i = 0; i <= iterations; i++) {
    // Parse fresh each time: dataFrameFromJSON decodes values in place.
    const [record, parseMs] = time(() => parseInput(inputText));
    const [frames, decodeMs] = time(() => record.input.map((f) => dataFrameFromJSON(f)));
    const start = performance.now();
    await transformFrames(frames, record.transformations);
    const transformMs = performance.now() - start;
    const [, outputParseDecodeMs] = time(() => parseFrames(outputText).map((f) => dataFrameFromJSON(f)));

    if (i > 0) {
      runs.push({
        inputBytes: inputText.length,
        outputBytes: outputText.length,
        parseMs,
        decodeMs,
        transformMs,
        outputParseDecodeMs,
      });
    }
  }

  return {
    inputBytes: inputText.length,
    outputBytes: outputText.length,
    parseMs: median(runs.map((r) => r.parseMs)),
    decodeMs: median(runs.map((r) => r.decodeMs)),
    transformMs: median(runs.map((r) => r.transformMs)),
    outputParseDecodeMs: median(runs.map((r) => r.outputParseDecodeMs)),
  };
}

const ms = (v: number | undefined) => (v === undefined ? '—' : v < 10 ? v.toFixed(1) : Math.round(v).toString());
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

function report(goResults: GoResult[], browser: Map<string, BrowserResult>): string {
  const lines: string[] = [];
  const names = [...new Set(goResults.map((g) => g.name))];
  const find = (name: string, format: string) => goResults.find((g) => g.name === name && g.format === format);

  lines.push(
    '### Where the time goes (median ms)',
    '',
    '| Workload | Browser today: parse + decode + transform | Sidecar pipeline, JSON | Sidecar pipeline, Arrow | Browser with sidecar: parse + decode result | Native Go expression |',
    '| --- | --- | --- | --- | --- | --- |'
  );
  for (const name of names) {
    const b = browser.get(name);
    const json = find(name, 'json');
    const arrow = find(name, 'arrow');
    const today = b
      ? `${ms(b.parseMs + b.decodeMs + b.transformMs)} (${ms(b.parseMs)} + ${ms(b.decodeMs)} + ${ms(b.transformMs)})`
      : '—';
    const native = json?.median.nativeMs ? `${ms(json.median.nativeMs)} (${json.nativeLabel})` : '—';
    lines.push(
      `| ${name} | ${today} | ${ms(json?.median.pipelineMs)} | ${ms(arrow?.median.pipelineMs)} | ${ms(b?.outputParseDecodeMs)} | ${native} |`
    );
  }

  const stages = ['read', 'queue', 'parse', 'decode', 'transform', 'encode', 'stringify'];
  lines.push(
    '',
    '### Sidecar call breakdown (median ms)',
    '',
    `| Workload | Format | Go encode | ${stages.join(' | ')} | HTTP total | Go decode |`,
    `| --- | --- | --- | ${stages.map(() => '---').join(' | ')} | --- | --- |`
  );
  for (const g of goResults) {
    const s = g.median.sidecarStagesMs;
    lines.push(
      `| ${g.name} | ${g.format} | ${ms(g.median.goEncodeMs)} | ${stages.map((st) => ms(s[st])).join(' | ')} | ${ms(g.median.sidecarHttpMs)} | ${ms(g.median.goDecodeMs)} |`
    );
  }

  lines.push(
    '',
    '### Payload and load',
    '',
    '| Workload | Format | Request | Response | 10 parallel × 3: p50 ms | p99 ms | failed | Peak sidecar RSS |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |'
  );
  for (const g of goResults) {
    const c = g.concurrency;
    lines.push(
      `| ${g.name} | ${g.format} | ${mb(g.requestBytes)} | ${mb(g.responseBytes)} | ${ms(c.p50Ms)} | ${ms(c.p99Ms)} | ${c.errorsOrBusy} | ${mb(c.maxRssBytes)} |`
    );
  }
  return lines.join('\n') + '\n';
}

async function main() {
  const [dir, iterationsArg] = process.argv.slice(2);
  if (!dir) {
    throw new Error('usage: node dist/bench-browser.cjs <bench output dir> [iterations]');
  }
  const iterations = Number(iterationsArg) || 5;

  const parsed: unknown = JSON.parse(readFileSync(join(dir, 'results.json'), 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('results.json is not an array');
  }
  const goResults: GoResult[] = parsed;

  const browser = new Map<string, BrowserResult>();
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.input.json'))) {
    const name = file.replace(/\.input\.json$/, '');
    browser.set(name, await measure(dir, name, iterations));
  }

  const text = report(goResults, browser);
  writeFileSync(join(dir, 'report.md'), text);
  process.stdout.write(text);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
