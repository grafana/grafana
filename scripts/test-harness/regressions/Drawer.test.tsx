import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { Drawer } from '../../../packages/grafana-ui/src/components/Drawer/Drawer';

describe('Drawer', () => {
  let mainView: HTMLDivElement;

  beforeEach(() => {
    mainView = document.createElement('div');
    mainView.classList.add('main-view');
    document.body.appendChild(mainView);
  });

  afterEach(() => {
    document.body.removeChild(mainView);
  });

  it('initially focuses the close button', async () => {
    render(
      <Drawer title="Inspect" onClose={() => {}}>
        <button>First action</button>
      </Drawer>
    );

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus());
  });

  it('wraps Tab and Shift+Tab within the drawer', async () => {
    const user = userEvent.setup();
    render(
      <>
        <button>Outside action</button>
        <Drawer title="Inspect" onClose={() => {}}>
          <button>First action</button>
          <button>Last action</button>
        </Drawer>
      </>
    );

    const close = screen.getByRole('button', { name: 'Close' });
    const first = screen.getByRole('button', { name: 'First action' });
    const last = screen.getByRole('button', { name: 'Last action' });
    await waitFor(() => expect(close).toHaveFocus());

    // The default scrollable content has its own tab stop for keyboard scrolling.
    await user.tab();
    expect(first.closest('[tabindex="0"]')).toHaveFocus();
    await user.tab();
    expect(first).toHaveFocus();
    await user.tab();
    expect(last).toHaveFocus();
    await user.tab();
    await waitFor(() => expect(close).toHaveFocus());
    await user.tab({ shift: true });
    await waitFor(() => expect(last).toHaveFocus());
  });

  it('returns focus to the opener after closing', async () => {
    const user = userEvent.setup();
    function DrawerWithTrigger() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open drawer</button>
          {open && (
            <Drawer title="Inspect" onClose={() => setOpen(false)}>
              <button>Drawer action</button>
            </Drawer>
          )}
        </>
      );
    }
    render(<DrawerWithTrigger />);

    const opener = screen.getByRole('button', { name: 'Open drawer' });
    await user.click(opener);
    const close = await screen.findByRole('button', { name: 'Close' });
    await waitFor(() => expect(close).toHaveFocus());
    await user.click(close);

    await waitFor(() => expect(opener).toHaveFocus());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
