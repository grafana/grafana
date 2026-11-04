import { type PluginExtensionAddedLinkConfig, type PluginExtensionEventHelpers } from '@grafana/data';
import type * as ExploreExtensionConfigs from 'app/features/explore/extensions/getExploreExtensionConfigs';

jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

const actionModule = 'app/features/explore/extensions/startCorrelation';

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.dontMock(actionModule);
  jest.resetModules();
});

function correlationLink(): PluginExtensionAddedLinkConfig {
  const { getExploreExtensionConfigs } =
    require('app/features/explore/extensions/getExploreExtensionConfigs') as typeof ExploreExtensionConfigs;
  const link = getExploreExtensionConfigs().find(({ title }) => title === 'Add correlation');
  expect(link).toBeDefined();
  return link!;
}

function helpers(exploreId: string): PluginExtensionEventHelpers {
  return {
    context: { exploreId },
    extensionPointId: 'grafana/explore/toolbar/action',
    openModal: jest.fn(),
    openSidebar: jest.fn(),
    closeSidebar: jest.fn(),
    toggleSidebar: jest.fn(),
  };
}

it('defers query execution imports until a click and enables editing before creating the query thunk', async () => {
  const loadAction = jest.fn(() => jest.requireActual(actionModule));
  jest.doMock(actionModule, loadAction);
  const link = correlationLink();

  expect(loadAction).not.toHaveBeenCalled();
  expect(require.cache[require.resolve('app/features/explore/state/query')]).toBeUndefined();
  expect(link.configure?.({ shouldShowAddCorrelation: false })).toBeUndefined();
  expect(link.configure?.({ shouldShowAddCorrelation: true })).toEqual({});

  const store = await import('app/store/store');
  const query = await import('app/features/explore/state/query');
  const dispatch = jest.spyOn(store, 'dispatch').mockImplementation((action) => action);
  const runQueries = jest.spyOn(query, 'runQueries');

  await link.onClick?.(undefined, helpers('right'));

  expect(loadAction).toHaveBeenCalledTimes(1);
  expect(dispatch).toHaveBeenCalledTimes(2);
  expect(dispatch).toHaveBeenNthCalledWith(1, {
    type: 'explore/changeCorrelationEditorDetails',
    payload: { editorMode: true },
  });
  expect(runQueries).toHaveBeenCalledWith({ exploreId: 'right' });
  expect(dispatch.mock.invocationCallOrder[0]).toBeLessThan(runQueries.mock.invocationCallOrder[0]);
  expect(runQueries.mock.results[0].value).toEqual(expect.any(Function));
  expect(dispatch).toHaveBeenNthCalledWith(2, runQueries.mock.results[0].value);
});

it('returns chunk-load failures to the extension click error handler', async () => {
  const error = new Error('Correlation action chunk failed');
  const loadAction = jest.fn(() => {
    throw error;
  });
  jest.doMock(actionModule, loadAction);
  const link = correlationLink();

  expect(loadAction).not.toHaveBeenCalled();
  await expect(link.onClick?.(undefined, helpers('left'))).rejects.toBe(error);
  expect(loadAction).toHaveBeenCalledTimes(1);
});
