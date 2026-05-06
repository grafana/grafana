package flagext

import "strings"

// StringSliceCSV is a slice of strings that is parsed from a comma-separated string
// It implements flag.Value and yaml Marshalers
type StringSliceCSV []string

// String implements flag.Value
func (v StringSliceCSV) String() string {
	return strings.Join(v, ",")
}

// Set implements flag.Value
func (v *StringSliceCSV) Set(s string) error {
	if len(s) == 0 {
		*v = nil
		return nil
	}
	*v = strings.Split(s, ",")
	return nil
}

// UnmarshalYAML implements yaml.Unmarshaler.
func (v *StringSliceCSV) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var s string
	if err := unmarshal(&s); err != nil {
		return err
	}

	return v.Set(s)
}

// MarshalYAML implements yaml.Marshaler.
func (v StringSliceCSV) MarshalYAML() (interface{}, error) {
	return v.String(), nil
}
