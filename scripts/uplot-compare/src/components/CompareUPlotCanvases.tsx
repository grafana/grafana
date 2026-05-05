import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
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
  // eslint-disable-next-line @grafana/no-locale-compare
  .sort((a, b) => a.localeCompare(b));

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

/** Next payload with `snapshotAssertionPassed === false`, after `currentBasename` in circular list order. */
function findNextFailedBasename(
  orderedFiles: readonly string[],
  passedMap: Record<string, boolean | undefined>,
  currentBasename: string | null
): string | null {
  const n = orderedFiles.length;
  if (n === 0) {
    return null;
  }

  const isFailed = (name: string) => passedMap[name] === false;

  const startIdx = currentBasename ? orderedFiles.indexOf(currentBasename) : -1;

  if (startIdx === -1) {
    for (let i = 0; i < n; i++) {
      const name = orderedFiles[i];
      if (isFailed(name)) {
        return name;
      }
    }
    return null;
  }

  for (let step = 1; step < n; step++) {
    const idx = (startIdx + step) % n;
    const name = orderedFiles[idx];
    if (isFailed(name)) {
      return name;
    }
  }

  return null;
}

/** Failed payloads first, then passing, then unknown status; within each group by Last-Modified descending. */
function sortPayloadFilesForIndex(
  files: readonly string[],
  passedMap: Record<string, boolean | undefined>,
  modifiedMsByBasename: Record<string, number>
): string[] {
  const failureTier = (passed: boolean | undefined): number => {
    if (passed === false) {
      return 0;
    }
    if (passed === true) {
      return 1;
    }
    return 2;
  };

  return [...files].sort((a, b) => {
    const tierDiff = failureTier(passedMap[a]) - failureTier(passedMap[b]);
    if (tierDiff !== 0) {
      return tierDiff;
    }
    const ma = modifiedMsByBasename[a];
    const mb = modifiedMsByBasename[b];
    const maNum = typeof ma === 'number' && !Number.isNaN(ma) ? ma : -Infinity;
    const mbNum = typeof mb === 'number' && !Number.isNaN(mb) ? mb : -Infinity;
    if (maNum !== mbNum) {
      return mbNum - maNum;
    }
    // eslint-disable-next-line @grafana/no-locale-compare
    return a.localeCompare(b);
  });
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
}) => {
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [acceptBaselineState, setAcceptBaselineState] = React.useState<AcceptBaselineState>({ kind: 'idle' });
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileModifiedLabels, setFileModifiedLabels] = React.useState<Record<string, string>>({});
  const [fileModifiedTimestampMs, setFileModifiedTimestampMs] = React.useState<Record<string, number>>({});
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
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          expected: raw.expected as CanvasRenderingContext2DEvent[],
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          actual: raw.actual as CanvasRenderingContext2DEvent[],
          uPlotCanvasEvents: Array.isArray(raw.uPlotCanvasEvents) ? raw.uPlotCanvasEvents : [],
          ...readPayloadDimensions(raw),
          snapshotAssertionPassed: raw.snapshotAssertionPassed,
        },
      });
    },
    []
  );

  const navigateToIndex = React.useCallback(() => {
    const url = new URL(window.location.href);
    url.searchParams.delete('file');
    window.history.pushState({}, '', url);
    setSelectedFile(null);
    setAcceptBaselineState({ kind: 'idle' });
    setView({
      kind: 'blocked',
      hint: 'Choose a payload file from the list.',
    });
  }, []);

  const setTest = React.useCallback(
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

  const indexOrderedPayloadFiles = React.useMemo(
    () => sortPayloadFilesForIndex(PUBLIC_PAYLOAD_FILES, fileSnapshotAssertionPassed, fileModifiedTimestampMs),
    [fileModifiedTimestampMs, fileSnapshotAssertionPassed]
  );

  const nextFailedTestBasename = React.useMemo(
    () => findNextFailedBasename(indexOrderedPayloadFiles, fileSnapshotAssertionPassed, selectedFile),
    [fileSnapshotAssertionPassed, indexOrderedPayloadFiles, selectedFile]
  );

  const goToNextFailedTest = React.useCallback(() => {
    if (!nextFailedTestBasename) {
      return;
    }
    void setTest(nextFailedTestBasename, 'push');
  }, [nextFailedTestBasename, setTest]);

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
        const res = await fetch('/__uplot-compare/test', {
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

  const onRerunTest = React.useCallback(() => {
    if (view.kind !== 'ready') {
      return;
    }
    void runJestForPayload(view.payload, false);
  }, [runJestForPayload, view]);

  const onAcceptBaseline = React.useCallback(() => {
    if (view.kind !== 'ready') {
      return;
    }
    void runJestForPayload(view.payload, true);
  }, [runJestForPayload, view]);

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

      void setTest(fileParam);
    };

    void run();
  }, [setTest]);

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
        PUBLIC_PAYLOAD_FILES.map(async (basename): Promise<[string, string, number | undefined]> => {
          try {
            const res = await fetch(payloadFetchUrl(basename), { method: 'HEAD' });
            if (!res.ok) {
              return [basename, '', undefined];
            }
            const lastModifiedHeader = res.headers.get('last-modified');
            if (!lastModifiedHeader) {
              return [basename, '', undefined];
            }
            const dt = new Date(lastModifiedHeader);
            const ms = dt.getTime();
            if (Number.isNaN(ms)) {
              return [basename, lastModifiedHeader, undefined];
            }
            return [basename, dt.toLocaleString(), ms];
          } catch {
            return [basename, '', undefined];
          }
        })
      );
      if (cancelled) {
        return;
      }
      const labels: Record<string, string> = {};
      const msMap: Record<string, number> = {};
      for (const [basename, label, ms] of entries) {
        labels[basename] = label;
        if (typeof ms === 'number') {
          msMap[basename] = ms;
        }
      }
      setFileModifiedLabels(labels);
      setFileModifiedTimestampMs(msMap);
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
            indexOrderedPayloadFiles.map((basename) => (
              <button
                key={basename}
                type="button"
                className={`compare-file-item${selectedFile === basename ? ' is-selected' : ''}`}
                onClick={() => setTest(basename, 'push')}
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
      onBackToIndex={navigateToIndex}
      nextFailedTestBasename={nextFailedTestBasename}
      onGoToNextFailedTest={goToNextFailedTest}
      onRerunTest={onRerunTest}
      onAcceptBaseline={onAcceptBaseline}
    />
  );
};
