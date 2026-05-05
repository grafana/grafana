import type { CSSProperties } from 'react';

import { OverlayBlendSelect } from './OverlayBlendSelect.tsx';

export function PlotHeader(props: {
  onClick: () => void;
  renderSetupEvents: boolean;
  showBlend: boolean;
  mixBlendMode: CSSProperties['mixBlendMode'];
  onChangeBlendMode: (mode: CSSProperties['mixBlendMode']) => void;
  title: string;
  hasAxesEvents: boolean;
}) {
  return (
    <div className="plot-header">
      <div className={'plot-label'}>{props.title}</div>
      <div className={'plot-action-wrap'}>
        <button
          title={
            !props.hasAxesEvents
              ? 'No uPlot axes events available, this test is likely asserting axis behavior'
              : 'Toggle uplot events passed in from expected test execution'
          }
          disabled={!props.hasAxesEvents}
          className="plot-action-btn"
          type="button"
          onClick={props.onClick}
        >
          {props.renderSetupEvents ? 'Hide uPlot setup' : 'Show uPlot setup'}
        </button>
        {props.showBlend ? <OverlayBlendSelect value={props.mixBlendMode} onChange={props.onChangeBlendMode} /> : null}
      </div>
    </div>
  );
}
