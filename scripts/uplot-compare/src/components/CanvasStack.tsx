import type { RefObject } from 'react';

import type { OverlayBlendMode } from '../types.ts';

import { OverlayBlendSelect } from './OverlayBlendSelect.tsx';

export function CanvasStack(props: {
  uPlotRef: RefObject<HTMLCanvasElement | null>;
  width: number;
  height: number;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  showOverlay: boolean;
  hasDiff: boolean;
  mixBlendMode: OverlayBlendMode;
  onChangeBlendMode: (mode: OverlayBlendMode) => void;
}) {
  return (
    <div className="canvas-stack">
      <canvas ref={props.uPlotRef} className="canvas" width={props.width} height={props.height}></canvas>
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
