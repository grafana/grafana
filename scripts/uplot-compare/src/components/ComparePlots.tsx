import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import * as React from 'react';
import type uPlot from 'uplot';
import type { AlignedData } from 'uplot';

import { eventsToCanvasScript } from '../canvasUtils.ts';

import { DiffCanvas } from './DiffCanvas.tsx';

type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

const OVERLAY_BLEND_MODES = ['plus-lighter', 'color', 'difference', 'exclusion', 'luminosity', 'screen'] as const;
type OverlayBlendMode = (typeof OVERLAY_BLEND_MODES)[number];

function toOverlayBlendMode(value: string): OverlayBlendMode {
  return OVERLAY_BLEND_MODES.find((mode) => mode === value) ?? 'exclusion';
}

export type ResolvedPayload = {
  testName: string;
  expected: CanvasEventArray;
  actual: CanvasEventArray;
  uPlotData?: AlignedData;
  uPlotSeries?: uPlot.Series[];
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  width?: number;
  height?: number;
};

interface ComparePlotsProps {
  defaultWidth: number;
  defaultHeight: number;
  payload: ResolvedPayload;
}

export function ComparePlots({ defaultWidth, defaultHeight, payload }: ComparePlotsProps) {
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
