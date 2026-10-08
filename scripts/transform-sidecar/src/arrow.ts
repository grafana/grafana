/**
 * Arrow IPC wire format between Grafana (Go) and the sidecar.
 *
 * The body is an envelope: a big-endian uint32 length and a JSON header, then for each frame a
 * big-endian uint32 length and the frame in the Arrow IPC file format. Frames use the Go SDK's Arrow
 * layout (data.Frame.MarshalArrow): schema metadata "name", "refId" and "meta" (JSON); field metadata
 * "tstype", "labels" (JSON) and "config" (JSON); time as nanosecond timestamps.
 */
import {
  Binary,
  Bool,
  type Data,
  DataType,
  Field as ArrowField,
  Float64,
  makeData,
  RecordBatch,
  RecordBatchReader,
  Schema,
  Struct,
  Table,
  tableToIPC,
  TimestampNanosecond,
  Type,
  Uint16,
  Utf8,
  vectorFromArray,
  type Vector,
} from 'apache-arrow';

import { type DataFrame, type Field, FieldType } from '../../../packages/grafana-data/src/types/dataFrame';

export const ARROW_CONTENT_TYPE = 'application/vnd.grafana.transform+arrow';

const utf8Decoder = new TextDecoder();
const utf8Encoder = new TextEncoder();

export function readEnvelope(bytes: Uint8Array): { header: string; frames: Uint8Array[] } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let pos = 0;
  const next = () => {
    if (pos + 4 > bytes.byteLength) {
      throw new Error('truncated envelope');
    }
    const length = view.getUint32(pos);
    const start = pos + 4;
    pos = start + length;
    if (pos > bytes.byteLength) {
      throw new Error('truncated envelope');
    }
    return bytes.subarray(start, pos);
  };

  const header = utf8Decoder.decode(next());
  const frames: Uint8Array[] = [];
  while (pos < bytes.byteLength) {
    frames.push(next());
  }
  return { header, frames };
}

