import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps } from '../types.ts';

import { AssertionStatusBadge } from './AssertionStatusBadge.tsx';
import { CanvasStack } from './CanvasStack.tsx';
import { DiffCanvas } from './DiffCanvas.tsx';
import { JestActionsButtons, JestOutputModal } from './JestActions.tsx';
import { PlotHeader } from './PlotHeader.tsx';

export function ComparePlots({
  defaultWidth,
  defaultHeight,
  payload,
  acceptBaselineState,
  onBackToIndex,
  nextFailedTestBasename,
  onGoToNextFailedTest,
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
  const [jestModalDismissed, setJestModalDismissed] = useState(false);

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

  useEffect(() => {
    if (acceptBaselineState.kind === 'running') {
      setJestModalDismissed(false);
    }
  }, [acceptBaselineState.kind]);

  const jestModalOpen = acceptBaselineState.kind !== 'idle' && !jestModalDismissed;

  return (
    <>
      <div className="compare-title-row">
        <div className="compare-title-leading">
          <button type="button" className="compare-back-btn" onClick={onBackToIndex} aria-label="Back to payload list">
            ← Back
          </button>
          <h3 className="compare-title">Test: {payload.testName}</h3>
        </div>
        {payload.snapshotAssertionPassed !== undefined ? (
          <AssertionStatusBadge passed={payload.snapshotAssertionPassed} />
        ) : null}
        <div className="compare-title-actions">
          {payload.testPath && jestModalDismissed && (jestKind === 'success' || jestKind === 'error') ? (
            <button type="button" className="jest-view-output-btn" onClick={() => setJestModalDismissed(false)}>
              View jest output
            </button>
          ) : null}
          <JestActionsButtons
            passed={payload.snapshotAssertionPassed ?? false}
            kind={jestKind}
            onRerunTest={onRerunTest}
            updateSnapshot={jestUpdateSnapshot}
            onAcceptBaseline={onAcceptBaseline}
          />
          <button
            type="button"
            className="compare-next-failed-btn"
            disabled={nextFailedTestBasename === null}
            onClick={onGoToNextFailedTest}
            title={
              nextFailedTestBasename === null
                ? 'No other payload with a failing snapshot (or status still loading)'
                : 'Open the next payload whose snapshot assertion failed'
            }
          >
            Next failed test
          </button>
        </div>
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
              hasAxesEvents={!!payload.uPlotCanvasEvents.length}
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
            hasAxesEvents={!!payload.uPlotCanvasEvents.length}
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
          </div>
        ) : null}
      </div>
      <JestOutputModal
        open={jestModalOpen}
        onClose={() => setJestModalDismissed(true)}
        kind={jestKind}
        updateSnapshot={jestUpdateSnapshot}
        message={jestMessage}
        command={jestCommand}
        stdout={jestStdout}
        stderr={jestStderr}
      />
    </>
  );
}
