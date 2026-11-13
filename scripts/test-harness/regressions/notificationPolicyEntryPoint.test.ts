import { type RouteWithID } from '@grafana/alerting';
import type * as PolicyUtilities from '@grafana/alerting/notification-policies';

beforeEach(() => {
  jest.resetModules();
});

afterEach(() => {
  jest.resetModules();
});

it('matches routes without loading alerting UI or API hooks', () => {
  const { findMatchingRoutes } = require('@grafana/alerting/notification-policies') as typeof PolicyUtilities;
  const route = {
    id: 'root',
    receiver: 'default',
    routes: [
      {
        id: 'first',
        receiver: 'first-team',
        matchers: [{ label: 'team', type: '=', value: 'operations' }],
        continue: true,
        routes: [],
      },
      { id: 'second', receiver: 'second-team', matchers: [{ label: 'team', type: '=', value: 'operations' }], routes: [] },
      { id: 'third', receiver: 'third-team', matchers: [{ label: 'team', type: '=', value: 'operations' }], routes: [] },
    ],
  } satisfies RouteWithID;

  expect(findMatchingRoutes(route, [['team', 'operations']]).map(({ route }) => route.id)).toEqual(['first', 'second']);
  expect(findMatchingRoutes(route, [['team', 'other']]).map(({ route }) => route.id)).toEqual(['root']);

  const loaded = Object.keys(require.cache).map((file) => file.replace(/\\/g, '/'));
  expect(loaded).toContain(require.resolve('@grafana/alerting/notification-policies').replace(/\\/g, '/'));
  expect(
    loaded.filter((file) =>
      /\/grafana-alerting\/src\/(?:index\.ts|grafana\/(?:api\/|rules\/components\/|notificationPolicies\/hooks\/))/.test(file)
    )
  ).toEqual([]);
});

it('reexports the same implementations as the existing public entry point', () => {
  const policies = require('@grafana/alerting/notification-policies') as typeof PolicyUtilities;
  const existing = require('@grafana/alerting') as typeof import('@grafana/alerting');

  expect(policies.findMatchingRoutes).toBe(existing.findMatchingRoutes);
  expect(policies.matchInstancesToRoute).toBe(existing.matchInstancesToRoute);
  expect(policies.getInheritedProperties).toBe(existing.getInheritedProperties);
  expect(policies.computeInheritedTree).toBe(existing.computeInheritedTree);
});