export function writeEnvelope(header: string, frames: Uint8Array[]): Uint8Array {
  const headerBytes = utf8Encoder.encode(header);
  const parts = [headerBytes, ...frames];
  const out = new Uint8Array(parts.reduce((sum, p) => sum + 4 + p.byteLength, 0));
  const view = new DataView(out.buffer);
  let pos = 0;
  for (const part of parts) {
    view.setUint32(pos, part.byteLength);
    out.set(part, pos + 4);
    pos += 4 + part.byteLength;
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Arrow -> DataFrame

function parseJSONMetadata(value: string | undefined): unknown {
  return value ? JSON.parse(value) : undefined;
}

/** The validity bitmap, or null when every value is valid. */
function nullsOf(data: Data): Uint8Array | null {
  return data.nullCount > 0 && data.nullBitmap && data.nullBitmap.length > 0 ? data.nullBitmap : null;
}

// Bit i of an Arrow validity bitmap is 1 when value i is present.
function isSet(bits: Uint8Array, i: number): boolean {
  return (bits[i >> 3] & (1 << (i & 7))) !== 0;
}

// 64-bit integers are read as two int32 halves. hi * 2^32 + lo rounds once to the nearest double,
// which is what JSON.parse does with the same number written as decimal.
function int64Halves(data: Data): Int32Array {
  const values: BigInt64Array = data.values;
  return new Int32Array(values.buffer, values.byteOffset, values.length * 2);
}

/**
 * Writes the chunk's values into out, starting at pos. Callers preallocate out: writing by index
 * into a preallocated array is 2-3x faster than push for million-value columns.
 */
function readChunk(data: Data, out: unknown[], pos: number) {
  const n = data.length;
  const nulls = nullsOf(data);

  if (data.offset !== 0) {
    // The Go SDK never writes sliced arrays; fall back to the generic accessor if one appears.
    const vector = makeVectorFromData(data);
    for (let i = 0; i < n; i++) {
      out[pos + i] = vector.get(i);
    }
    return;
  }

  switch (data.type.typeId) {
    case Type.Timestamp: {
      const h = int64Halves(data);
      for (let i = 0; i < n; i++) {
        // Nanoseconds as a double are within a few hundred ns, so rounding recovers whole
        // milliseconds. Sub-millisecond precision (JSON's "nanos") is dropped.
        out[pos + i] =
          nulls === null || isSet(nulls, i) ? Math.round((h[2 * i + 1] * 4294967296 + (h[2 * i] >>> 0)) / 1e6) : null;
      }
      return;
    }
    case Type.Int: {
      if (DataType.isInt(data.type) && data.type.bitWidth === 64) {
        const h = int64Halves(data);
        const signed = data.type.isSigned;
        for (let i = 0; i < n; i++) {
          const hi = signed ? h[2 * i + 1] : h[2 * i + 1] >>> 0;
          out[pos + i] = nulls === null || isSet(nulls, i) ? hi * 4294967296 + (h[2 * i] >>> 0) : null;
        }
        return;
      }
      readNumbers(data, nulls, out, pos);
      return;
    }
    case Type.Float:
      readNumbers(data, nulls, out, pos);
      return;
    case Type.Bool: {
      const bits: Uint8Array = data.values;
      for (let i = 0; i < n; i++) {
        out[pos + i] = nulls === null || isSet(nulls, i) ? isSet(bits, i) : null;
      }
      return;
    }
    case Type.Utf8:
      readStrings(data, nulls, out, pos, (s) => s);
      return;
    case Type.Binary:
      // json.RawMessage fields. The JSON wire format embeds these values as JSON.
      readStrings(data, nulls, out, pos, (s) => JSON.parse(s));
      return;
    default: {
      const vector = makeVectorFromData(data);
      for (let i = 0; i < n; i++) {
        out[pos + i] = vector.get(i);
      }
    }
  }
}

function readNumbers(data: Data, nulls: Uint8Array | null, out: unknown[], pos: number) {
  const values: ArrayLike<number> = data.values;
  for (let i = 0; i < data.length; i++) {
    out[pos + i] = nulls === null || isSet(nulls, i) ? values[i] : null;
  }
}

function readStrings(data: Data, nulls: Uint8Array | null, out: unknown[], pos: number, map: (s: string) => unknown) {
  const bytes: Uint8Array = data.values;
  const offsets: Int32Array = data.valueOffsets;
  const end = offsets[data.length];

  // Most label and log text is ASCII. Then byte offsets equal character offsets, and one decode of
  // the whole buffer plus slicing is much faster than decoding each value.
  let ascii = true;
  for (let i = offsets[0]; i < end; i++) {
    if (bytes[i] > 127) {
      ascii = false;
      break;
    }
  }

  const all = ascii ? utf8Decoder.decode(bytes.subarray(0, end)) : '';
  for (let i = 0; i < data.length; i++) {
    if (nulls !== null && !isSet(nulls, i)) {
      out[pos + i] = null;
    } else if (ascii) {
      out[pos + i] = map(all.slice(offsets[i], offsets[i + 1]));
    } else {
      out[pos + i] = map(utf8Decoder.decode(bytes.subarray(offsets[i], offsets[i + 1])));
    }
  }
}

function makeVectorFromData(data: Data): Vector {
  return new Table(new RecordBatch({ v: data })).getChildAt(0)!;
}

const FIELD_TYPES = new Set<string>(Object.values(FieldType));

function isFieldType(value: string | undefined): value is FieldType {
  return value !== undefined && FIELD_TYPES.has(value);
}

function fieldTypeFromArrow(type: DataType, tstype: string | undefined): FieldType {
  if (isFieldType(tstype)) {
    return tstype;
  }
  switch (type.typeId) {
    case Type.Timestamp:
      return FieldType.time;
    case Type.Int:
    case Type.Float:
      return FieldType.number;
    case Type.Bool:
      return FieldType.boolean;
    case Type.Utf8:
      return FieldType.string;
    default:
      return FieldType.other;
  }
}

export function arrowToDataFrame(bytes: Uint8Array): DataFrame {
  // Read through RecordBatchReader and take columns by index. RecordBatch.schema, and so Table,
  // merges the metadata of fields that share a name (Schema.assign matches by name), which would
  // give every "value" field of a join the labels of the last one.
  const reader = RecordBatchReader.from(bytes);
  reader.open();
  const schema = reader.schema;
  const batches = Array.from(reader);
  const meta = schema.metadata;

  const length = batches.reduce((sum, batch) => sum + batch.numRows, 0);

  const fields: Field[] = schema.fields.map((arrowField, idx) => {
    const values: unknown[] = new Array(length);
    let pos = 0;
    for (const batch of batches) {
      const chunk = batch.data.children[idx];
      readChunk(chunk, values, pos);
      pos += chunk.length;
    }
    const md = arrowField.metadata;
    const labels = parseJSONMetadata(md.get('labels'));
    const config = parseJSONMetadata(md.get('config'));
    return {
      name: arrowField.name,
      type: fieldTypeFromArrow(arrowField.type, md.get('tstype')),
      config: isPlainObject(config) ? config : {},
      ...(isPlainObject(labels) && { labels: toStringRecord(labels) }),
      values,
    };
  });

  const frameMeta = parseJSONMetadata(meta.get('meta'));
  return {
    name: meta.get('name') || undefined,
    refId: meta.get('refId') || undefined,
    ...(isPlainObject(frameMeta) && { meta: frameMeta }),
    fields,
    length,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringRecord(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, String(v)]));
}

// ---------------------------------------------------------------------------------------------
// DataFrame -> Arrow

function isNullish(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

interface FixedWidthColumn<T> {
  data: T;
  nullBitmap: Uint8Array;
  nullCount: number;
}

/**
 * Copies numbers into a typed array in one pass, building the validity bitmap as it goes.
 * Returns null if a value is not a number, so the caller can fall back to JSON.
 */
function encodeNumbers<T extends Float64Array | Uint16Array>(
  values: ArrayLike<unknown>,
  data: T
): FixedWidthColumn<T> | null {
  const nullBitmap = new Uint8Array(Math.ceil(values.length / 8));
  let nullCount = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === 'number') {
      data[i] = v;
      nullBitmap[i >> 3] |= 1 << (i & 7);
    } else if (isNullish(v)) {
      nullCount++;
    } else {
      return null;
    }
  }
  return { data, nullBitmap, nullCount };
}

