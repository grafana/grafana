package chromedp

// Error is a chromedp error.
type Error string

// Error satisfies the error interface.
func (e Error) Error() string {
	return string(e)
}

// Error types.
const (
	// ErrInvalidDimensions is the invalid dimensions error.
	ErrInvalidDimensions Error = "invalid dimensions"

	// ErrNoResults is the no results error.
	ErrNoResults Error = "no results"

	// ErrHasResults is the has results error.
	ErrHasResults Error = "has results"

	// ErrNotVisible is the not visible error.
	ErrNotVisible Error = "not visible"

	// ErrVisible is the visible error.
	ErrVisible Error = "visible"

	// ErrDisabled is the disabled error.
	ErrDisabled Error = "disabled"

	// ErrNotSelected is the not selected error.
	ErrNotSelected Error = "not selected"

	// ErrInvalidBoxModel is the invalid box model error.
	ErrInvalidBoxModel Error = "invalid box model"

	// ErrChannelClosed is the channel closed error.
	ErrChannelClosed Error = "channel closed"

	// ErrInvalidHandler is the invalid handler error.
	ErrInvalidHandler Error = "invalid handler"
)
