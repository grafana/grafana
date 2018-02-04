package chromedp

import (
	"context"
	"fmt"
	"time"

	"github.com/chromedp/cdproto/cdp"
	"github.com/chromedp/cdproto/dom"
	"github.com/chromedp/cdproto/input"
	"github.com/chromedp/chromedp/kb"
)

// MouseAction is a mouse action.
func MouseAction(typ input.MouseType, x, y int64, opts ...MouseOption) Action {
	me := input.DispatchMouseEvent(typ, float64(x), float64(y))

	// apply opts
	for _, o := range opts {
		me = o(me)
	}

	return me
}

// MouseClickXY sends a left mouse button click (ie, mousePressed and
// mouseReleased event) at the X, Y location.
func MouseClickXY(x, y int64, opts ...MouseOption) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		me := &input.DispatchMouseEventParams{
			Type:       input.MousePressed,
			X:          float64(x),
			Y:          float64(y),
			Button:     input.ButtonLeft,
			ClickCount: 1,
		}

		// apply opts
		for _, o := range opts {
			me = o(me)
		}

		err := me.Do(ctxt, h)
		if err != nil {
			return err
		}

		me.Type = input.MouseReleased
		return me.Do(ctxt, h)
	})
}

// MouseClickNode dispatches a mouse left button click event at the center of a
// specified node.
//
// Note that the window will be scrolled if the node is not within the window's
// viewport.
func MouseClickNode(n *cdp.Node, opts ...MouseOption) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		var err error

		var pos []int
		err = EvaluateAsDevTools(fmt.Sprintf(scrollIntoViewJS, n.FullXPath()), &pos).Do(ctxt, h)
		if err != nil {
			return err
		}

		box, err := dom.GetBoxModel().WithNodeID(n.NodeID).Do(ctxt, h)
		if err != nil {
			return err
		}

		c := len(box.Content)
		if c%2 != 0 || c < 1 {
			return ErrInvalidDimensions
		}

		var x, y int64
		for i := 0; i < c; i += 2 {
			x += int64(box.Content[i])
			y += int64(box.Content[i+1])
		}
		x /= int64(c / 2)
		y /= int64(c / 2)

		return MouseClickXY(x, y, opts...).Do(ctxt, h)
	})
}

// MouseOption is a mouse action option.
type MouseOption func(*input.DispatchMouseEventParams) *input.DispatchMouseEventParams

// Button is a mouse action option to set the button to click from a string.
func Button(btn string) MouseOption {
	return ButtonType(input.ButtonType(btn))
}

// ButtonType is a mouse action option to set the button to click.
func ButtonType(button input.ButtonType) MouseOption {
	return func(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
		return p.WithButton(button)
	}
}

// ButtonLeft is a mouse action option to set the button clicked as the left
// mouse button.
func ButtonLeft(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
	return p.WithButton(input.ButtonLeft)
}

// ButtonMiddle is a mouse action option to set the button clicked as the middle
// mouse button.
func ButtonMiddle(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
	return p.WithButton(input.ButtonMiddle)
}

// ButtonRight is a mouse action option to set the button clicked as the right
// mouse button.
func ButtonRight(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
	return p.WithButton(input.ButtonRight)
}

// ButtonNone is a mouse action option to set the button clicked as none (used
// for mouse movements).
func ButtonNone(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
	return p.WithButton(input.ButtonNone)
}

// ButtonModifiers is a mouse action option to add additional input modifiers
// for a button click.
func ButtonModifiers(modifiers ...input.Modifier) MouseOption {
	return func(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
		for _, m := range modifiers {
			p.Modifiers |= m
		}
		return p
	}
}

// ClickCount is a mouse action option to set the click count.
func ClickCount(n int) MouseOption {
	return func(p *input.DispatchMouseEventParams) *input.DispatchMouseEventParams {
		return p.WithClickCount(int64(n))
	}
}

// KeyAction will synthesize a keyDown, char, and keyUp event for each rune
// contained in keys along with any supplied key options.
//
// Only well-known, "printable" characters will have char events synthesized.
//
// Please see the chromedp/kb package for implementation details and the list
// of well-known keys.
func KeyAction(keys string, opts ...KeyOption) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		var err error

		for _, r := range keys {
			for _, k := range kb.Encode(r) {
				err = k.Do(ctxt, h)
				if err != nil {
					return err
				}
			}

			// TODO: move to context
			time.Sleep(5 * time.Millisecond)
		}

		return nil
	})
}

// KeyActionNode dispatches a key event on a node.
func KeyActionNode(n *cdp.Node, keys string, opts ...KeyOption) Action {
	return ActionFunc(func(ctxt context.Context, h cdp.Executor) error {
		err := dom.Focus().WithNodeID(n.NodeID).Do(ctxt, h)
		if err != nil {
			return err
		}

		return KeyAction(keys, opts...).Do(ctxt, h)
	})
}

// KeyOption is a key action option.
type KeyOption func(*input.DispatchKeyEventParams) *input.DispatchKeyEventParams

// KeyModifiers is a key action option to add additional modifiers on the key
// press.
func KeyModifiers(modifiers ...input.Modifier) KeyOption {
	return func(p *input.DispatchKeyEventParams) *input.DispatchKeyEventParams {
		for _, m := range modifiers {
			p.Modifiers |= m
		}
		return p
	}
}
