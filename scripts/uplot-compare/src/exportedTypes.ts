import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

/** JSON payload written for `yarn workspace uplot-compare dev` when a uPlot canvas snapshot fails locally. */
export interface UPlotComparePayload {
  testName: string;
  expected: unknown;
  actual: unknown;
  uPlotData?: unknown;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  /** uPlot `width` / `height` (CSS px) for the test canvas; used by uplot-compare to size replay canvases */
  width: number;
  height: number;
}
