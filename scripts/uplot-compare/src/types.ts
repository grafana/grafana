import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import type { AlignedData } from 'uplot';

import type { eventsToCanvasScript } from './canvasUtils.ts';
import type { OVERLAY_BLEND_MODES } from './constants.ts';

export type { UPlotComparePayload } from './exportedTypes.ts';

export type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];
export type OverlayBlendMode = (typeof OVERLAY_BLEND_MODES)[number];

export type ResolvedPayload = {
  testName: string;
  expected: CanvasEventArray;
  actual: CanvasEventArray;
  uPlotData?: AlignedData;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  width?: number;
  height?: number;
};

export interface ComparePlotsProps {
  defaultWidth: number;
  defaultHeight: number;
  payload: ResolvedPayload;
}
