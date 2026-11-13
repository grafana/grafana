import { serializeRequests } from '../../../public/app/features/alerting/unified/mocks/server/events';

describe('serializeRequests', () => {
  it.each([
    { name: 'absent DELETE body', method: 'DELETE', body: undefined, expectedBody: '' },
    { name: 'empty DELETE body', method: 'DELETE', body: '', expectedBody: '' },
    { name: 'JSON body', method: 'POST', body: '{"name":"silence"}', expectedBody: { name: 'silence' } },
    { name: 'plain-text body', method: 'POST', body: 'not JSON', expectedBody: 'not JSON' },
  ])('serializes $name', async ({ method, body, expectedBody }) => {
    const request = new Request('http://localhost/api/test', {
      method,
      body,
      headers: {
        'content-type': 'text/plain',
        'x-grafana-device-id': 'machine-specific-id',
      },
    });

    await expect(serializeRequests([request])).resolves.toEqual([
      {
        method,
        url: 'http://localhost/api/test',
        body: expectedBody,
        headers: [['content-type', 'text/plain']],
      },
    ]);
  });
});
