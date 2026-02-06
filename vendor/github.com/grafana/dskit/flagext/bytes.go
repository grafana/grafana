// Provenance-includes-location: https://github.com/thanos-io/thanos/blob/main/pkg/model/units.go
// Provenance-includes-license: Apache-2.0
// Provenance-includes-copyright: The Thanos Authors.

package flagext

import (
	"github.com/alecthomas/units"
)

// Bytes is a data type which supports use as a flag and yaml
// serialization/deserialization with units.
type Bytes uint64

// String implements flag.Value
func (b *Bytes) String() string {
	return units.Base2Bytes(*b).String()
}

// Set implements flag.Value
func (b *Bytes) Set(s string) error {
	bytes, err := units.ParseBase2Bytes(s)
	if err != nil {
		return err
	}

	*b = Bytes(bytes)
	return nil
}

func (b *Bytes) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var value string
	if err := unmarshal(&value); err != nil {
		return err
	}

	return b.Set(value)
}

func (b Bytes) MarshalYAML() (interface{}, error) {
	return b.String(), nil
}
