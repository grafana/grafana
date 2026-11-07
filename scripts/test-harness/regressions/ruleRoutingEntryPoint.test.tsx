import { render, screen } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports
import { MemoryRouter } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';

import { config } from '@grafana/runtime';
import { RuleRouting } from 'app/features/alerting/unified/gma-rule-list/rule-row/RuleRouting';

// Match source-suite discovery when this guard runs against the old utility imports.
jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

it('renders an encoded contact-point link without loading datasource or broad alerting utilities', () => {
  const originalSubUrl = config.appSubUrl;
  config.appSubUrl = '/grafana';
  try {
    render(
      <MemoryRouter>
        <CompatRouter>
          <RuleRouting
            searchHit={{
              uid: 'rule-1',
              title: 'CPU high',
              notificationType: 'SimplifiedRouting',
              receiver: 'Ops / Ω & on-call',
            }}
          />
        </CompatRouter>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Ops / Ω & on-call' })).toHaveAttribute(
      'href',
      '/grafana/alerting/notifications?search=Ops+%2F+%CE%A9+%26+on-call&tab=contact_points&alertmanager=grafana'
    );
    expect(require.cache[require.resolve('app/features/alerting/unified/utils/datasource')]).toBeUndefined();
    expect(require.cache[require.resolve('app/features/alerting/unified/utils/misc')]).toBeUndefined();
    expect(require.cache[require.resolve('@grafana/alerting/unstable')]).toBeUndefined();
  } finally {
    config.appSubUrl = originalSubUrl;
  }
});
