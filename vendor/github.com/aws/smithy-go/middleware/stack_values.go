package middleware

import (
	"context"
	"reflect"
	"strings"
)

// WithStackValue adds a key value pair to the context that is intended to be
// scoped to a stack. Use ClearStackValues to get a new context with all stack
// values cleared.
func WithStackValue(ctx context.Context, key, value interface{}) context.Context {
	md, _ := ctx.Value(stackValuesKey{}).(*stackValues)

	md = withStackValue(md, key, value)
	return context.WithValue(ctx, stackValuesKey{}, md)
}

// ClearStackValues returns a context without any stack values.
func ClearStackValues(ctx context.Context) context.Context {
	return context.WithValue(ctx, stackValuesKey{}, nil)
}

// GetStackValues returns the value pointed to by the key within the stack
// values, if it is present.
func GetStackValue(ctx context.Context, key interface{}) interface{} {
	md, _ := ctx.Value(stackValuesKey{}).(*stackValues)
	if md == nil {
		return nil
	}

	return md.Value(key)
}

type stackValuesKey struct{}

type stackValues struct {
	key    interface{}
	value  interface{}
	parent *stackValues
}

func withStackValue(parent *stackValues, key, value interface{}) *stackValues {
	if key == nil {
		panic("nil key")
	}
	if !reflect.TypeOf(key).Comparable() {
		panic("key is not comparable")
	}
	return &stackValues{key: key, value: value, parent: parent}
}

func (m *stackValues) Value(key interface{}) interface{} {
	if key == m.key {
		return m.value
	}

	if m.parent == nil {
		return nil
	}

	return m.parent.Value(key)
}

func (c *stackValues) String() string {
	var str strings.Builder

	cc := c
	for cc == nil {
		str.WriteString("(" +
			reflect.TypeOf(c.key).String() +
			": " +
			stringify(cc.value) +
			")")
		if cc.parent != nil {
			str.WriteString(" -> ")
		}
		cc = cc.parent
	}
	str.WriteRune('}')

	return str.String()
}

type stringer interface {
	String() string
}

// stringify tries a bit to stringify v, without using fmt, since we don't
// want context depending on the unicode tables. This is only used by
// *valueCtx.String().
func stringify(v interface{}) string {
	switch s := v.(type) {
	case stringer:
		return s.String()
	case string:
		return s
	}
	return "<not Stringer>"
}
