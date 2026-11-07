import { type BaseQueryApi } from '@reduxjs/toolkit/query';

beforeEach(() => {
  // require.cache reflects the normal registry; reset it to separate the boundary and barrel checks.
  jest.resetModules();
});

afterEach(() => {
  jest.resetModules();
});

it('executes queries and returns backend errors without initializing generated API clients', async () => {
  const { createBaseQuery } =
    require('@grafana/api-clients/rtkq/createBaseQuery') as typeof import('@grafana/api-clients/rtkq/createBaseQuery');
  const { getBackendSrv, setBackendSrv } = require('@grafana/runtime') as typeof import('@grafana/runtime');
  const { of, throwError } = require('rxjs') as typeof import('rxjs');
  const fetch = jest.fn().mockReturnValue(
    of({
      data: { uid: 'dashboard-1', title: 'Overview' },
      status: 200,
      traceId: 'base-query-trace',
    })
  );
  setBackendSrv({ ...getBackendSrv(), fetch });

  const api: BaseQueryApi = {
    signal: new AbortController().signal,
    abort: jest.fn(),
    dispatch: jest.fn(),
    getState: () => ({}),
    extra: undefined,
    endpoint: 'getDashboard',
    type: 'query',
  };
  const query = createBaseQuery({ baseURL: '/api' });
  const request = { url: '/dashboards/uid/dashboard-1', params: { accesscontrol: true } };

  expect(await query(request, api, {})).toEqual({
    data: { uid: 'dashboard-1', title: 'Overview' },
    meta: { status: 200, traceId: 'base-query-trace' },
  });
  expect(fetch.mock.calls).toEqual([
    [
      {
        url: '/api/dashboards/uid/dashboard-1',
        params: { accesscontrol: true },
        method: 'GET',
        showErrorAlert: false,
        data: undefined,
        headers: {},
      },
    ],
  ]);

  const error = new Error('Backend unavailable');
  fetch.mockReturnValueOnce(throwError(() => error));
  expect(await query(request, api, {})).toEqual({ error });

  const loadedModules = Object.keys(require.cache).map((file) => file.replace(/\\/g, '/'));
  expect(loadedModules).toContain(require.resolve('@grafana/api-clients/rtkq/createBaseQuery').replace(/\\/g, '/'));
  expect(
    loadedModules.filter((file) =>
      /\/grafana-api-clients\/src\/clients\/rtkq\/(?:index\.ts|.*\/(?:baseAPI\.ts|endpoints\.gen\.ts))$/.test(file)
    )
  ).toEqual([]);
});

it('preserves the createBaseQuery identity exported by the RTKQ barrel', () => {
  const narrow =
    require('@grafana/api-clients/rtkq/createBaseQuery') as typeof import('@grafana/api-clients/rtkq/createBaseQuery');
  const existing = require('@grafana/api-clients/rtkq') as typeof import('@grafana/api-clients/rtkq');

  expect(narrow.createBaseQuery).toBe(existing.createBaseQuery);
});
