import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { config } from '@grafana/runtime';
import { GrafanaExportDrawer } from 'app/features/alerting/unified/components/export/GrafanaExportDrawer';
import {
  allGrafanaExportProviders,
  type ExportFormats,
} from 'app/features/alerting/unified/components/export/providers';
import { RuleInspectorTabs } from 'app/features/alerting/unified/components/rule-editor/RuleInspectorTabs';
import type * as EvaluationInterval from 'app/features/alerting/unified/rule-editor/defaultEvaluationInterval';

// Match source-suite discovery if an editor dependency is accidentally reintroduced.
jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

describe('default evaluation interval', () => {
  it.each([
    { name: 'missing alerting config', unifiedAlerting: undefined, expected: '1m' },
    { name: 'missing minimum interval', unifiedAlerting: {}, expected: '1m' },
    { name: 'invalid minimum interval', unifiedAlerting: { minInterval: 'invalid' }, expected: '1m' },
    { name: 'zero minimum interval', unifiedAlerting: { minInterval: '0s' }, expected: '1m' },
    { name: 'below the lower bound', unifiedAlerting: { minInterval: '59s' }, expected: '1m' },
    { name: 'at the lower bound', unifiedAlerting: { minInterval: '60s' }, expected: '1m' },
    { name: 'above the lower bound', unifiedAlerting: { minInterval: '90s' }, expected: '1m30s' },
    { name: 'millisecond precision', unifiedAlerting: { minInterval: '60001ms' }, expected: '1m1ms' },
    { name: 'compound duration', unifiedAlerting: { minInterval: '1h2m3s4ms' }, expected: '1h2m3s4ms' },
    { name: 'no finite upper bound', unifiedAlerting: { minInterval: '30d' }, expected: '4w2d' },
  ])('uses $expected for $name', ({ unifiedAlerting, expected }) => {
    jest.isolateModules(() => {
      const { config } = require('@grafana/runtime') as typeof import('@grafana/runtime');
      const original = config.unifiedAlerting;
      // Older boot data can omit settings that are required by the current TypeScript interface.
      Object.assign(config, { unifiedAlerting });
      try {
        const { DEFAULT_GROUP_EVALUATION_INTERVAL } =
          require('app/features/alerting/unified/rule-editor/defaultEvaluationInterval') as typeof EvaluationInterval;
        expect(DEFAULT_GROUP_EVALUATION_INTERVAL).toBe(expected);
      } finally {
        config.unifiedAlerting = original;
      }
    });
  });

  it('captures config at module initialization without loading form defaults or rule conversion', () => {
    const original = config.unifiedAlerting;
    config.unifiedAlerting = { minInterval: '90s' };
    try {
      const interval =
        require('app/features/alerting/unified/rule-editor/defaultEvaluationInterval') as typeof EvaluationInterval;
      config.unifiedAlerting.minInterval = '10m';

      expect(interval.DEFAULT_GROUP_EVALUATION_INTERVAL).toBe('1m30s');
      expect(
        require('app/features/alerting/unified/rule-editor/defaultEvaluationInterval').DEFAULT_GROUP_EVALUATION_INTERVAL
      ).toBe('1m30s');
      expect(require.cache[require.resolve('app/features/alerting/unified/rule-editor/formDefaults')]).toBeUndefined();
      expect(require.cache[require.resolve('app/features/alerting/unified/utils/rule-form')]).toBeUndefined();
    } finally {
      config.unifiedAlerting = original;
    }
  });
});

it('reports tab values and changes selection only when activeTab changes', async () => {
  const user = userEvent.setup();
  const setActiveTab = jest.fn();
  const tabs = [
    { label: 'YAML', value: 'yaml' as const },
    { label: 'Terraform (HCL)', value: 'hcl' as const },
  ];
  const { rerender } = render(
    <RuleInspectorTabs<ExportFormats> tabs={tabs} activeTab="yaml" setActiveTab={setActiveTab} />
  );

  expect(screen.getByRole('tab', { name: 'YAML', selected: true })).toBeInTheDocument();
  await user.click(screen.getByRole('tab', { name: 'Terraform (HCL)', selected: false }));
  expect(setActiveTab.mock.calls).toEqual([['hcl']]);
  expect(screen.getByRole('tab', { name: 'YAML', selected: true })).toBeInTheDocument();

  rerender(<RuleInspectorTabs<ExportFormats> tabs={tabs} activeTab="hcl" setActiveTab={setActiveTab} />);
  expect(screen.getByRole('tab', { name: 'Terraform (HCL)', selected: true })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'YAML', selected: false })).toBeInTheDocument();
});

describe('export drawer leaf entry point', () => {
  let mainView: HTMLDivElement;

  beforeEach(() => {
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    mainView.remove();
  });

  it('uses the real tabs without loading the rule inspector or form conversion', async () => {
    const user = userEvent.setup();
    const onTabChange = jest.fn();
    const onClose = jest.fn();
    const props = {
      formatProviders: Object.values(allGrafanaExportProviders),
      onTabChange,
      onClose,
      children: 'Rule export content',
    };
    const { rerender } = render(<GrafanaExportDrawer {...props} activeTab="json" />);

    expect(await screen.findByRole('tab', { name: 'JSON', selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'YAML', selected: false }));
    expect(onTabChange.mock.calls).toEqual([['yaml']]);

    rerender(<GrafanaExportDrawer {...props} activeTab="yaml" />);
    expect(screen.getByRole('tab', { name: 'YAML', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'JSON', selected: false })).toBeInTheDocument();
    expect(screen.getByText('Rule export content')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    expect(
      require.cache[require.resolve('app/features/alerting/unified/components/rule-editor/RuleInspector')]
    ).toBeUndefined();
    expect(require.cache[require.resolve('app/features/alerting/unified/utils/rule-form')]).toBeUndefined();
  });
});
