import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

import type { eventsToCanvasScript } from './canvasUtils.ts';

export type { UPlotComparePayload } from './exportedTypes.ts';

export type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

export type ResolvedPayload = {
  testName: string;
  testPath?: string;
  expected: CanvasEventArray;
  actual: CanvasEventArray;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  width?: number;
  height?: number;
  snapshotAssertionPassed?: boolean;
};

export type AcceptBaselineState =
  | { kind: 'idle' }
  | { kind: 'running'; updateSnapshot: boolean }
  | { kind: 'success'; updateSnapshot: boolean; stdout: string; stderr: string; command: string }
  | { kind: 'error'; updateSnapshot?: boolean; message: string; stdout: string; stderr: string; command?: string };

export interface ComparePlotsProps {
  defaultWidth: number;
  defaultHeight: number;
  payload: ResolvedPayload;
  acceptBaselineState: AcceptBaselineState;
  onRerunTest: () => void;
  onAcceptBaseline: () => void;
}
