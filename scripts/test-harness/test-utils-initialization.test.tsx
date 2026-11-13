import { useState } from 'react';
import { render, screen } from 'test/test-utils';

// Harness-only roots do not discover the source suites' manual mock.
jest.mock('uwrap', () => jest.requireActual('../../packages/grafana-ui/src/components/Table/TableNG/__mocks__/uwrap'), {
  virtual: true,
});

// Capture initialization before any test can load dependencies through render.
const appDependencies = [
  '@grafana/runtime',
  'app/core/context/GrafanaContext',
  'app/core/context/ModalsContextProvider',
  'app/store/configureStore',
  'test/helpers/testWithFeatureToggles',
].map((moduleName) => ({
  moduleName,
  loadedAtSuiteSetup: require.cache[require.resolve(moduleName)] !== undefined,
}));
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

it.each(appDependencies)('loads $moduleName at suite setup', ({ loadedAtSuiteSetup }) => {
  expect(loadedAtSuiteSetup).toBe(true);
});

it('updates rendered state through user interactions', async () => {
  const { user } = render(<Counter />);
  await user.click(screen.getByRole('button', { name: 'Count: 0' }));

  expect(screen.getByRole('button', { name: 'Count: 1' })).toBeInTheDocument();
});
