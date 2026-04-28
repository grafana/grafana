import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps } from '../types.ts';

import { CanvasStack } from './CanvasStack.tsx';
import { DiffCanvas } from './DiffCanvas.tsx';
import { PlotHeader } from './PlotHeader.tsx';

export function ComparePlots({ defaultWidth, defaultHeight, payload }: ComparePlotsProps) {
  const width = payload.width ?? defaultWidth;
  const height = payload.height ?? defaultHeight;
  const actualUPlotRef = useRef<HTMLCanvasElement | null>(null);
  const expectedUPlotRef = useRef<HTMLCanvasElement | null>(null);
  const expectedOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const actualOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [blendMode, setBlendMode] = useState<CSSProperties['mixBlendMode']>('exclusion');
  const [renderExpectedSetupEvents, setRenderExpectedSetupEvents] = useState(true);
  const [renderActualSetupEvents, setRenderActualSetupEvents] = useState(true);
  const [renderDiffSetupEvents, setRenderDiffSetupEvents] = useState(true);

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

  useEffect(() => {
    if (!hasDiff && showOverlay) {
      setShowOverlay(false);
    }
  }, [hasDiff, showOverlay]);

  useEffect(() => {
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
          <PlotHeader
            title={'Expected'}
            onClick={() => setRenderExpectedSetupEvents((prev) => !prev)}
            renderSetupEvents={renderExpectedSetupEvents}
            mixBlendMode={blendMode}
            onChangeBlendMode={setBlendMode}
            showBlend={showOverlay && hasDiff}
          />
          <CanvasStack
            uPlotRef={expectedUPlotRef}
            width={width}
            height={height}
            overlayRef={expectedOverlayRef}
            showOverlay={showOverlay}
            hasDiff={hasDiff}
            mixBlendMode={blendMode}
          />
        </div>

        <div className="plot-panel actual">
          <PlotHeader
            title={'Actual'}
            onClick={() => setRenderActualSetupEvents((prev) => !prev)}
            renderSetupEvents={renderActualSetupEvents}
            mixBlendMode={blendMode}
            onChangeBlendMode={setBlendMode}
            showBlend={showOverlay && hasDiff}
          />
          <CanvasStack
            uPlotRef={actualUPlotRef}
            width={width}
            height={height}
            overlayRef={actualOverlayRef}
            showOverlay={showOverlay}
            hasDiff={hasDiff}
            mixBlendMode={blendMode}
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
            expected={payload.expected}
            actual={payload.actual}
          />
        </div>
      </div>
    </>
  );
}
