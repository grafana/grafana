import { getConfig, render, screen } from '@testing-library/react';
import { useEffect } from 'react';

const cleanup = jest.fn();

function CleanupProbe() {
  useEffect(() => cleanup, []);
  return <div>Cleanup probe</div>;
}

it('retains the shared timeout and the real React testing implementation', () => {
  expect(getConfig().asyncUtilTimeout).toBe(2000);
  render(<CleanupProbe />);
  expect(screen.getByText('Cleanup probe')).toBeInTheDocument();
  expect(cleanup).not.toHaveBeenCalled();
});

it('runs automatic React cleanup between tests', () => {
  expect(cleanup).toHaveBeenCalledTimes(1);
  expect(document.body).toBeEmptyDOMElement();
  render(<div>Fresh render</div>);
  expect(screen.getByText('Fresh render')).toBeInTheDocument();
});
