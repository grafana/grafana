import * as React from 'react';

interface DiffCanvasProps {
  width: number;
  height: number;
  hasDiff: boolean;
  diffImageData: ImageData | null;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  renderDiffSetupEvents: boolean;
  onToggleDiffSetupEvents: () => void;
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
}: DiffCanvasProps) {
  const diffCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

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
