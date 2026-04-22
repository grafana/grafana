import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import * as React from 'react';

import { eventsToCanvasScript } from '../canvasUtils.ts';

type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

interface DiffCanvasProps {
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
}

export function DiffCanvas({
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
}: DiffCanvasProps) {
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
