import * as React from 'react';

import { isUPlotComparePayload, readSnapshotAssertionPassed } from '../testUtils.ts';
import type { AcceptBaselineState, ResolvedPayload, UPlotComparePayload } from '../types.ts';

import { AssertionStatusBadge } from './AssertionStatusBadge.tsx';
import { ComparePlots } from './ComparePlots.tsx';

/** When payload JSON has no `width`/`height` (older files), uplot-compare still needs a canvas size for replay. */
const FALLBACK_CANVAS_WIDTH = 400;
const FALLBACK_CANVAS_HEIGHT = 200;
const PUBLIC_PAYLOAD_FILES = Object.keys(import.meta.glob('../../public/**/*.json', { eager: true }))
  .map((path) => path.split('/').pop())
  .filter((name): name is string => Boolean(name))
  // @todo sort by date instead
  // eslint-disable-next-line @grafana/no-locale-compare
  .sort((a, b) => a.localeCompare(b));

interface Props {
  /** Default canvas CSS px if payload does not include `width` / `height` */
  defaultWidth?: number;
  defaultHeight?: number;
}

function readPayloadDimensions(raw: UPlotComparePayload): Pick<ResolvedPayload, 'width' | 'height'> {
  const w = raw.width;
  const h = raw.height;
  return {
    width: w,
    height: h,
  };
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'ready'; payload: ResolvedPayload }
  | { kind: 'blocked'; error?: string; hint?: string };

function isSafePayloadBasename(name: string): boolean {
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) {
    return false;
  }
  return /^[\w.-]+\.json$/.test(name);
}

