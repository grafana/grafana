package graphql

import (
	"context"
	"encoding/json"
	"io"
)

// Omittable is a wrapper around a value that also stores whether it is set
// or not.
type Omittable[T any] struct {
	value T
	set   bool
}

var (
	_ json.Marshaler   = Omittable[struct{}]{}
	_ json.Unmarshaler = (*Omittable[struct{}])(nil)
)

func OmittableOf[T any](value T) Omittable[T] {
	return Omittable[T]{
		value: value,
		set:   true,
	}
}

func (o Omittable[T]) Value() T {
	if !o.set {
		var zero T
		return zero
	}
	return o.value
}

func (o Omittable[T]) ValueOK() (T, bool) {
	if !o.set {
		var zero T
		return zero, false
	}
	return o.value, true
}

func (o Omittable[T]) IsSet() bool {
	return o.set
}

// IsZero returns true then json.Marshal will omit this value.
// > The "omitzero" option specifies that the field should be omitted from the encoding if the field has a zero value, according to rules:
// > 1) If the field type has an "IsZero() bool" method, that will be used to determine whether the value is zero.
// > 2) Otherwise, the value is zero if it is the zero value for its type.
// https://pkg.go.dev/encoding/json#Marshal
func (o Omittable[T]) IsZero() bool {
	return !o.set
}

func (o Omittable[T]) MarshalJSON() ([]byte, error) {
	var value any = o.value
	if !o.set {
		var zero T
		value = zero
	}

	return json.Marshal(value)
}

func (o *Omittable[T]) UnmarshalJSON(bytes []byte) error {
	err := json.Unmarshal(bytes, &o.value)
	if err != nil {
		return err
	}
	o.set = true
	return nil
}

func (o Omittable[T]) MarshalGQL(w io.Writer) {
	var value any = o.value
	if !o.set {
		var zero T
		value = zero
	}

	switch marshaler := value.(type) {
	case Marshaler:
		marshaler.MarshalGQL(w)
	case ContextMarshaler:
		_ = marshaler.MarshalGQLContext(context.Background(), w)
	default:
		b, _ := json.Marshal(value)
		w.Write(b)
	}
}

func (o *Omittable[T]) UnmarshalGQL(bytes []byte) error {
	switch unmarshaler := any(o.value).(type) {
	case Unmarshaler:
		if err := unmarshaler.UnmarshalGQL(bytes); err != nil {
			return err
		}
		o.set = true
	case ContextUnmarshaler:
		if err := unmarshaler.UnmarshalGQLContext(context.Background(), bytes); err != nil {
			return err
		}
		o.set = true
	default:
		if err := json.Unmarshal(bytes, &o.value); err != nil {
			return err
		}
		o.set = true
	}
	return nil
}

func (o Omittable[T]) MarshalGQLContext(ctx context.Context, w io.Writer) {
	var value any = o.value
	if !o.set {
		var zero T
		value = zero
	}

	switch marshaler := value.(type) {
	case ContextMarshaler:
		_ = marshaler.MarshalGQLContext(ctx, w)
	case Marshaler:
		marshaler.MarshalGQL(w)
	default:
		b, _ := json.Marshal(value)
		w.Write(b)
	}
}

func (o *Omittable[T]) UnmarshalGQLContext(ctx context.Context, bytes []byte) error {
	switch unmarshaler := any(o.value).(type) {
	case ContextUnmarshaler:
		if err := unmarshaler.UnmarshalGQLContext(ctx, bytes); err != nil {
			return err
		}
		o.set = true
	case Unmarshaler:
		if err := unmarshaler.UnmarshalGQL(bytes); err != nil {
			return err
		}
		o.set = true
	default:
		if err := json.Unmarshal(bytes, &o.value); err != nil {
			return err
		}
		o.set = true
	}
	return nil
}
