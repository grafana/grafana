import { lastValueFrom } from 'rxjs';

import {
  dataFrameToJSON,
  type DataFrameJSON,
  type FieldValueEntityLookup,
} from '../../../packages/grafana-data/src/dataframe/DataFrameJSON';
import { setTimeZoneResolver } from '../../../packages/grafana-data/src/datetime/common';
import { standardTransformersRegistry } from '../../../packages/grafana-data/src/transformations/standardTransformersRegistry';
import { transformDataFrame } from '../../../packages/grafana-data/src/transformations/transformDataFrame';
import { standardTransformers } from '../../../packages/grafana-data/src/transformations/transformers';
import { type DataFrame, FieldType } from '../../../packages/grafana-data/src/types/dataFrame';
import {
  type DataTransformerConfig,
  type DataTransformerInfo,
} from '../../../packages/grafana-data/src/types/transformations';
import { getHeatmapTransformer } from '../../../public/app/features/transformers/calculateHeatmap/heatmap';
import { getJoinByLabelsTransformer } from '../../../public/app/features/transformers/joinByLabels/joinByLabels';
import { getPartitionByValuesTransformer } from '../../../public/app/features/transformers/partitionByValues/partitionByValues';
import { getPrepareTimeSeriesTransformer } from '../../../public/app/features/transformers/prepareTimeSeries/prepareTimeSeries';
import { SIDECAR_APP_TRANSFORMATION_IDS } from '../../../public/app/features/transformers/sidecarTransformations';
import { getSmoothingTransformer } from '../../../public/app/features/transformers/smoothing/smoothing';
import { getTimeSeriesTableTransformer } from '../../../public/app/features/transformers/timeSeriesTable/timeSeriesTableTransformer';

export interface TransformRequest {
  frames: DataFrameJSON[];
  transformations: DataTransformerConfig[];
  /** IANA name or "utc". The browser default ("browser") would silently become the sidecar host's zone. */
  timezone?: string;
  vars?: Record<string, string>;
}

export interface TransformResponse {
  frames: DataFrameJSON[];
}

export class BadRequestError extends Error {}

// Transformations registered in public/app/features/transformers rather than @grafana/data. They are
// bundled from there, editors excluded, so the browser and the sidecar run the same code.
const appTransformers: DataTransformerInfo[] = [
  getHeatmapTransformer(),
  getJoinByLabelsTransformer(),
  getPartitionByValuesTransformer(),
  getPrepareTimeSeriesTransformer(),
  getSmoothingTransformer(),
  getTimeSeriesTableTransformer(),
];

const registered = appTransformers.map((info) => info.id).sort();
if (registered.join() !== [...SIDECAR_APP_TRANSFORMATION_IDS].sort().join()) {
  throw new Error(
    `sidecar app transformations [${registered}] do not match SIDECAR_APP_TRANSFORMATION_IDS [${SIDECAR_APP_TRANSFORMATION_IDS}]`
  );
}

// standardTransformers also lists deprecated aliases (seriesToColumns -> joinByField), which the
// registry rejects as duplicate keys.
const transformers = new Map(
  [...Object.values(standardTransformers), ...appTransformers].map((info) => [info.id, info])
);

standardTransformersRegistry.setInit(() =>
  Array.from(transformers.values(), (info) => ({
    id: info.id,
    name: info.name,
    description: info.description,
    defaultOptions: info.defaultOptions,
    transformation: () => Promise.resolve(info),
    // Picker-only fields; nothing headless reads them.
    editor: () => null,
    imageDark: '',
    imageLight: '',
  }))
);

export function supportedTransformations(): string[] {
  return Array.from(transformers.keys()).sort();
}

const VARIABLE_PATTERN = /\$(\w+)|\$\{(\w+)(?::\w+)?\}|\[\[(\w+)(?::\w+)?\]\]/g;

function interpolator(vars: Record<string, string>) {
  return (value: string) =>
    value.replace(VARIABLE_PATTERN, (match, plain, braced, bracketed) => {
      const name = plain ?? braced ?? bracketed;
      // Unknown variables are left as typed, matching the frontend template service.
      return Object.hasOwn(vars, name) ? vars[name] : match;
    });
}

