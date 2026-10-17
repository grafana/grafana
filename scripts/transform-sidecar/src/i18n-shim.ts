/**
 * Stands in for @grafana/i18n in the sidecar bundle (see build.mjs). The transformations in
 * public/app/features/transformers only use t() for names and descriptions, and the real module
 * pulls in React and browser language detection. This returns the default English message,
 * interpolating i18next-style {{values}}.
 */
export function t(_id: string, defaultMessage: string, values?: Record<string, unknown>): string {
  if (!values) {
    return defaultMessage;
  }
  return defaultMessage.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match
  );
}
