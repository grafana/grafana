import type * as FeatureFlags from '@grafana/test-utils/feature-flags';

beforeEach(() => {
  // require.cache exposes the normal Jest registry, not the isolateModules registry.
  jest.resetModules();
});

afterEach(async () => {
  const { OpenFeature } = require('@openfeature/react-sdk') as typeof import('@openfeature/react-sdk');
  await OpenFeature.clearProviders();
  jest.resetModules();
});

it.each([
  ['@grafana/test-utils/feature-flags', '@grafana/test-utils/unstable'],
  ['@grafana/test-utils/unstable', '@grafana/test-utils/feature-flags'],
])('shares helper identities and provider state when %s loads before %s', (firstPath, secondPath) => {
  const first = require(firstPath) as typeof FeatureFlags;
  const { OpenFeature } = require('@openfeature/react-sdk') as typeof import('@openfeature/react-sdk');
  const firstClient = first.getTestFeatureFlagClient();
  const provider = OpenFeature.getProvider('internal-grafana-core');
  first.setTestFlags({ 'entrypoint.enabled': true, 'entrypoint.label': 'first' });

  const second = require(secondPath) as typeof FeatureFlags;
  expect(second.setTestFlags).toBe(first.setTestFlags);
  expect(second.testWithFlags).toBe(first.testWithFlags);
  expect(second.getTestFeatureFlagClient).toBe(first.getTestFeatureFlagClient);

  const secondClient = second.getTestFeatureFlagClient();
  expect(OpenFeature.getProvider('internal-grafana-core')).toBe(provider);
  expect(secondClient.getBooleanValue('entrypoint.enabled', false)).toBe(true);
  expect(secondClient.getStringValue('entrypoint.label', 'missing')).toBe('first');

  second.setTestFlags({ 'entrypoint.enabled': false, 'entrypoint.label': 'second' });
  expect(firstClient.getBooleanValue('entrypoint.enabled', true)).toBe(false);
  expect(firstClient.getStringValue('entrypoint.label', 'missing')).toBe('second');
  expect(OpenFeature.getProvider('internal-grafana-core')).toBe(provider);

  second.setTestFlags({});
  expect(firstClient.getStringValue('entrypoint.label', 'missing')).toBe('missing');
  expect(secondClient.getStringValue('entrypoint.label', 'missing')).toBe('missing');
});

it('evaluates flags through the supported entry point without loading handlers, fixtures, MSW, or Chance', () => {
  const { getTestFeatureFlagClient, setTestFlags } =
    require('@grafana/test-utils/feature-flags') as typeof FeatureFlags;
  setTestFlags({ 'entrypoint.enabled': true });
  expect(getTestFeatureFlagClient().getBooleanValue('entrypoint.enabled', false)).toBe(true);

  const loadedModules = Object.keys(require.cache).map((file) => file.replace(/\\/g, '/'));
  expect(loadedModules).toContain(require.resolve('@grafana/test-utils/feature-flags').replace(/\\/g, '/'));
  expect(
    loadedModules.filter(
      (file) =>
        /\/grafana-test-utils\/src\/(?:unstable\.ts|handlers\/|fixtures\/|server\/|worker\/)/.test(file) ||
        /\/node_modules\/(?:msw|chance)\//.test(file)
    )
  ).toEqual([]);
});
