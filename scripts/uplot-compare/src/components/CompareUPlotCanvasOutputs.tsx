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
const OVERLAY_BLEND_MODES = ['plus-lighter', 'color', 'difference', 'exclusion', 'luminosity', 'screen'] as const;
type OverlayBlendMode = (typeof OVERLAY_BLEND_MODES)[number];

function toOverlayBlendMode(value: string): OverlayBlendMode {
  return OVERLAY_BLEND_MODES.find((mode) => mode === value) ?? 'exclusion';
}

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
  const expectedOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const actualOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const [hasDiff, setHasDiff] = React.useState(false);
  const [diffImageData, setDiffImageData] = React.useState<ImageData | null>(null);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [expectedBlendMode, setExpectedBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [actualBlendMode, setActualBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [renderExpectedSetupEvents, setRenderExpectedSetupEvents] = React.useState(true);
  const [renderActualSetupEvents, setRenderActualSetupEvents] = React.useState(true);
  const [renderDiffSetupEvents, setRenderDiffSetupEvents] = React.useState(true);

  React.useEffect(() => {
    const canvas = actualUPlotInstance.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (renderActualSetupEvents) {
      eventsToCanvasScript(payload.uPlotCanvasEvents, context);
    }
    eventsToCanvasScript(payload.actual, context);
  }, [payload.actual, payload.uPlotCanvasEvents, renderActualSetupEvents]);

  React.useEffect(() => {
    const canvas = expectedUPlotInstance.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) {
      return;
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (renderExpectedSetupEvents) {
      eventsToCanvasScript(payload.uPlotCanvasEvents, context);
    }
    eventsToCanvasScript(payload.expected, context);
  }, [payload.expected, payload.uPlotCanvasEvents, renderExpectedSetupEvents]);

  React.useEffect(() => {
    for (const overlayCanvas of [expectedOverlayRef.current, actualOverlayRef.current]) {
      const overlayContext = overlayCanvas?.getContext('2d');
      if (!overlayContext) {
        continue;
      }
      overlayContext.clearRect(0, 0, width, height);
      if (showOverlay && diffImageData) {
        overlayContext.putImageData(diffImageData, 0, 0);
      }
    }
  }, [diffImageData, height, showOverlay, width]);

  const onDiffComputed = React.useCallback((nextHasDiff: boolean, nextDiffImageData: ImageData | null) => {
    setHasDiff(nextHasDiff);
    setDiffImageData(nextDiffImageData);
    if (!nextHasDiff) {
      setShowOverlay(false);
    }
  }, []);

  return (
    <>
      <h3 className="compare-title">Test: {payload.testName}</h3>
      <div className="wrap">
        <div className="plot-panel expected">
          <div className="plot-header">
            <div className={'plot-label'}>Expected</div>
            <button
              className="plot-action-btn"
              type="button"
              onClick={() => setRenderExpectedSetupEvents((prev) => !prev)}
            >
              {renderExpectedSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
            </button>
          </div>
          <div className="canvas-stack">
            <canvas ref={expectedUPlotInstance} className="canvas" id="expected" width={width} height={height}></canvas>
            <canvas
              ref={expectedOverlayRef}
              className={`canvas diff-overlay-canvas${showOverlay && hasDiff ? ' is-visible' : ''}`}
              width={width}
              height={height}
              style={{ mixBlendMode: expectedBlendMode }}
            ></canvas>
            {showOverlay && hasDiff ? (
              <select
                className="overlay-blend-select"
                value={expectedBlendMode}
                onChange={(e) => setExpectedBlendMode(toOverlayBlendMode(e.target.value))}
              >
                {OVERLAY_BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    Blend: {mode}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>

        <div className="plot-panel actual">
          <div className="plot-header">
            <div className={'plot-label'}>Actual</div>
            <button
              className="plot-action-btn"
              type="button"
              onClick={() => setRenderActualSetupEvents((prev) => !prev)}
            >
              {renderActualSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
            </button>
          </div>
          <div className="canvas-stack">
            <canvas ref={actualUPlotInstance} className="canvas" id="actual" width={width} height={height}></canvas>
            <canvas
              ref={actualOverlayRef}
              className={`canvas diff-overlay-canvas${showOverlay && hasDiff ? ' is-visible' : ''}`}
              width={width}
              height={height}
              style={{ mixBlendMode: actualBlendMode }}
            ></canvas>
            {showOverlay && hasDiff ? (
              <select
                className="overlay-blend-select"
                value={actualBlendMode}
                onChange={(e) => setActualBlendMode(toOverlayBlendMode(e.target.value))}
              >
                {OVERLAY_BLEND_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    Blend: {mode}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
        <div className="diff-panel-wrap">
          <DiffCanvas
            width={width}
            height={height}
            expectedEvents={payload.expected}
            actualEvents={payload.actual}
            setupEvents={payload.uPlotCanvasEvents}
            showOverlay={showOverlay}
            onToggleOverlay={() => setShowOverlay((prev) => !prev)}
            renderDiffSetupEvents={renderDiffSetupEvents}
            onToggleDiffSetupEvents={() => setRenderDiffSetupEvents((prev) => !prev)}
            onDiffComputed={onDiffComputed}
          />
        </div>
      </div>
    </>
  );
}

function DiffCanvas({
  width,
  height,
  expectedEvents,
  actualEvents,
  setupEvents,
  showOverlay,
  onToggleOverlay,
  renderDiffSetupEvents,
  onToggleDiffSetupEvents,
  onDiffComputed,
}: {
  width: number;
  height: number;
  expectedEvents: CanvasEventArray;
  actualEvents: CanvasEventArray;
  setupEvents: CanvasRenderingContext2DEvent[];
  showOverlay: boolean;
  onToggleOverlay: () => void;
  renderDiffSetupEvents: boolean;
  onToggleDiffSetupEvents: () => void;
  onDiffComputed: (hasDiff: boolean, diffImageData: ImageData | null) => void;
}) {
  const diffCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [hasDiff, setHasDiff] = React.useState(false);
  const [diffImageData, setDiffImageData] = React.useState<ImageData | null>(null);

  React.useEffect(() => {
    const frameId = requestAnimationFrame(() => {
      const expectedScratchCanvas = document.createElement('canvas');
      expectedScratchCanvas.width = width;
      expectedScratchCanvas.height = height;
      const actualScratchCanvas = document.createElement('canvas');
      actualScratchCanvas.width = width;
      actualScratchCanvas.height = height;

      const expectedContext = expectedScratchCanvas.getContext('2d');
      const actualContext = actualScratchCanvas.getContext('2d');
      if (!expectedContext || !actualContext) {
        return;
      }

      if (renderDiffSetupEvents) {
        eventsToCanvasScript(setupEvents, expectedContext);
        eventsToCanvasScript(setupEvents, actualContext);
      }
      eventsToCanvasScript(expectedEvents, expectedContext);
      eventsToCanvasScript(actualEvents, actualContext);

      const expectedPixels = expectedContext.getImageData(0, 0, width, height);
      const actualPixels = actualContext.getImageData(0, 0, width, height);
      const diffPixels = expectedContext.createImageData(width, height);
      let hasDifferences = false;

      for (let i = 0; i < actualPixels.data.length; i += 4) {
        const isDifferent =
          expectedPixels.data[i] !== actualPixels.data[i] ||
          expectedPixels.data[i + 1] !== actualPixels.data[i + 1] ||
          expectedPixels.data[i + 2] !== actualPixels.data[i + 2] ||
          expectedPixels.data[i + 3] !== actualPixels.data[i + 3];

        if (isDifferent) {
          diffPixels.data[i] = actualPixels.data[i];
          diffPixels.data[i + 1] = actualPixels.data[i + 1];
          diffPixels.data[i + 2] = actualPixels.data[i + 2];
          diffPixels.data[i + 3] = actualPixels.data[i + 3];
          hasDifferences = true;
        }
      }

      setHasDiff(hasDifferences);
      const nextDiffImageData = hasDifferences ? diffPixels : null;
      setDiffImageData(nextDiffImageData);
      onDiffComputed(hasDifferences, nextDiffImageData);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [actualEvents, expectedEvents, height, onDiffComputed, renderDiffSetupEvents, setupEvents, width]);

  React.useEffect(() => {
    if (!hasDiff || !diffImageData) {
      return;
    }
    const diffContext = diffCanvasRef.current?.getContext('2d');
    if (!diffContext) {
      return;
    }
    diffContext.clearRect(0, 0, width, height);
    diffContext.putImageData(diffImageData, 0, 0);
  }, [diffImageData, hasDiff, height, width]);

  if (!hasDiff) {
    return (
      <div className="plot-panel diff diff-empty">
        <div className="plot-header">
          <div className={'plot-label'}>Diff</div>
          <div className="plot-actions">
            <button className="plot-action-btn" type="button" onClick={onToggleDiffSetupEvents}>
              {renderDiffSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
            </button>
            <button className="overlay-toggle-btn" type="button" onClick={onToggleOverlay} disabled>
              Overlay on charts
            </button>
          </div>
        </div>
        <div className="compare-empty-diff">No visual differences</div>
      </div>
    );
  }

  return (
    <div className="plot-panel diff">
      <div className="plot-header">
        <div className={'plot-label'}>Diff</div>
        <div className="plot-actions">
          <button className="plot-action-btn" type="button" onClick={onToggleDiffSetupEvents}>
            {renderDiffSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
          </button>
          <button className="overlay-toggle-btn" type="button" onClick={onToggleOverlay}>
            {showOverlay ? 'Hide overlay' : 'Overlay on charts'}
          </button>
        </div>
      </div>
      <canvas ref={diffCanvasRef} className="canvas" id="diff" width={width} height={height}></canvas>
    </div>
  );
}
