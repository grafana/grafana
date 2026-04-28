import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

/** JSON payload written for `yarn workspace uplot-compare dev` when a uPlot canvas snapshot fails locally. */
export interface UPlotComparePayload {
  testName: string;
  /** Absolute path to the test file; used by uplot-compare to run `jest -u` for Accept baseline. */
  testPath?: string;
  expected: unknown;
  actual: unknown;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  /** uPlot `width` / `height` (CSS px) for the test canvas; used by uplot-compare to size replay canvases */
  width: number;
  height: number;
}
