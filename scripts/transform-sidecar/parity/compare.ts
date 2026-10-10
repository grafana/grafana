/**
 * Compares, for each fixture written by TestTransformParityFixtures (pkg/expr), what a panel sees
 * today with what it would see if the transformations ran in the sidecar:
 *
 *   browser: Go frame JSON -> dataFrameFromJSON -> transformDataFrame
 *   sidecar: Go frame JSON -> transform expression -> sidecar -> Go -> frame JSON -> dataFrameFromJSON
 *
 * Usage: node dist/parity-compare.cjs <fixture output dir>
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dataFrameFromJSON, type DataFrameJSON } from '../../../packages/grafana-data/src/dataframe/DataFrameJSON';
import { isDataFrame } from '../../../packages/grafana-data/src/dataframe/processDataFrame';
import { type DataFrame } from '../../../packages/grafana-data/src/types/dataFrame';
import { type DataTransformerConfig } from '../../../packages/grafana-data/src/types/transformations';
import { transformFrames } from '../src/transform';

interface FixtureRecord {
  name: string;
  transformations: DataTransformerConfig[];
  timezone?: string;
  input: DataFrameJSON[];
  output?: DataFrameJSON[] | null;
  error?: string;
}

type Status = 'match' | 'diff' | 'sidecar-error' | 'browser-error';

interface Result {
  name: string;
  status: Status;
  /** Path to the first difference, and both values there. */
  firstDiff?: Diff;
  /** Number of differing values; one wrong field type can account for many. */
  diffCount?: number;
  /** The browser output equals its input, which usually means the fixture's options are wrong. */
  unchanged?: boolean;
  refIds?: { browser: unknown[]; sidecar: unknown[] };
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFixtureRecord(value: unknown): value is FixtureRecord {
  return (
    isRecord(value) &&
    typeof value.name === 'string' &&
    Array.isArray(value.transformations) &&
    Array.isArray(value.input)
  );
}

// JSON.stringify would turn undefined, NaN and ±Inf into null and hide exactly the differences
// this comparison exists to find, so values are tagged instead.
function dumpValue(value: unknown): unknown {
  if (value === undefined) {
    return '$undefined';
  }
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return '$NaN';
    }
    if (!Number.isFinite(value)) {
      return value > 0 ? '$+Inf' : '$-Inf';
    }
    return value;
  }
  if (isDataFrame(value)) {
    return dumpFrame(value);
  }
  if (Array.isArray(value)) {
    return value.map(dumpValue);
  }
  if (isRecord(value)) {
    return dumpObject(value);
  }
  return value;
}

// Missing keys, undefined keys, and empty objects are treated as equal: a panel can't tell them apart.
function dumpObject(obj: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!obj) {
    return undefined;
  }
  const entries = Object.keys(obj)
    .sort()
    .map((key): [string, unknown] => [key, obj[key] === undefined ? undefined : dumpValue(obj[key])])
    .filter(([, v]) => v !== undefined && !(isRecord(v) && Object.keys(v).length === 0));
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function dumpMeta(meta: DataFrame['meta']) {
  // Go writes typeVersion [0, 0] whenever a frame has meta; it means the same as no version.
  const { typeVersion, ...rest } = meta ?? {};
  const isDefaultVersion = typeVersion?.[0] === 0 && typeVersion?.[1] === 0;
  return dumpObject(isDefaultVersion ? rest : { ...rest, typeVersion });
}

function dumpFrame(frame: DataFrame) {
  return {
    name: frame.name,
    length: frame.length,
    meta: dumpMeta(frame.meta),
    fields: frame.fields.map((field) => ({
      name: field.name,
      type: field.type,
      labels: dumpObject(field.labels),
      config: dumpObject({ ...field.config }),
      values: Array.from(field.values, dumpValue),
    })),
  };
}

interface Diff {
  path: string;
  browser: unknown;
  sidecar: unknown;
}

