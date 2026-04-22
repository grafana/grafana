import * as React from 'react';
import type uPlot from 'uplot';
import type { AlignedData } from 'uplot';

import { UPlotChart, UPlotConfigBuilder } from '@grafana/ui';

import { eventsToCanvasScript } from '../canvasUtils.ts';

/** Minimal demo data when `uPlotData` query param is omitted (ms timestamps, two points). */
const defaultAlignedData = (): AlignedData => {
  const t1 = Date.now() - 60_000;
  const t2 = Date.now();
  return [
    [t1, t2],
    [1, 2],
  ];
};

interface Props {
  height: number;
  width: number;
}

/**
 * Static site component, DO NOT EVER USE THIS IN GRAFANA
 * @param height
 * @param width
 * @constructor
 */
export const Compare = ({ height, width }: Props) => {
  function getUrlVars(varName: string) {
    const search = new URLSearchParams(window.location.search);
    return search.get(varName);
  }

  const testNameEncoded = getUrlVars('testName');
  const testName = testNameEncoded ? decodeURIComponent(testNameEncoded) : '';
  const expectedCanvasJSON = getUrlVars('expected');
  const actualCanvasJSON = getUrlVars('actual');
  const dataUrl = getUrlVars('uPlotData');
  const seriesUrl = getUrlVars('uPlotSeries');

  if (!expectedCanvasJSON) {
    throw new Error('`expected` url param is required!');
  }
  if (!actualCanvasJSON) {
    throw new Error('`actual` url param is required!');
  }

  const expectedCanvasCalls = eventsToCanvasScript(JSON.parse(expectedCanvasJSON), 'expected');
  const actualCanvasCalls = eventsToCanvasScript(JSON.parse(actualCanvasJSON), 'actual');

  const actualUPlotInstance = React.useRef<uPlot | null>(null);
  const expectedUPlotInstance = React.useRef<uPlot | null>(null);

  React.useEffect(() => {
    if (actualCanvasCalls) {
      // @ts-expect-error eval script expects variable named `actual`
      const actual = actualUPlotInstance.current?.ctx;
      // eslint-disable-next-line no-eval
      eval(actualCanvasCalls);
    }
  }, [actualCanvasCalls, actualCanvasJSON]);

  React.useEffect(() => {
    if (expectedCanvasCalls) {
      // @ts-expect-error eval script expects variable named `expected`
      const expected = expectedUPlotInstance.current?.ctx;
      // eslint-disable-next-line no-eval
      eval(expectedCanvasCalls);
    }
  }, [expectedCanvasCalls, expectedCanvasJSON]);

  const plotData: AlignedData = React.useMemo(() => {
    if (dataUrl) {
      return JSON.parse(dataUrl);
    }
    return defaultAlignedData();
  }, [dataUrl]);

  const config = React.useMemo(() => {
    const c = new UPlotConfigBuilder();
    const series = seriesUrl ? JSON.parse(seriesUrl) : undefined;
    if (series) {
      c.addSeries(series);
    }
    return c;
  }, [seriesUrl]);

  return (
    <>
      <h3>Test: {testName}</h3>
      {/* @todo link to test file */}
      <div className="wrap">
        <div className={'expected'}>
          <div className={'plot-label'}>Expected</div>
          <UPlotChart
            config={config}
            data={plotData}
            width={width}
            height={height}
            plotRef={(u) => {
              expectedUPlotInstance.current = u;
            }}
          />
        </div>
        <div className="actual">
          <div className={'plot-label'}>Actual</div>
          <UPlotChart
            config={config}
            data={plotData}
            width={width}
            height={height}
            plotRef={(u) => {
              actualUPlotInstance.current = u;
            }}
          />
        </div>
      </div>
    </>
  );
};
