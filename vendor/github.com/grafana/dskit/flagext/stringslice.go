package flagext

import "fmt"

// StringSlice is a slice of strings that implements flag.Value
type StringSlice []string

// String implements flag.Value
func (v StringSlice) String() string {
	return fmt.Sprintf("%s", []string(v))
}

// Set implements flag.Value
func (v *StringSlice) Set(s string) error {
	*v = append(*v, s)
	return nil
}
