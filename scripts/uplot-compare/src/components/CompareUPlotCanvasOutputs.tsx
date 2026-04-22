import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import * as React from 'react';
import type uPlot from 'uplot';
import type { AlignedData } from 'uplot';

import { isUPlotComparePayloadV1, type UPlotComparePayloadV1 } from '@grafana/test-utils/uplot-compare-payload';

import { eventsToCanvasScript } from '../canvasUtils.ts';

type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

/** When payload JSON has no `width`/`height` (older files), uplot-compare still needs a canvas size for replay. */
const FALLBACK_CANVAS_WIDTH = 400;
const FALLBACK_CANVAS_HEIGHT = 200;

interface Props {
  /** Default canvas CSS px if payload does not include `width` / `height` */
  defaultWidth?: number;
  defaultHeight?: number;
}

type ResolvedPayload = {
  testName: string;
  expected: CanvasEventArray;
  actual: CanvasEventArray;
  uPlotData?: AlignedData;
  uPlotSeries?: uPlot.Series[];
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  width?: number;
  height?: number;
};

function readPayloadDimensions(raw: UPlotComparePayloadV1): Pick<ResolvedPayload, 'width' | 'height'> {
  const w = raw.width;
  const h = raw.height;
  return {
    ...(typeof w === 'number' && Number.isFinite(w) ? { width: w } : {}),
    ...(typeof h === 'number' && Number.isFinite(h) ? { height: h } : {}),
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

function parsePayloadJson(text: string): unknown {
  return JSON.parse(text);
}

/**
 * Static site component, DO NOT EVER USE THIS IN GRAFANA
 */
export const CompareUPlotCanvasOutputs = ({
  defaultWidth = FALLBACK_CANVAS_WIDTH,
  defaultHeight = FALLBACK_CANVAS_HEIGHT,
}: Props = {}) => {
  const [view, setView] = React.useState<ViewState>({ kind: 'loading' });
  const [pasteText, setPasteText] = React.useState('');

  const applyPayload = React.useCallback((raw: unknown, sourceLabel: string) => {
    if (!isUPlotComparePayloadV1(raw)) {
      setView({
        kind: 'blocked',
        error: `${sourceLabel}: not a valid uplot compare payload (expected version 1 with testName, expected, actual).`,
        hint: 'Paste the JSON logged by toMatchUPlotSnapshot or choose a payload file.',
      });
      return;
    }
    setView({
      kind: 'ready',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      payload: {
        testName: raw.testName,
        expected: raw.expected,
        actual: raw.actual,
        uPlotData: raw.uPlotData,
        uPlotSeries: raw.uPlotSeries,
        uPlotCanvasEvents: Array.isArray(raw.uPlotCanvasEvents) ? raw.uPlotCanvasEvents : [],
        ...readPayloadDimensions(raw),
      } as ResolvedPayload,
    });
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const params = new URLSearchParams(window.location.search);
      const expectedParam = params.get('expected');
      const actualParam = params.get('actual');

      if (expectedParam != null && actualParam != null) {
        const testName = params.get('testName') ?? '';
        const dataRaw = params.get('uPlotData');
        const seriesRaw = params.get('uPlotSeries');
        let uPlotData: unknown;
        let uPlotSeries: unknown;
        try {
          uPlotData = dataRaw != null && dataRaw !== '' ? JSON.parse(dataRaw) : undefined;
          uPlotSeries = seriesRaw != null && seriesRaw !== '' ? JSON.parse(seriesRaw) : undefined;
        } catch {
          if (!cancelled) {
            setView({
              kind: 'blocked',
              error: 'Invalid uPlotData or uPlotSeries JSON in URL.',
              hint: 'Use a payload file or paste JSON instead.',
            });
          }
          return;
        }
        try {
          const expected: unknown = JSON.parse(expectedParam);
          const actual: unknown = JSON.parse(actualParam);
          if (!cancelled) {
            setView({
              kind: 'ready',
              // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
              payload: {
                testName,
                expected,
                actual,
                uPlotData,
                uPlotSeries,
                uPlotCanvasEvents: [],
              } as ResolvedPayload,
            });
          }
        } catch {
          if (!cancelled) {
            setView({
              kind: 'blocked',
              error: 'Invalid expected or actual JSON in URL.',
              hint: 'Use a payload file or paste JSON instead.',
            });
          }
        }
        return;
      }

      const fileParam = params.get('file');
      if (!fileParam || !isSafePayloadBasename(fileParam)) {
        if (!cancelled) {
          setView({
            kind: 'blocked',
            hint: 'Add a ?file=… query parameter from the test output (each failure writes uplot-compare-payload-<uuid>.json), or paste JSON / choose a file. Example: http://localhost:5173/?file=uplot-compare-payload-….json',
          });
        }
        return;
      }
      const basename = fileParam;

      try {
        const res = await fetch(payloadFetchUrl(basename));
        if (!res.ok) {
          if (!cancelled) {
            setView({
              kind: 'blocked',
              hint: `Could not load ${basename} (${res.status}). Re-run the test to refresh the file, or paste JSON / choose a file.`,
            });
          }
          return;
        }
        const raw: unknown = await res.json();
        if (cancelled) {
          return;
        }
        if (!isUPlotComparePayloadV1(raw)) {
          setView({
            kind: 'blocked',
            error: `${basename} is not a valid uplot compare payload.`,
            hint: 'Paste JSON from the test output or pick another file.',
          });
          return;
        }
        setView({
          kind: 'ready',
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          payload: {
            testName: raw.testName,
            expected: raw.expected,
            actual: raw.actual,
            uPlotData: raw.uPlotData,
            uPlotSeries: raw.uPlotSeries,
            uPlotCanvasEvents: Array.isArray(raw.uPlotCanvasEvents) ? raw.uPlotCanvasEvents : [],
            ...readPayloadDimensions(raw),
          } as ResolvedPayload,
        });
      } catch (e) {
        if (!cancelled) {
          setView({
            kind: 'blocked',
            hint: `Fetch failed (${e instanceof Error ? e.message : String(e)}). Paste JSON or choose a file.`,
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoadPaste = () => {
    try {
      const raw = parsePayloadJson(pasteText);
      applyPayload(raw, 'Pasted JSON');
    } catch {
      setView({
        kind: 'blocked',
        error: 'Pasted text is not valid JSON.',
        hint: 'Copy the full payload object from the test console output.',
      });
    }
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (ev) => {
    const file = ev.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = typeof reader.result === 'string' ? reader.result : '';
        const raw = parsePayloadJson(text);
        applyPayload(raw, file.name);
      } catch {
        setView({
          kind: 'blocked',
          error: `Could not read ${file.name} as JSON.`,
          hint: 'Choose a payload .json file written by toMatchUPlotSnapshot.',
        });
      }
    };
    reader.readAsText(file);
    ev.target.value = '';
  };

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
        <label className="compare-paste-label">
          Paste payload JSON
          <textarea
            className="compare-paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            rows={12}
            spellCheck={false}
          />
        </label>
        <div className="compare-actions">
          <button type="button" onClick={onLoadPaste}>
            Load pasted JSON
          </button>
          <label className="compare-file-label">
            Or choose file
            <input type="file" accept="application/json,.json" onChange={onPickFile} />
          </label>
        </div>
      </div>
    );
  }

  return <ComparePlots defaultWidth={defaultWidth} defaultHeight={defaultHeight} payload={view.payload} />;
};

function ComparePlots({
  defaultWidth,
  defaultHeight,
  payload,
}: {
  defaultWidth: number;
  defaultHeight: number;
  payload: ResolvedPayload;
}) {
  const width = payload.width ?? defaultWidth;
  const height = payload.height ?? defaultHeight;
  const actualUPlotInstance = React.useRef<HTMLCanvasElement | null>(null);
  const expectedUPlotInstance = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const context = actualUPlotInstance.current?.getContext('2d');
    if (!context) {
      return;
    }
    eventsToCanvasScript(payload.uPlotCanvasEvents, context);
    eventsToCanvasScript(payload.actual, context);
  }, [payload.actual, payload.uPlotCanvasEvents]);

  React.useEffect(() => {
    const context = expectedUPlotInstance.current?.getContext('2d');
    if (!context) {
      return;
    }
    eventsToCanvasScript(payload.uPlotCanvasEvents, context);
    eventsToCanvasScript(payload.expected, context);
  }, [payload.expected, payload.uPlotCanvasEvents]);

  return (
    <>
      <h3>Test: {payload.testName}</h3>
      <div className="wrap">
        <div className={'expected'}>
          <div className={'plot-label'}>Expected</div>
          <canvas ref={expectedUPlotInstance} className="canvas" id="expected" width={width} height={height}></canvas>
        </div>

        <div className={'actual'}>
          <div className={'plot-label'}>Actual</div>
          <canvas ref={actualUPlotInstance} className="canvas" id="actual" width={width} height={height}></canvas>
        </div>
      </div>
    </>
  );
}
