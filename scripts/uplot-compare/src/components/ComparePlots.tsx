import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps } from '../types.ts';

import { AssertionStatusBadge } from './AssertionStatusBadge.tsx';
import { CanvasStack } from './CanvasStack.tsx';
import { DiffCanvas } from './DiffCanvas.tsx';
import { JestActions } from './JestActions.tsx';
import { PlotHeader } from './PlotHeader.tsx';

export function ComparePlots({
  defaultWidth,
  defaultHeight,
  payload,
  acceptBaselineState,
  onRerunTest,
  onAcceptBaseline,
}: ComparePlotsProps) {
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

  const showActualOnly = payload.snapshotAssertionPassed === true;

  const jestKind: 'idle' | 'running' | 'success' | 'error' =
    acceptBaselineState.kind === 'idle'
      ? 'idle'
      : acceptBaselineState.kind === 'running'
        ? 'running'
        : acceptBaselineState.kind === 'success'
          ? 'success'
          : 'error';

  const jestUpdateSnapshot = acceptBaselineState.kind === 'idle' ? undefined : acceptBaselineState.updateSnapshot;

  const jestMessage = acceptBaselineState.kind === 'error' ? acceptBaselineState.message : undefined;

  const jestCommand =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error'
      ? acceptBaselineState.command
      : undefined;

  const jestStdout =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error' ? acceptBaselineState.stdout : '';

  const jestStderr =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error' ? acceptBaselineState.stderr : '';

  return (
    <>
      <div className="compare-title-row">
        <h3 className="compare-title">Test: {payload.testName}</h3>
        {payload.snapshotAssertionPassed !== undefined ? (
          <AssertionStatusBadge passed={payload.snapshotAssertionPassed} />
        ) : null}
      </div>
      <div className={`wrap${showActualOnly ? ' wrap--actual-only' : ''}`}>
        {!showActualOnly ? (
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
        ) : null}

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
        {!showActualOnly ? (
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
            <JestActions
              testPath={payload.testPath}
              kind={jestKind}
              onRerunTest={onRerunTest}
              updateSnapshot={jestUpdateSnapshot}
              onAcceptBaseline={onAcceptBaseline}
              message={jestMessage}
              command={jestCommand}
              stdout={jestStdout}
              stderr={jestStderr}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
