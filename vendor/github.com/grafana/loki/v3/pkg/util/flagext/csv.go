package flagext

import (
	"strings"
)

type ListValue interface {
	String() string
	Parse(s string) (any, error)
}

// StringSliceCSV is a slice of strings that is parsed from a comma-separated string
// It implements flag.Value and yaml Marshalers
type CSV[T ListValue] []T

// String implements flag.Value
func (v CSV[T]) String() string {
	s := make([]string, 0, len(v))
	for i := range v {
		s = append(s, v[i].String())
	}
	return strings.Join(s, ",")
}

// Set implements flag.Value
func (v *CSV[T]) Set(s string) error {
	if len(s) == 0 {
		*v = nil
		return nil
	}
	var zero T
	values := strings.Split(s, ",")
	*v = make(CSV[T], 0, len(values))
	for _, val := range values {
		el, err := zero.Parse(val)
		if err != nil {
			return err
		}
		*v = append(*v, el.(T))
	}
	return nil
}

// String implements flag.Getter
func (v CSV[T]) Get() []T {
	return v
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (v *CSV[T]) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}

	return v.Set(s)
}

// MarshalYAML implements yaml.Marshaler.
func (v CSV[T]) MarshalYAML() (interface{}, error) {
	return v.String(), nil
}
