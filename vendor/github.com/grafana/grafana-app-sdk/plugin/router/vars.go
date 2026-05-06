package router

import (
	"context"
	"fmt"
)

// Vars is a mapping of string keys to string values,
// which holds variables captured from the route.
// e.g. if the route was defined as "/foo/{id}/bar",
// Vars will contains a key with "id" and value passed in the actual URL.
type Vars map[string]string

// NewVars returns a new empty Vars.
func NewVars(from map[string]string) Vars {
	r := make(Vars)

	for k, v := range from {
		r.Add(k, v)
	}

	return r
}

// Get gets the value with key k.
// It returns an extra value which indicates whether the value was present in Vars.
// If Vars are empty, the value is not present or is an empty string, the second return value will be false.
func (v Vars) Get(k string) (string, bool) {
	if v == nil {
		return "", false
	}

	s, ok := v[k]
	if !ok || s == "" {
		return s, false
	}

	return s, true
}

// MustGet behaves like Get but panics if the value is missing.
func (v Vars) MustGet(k string) string {
	s, ok := v.Get(k)
	if !ok {
		panic(fmt.Sprintf("no key '%s' found in Vars", k))
	}

	return s
}

// Add adds a new value s with key k to Vars.
func (v Vars) Add(k, s string) Vars {
	if v == nil {
		v = NewVars(nil)
	}
	v[k] = s
	return v
}

type ctxPathParamsKey struct{}

// CtxWithVar adds new value value with name name to context ctx.
// If ctx already contains Vars, the value will be appended,
// otherwise a new Vars will be created, value will be added to it and it will be stored in ctx.
func CtxWithVar(ctx context.Context, name, value string) context.Context {
	return CtxWithVars(ctx, VarsFromCtx(ctx).Add(name, value))
}

// CtxWithVars adds Vars to context.
// If Vars already were present in the context they will be overwritten.
func CtxWithVars(ctx context.Context, vars Vars) context.Context {
	return context.WithValue(ctx, ctxPathParamsKey{}, vars)
}

// VarsFromCtx returns Vars that have been set in the context.Context provided.
// If there were no Vars in the context a new, empty Vars is returned.
func VarsFromCtx(ctx context.Context) Vars {
	if vars, ok := ctx.Value(ctxPathParamsKey{}).(Vars); ok {
		return vars
	}

	return NewVars(nil)
}