const NANOS_PER_MILLI = BigInt(1_000_000);

function encodeTimes(values: ArrayLike<unknown>): FixedWidthColumn<BigInt64Array> | null {
  const data = new BigInt64Array(values.length);
  const nullBitmap = new Uint8Array(Math.ceil(values.length / 8));
  let nullCount = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v === 'number') {
      data[i] = BigInt(Math.round(v)) * NANOS_PER_MILLI;
      nullBitmap[i >> 3] |= 1 << (i & 7);
    } else if (isNullish(v)) {
      nullCount++;
    } else {
      return null;
    }
  }
  return { data, nullBitmap, nullCount };
}

function allNullishOr(values: ArrayLike<unknown>, kind: 'string' | 'boolean'): boolean {
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== kind && !isNullish(v)) {
      return false;
    }
  }
  return true;
}

function encodeField(field: Field): { type: DataType; data: Data; tstype: FieldType } {
  const values: ArrayLike<unknown> = field.values;
  const length = values.length;

  if (field.type === FieldType.number) {
    const column = encodeNumbers(values, new Float64Array(length));
    if (column) {
      const type = new Float64();
      return { type, tstype: field.type, data: makeData({ type, length, ...column }) };
    }
  }

  if (field.type === FieldType.enum) {
    const column = encodeNumbers(values, new Uint16Array(length));
    if (column) {
      const type = new Uint16();
      return { type, tstype: field.type, data: makeData({ type, length, ...column }) };
    }
  }

  if (field.type === FieldType.time) {
    const column = encodeTimes(values);
    if (column) {
      const type = new TimestampNanosecond();
      return { type, tstype: field.type, data: makeData({ type, length, ...column }) };
    }
  }

  if (field.type === FieldType.string && allNullishOr(values, 'string')) {
    const type = new Utf8();
    return { type, tstype: field.type, data: vectorFromArray(Array.from(values), type).data[0] };
  }

  if (field.type === FieldType.boolean && allNullishOr(values, 'boolean')) {
    const type = new Bool();
    return { type, tstype: field.type, data: vectorFromArray(Array.from(values), type).data[0] };
  }

  // Anything else (other, nested frames, values that don't match the declared type) travels as
  // JSON, like json.RawMessage fields in the JSON wire format.
  const type = new Binary();
  const encoded = Array.from(values, (v) => (isNullish(v) ? null : utf8Encoder.encode(JSON.stringify(v))));
  return { type, tstype: FieldType.other, data: vectorFromArray(encoded, type).data[0] };
}

function hasKeys(value: object | undefined): value is object {
  return value !== undefined && Object.keys(value).length > 0;
}

export function dataFrameToArrow(frame: DataFrame): Uint8Array {
  const encoded = frame.fields.map(encodeField);
  const arrowFields = frame.fields.map((field, i) => {
    const md = new Map<string, string>([['tstype', encoded[i].tstype]]);
    if (hasKeys(field.labels)) {
      md.set('labels', JSON.stringify(field.labels));
    }
    if (hasKeys(field.config)) {
      md.set('config', JSON.stringify(field.config));
    }
    // Every field is nullable because transformations introduce nulls (outer joins, empty groups).
    return new ArrowField(field.name, encoded[i].type, true, md);
  });

  const schemaMeta = new Map<string, string>([
    ['name', frame.name ?? ''],
    ['refId', frame.refId ?? ''],
  ]);
  if (frame.meta) {
    schemaMeta.set('meta', JSON.stringify(frame.meta));
  }
  const schema = new Schema(arrowFields, schemaMeta);

  // Built from a struct rather than a name-keyed object, because frames often repeat field names
  // (every series of a join is called "value"). The schema is passed to Table again because
  // RecordBatch merges the metadata of same-named fields; the writer uses the table's schema.
  const length = frame.fields[0]?.values.length ?? 0;
  const batch = new RecordBatch(
    schema,
    makeData({ type: new Struct(arrowFields), length, nullCount: 0, children: encoded.map((e) => e.data) })
  );
  // The Go SDK reads the Arrow file format (with footer), which is also what it writes.
  return tableToIPC(new Table(schema, [batch]), 'file');
}
