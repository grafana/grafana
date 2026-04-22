import type { OverlayBlendMode } from '../types.ts';

import { OverlayBlendSelect } from './OverlayBlendSelect.tsx';

export function PlotHeader(props: {
  onClick: () => void;
  renderActualSetupEvents: boolean;
  showBlend: boolean;
  mixBlendMode: OverlayBlendMode;
  onChangeBlendMode: (mode: OverlayBlendMode) => void;
}) {
  return (
    <div className="plot-header">
      <div className={'plot-label'}>Actual</div>
      <div className={'plot-action-wrap'}>
        <button className="plot-action-btn" type="button" onClick={props.onClick}>
          {props.renderActualSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
        </button>
        {props.showBlend ? <OverlayBlendSelect value={props.mixBlendMode} onChange={props.onChangeBlendMode} /> : null}
      </div>
    </div>
  );
}
