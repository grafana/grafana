package graphql

import (
	"context"
	"errors"
	"reflect"
)

const unmarshalInputCtx key = "unmarshal_input_context"

// BuildUnmarshalerMap returns a map of unmarshal functions of the ExecutableContext
// to use with the WithUnmarshalerMap function.
func BuildUnmarshalerMap(unmarshaler ...any) map[reflect.Type]reflect.Value {
	maps := make(map[reflect.Type]reflect.Value)
	for _, v := range unmarshaler {
		ft := reflect.TypeOf(v)
		if ft.Kind() == reflect.Func {
			maps[ft.Out(0)] = reflect.ValueOf(v)
		}
	}

	return maps
}

// WithUnmarshalerMap returns a new context with a map from input types to their unmarshaler functions.
func WithUnmarshalerMap(ctx context.Context, maps map[reflect.Type]reflect.Value) context.Context {
	return context.WithValue(ctx, unmarshalInputCtx, maps)
}

// UnmarshalInputFromContext allows unmarshaling input object from a context.
func UnmarshalInputFromContext(ctx context.Context, raw, v any) error {
	m, ok := ctx.Value(unmarshalInputCtx).(map[reflect.Type]reflect.Value)
	if m == nil || !ok {
		return errors.New("graphql: the input context is empty")
	}

	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return errors.New("graphql: input must be a non-nil pointer")
	}
	if fn, ok := m[rv.Elem().Type()]; ok {
		res := fn.Call([]reflect.Value{
			reflect.ValueOf(ctx),
			reflect.ValueOf(raw),
		})
		if err := res[1].Interface(); err != nil {
			return err.(error)
		}

		rv.Elem().Set(res[0])
		return nil
	}

	return errors.New("graphql: no unmarshal function found")
}
