package flagext

import (
	"encoding/json"
	"strings"

	"github.com/c2h5oh/datasize"
)

// ByteSize is a flag parsing compatibility type for constructing human friendly sizes.
// It implements flag.Value & flag.Getter.
type ByteSize uint64

func (bs ByteSize) String() string {
	return datasize.ByteSize(bs).String()
}

func (bs *ByteSize) Set(s string) error {
	var v datasize.ByteSize

	// Bytesize currently doesn't handle things like Mb, but only handles MB.
	// Therefore we capitalize just for convenience
	if err := v.UnmarshalText([]byte(strings.ToUpper(s))); err != nil {
		return err
	}
	*bs = ByteSize(v.Bytes())
	return nil
}

func (bs ByteSize) Get() interface{} {
	return bs.Val()
}

func (bs ByteSize) Val() int {
	return int(bs)
}

// UnmarshalYAML the Unmarshaler interface of the yaml pkg.
func (bs *ByteSize) UnmarshalYAML(unmarshal func(interface{}) error) error {
	var str string
	err := unmarshal(&str)
	if err != nil {
		return err
	}

	return bs.Set(str)
}

// MarshalYAML implements yaml.Marshaller.
// Use a string representation for consistency
func (bs ByteSize) MarshalYAML() (interface{}, error) {
	return bs.String(), nil
}

// UnmarshalJSON implements json.Unmarsal interface to work with JSON.
func (bs *ByteSize) UnmarshalJSON(val []byte) error {
	var str string

	if err := json.Unmarshal(val, &str); err != nil {
		return err
	}

	return bs.Set(str)
}

// Use a string representation for consistency
func (bs ByteSize) MarshalJSON() ([]byte, error) {
	return json.Marshal(bs.String())
}
