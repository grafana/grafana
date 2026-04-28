import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps } from '../types.ts';

import { CanvasStack } from './CanvasStack.tsx';
import { DiffCanvas } from './DiffCanvas.tsx';
import { PlotHeader } from './PlotHeader.tsx';

function JestActions(props: {
  testPath: string | undefined;
  kind: 'idle' | 'running' | 'success' | 'error';
  onRerunTest: () => void;
  updateSnapshot?: boolean;
  onAcceptBaseline: () => void;
  message: string | null;
  command: string | undefined;
  stdout: string;
  stderr: string;
}) {
  return (
    <div className="accept-baseline-panel">
      <div className="accept-baseline-actions">
        <button
          type="button"
          className="jest-rerun-btn"
          disabled={!props.testPath || props.kind === 'running'}
          title={
            props.testPath
              ? 'Run jest for this test only (does not update snapshots)'
              : 'Re-run the failing test to regenerate the payload with testPath'
          }
          onClick={props.onRerunTest}
        >
          {props.kind === 'running' && !props.updateSnapshot ? 'Running jest…' : 'Re-run test'}
        </button>
        <button
          type="button"
          className="accept-baseline-btn"
          disabled={!props.testPath || props.kind === 'running'}
          title={
            props.testPath
              ? 'Run jest with --updateSnapshot for this test only'
              : 'Re-run the failing test to regenerate the payload with testPath'
          }
          onClick={props.onAcceptBaseline}
        >
          {props.kind === 'running' && props.updateSnapshot ? 'Running jest -u…' : 'Accept baseline (jest -u)'}
        </button>
      </div>
      {props.kind === 'success' && props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Snapshot updated. Payload kept; re-run the test to verify.
        </p>
      ) : null}
      {props.kind === 'success' && !props.updateSnapshot ? (
        <p className="accept-baseline-success" role="status">
          Test passed. Snapshot was not updated. If it still fails, a new compare payload is written on the next
          failure.
        </p>
      ) : null}
      {props.kind === 'error' ? (
        <p className="accept-baseline-error" role="alert">
          {props.message}
        </p>
      ) : null}
      {props.kind === 'success' || props.kind === 'error' ? (
        <details className="accept-baseline-output">
          <summary>jest output</summary>
          {props.command ? <pre className="accept-baseline-command">{props.command}</pre> : null}
          {props.stdout ? <pre className="accept-baseline-stdout">{props.stdout}</pre> : null}
          {props.stderr ? <pre className="accept-baseline-stderr">{props.stderr}</pre> : null}
        </details>
      ) : null}
    </div>
  );
}

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
          />
          {(acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error') && (
            <JestActions
              testPath={payload.testPath}
              kind={acceptBaselineState.kind}
              onRerunTest={onRerunTest}
              updateSnapshot={acceptBaselineState.updateSnapshot}
              onAcceptBaseline={onAcceptBaseline}
              message={acceptBaselineState.message}
              command={acceptBaselineState.command}
              stdout={acceptBaselineState.stdout}
              stderr={acceptBaselineState.stderr}
            />
          )}
        </div>
      </div>
    </>
  );
}
