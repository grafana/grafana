import { lastValueFrom } from 'rxjs';

import {
  dataFrameFromJSON,
  dataFrameToJSON,
  type DataFrameJSON,
} from '../../../packages/grafana-data/src/dataframe/DataFrameJSON';
import { setTimeZoneResolver } from '../../../packages/grafana-data/src/datetime/common';
import { standardTransformersRegistry } from '../../../packages/grafana-data/src/transformations/standardTransformersRegistry';
import { transformDataFrame } from '../../../packages/grafana-data/src/transformations/transformDataFrame';
import { standardTransformers } from '../../../packages/grafana-data/src/transformations/transformers';
import { type DataTransformerConfig } from '../../../packages/grafana-data/src/types/transformations';

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

// standardTransformers also lists deprecated aliases (seriesToColumns -> joinByField), which the
// registry rejects as duplicate keys.
const transformers = new Map(Object.values(standardTransformers).map((info) => [info.id, info]));

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

export async function runTransformRequest(req: TransformRequest): Promise<TransformResponse> {
  // Safe as a module-level setting because each worker runs one request at a time.
  const timezone = req.timezone ?? 'utc';
  setTimeZoneResolver(() => timezone);

  const frames = req.frames.map((frame) => dataFrameFromJSON(frame));
  const output = await lastValueFrom(
    transformDataFrame(req.transformations, frames, { interpolate: interpolator(req.vars ?? {}) })
  );

  return { frames: output.map((frame) => dataFrameToJSON(frame)) };
}
