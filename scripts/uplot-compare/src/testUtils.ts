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
