import { type PluginExtensionRegistries } from 'app/features/plugins/extensions/registry/types';

// Source-suite roots discover this manual mock; harness-only roots do not.
jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

jest.mock('@grafana/runtime/internal', () => ({
  ...jest.requireActual('@grafana/runtime/internal'),
  getAppPluginMetas: jest.fn(),
}));

const coreConfigModule = 'app/features/plugins/extensions/getCoreExtensionConfigurations';

function expectCoreLinksReady(registries: PluginExtensionRegistries) {
  const states: unknown[] = [];
  const subscription = registries.addedLinksRegistry.asObservable().subscribe((state) => {
    states.push(
      Object.values(state)
        .flat()
        .map(({ pluginId, title }) => ({ pluginId, title }))
    );
  });
  subscription.unsubscribe();

  expect(states).toEqual([
    [
      { pluginId: 'grafana', title: 'Add to dashboard' },
      { pluginId: 'grafana', title: 'Add correlation' },
      { pluginId: 'grafana', title: 'Add to notebook' },
    ],
  ]);
}

let fetchMock: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
  // Isolated imports can start background requests that outlive registry initialization.
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async () => {
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});

afterEach(() => {
  fetchMock.mockRestore();
  jest.dontMock(coreConfigModule);
});

it('loads core configurations only on initialization and resolves with the core links already registered', async () => {
  await jest.isolateModulesAsync(async () => {
    const loadCoreConfigs = jest.fn(() => jest.requireActual(coreConfigModule));
    jest.doMock(coreConfigModule, loadCoreConfigs);

    const { getAppPluginMetas } = await import('@grafana/runtime/internal');
    jest.mocked(getAppPluginMetas).mockResolvedValue([]);
    const { mockLogger } = await import('@grafana/test-utils/unstable');
    const logger = mockLogger('grafana/runtime.utils.getCachedPromise');
    const { getPluginExtensionRegistries, initRegistries } =
      await import('app/features/plugins/extensions/registry/setup');

    const emptyRegistries = initRegistries([]);
    expect(await emptyRegistries.addedLinksRegistry.getState()).toEqual({});
    expect(getAppPluginMetas).not.toHaveBeenCalled();
    expect(loadCoreConfigs).not.toHaveBeenCalled();

    const registries = await getPluginExtensionRegistries();

    expect(jest.mocked(logger.logError).mock.calls.map(([error]) => error.cause)).toEqual([]);
    expectCoreLinksReady(registries);
    expect(loadCoreConfigs).toHaveBeenCalledTimes(1);
  });
});

it('shares concurrent initialization and returns the cached registries without duplicating core links', async () => {
  await jest.isolateModulesAsync(async () => {
    const { getAppPluginMetas } = await import('@grafana/runtime/internal');
    jest.mocked(getAppPluginMetas).mockResolvedValue([]);
    const { getPluginExtensionRegistries } = await import('app/features/plugins/extensions/registry/setup');

    const [first, second, third] = await Promise.all([
      getPluginExtensionRegistries(),
      getPluginExtensionRegistries(),
      getPluginExtensionRegistries(),
    ]);
    const cached = await getPluginExtensionRegistries();

    expect(first).toBe(second);
    expect(second).toBe(third);
    expect(cached).toBe(first);
    expect(getAppPluginMetas).toHaveBeenCalledTimes(1);
    expectCoreLinksReady(first);
  });
});

it('logs a core-config load failure, returns empty registries, and retries successfully on the next request', async () => {
  await jest.isolateModulesAsync(async () => {
    const error = new Error('Core extension chunk failed to load');
    const loadCoreConfigs = jest
      .fn(() => jest.requireActual(coreConfigModule))
      .mockImplementationOnce(() => {
        throw error;
      });
    jest.doMock(coreConfigModule, loadCoreConfigs);

    const { getAppPluginMetas } = await import('@grafana/runtime/internal');
    jest.mocked(getAppPluginMetas).mockResolvedValue([]);
    const { TracedError } = await import('@grafana/runtime');
    const { mockLogger } = await import('@grafana/test-utils/unstable');
    const logger = mockLogger('grafana/runtime.utils.getCachedPromise');
    const { getPluginExtensionRegistries } = await import('app/features/plugins/extensions/registry/setup');

    const fallback = await getPluginExtensionRegistries();

    for (const registry of Object.values(fallback)) {
      expect(await registry.getState()).toEqual({});
    }
    expect(loadCoreConfigs).toHaveBeenCalledTimes(1);
    expect(logger.logError).toHaveBeenCalledTimes(1);
    expect(logger.logError).toHaveBeenCalledWith(
      expect.objectContaining({
        constructor: TracedError,
        message: 'getCachedPromise: Something failed while resolving a cached promise',
        cause: error,
      }),
      { key: expect.stringMatching(/^initPluginExtensionRegistries:-?\d+$/) }
    );

    const recovered = await getPluginExtensionRegistries();
    const cached = await getPluginExtensionRegistries();

    expectCoreLinksReady(recovered);
    expect(recovered).not.toBe(fallback);
    expect(cached).toBe(recovered);
    expect(loadCoreConfigs).toHaveBeenCalledTimes(2);
    expect(getAppPluginMetas).toHaveBeenCalledTimes(2);
    expect(logger.logError).toHaveBeenCalledTimes(1);
  });
});