function collectDiffs(a: unknown, b: unknown, path: string, out: Diff[]) {
  if (Array.isArray(a) && Array.isArray(b)) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      collectDiffs(a[i], b[i], `${path}[${i}]`, out);
    }
  } else if (isRecord(a) && isRecord(b)) {
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
      collectDiffs(a[key], b[key], path ? `${path}.${key}` : key, out);
    }
  } else if (!Object.is(a, b)) {
    out.push({ path: path || '(root)', browser: a, sidecar: b });
  }
}

function diffs(a: unknown, b: unknown): Diff[] {
  const out: Diff[] = [];
  collectDiffs(a, b, '', out);
  return out;
}

// Field paths are easier to read by name than by index.
function describePath(path: string, dump: unknown): string {
  const match = /^\[(\d+)\]\.fields\[(\d+)\](.*)$/.exec(path);
  if (!match || !Array.isArray(dump)) {
    return path;
  }
  const frame = dump[Number(match[1])];
  const fields = isRecord(frame) && Array.isArray(frame.fields) ? frame.fields : [];
  const field = fields[Number(match[2])];
  const name = isRecord(field) ? String(field.name) : match[2];
  return `frame[${match[1]}].${name}${match[3]}`;
}

async function compare(record: FixtureRecord): Promise<Result> {
  const result: Result = { name: record.name, status: 'match' };

  let browser: DataFrame[];
  try {
    browser = await transformFrames(
      record.input.map((f) => dataFrameFromJSON(f)),
      record.transformations,
      {
        timezone: record.timezone || 'utc',
      }
    );
  } catch (err) {
    return { ...result, status: 'browser-error', error: err instanceof Error ? err.message : String(err) };
  }

  if (record.error || !record.output) {
    return { ...result, status: 'sidecar-error', error: record.error ?? 'no output' };
  }
  const sidecar = record.output.map((f) => dataFrameFromJSON(f));

  const browserDump = browser.map(dumpFrame);
  const found = diffs(browserDump, sidecar.map(dumpFrame));
  if (found.length) {
    result.status = 'diff';
    result.firstDiff = { ...found[0], path: describePath(found[0].path, browserDump) };
    result.diffCount = found.length;
  }

  const inputDump = record.input.map((f) => dumpFrame(dataFrameFromJSON(f)));
  const noop = record.transformations.every((t) => t.id === 'noop');
  if (!noop && diffs(inputDump, browserDump).length === 0) {
    result.unchanged = true;
  }

  // The expression's refId replaces the frames' refIds by design, so it is reported, not compared.
  result.refIds = { browser: browser.map((f) => f.refId), sidecar: sidecar.map((f) => f.refId) };
  return result;
}

function short(value: unknown): string {
  const text = JSON.stringify(value) ?? String(value);
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    throw new Error('usage: node dist/parity-compare.cjs <fixture output dir>');
  }

  const files = readdirSync(dir)
    .filter((f) => f.endsWith('.json') && f !== 'report.json')
    .sort();
  const results: Result[] = [];
  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (!isFixtureRecord(parsed)) {
      throw new Error(`${file} is not a fixture record`);
    }
    results.push(await compare(parsed));
  }

  writeFileSync(join(dir, 'report.json'), JSON.stringify(results, null, 2));

  const lines = ['| Fixture | Result | First difference (browser → sidecar) |', '| --- | --- | --- |'];
  for (const r of results) {
    const status = r.unchanged ? `${r.status} ⚠ unchanged` : r.status;
    const detail = r.firstDiff
      ? `\`${r.firstDiff.path}\`: ${short(r.firstDiff.browser)} → ${short(r.firstDiff.sidecar)} (${r.diffCount} total)`
      : (r.error ?? '');
    lines.push(`| ${r.name} | ${status} | ${detail.replaceAll('|', '\\|')} |`);
  }
  const counts = results.reduce<Record<string, number>>(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }),
    {}
  );
  lines.push(
    '',
    Object.entries(counts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  );
  process.stdout.write(lines.join('\n') + '\n');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});
