import { Differ, Viewer } from 'json-diff-kit';
import * as React from 'react';
import 'json-diff-kit/dist/viewer.css';

import type { CanvasEventArray } from '../types.ts';

interface DiffCanvasProps {
  width: number;
  height: number;
  hasDiff: boolean;
  diffImageData: ImageData | null;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  renderDiffSetupEvents: boolean;
  onToggleDiffSetupEvents: () => void;
  expected?: CanvasEventArray;
  actual?: CanvasEventArray;
}

export function DiffCanvas({
  width,
  height,
  hasDiff,
  diffImageData,
  showOverlay,
  onToggleOverlay,
  renderDiffSetupEvents,
  onToggleDiffSetupEvents,
  expected,
  actual,
}: DiffCanvasProps) {
  const diffCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  const differ = React.useMemo(
    () =>
      new Differ({
        detectCircular: true,
        maxDepth: Infinity,
        showModifications: true,
        arrayDiffMethod: 'lcs',
      }),
    []
  );

  const diff = React.useMemo(() => differ.diff(expected, actual), [differ, expected, actual]);

  React.useEffect(() => {
    const diffContext = diffCanvasRef.current?.getContext('2d');
    if (!diffContext) {
      return;
    }
    diffContext.clearRect(0, 0, width, height);
    if (diffImageData) {
      diffContext.putImageData(diffImageData, 0, 0);
    }
  }, [diffImageData, height, width]);

  if (!hasDiff) {
    return (
      <div className="plot-panel diff diff-empty">
        <div className="plot-header">
          <div className={'plot-label'}>Diff</div>
        </div>
        <Viewer diff={diff} />
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
