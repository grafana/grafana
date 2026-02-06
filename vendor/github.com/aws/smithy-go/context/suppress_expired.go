package context

import "context"

// valueOnlyContext provides a utility to preserve only the values of a
// Context. Suppressing any cancellation or deadline on that context being
// propagated downstream of this value.
//
// If preserveExpiredValues is false (default), and the valueCtx is canceled,
// calls to lookup values with the Values method, will always return nil. Setting
// preserveExpiredValues to true, will allow the valueOnlyContext to lookup
// values in valueCtx even if valueCtx is canceled.
//
// Based on the Go standard libraries net/lookup.go onlyValuesCtx utility.
// https://github.com/golang/go/blob/da2773fe3e2f6106634673a38dc3a6eb875fe7d8/src/net/lookup.go
type valueOnlyContext struct {
	context.Context

	preserveExpiredValues bool
	valuesCtx             context.Context
}

var _ context.Context = (*valueOnlyContext)(nil)

// Value looks up the key, returning its value. If configured to not preserve
// values of expired context, and the wrapping context is canceled, nil will be
// returned.
func (v *valueOnlyContext) Value(key interface{}) interface{} {
	if !v.preserveExpiredValues {
		select {
		case <-v.valuesCtx.Done():
			return nil
		default:
		}
	}

	return v.valuesCtx.Value(key)
}

// WithSuppressCancel wraps the Context value, suppressing its deadline and
// cancellation events being propagated downstream to consumer of the returned
// context.
//
// By default the wrapped Context's Values are available downstream until the
// wrapped Context is canceled. Once the wrapped Context is canceled, Values
// method called on the context return will no longer lookup any key. As they
// are now considered expired.
//
// To override this behavior, use WithPreserveExpiredValues on the Context
// before it is wrapped by WithSuppressCancel. This will make the Context
// returned by WithSuppressCancel allow lookup of expired values.
func WithSuppressCancel(ctx context.Context) context.Context {
	return &valueOnlyContext{
		Context:   context.Background(),
		valuesCtx: ctx,

		preserveExpiredValues: GetPreserveExpiredValues(ctx),
	}
}

type preserveExpiredValuesKey struct{}

// WithPreserveExpiredValues adds a Value to the Context if expired values
// should be preserved, and looked up by a Context wrapped by
// WithSuppressCancel.
//
// WithPreserveExpiredValues must be added as a value to a Context, before that
// Context is wrapped by WithSuppressCancel
func WithPreserveExpiredValues(ctx context.Context, enable bool) context.Context {
	return context.WithValue(ctx, preserveExpiredValuesKey{}, enable)
}

// GetPreserveExpiredValues looks up, and returns the PreserveExpressValues
// value in the context. Returning true if enabled, false otherwise.
func GetPreserveExpiredValues(ctx context.Context) bool {
	v := ctx.Value(preserveExpiredValuesKey{})
	if v != nil {
		return v.(bool)
	}
	return false
}
