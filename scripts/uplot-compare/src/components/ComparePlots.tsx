import * as React from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps, OverlayBlendMode } from '../types.ts';

import { DiffCanvas } from './DiffCanvas.tsx';

const OVERLAY_BLEND_MODES = ['plus-lighter', 'color', 'difference', 'exclusion', 'luminosity', 'screen'] as const;

function toOverlayBlendMode(value: string): OverlayBlendMode {
  return OVERLAY_BLEND_MODES.find((mode) => mode === value) ?? 'exclusion';
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

function CanvasStack(props: {
  uPlotRef: React.RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  overlayRef: React.RefObject<HTMLCanvasElement | null>;
  showOverlay: boolean;
  hasDiff: boolean;
  mixBlendMode: OverlayBlendMode;
  onChangeBlendMode: (mode: OverlayBlendMode) => void;
  id: string;
}) {
  return (
    <div className="canvas-stack">
      <canvas ref={props.uPlotRef} className="canvas" id={props.id} width={props.width} height={props.height}></canvas>
      <canvas
        ref={props.overlayRef}
        className={`canvas diff-overlay-canvas${props.showOverlay && props.hasDiff ? ' is-visible' : ''}`}
        width={props.width}
        height={props.height}
        style={{ mixBlendMode: props.mixBlendMode }}
      ></canvas>
      {props.showOverlay && props.hasDiff ? (
        <OverlayBlendSelect value={props.mixBlendMode} onChange={props.onChangeBlendMode} />
      ) : null}
    </div>
  );
}

export function ComparePlots({ defaultWidth, defaultHeight, payload }: ComparePlotsProps) {
  const width = payload.width ?? defaultWidth;
  const height = payload.height ?? defaultHeight;
  const actualUPlotRef = React.useRef<HTMLCanvasElement | null>(null);
  const expectedUPlotRef = React.useRef<HTMLCanvasElement | null>(null);
  const expectedOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const actualOverlayRef = React.useRef<HTMLCanvasElement | null>(null);
  const [showOverlay, setShowOverlay] = React.useState(false);
  const [expectedBlendMode, setExpectedBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [actualBlendMode, setActualBlendMode] = React.useState<OverlayBlendMode>('exclusion');
  const [renderExpectedSetupEvents, setRenderExpectedSetupEvents] = React.useState(true);
  const [renderActualSetupEvents, setRenderActualSetupEvents] = React.useState(true);
  const [renderDiffSetupEvents, setRenderDiffSetupEvents] = React.useState(true);

  useCanvasEventsEffect(actualUPlotRef, payload.actual, payload.uPlotCanvasEvents, renderActualSetupEvents);
  useCanvasEventsEffect(expectedUPlotRef, payload.expected, payload.uPlotCanvasEvents, renderExpectedSetupEvents);

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
          <CanvasStack
            id={'expected'}
            uPlotRef={expectedUPlotRef}
            width={width}
            height={height}
            overlayRef={expectedOverlayRef}
            showOverlay={showOverlay}
            hasDiff={hasDiff}
            mixBlendMode={expectedBlendMode}
            onChangeBlendMode={setExpectedBlendMode}
          />
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
          <CanvasStack
            id={'actual'}
            uPlotRef={actualUPlotRef}
            width={width}
            height={height}
            overlayRef={actualOverlayRef}
            showOverlay={showOverlay}
            hasDiff={hasDiff}
            mixBlendMode={actualBlendMode}
            onChangeBlendMode={setActualBlendMode}
          />
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
