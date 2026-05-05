import type { UPlotComparePayload } from './types.ts';

/**
 * Narrow the payload type
 * @param value
 */
export function isUPlotComparePayload(value: unknown): value is UPlotComparePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const o = value as Record<string, unknown>;
  return typeof o.testName === 'string' && 'expected' in o && 'actual' in o;
}

/** Reads `snapshotAssertionPassed` from parsed payload JSON when present. */
export function readSnapshotAssertionPassed(data: unknown): boolean | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  if (!('snapshotAssertionPassed' in data)) {
    return undefined;
  }
  const v = data.snapshotAssertionPassed;
  return typeof v === 'boolean' ? v : undefined;
}
