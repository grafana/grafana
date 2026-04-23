import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import * as React from 'react';

import { eventsToCanvasScript } from '../canvasUtils.ts';

type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

interface UseDiffImageDataArgs {
  expectedEvents: CanvasEventArray;
  actualEvents: CanvasEventArray;
  setupEvents: CanvasRenderingContext2DEvent[];
  includeSetup: boolean;
  width: number;
  height: number;
}

export interface DiffImageDataResult {
  diffImageData: ImageData | null;
  hasDiff: boolean;
}

const EMPTY_RESULT: DiffImageDataResult = { diffImageData: null, hasDiff: false };

export function useDiffImageData({
  expectedEvents,
  actualEvents,
  setupEvents,
  includeSetup,
  width,
  height,
}: UseDiffImageDataArgs): DiffImageDataResult {
  const [result, setResult] = React.useState<DiffImageDataResult>(EMPTY_RESULT);

  React.useEffect(() => {
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

    if (includeSetup) {
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

    setResult({
      hasDiff: hasDifferences,
      diffImageData: hasDifferences ? diffPixels : null,
    });
  }, [actualEvents, expectedEvents, height, includeSetup, setupEvents, width]);

  return result;
}