function payloadFetchUrl(basename: string): string {
  return `${import.meta.env.BASE_URL}${basename}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readOptionalString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === 'string' ? v : undefined;
}

function readOptionalBoolean(o: Record<string, unknown>, key: string): boolean | undefined {
  const v = o[key];
  return typeof v === 'boolean' ? v : undefined;
}

function readOptionalNumber(o: Record<string, unknown>, key: string): number | undefined {
  const v = o[key];
  return typeof v === 'number' ? v : undefined;
}

function parseAcceptBaselineResponse(data: unknown): {
  ok?: boolean;
  exitCode?: number;
  stdout: string;
  stderr: string;
  command: string;
  error?: string;
} {
  if (!isRecord(data)) {
    return { stdout: '', stderr: '', command: '' };
  }
  return {
    ok: readOptionalBoolean(data, 'ok'),
    exitCode: readOptionalNumber(data, 'exitCode'),
    stdout: readOptionalString(data, 'stdout') ?? '',
    stderr: readOptionalString(data, 'stderr') ?? '',
    command: readOptionalString(data, 'command') ?? '',
    error: readOptionalString(data, 'error'),
  };
}

export const CompareUPlotCanvases = ({
  defaultWidth = FALLBACK_CANVAS_WIDTH,
  defaultHeight = FALLBACK_CANVAS_HEIGHT,
}: Props = {}) => {
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [acceptBaselineState, setAcceptBaselineState] = React.useState<AcceptBaselineState>({ kind: 'idle' });
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileModifiedLabels, setFileModifiedLabels] = React.useState<Record<string, string>>({});
  const [fileSnapshotAssertionPassed, setFileSnapshotAssertionPassed] = React.useState<
    Record<string, boolean | undefined>
  >({});

  /**
   * @todo route with links instead so folks can open each in a new tab
   */
  const navigate = React.useCallback((basename: string, mode: 'push' | 'replace') => {
    const url = new URL(window.location.href);
    url.searchParams.set('file', basename);
    if (mode === 'push') {
      window.history.pushState({ file: basename }, '', url);
    } else {
      window.history.replaceState({ file: basename }, '', url);
    }
  }, []);

  const applyPayload = React.useCallback(
    (raw: ResolvedPayload | UPlotComparePayload, sourceLabel: string, options?: { resetJestActions?: boolean }) => {
      if (!isUPlotComparePayload(raw)) {
        setView({
          kind: 'blocked',
          error: `${sourceLabel}: not a valid uplot snapshot payload`,
          hint: 'Paste the JSON logged by toMatchUPlotSnapshot or choose a payload file.',
        });
        return;
      }
      if (options?.resetJestActions !== false) {
        setAcceptBaselineState({ kind: 'idle' });
      }
      setView({
        kind: 'ready',

        payload: {
          testName: raw.testName,
          testPath: typeof raw.testPath === 'string' ? raw.testPath : undefined,
          expected: raw.expected,
          actual: raw.actual,
          uPlotCanvasEvents: Array.isArray(raw.uPlotCanvasEvents) ? raw.uPlotCanvasEvents : [],
          ...readPayloadDimensions(raw),
          snapshotAssertionPassed: raw.snapshotAssertionPassed,
        },
      });
    },
    []
  );

  const loadPayloadFromPublicFile = React.useCallback(
    async (basename: string, historyMode?: 'push' | 'replace') => {
      if (!isSafePayloadBasename(basename)) {
        setView({
          kind: 'blocked',
          error: `${basename}: invalid payload filename.`,
          hint: 'Select one of the listed JSON files.',
        });
        return;
      }
      setSelectedFile(basename);
      try {
        const res = await fetch(payloadFetchUrl(basename));
        if (!res.ok) {
          setView({
            kind: 'blocked',
            error: `Could not load ${basename} (${res.status}).`,
            hint: 'Select another payload file from the list.',
          });
          return;
        }
        const raw: ResolvedPayload = await res.json();
        applyPayload(raw, basename);
        if (historyMode) {
          navigate(basename, historyMode);
        }
      } catch (e) {
        setView({
          kind: 'blocked',
          error: `Failed to fetch ${basename}.`,
          hint: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [applyPayload, navigate]
  );

  const reloadPayloadAfterJest = React.useCallback(async () => {
    const basename = selectedFile ?? new URLSearchParams(window.location.search).get('file');
    if (!basename || !isSafePayloadBasename(basename)) {
      return;
    }
    try {
      const res = await fetch(`${payloadFetchUrl(basename)}?_=${encodeURIComponent(String(Date.now()))}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        return;
      }
      const rawUnknown: unknown = await res.json();
      if (!isUPlotComparePayload(rawUnknown)) {
        return;
      }
      const assertionPassed = readSnapshotAssertionPassed(rawUnknown);
      if (typeof assertionPassed === 'boolean') {
        setFileSnapshotAssertionPassed((prev) => ({ ...prev, [basename]: assertionPassed }));
      }
      applyPayload(rawUnknown, basename, { resetJestActions: false });
    } catch {
      // Ignore reload failures (missing file or invalid JSON).
    }
  }, [applyPayload, selectedFile]);

  const runJestForPayload = React.useCallback(
    async (payload: ResolvedPayload, updateSnapshot: boolean) => {
      if (!payload.testPath) {
        return;
      }
      setAcceptBaselineState({ kind: 'running', updateSnapshot });
      try {
        const res = await fetch('/__uplot-compare/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            testPath: payload.testPath,
            testName: payload.testName,
            updateSnapshot,
          }),
        });
        const data = parseAcceptBaselineResponse(await res.json());

        if (!res.ok) {
          setAcceptBaselineState({
            kind: 'error',
            updateSnapshot,
            message: data.error ?? `Request failed (${res.status})`,
            stdout: data.stdout ?? '',
            stderr: data.stderr ?? '',
            command: data.command,
          });
          return;
        }

        if (data.ok && data.exitCode === 0) {
          setAcceptBaselineState({
            kind: 'success',
            updateSnapshot,
            stdout: data.stdout ?? '',
            stderr: data.stderr ?? '',
            command: data.command ?? '',
          });
          return;
        }

        setAcceptBaselineState({
          kind: 'error',
          updateSnapshot,
          message: data.error ?? `jest exited with code ${String(data.exitCode)}`,
          stdout: data.stdout ?? '',
          stderr: data.stderr ?? '',
          command: data.command,
        });
      } catch (e) {
        setAcceptBaselineState({
          kind: 'error',
          updateSnapshot,
          message: e instanceof Error ? e.message : String(e),
          stdout: '',
          stderr: '',
        });
      } finally {
        await reloadPayloadAfterJest();
      }
    },
    [reloadPayloadAfterJest]
  );

  const loadFromLocation = React.useCallback(() => {
    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const fileParam = params.get('file');

      if (!fileParam) {
        setSelectedFile(null);
        setView({
          kind: 'blocked',
          hint: 'Choose a payload file from the list.',
        });
        return;
      }

      if (!isSafePayloadBasename(fileParam) || !PUBLIC_PAYLOAD_FILES.includes(fileParam)) {
        setSelectedFile(null);
        setView({
          kind: 'blocked',
          error: `${fileParam} is not available in public payload files.`,
          hint: 'Choose a payload file from the list.',
        });
        return;
      }

      void loadPayloadFromPublicFile(fileParam);
    };

    void run();
  }, [loadPayloadFromPublicFile]);

  React.useEffect(() => {
    loadFromLocation();
  }, [loadFromLocation]);

  React.useEffect(() => {
    let cancelled = false;
    const loadSnapshotAssertionFlags = async () => {
      const entries = await Promise.all(
        PUBLIC_PAYLOAD_FILES.map(async (basename): Promise<[string, boolean | undefined]> => {
          try {
            const res = await fetch(payloadFetchUrl(basename));
            if (!res.ok) {
              return [basename, undefined];
            }
            const data: unknown = await res.json();
            return [basename, readSnapshotAssertionPassed(data)];
          } catch {
            return [basename, undefined];
          }
        })
      );
      if (!cancelled) {
        setFileSnapshotAssertionPassed(Object.fromEntries(entries));
      }
    };

    void loadSnapshotAssertionFlags();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const loadFileModifiedDates = async () => {
      const entries = await Promise.all(
        PUBLIC_PAYLOAD_FILES.map(async (basename): Promise<[string, string]> => {
          try {
            const res = await fetch(payloadFetchUrl(basename), { method: 'HEAD' });
            if (!res.ok) {
              return [basename, ''];
            }
            const lastModifiedHeader = res.headers.get('last-modified');
            if (!lastModifiedHeader) {
              return [basename, ''];
            }
            const dt = new Date(lastModifiedHeader);
            return [basename, Number.isNaN(dt.getTime()) ? lastModifiedHeader : dt.toLocaleString()];
          } catch {
            return [basename, ''];
          }
        })
      );
      if (cancelled) {
        return;
      }
      setFileModifiedLabels(Object.fromEntries(entries));
    };

    void loadFileModifiedDates();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    const onPopState = () => {
      loadFromLocation();
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [loadFromLocation]);

  if (view.kind === 'loading') {
    return <p>Loading…</p>;
  }

  if (view.kind === 'blocked') {
    return (
      <div className="compare-blocked">
        {view.error ? (
          <p className="compare-error" role="alert">
            {view.error}
          </p>
        ) : null}
        {view.hint ? <p>{view.hint}</p> : null}
        <div className="compare-file-list">
          {PUBLIC_PAYLOAD_FILES.length === 0 ? (
            <p>No JSON files found in the public directory.</p>
          ) : (
            PUBLIC_PAYLOAD_FILES.map((basename) => (
              <button
                key={basename}
                type="button"
                className={`compare-file-item${selectedFile === basename ? ' is-selected' : ''}`}
                onClick={() => loadPayloadFromPublicFile(basename, 'push')}
              >
                <span className="compare-file-item-header">
                  <span className="compare-file-name">{basename}</span>
                  {typeof fileSnapshotAssertionPassed[basename] === 'boolean' ? (
                    <AssertionStatusBadge passed={fileSnapshotAssertionPassed[basename]} compact />
                  ) : null}
                </span>
                <span className="compare-file-modified">
                  {fileModifiedLabels[basename] ? `Modified: ${fileModifiedLabels[basename]}` : 'Modified: unknown'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    );
  }

  return (
    <ComparePlots
      defaultWidth={defaultWidth}
      defaultHeight={defaultHeight}
      payload={view.payload}
      acceptBaselineState={acceptBaselineState}
      onRerunTest={() => {
        if (view.kind !== 'ready') {
          return;
        }
        void runJestForPayload(view.payload, false);
      }}
      onAcceptBaseline={() => {
        if (view.kind !== 'ready') {
          return;
        }
        void runJestForPayload(view.payload, true);
      }}
    />
  );
};
