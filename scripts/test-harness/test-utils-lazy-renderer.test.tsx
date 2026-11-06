import { useState } from 'react';
import { render, screen } from 'test/test-utils';

// Keep app/runtime imports out of this suite so the first render exercises their deferred initialization.
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

it('loads the real renderer during a test without registering nested lifecycle hooks', async () => {
  expect(require.cache[require.resolve('test/test-utils-renderer')]).toBeUndefined();

  const { user } = render(<Counter />);
  await user.click(screen.getByRole('button', { name: 'Count: 0' }));

  expect(screen.getByRole('button', { name: 'Count: 1' })).toBeInTheDocument();
});
