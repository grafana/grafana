import { FloatingFocusManager, useFloating } from '@floating-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const actions = ['First', 'Second', 'Third', 'Last'];

// Drawer does not expose restoreFocus, so exercise the dependency's opt-in behavior directly.
function FocusManager({ restoreFocus, items = actions }: { restoreFocus: boolean; items?: string[] }) {
  const { context, refs } = useFloating({ open: true });

  return (
    <>
      <button ref={refs.setReference}>Open dialog</button>
      <FloatingFocusManager context={context} restoreFocus={restoreFocus}>
        <div ref={refs.setFloating} role="dialog" aria-label="Actions">
          {items.map((item) => (
            <button key={item}>{item}</button>
          ))}
        </div>
      </FloatingFocusManager>
    </>
  );
}

describe('FloatingFocusManager restoreFocus', () => {
  it.each([
    { removed: 'Second', expected: 'Third' },
    { removed: 'Last', expected: 'Third' },
  ])('focuses $expected when the focused $removed action is removed', async ({ removed, expected }) => {
    const user = userEvent.setup();
    const { rerender } = render(<FocusManager restoreFocus />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());

    const focused = screen.getByRole('button', { name: removed });
    await user.click(focused);
    expect(focused).toHaveFocus();

    act(() => {
      // DOM emulators do not consistently emit focusout on removal. Blur while attached,
      // then remove before FloatingFocusManager's queued restoration checks isConnected.
      focused.blur();
      rerender(<FocusManager restoreFocus items={actions.filter((item) => item !== removed)} />);
    });

    await waitFor(() => expect(screen.getByRole('button', { name: expected })).toHaveFocus());
    expect(focused).not.toBeInTheDocument();
  });

  it.each(['before', 'after'] as const)(
    'restores the focused index when focus moves %s enabling restoreFocus',
    async (focusTiming) => {
      const user = userEvent.setup();
      const { rerender } = render(<FocusManager restoreFocus={false} />);
      await waitFor(() => expect(screen.getByRole('button', { name: 'First' })).toHaveFocus());

      const second = screen.getByRole('button', { name: 'Second' });
      if (focusTiming === 'before') {
        await user.click(second);
      }

      rerender(<FocusManager restoreFocus />);

      if (focusTiming === 'after') {
        await user.tab();
      }
      expect(second).toHaveFocus();

      act(() => {
        second.blur();
        rerender(<FocusManager restoreFocus items={['First', 'Third', 'Last']} />);
      });

      // An uninitialized index would incorrectly select Last instead of Third.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Third' })).toHaveFocus());
      expect(second).not.toBeInTheDocument();
    }
  );
});
