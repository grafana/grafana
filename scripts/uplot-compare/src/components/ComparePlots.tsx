import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import * as React from 'react';
import type uPlot from 'uplot';
import type { AlignedData } from 'uplot';

import { type eventsToCanvasScript } from '../canvasUtils.ts';
import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';

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

interface OverlayBlendSelectProps {
  value: OverlayBlendMode;
  onChange: (mode: OverlayBlendMode) => void;
}

function OverlayBlendSelect({ value, onChange }: OverlayBlendSelectProps) {
  return (
    <select
      className="overlay-blend-select"
      value={value}
      onChange={(e) => onChange(toOverlayBlendMode(e.target.value))}
    >
      {OVERLAY_BLEND_MODES.map((mode) => (
        <option key={mode} value={mode}>
          Blend: {mode}
        </option>
      ))}
    </select>
  );
}

export function ComparePlots({ defaultWidth, defaultHeight, payload }: ComparePlotsProps) {
  const width = payload.width ?? defaultWidth;
  const height = payload.height ?? defaultHeight;
  const actualUPlotInstance = React.useRef<HTMLCanvasElement | null>(null);
  const expectedUPlotInstance = React.useRef<HTMLCanvasElement | null>(null);
  const expectedOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const actualOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [expectedBlendMode, setExpectedBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [actualBlendMode, setActualBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [renderExpectedSetupEvents, setRenderExpectedSetupEvents] = React.useState(true);
  const [renderActualSetupEvents, setRenderActualSetupEvents] = React.useState(true);
  const [renderDiffSetupEvents, setRenderDiffSetupEvents] = React.useState(true);

  useCanvasEventsEffect(actualUPlotInstance, payload.actual, payload.uPlotCanvasEvents, renderActualSetupEvents);
  useCanvasEventsEffect(expectedUPlotInstance, payload.expected, payload.uPlotCanvasEvents, renderExpectedSetupEvents);

  const { hasDiff, diffImageData } = useDiffImageData({
    expectedEvents: payload.expected,
    actualEvents: payload.actual,
    setupEvents: payload.uPlotCanvasEvents,
    includeSetup: renderDiffSetupEvents,
    width,
    height,
  });

  React.useEffect(() => {
    if (!hasDiff && showOverlay) {
      setShowOverlay(false);
    }
  }, [hasDiff, showOverlay]);

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
              <OverlayBlendSelect value={expectedBlendMode} onChange={setExpectedBlendMode} />
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
              <OverlayBlendSelect value={actualBlendMode} onChange={setActualBlendMode} />
            ) : null}
          </div>
        </div>
        <div className="diff-panel-wrap">
          <DiffCanvas
            width={width}
            height={height}
            hasDiff={hasDiff}
            diffImageData={diffImageData}
            showOverlay={showOverlay}
            onToggleOverlay={() => setShowOverlay((prev) => !prev)}
            renderDiffSetupEvents={renderDiffSetupEvents}
            onToggleDiffSetupEvents={() => setRenderDiffSetupEvents((prev) => !prev)}
          />
        </div>
      </div>
    </>
  );
}