export function parseTransformRequest(body: string): TransformRequest {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch (err) {
    throw new BadRequestError(`invalid JSON: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!isRecord(parsed)) {
    throw new BadRequestError('request body must be an object');
  }
  const { frames, transformations, timezone, vars } = parsed;

  if (!Array.isArray(frames) || !frames.every(isFrameJSON)) {
    throw new BadRequestError('"frames" must be an array of data frame JSON objects');
  }
  if (!Array.isArray(transformations) || !transformations.every(isTransformerConfig)) {
    throw new BadRequestError('"transformations" must be an array of objects with an "id"');
  }
  if (timezone !== undefined && typeof timezone !== 'string') {
    throw new BadRequestError('"timezone" must be a string');
  }
  if (vars !== undefined && !isStringRecord(vars)) {
    throw new BadRequestError('"vars" must be an object of strings');
  }

  // transformDataFrame skips unknown ids, which would make a backend consumer silently get
  // untransformed data instead of an unsupported-operation error.
  const unsupported = transformations.map((t) => t.id).filter((id) => !transformers.has(id));
  if (unsupported.length) {
    throw new BadRequestError(`unsupported transformations: ${unsupported.join(', ')}`);
  }

  return { frames, transformations, timezone, vars };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFrameJSON(value: unknown): value is DataFrameJSON {
  return isRecord(value) && isRecord(value.schema);
}

function isTransformerConfig(value: unknown): value is DataTransformerConfig {
  return isRecord(value) && typeof value.id === 'string';
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((v) => typeof v === 'string');
}

/** Runs transformations over in-memory frames, the way a panel does. */
export async function transformFrames(
  frames: DataFrame[],
  transformations: DataTransformerConfig[],
  { timezone = 'utc', vars = {} }: { timezone?: string; vars?: Record<string, string> } = {}
): Promise<DataFrame[]> {
  // Safe as a module-level setting because each worker runs one request at a time.
  setTimeZoneResolver(() => timezone);
  return lastValueFrom(transformDataFrame(transformations, frames, { interpolate: interpolator(vars) }));
}

/** Milliseconds spent in each stage of a request, reported in the Server-Timing header. */
export type StageTimings = Record<string, number>;

interface GoFieldType {
  goType: string;
  matches: (value: unknown) => boolean;
}

const isNumber = (value: unknown) => typeof value === 'number';

const GO_FIELD_TYPES: Partial<Record<FieldType, GoFieldType>> = {
  [FieldType.number]: { goType: 'float64', matches: isNumber },
  [FieldType.string]: { goType: 'string', matches: (value) => typeof value === 'string' },
  [FieldType.boolean]: { goType: 'bool', matches: (value) => typeof value === 'boolean' },
  [FieldType.time]: { goType: 'time.Time', matches: isNumber },
  [FieldType.enum]: { goType: 'enum', matches: isNumber },
};

/**
 * Encodes a frame for Go's data.Frame decoder, which dataFrameToJSON alone does not satisfy:
 *
 * - typeInfo picks each field's Go type, and the decoder panics without it. Every field is
 *   nullable because transformations introduce nulls (outer joins, empty groups). Integer fields
 *   come back as float64, since JS numbers carry no width.
 * - A field whose values don't all match its declared type (groupingToMatrix fills number fields
 *   with "") is sent as raw JSON, which the decoder accepts for any value.
 * - NaN and ±Inf are written as entities. dataFrameToJSON drops them, and JSON.stringify turns them
 *   into null. undefined is not written: Go has no value for it and would read null either way.
 */
export function toGoFrameJSON(frame: DataFrame): DataFrameJSON {
  const json = dataFrameToJSON(frame);
  if (!json.schema) {
    return json;
  }

  const entities: Array<FieldValueEntityLookup | null> = [];
  const fields = json.schema.fields.map((schemaField, i) => {
    const values = frame.fields[i].values;
    const goField = schemaField.type && GO_FIELD_TYPES[schemaField.type];
    const typed = goField && values.every((v) => v === null || v === undefined || goField.matches(v));
    entities.push(typed && goField.matches === isNumber ? nonFiniteEntities(values) : null);
    return { ...schemaField, typeInfo: { frame: typed ? goField.goType : 'json.RawMessage', nullable: true } };
  });

  return {
    schema: { ...json.schema, fields },
    data: { values: [], ...json.data, ...(entities.some(Boolean) && { entities }) },
  };
}

function nonFiniteEntities(values: unknown[]): FieldValueEntityLookup | null {
  const lookup: FieldValueEntityLookup = {};
  values.forEach((value, i) => {
    if (typeof value !== 'number' || Number.isFinite(value)) {
      return;
    }
    const key = Number.isNaN(value) ? 'NaN' : value > 0 ? 'Inf' : 'NegInf';
    (lookup[key] ??= []).push(i);
  });
  return Object.keys(lookup).length ? lookup : null;
}
