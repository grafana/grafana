package chromedp

import (
	"context"
	"time"

	"github.com/chromedp/cdproto/cdp"
)

// Action is the common interface for an action that will be executed against a
// context and frame handler.
type Action interface {
	// Do executes the action using the provided context and frame handler.
	Do(context.Context, cdp.Executor) error
}

// ActionFunc is a adapter to allow the use of ordinary func's as an Action.
type ActionFunc func(context.Context, cdp.Executor) error

// Do executes the func f using the provided context and frame handler.
func (f ActionFunc) Do(ctxt context.Context, h cdp.Executor) error {
	return f(ctxt, h)
}

// Tasks is a sequential list of Actions that can be used as a single Action.
type Tasks []Action

// Do executes the list of Actions sequentially, using the provided context and
// frame handler.
func (t Tasks) Do(ctxt context.Context, h cdp.Executor) error {
	// TODO: put individual task timeouts from context here
	for _, a := range t {
		// ctxt, cancel = context.WithTimeout(ctxt, timeout)
		// defer cancel()
		if err := a.Do(ctxt, h); err != nil {
			return err
		}
	}

	return nil
}

// Sleep is an empty action that calls time.Sleep with the specified duration.
//
// Note: this is a temporary action definition for convenience, and will likely
// be marked for deprecation in the future, after the remaining Actions have
// been able to be written/tested.
func Sleep(d time.Duration) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		select {
		case <-time.After(d):

		case <-ctxt.Done():
			return ctxt.Err()
		}
		return nil
	})
}
