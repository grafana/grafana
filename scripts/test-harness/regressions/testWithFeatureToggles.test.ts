import { testWithFeatureToggles } from 'test/helpers/testWithFeatureToggles';

import { config } from '@grafana/runtime';

const initialToggles = {
  panelTitleSearch: false,
  publicDashboardsEmailSharing: true,
  lokiExperimentalStreaming: true,
  canvasPanelNesting: true,
};

const cases: Array<{
  name: string;
  options: Parameters<typeof testWithFeatureToggles>[0];
  expected: typeof config.featureToggles;
}> = [
  {
    name: 'enable without disable',
    options: { enable: ['panelTitleSearch'] },
    expected: { panelTitleSearch: true },
  },
  {
    name: 'disable without enable',
    options: { disable: ['publicDashboardsEmailSharing'] },
    expected: { publicDashboardsEmailSharing: false },
  },
  {
    name: 'disable takes precedence over enable',
    options: {
      enable: ['panelTitleSearch', 'lokiExperimentalStreaming'],
      disable: ['publicDashboardsEmailSharing', 'lokiExperimentalStreaming'],
    },
    expected: {
      panelTitleSearch: true,
      publicDashboardsEmailSharing: false,
      lokiExperimentalStreaming: false,
    },
  },
  { name: 'neither option', options: {}, expected: {} },
];

describe('testWithFeatureToggles lifecycle', () => {
  const originalToggles = config.featureToggles;

  beforeEach(() => {
    config.featureToggles = { ...initialToggles };
  });

  // An ancestor's teardown runs after the helper's nested teardown.
  afterEach(() => {
    expect(config.featureToggles).toEqual({});
  });

  afterAll(() => {
    config.featureToggles = originalToggles;
  });

  describe.each(cases)('$name', ({ options, expected }) => {
    testWithFeatureToggles(options);

    it.each([1, 2])('applies options before test %i and leaves unrelated toggles unchanged', () => {
      expect(config.featureToggles).toEqual({ ...initialToggles, ...expected });

      config.featureToggles.panelTitleSearch = false;
      config.featureToggles.publicDashboardsEmailSharing = true;
      config.featureToggles.lokiExperimentalStreaming = true;
      config.featureToggles.canvasPanelNesting = false;
      config.featureToggles.cloudWatchCrossAccountQuerying = true;
    });
  });
});

describe('testWithFeatureToggles entry point', () => {
  beforeEach(() => {
    // require.cache exposes the normal Jest registry, not the isolateModules registry.
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  it('loads the narrow helper without loading render utilities or store configuration', () => {
    const helperPath = require.resolve('test/helpers/testWithFeatureToggles');
    const renderUtilsPath = require.resolve('test/test-utils');
    const configureStorePath = require.resolve('app/store/configureStore');

    expect(require.cache[helperPath]).toBeUndefined();
    expect(require.cache[renderUtilsPath]).toBeUndefined();
    expect(require.cache[configureStorePath]).toBeUndefined();

    const helper =
      require('test/helpers/testWithFeatureToggles') as typeof import('test/helpers/testWithFeatureToggles');

    expect(helper.testWithFeatureToggles).toEqual(expect.any(Function));
    expect(require.cache[helperPath]?.exports).toBe(helper);
    expect(require.cache[renderUtilsPath]).toBeUndefined();
    expect(require.cache[configureStorePath]).toBeUndefined();
  });
});
