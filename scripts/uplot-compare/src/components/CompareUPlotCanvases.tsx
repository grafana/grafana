import * as React from 'react';

import { isUPlotComparePayload } from '../testUtils.ts';
import type { ResolvedPayload, UPlotComparePayload } from '../types.ts';

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

export const CompareUPlotCanvases = ({
  defaultWidth = FALLBACK_CANVAS_WIDTH,
  defaultHeight = FALLBACK_CANVAS_HEIGHT,
}: Props = {}) => {
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [selectedFile, setSelectedFile] = React.useState<string | null>(null);
  const [fileModifiedLabels, setFileModifiedLabels] = React.useState<Record<string, string>>({});

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

  const applyPayload = React.useCallback((raw: ResolvedPayload, sourceLabel: string) => {
    if (!isUPlotComparePayload(raw)) {
      setView({
        kind: 'blocked',
        error: `${sourceLabel}: not a valid uplot snapshot payload`,
        hint: 'Paste the JSON logged by toMatchUPlotSnapshot or choose a payload file.',
      });
      return;
    }
    setView({
      kind: 'ready',

      payload: {
        testName: raw.testName,
        expected: raw.expected,
        actual: raw.actual,
        uPlotData: raw.uPlotData,
        uPlotCanvasEvents: Array.isArray(raw.uPlotCanvasEvents) ? raw.uPlotCanvasEvents : [],
        ...readPayloadDimensions(raw),
      },
    });
  }, []);

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
                <span>{basename}</span>
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

  return <ComparePlots defaultWidth={defaultWidth} defaultHeight={defaultHeight} payload={view.payload} />;
};
