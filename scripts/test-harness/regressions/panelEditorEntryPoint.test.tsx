import { render, screen } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports
import { MemoryRouter } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';

import { OptionsPaneCategory } from 'app/features/dashboard/components/PanelEditor/OptionsPaneCategory';
import { PANEL_EDITOR_UI_STATE_STORAGE_KEY } from 'app/features/dashboard/components/PanelEditor/types';

// Match source-suite discovery when this guard runs against the old reducer import.
jest.mock(
  'uwrap',
  () => jest.requireActual('../../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'),
  { virtual: true }
);

it('reads the existing category storage key without loading the legacy panel reducer or model', () => {
  const key = 'grafana.dashboard.editor.ui.optionGroup[entry-point]';
  localStorage.setItem(key, JSON.stringify({ isExpanded: true }));
  try {
    render(
      <MemoryRouter>
        <CompatRouter>
          <OptionsPaneCategory id="entry-point" title="Saved category" isOpenDefault={false}>
            Saved content
          </OptionsPaneCategory>
        </CompatRouter>
      </MemoryRouter>
    );

    expect(PANEL_EDITOR_UI_STATE_STORAGE_KEY).toBe('grafana.dashboard.editor.ui');
    expect(screen.getByRole('group', { name: 'Saved category' })).toHaveTextContent('Saved content');
    expect(
      require.cache[require.resolve('app/features/dashboard/components/PanelEditor/state/reducers')]
    ).toBeUndefined();
    expect(require.cache[require.resolve('app/features/dashboard/state/PanelModel')]).toBeUndefined();
  } finally {
    localStorage.removeItem(key);
  }
});
